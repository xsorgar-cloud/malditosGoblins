class BotManager {
    // Constructor del BotManager: inicializa el estado del juego y las variables de control
constructor(gameState) {
        this.gameState = gameState;
        this.activeBots = [];
        this.isActing = false;
    }

    // --- AUTOMATIZACIÓN DE TURNOS ---

    // Gestiona el estado actual del juego y delega la acción correspondiente al bot
handleGameState() {
        console.log("[BotManager] handleGameState called. isActing:", this.isActing);
        if (this.gameState.isGameOver || this.gameState.isGameWon) {
            console.log("[BotManager] Game over or won. Aborting.");
            return;
        }

        if (window.botsPaused) {
            console.log("[BotManager] Bots are paused.");
            return;
        }
        
        if (this.isActing) {
            console.log("[BotManager] isActing is true. Aborting.");
            return;
        }

        if (window.isRollingCombatDice) {
            console.log("[BotManager] Dice are rolling. Aborting.");
            return;
        }

        // Verificar si algún bot tiene una elección de subida de nivel pendiente y manejarla autónomamente
        const botWithLevelUp = this.gameState.players.find(p => p.isBot && p.pendingLevelUpChoice);
        if (botWithLevelUp) {
            this.isActing = true;
            const pIndex = this.gameState.players.indexOf(botWithLevelUp);
            const choice = this.getBotLevelUpChoice(botWithLevelUp);
            
            this.gameState.addLog(`🤖 El bot <strong>${botWithLevelUp.name}</strong> está pensando su elección de subida de nivel...`);
            
            setTimeout(() => {
                if (window.botsPaused) {
                    this.isActing = false;
                    return;
                }
                window.handleLevelUpChoice(pIndex, choice);
                this.isActing = false;
                this.handleGameState();
            }, 1500);
            return;
        }

        let activePlayer = this.gameState.getCurrentPlayer();
        
        // Si estamos en la fase de represalia y el jugador activo actual está muerto,
        // delegamos la acción al primer bot vivo para resolver la represalia.
        if (this.gameState.isRetaliationPhase && activePlayer && activePlayer.hp <= 0) {
            const firstLiveBot = this.gameState.players.find(p => p.isBot && p.hp > 0);
            if (firstLiveBot) {
                activePlayer = firstLiveBot;
            }
        }

        if (!activePlayer || !activePlayer.isBot || activePlayer.hp <= 0) {
            console.log("[BotManager] Not a bot's turn or active bot is dead.");
            this.hideAllBubbles();
            return;
        }

        // Bloquear si el overlay de eventos globales está visible por un diálogo/alerta no perteneciente a una fase de decisión del bot
        const overlay = document.getElementById('global-event-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            const isBotRetaliation = this.gameState.isRetaliationPhase;
            const isBotEvent = this.gameState.isGlobalEventActive;
            const isBotCorrosion = this.gameState.pendingCorrosionChoice && this.gameState.pendingCorrosionChoice.player && this.gameState.pendingCorrosionChoice.player.id === activePlayer.id;
            
            if (!isBotRetaliation && !isBotEvent && !isBotCorrosion) {
                console.log("[BotManager] Event overlay is open for non-bot action. Aborting handleGameState.");
                return;
            }
        }

        // Bloquear si algún jugador tiene una elección de subida de nivel pendiente
        if (this.gameState.players.some(p => p.pendingLevelUpChoice)) {
            console.log("[BotManager] A player has a pending level up choice. Aborting handleGameState.");
            return;
        }

        // Optimizar equipamiento desde la mochila antes de cualquier decisión de turno
        this.optimizeEquippedItems(activePlayer);

        console.log("[BotManager] Bot's turn. currentCombat:", !!this.gameState.currentCombat);
        if (this.gameState.currentCombat) {
            console.log("[BotManager] Escenario C - Combat. Scheduling performCombatTurn.");
            // Escenario C
            if (!this.isActing) {
                this.isActing = true;
                setTimeout(() => this.performCombatTurn(activePlayer), 1000);
            }
        } else if (this.gameState.isMarketPhase) {
            // Escenario B
            if (!this.isActing) {
                this.isActing = true;
                setTimeout(() => this.performMarketTurn(activePlayer), 1500);
            }
        } else if (this.gameState.isRetaliationPhase) {
            // Escenario D
            if (!this.isActing) {
                this.isActing = true;
                setTimeout(() => this.performRetaliationTurn(), 1500);
            }
        } else if (this.gameState.pendingCorrosionChoice || this.gameState.isGlobalEventActive) {
            // Escenario E
            if (!this.isActing) {
                this.isActing = true;
                setTimeout(() => this.performEventTurn(activePlayer), 1500);
            }
        } else {
            // Escenario A
            if (this.gameState.isResolvingWaveSequentially || window.isAnimatingWave) return;
            
            if (!this.gameState.actionConsumed) {
                this.isActing = true;
                setTimeout(() => {
                    if (window.botsPaused) { this.isActing = false; return; }
                    this.performMainTurn(activePlayer);
                }, 1500);
            }
        }
    }

    // Ejecuta la acción especificada (comprar, atacar, etc.) y actualiza la UI
triggerAction(type, target = null, reason = "") {
        if (window.botsPaused) {
            this.isActing = false;
            return;
        }
        if (type === 'gold') {
            this.gameState.performActionGold();
            window.updateUI();
        } else if (type === 'gold-dmg') {
            this.gameState.performActionGoldAndDamage();
            window.updateUI();
        } else if (type === 'role') {
            this.gameState.performActionRole();
            window.updateUI();			
		} else if (type === 'uso-role') {
            //this.gameState.useRoleAbility();
            window.updateUI();
        } else if (type === 'hito') {
            this.gameState.deployHito();
            window.updateUI();
        } else if (type === 'end-turn') {
            this.gameState.nextTurn();
            window.updateUI();
            setTimeout(() => { 
                if (window.botsPaused) { this.isActing = false; return; }
                this.isActing = false; this.handleGameState(); 
            }, 500);
            return;
        } else if (type === 'buy') {
            const deckEl = document.querySelector(`#market-decks .deck[data-deck-type="${target}"]`);
            
            // Temporarily bypass synchronous updateUI during the purchase operation
            // to prevent nextTurn() from changing the active turn panel in the DOM mid-animation
            const originalUpdateUI = window.updateUI;
            window.updateUI = () => {};
            
            const result = this.gameState.buyFromMarket(target);
            
            window.updateUI = originalUpdateUI; // Restore immediately
            
            if (result && result !== "OVERWEIGHT") {
                if (deckEl) window.animateCardPurchase(deckEl);
            }
            setTimeout(() => {
                if (window.botsPaused) { this.isActing = false; return; }
                window.updateUI();
                this.isActing = false;
                this.handleGameState();
            }, 500);
            return;
        } else if (type === 'buy-potion') {
            const pIndex = this.gameState.currentPlayerIndex;
            this.animatePotionPurchase(target, pIndex);
            this.gameState.buyPotion(target);
            setTimeout(() => {
                if (window.botsPaused) { this.isActing = false; return; }
                window.updateUI();
                this.isActing = false;
                this.handleGameState();
            }, 800);
            return;
        } else if (type === 'explore-market') {
            const p = this.gameState.getCurrentPlayer();
            if (p.mo >= 1) {
                p.mo -= 1;
                const removedCard = this.gameState.market[target].shift();
                this.gameState.market[target].push(removedCard);
                let reasonText = reason ? ` <br><span style="font-size:0.9em; color:#888;"><i>(Motivo: ${reason})</i></span>` : '';
                this.gameState.addLog(`🔄 <strong>${p.name}</strong> gastó 1 mo en explorar el mercado, descartando <strong>${removedCard.name}</strong>.${reasonText}`);
            }
            setTimeout(() => {
                if (window.botsPaused) { this.isActing = false; return; }
                window.updateUI();
                this.isActing = false;
                this.handleGameState();
            }, 500);
            return;
        } else if (type === 'combat') {
            if (target && Array.isArray(target) && target.length > 0) {
                window.selectedGoblins = target;
                if (this.gameState.startCombat(target)) {
                    window.currentAssignments = {};
                    window.interceptionAssignments = {};
                    window.activeSelectedDieId = null;
                    window.activeSelectedEquipId = null;
                    if (this.gameState.currentCombat.needsCrampResolution) {
                        if (typeof window.renderCombatOverlay === 'function') window.renderCombatOverlay();
                    } else {
                        if (typeof window.triggerCombatDiceRoll === 'function') window.triggerCombatDiceRoll();
                    }
                    window.updateUI();
                }
            }
            setTimeout(() => { 
                if (window.botsPaused) { this.isActing = false; return; }
                this.isActing = false; this.handleGameState(); 
            }, 500);
            return;
        }
        
        setTimeout(() => { 
            if (window.botsPaused) { this.isActing = false; return; }
            this.isActing = false; this.handleGameState(); 
        }, 500);
    }

    // Comprueba si el bot necesita priorizar la supervivencia (curación o energía) antes de cualquier otra acción
    evaluateSurvivalOverride(bot) {
        let isCritical = bot.hp < bot.maxHp * 0.40;
        if (!isCritical) return false;

        const pIndex = this.gameState.players.indexOf(bot);
        if (pIndex === -1) return false;

        // 1. Sanador: si tiene energía, usar rol para curarse
        if (bot.role && bot.role.id === 'sanador' && bot.energy > 0) {
            let healNeeded = bot.maxHp - bot.hp;
            let energyToUse = Math.min(bot.energy, healNeeded);
            if (energyToUse > 0) {
                this.gameState.addLog(`🔷 <strong>${bot.name}</strong> está en estado crítico de PV y usa su rol de Sanador para curarse.`);
                for (let i = 0; i < energyToUse; i++) {
                    this.gameState.useRoleAbility(pIndex, 'self');
                }
                if (typeof window.updateUI === 'function') window.updateUI();
                isCritical = bot.hp < bot.maxHp * 0.40;
            }
        }

        // 2. Compra de pociones (Oleada 3 o superior)
        let hpShortfall = bot.maxHp - bot.hp;
        let availableCoins = bot.mo + (bot.role && bot.role.id === 'ladron' ? bot.energy : 0);
        let bestPotion = null;
        let bestScore = -Infinity;

        if (this.gameState.battlefield.waveLevel >= 3 && typeof DB !== 'undefined' && DB.equipment && DB.equipment.pociones) {
            const affordablePotions = DB.equipment.pociones.filter(p => availableCoins >= p.cost);
            if (affordablePotions.length > 0) {
                affordablePotions.forEach(poc => {
                    let avgHeal = this.getPotionAverageHealing(poc.id);
                    let covered = Math.min(avgHeal, hpShortfall);
                    let waste = Math.max(0, avgHeal - hpShortfall);
                    let score = covered - (waste * 0.5) - (poc.cost * 0.2);
                    if (score > bestScore) {
                        bestScore = score;
                        bestPotion = poc;
                    }
                });
            }
        }

        if (bestPotion) {
            // Si es Ladrón y necesita monedas virtuales, hacer la conversión real primero
            if (bot.role && bot.role.id === 'ladron' && bot.mo < bestPotion.cost) {
                let needed = bestPotion.cost - bot.mo;
                for (let i = 0; i < needed; i++) {
                    this.gameState.useRoleAbility(pIndex, 'self');
                }
                if (typeof window.updateUI === 'function') window.updateUI();
            }

            const message = `¡Mi vida es crítica! Compraré una ${bestPotion.name} para curarme.`;
            this.showBubble(pIndex, `${message}`, 'pot');
            this.gameState.addLog(`🤖 <strong>${bot.name}</strong> decide comprar una poción para curarse.`);

            setTimeout(() => {
                if (window.botsPaused) {
                    this.isActing = false;
                    return;
                }
                this.hideAllBubbles();
                this.triggerAction('buy-potion', bestPotion.id);
            }, 2000);

            return true; // Indicamos que se ha tomado una acción principal (asíncrona)
        }

        // 3. Combate de supervivencia: si tiene equipo de curación y hay objetivos asequibles
        if (isCritical) {
            let hasHealingEquip = bot.equipped.some(eq => eq.isActive && this.isHeal(eq));
            if (hasHealingEquip) {
                const goblinsEnMesa = this.gameState.battlefield.goblins.filter(g => !g.isDying);
                const potentialTargets = this.getSafeCombatTargets(bot, goblinsEnMesa, 'Agresivo', true);
                if (potentialTargets.length > 0) {
                    this.showBubble(pIndex, `<strong style="color: red;">[Crítico]</strong> Buscaré un combate fácil para usar mi curación.`, 'combat');
                    this.gameState.addLog(`🤖 <strong>${bot.name}</strong> está en estado crítico de PV, tiene equipo de curación y decide iniciar combate contra objetivos asequibles para curarse.`);
                    setTimeout(() => {
                        if (window.botsPaused) {
                            this.isActing = false;
                            return;
                        }
                        this.hideAllBubbles();
                        this.triggerAction('combat', potentialTargets);
                    }, 3500);
                    return true; // Consume la acción principal
                }
            }
        }

        // Si sigue crítico pero no tiene opciones, mostramos burbuja de peligro pero continuamos el turno normal
        if (isCritical) {
            this.showBubble(pIndex, `<strong style="color: red;">[Peligro]</strong> ¡Estoy al límite de vida y sin opciones de curación!`, 'combat');
            this.gameState.addLog(`⚠️ <strong>${bot.name}</strong> está en estado crítico de PV (${bot.hp}/${bot.maxHp}) pero no tiene opciones disponibles de curación.`);
        }

        return false;
    }

    getPotionAverageHealing(potionId) {
        if (potionId === 'pocion_vida_menor') return 2.5;
        if (potionId === 'pocion_vida_mediana') return 5.5;
        if (potionId === 'pocion_vida_mayor') return 9;
        if (potionId === 'pocion_vida_suprema') return 12;
        return 0;
    }

    animatePotionPurchase(potionId, playerIndex) {
        if (typeof DB === 'undefined' || !DB.equipment || !DB.equipment.pociones) return;
        const potionData = DB.equipment.pociones.find(p => p.id === potionId);
        if (!potionData) return;

        // Buscar el mazo de pociones como punto de partida
        const decks = document.querySelectorAll('.deck');
        const pDeck = Array.from(decks).find(d => d.style.backgroundImage.includes('Pociones.webp'));
        if (!pDeck) return;

        const rect = pDeck.getBoundingClientRect();

        // Crear elemento temporal con la imagen de la poción
        const tempEl = document.createElement('div');
        tempEl.style.position = 'fixed';
        tempEl.style.left = rect.left + 'px';
        tempEl.style.top = rect.top + 'px';
        tempEl.style.width = rect.width + 'px';
        tempEl.style.height = rect.height + 'px';
        tempEl.style.backgroundImage = `url('${potionData.image}')`;
        tempEl.style.backgroundSize = 'cover';
        tempEl.style.backgroundPosition = 'center';
        tempEl.style.margin = '0';
        tempEl.style.zIndex = '9999';
        tempEl.style.borderRadius = '8px';
        tempEl.style.border = '2px solid var(--gold)';
        tempEl.style.transition = 'all 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        tempEl.style.pointerEvents = 'none';
        tempEl.style.boxShadow = '0 0 30px var(--gold)';

        document.body.appendChild(tempEl);

        // Destino: panel de equipamiento del jugador correspondiente
        const panels = document.querySelectorAll('.player-panel');
        const equipmentContainer = panels[playerIndex] ? panels[playerIndex].querySelector('.player-equipment') : null;
        let targetRect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: rect.width * 0.5, height: rect.height * 0.5 };

        if (equipmentContainer) {
            const dummy = document.createElement('div');
            dummy.className = 'equipment-card';
            dummy.style.visibility = 'hidden';
            dummy.style.margin = '0';
            equipmentContainer.appendChild(dummy);
            targetRect = dummy.getBoundingClientRect();
            dummy.remove();
        }

        // Forzar reflow
        tempEl.getBoundingClientRect();

        // Mover y escalar
        tempEl.style.left = targetRect.left + 'px';
        tempEl.style.top = targetRect.top + 'px';
        const scaleX = targetRect.width / rect.width;
        const scaleY = targetRect.height / rect.height;
        tempEl.style.transform = `scale(${Math.min(scaleX, scaleY)})`;
        tempEl.style.transformOrigin = 'top left';

        setTimeout(() => {
            tempEl.remove();
        }, 600);
    }

    getPlayerPowerSlots(player) {
        // Filtra las armas activas (tanto rotas como no rotas)
        const weapons = player.equipped.filter(eq => eq.isActive && this.isWeapon(eq));
        let slots = [];
        
        weapons.forEach(w => {
            // Calcula el daño máximo que puede infligir un único dado válido (valores de 6 a 1)
            let maxDmg = 0;
            for (let val = 6; val >= 1; val--) {
                if (this.gameState.isValidDieForEquipment(val, w)) {
                    let dmg = this.getDamageForDieInEquip(val, w);
                    if (dmg > maxDmg) maxDmg = dmg;
                }
            }
            
            // Determina la cantidad máxima de usos del arma (huecos)
            const extra = ((w.isBroken && w.broken ? w.broken.extra : w.extra) || '').toLowerCase();
            const isReusable = extra.includes('reutilizable');
            const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
            
            for (let i = 0; i < maxUses; i++) {
                slots.push(maxDmg);
            }
        });
        
        // Ordena los daños de los huecos de mayor a menor
        slots.sort((a, b) => b - a);
        
        // Determina los dados disponibles reales (reducidos por estados de escozor, calambre y tembleque)
        let numDice = player.dicePool ? player.dicePool.length : 2;
        if (player.statusEffects) {
            let totalEffects = (player.statusEffects.escozor || 0) + (player.statusEffects.calambre || 0) + (player.statusEffects.tembleque || 0);
            numDice = Math.max(0, numDice - totalEffects);
        }
        
        // Devuelve solo los mejores Math.min(numDice, slots.length) huecos de daño
        const limit = Math.min(numDice, slots.length);
        return slots.slice(0, limit);
    }

    getPlayerMaxPowerPerAction(player) {
        const activeSlots = this.getPlayerPowerSlots(player);
        let maxPower = 0;
        for (let i = 0; i < activeSlots.length; i++) {
            maxPower += activeSlots[i];
        }
        return maxPower;
    }

    simulateCombatActionsGreedy(goblins, combatActionsQueue) {
        // goblins: array de objetos { level, currentHp, isBoss... }
        // combatActionsQueue: array de slots por cada acción de cada jugador. Ej: [[6, 3], [5, 4]]
        let survivingGoblins = [...goblins].map(g => ({ ...g }));

        for (let actionSlots of combatActionsQueue) {
            // Si el jugador no tiene armas o dados, no puede atacar
            if (!actionSlots || actionSlots.length === 0) continue;
            
            // actionSlots viene ordenado de mayor a menor, ej: [6, 3]
            let availableSlots = [...actionSlots];

            // Ordenar goblins vivos: mayor nivel primero, luego menor HP
            survivingGoblins.sort((a, b) => {
                if (a.level !== b.level) return b.level - a.level;
                return a.currentHp - b.currentHp;
            });

            for (let g of survivingGoblins) {
                if (availableSlots.length === 0) break; // Sin objetivos/manos
                if (g.currentHp <= 0) continue; // Ya está muerto

                // Asignar slots a este goblin hasta que muera o nos quedemos sin slots
                while (g.currentHp > 0 && availableSlots.length > 0) {
                    // Buscar el slot más pequeño que pueda matarlo para no desperdiciar los grandes
                    let slotIdx = -1;
                    for (let i = availableSlots.length - 1; i >= 0; i--) {
                        if (availableSlots[i] >= g.currentHp) {
                            slotIdx = i;
                            break;
                        }
                    }
                    
                    // Si ningún slot individual puede matarlo, usar el slot más grande para ablandarlo
                    if (slotIdx === -1) {
                        slotIdx = 0;
                    }

                    let dmg = availableSlots.splice(slotIdx, 1)[0];
                    g.currentHp -= dmg;
                }
            }
            
            // Eliminar los goblins muertos para la siguiente acción
            survivingGoblins = survivingGoblins.filter(g => g.currentHp > 0);
        }

        return survivingGoblins;
    }

    getPlayerMaxDefense(player) {
        const shields = player.equipped.filter(eq => eq.isActive && this.isShield(eq));
        let slots = [];
        
        shields.forEach(s => {
            let maxDef = 0;
            let facesAvailable = [6];
            if (player.dicePool && player.dicePool.length > 0) {
                facesAvailable = player.dicePool.map(d => d.faces || 6);
            }
            let maxDieFace = Math.max(...facesAvailable);

            let effectStr = (s.isBroken && s.broken ? s.broken.effect : s.effect) || '';
            let effectMax = 6;
            if (effectStr.toUpperCase().includes('MAX')) {
                 let match = effectStr.toUpperCase().match(/MAX\s*(\d+)/);
                 if (match) effectMax = parseInt(match[1]);
            }

            for (let val = 1; val <= maxDieFace; val++) {
                if (this.gameState.isValidDieForEquipment(val, s)) {
                    let actualVal = Math.min(val, effectMax);
                    if (effectStr.includes('+1')) actualVal += 1;
                    else if (effectStr.includes('+2')) actualVal += 2;
                    else if (effectStr.includes('-1')) actualVal -= 1;
                    
                    if (actualVal > maxDef) maxDef = actualVal;
                }
            }
            
            const extra = ((s.isBroken && s.broken ? s.broken.extra : s.extra) || '').toLowerCase();
            const isReusable = extra.includes('reutilizable');
            const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
            
            for (let i = 0; i < maxUses; i++) {
                slots.push(maxDef);
            }
        });
        
        slots.sort((a, b) => b - a);
        
        let numDice = player.dicePool ? player.dicePool.length : 2;
        if (player.statusEffects) {
            let totalEffects = (player.statusEffects.escozor || 0) + (player.statusEffects.calambre || 0) + (player.statusEffects.tembleque || 0);
            numDice = Math.max(0, numDice - totalEffects);
        }
        
        const weapons = player.equipped.filter(eq => eq.isActive && this.isWeapon(eq));
        let weaponSlotsCount = 0;
        weapons.forEach(w => {
            const extra = ((w.isBroken && w.broken ? w.broken.extra : w.extra) || '').toLowerCase();
            const isReusable = extra.includes('reutilizable');
            const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
            weaponSlotsCount += maxUses;
        });
        
        let diceForAttack = Math.min(numDice, weaponSlotsCount);
        let diceForDefense = Math.max(0, numDice - diceForAttack);
        
        let maxDefense = 0;
        const limit = Math.min(diceForDefense, slots.length);
        for (let i = 0; i < limit; i++) {
            maxDefense += slots[i];
        }
        
        return maxDefense;
    }

    getHitoSpawnedHp() {
        if (this.gameState.currentHito > 5) return 0;
        
        const sendaHitos = DB.hitos[this.gameState.activeSenda] || DB.hitos.iniciacion;
        let hito = sendaHitos[this.gameState.currentHito - 1];
        if (!hito) return 0;
        
        let totalHp = 0;
        const numPlayers = this.gameState.players.length;
        
        if (hito.isBoss) {
            totalHp += hito.bossStats.hpMultiplier * numPlayers;
        } else {
            if ((this.gameState.activeSenda === 'guerrero' || this.gameState.activeSenda === 'rey_brujo') && this.gameState.currentHito === 1) {
                totalHp += DB.goblins[1].hp;
            } else {
                for (let p = 0; p < numPlayers; p++) {
                    for (let lvl of hito.goblins) {
                        totalHp += DB.goblins[lvl].hp;
                    }
                }
            }
        }
        return totalHp;
    }

    getProjectedGoblinsAfterHito() {
        let projected = [];
        
        // 1. Goblins actuales
        this.gameState.battlefield.goblins.forEach(g => {
            if (!g.isDying) {
                projected.push({
                    level: g.level,
                    currentHp: g.currentHp
                });
            }
        });
        
        // 2. Goblins del Hito
        if (this.gameState.currentHito <= 5) {
            const sendaHitos = DB.hitos[this.gameState.activeSenda] || DB.hitos.iniciacion;
            let hito = sendaHitos[this.gameState.currentHito - 1];
            if (hito) {
                const numPlayers = this.gameState.players.length;
                if (hito.isBoss) {
                    let bossHp = hito.bossStats.hpMultiplier * numPlayers;
                    projected.push({
                        level: 5,
                        currentHp: bossHp,
                        isBoss: true
                    });
                } else {
                    if ((this.gameState.activeSenda === 'guerrero' || this.gameState.activeSenda === 'rey_brujo') && this.gameState.currentHito === 1) {
                        let totalGobs = hito.goblins.length * numPlayers;
                        for (let i = 0; i < totalGobs; i++) {
                            projected.push({
                                level: 1,
                                currentHp: DB.goblins[1].hp
                            });
                        }
                    } else {
                        for (let p = 0; p < numPlayers; p++) {
                            for (let lvl of hito.goblins) {
                                projected.push({
                                    level: lvl,
                                    currentHp: DB.goblins[lvl].hp
                                });
                            }
                        }
                    }
                }
            }
        }
        return projected;
    }

    canClearTableAfterDeployingHito() {
        if (this.gameState.currentHito === 5) {
            // Caso especial: Hito 5 (Jefe Final)
            // El objetivo del juego es eliminar al jefe. No hace falta limpiar la mesa.
            // Si el bot calcula que puede eliminar al jefe antes de que la represalia le mate,
            // puede activar el hito e ignorar a los otros goblins.
            const sendaHitos = DB.hitos[this.gameState.activeSenda] || DB.hitos.iniciacion;
            let hito = sendaHitos[4]; // Hito 5 es el índice 4
            if (hito) {
                const numPlayers = this.gameState.players.length;
                let bossHp = hito.bossStats.hpMultiplier * numPlayers;

                // Simulación de combate jugador a jugador en la wave restante
                let simulatedBossHp = bossHp;
                let simulatedPlayers = this.gameState.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    hp: p.hp,
                    maxHp: p.maxHp,
                    equipped: p.equipped.map(eq => ({ ...eq })),
                    dicePool: p.dicePool ? [...p.dicePool] : null,
                    statusEffects: p.statusEffects ? { ...p.statusEffects } : {}
                }));

                // Construir la cola de acciones de combate restantes en la ronda
                let combatActionsQueue = [];
                for (let a = this.gameState.battlefield.actionCount; a < 3; a++) {
                    for (let pIdx = 0; pIdx < numPlayers; pIdx++) {
                        if (a === this.gameState.battlefield.actionCount && pIdx < this.gameState.currentPlayerIndex) {
                            continue; // Ya actuó en esta acción
                        }
                        combatActionsQueue.push(pIdx);
                    }
                }

                // Simular las acciones de combate
                for (let pIdx of combatActionsQueue) {
                    let p = simulatedPlayers[pIdx];
                    if (p.hp <= 0) continue; // Jugador muerto no actúa

                    let maxPower = this.getPlayerMaxPowerPerAction(p);
                    simulatedBossHp -= maxPower;

                    if (simulatedBossHp <= 0) {
                        this.gameState.addLog(`DEBUG Hito 5 Simulación: ¡El Jefe puede ser eliminado! (HP del Jefe proyectada: ${simulatedBossHp})`);
                        return true; // Se puede eliminar al jefe antes de terminar la ronda/wave
                    }

                    // El jefe contraataca al jugador que le ataca
                    let tempBossObj = {
                        level: 5,
                        isBoss: true,
                        name: hito.name,
                        dice: hito.bossStats.dice,
                        attacks: hito.bossStats.attacks || DB.goblins[5].attacks
                    };
                    let bossDmgProfile = this.getGoblinDamageProfile(tempBossObj);
                    let playerMaxDefense = this.getPlayerMaxDefense(p);
                    let expectedDamageTaken = Math.max(0, bossDmgProfile.normal - playerMaxDefense) + bossDmgProfile.direct;

                    p.hp = Math.max(0, p.hp - expectedDamageTaken);
                }

                // Si no se derrotó en las acciones de combate de la wave, se evalúa si el grupo sobrevive a la represalia
                let currentGoblins = this.gameState.battlefield.goblins.filter(g => !g.isDying);
                let totalRetaliationDmg = 5 + currentGoblins.reduce((sum, g) => sum + g.level, 0); // El jefe (nivel 5) + otros goblins
                let totalPlayersHp = simulatedPlayers.reduce((sum, p) => sum + (p.hp > 0 ? p.hp : 0), 0);

                const safe = totalRetaliationDmg < totalPlayersHp;
                this.gameState.addLog(`DEBUG Hito 5 Simulación Retaliation: totalPlayersHp=${totalPlayersHp}, totalRetaliationDmg=${totalRetaliationDmg} (Safe: ${safe})`);
                return safe;
            }
        }

        // Restricción para el Hito 1: solo se despliega si la mesa tiene 1 o menos goblins vivos
        if (this.gameState.currentHito === 1) {
            const activeGoblinsCount = this.gameState.battlefield.goblins.filter(g => !g.isDying).length;
            if (activeGoblinsCount > 1) {
                return false;
            }
        }

        let projectedGoblins = this.getProjectedGoblinsAfterHito();
        
        let combatActionsQueue = [];
        let debugDetails = [];
        this.gameState.players.forEach((p, idx) => {
            if (p.hp <= 0) return; // Jugador muerto no aporta daño
            
            let powerSlots = this.getPlayerPowerSlots(p);
            let actionsRemaining = 0;
            
            if (idx === this.gameState.currentPlayerIndex) {
                // Desplegar Hito es una acción libre, por tanto no reduce sus acciones de combate restantes
                actionsRemaining = Math.max(0, 3 - this.gameState.battlefield.actionCount);
            } else if (idx < this.gameState.currentPlayerIndex) {
                actionsRemaining = Math.max(0, 2 - this.gameState.battlefield.actionCount);
            } else {
                actionsRemaining = Math.max(0, 3 - this.gameState.battlefield.actionCount);
            }
            
            for (let i = 0; i < actionsRemaining; i++) {
                combatActionsQueue.push(powerSlots);
            }
            let maxPower = powerSlots.reduce((a,b) => a+b, 0);
            debugDetails.push(`${p.name}: power=${maxPower}(${powerSlots.join(',')}), actions=${actionsRemaining}`);
        });
        
        let survivingGoblins = this.simulateCombatActionsGreedy(projectedGoblins, combatActionsQueue);
        
        let totalRetaliationDmg = survivingGoblins.reduce((sum, g) => sum + g.level, 0);
        let totalPlayersHp = this.gameState.players.reduce((sum, p) => sum + (p.hp > 0 ? p.hp : 0), 0);
        
        let safe = false;
        
        // Simular mutaciones esperadas (Cualquier par de goblins del mismo nivel muta al siguiente nivel)
        let hasDangerousMutations = false;
        let goblinCounts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};

        survivingGoblins.forEach(g => {
            goblinCounts[g.level] = (goblinCounts[g.level] || 0) + 1;
        });

        let maxPlayerLevel = Math.max(...this.gameState.players.map(p => p.level || 1));
        let dangerousLevelThreshold = maxPlayerLevel + 2; // Goblins dos niveles por encima del jugador son muy peligrosos

        // Resolver mutaciones (de nivel 1 hacia arriba)
        for (let lvl = 1; lvl <= 4; lvl++) {
            while (goblinCounts[lvl] >= 2) {
                goblinCounts[lvl] -= 2;
                goblinCounts[lvl + 1] = (goblinCounts[lvl + 1] || 0) + 1;
            }
            
            for (let checkLvl = dangerousLevelThreshold; checkLvl <= 5; checkLvl++) {
                if (goblinCounts[checkLvl] > 0) hasDangerousMutations = true;
            }
        }

        if (this.gameState.battlefield.actionCount >= 2) {
            // Regla: En la última acción, solo se despliega si limpia el 100% de la mesa
            safe = (totalRetaliationDmg === 0);
        } else {
            // Regla: En las primeras acciones, puede dejar vivos goblins asumiendo daño,
            // SIEMPRE Y CUANDO no mueran por represalia y no se generen mutaciones peligrosas (nivel 3+)
            safe = (totalRetaliationDmg < totalPlayersHp) && !hasDangerousMutations;
        }
        
        this.gameState.addLog(`DEBUG canClearTableAfterDeployingHito: totalPlayersHp=${totalPlayersHp}, projectedRetaliation=${totalRetaliationDmg} (Safe: ${safe}) [${debugDetails.join(' | ')}]`);
        
        return safe;
    }

    canClearTableWithoutCurrentAction() {
        let currentGoblins = this.gameState.battlefield.goblins.filter(g => !g.isDying).map(g => ({ ...g }));
        
        let combatActionsQueue = [];
        this.gameState.players.forEach((p, idx) => {
            if (p.hp <= 0) return;
            
            let powerSlots = this.getPlayerPowerSlots(p);
            let actionsRemaining = 0;
            
            if (idx === this.gameState.currentPlayerIndex) {
                // Si el jugador activo realiza otra acción principal (oro/rol), se reduce en 1 su capacidad de combatir
                actionsRemaining = Math.max(0, (3 - this.gameState.battlefield.actionCount) - 1);
            } else if (idx < this.gameState.currentPlayerIndex) {
                actionsRemaining = Math.max(0, 2 - this.gameState.battlefield.actionCount);
            } else {
                actionsRemaining = Math.max(0, 3 - this.gameState.battlefield.actionCount);
            }
            
            for (let i = 0; i < actionsRemaining; i++) {
                combatActionsQueue.push(powerSlots);
            }
        });
        
        let survivingGoblins = this.simulateCombatActionsGreedy(currentGoblins, combatActionsQueue);
        return survivingGoblins.length === 0;
    }

    isWellEquipped(player) {
        // Nuevos requisitos de daño potencial por nivel del bot
        const offensivePotential = this.getPlayerOffensivePotential(player);
        if (player.level === 2 && offensivePotential < 10) return false;
        if (player.level === 3 && offensivePotential < 15) return false;

        const targetLevel = Math.max(player.level, this.gameState.battlefield.waveLevel);
        const nonStarting = player.equipped.filter(eq => eq.type !== 'inicial');
        const weapons = nonStarting.filter(eq => eq.type === 'ataque').length;
        const heals = nonStarting.filter(eq => eq.type === 'curacion').length;
        const shields = nonStarting.filter(eq => eq.type === 'escudos').length;

        if (targetLevel === 2) {
            const hasWeapon = weapons >= 1;
            const hasDamageHeal = player.equipped.some(eq => eq.type !== 'inicial' && this.isHeal(eq) && this.canDealDamage(eq));
            return hasWeapon || hasDamageHeal;
        } else if (targetLevel === 3) {
            return weapons >= 1 && heals >= 1;
        } else if (targetLevel >= 4) {
            const option1 = weapons >= 2 && heals >= 1 && shields >= 1;
            const option2 = weapons >= 2 && heals >= 2;
            const option3 = weapons >= 2 && shields >= 2;
            return option1 || option2 || option3;
        }
        return true; // Nivel 1 no tiene requisitos mínimos
    }

    getMissingEquipmentType(player) {
        const offensivePotential = this.getPlayerOffensivePotential(player);
        const needsOffensive = (player.level === 2 && offensivePotential < 10) || (player.level === 3 && offensivePotential < 15);

        const isSanador = player.role && player.role.id === 'sanador';
        const isProtector = player.role && player.role.id === 'protector';

        if (needsOffensive) {
            // Si nos podemos permitir la carta de ataque, compramos la de ataque primero
            const topAtaque = this.gameState.market['ataque'] && this.gameState.market['ataque'].length > 0 ? this.gameState.market['ataque'][0] : null;
            if (topAtaque && player.mo >= topAtaque.cost) {
                return 'ataque';
            }
            
            const weaponsCount = player.equipped.filter(eq => eq.type === 'ataque' || eq.id === 'espada_inicial').length;
            const healsCount = player.equipped.filter(eq => eq.type === 'curacion').length;
            const shieldCount = player.equipped.filter(eq => eq.type === 'escudos' || eq.id === 'escudo_inicial').length;
            
            // Solo si no nos podemos permitir la de ataque, miramos si hay una híbrida de curación o escudo que sí nos podamos permitir y que no desequilibre nuestro inventario
            const topCuracion = this.gameState.market['curacion'] && this.gameState.market['curacion'].length > 0 ? this.gameState.market['curacion'][0] : null;
            const maxHeals = weaponsCount + (isSanador ? 2 : 1);
            if (topCuracion && this.canDealDamage(topCuracion) && player.mo >= topCuracion.cost && healsCount < maxHeals) {
                return 'curacion';
            }
            const topEscudos = this.gameState.market['escudos'] && this.gameState.market['escudos'].length > 0 ? this.gameState.market['escudos'][0] : null;
            const maxShields = weaponsCount + (isProtector ? 2 : 1);
            if (topEscudos && this.canDealDamage(topEscudos) && player.mo >= topEscudos.cost && shieldCount < maxShields) {
                return 'escudos';
            }
            return 'ataque';
        }

        const targetLevel = Math.max(player.level, this.gameState.battlefield.waveLevel);
        const nonStarting = player.equipped.filter(eq => eq.type !== 'inicial');
        const weapons = nonStarting.filter(eq => eq.type === 'ataque').length;
        const heals = nonStarting.filter(eq => eq.type === 'curacion').length;
        const shields = nonStarting.filter(eq => eq.type === 'escudos').length;

        if (targetLevel === 2) {
            const hasWeapon = weapons >= 1;
            const hasDamageHeal = player.equipped.some(eq => eq.type !== 'inicial' && this.isHeal(eq) && this.canDealDamage(eq));
            if (!hasWeapon && !hasDamageHeal) {
                return 'ataque'; // prioriza ataque si no tiene ninguno de los dos
            }
        } else if (targetLevel === 3) {
            if (weapons === 0) return 'ataque';
            if (heals === 0) return 'curacion';
        } else if (targetLevel >= 4) {
            if (weapons < 2) return 'ataque';
            if (heals < 1 && shields < 1) {
                return 'curacion';
            }
            if (heals >= 1 && shields === 0 && heals < 2) {
                return 'escudos';
            }
            if (shields >= 1 && heals === 0 && shields < 2) {
                return 'curacion';
            }
        }
        return null;
    }

    canDealDamage(eq) {
        if (!eq) return false;
        if (this.isWeapon(eq)) return true;
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        return effectStr.includes('daño') || extraStr.includes('daño');
    }

    getPlayerOffensivePotential(player) {
        let total = 0;
        const offensiveCards = player.equipped.filter(eq => this.canDealDamage(eq));
        offensiveCards.forEach(eq => {
            // Clonamos temporalmente para calcular el potencial óptimo (reparado)
            const tempEq = { ...eq, isBroken: false };
            let maxDmg = 0;
            for (let val = 1; val <= 6; val++) {
                if (this.gameState.isValidDieForEquipment(val, tempEq)) {
                    let d = this.getDamageForDieInEquip(val, tempEq);
                    if (d > maxDmg) maxDmg = d;
                }
            }
            const extra = (tempEq.extra || '').toLowerCase();
            const isReusable = extra.includes('reutilizable');
            const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
            total += maxDmg * maxUses;
        });
        return total;
    }


    // Calcula una puntuación de combate basada en armas, escudos, HP y recompensas esperadas
calculateCombatScore(bot, goblins) {
        if (goblins.length === 0) return 0;
        
        let score = 0;
        const weaponCount = bot.equipped.filter(eq => eq.isActive && this.isWeapon(eq)).length;
        const shieldCount = bot.equipped.filter(eq => eq.isActive && this.isShield(eq)).length;
        
        score += weaponCount * 5;
        score += shieldCount * 3;
        
        const avgHp = this.gameState.players.filter(p => p.hp > 0).reduce((acc, p) => acc + (p.hp / p.maxHp), 0) / this.gameState.players.length;
        if (avgHp < 0.5) score -= 5; 

        let totalGoblinHP = 0;
        let totalGoblinDmg = 0;
        goblins.forEach(g => {
            totalGoblinHP += g.hp;
            totalGoblinDmg += g.level;
            
            // Recompensas deseadas
            const pexToNext = typeof this.gameState.pexToNextLevel === 'function' ? this.gameState.pexToNextLevel(bot.level) : 100;
            if (bot.pex < pexToNext) {
                score += (g.pexReward || 0) * 2;
            }
            if (bot.mo < 5) {
                score += (g.goldReward || 0);
            }
        });

        if (totalGoblinDmg >= bot.hp + (shieldCount * 2)) {
            score -= 10;
        } else {
            score += 5;
        }

        const personality = this.getPersonalityForDecision(bot);
        if (personality === 'Agresivo') score += 10;
// Conservador removed
        
        return score;
    }

    // Decide la acción principal del bot (combatir, desplegar hito, comprar oro, etc.) y muestra la burbuja informativa
performMainTurn(bot) {
        if (window.botsPaused) {
            this.isActing = false;
            return;
        }
        try {
            // Fase 1: Uso del rol al inicio de turno (Ladrón consume energía para obtener monedas)
            if (bot.role && bot.role.id === 'ladron' && bot.energy > 0) {
                const pIndex = this.gameState.players.indexOf(bot);
                if (pIndex !== -1) {
                    let energyToUse = bot.energy;
                    for (let i = 0; i < energyToUse; i++) {
                        this.gameState.useRoleAbility(pIndex, 'self');
                    }
                    if (typeof window.updateUI === 'function') window.updateUI();
                }
            }

            if (this.evaluateSurvivalOverride(bot)) return;

            const goblinsEnMesa = this.gameState.battlefield.goblins.filter(g => !g.isDying);
            const hitoBtn = document.getElementById('btn-deploy-hito');
            
            let chosenAction = null;
            let decisionText = "";
            let targetForCombat = [];

            // Fase 3: Estado del Hito
            const waveLevel = this.gameState.battlefield.waveLevel;
            const hitoLevel = this.gameState.currentHito;
            const canDeployHito = hitoBtn && !hitoBtn.disabled && !this.gameState.battlefield.goblins.some(g => g.isHito);

            const canClearTable = this.canClearTableAfterDeployingHito();
            this.gameState.addLog(`DEBUG Hito: waveLevel=${waveLevel}, hitoLevel=${hitoLevel}, canDeployHito=${canDeployHito}, canClearTable=${canClearTable}`);

            if (canDeployHito && canClearTable) {
                chosenAction = 'hito';
                decisionText = `Estamos preparados para poder limpiar la mesa. ¡Desplegando hito!`;
            }

            // Fase 4: Estado del Campo de Batalla (Combate u Oro Inteligente)
            if (!chosenAction) {
                const currentPersonality = this.getPersonalityForDecision(bot);
                const potentialTargets = this.getSafeCombatTargets(bot, goblinsEnMesa, currentPersonality);
                
                // Determinar si le falta dinero para compra necesaria
                const missingType = this.getMissingEquipmentType(bot) || 'ataque';
                const marketDecks = this.gameState.market && this.gameState.market[missingType];
                const topCard = marketDecks && marketDecks.length > 0 ? marketDecks[0] : null;
                const shortfall = topCard ? topCard.cost - bot.mo : 0;

                // Solo se considera que la mesa puede ser limpiada por compañeros si estamos en la oleada 3 o posterior
                const tableCanBeClearedAnyway = waveLevel >= 3 && this.canClearTableWithoutCurrentAction();

                // Verificar si podemos eliminar a algún goblin de la mesa de un solo ataque
                let canEliminateAnyGoblin = false;
                const maxPowerAll = this.getPlayerMaxPowerPerAction(bot);
                if (potentialTargets.length > 0) {
                    canEliminateAnyGoblin = potentialTargets.some(g => g.currentHp <= maxPowerAll);
                }

                let isLastAction = this.gameState.battlefield.actionCount >= 2;
                let canEliminateAnyGoblinOnTable = goblinsEnMesa.some(g => g.currentHp <= maxPowerAll);

                if (isLastAction && !canEliminateAnyGoblinOnTable) {
                    chosenAction = 'gold';
                    decisionText = "Atacar es inútil porque se curarán al final del turno. Descanso y saco algo de oro.";
                } else if (tableCanBeClearedAnyway && !canEliminateAnyGoblin && (shortfall === 1 || shortfall === 2)) {
                    // Conseguir 1 o 2 monedas
                    let alivePlayers = this.gameState.players.filter(p => p.hp > 0).length;
                    let textPrefix = alivePlayers > 1 ? "Mis compañeros pueden limpiar la mesa." : "Tengo tiempo de limpiar la mesa luego.";
                    
                    if (shortfall === 2 && bot.hp > 1) {
                        chosenAction = 'gold-dmg';
                        decisionText = `${textPrefix} Conseguiré 2 monedas de oro para comprar ${topCard.name}.`;
                    } else {
                        chosenAction = 'gold';
                        decisionText = `${textPrefix} Conseguiré 1 moneda de oro para comprar ${topCard.name}.`;
                    }
                } else if (potentialTargets.length > 0) {
                    chosenAction = 'combat';
                    targetForCombat = potentialTargets;
                    decisionText = "¡A por ellos! No dejaré a ni uno vivo.";
                } else {
                    // Fallback si no hay objetivos seguros de combate
                    // NUNCA obtener oro ni recargar rol si hay goblins en la mesa, porque desperdicia el turno y adelanta la represalia.
                    // Forzamos combate contra el goblin más débil, asumiendo el riesgo.
                    let easiest = [...goblinsEnMesa].sort((a,b) => a.level - b.level || a.currentHp - b.currentHp)[0];
                    targetForCombat = [easiest];
                    if (easiest.partnerUid) {
                        let partner = goblinsEnMesa.find(p => p.uid === easiest.partnerUid);
                        if (partner) targetForCombat.push(partner);
                    }
                    chosenAction = 'combat';
                    decisionText = "Ahhhhhh. ¡Moriré matando!";
                }
            }

            const pIndex = this.gameState.players.indexOf(bot);
            this.showBubble(pIndex, `${decisionText}`, chosenAction);
            this.gameState.addLog(`🤖 "${decisionText}"`);

            if (chosenAction === 'combat') {
                setTimeout(() => {
                    if (window.botsPaused) {
                        this.isActing = false;
                        return;
                    }
                    this.hideAllBubbles();
                    this.triggerAction('combat', targetForCombat);
                }, 3500);
            } else {
                setTimeout(() => {
                    if (window.botsPaused) {
                        this.isActing = false;
                        return;
                    }
                    this.hideAllBubbles();
                    this.triggerAction(chosenAction);
                }, 3500);
            }
        } catch(e) {
            console.error("Error in performMainTurn", e);
            this.isActing = false;
        }
    }

    // Gestiona la fase de mercado: decide qué comprar o explorar según la personalidad del bot
performMarketTurn(bot) {
        if (window.botsPaused) {
            this.isActing = false;
            return;
        }
        try {
            let chosenAction = null;
            let chosenTarget = null;
            let actionReason = "";
            
            const isSanador = bot.role && bot.role.id === 'sanador';
            const isProtector = bot.role && bot.role.id === 'protector';
            const isGuerreroOrMago = bot.role && (bot.role.id === 'guerrero' || bot.role.id === 'mago');

            const canBuy = (type) => this.gameState.market[type] && this.gameState.market[type].length > 0 && bot.mo >= this.gameState.market[type][0].cost;
            const buyIfPossible = (type) => {
                // Contar equipamiento por categoría original más iniciales
                const weaponsCount = bot.equipped.filter(eq => eq.type === 'ataque' || eq.id === 'espada_inicial').length;
                const healsCount = bot.equipped.filter(eq => eq.type === 'curacion').length;
                const shieldCount = bot.equipped.filter(eq => eq.type === 'escudos' || eq.id === 'escudo_inicial').length;

                // Evitar desequilibrios (ej: no acaparar curaciones/escudos si no se tienen suficientes armas)
                if (type === 'ataque') {
                    const maxWeapons = 4;
                    if (weaponsCount >= maxWeapons) return false;
                }
                if (type === 'curacion') {
                    const maxHeals = weaponsCount;
                    if (healsCount >= maxHeals) return false;
                }
                if (type === 'escudos') {
                    const maxShields = weaponsCount;
                    if (shieldCount >= maxShields) return false;
                }
                if (canBuy(type)) {
                    const card = this.gameState.market[type][0];
                    const hasCard = bot.equipped.some(eq => eq.id === card.id);
                    if (!hasCard) {
                        chosenAction = 'buy';
                        chosenTarget = type;
                        return true;
                    }
                }
                return false;
            };

            let advice = "";
            let bought = false;

            const isLowHp = bot.hp <= bot.maxHp * 0.5; // Ajustado a 50%
            const isHardCombat = this.gameState.battlefield.goblins.filter(g => !g.isDying).length >= 2;
            
            // Solo considerar curación si el bot está herido (hp < maxHp), estamos en combate difícil y no tiene exceso de curaciones
            const weaponsCount = bot.equipped.filter(eq => eq.type === 'ataque' || eq.id === 'espada_inicial').length;
            const healsCount = bot.equipped.filter(eq => eq.type === 'curacion').length;
            const maxHeals = weaponsCount + (isSanador ? 2 : 1);
            let needsHealing = isHardCombat && (bot.hp < bot.maxHp * 0.85) && (healsCount < maxHeals);

            // Si el bot es de Nivel 1, nunca prioriza curación a menos que sea una emergencia crítica
            if (bot.level === 1) {
                needsHealing = false;
            }

            // Guerrero/Mago override for healing: solo priorizan curación si ya tienen un arma comprada
            if (isGuerreroOrMago && !bot.equipped.some(eq => eq.type === 'curacion' || eq.id.includes('pocion'))) {
                const hasBoughtWeapon = bot.equipped.some(eq => eq.type !== 'inicial' && eq.type === 'ataque');
                needsHealing = hasBoughtWeapon && needsHealing;
            }

            const canBuyPotion = () => {
                if (this.gameState.battlefield.waveLevel < 3) return null;
                if (typeof DB !== 'undefined' && DB.equipment && DB.equipment.pociones) {
                    const affordables = DB.equipment.pociones.filter(p => bot.mo >= p.cost);
                    if (affordables.length > 0) {
                        return affordables[affordables.length - 1]; // Retorna la poción más cara que pueda pagar
                    }
                }
                return null;
            };

            // Regla estricta de supervivencia con pociones
            let emergencyHealing = false;
            if (isLowHp) {
                let effectiveHp = bot.hp;
                if (isSanador) {
                    effectiveHp += bot.energy; // Sanador suma su energía como vida potencial
                }
                
                if (effectiveHp <= bot.maxHp * 0.5) {
                    emergencyHealing = true;
                }
            }

            if (emergencyHealing) {
                const potionToBuy = canBuyPotion();
                if (potionToBuy) {
                    chosenAction = 'buy-potion';
                    chosenTarget = potionToBuy.id;
                    bought = true;
                    advice = "¡Estoy en las últimas! Necesito curación urgente.";
                    this.gameState.addLog(`🤖 <strong>${bot.name}</strong> está en estado crítico de PV y prioriza la compra de pociones.`);
                } else {
                    // Intenta comprar equipo de curación si no hay pociones a su alcance
                    bought = buyIfPossible('curacion');
                    if (bought) {
                        advice = "Tengo que encontrar algo para sanar estas heridas.";
                    } else {
                        this.gameState.addLog(`🤖 <strong>${bot.name}</strong> necesita curación pero no puede permitírsela o ya tiene suficiente equipo curativo.`);
                    }
                }
            } else if (needsHealing) {
                bought = buyIfPossible('curacion');
                if (bought) advice = "Necesito equipo curativo para lo que se avecina.";
            }

            // Si no está en emergencia o no pudo comprar pociones, prosigue con compras de personalidad e IA de equipamiento
            if (!bought && !emergencyHealing) {
                const isWellEq = this.isWellEquipped(bot);
                
                // Si ya va bien equipado y la oleada es >= 3, ahorrar oro para pociones
                if (isWellEq && this.gameState.battlefield.waveLevel >= 3) {
                    if (bot.mo > 0) {
                        advice = "Guardaré este oro para cuando realmente nos haga falta.";
                    } else {
                        advice = "Sin oro poca cosa podré hacer.";
                    }
                    bought = true;
                    chosenAction = 'end-turn';
                }

                if (!bought) {
                    const missingType = this.getMissingEquipmentType(bot);
                    if (!isWellEq && missingType) {
                        // Si no va bien equipado, PRIORIZA el tipo de equipo que le falta
                        const topCard = this.gameState.market[missingType] && this.gameState.market[missingType].length > 0 ? this.gameState.market[missingType][0] : null;
                        if (topCard && bot.mo >= topCard.cost) {
                            bought = buyIfPossible(missingType);
                            if (bought) {
                                advice = `Necesito mejorar mi equipo para la oleada. Compraré una carta de ${missingType}.`;
                                this.gameState.addLog(`🤖 <strong>${bot.name}</strong> prioriza la compra de <strong>${topCard.name}</strong> (${missingType}) porque no va bien equipado para el nivel/oleada.`);
                            }
                        } else if (topCard) {
                            // Ahorrar para este equipo que le falta
                            advice = `Ahorraré para un equipo de ${missingType} (necesito ${topCard.cost} mo para ${topCard.name}).`;
                            bought = true; // Simula que tomamos una decisión (ahorrar) para no avanzar a otra compra
                            chosenAction = 'end-turn'; // Finalizar el turno tras decidir ahorrar
                        }
                    }
                }

                // Si ya va bien equipado o no pudo/necesitó comprar lo que le faltaba
                if (!bought) {
                    // Lógica por defecto: intentar comprar ataque, luego escudos/curacion
                    const topWeapon = this.gameState.market['ataque'] && this.gameState.market['ataque'].length > 0 ? this.gameState.market['ataque'][0] : null;
                    const hasBoughtWeapon = bot.equipped.some(eq => eq.type !== 'inicial' && eq.type === 'ataque');
                    
                    if (topWeapon && bot.mo >= topWeapon.cost) {
                        bought = buyIfPossible('ataque');
                        if (bought) advice = "¡Poder! Dame todo el poder para aplastar goblins.";
                    }
                    
                    if (!bought) {
                        if (!hasBoughtWeapon && topWeapon) {
                            advice = `Ahorraré para un arma mejor (necesito ${topWeapon.cost} mo).`;
                        } else {
                            bought = buyIfPossible('escudos') || buyIfPossible('curacion');
                            if (bought) {
                                advice = "Este equipo me ayudará a resistir.";
                            } else {
                                if (bot.mo < 3) {
									 if (bot.mo > 0) {
										advice = "Guardaré este oro para cuando realmente nos haga falta.";
									 }else{
										 advice = "Sin oro poca cosa podré hacer.";
									 }
                                } else {
                                    // Si tiene más de 6 mo y no le convence el arma actual, explora el mercado de ataque
                                    if (bot.mo > 6 && topWeapon) {
                                        chosenAction = 'explore-market';
                                        chosenTarget = 'ataque';
                                        advice = "No me gusta esta arma. Pagaré por ver la siguiente.";
                                        
                                        if (bot.equipped.some(eq => eq.id === topWeapon.id)) {
                                            actionReason = `Ya tiene una copia de ${topWeapon.name}.`;
                                        } else {
                                            actionReason = `Prefiere buscar algo más destructivo.`;
                                        }
                                        bought = true;
                                    } else {
                                        advice = "Guardaré este oro para cuando realmente nos haga falta.";
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (bought || advice) {
                if (!advice) advice = "He terminado mis compras.";
                let actionType = 'market';
                if (advice.includes("Ahorraré para un arma") || advice.includes("Guardaré este oro") || advice.includes("Sin oro poca cosa")) {
                    actionType = 'think';
                }
                this.showBubble(this.gameState.currentPlayerIndex, `${advice}`, actionType);
                this.gameState.addLog(`🤖 "${advice}"`);
            }
            
            if (!bought) {
                chosenAction = 'end-turn';
            }
            
            if (chosenAction) {
                setTimeout(() => {
                    if (window.botsPaused) {
                        this.isActing = false;
                        return;
                    }
                    this.hideAllBubbles();
                    this.triggerAction(chosenAction, chosenTarget, actionReason);
                }, 3500);
            } else {
                this.isActing = false;
            }
        } catch(e) {
            console.error("Error in performMarketTurn", e);
            this.isActing = false;
        }
    }

    // Ejecuta la lógica de asignación de dados durante el combate, incluyendo interceptaciones y decisiones agresivas
performCombatTurn(bot) {
        if (window.botsPaused) {
            this.isActing = false;
            return;
        }
        console.log("[BotManager] performCombatTurn started for bot:", bot.id);
        try {
            if (typeof window.currentAssignments === 'undefined') {
                console.error("[BotManager] currentAssignments not available globally.");
                this.isActing = false;
                return;
            }

            const pIndex = this.gameState.players.findIndex(p => p.id === bot.id);
            if (pIndex !== this.gameState.currentPlayerIndex) {
                console.log("[BotManager] performCombatTurn aborted: not bot's turn.");
                this.isActing = false;
                return;
            }

            const isCrampPhase = this.gameState.currentCombat && this.gameState.currentCombat.needsCrampResolution;

            // Fusionar dados plateados disponibles al inicio del combate del bot (solo fuera de la fase de calambres)
            if (!isCrampPhase) {
                const unassignedSilverDice = this.gameState.currentCombat.playerDice.filter(d => d.type === 'silver' && !d.assignedTo);
                if (unassignedSilverDice.length > 0) {
                    const targetDice = this.gameState.currentCombat.playerDice.filter(d => 
                        (d.type === 'red' || d.type === 'black') && 
                        !d.silverDieId && 
                        !d.assignedTo && 
                        !d.isCramped
                    );
                    
                    // Priorizar dados rojos sobre negros, y de mayor a menor valor
                    targetDice.sort((a, b) => {
                        if (a.type === 'red' && b.type !== 'red') return -1;
                        if (a.type !== 'red' && b.type === 'red') return 1;
                        return b.value - a.value;
                    });
                    
                    for (let sDie of unassignedSilverDice) {
                        if (targetDice.length > 0) {
                            let tDie = targetDice.shift();
                            sDie.assignedTo = tDie.id;
                            tDie.silverDieId = sDie.id;
                            tDie.originalValue = tDie.value;
                            tDie.value += sDie.value;
                            tDie.isSilver = true;
                            this.gameState.addLog(`🎲 <strong>${bot.name}</strong> fusionó su <strong>Dado Plateado (d3: ${sDie.value})</strong> con su dado ${tDie.type === 'red' ? 'rojo' : 'negro'} (valor: ${tDie.originalValue}). ¡Nuevo valor: <span style="color:#c0c0c0; font-weight:bold">${tDie.value}</span>!`);
                        } else {
                            sDie.assignedTo = 'discarded';
                            this.gameState.addLog(`🎲 <strong>${bot.name}</strong> no tiene dados válidos para fusionar su dado plateado y lo descarta.`);
                        }
                    }
                }
            }

            const totalActiveDice = this.gameState.currentCombat.playerDice.filter(d => isCrampPhase ? d.isCramped : !d.isCramped).length;
            // Excluir el dado plateado (silver) de la asignación directa
            const availableDice = this.gameState.currentCombat.playerDice.filter(d => 
                !d.assignedTo && 
                (isCrampPhase ? d.isCramped : !d.isCramped) && 
                d.type !== 'silver'
            );
            availableDice.sort((a, b) => {
                if (b.value !== a.value) return b.value - a.value;
                if (a.type === 'red' && b.type !== 'red') return -1;
                if (a.type !== 'red' && b.type === 'red') return 1;
                return 0;
            });
            
            console.log(`[BotManager] availableDice: ${availableDice.length}/${totalActiveDice}`);
            if (availableDice.length === 0) {
                console.log("[BotManager] No more dice to assign. Scheduling combat resolution in 5s.");
                this.isActing = true;
                
                if (window.botCombatIntervalId) {
                    clearInterval(window.botCombatIntervalId);
                }
                
                window.botCombatCountdownActive = true;
                let secondsLeft = 5;
                const isCramped = this.gameState.currentCombat && this.gameState.currentCombat.needsCrampResolution;
                const prefix = isCramped ? "Resolviendo calambres" : "Confirmando combate";
                
                const updateCountdown = () => {
                    const el = document.getElementById('bot-combat-countdown');
                    if (el) {
                        el.innerText = `${prefix} en ${secondsLeft}s...`;
                    }
                };
                updateCountdown();
                
                window.botCombatIntervalId = setInterval(() => {
                    if (window.botsPaused) {
                        clearInterval(window.botCombatIntervalId);
                        window.botCombatIntervalId = null;
                        window.botCombatCountdownActive = false;
                        this.isActing = false;
                        return;
                    }
                    secondsLeft--;
                    updateCountdown();
                    if (secondsLeft <= 0) {
                        clearInterval(window.botCombatIntervalId);
                        window.botCombatIntervalId = null;
                    }
                }, 1000);
                
                setTimeout(() => {
                    if (window.botCombatIntervalId) {
                        clearInterval(window.botCombatIntervalId);
                        window.botCombatIntervalId = null;
                    }
                    window.botCombatCountdownActive = false;
                    
                    if (window.botsPaused) {
                        this.isActing = false;
                        return;
                    }
                    const btnResolve = document.getElementById('btn-resolve-combat');
                    this.isActing = false;
                    if (btnResolve) {
                        // Temporalmente aseguramos que no esté deshabilitado ni invisible para el trigger
                        btnResolve.disabled = false;
                        btnResolve.click();
                    } else {
                        console.log("[BotManager] Cannot click resolve button. Either missing or disabled.");
                    }
                }, 5000);
                return;
            }

            // Planificación óptima de asignaciones a armas (calculada previamente para intercepciones y relanzamientos)
            const isLastAction = this.gameState.battlefield.actionCount >= 2;
            const planResult = this.evaluateOptimalCombatTurn(availableDice, this.gameState.currentCombat.goblins, bot, isLastAction);
            const plannedAssignments = planResult.assignments;
            const plannedKills = planResult.goblinsKilled;

            // Lógica de relanzamiento de dados negros (antes de asignar ningún dado, desactivado en fase de calambres)
            const dieToReroll = !isCrampPhase ? availableDice.find(d => d.type === 'black' && !d.rerolled && this.shouldRerollBlackDie(d, bot, plannedAssignments, plannedKills)) : null;
            if (dieToReroll) {
                console.log("[BotManager] Decided to reroll black die:", dieToReroll.id);
                this.isActing = true;
                
                const dieEl = document.getElementById(dieToReroll.id);
                if (dieEl) {
                    dieEl.classList.add('die-spin');
                }
                
                const originalValue = dieToReroll.value;
                this.gameState.addLog(`🎲 <strong>${bot.name}</strong> decide relanzar su dado negro (valor inicial: <strong>${originalValue}</strong>) buscando un mejor resultado para su equipo.`);
                
                // Animación y relanzamiento del dado
                setTimeout(() => {
                    if (window.botsPaused) {
                        this.isActing = false;
                        return;
                    }
                    
                    const newVal = this.gameState.rerollDie(dieToReroll.id);
                    if (newVal) {
                        this.gameState.addLog(`🎲 El relanzamiento obtuvo un valor de <strong>${newVal}</strong>.`);
                    }
                    if (newVal && dieEl) {
                        dieEl.innerText = newVal;
                    }
                    
                    setTimeout(() => {
                        if (window.botsPaused) {
                            this.isActing = false;
                            return;
                        }
                        
                        if (typeof window.renderCombatOverlay === 'function') {
                            window.renderCombatOverlay();
                        }
                        
                        // Pequeño desfase tras renderizar antes de que el bot continúe
                        setTimeout(() => {
                            if (window.botsPaused) {
                                this.isActing = false;
                                return;
                            }
                            this.isActing = false;
                            this.handleGameState();
                        }, 200);
                    }, 300);
                }, 300);
                return;
            }

            const die = availableDice[0]; // Assign one by one


            let advice = "";
            let delay = 500;

            if (availableDice.length === totalActiveDice) {
                advice = this.getCombatDialogue(availableDice, bot);
                console.log("[BotManager] Showing combat advice:", advice);
                this.showBubble(this.gameState.currentPlayerIndex, `${advice}`, 'combat');
                this.gameState.addLog(`🤖 "${advice}"`);
            }

            if (typeof window.renderCombatOverlay === 'function') {
                window.renderCombatOverlay();
            }
            
            setTimeout(() => {
                if (window.botsPaused) {
                    this.isActing = false;
                    return;
                }

                // Intento prioritario de intercepción de ataques peligrosos en cualquier dado disponible
                let intercepted = false;
                for (let d of availableDice) {
                    if (this.tryInterceptDangerousDie(d, bot, plannedAssignments, plannedKills, availableDice)) {
                        intercepted = true;
                        break;
                    }
                }

                if (intercepted) {
                    console.log("[BotManager] Die used for interception. Updating UI.");
                    if (typeof window.renderCombatOverlay === 'function') {
                        window.renderCombatOverlay();
                    }
                    this.isActing = false;
                    this.handleGameState();
                    return;
                }

                console.log("[BotManager] Assigning die:", die.id);
                
                let plan = assignments[die.id];
                if (plan) {
                    if (plan.isRole) {
                        this.assignDieToRole(die, bot, "Estrategia óptima global: maximizar puntos (energía).");
                    } else {
                        let equip = bot.equipped.find(eq => eq.id === plan.weaponId);
                        let reason = "Estrategia óptima global.";
                        if (plan.isWeapon) reason = "Estrategia óptima global: atacar goblin.";
                        else if (plan.isShield) reason = "Estrategia óptima global: bloquear daño.";
                        else if (plan.isHeal) reason = "Estrategia óptima global: curación preventiva.";
                        
                        this.assignDieToEquip(die, equip, bot, reason, plan.targetUid);
                    }
                } else {
                    die.assignedTo = 'discarded';
                    this.gameState.addLog("🎲 <strong>" + bot.name + "</strong> descarta el dado <strong>" + die.value + "</strong> al no encontrar un uso beneficioso.");
                }

                console.log("[BotManager] Die assigned. Updating UI.");
                if (typeof window.renderCombatOverlay === 'function') {
                    window.renderCombatOverlay();
                }
                
                this.isActing = false;
                this.handleGameState();
            }, delay);

        } catch(e) {
            console.error("[BotManager] Error in performCombatTurn", e);
            this.isActing = false;
        }
    }

    // Calcula el poder mínimo y máximo que puede aportar un equipamiento dado al bot
calculateEquipPower(eq, bot) {
        if (!eq) return { min: 0, max: 0 };
        let maxVal = 0;
        let minVal = 999;
        
        let facesAvailable = [6];
        if (bot && bot.dicePool && bot.dicePool.length > 0) {
            facesAvailable = bot.dicePool.map(d => d.faces || 6);
        }
        let maxDieFace = Math.max(...facesAvailable);
        
        let effectStr = (eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '';
        let effectMax = 6;
        if (effectStr.toUpperCase().includes('MAX')) {
             let match = effectStr.toUpperCase().match(/MAX\s*(\d+)/);
             if (match) effectMax = parseInt(match[1]);
        }
        
        for (let i = 1; i <= maxDieFace; i++) {
            if (this.gameState.isValidDieForEquipment(i, eq)) {
                let actualVal = Math.min(i, effectMax);
                if (effectStr.includes('+1')) actualVal += 1;
                else if (effectStr.includes('+2')) actualVal += 2;
                else if (effectStr.includes('-1')) actualVal -= 1;
                
                if (effectStr.match(/Daño\s*(\d+)(?!.*dado)/i)) {
                    let match = effectStr.match(/Daño\s*(\d+)/i);
                    if (match && !effectStr.toLowerCase().includes('dado')) actualVal = parseInt(match[1]);
                }
                if (effectStr.match(/Cura\s*(\d+)(?!.*dado)/i)) {
                    let match = effectStr.match(/Cura\s*(\d+)/i);
                    if (match && !effectStr.toLowerCase().includes('dado')) actualVal = parseInt(match[1]);
                }
                
                if (actualVal > maxVal) maxVal = actualVal;
                if (actualVal < minVal) minVal = actualVal;
            }
        }
        
        if (maxVal === 0) return { min: 0, max: 0 };
        
        const extra = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        const isReusable = extra.includes('reutilizable');
        const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
        
        let availableDice = bot && bot.dicePool ? bot.dicePool.length : 2;
        if (bot && bot.statusEffects) {
            let totalEffects = (bot.statusEffects.escozor || 0) + (bot.statusEffects.calambre || 0) + (bot.statusEffects.tembleque || 0);
            availableDice = Math.max(0, availableDice - totalEffects);
        }
        
        let usableCount = Math.min(maxUses, availableDice);
        
        return {
            min: minVal * usableCount,
            max: maxVal * usableCount
        };
    }

// Obtiene el perfil de daño del goblin (daño normal y directo)
    getGoblinDamageProfile(gob) {
         if (!gob) return { normal: 0, direct: 0 };
         
         // Fallback si no tiene propiedad de dados
         if (!gob.dice || !Array.isArray(gob.dice)) {
             return { normal: gob.level || 1, direct: 0 };
         }
         
         // Parsear el array de dados para separar cada dado y su modificador
         let diceList = [];
         for (let part of gob.dice) {
             if (typeof part !== 'string') continue;
             if (part.includes('d')) {
                 let [numStr, facesStr] = part.split('d');
                 let num = parseInt(numStr) || 1;
                 let faces = parseInt(facesStr) || 4;
                 for (let i = 0; i < num; i++) {
                     diceList.push({ faces: faces, modifier: 0 });
                 }
             } else if (part.includes('+') || part.includes('-')) {
                 let val = parseInt(part) || 0;
                 if (diceList.length > 0) {
                     diceList[diceList.length - 1].modifier += val;
                 }
             }
         }
         
         if (diceList.length === 0) {
             return { normal: gob.level || 1, direct: 0 };
         }
         
         // Obtener el objeto de ataques para este goblin
         let attacksObj = gob.attacks || (typeof DB !== 'undefined' && DB.goblins && DB.goblins[gob.level] ? DB.goblins[gob.level].attacks : null);
         
         let totalMaxNormal = 0;
         let totalMaxDirect = 0;
         
         for (let die of diceList) {
             let dieMaxNormal = 0;
             let dieMaxDirect = 0;
             
             for (let f = 1; f <= die.faces; f++) {
                 let dmg = f + die.modifier;
                 
                 let faceAttacks = (attacksObj && attacksObj[f]) ? attacksObj[f] : [];
                 let isFaceDirect = Array.isArray(faceAttacks) && faceAttacks.some(atk => {
                     let lower = atk.toLowerCase();
                     return lower.includes('daño directo') || lower.includes('dano directo') || lower.includes('direct') || lower.includes('verdadero') || lower.includes('veneno') || lower.includes('toxina');
                 });
                 
                 if (isFaceDirect) {
                     dieMaxDirect = Math.max(dieMaxDirect, dmg);
                 } else {
                     dieMaxNormal = Math.max(dieMaxNormal, dmg);
                 }
             }
             
             totalMaxNormal += dieMaxNormal;
             totalMaxDirect += dieMaxDirect;
         }
         
         return { normal: totalMaxNormal, direct: totalMaxDirect };
     }

// Determina los objetivos de combate seguros según el bot, los goblins presentes y la personalidad
    getSafeCombatTargets(bot, goblinsEnMesa, currentPersonality, isFarmingLife = false) {
        if (!goblinsEnMesa || goblinsEnMesa.length === 0) return [];
        
        const isGuerreroOrMago = bot.role && (bot.role.id === 'guerrero' || bot.role.id === 'mago');
        const isProtector = bot.role && bot.role.id === 'protector';
        const isSanador = bot.role && bot.role.id === 'sanador';
        const isLadron = bot.role && bot.role.id === 'ladron';
        
        let totalMaxDamage = 0;
        const weapons = bot.equipped.filter(eq => eq.isActive && this.isWeapon(eq));
        
        weapons.forEach(w => {
            const power = this.calculateEquipPower(w, bot);
            totalMaxDamage += power.max;
        });
        
        let totalMaxDefense = 0;
        const shields = bot.equipped.filter(eq => eq.isActive && this.isShield(eq));
        shields.forEach(s => {
            const power = this.calculateEquipPower(s, bot);
            totalMaxDefense += power.max;
        });

        let totalMaxHealing = 0;
        const heals = bot.equipped.filter(eq => eq.isActive && this.isHeal(eq));
        heals.forEach(h => {
            totalMaxHealing += this.calculateEquipHealingPower(h, bot);
        });

        // 1. Añadir todos los objetivos posibles inicialmente
        let targets = [...goblinsEnMesa];
        
        // Si hay un jefe en la mesa, nos enfocamos únicamente en él, ignorando a los otros goblins
        const boss = targets.find(g => g.isBoss);
        if (boss) {
            targets = [boss];
        } else {
            // Ordenar goblins
            targets.sort((a, b) => {
                if (isFarmingLife) {
                    // Si buscamos curarnos, queremos el objetivo MÁS DÉBIL
                    if (a.level !== b.level) return a.level - b.level; // Menor nivel primero
                    return a.currentHp - b.currentHp; // Menor vida primero
                } else {
                    // Si buscamos combate normal, priorizamos recompensas, nivel y vida
                    const aCat = this.getGoblinRewardCategory(a, bot);
                    const bCat = this.getGoblinRewardCategory(b, bot);
                    if (aCat !== bCat) return bCat - aCat;
                    
                    if (a.level !== b.level) {
                        return b.level - a.level;
                    }
                    return a.currentHp - b.currentHp;
                }
            });
        }
        
        // Limitar por la capacidad real del bot de asignar dados a armas/cartas de daño
        let numDice = bot.dicePool ? bot.dicePool.length : 2;
        if (bot.statusEffects) {
            let totalEffects = (bot.statusEffects.escozor || 0) + (bot.statusEffects.calambre || 0) + (bot.statusEffects.tembleque || 0);
            numDice = Math.max(0, numDice - totalEffects);
        }

        let totalWeaponSlots = 0;
        const activeWeapons = bot.equipped.filter(eq => eq.isActive && this.isWeapon(eq));
        activeWeapons.forEach(w => {
            const extra = ((w.isBroken && w.broken ? w.broken.extra : w.extra) || '').toLowerCase();
            const isReusable = extra.includes('reutilizable');
            const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
            totalWeaponSlots += maxUses;
        });

        const maxTargetableGoblins = Math.min(numDice, totalWeaponSlots);
        if (targets.length > maxTargetableGoblins) {
            targets = targets.slice(0, maxTargetableGoblins);
        }
        
        // Ajuste por personalidad (removido para permitir combatir con varios goblins a la vez según dados y armas disponibles)
        // targets = targets.slice(0, 1);

        // Asegurar la regla del Hito 2 del Rey Brujo: los goblins de pareja atacan juntos
        let pairEnforcedTargets = [];
        targets.forEach(g => {
            if (!pairEnforcedTargets.some(pt => pt.uid === g.uid)) {
                pairEnforcedTargets.push(g);
                if (g.partnerUid) {
                    const partner = goblinsEnMesa.find(p => p.uid === g.partnerUid);
                    if (partner && !pairEnforcedTargets.some(pt => pt.uid === partner.uid)) {
                        pairEnforcedTargets.push(partner);
                    }
                }
            }
        });
        targets = pairEnforcedTargets;

        // 2. Riesgo y Supervivencia
        let isSafe = false;
        let deficitDefense = 0;
        let evaluatedNormalDmg = 0;
        let evaluatedDirectDmg = 0;

        while (targets.length > 0 && !isSafe) {
            let dmgProfile = targets.reduce((acc, g) => {
                let p = this.getGoblinDamageProfile(g);
                return { normal: acc.normal + p.normal, direct: acc.direct + p.direct };
            }, { normal: 0, direct: 0 });
            
            evaluatedNormalDmg = dmgProfile.normal;
            evaluatedDirectDmg = dmgProfile.direct;
            
            const expectedDamageTaken = Math.max(0, evaluatedNormalDmg - totalMaxDefense) + evaluatedDirectDmg;
            const remainingHp = bot.hp - expectedDamageTaken + totalMaxHealing;
            deficitDefense = expectedDamageTaken - bot.hp + 1 - totalMaxHealing; // +1 to survive
            
            let isLastAction = this.gameState.battlefield.actionCount >= 2;
            let totalTargetsHp = targets.reduce((s, g) => s + g.currentHp, 0);
            let canKillTargets = (totalMaxDamage + (isGuerreroOrMago ? bot.energy : 0)) >= totalTargetsHp;

            if (isLastAction && !canKillTargets) {
                isSafe = false;
            } else if (remainingHp > 0) {
                isSafe = true;
            } else {
                let canSurvive = false;
                if (isProtector && bot.energy >= expectedDamageTaken) canSurvive = true;
                if (isSanador && (remainingHp + bot.energy > 0)) canSurvive = true;
                if (isLadron && this.gameState.battlefield.waveLevel >= 3 && bot.mo > 0) canSurvive = true;
                
                if (canSurvive) {
                    isSafe = true;
                } else {
                    isSafe = false;
                }
            }

            if (!isSafe) {
                const dropped = targets.pop(); // Drop 1 goblin and re-evaluate
                if (dropped && dropped.partnerUid) {
                    const partnerIdx = targets.findIndex(g => g.uid === dropped.partnerUid);
                    if (partnerIdx !== -1) {
                        targets.splice(partnerIdx, 1);
                    }
                }
            }
        }

        const finalHpSum = targets.reduce((s, g) => s + g.hp, 0);
        const finalDmgProfile = targets.reduce((acc, g) => {
            let p = this.getGoblinDamageProfile(g);
            return { normal: acc.normal + p.normal, direct: acc.direct + p.direct };
        }, { normal: 0, direct: 0 });
        const finalDmgSum = finalDmgProfile.normal + finalDmgProfile.direct;
        
        const healingMsg = totalMaxHealing > 0 ? `, Curación Máx. ${totalMaxHealing}` : '';
        let logMsg = `🤖 evalúa el combate: Poder Ofensivo Máx. (${totalMaxDamage}${isGuerreroOrMago ? ' + ' + bot.energy + ' de rol' : ''}) vs PV Enemigos (${finalHpSum}). Defensa Máx. (${totalMaxDefense}${healingMsg}) vs Daño Enemigo Estimado (${finalDmgSum}).`;
        
        if (targets.length === 0) {
            logMsg += ` <span style="color:var(--dmg-color);">Evita el combate por considerarlo suicida (Déficit de PV: ${deficitDefense}).</span>`;
        } else {
            logMsg += ` <span style="color:var(--heal-color);">Riesgo aceptable. Selecciona ${targets.length} objetivo(s).</span>`;
        }
        
        this.gameState.addLog(logMsg);
        return targets;
    }

    // Calcula la curación potencial máxima que un equipamiento activo puede proporcionar
    calculateEquipHealingPower(eq, bot) {
        if (!eq) return 0;
        
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        
        let facesAvailable = [6];
        if (bot && bot.dicePool && bot.dicePool.length > 0) {
            facesAvailable = bot.dicePool.map(d => d.faces || 6);
        }
        let maxDieFace = Math.max(...facesAvailable);
        
        let maxHeal = 0;
        
        // Simular para cada valor de dado posible en el pool de dados del bot
        for (let val = 1; val <= maxDieFace; val++) {
            if (this.gameState.isValidDieForEquipment(val, eq)) {
                let currentHeal = 0;
                
                // 1. Casos específicos por ID
                if (eq.id === 'gema_regeneracion') {
                    if (val % 2 !== 0) {
                        if (extraStr.includes('cura 2')) currentHeal = 2;
                        else if (extraStr.includes('cura 1')) currentHeal = 1;
                    }
                } else if (eq.id === 'drenar_justo') {
                    if (extraStr.includes('con un 3: cura 3') && val === 3) currentHeal = 3;
                    else if (extraStr.includes('con un 2: cura 2') && val === 2) currentHeal = 2;
                } else if (eq.id === 'corazon_elastico') {
                    if (val % 2 !== 0) currentHeal = val;
                } else {
                    // 2. Lógica genérica de curación en el efecto base
                    if (effectStr.includes('cura')) {
                        let heal = 0;
                        if (effectStr.includes('dado')) {
                            heal = val;
                        } else {
                            let match = effectStr.match(/cura\s+(\d+)/);
                            if (match) heal = parseInt(match[1]);
                        }
                        if (effectStr.includes('max')) {
                            let maxMatch = effectStr.match(/max\s+(\d+)/);
                            if (maxMatch) heal = Math.min(heal, parseInt(maxMatch[1]));
                        }
                        if (effectStr.includes('min')) {
                            let minMatch = effectStr.match(/min\s+(\d+)/);
                            if (minMatch) heal = Math.max(heal, parseInt(minMatch[1]));
                        }
                        currentHeal += heal;
                    }
                    
                    // 3. Lógica genérica de curación en el extra
                    if (extraStr.includes('cura max')) {
                        let maxMatch = extraStr.match(/cura max\s+(\d+)/);
                        if (maxMatch) currentHeal += Math.min(val, parseInt(maxMatch[1]));
                    }
                }
                
                if (currentHeal > maxHeal) {
                    maxHeal = currentHeal;
                }
            }
        }
        
        // Multiplicar por la reutilización
        const extra = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        const isReusable = extra.includes('reutilizable');
        const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
        
        let availableDice = bot && bot.dicePool ? bot.dicePool.length : 2;
        if (bot && bot.statusEffects) {
            let totalEffects = (bot.statusEffects.escozor || 0) + (bot.statusEffects.calambre || 0) + (bot.statusEffects.tembleque || 0);
            availableDice = Math.max(0, availableDice - totalEffects);
        }
        
        let usableCount = Math.min(maxUses, availableDice);
        return maxHeal * usableCount;
    }

// Verifica si el equipamiento es un arma (contiene la palabra 'daño')
    isWeapon(eq) {
        if (!eq) return false;
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        const keywords = ['daño', 'dano', 'dañ', 'dan', 'ataque', 'damage'];
        const matchesKeyword = keywords.some(k => effectStr.includes(k) || extraStr.includes(k));
        const weaponIds = ['espada_inicial', 'daga', 'afilado', 'anadir_pinchos', 'cuchillo', 'serrado', 'oxidado'];
        return matchesKeyword || weaponIds.includes(eq.id);
    }

// Verifica si el equipamiento es un escudo o armadura
    isShield(eq) {
        if (!eq) return false;
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        const keywords = ['escudo', 'armadura', 'shield', 'defense', 'doble_reforzado', 'reforzado'];
        const matchesKeyword = keywords.some(k => effectStr.includes(k) || extraStr.includes(k));
        const shieldIds = ['escudo_inicial', 'reforzado_pinchos', 'reforzado_hierro', 'rodela', 'doble_reforzado', 'reforzado_cuero', 'reforzado_placas'];
        return matchesKeyword || shieldIds.includes(eq.id);
    }

// Verifica si el equipamiento proporciona curación
    isHeal(eq) {
        if (!eq) return false;
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        const keywords = ['cura', 'heal', 'regenera'];
        const matchesKeyword = keywords.some(k => effectStr.includes(k) || extraStr.includes(k));
        const healIds = ['cristal_curacion', 'gema_regeneracion', 'corazon_elastico', 'vendaje', 'drenar', 'drenar_justo'];
        return matchesKeyword || healIds.includes(eq.id);
    }

// Calcula el daño que un dado aporta al equipamiento dado
    getDamageForDieInEquip(val, eq) {
        if (!this.gameState.isValidDieForEquipment(val, eq)) return 0;
        let effectStr = (eq.isBroken && eq.broken ? eq.broken.effect : eq.effect).toLowerCase();
        let dmg = 0;
        if (effectStr.includes('daño')) {
            if (effectStr.includes('dado')) {
                dmg = val;
                const modMatch = effectStr.match(/([+-]\s*\d+)/);
                if (modMatch) dmg += parseInt(modMatch[0].replace(/\s+/g, ''));
            } else {
                let match = effectStr.match(/daño\s+(\d+)/);
                if (match) dmg = parseInt(match[1]);
            }
            if (effectStr.includes('max')) {
                let maxMatch = effectStr.match(/max\s+(\d+)/);
                if (maxMatch) dmg = Math.min(dmg, parseInt(maxMatch[1]));
            }
            if (effectStr.includes('min')) {
                let minMatch = effectStr.match(/min\s+(\d+)/);
                if (minMatch) dmg = Math.max(dmg, parseInt(minMatch[1]));
            }
        }
        
        const extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        if (eq.id === 'afilado' || eq.id === 'anadir_pinchos') {
            dmg = val;
            if (extraStr.includes('con un 4: daño 6') && val === 4) dmg = 6;
            if (extraStr.includes('con un 5: daño 6') && val === 5) dmg = 6;
        } else if (eq.id === 'oxidado') {
            dmg = val;
            if (effectStr.includes('max 4')) dmg = Math.min(val, 4);
            if (effectStr.includes('+1')) dmg += 1;
        } else if (eq.id === 'drenar_justo') {
            dmg = effectStr.includes('daño 2') ? 2 : 1;
        } else if (eq.id === 'corazon_elastico') {
            dmg = val % 2 === 0 ? val : 0;
        } else if (eq.id === 'reforzado_pinchos') {
            if (val % 2 === 0) dmg = val;
        }
        return dmg;
    }

    // Decide si debe volver a lanzar un dado negro según su utilidad actual
    shouldRerollBlackDie(die, bot, plannedAssignments = {}, plannedKills = 0) {
        if (die.type !== 'black' || die.rerolled || die.isCramped) return false;
        
        const allGoblinsDead = plannedKills === (this.gameState.currentCombat && this.gameState.currentCombat.goblins ? this.gameState.currentCombat.goblins.length : 0);
        
        if (die.value <= 2) {
            let reasonToKeep = false;
            
            bot.equipped.forEach(eq => {
                if (!eq.isActive) return;
                
                const limit = (eq.isBroken && eq.broken ? eq.broken.limit : eq.limit) || '';
                const extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
                
                if (eq.isBroken) {
                    if (limit === 'MAX 2' && die.value <= 2) reasonToKeep = true;
                    if (limit === 'MAX 3' && die.value <= 3) reasonToKeep = true;
                    if (limit === 'PAR' && die.value === 2) reasonToKeep = true;
                    if (limit === 'IMPAR' && die.value === 1) reasonToKeep = true;
                }
                
                if (extraStr.includes(`con un ${die.value}:`)) {
                    reasonToKeep = true;
                }
                
                if (allGoblinsDead && limit.includes('MAX')) {
                    let maxVal = parseInt(limit.replace('MAX', '').trim());
                    if (!isNaN(maxVal) && maxVal <= 3 && die.value <= maxVal) {
                        reasonToKeep = true;
                    }
                }
            });
            
            return !reasonToKeep;
        }
        
        return false;
    }

    // Clasifica a los goblins en categorías de recompensa para priorizar los objetivos en combate
    getGoblinRewardCategory(g, bot) {
        if (g.isBoss) return 3;
        const hasFullReward = (g.isHito && !g.isInvocacion) || (!g.isInvocacion && g.level >= bot.level);
        if (hasFullReward) return 2;
        const hasPexOnly = g.isInvocacion && (g.isHito || g.level >= bot.level);
        if (hasPexOnly) return 1;
        return 0;
    }

// Intenta interceptar un dado peligroso de un goblin, respetando la planificación del combate
    tryInterceptDangerousDie(die, bot, plannedAssignments = {}, plannedKills = 0, availableDice = []) {
        if (!this.gameState.currentCombat || this.gameState.currentCombat.needsCrampResolution) return false;
        
        const goblins = this.gameState.currentCombat.goblins;
        if (!goblins || goblins.length === 0) return false;



        for (let gob of goblins) {
            // Bosses like "La Madre" are uninterceptable
            if (gob.isBoss && (gob.name.includes("La Madre") || this.gameState.activeSenda === "la_madre")) {
                continue;
            }

            const greenDiceResult = this.gameState.currentCombat.dice.green[gob.uid];
            if (!greenDiceResult || !greenDiceResult.details) continue;

            const goblinInterceptions = window.interceptionAssignments[gob.uid] || [];
            
            let naturalDieIdx = 0;
            for (let detail of greenDiceResult.details) {
                if (detail.type === 'die') {
                    const currentIdx = naturalDieIdx;
                    naturalDieIdx++;

                    if (detail.val !== die.value) continue;

                    const isIntercepted = goblinInterceptions.some(asg => Number(asg.goblinDieIndex) === Number(currentIdx));
                    if (isIntercepted) continue;

                    // Evaluar si el ataque tiene algún efecto especial (es decir, la lista no está vacía)
                    let gobDB = gob.attacks ? gob : (typeof DB !== 'undefined' && DB.goblins ? DB.goblins[gob.level] : null);
                    if (!gobDB || !gobDB.attacks) continue;

                    let attacks = gobDB.attacks[detail.val] || [];
                    let hasEffects = attacks.length > 0;
                    let isHighDamage = detail.val >= 3;
                    
                    if (!hasEffects && !isHighDamage) continue;

                    // Si NO tiene efectos especiales, y el dado está planificado para conseguir una kill, 
                    // preferimos hacer la kill en lugar de bloquear daño normal.
                    if (!hasEffects && plannedKills > 0 && plannedAssignments[die.id]) {
                        if (availableDice.length > 0) {
                            const remainingDice = availableDice.filter(d => d.id !== die.id);
                            const alternatePlan = this.evaluateOptimalCombatTurn(remainingDice, goblins, bot, false);
                            if (alternatePlan.goblinsKilled < plannedKills) {
                                continue; // Nos cuesta una kill, así que dejamos pasar el daño normal
                            }
                        } else {
                            continue;
                        }
                    }

                    // Realizar la intercepción
                    if (!window.interceptionAssignments[gob.uid]) window.interceptionAssignments[gob.uid] = [];
                        window.interceptionAssignments[gob.uid].push({
                            dieId: die.id,
                            value: die.value,
                            goblinDieIndex: currentIdx
                        });
                        die.assignedTo = `intercept-${gob.uid}-${currentIdx}`;
                        
                        if (bot) {
                            this.gameState.addLog(`🛡️ <strong>${bot.name}</strong> usa su dado de valor <strong>${die.value}</strong> para interceptar un ataque peligroso de <strong>${gob.isBoss ? gob.name : 'Goblin de Nivel ' + gob.level}</strong>.`);
                        }
                        return true;
                }
            }
        }
        return false;
    }

    getGoblinRemainingDamage(gob) {
        let normalDmg = 0;
        let directDmg = 0;
        let greenDiceResult = this.gameState.currentCombat.dice && this.gameState.currentCombat.dice.green ? this.gameState.currentCombat.dice.green[gob.uid] : null;
        if (greenDiceResult && greenDiceResult.details) {
            let goblinInterceptions = window.interceptionAssignments[gob.uid] || [];
            let naturalDieIdx = 0;
            for (let rawIdx = 0; rawIdx < greenDiceResult.details.length; rawIdx++) {
                let detail = greenDiceResult.details[rawIdx];
                if (detail.type === 'die') {
                    const currentIdx = naturalDieIdx++;
                    const isIntercepted = goblinInterceptions.some(asg => Number(asg.goblinDieIndex) === Number(currentIdx));
                    if (isIntercepted) continue;
                    
                    let dieDmg = detail.val;
                    let nextDetail = greenDiceResult.details[rawIdx + 1];
                    if (nextDetail && nextDetail.type === 'mod') dieDmg += nextDetail.val;
                    
                    let gobDB = gob.attacks ? gob : (typeof DB !== 'undefined' && DB.goblins ? DB.goblins[gob.level] : null);
                    let isDirect = false;
                    if (gobDB && gobDB.attacks) {
                        let attacks = gobDB.attacks[detail.val] || [];
                        isDirect = attacks.some(a => {
                            let lower = a.toLowerCase();
                            return lower.includes('daño directo') || lower.includes('dano directo') || lower.includes('direct') || lower.includes('verdadero') || lower.includes('veneno') || lower.includes('toxina');
                        });
                    }
                    if (isDirect) directDmg += dieDmg;
                    else normalDmg += dieDmg;
                }
            }
        } else {
            let profile = this.getGoblinDamageProfile(gob);
            normalDmg += profile.normal;
            directDmg += profile.direct;
        }
        return { normal: normalDmg, direct: directDmg };
    }

    evaluateOptimalCombatTurn(availableDice, goblins, bot, isLastAction) {
        if (availableDice.length === 0) return { assignments: {}, score: -Infinity, goblinsKilled: 0 };

        const weapons = bot.equipped.filter(eq => eq.isActive && (this.isWeapon(eq) || (eq.effect && eq.effect.toLowerCase().includes('daño')) || (eq.broken && eq.broken.effect && eq.broken.effect.toLowerCase().includes('daño'))));
        const shields = bot.equipped.filter(eq => eq.isActive && this.isShield(eq));
        const heals = bot.equipped.filter(eq => eq.isActive && this.isHeal(eq));
        const aliveGoblins = goblins.filter(g => g.currentHp > 0 && !g.isDying);

        let diceOptions = [];
        for (let d of availableDice) {
            let options = [];
            for (let w of weapons) {
                if (this.canAcceptDie(d, w)) {
                    for (let g of aliveGoblins) {
                        options.push({ type: 'weapon', equipId: w.id, targetUid: g.uid, equip: w });
                    }
                }
            }
            for (let s of shields) {
                if (this.canAcceptDie(d, s)) options.push({ type: 'shield', equipId: s.id, targetUid: null, equip: s });
            }
            for (let h of heals) {
                if (this.canAcceptDie(d, h)) options.push({ type: 'heal', equipId: h.id, targetUid: null, equip: h });
            }
            options.push({ type: 'role', equipId: 'role', targetUid: null });
            diceOptions.push(options);
        }

        let bestScore = -Infinity;
        let bestPermutation = null;

        const diceCount = availableDice.length;
        let optionsPerDieArray = diceOptions.map(opts => opts.length);
        let totalPermutations = optionsPerDieArray.reduce((acc, val) => acc * val, 1);
        
        if (totalPermutations > 500000) {
            console.warn("[BotManager] Demasiadas permutaciones, simplificando.");
            totalPermutations = 500000;
        }

        for (let i = 0; i < totalPermutations; i++) {
            let perm = [];
            let temp = i;
            for (let d = 0; d < diceCount; d++) {
                let opts = diceOptions[d];
                perm.push(opts[temp % opts.length]);
                temp = Math.floor(temp / opts.length);
            }

            let usageCount = {};
            let valid = true;
            for (let j = 0; j < perm.length; j++) {
                let opt = perm[j];
                if (opt.type !== 'role') {
                    usageCount[opt.equipId] = (usageCount[opt.equipId] || 0) + 1;
                    let eq = opt.equip;
                    const extra = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
                    const isReusable = extra.includes('reutilizable');
                    const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
                    
                    const currentlyAssigned = window.currentAssignments && window.currentAssignments[eq.id] ? window.currentAssignments[eq.id].length : 0;
                    if (usageCount[opt.equipId] + currentlyAssigned > maxUses) {
                        valid = false; break;
                    }
                } else {
                    usageCount['role'] = (usageCount['role'] || 0) + 1;
                    const currentlyAssigned = window.currentAssignments && window.currentAssignments['role'] ? window.currentAssignments['role'].length : 0;
                    if (usageCount['role'] + currentlyAssigned > 1) {
                        valid = false; break;
                    }
                }
            }
            if (!valid) continue;

            let simulatedHp = bot.hp;
            let simulatedEnergy = bot.energy;
            let goblinsKilled = 0;
            let damageDealt = 0;
            let damageToGoblins = {};
            aliveGoblins.forEach(g => {
                let preExistingDmg = 0;
                for (let eqId in window.currentAssignments || {}) {
                    let assignedEq = bot.equipped.find(e => e.id === eqId);
                    if (assignedEq) {
                        let asgs = window.currentAssignments[eqId];
                        const asgsArr = Array.isArray(asgs) ? asgs : [asgs];
                        asgsArr.forEach(asg => {
                            if (!asg.isRole && asg.targetUid === g.uid) {
                                preExistingDmg += this.getDamageForDieInEquip(asg.value, assignedEq);
                            }
                        });
                    }
                }
                damageToGoblins[g.uid] = preExistingDmg;
            });

            let shieldBlocked = 0;
            let healAmount = 0;

            for (let j = 0; j < perm.length; j++) {
                let opt = perm[j];
                let die = availableDice[j];
                
                if (opt.type === 'weapon') damageToGoblins[opt.targetUid] += this.getDamageForDieInEquip(die.value, opt.equip);
                else if (opt.type === 'shield') shieldBlocked += this.getShieldForDieInEquip(die.value, opt.equip);
                else if (opt.type === 'heal') healAmount += this.getHealForDieInEquip(die.value, opt.equip);
                else if (opt.type === 'role') {
                    let eGain = bot.role && bot.role.energyRates ? (bot.role.energyRates[die.value - 1] || 0) : (die.value >= 5 ? 3 : 0);
                    simulatedEnergy = Math.min(5, simulatedEnergy + eGain);
                }
            }

            let simulatedIncomingNormal = 0;
            let simulatedIncomingDirect = 0;
            aliveGoblins.forEach(g => {
                let totalDmg = damageToGoblins[g.uid];
                if (g.currentHp - totalDmg <= 0) {
                    goblinsKilled++;
                    damageDealt += g.currentHp;
                } else {
                    damageDealt += totalDmg;
                    let remain = this.getGoblinRemainingDamage(g);
                    simulatedIncomingNormal += remain.normal;
                    simulatedIncomingDirect += remain.direct;
                }
            });

            let netNormalDmg = Math.max(0, simulatedIncomingNormal - shieldBlocked);
            simulatedHp -= netNormalDmg;
            simulatedHp -= simulatedIncomingDirect;
            
            if (simulatedHp > 0) simulatedHp = Math.min(bot.maxHp, simulatedHp + healAmount);

            let score = 0;
            if (simulatedHp <= 0) score -= 1000000000;
            else score += simulatedHp * 10000;
            
            score += goblinsKilled * 1000000;
            score += simulatedEnergy * 5000;
            
            aliveGoblins.forEach(g => {
                let totalDmg = damageToGoblins[g.uid];
                if (g.currentHp - totalDmg > 0 && !isLastAction) {
                    score += totalDmg * 1000;
                }
            });

            let diceUsed = perm.length - (usageCount['role'] || 0);
            score -= diceUsed * 100;

            if (score > bestScore) {
                bestScore = score;
                let assignments = {};
                for (let j = 0; j < perm.length; j++) {
                    if (perm[j].type !== 'role') {
                        assignments[availableDice[j].id] = {
                            weaponId: perm[j].equipId,
                            targetUid: perm[j].targetUid,
                            isWeapon: perm[j].type === 'weapon',
                            isShield: perm[j].type === 'shield',
                            isHeal: perm[j].type === 'heal'
                        };
                    } else {
                        assignments[availableDice[j].id] = { isRole: true };
                    }
                }
                bestPermutation = {
                    assignments: assignments,
                    score: score,
                    goblinsKilled: goblinsKilled
                };
            }
        }

        return bestPermutation || { assignments: {}, score: -Infinity, goblinsKilled: 0 };
    }

// Verifica si el equipamiento puede aceptar el dado (límites de usos y validez)
    canAcceptDie(die, eq) {
        if (!this.gameState.isValidDieForEquipment(die.value, eq)) return false;
        const extra = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        const isReusable = extra.includes('reutilizable');
        const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
        const currentlyAssigned = window.currentAssignments && window.currentAssignments[eq.id] ? window.currentAssignments[eq.id].length : 0;
        return currentlyAssigned < maxUses;
    }

// Asigna un dado al equipamiento especificado, registrando la razón y objetivo
    assignDieToEquip(die, eq, bot, reason = "", forcedTargetUid = null) {
        if (!currentAssignments[eq.id]) currentAssignments[eq.id] = [];
        let targetUid = forcedTargetUid;
        let targetName = null;
        const goblins = this.gameState.currentCombat ? this.gameState.currentCombat.goblins : [];
        
        if (targetUid) {
            const tgtGob = goblins.find(g => g.uid === targetUid);
            if (tgtGob) targetName = tgtGob.name || `G${tgtGob.level}`;
        }
        
        let dealsDamage = this.getDamageForDieInEquip(die.value, eq) > 0;
        if (!targetUid && goblins.length > 0 && ((!this.isShield(eq) && !this.isHeal(eq)) || dealsDamage)) {
            // Lógica inteligente de selección de objetivos de combate
            let goblinDamage = {};
            goblins.forEach(g => {
                goblinDamage[g.uid] = 0;
            });
            
            for (let eqId in currentAssignments) {
                let assignedEq = bot.equipped.find(e => e.id === eqId);
                if (assignedEq) {
                    let asgs = currentAssignments[eqId];
                    const asgsArr = Array.isArray(asgs) ? asgs : [asgs];
                    asgsArr.forEach(asg => {
                        if (!asg.isRole && asg.targetUid) {
                            goblinDamage[asg.targetUid] += this.getDamageForDieInEquip(asg.value, assignedEq);
                        }
                    });
                }
            }
            
            let aliveGoblins = goblins.filter(g => {
                let remainingHp = g.currentHp - (goblinDamage[g.uid] || 0);
                return remainingHp > 0;
            });
            
            let targetGoblin = null;
            let dmg = this.getDamageForDieInEquip(die.value, eq);
            
            if (aliveGoblins.length > 0) {
                // Intentar rematar a un goblin (0 < remainingHp <= dmg)
                let killableGoblins = aliveGoblins.filter(g => {
                    let remainingHp = g.currentHp - (goblinDamage[g.uid] || 0);
                    return remainingHp <= dmg;
                });
                
                if (killableGoblins.length > 0) {
                    let sortedKillable = [...killableGoblins].sort((a, b) => {
                        const aCat = this.getGoblinRewardCategory(a, bot);
                        const bCat = this.getGoblinRewardCategory(b, bot);
                        if (aCat !== bCat) return bCat - aCat;
                        
                        if (a.level !== b.level) return b.level - a.level;
                        
                        const aRem = a.currentHp - (goblinDamage[a.uid] || 0);
                        const bRem = b.currentHp - (goblinDamage[b.uid] || 0);
                        return aRem - bRem;
                    });
                    targetGoblin = sortedKillable[0];
                } else {
                    let sortedAlive = [...aliveGoblins].sort((a, b) => {
                        const aCat = this.getGoblinRewardCategory(a, bot);
                        const bCat = this.getGoblinRewardCategory(b, bot);
                        if (aCat !== bCat) return bCat - aCat;
                        
                        if (a.level !== b.level) return b.level - a.level;
                        
                        const aRem = a.currentHp - (goblinDamage[a.uid] || 0);
                        const bRem = b.currentHp - (goblinDamage[b.uid] || 0);
                        return aRem - bRem;
                    });
                    targetGoblin = sortedAlive[0];
                }
            } else {
                let sortedGoblins = [...goblins].sort((a, b) => {
                    const aCat = this.getGoblinRewardCategory(a, bot);
                    const bCat = this.getGoblinRewardCategory(b, bot);
                    if (aCat !== bCat) return bCat - aCat;
                    
                    return b.currentHp - a.currentHp;
                });
                targetGoblin = sortedGoblins[0];
            }
            
            if (targetGoblin) {
                targetUid = targetGoblin.uid;
                targetName = targetGoblin.name || `G${targetGoblin.level}`;
            }
        }
        let calculatedElasticDamage = null;
        if (eq.id === 'corazon_elastico') {
            let val = die.value;
            let neededDmg = 0;
            if (targetUid) {
                const combatGobs = this.gameState.currentCombat ? this.gameState.currentCombat.goblins : [];
                const tgtGob = combatGobs.find(g => g.uid === targetUid);
                if (tgtGob) {
                    let currentDmg = 0;
                    for (let eqId in currentAssignments) {
                        let assignedEq = bot.equipped.find(e => e.id === eqId);
                        if (assignedEq) {
                            let asgs = currentAssignments[eqId];
                            const asgsArr = Array.isArray(asgs) ? asgs : [asgs];
                            asgsArr.forEach(asg => {
                                if (!asg.isRole && asg.targetUid === targetUid) {
                                    if (eqId === 'corazon_elastico' && asg.elasticDamage !== null && asg.elasticDamage !== undefined) {
                                        currentDmg += asg.elasticDamage;
                                    } else {
                                        currentDmg += this.getDamageForDieInEquip(asg.value, assignedEq);
                                    }
                                }
                            });
                        }
                    }
                    neededDmg = Math.max(0, tgtGob.currentHp - currentDmg);
                }
            }

            let netIncomingDmg = 0;
            if (this.gameState.currentCombat && this.gameState.currentCombat.goblins) {
                let totalIncNormal = 0;
                let totalIncDirect = 0;
                this.gameState.currentCombat.goblins.forEach(gob => {
                    let greenDiceResult = this.gameState.currentCombat.dice && this.gameState.currentCombat.dice.green ? this.gameState.currentCombat.dice.green[gob.uid] : null;
                    if (greenDiceResult && greenDiceResult.details) {
                        let goblinInterceptions = window.interceptionAssignments ? (window.interceptionAssignments[gob.uid] || []) : [];
                        let naturalDieIdx = 0;
                        for (let rawIdx = 0; rawIdx < greenDiceResult.details.length; rawIdx++) {
                            let detail = greenDiceResult.details[rawIdx];
                            if (detail.type === 'die') {
                                const currentIdx = naturalDieIdx;
                                naturalDieIdx++;
                                if (goblinInterceptions.some(asg => Number(asg.goblinDieIndex) === Number(currentIdx))) continue;
                                let dieDmg = detail.val;
                                let nextDetail = greenDiceResult.details[rawIdx + 1];
                                if (nextDetail && nextDetail.type === 'mod') dieDmg += nextDetail.val;
                                let gobDB = gob.attacks ? gob : (typeof DB !== 'undefined' && DB.goblins ? DB.goblins[gob.level] : null);
                                let isDirect = false;
                                if (gobDB && gobDB.attacks) {
                                    let attacks = gobDB.attacks[detail.val] || [];
                                    isDirect = attacks.some(a => {
                                        let lower = a.toLowerCase();
                                        return lower.includes('daño directo') || lower.includes('dano directo') || lower.includes('direct') || lower.includes('verdadero') || lower.includes('veneno') || lower.includes('toxina');
                                    });
                                }
                                if (isDirect) totalIncDirect += dieDmg;
                                else totalIncNormal += dieDmg;
                            }
                        }
                    } else {
                        let profile = this.getGoblinDamageProfile(gob);
                        totalIncNormal += profile.normal;
                        totalIncDirect += profile.direct;
                    }
                });
                
                let currentShields = 0;
                for (let eqId in currentAssignments) {
                    let assignedEq = bot.equipped.find(e => e.id === eqId);
                    if (assignedEq && this.isShield(assignedEq)) {
                        let asgsArr = Array.isArray(currentAssignments[eqId]) ? currentAssignments[eqId] : [currentAssignments[eqId]];
                        asgsArr.forEach(asg => {
                            if (!asg.isRole) currentShields += this.getShieldForDieInEquip(asg.value, assignedEq);
                        });
                    }
                }
                netIncomingDmg = Math.max(0, totalIncNormal - currentShields) + totalIncDirect;
            }

            let needsHealing = (bot.hp < bot.maxHp) || (netIncomingDmg > 0);

            if (neededDmg > 0 && neededDmg <= val) {
                calculatedElasticDamage = neededDmg;
            } else if (neededDmg > val) {
                calculatedElasticDamage = needsHealing ? 0 : val;
            } else {
                calculatedElasticDamage = needsHealing ? 0 : val;
            }
        }

        currentAssignments[eq.id].push({ 
            dieId: die.id, 
            value: die.value, 
            targetUid: targetUid, 
            elasticDamage: calculatedElasticDamage 
        });
        die.assignedTo = eq.id;
        
        if (bot) {
            let targetText = targetName ? ` contra <strong>${targetName}</strong>` : '';
            let reasonText = reason ? ` <br><span style="font-size:0.9em; color:#888;"><i>(${reason})</i></span>` : '';
            this.gameState.addLog(`🎲 <strong>${bot.name}</strong> asigna un <strong>${die.value}</strong> a <strong>${eq.name}</strong>${targetText}.${reasonText}`);
        }
    }

// Asigna un dado a la habilidad de rol del bot, con razón opcional
    assignDieToRole(die, bot, reason = "") {
        if (!currentAssignments['role']) currentAssignments['role'] = [];
        currentAssignments['role'].push({ dieId: die.id, value: die.value, isRole: true });
        die.assignedTo = 'role';
        if (bot) {
            let reasonText = reason ? ` <br><span style="font-size:0.9em; color:#888;"><i>(${reason})</i></span>` : '';
            this.gameState.addLog(`⚡ <strong>${bot.name}</strong> asigna un <strong>${die.value}</strong> a su <strong>Habilidad de Rol</strong>.${reasonText}`);
        }
    }

// Ejecuta el turno de represalia, eligiendo el jugador con mayor vida para recibir daño
    performRetaliationTurn() {
        if (window.botsPaused) {
            this.isActing = false;
            return;
        }
        if (this.gameState.isGameOver || this.gameState.isGameWon) {
            this.isActing = false;
            return;
        }
        try {
            if (this.gameState.retaliationQueue.length === 0) {
                this.isActing = false;
                return;
            }

            const goblin = this.gameState.retaliationQueue[0];
            
            let bestPlayerIndex = -1;
            let bestScore = -999;

            this.gameState.players.forEach((p, index) => {
                if (p.hp <= 0) return;
                
                // 
                // Usaremos la vida actual para ser directos.
                const score = p.hp;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestPlayerIndex = index;
                }
            });

            if (bestPlayerIndex !== -1) {
                const p = this.gameState.players[bestPlayerIndex];
                const botConf = this.activeBots.find(b => b.id === p.id);
                // Mostrar bocadillo
                if (botConf) {
                    let advice = "Aguantaré este golpe por el equipo.";
                    this.showBubble(bestPlayerIndex, `${advice}`, 'combat');
                    this.gameState.addLog(`🤖 "${advice}"`);
                }

                setTimeout(() => {
                    if (window.botsPaused) {
                        this.isActing = false;
                        return;
                    }
                    // Asignamos daño
                    this.gameState.assignRetaliationDamage(goblin.uid, bestPlayerIndex);
                    
                    if (typeof window.updateUI === 'function') {
                        window.updateUI();
                    }
                    
                    if (!this.gameState.isGameOver) {
                        if (this.gameState.isRetaliationPhase) {
                            if (typeof renderRetaliationModal === 'function') {
                                renderRetaliationModal();
                            }
                        } else {
                            const overlay = document.getElementById('global-event-overlay');
                            if (overlay) overlay.classList.add('hidden');
                            const modal = document.querySelector('.event-modal');
                            if (modal) modal.classList.remove('retaliation-theme');
                            const container = document.getElementById('event-choices-container');
                            if (container) container.classList.remove('retaliation-layout');
                        }
                        this.isActing = false;
                        this.handleGameState();
                    } else {
                        this.isActing = false;
                    }
                }, 1200);
            } else {
                this.isActing = false;
                this.handleGameState();
            }

        } catch(e) {
            console.error("Error in performRetaliationTurn", e);
            this.isActing = false;
        }
    }

// Gestiona la fase de eventos globales o decisiones de corrosión para el bot
    performEventTurn(bot) {
        if (window.botsPaused) {
            this.isActing = false;
            return;
        }
        try {
            if (this.gameState.pendingCorrosionChoice) {
                const playerToChoose = this.gameState.pendingCorrosionChoice.player;
                if (playerToChoose && playerToChoose.id === bot.id) {
                    const breakable = bot.equipped.filter(eq => eq.isActive && !eq.isBroken);
                    if (breakable.length > 0) {
                        const itemToBreak = breakable[0];
                        itemToBreak.isBroken = true;
                        itemToBreak.brokenAnimationPlayed = false;
                        this.gameState.addLog(`&#128736;&#65039; <strong>Corrosión:</strong> <strong>${bot.name}</strong> elige romper su <strong>${itemToBreak.name}</strong> por el equipo.`);
                        
                        const cb = this.gameState.pendingCorrosionChoice.callback;
                        this.gameState.pendingCorrosionChoice = null;
                        const modal = document.getElementById('corrosion-modal');
                        if (modal) modal.classList.add('hidden');
                        
                        if (cb) cb();
                        if (typeof window.updateUI === 'function') window.updateUI();
                    }
                }
            } else if (this.gameState.isGlobalEventActive) {
                const container = document.getElementById('event-choices-container');
                const overlay = document.getElementById('global-event-overlay');
                if (container && overlay && !overlay.classList.contains('hidden')) {
                    const buttons = container.querySelectorAll('button:not(:disabled)');
                    if (buttons.length > 0) {
                        if (this.gameState.getCurrentPlayer().id === bot.id) {                            
                            let choiceIndex = 0;
                            this.showBubble(this.gameState.currentPlayerIndex, `Tomaré esta decisión por nosotros.`, 'hito');
                            this.gameState.addLog(`🤖 <strong>${bot.name} (</strong> "Tomaré esta decisión por nosotros."`);
                            setTimeout(() => {
                                if (window.botsPaused) {
                                    this.isActing = false;
                                    return;
                                }
                                buttons[choiceIndex].click();
                                this.isActing = false;
                                this.handleGameState();
                            }, 3500);
                            return; // Wait for setTimeout
                        }
                    }
                }
            }

            setTimeout(() => {
                if (window.botsPaused) {
                    this.isActing = false;
                    return;
                }
                this.isActing = false;
                this.handleGameState();
            }, 1000);
            
        } catch(e) {
            console.error("Error in performEventTurn", e);
            this.isActing = false;
        }
    }

// Devuelve el color asociado al rol del jugador para los bocadillos UI
    getRoleColor(roleId) {
        const colors = {
            'guerrero': '#e63946',   // Rojo
            'mago': '#023e8a',       // Azul oscuro
            'protector': '#111111',  // Negro
            'sanador': '#ffb3c6',    // Rosado
            'ladron': '#e09f3e',     // Amarillo oscuro
            'curandero': '#00ff00'   // Verde brillante
        };
        return colors[roleId] || 'var(--gold)';
    }

    // Se llama periódicamente o en eventos clave para evaluar si los bots deben hablar
// Evalúa el estado del juego y decide si los bots deben emitir consejos o acciones
    evaluateState() {
        if (!this.gameState || this.gameState.isGameOver) return;
        
        this.activeBots = this.gameState.players.filter(p => p.isBot);
        if (this.activeBots.length === 0) return;

        // Asegurar que todos los bots tienen su ADN generado
        this.activeBots.forEach(bot => {
            if (!bot.botDNA) {
                bot.botDNA = ['Agresivo', 'Agresivo', 'Agresivo'];
            }
        });

        let anyAdvice = false;

        // Prioridad de fases compartidas:
        if (this.gameState.currentCombat) {
            this.handleCombatAdvice();
            anyAdvice = true;
        } else if (this.gameState.isMarketPhase) {
            this.handleMarketAdvice();
            anyAdvice = true;
        } else if (this.gameState.isRetaliationPhase) {
            this.handleRetaliationAdvice();
            anyAdvice = true;
        } else if (this.gameState.getCurrentPlayer() && !this.gameState.getCurrentPlayer().isBot) {
            // Turno de un jugador humano
            this.handlePlayerTurnAdvice();
            anyAdvice = true;
        }

        if (!anyAdvice && !this.isActing) {
            // Si no estamos en fase compartida y ningún bot está anunciando su acción, ocultar
            this.hideAllBubbles();
        }
    }

// Oculta todos los bocadillos de los bots en la UI
    hideAllBubbles() {
        this.activeBots.forEach(bot => {
            const pIndex = this.gameState.players.findIndex(p => p.id === bot.id);
            if (window.updateBotBubble) window.updateBotBubble(pIndex, null);
        });
    }

    // Analiza las tiradas y la situación de combate para sugerir un diálogo dinámico
    getCombatDialogue(availableDice, bot) {
        const roleId = bot.role ? bot.role.id : '';
        const goblins = this.gameState.currentCombat ? this.gameState.currentCombat.goblins : [];
        const planResult = this.evaluateOptimalCombatTurn(availableDice, goblins, bot, false);
        const plannedKills = planResult.goblinsKilled;
        
        // 1. Calambres (Cramped)
        const crampedCount = this.gameState.currentCombat.playerDice.filter(d => d.isCramped).length;
        if (crampedCount > 0) {
            if (roleId === 'guerrero') {
                return "¡Uff! Con estos calambres apenas puedo blandir mi espada...";
            } else if (roleId === 'mago') {
                return "¡Mis calambres interfieren con la concentración mágica!";
            } else if (roleId === 'protector') {
                return "¡Mis músculos se agarrotan! Sostener el escudo es un reto...";
            } else if (roleId === 'sanador') {
                return "¡Qué dolor! Con estos calambres me cuesta concentrarme para curar.";
            } else if (roleId === 'curandero') {
                return "¡Ay! ¡Menudo calambre! Mis ungüentos no alivian esto de inmediato.";
            } else if (roleId === 'ladron') {
                return "¡Maldición, mis reflejos! Estos calambres me ralentizan.";
            }
            return "¡Ay! ¡Qué calambres! Apenas puedo moverme...";
        }

        // 2. Tirada letal (mata a todos los goblins activos)
        const totalGoblins = goblins.filter(g => !g.isDying).length;
        if (plannedKills >= totalGoblins && totalGoblins > 0) {
            if (roleId === 'guerrero') {
                return "¡Excelente tirada! ¡Mi acero los cortará a todos en pedazos!";
            } else if (roleId === 'mago') {
                return "¡Carga mágica al máximo! ¡Desataré una explosión devastadora!";
            } else if (roleId === 'protector') {
                return "¡Sí! ¡Incluso mi escudo va a arrollar a todos los goblins hoy!";
            } else if (roleId === 'sanador') {
                return "¡Maravilloso! Con estos dados podemos limpiar la zona sin sufrir.";
            } else if (roleId === 'curandero') {
                return "¡La fuerza de la naturaleza los consumirá! ¡Tirada perfecta!";
            } else if (roleId === 'ladron') {
                return "¡Una oportunidad de oro! ¡Acabaré con todos y me llevaré el botín!";
            }
            return "¡Qué gran tirada! ¡No va a quedar ni un solo goblin en pie!";
        }

        // 3. Matar al menos a uno
        if (plannedKills > 0) {
            if (roleId === 'guerrero') {
                return "¡Ese goblin de ahí no pasa de este turno! ¡A por él!";
            } else if (roleId === 'mago') {
                return "¡He fijado mi objetivo! Ese goblin será desintegrado.";
            } else if (roleId === 'protector') {
                return "¡Nos quitaremos de encima a un enemigo! ¡Golpe definitivo!";
            } else if (roleId === 'sanador') {
                return "¡Reducir sus filas es prioritario! Ayudaré a abatir a ese goblin.";
            } else if (roleId === 'curandero') {
                return "¡Ese enemigo volverá a la tierra hoy! ¡Ataque enfocado!";
            } else if (roleId === 'ladron') {
                return "¡Le he visto el punto débil! ¡Ese cae seguro!";
            }
            return "¡Centraré mis ataques en eliminar a uno para reducir sus filas!";
        }

        // Calcular daño entrante normal y directo
        let incomingNormalDmg = 0;
        let incomingDirectDmg = 0;
        goblins.forEach(gob => {
            let greenDiceResult = this.gameState.currentCombat.dice && this.gameState.currentCombat.dice.green ? this.gameState.currentCombat.dice.green[gob.uid] : null;
            if (greenDiceResult && greenDiceResult.details) {
                let goblinInterceptions = window.interceptionAssignments[gob.uid] || [];
                let naturalDieIdx = 0;
                for (let rawIdx = 0; rawIdx < greenDiceResult.details.length; rawIdx++) {
                    let detail = greenDiceResult.details[rawIdx];
                    if (detail.type === 'die') {
                        const currentIdx = naturalDieIdx++;
                        const isIntercepted = goblinInterceptions.some(asg => Number(asg.goblinDieIndex) === Number(currentIdx));
                        if (isIntercepted) continue;
                        
                        let dieDmg = detail.val;
                        let nextDetail = greenDiceResult.details[rawIdx + 1];
                        if (nextDetail && nextDetail.type === 'mod') dieDmg += nextDetail.val;
                        
                        let gobDB = gob.attacks ? gob : (typeof DB !== 'undefined' && DB.goblins ? DB.goblins[gob.level] : null);
                        let isDirect = false;
                        if (gobDB && gobDB.attacks) {
                            let attacks = gobDB.attacks[detail.val] || [];
                            isDirect = attacks.some(a => {
                                let lower = a.toLowerCase();
                                return lower.includes('daño directo') || lower.includes('verdadero') || lower.includes('veneno') || lower.includes('toxina');
                            });
                        }
                        if (isDirect) incomingDirectDmg += dieDmg;
                        else incomingNormalDmg += dieDmg;
                    }
                }
            } else {
                let profile = this.getGoblinDamageProfile(gob);
                incomingNormalDmg += profile.normal;
                incomingDirectDmg += profile.direct;
            }
        });

        // 4. Decisión de Escudo / Defensa (recibe daño normal importante y tiene escudo)
        const activeShields = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isShield(eq));
        if (activeShields.length > 0 && incomingNormalDmg >= 3) {
            if (roleId === 'protector') {
                return "¡Nadie pasará! ¡Sostengo el escudo y protejo al grupo!";
            } else if (roleId === 'guerrero') {
                return "¡Menudo golpe se avecina! Me cubriré temporalmente.";
            } else if (roleId === 'mago') {
                return "¡Levantando defensas! Espero salir aireado.";
            } else if (roleId === 'sanador') {
                return "¡Demasiado daño entrante! Debo protegerme para poder curaros.";
            } else if (roleId === 'curandero') {
                return "¡El escudo me ayudará a aguantar la embestida!";
            } else if (roleId === 'ladron') {
                return "¡Uy! Ese ataque viene con fuerza. ¡A cubierto!";
            }
            return "¡El ataque enemigo es fuerte! Me cubro tras mi escudo.";
        }

        // 5. Decisión de Rol / Energía (dado alto con ganancia de energía sustancial y sin peligro inminente de muerte)
        const highestDie = availableDice[availableDice.length - 1];
        const energyGain = bot.role && bot.role.energyRates ? (bot.role.energyRates[highestDie.value - 1] || 0) : (highestDie.value >= 5 ? 3 : 0);
        if (energyGain >= 3 && bot.hp >= 4) {
            if (roleId === 'guerrero') {
                return "¡Siento la ira de batalla! Recargaré mi energía de combate.";
            } else if (roleId === 'mago') {
                return "¡El flujo de maná es óptimo! Canalizaré esta energía.";
            } else if (roleId === 'protector') {
                return "¡Fortaleceré mi devoción! Preparando mi poder divino.";
            } else if (roleId === 'sanador') {
                return "¡Acumularé gracia divina! La curación requerirá esta energía.";
            } else if (roleId === 'curandero') {
                return "¡Sintonizando! Extraeré energía necesaria.";
            } else if (roleId === 'ladron') {
                return "¡Hora de preparar algunos trucos! Esta energía me vendrá genial.";
            }
            return "¡Canalizaré mis energias! Esta energía nos vendrá de perlas.";
        }

        // 6. Mala tirada en general (todos dados bajos)
        const maxVal = highestDie ? highestDie.value : 0;
        if (maxVal <= 2) {
            if (roleId === 'mago') {
                return "¡El flujo de magia es inestable! Tendré que improvisar...";
            } else if (roleId === 'guerrero') {
                return "¡Vaya porquería de dados! ¡Lucharé con rabia pura igualmente!";
            } else if (roleId === 'ladron') {
                return "¡Vaya mala racha! Espero que no me pillen con la guardia baja...";
            }
            return "¡Vaya tirada más desastrosa! Tendré que apañármelas como pueda...";
        }

        // 7. Genérico con sabor del rol
        if (roleId === 'guerrero') {
            const list = [
                "¡Por mi honor! ¡Ningún goblin quedará impune!",
                "¡Al ataque! ¡Hagámosles morder el polvo!",
                "¡Mi espada está lista para la batalla!"
            ];
            return list[Math.floor(Math.random() * list.length)];
        } else if (roleId === 'mago') {
            const list = [
                "¡La magia elemental guiará mis golpes!",
                "Fórmula de ataque calculada. ¡Fuego!",
                "¡Sentid el poder de lo arcano!"
            ];
            return list[Math.floor(Math.random() * list.length)];
        } else if (roleId === 'protector') {
            const list = [
                "¡Yo soy el escudo de la alianza!",
                "¡Manteneos firmes! Defenderé esta posición.",
                "¡Ninguno caerá bajo mi guardia!"
            ];
            return list[Math.floor(Math.random() * list.length)];
        } else if (roleId === 'sanador') {
            const list = [
                "¡No temáis! Manteneos firmes, yo os sanaré.",
                "¡La luz nos guía en este combate!",
                "Combatid con cuidado, vigilaré vuestra salud."
            ];
            return list[Math.floor(Math.random() * list.length)];
        } else if (roleId === 'curandero') {
            const list = [
                "¡Las plantas nos brindarán su auxilio!",
                "Alineando las energías naturales para el combate.",
                "El bosque vigila y castiga a los intrusos."
            ];
            return list[Math.floor(Math.random() * list.length)];
        } else if (roleId === 'ladron') {
            const list = [
                "¡Ojo al parche! ¡A ver qué puedo sisar de aquí!",
                "Atacaré desde las sombras. ¡No se lo esperarán!",
                "¡Más oro para el saco! ¡Vamos!"
            ];
            return list[Math.floor(Math.random() * list.length)];
        }

        const fallbackGeneric = [
            "¡A por ellos! ¡No les demos ni un segundo de respiro!",
            "¡Por el equipo! ¡Asegurad vuestros objetivos!",
            "¡Vamos allá! Mantened la concentración en el combate."
        ];
        return fallbackGeneric[Math.floor(Math.random() * fallbackGeneric.length)];
    }

// Muestra un bocadillo sobre el jugador indicado con el texto especificado
    showBubble(playerIndex, text, actionType = null) {
        if (window.updateBotBubble) {
            window.updateBotBubble(playerIndex, text, actionType);
            
            const player = this.gameState.players[playerIndex];
            if (!player || !player.role) return;

            const color = this.getRoleColor(player.role.id);

            // Aplicar color personalizado al borde del bocadillo según el rol (mapa)
            const bubble = document.getElementById(`bot-bubble-${playerIndex}`);
            if (bubble) {
                bubble.style.borderColor = color;
                
                // Actualizar el color del triángulo inferior (la "flecha" del bocadillo)
                const arrow = bubble.children[1]; // El primer div absoluto que hace de borde
                if (arrow) {
                    arrow.style.borderTopColor = color;
                }
            }

            // Aplicar color personalizado al borde del bocadillo según el rol (combate)
            const combatBubble = document.getElementById(`combat-bot-bubble-${playerIndex}`);
            if (combatBubble) {
                combatBubble.style.borderColor = color;
                
                // Actualizar el color del triángulo inferior (la "flecha" del bocadillo)
                const combatArrow = combatBubble.children[1];
                if (combatArrow) {
                    combatArrow.style.borderTopColor = color;
                }
            }

            // Aplicar color personalizado al borde del bocadillo según el rol (represalia)
            const retaliationBubble = document.getElementById(`retaliation-bot-bubble-${playerIndex}`);
            if (retaliationBubble) {
                retaliationBubble.style.borderColor = color;
                
                // Actualizar el color del triángulo inferior (la "flecha" del bocadillo)
                const retaliationArrow = retaliationBubble.children[1];
                if (retaliationArrow) {
                    retaliationArrow.style.borderTopColor = color;
                }
            }
        }
    }

// Obtiene la personalidad del bot para tomar decisiones (solo 'Agresivo')
    getPersonalityForDecision(bot) {
        // All bots now use the Aggressive personality exclusively.
        return 'Agresivo';
    }

    // El bot elige de forma dinámica y matemática si prefiere un dado rojo d6 o un dado negro d4 + 1 moneda de oro
    getBotLevelUpChoice(player) {
        const dicePool = player.dicePool || [];
        const redCount = dicePool.filter(d => d.type === 'red').length;
        const blackCount = dicePool.filter(d => d.type === 'black').length;

        let redScore = 0;
        let blackScore = 0;

        // 1. Eficiencia de recarga del Rol (basado en tasas de energía reales en database.js)
        let d6EnergySum = 0;
        let d4EnergySum = 0;
        if (player.role && player.role.energyRates) {
            const rates = player.role.energyRates;
            for (let f = 1; f <= 6; f++) {
                d6EnergySum += (rates[f - 1] || 0);
            }
            for (let f = 1; f <= 4; f++) {
                d4EnergySum += (rates[f - 1] || 0);
            }
        }
        const d6ExpectedEnergy = d6EnergySum / 6.0;
        const d4ExpectedEnergy = d4EnergySum / 4.0;

        if (d6ExpectedEnergy > d4ExpectedEnergy) {
            redScore += (d6ExpectedEnergy - d4ExpectedEnergy) * 3.0;
        } else if (d4ExpectedEnergy > d6ExpectedEnergy) {
            blackScore += (d4ExpectedEnergy - d6ExpectedEnergy) * 3.0;
        }

        // 2. Escalado de equipamiento actual
        // Si el bot tiene cartas cuyo efecto o escudo depende directamente del valor del dado ("dado"),
        // prefiere d6 rojo porque alcanza valores mayores (5 y 6).
        let scalingEquipCount = 0;
        if (player.equipped) {
            player.equipped.forEach(eq => {
                if (eq.isActive && !eq.isBroken) {
                    const effectStr = (eq.effect || '').toLowerCase();
                    const extraStr = (eq.extra || '').toLowerCase();
                    if (effectStr.includes('dado') || extraStr.includes('dado')) {
                        scalingEquipCount++;
                    }
                }
            });
        }
        redScore += scalingEquipCount * 1.5;

        // 3. Equilibrio del pool de dados (mantener versatilidad y evitar desequilibrios extremos)
        if (redCount - blackCount >= 2) {
            blackScore += 2.0;
        } else if (blackCount - redCount >= 2) {
            redScore += 2.0;
        }

        // 4. Situación financiera inmediata del bot (la moneda extra es valiosa si es pobre)
        if (player.mo <= 1) {
            blackScore += 1.5;
        } else if (player.mo >= 6) {
            redScore += 1.0;
        }

        return redScore >= blackScore ? 'red' : 'black';
    }

// Devuelve el color de la burbuja según la personalidad (neutral en versión simplificada)
    getPersonalityColor(personality) {
        // Neutral bubble colour for all bots (no personality distinction).
        return '#333333'; // Dark neutral tone.
    }

    // --- HEURÍSTICAS DE FASES COMPARTIDAS ---

// (Sin uso) Maneja los consejos de mercado en la versión simplificada
    handleMarketAdvice() {
        // Market advice is not needed in the simplified Aggressive-only version.
        return;
    }
    
// (Sin uso) Maneja los consejos de represalia en la versión simplificada
    handleRetaliationAdvice() {
        // Retaliation advice is not needed in the simplified Aggressive-only version.
        return;
    }
    
// (Sin uso) Maneja los consejos de combate en la versión simplificada
    handleCombatAdvice() {
        // Combat advice is not needed in the simplified Aggressive-only version.
        return;
    }
    
// (Sin uso) Maneja los consejos para el turno del jugador humano en la versión simplificada
    handlePlayerTurnAdvice() {
        // Player‑turn advice is not needed in the simplified Aggressive‑only version.
        return;
    }

    // --- HEURÍSTICAS DE ENERGÍA Y HABILIDADES DE ROL ---

    // Retorna la curación que aporta un valor de dado asignado a una pieza de equipo
    getHealForDieInEquip(val, eq) {
        if (!this.gameState.isValidDieForEquipment(val, eq)) return 0;
        const effectStr = (eq.isBroken && eq.broken ? eq.broken.effect : eq.effect).toLowerCase();
        const extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        
        let currentHeal = 0;
        
        if (eq.id === 'gema_regeneracion') {
            if (val % 2 !== 0) {
                if (extraStr.includes('cura 2')) currentHeal = 2;
                else if (extraStr.includes('cura 1')) currentHeal = 1;
            }
        } else if (eq.id === 'drenar_justo') {
            if (extraStr.includes('con un 3: cura 3') && val === 3) currentHeal = 3;
            else if (extraStr.includes('con un 2: cura 2') && val === 2) currentHeal = 2;
        } else if (eq.id === 'corazon_elastico') {
            if (val % 2 !== 0) currentHeal = val;
        } else {
            if (effectStr.includes('cura')) {
                let heal = 0;
                if (effectStr.includes('dado')) {
                    heal = val;
                } else {
                    let match = effectStr.match(/cura\s+(\d+)/);
                    if (match) heal = parseInt(match[1]);
                }
                if (effectStr.includes('max')) {
                    let maxMatch = effectStr.match(/max\s+(\d+)/);
                    if (maxMatch) heal = Math.min(heal, parseInt(maxMatch[1]));
                }
                if (effectStr.includes('min')) {
                    let minMatch = effectStr.match(/min\s+(\d+)/);
                    if (minMatch) heal = Math.max(heal, parseInt(minMatch[1]));
                }
                currentHeal += heal;
            }
            if (extraStr.includes('cura max')) {
                let maxMatch = extraStr.match(/cura max\s+(\d+)/);
                if (maxMatch) currentHeal += Math.min(val, parseInt(maxMatch[1]));
            }
        }
        return currentHeal;
    }

    // Retorna la defensa/escudo que aporta un valor de dado asignado a una pieza de equipo
    getShieldForDieInEquip(val, eq) {
        if (!this.gameState.isValidDieForEquipment(val, eq)) return 0;
        const effectStr = (eq.isBroken && eq.broken ? eq.broken.effect : eq.effect).toLowerCase();
        
        let shield = 0;
        if (eq.id === 'reforzado_pinchos') {
            if (val % 2 !== 0) {
                shield = val;
            }
            return shield;
        }

        if (effectStr.includes('escudo')) {
            if (effectStr.includes('dado')) {
                shield = val;
                if (effectStr.includes('-1')) shield -= 1;
                if (effectStr.includes('+1')) shield += 1;
                if (effectStr.includes('x2')) shield *= 2;
            } else {
                let match = effectStr.match(/escudo\s+(\d+)/);
                if (match) shield = parseInt(match[1]);
            }
            if (effectStr.includes('max')) {
                let maxMatch = effectStr.match(/max\s+(\d+)/);
                if (maxMatch) shield = Math.min(shield, parseInt(maxMatch[1]));
            }
            if (effectStr.includes('min')) {
                let minMatch = effectStr.match(/min\s+(\d+)/);
                if (minMatch) shield = Math.max(shield, parseInt(minMatch[1]));
            }
        }
        return shield;
    }

    // Ejecuta las habilidades de rol precombate (Fase 5)
    executePreCombatRoleAbilities(bot, targetGoblins) {
        if (!bot || !bot.role) return;
        const rId = bot.role.id;
        const pIndex = this.gameState.players.indexOf(bot);
        if (pIndex === -1) return;

        if (rId === 'protector') {
            let expectedNormalDamage = 0;
            targetGoblins.forEach(g => {
                expectedNormalDamage += this.getGoblinDamageProfile(g).normal;
            });

            let numDice = bot.dicePool ? bot.dicePool.length : 2;
            if (bot.statusEffects) {
                let totalEffects = (bot.statusEffects.escozor || 0) + (bot.statusEffects.calambre || 0) + (bot.statusEffects.tembleque || 0);
                numDice = Math.max(0, numDice - totalEffects);
            }

            let weaponSlots = 0;
            const activeWeapons = bot.equipped.filter(eq => eq.isActive && this.isWeapon(eq));
            activeWeapons.forEach(w => {
                const extra = ((w.isBroken && w.broken ? w.broken.extra : w.extra) || '').toLowerCase();
                const isReusable = extra.includes('reutilizable');
                const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
                weaponSlots += maxUses;
            });

            let remainingDiceForShields = Math.max(0, numDice - weaponSlots);

            const activeShields = bot.equipped.filter(eq => eq.isActive && this.isShield(eq));
            let shieldSlots = 0;
            activeShields.forEach(s => {
                const extra = ((s.isBroken && s.broken ? s.broken.extra : s.extra) || '').toLowerCase();
                const isReusable = extra.includes('reutilizable');
                const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
                shieldSlots += maxUses;
            });

            let shieldDiceCount = Math.min(remainingDiceForShields, shieldSlots);
            let estimatedShieldDefense = 0;

            if (shieldDiceCount > 0 && activeShields.length > 0) {
                activeShields.forEach(s => {
                    let sum = 0;
                    let count = 0;
                    for (let val = 1; val <= 6; val++) {
                        if (this.gameState.isValidDieForEquipment(val, s)) {
                            sum += this.getShieldForDieInEquip(val, s);
                            count++;
                        }
                    }
                    s.avgShield = count > 0 ? (sum / count) : 0;
                });
                activeShields.sort((a, b) => b.avgShield - a.avgShield);

                let assignedDice = 0;
                for (let s of activeShields) {
                    const extra = ((s.isBroken && s.broken ? s.broken.extra : s.extra) || '').toLowerCase();
                    const isReusable = extra.includes('reutilizable');
                    const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
                    for (let u = 0; u < maxUses; u++) {
                        if (assignedDice < shieldDiceCount) {
                            estimatedShieldDefense += s.avgShield;
                            assignedDice++;
                        }
                    }
                }
            }

            let currentShield = bot.shield || 0;
            let shieldDeficit = Math.max(0, expectedNormalDamage - estimatedShieldDefense - currentShield);
            let energyToSpend = Math.min(bot.energy, Math.ceil(shieldDeficit));

            if (energyToSpend > 0) {
                this.gameState.addLog(`🤖 <strong>${bot.name}</strong> estima un daño entrante de ${expectedNormalDamage}, defensa de escudos equipados de ~${estimatedShieldDefense.toFixed(1)} (déficit: ${shieldDeficit.toFixed(1)}). Usa su rol para ganar ${energyToSpend} de Escudo.`);
                for (let i = 0; i < energyToSpend; i++) {
                    this.gameState.useRoleAbility(pIndex, 'self');
                }
            }
        } 
        else if (rId === 'mago') {
            const validTargets = targetGoblins
                .map(g => this.gameState.battlefield.goblins.find(bg => bg.uid === g.uid))
                .filter(g => g && g.currentHp > 0);

            for (let gob of validTargets) {
                if (bot.energy <= 0) break;
                let maxDmg = gob.currentHp - 1;
                let dmgToApply = Math.min(bot.energy, maxDmg);
                if (dmgToApply > 0) {
                    this.gameState.addLog(`🤖 <strong>${bot.name}</strong> usa su rol de Mago para infligir ${dmgToApply} de daño directo a ${gob.name || ('G' + gob.level)} antes del combate.`);
                    for (let i = 0; i < dmgToApply; i++) {
                        this.gameState.useRoleAbility(pIndex, gob.uid, 1, 1);
                    }
                }
            }
        }
        else if (rId === 'curandero') {
            // Criterio de prioridad: 1. Espada/Armas, 2. Curaciones, 3. Escudo/Escudos, 4. Otros
            const getPriority = (eq) => {
                const effectStr = (eq.effect || '').toLowerCase();
                const extraStr = (eq.extra || '').toLowerCase();
                const isWeapon = effectStr.includes('daño') || extraStr.includes('daño');
                const isHeal = effectStr.includes('cura') || extraStr.includes('cura');
                const isShield = effectStr.includes('escudo') || effectStr.includes('armadura');
                
                if (isWeapon) return 3;
                if (isHeal) return 2;
                if (isShield) return 1;
                return 0;
            };

            let brokenItems = bot.equipped.filter(e => e.isBroken);
            brokenItems.sort((a, b) => getPriority(b) - getPriority(a));

            for (let eq of brokenItems) {
                if (bot.energy >= 1 && eq.isBroken) {
                    const eqIndex = bot.equipped.indexOf(eq);
                    if (eqIndex !== -1) {
                        this.gameState.useRoleAbility(pIndex, 'self', eqIndex);
                    }
                }
            }
        }
        if (typeof window.updateUI === 'function') window.updateUI();
    }

    // Ejecuta las habilidades de rol de fin de turno (Fase 7)
    executeEndTurnRoleAbilities(bot) {
        if (!bot || !bot.role) return;
        const rId = bot.role.id;
        const pIndex = this.gameState.players.indexOf(bot);
        if (pIndex === -1) return;

        if (rId === 'ladron') {
            if (bot.energy > 0) {
                this.gameState.addLog(`🤖 <strong>${bot.name}</strong> usa su rol de Ladrón para convertir ${bot.energy} de energía en monedas.`);
                let energyToUse = bot.energy;
                for (let i = 0; i < energyToUse; i++) {
                    this.gameState.useRoleAbility(pIndex, 'self');
                }
            }
        }
        else if (rId === 'curandero') {
            const getPriority = (eq) => {
                const effectStr = (eq.effect || '').toLowerCase();
                const extraStr = (eq.extra || '').toLowerCase();
                const isWeapon = effectStr.includes('daño') || extraStr.includes('daño');
                const isHeal = effectStr.includes('cura') || extraStr.includes('cura');
                const isShield = effectStr.includes('escudo') || effectStr.includes('armadura');
                
                if (isWeapon) return 3;
                if (isHeal) return 2;
                if (isShield) return 1;
                return 0;
            };

            // Repararse a sí mismo primero
            let brokenSelf = bot.equipped.filter(e => e.isBroken);
            brokenSelf.sort((a, b) => getPriority(b) - getPriority(a));

            for (let eq of brokenSelf) {
                if (bot.energy >= 1 && eq.isBroken) {
                    const eqIndex = bot.equipped.indexOf(eq);
                    if (eqIndex !== -1) {
                        this.gameState.useRoleAbility(pIndex, 'self', eqIndex);
                    }
                }
            }

            // Reparar a compañeros después
            for (let otherIdx = 0; otherIdx < this.gameState.players.length; otherIdx++) {
                if (bot.energy < 2) break;
                if (otherIdx === pIndex) continue;
                let otherP = this.gameState.players[otherIdx];
                let brokenOther = otherP.equipped.filter(e => e.isBroken);
                brokenOther.sort((a, b) => getPriority(b) - getPriority(a));

                for (let eq of brokenOther) {
                    if (bot.energy >= 2 && eq.isBroken) {
                        const eqIndex = otherP.equipped.indexOf(eq);
                        if (eqIndex !== -1) {
                            this.gameState.useRoleAbility(pIndex, otherIdx, eqIndex);
                        }
                    }
                }
            }
        }
        else if (rId === 'guerrero') {
            let survivingGobs = this.gameState.battlefield.goblins.filter(g => 
                g.currentHp > 0 && 
                !g.isDying && 
                bot.goblinsFoughtThisTurn && 
                bot.goblinsFoughtThisTurn.includes(g.uid)
            );
            
            survivingGobs.sort((a, b) => a.currentHp - b.currentHp);
            
            for (let gob of survivingGobs) {
                if (bot.energy <= 0) break;
                let neededDmg = gob.currentHp;
                if (bot.energy >= neededDmg) {
                    this.gameState.addLog(`🤖 <strong>${bot.name}</strong> usa su rol de Guerrero para rematar a ${gob.name || ('G' + gob.level)} con ${neededDmg} de daño.`);
                    this.gameState.useRoleAbility(pIndex, gob.uid, neededDmg, neededDmg);
                } else {
                    // No tiene energía suficiente para matarlo, y dado que están ordenados ascendentemente, no puede matar a ninguno más.
                    break;
                }
            }
        }
        // No llamamos a updateUI() aquí si estamos dentro de la resolución de combate,
        // para evitar que se disparen las animaciones y el flujo de la IA antes de que el jugador acepte el modal.
        // nextTurn() ya llama a updateUI() al final de su ejecución de todas formas.
    }

    optimizeEquippedItems(bot) {
        if (!bot || !bot.equipped) return;

        const maxBlocks = DB.playerLevels[bot.level - 1].blocks;
        let changed = false;

        // Priorizar: 1. Armas, 2. Escudos, 3. Curación, 4. Otros, ordenados por poder potencial máximo
        const getPriority = (eq) => {
            if (this.isWeapon(eq)) return 4;
            if (this.isShield(eq)) return 3;
            if (this.isHeal(eq)) return 2;
            return 1;
        };

        // 1. DESEQUIPAR EXCESO
        let currentBlocks = bot.equipped.reduce((sum, item) => sum + (item.isActive ? (item.blocks || 0) : 0), 0);
        if (currentBlocks > maxBlocks) {
            const activeItems = bot.equipped.filter(eq => eq.isActive && eq.type !== 'inicial');
            activeItems.sort((a, b) => {
                const pA = getPriority(a);
                const pB = getPriority(b);
                if (pA !== pB) return pA - pB;
                
                const powerA = this.calculateEquipPower(a, bot).max;
                const powerB = this.calculateEquipPower(b, bot).max;
                return powerA - powerB;
            });
            
            for (let eq of activeItems) {
                if (currentBlocks <= maxBlocks) break;
                eq.isActive = false;
                currentBlocks -= (eq.blocks || 0);
                changed = true;
                this.gameState.addLog(`🎒 <strong>${bot.name}</strong> (Bot) guardó <strong>${eq.name}</strong> en su mochila por exceso de peso.`);
            }
        }

        // 2. EQUIPAR SI SOBRA ESPACIO
        const inactiveItems = bot.equipped.filter(eq => !eq.isActive);
        if (inactiveItems.length > 0) {
            inactiveItems.sort((a, b) => {
                const pA = getPriority(a);
                const pB = getPriority(b);
                if (pA !== pB) return pB - pA;
    
                const powerA = this.calculateEquipPower(a, bot).max;
                const powerB = this.calculateEquipPower(b, bot).max;
                return powerB - powerA;
            });
    
            for (let eq of inactiveItems) {
                const isDuplicateActive = bot.equipped.some(item => item.id === eq.id && item.isActive);
                if (isDuplicateActive) continue;
    
                if (currentBlocks + (eq.blocks || 0) <= maxBlocks) {
                    eq.isActive = true;
                    currentBlocks += (eq.blocks || 0);
                    this.gameState.addLog(`🎒 <strong>${bot.name}</strong> (Bot) equipó automáticamente <strong>${eq.name}</strong> de su mochila.`);
                    changed = true;
                }
            }
        }

        if (changed && typeof window.updateUI === 'function') {
            window.updateUI();
        }
    }
}

window.BotManager = BotManager;
