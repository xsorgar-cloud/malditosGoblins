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

        const activePlayer = this.gameState.getCurrentPlayer();
        if (!activePlayer || !activePlayer.isBot) {
            console.log("[BotManager] Not a bot's turn.");
            this.hideAllBubbles();
            return;
        }

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
            const types = ['ataque', 'escudos', 'curacion'];
            const deckIdx = types.indexOf(target);
            const deckEls = document.querySelectorAll('#market-decks .deck');
            
            const result = this.gameState.buyFromMarket(target);
            if (result && result !== "OVERWEIGHT") {
                if (deckEls && deckEls[deckIdx]) window.animateCardPurchase(deckEls[deckIdx]);
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
            this.showBubble(pIndex, `${message}`);
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
            let hasHealingEquip = bot.equipped.some(eq => eq.isActive && !eq.isBroken && this.isHeal(eq));
            if (hasHealingEquip) {
                const goblinsEnMesa = this.gameState.battlefield.goblins.filter(g => !g.isDying);
                const potentialTargets = this.getSafeCombatTargets(bot, goblinsEnMesa, 'Agresivo');
                if (potentialTargets.length > 0) {
                    this.showBubble(pIndex, `<strong style="color: red;">[Crítico]</strong> Buscaré un combate fácil para usar mi curación.`);
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
            this.showBubble(pIndex, `<strong style="color: red;">[Peligro]</strong> ¡Estoy al límite de vida y sin opciones de curación!`);
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

    getPlayerMaxPowerPerAction(player) {
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
        
        // Suma los mejores Math.min(numDice, slots.length) huecos de daño
        let maxPower = 0;
        const limit = Math.min(numDice, slots.length);
        for (let i = 0; i < limit; i++) {
            maxPower += slots[i];
        }
        
        return maxPower;
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
                        currentHp: bossHp
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
        let projectedGoblins = this.getProjectedGoblinsAfterHito();
        
        let totalMaxTeamDamage = 0;
        let debugDetails = [];
        this.gameState.players.forEach((p, idx) => {
            if (p.hp <= 0) return; // Jugador muerto no aporta daño
            
            let maxPower = this.getPlayerMaxPowerPerAction(p);
            let actionsRemaining = 0;
            
            if (idx === this.gameState.currentPlayerIndex) {
                // Desplegar Hito es una acción libre, por tanto no reduce sus acciones de combate restantes
                actionsRemaining = Math.max(0, 3 - this.gameState.battlefield.actionCount);
            } else if (idx < this.gameState.currentPlayerIndex) {
                actionsRemaining = Math.max(0, 2 - this.gameState.battlefield.actionCount);
            } else {
                actionsRemaining = Math.max(0, 3 - this.gameState.battlefield.actionCount);
            }
            
            totalMaxTeamDamage += maxPower * actionsRemaining;
            debugDetails.push(`${p.name}: power=${maxPower}, actions=${actionsRemaining}`);
        });
        
        // Ordenar goblins proyectados por ratio Nivel/Vida de forma descendente para minimizar la represalia
        projectedGoblins.sort((a, b) => {
            let ratioA = a.level / a.currentHp;
            let ratioB = b.level / b.currentHp;
            return ratioB - ratioA;
        });
        
        let remainingDamage = totalMaxTeamDamage;
        let survivingGoblins = [];
        projectedGoblins.forEach(g => {
            if (remainingDamage >= g.currentHp) {
                remainingDamage -= g.currentHp;
            } else {
                survivingGoblins.push(g);
                remainingDamage = 0;
            }
        });
        
        let totalRetaliationDmg = survivingGoblins.reduce((sum, g) => sum + g.level, 0);
        let totalPlayersHp = this.gameState.players.reduce((sum, p) => sum + (p.hp > 0 ? p.hp : 0), 0);
        
        const safe = totalRetaliationDmg < totalPlayersHp;
        
        this.gameState.addLog(`DEBUG canClearTableAfterDeployingHito: totalMaxTeamDamage=${totalMaxTeamDamage}, totalPlayersHp=${totalPlayersHp}, projectedRetaliation=${totalRetaliationDmg} (Safe: ${safe}) [${debugDetails.join(' | ')}]`);
        
        return safe;
    }

    canClearTableWithoutCurrentAction() {
        let currentGoblinHp = this.gameState.battlefield.goblins.filter(g => !g.isDying).reduce((sum, g) => sum + g.currentHp, 0);
        
        let totalMaxTeamDamage = 0;
        this.gameState.players.forEach((p, idx) => {
            if (p.hp <= 0) return;
            
            let maxPower = this.getPlayerMaxPowerPerAction(p);
            let actionsRemaining = 0;
            
            if (idx === this.gameState.currentPlayerIndex) {
                // Si el jugador activo realiza otra acción principal (oro/rol), se reduce en 1 su capacidad de combatir
                actionsRemaining = Math.max(0, (3 - this.gameState.battlefield.actionCount) - 1);
            } else if (idx < this.gameState.currentPlayerIndex) {
                actionsRemaining = Math.max(0, 2 - this.gameState.battlefield.actionCount);
            } else {
                actionsRemaining = Math.max(0, 3 - this.gameState.battlefield.actionCount);
            }
            
            totalMaxTeamDamage += maxPower * actionsRemaining;
        });
        
        return totalMaxTeamDamage >= currentGoblinHp;
    }

    isWellEquipped(player) {
        const nonStarting = player.equipped.filter(eq => eq.type !== 'inicial');
        const weapons = nonStarting.filter(eq => this.isWeapon(eq)).length;
        const heals = nonStarting.filter(eq => this.isHeal(eq)).length;
        const shields = nonStarting.filter(eq => this.isShield(eq)).length;

        if (player.level === 2) {
            return weapons >= 1 || heals >= 1;
        } else if (player.level === 3) {
            return weapons >= 1 && heals >= 1;
        } else if (player.level >= 4) {
            const option1 = weapons >= 2 && heals >= 1 && shields >= 1;
            const option2 = weapons >= 2 && heals >= 2;
            const option3 = weapons >= 2 && shields >= 2;
            return option1 || option2 || option3;
        }
        return true; // Nivel 1 no tiene requisitos mínimos
    }

    getMissingEquipmentType(player) {
        const nonStarting = player.equipped.filter(eq => eq.type !== 'inicial');
        const weapons = nonStarting.filter(eq => this.isWeapon(eq)).length;
        const heals = nonStarting.filter(eq => this.isHeal(eq)).length;
        const shields = nonStarting.filter(eq => this.isShield(eq)).length;

        if (player.level === 2) {
            if (weapons === 0 && heals === 0) return 'ataque'; // prioriza ataque por defecto
        } else if (player.level === 3) {
            if (weapons === 0) return 'ataque';
            if (heals === 0) return 'curacion';
        } else if (player.level >= 4) {
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


    // Calcula una puntuación de combate basada en armas, escudos, HP y recompensas esperadas
calculateCombatScore(bot, goblins) {
        if (goblins.length === 0) return 0;
        
        let score = 0;
        const weaponCount = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isWeapon(eq)).length;
        const shieldCount = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isShield(eq)).length;
        
        score += weaponCount * 5;
        score += shieldCount * 3;
        
        const avgHp = this.gameState.players.filter(p => !p.isDead).reduce((acc, p) => acc + (p.hp / p.maxHp), 0) / this.gameState.players.length;
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
                decisionText = `El nivel de la oleada (${waveLevel}) es al menos el nivel del hito (${hitoLevel}) y podemos limpiar la mesa. ¡Desplegando hito!`;
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

                const tableCanBeClearedAnyway = this.canClearTableWithoutCurrentAction();

                if (tableCanBeClearedAnyway && (shortfall === 1 || shortfall === 2)) {
                    // Conseguir 1 o 2 monedas
                    if (shortfall === 2 && bot.hp > 1) {
                        chosenAction = 'gold-dmg';
                        decisionText = `Mis compañeros pueden limpiar la mesa. Conseguiré 2 monedas de oro para comprar ${topCard.name}.`;
                    } else {
                        chosenAction = 'gold';
                        decisionText = `Mis compañeros pueden limpiar la mesa. Conseguiré 1 moneda de oro para comprar ${topCard.name}.`;
                    }
                } else if (potentialTargets.length > 0) {
                    chosenAction = 'combat';
                    targetForCombat = potentialTargets;
                    decisionText = "¡A por ellos! No dejaré a ni uno vivo.";
                } else {
                    // Fallback si no hay objetivos seguros de combate
                    if (shortfall > 0) {
                        chosenAction = 'gold';
                        decisionText = "No hay objetivos de combate seguros. Conseguiré oro para equiparme.";
                    } else {
                        chosenAction = 'role';
                        decisionText = "No hay objetivos de combate seguros. Recargaré mi habilidad de rol.";
                    }
                }
            }

            const pIndex = this.gameState.players.indexOf(bot);
            this.showBubble(pIndex, `${decisionText}`);
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
                // Role-based restrictions
                if (type === 'curacion' && isSanador) {
                    const hasHealingEquip = bot.equipped.some(eq => eq.type === 'curacion' || eq.id.includes('pocion'));
                    const isCritical = bot.hp <= bot.maxHp * 0.2;
                    const canHealWithRole = bot.energy > 0;
                    
                    if (!isCritical || (canHealWithRole && hasHealingEquip)) {
                        return false;
                    }
                }
                if (type === 'escudos' && isProtector && bot.equipped.some(eq => eq.id && (eq.id.includes('escudo') || eq.id.includes('armadura')))) return false;

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
            let needsHealing = isHardCombat;

            // Guerrero/Mago override for healing
            if (isGuerreroOrMago && !bot.equipped.some(eq => eq.type === 'curacion' || eq.id.includes('pocion'))) {
                const hasBoughtWeapon = bot.equipped.some(eq => eq.type !== 'inicial' && this.isWeapon(eq));
                if (hasBoughtWeapon) {
                    needsHealing = true;
                }
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
                        this.gameState.addLog(`🤖 <strong>${bot.name}</strong> necesita curación pero no puede permitírsela.`);
                    }
                }
            } else if (needsHealing) {
                bought = buyIfPossible('curacion');
                if (bought) advice = "Necesito equipo curativo para lo que se avecina.";
            }

            // Si no está en emergencia o no pudo comprar pociones, prosigue con compras de personalidad
            if (!bought && !emergencyHealing) {
				// 1. Intentar comprar un arma
				const topWeapon = this.gameState.market['ataque'] && this.gameState.market['ataque'].length > 0 ? this.gameState.market['ataque'][0] : null;
				const hasBoughtWeapon = bot.equipped.some(eq => eq.type !== 'inicial' && this.isWeapon(eq));
				
				if (topWeapon && bot.mo >= topWeapon.cost) {
					bought = buyIfPossible('ataque');
					if (bought) advice = "¡Poder! Dame todo el poder para aplastar goblins.";
				}
				
				// 2. Si no ha comprado arma
				if (!bought) {
					if (!hasBoughtWeapon && topWeapon) {
						// Si no tiene ningún arma comprada, ahorra para ella
						advice = `Ahorraré para un arma mejor (necesito ${topWeapon.cost} mo).`;
					} else {
						// Si ya tiene arma comprada (o no hay armas en el mazo), puede comprar escudos o curación
						bought = buyIfPossible('escudos') || buyIfPossible('curacion');
						if (bought) {
							advice = "Este equipo me ayudará a resistir.";
						} else {
							if (bot.mo < 3) {
								advice = "Guardaré este oro para cuando realmente nos haga falta.";
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

            if (bought || advice) {
                if (!advice) advice = "He terminado mis compras.";
                this.showBubble(this.gameState.currentPlayerIndex, `${advice}`);
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

            // Fusionar dados plateados disponibles al inicio del combate del bot
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

            const totalNonCramped = this.gameState.currentCombat.playerDice.filter(d => !d.isCramped).length;
            // Excluir el dado plateado (silver) de la asignación directa
            const availableDice = this.gameState.currentCombat.playerDice.filter(d => !d.assignedTo && !d.isCramped && d.type !== 'silver');
            availableDice.sort((a, b) => b.value - a.value);
            
            console.log(`[BotManager] availableDice: ${availableDice.length}/${totalNonCramped}`);
            if (availableDice.length === 0) {
                console.log("[BotManager] No more dice to assign. Resolving combat.");
                const btnResolve = document.getElementById('btn-resolve-combat');
                this.isActing = false;
                if (btnResolve && !btnResolve.disabled) {
                    btnResolve.click();
                } else {
                    console.log("[BotManager] Cannot click resolve button. Either missing or disabled.");
                }
                return;
            }

            // Lógica de relanzamiento de dados negros (antes de asignar ningún dado)
            const dieToReroll = availableDice.find(d => d.type === 'black' && !d.rerolled && this.shouldRerollBlackDie(d, bot));
            if (dieToReroll) {
                console.log("[BotManager] Decided to reroll black die:", dieToReroll.id);
                this.gameState.rerollDie(dieToReroll.id);
                this.gameState.addLog(`🎲 <strong>${bot.name}</strong> decide relanzar su dado negro buscando un mejor resultado para su equipo.`);
                
                if (typeof window.renderCombatOverlay === 'function') {
                    window.renderCombatOverlay();
                }
                
                // Salimos del turno y dejamos que se reevalúe el nuevo valor
                setTimeout(() => {
                    if (window.botsPaused) {
                        this.isActing = false;
                        return;
                    }
                    this.isActing = false;
                    this.handleGameState();
                }, 1500);
                return;
            }

            const die = availableDice[0]; // Assign one by one


            let advice = "";
			advice = "¡Acabemos rápido con esto! Poned dados en las armas más fuertes.";
            
            let delay = availableDice.length === totalNonCramped ? 2500 : 800;

            if (advice && availableDice.length === totalNonCramped) {
                console.log("[BotManager] Showing combat advice:", advice);
                this.showBubble(this.gameState.currentPlayerIndex, `${advice}`);
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
                console.log("[BotManager] Assigning die:", die.id);
                
                // Intento de intercepción de ataques peligrosos
                if (this.tryInterceptDangerousDie(die, bot)) {
                    console.log("[BotManager] Die used for interception. Updating UI.");
                    if (typeof window.renderCombatOverlay === 'function') {
                        window.renderCombatOverlay();
                    }
                    this.isActing = false;
                    this.handleGameState();
                    return;
                }

                let incomingNormalDmg = 0;
                let incomingDirectDmg = 0;
                if (this.gameState.currentCombat && this.gameState.currentCombat.goblins) {
                    this.gameState.currentCombat.goblins.forEach(gob => {
                        let greenDiceResult = this.gameState.currentCombat.dice && this.gameState.currentCombat.dice.green ? this.gameState.currentCombat.dice.green[gob.uid] : null;
                        if (greenDiceResult && greenDiceResult.details) {
                            let goblinInterceptions = window.interceptionAssignments[gob.uid] || [];
                            
                            let naturalDieIdx = 0;
                            for (let rawIdx = 0; rawIdx < greenDiceResult.details.length; rawIdx++) {
                                let detail = greenDiceResult.details[rawIdx];
                                if (detail.type === 'die') {
                                    const currentIdx = naturalDieIdx;
                                    naturalDieIdx++;
                                    
                                    const isIntercepted = goblinInterceptions.some(asg => Number(asg.goblinDieIndex) === Number(currentIdx));
                                    if (isIntercepted) continue;
                                    
                                    let dieDmg = detail.val;
                                    let nextDetail = greenDiceResult.details[rawIdx + 1];
                                    if (nextDetail && nextDetail.type === 'mod') {
                                        dieDmg += nextDetail.val;
                                    }
                                    
                                    let gobDB = gob.attacks ? gob : (typeof DB !== 'undefined' && DB.goblins ? DB.goblins[gob.level] : null);
                                    let isDirect = false;
                                    if (gobDB && gobDB.attacks) {
                                        let attacks = gobDB.attacks[detail.val] || [];
                                        isDirect = attacks.some(a => {
                                            let lower = a.toLowerCase();
                                            return lower.includes('daño directo') || lower.includes('verdadero') || lower.includes('veneno') || lower.includes('toxina');
                                        });
                                    }
                                    
                                    if (isDirect) {
                                        incomingDirectDmg += dieDmg;
                                    } else {
                                        incomingNormalDmg += dieDmg;
                                    }
                                }
                            }
                        } else {
                            let profile = this.getGoblinDamageProfile(gob);
                            incomingNormalDmg += profile.normal;
                            incomingDirectDmg += profile.direct;
                        }
                    });
                }

                let totalMaxDefense = 0;
                bot.equipped.forEach(eq => {
                    if (eq.isActive && !eq.isBroken && this.isShield(eq)) {
                        totalMaxDefense += this.calculateEquipPower(eq, bot).max;
                    }
                });

                let projectedHpAfterDamage = bot.hp - Math.max(0, incomingNormalDmg - totalMaxDefense) - incomingDirectDmg;
                let isLethalDamage = projectedHpAfterDamage <= 0;

                let canKillGoblin = false;
                let forceAttack = false;

                if (this.gameState.currentCombat && this.gameState.currentCombat.goblins) {
                    this.gameState.currentCombat.goblins.forEach(gob => {
                        let assignedDmg = 0;
                        for (let eqId in window.currentAssignments) {
                            let eq = bot.equipped.find(e => e.id === eqId);
                            if (eq && this.isWeapon(eq)) {
                                let asgs = window.currentAssignments[eqId];
                                const asgsArr = Array.isArray(asgs) ? asgs : [asgs];
                                for (let asg of asgsArr) {
                                    if (!asg.isRole && (asg.targetUid === gob.uid || this.gameState.currentCombat.goblins.length === 1)) {
                                        assignedDmg += this.getDamageForDieInEquip(asg.value, eq);
                                    }
                                }
                            }
                        }

                        let remainingHpToKill = gob.currentHp - assignedDmg;
                        
                        if (remainingHpToKill > 0) {
                            let potentialRemainingDmg = 0;
                            const weaponsForOverride = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isWeapon(eq));
                            
                            availableDice.forEach(d => {
                                let bestDmgForDie = 0;
                                weaponsForOverride.forEach(w => {
                                    if (this.canAcceptDie(d, w)) {
                                        let dmg = this.getDamageForDieInEquip(d.value, w);
                                        if (dmg > bestDmgForDie) bestDmgForDie = dmg;
                                    }
                                });
                                potentialRemainingDmg += bestDmgForDie;
                            });

                            if (potentialRemainingDmg >= remainingHpToKill) {
                                canKillGoblin = true;
                            }
                        } else {
                            canKillGoblin = true;
                        }
                    });
                }

                if (canKillGoblin && !isLethalDamage) {
                    forceAttack = true;
                }

                // Smart override: Don't waste high dice blocking trivial damage
                let roleOverrideAssigned = false;
                let energyGain = bot.role && bot.role.energyRates ? bot.role.energyRates[die.value - 1] : (die.value >= 5 ? 3 : 0);
                
                const hasRoleDie = window.currentAssignments && window.currentAssignments['role'] && window.currentAssignments['role'].length > 0;

                if (!hasRoleDie && !forceAttack && incomingNormalDmg > 0 && incomingNormalDmg <= 2 && energyGain >= 3 && bot.hp >= 5) {
                    this.assignDieToRole(die, bot, `Daño entrante trivial (${incomingNormalDmg}), es más rentable ganar ${energyGain} de energía en el Rol`);
                    roleOverrideAssigned = true;
                }

                // Helper variables
                const brokenEquipsToRepair = bot.equipped.filter(eq => eq.isBroken && this.canAcceptDie(die, eq));
                const weapons = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isWeapon(eq) && this.canAcceptDie(die, eq));
                const shields = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isShield(eq) && this.canAcceptDie(die, eq));
                
                const fallbackToRole = (reason) => {
                    let eGain = bot.role && bot.role.energyRates ? bot.role.energyRates[die.value - 1] : 0;
                    if (eGain === 0) {
                        if (weapons.length > 0) {
                            this.assignDieToEquip(die, weapons[0], bot, "Rol da 0 energía, usando arma por descarte");
                            return;
                        } else if (shields.length > 0) {
                            this.assignDieToEquip(die, shields[0], bot, "Rol da 0 energía, usando escudo por descarte");
                            return;
                        }
                    }

                    const hasRoleDieInner = window.currentAssignments && window.currentAssignments['role'] && window.currentAssignments['role'].length > 0;
                    if (hasRoleDieInner) {
                        if (weapons.length > 0) {
                            this.assignDieToEquip(die, weapons[0], bot, "Rol ya tiene dado, usando arma por descarte");
                        } else if (shields.length > 0) {
                            this.assignDieToEquip(die, shields[0], bot, "Rol ya tiene dado, usando escudo por descarte");
                        } else if (brokenEquipsToRepair.length > 0) {
                            this.assignDieToEquip(die, brokenEquipsToRepair[0], bot, "Rol ya tiene dado, usando equipo roto por descarte");
                        } else {
                            this.gameState.addLog(`🎲 <strong>${bot.name}</strong> descarta el dado <strong>${die.value}</strong> ya que el Rol ya tiene un dado asignado.`);
                            die.assignedTo = 'discarded';
                        }
                        return;
                    }
                    this.assignDieToRole(die, bot, reason);
                };

                // Simplified assignment for Aggressive personality only.
                if (!roleOverrideAssigned) {
                    if (forceAttack && weapons.length > 0) {
                        this.assignDieToEquip(die, weapons[0], bot, "Force‑attack: elimino al goblin con este dado.");
                    } else if (weapons.length > 0) {
                        this.assignDieToEquip(die, weapons[0], bot, "Asignación agresiva a arma.");
                    } else if (shields.length > 0 && (incomingNormalDmg > 0 || this.getDamageForDieInEquip(die.value, shields[0]) > 0)) {
                        this.assignDieToEquip(die, shields[0], bot, "Sin armas, asigno a escudo para mitigar daño.");
                    } else {
                        if (brokenEquipsToRepair.length > 0) {
                            this.assignDieToEquip(die, brokenEquipsToRepair[0], bot, "Equipo roto como último recurso.");
                        } else {
                            fallbackToRole("Asignación a rol como último recurso.");
                        }
                    }
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
        if (!gob || !gob.dice) return { normal: gob.level, direct: 0 };
        let totalDmg = 0;
        for (let part of gob.dice) {
            if (part.includes('d')) {
                let [numStr, facesStr] = part.split('d');
                totalDmg += (parseInt(numStr) || 1) * parseInt(facesStr);
            } else if (part.includes('+')) {
                totalDmg += parseInt(part.replace('+', ''));
            }
        }
        
        let hasDirectDamage = false;
        if (gob.attacks && Array.isArray(gob.attacks)) {
            hasDirectDamage = gob.attacks.some(atk => atk.toLowerCase().includes('daño directo') || atk.toLowerCase().includes('verdadero') || atk.toLowerCase().includes('veneno') || atk.toLowerCase().includes('toxina'));
        }
        
        if (hasDirectDamage) {
            return { normal: 0, direct: totalDmg };
        } else {
            return { normal: totalDmg, direct: 0 };
        }
    }

// Determina los objetivos de combate seguros según el bot, los goblins presentes y la personalidad
    getSafeCombatTargets(bot, goblinsEnMesa, currentPersonality) {
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

        // 1. Añadir todos los objetivos posibles inicialmente
        let targets = [...goblinsEnMesa];
        
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
        
        // Ajuste por personalidad
        targets = targets.slice(0, 1);

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
            const remainingHp = bot.hp - expectedDamageTaken;
            deficitDefense = expectedDamageTaken - bot.hp + 1; // +1 to survive
            
            if (remainingHp > 0) {
                isSafe = true;
            } else {
                let canSurvive = false;
                if (isProtector && bot.energy >= expectedDamageTaken) canSurvive = true;
                if (isSanador && (remainingHp + bot.energy > 0)) canSurvive = true;
                if (isLadron && this.gameState.battlefield.waveLevel >= 3 && bot.mo > 0) canSurvive = true;
                
                if (canSurvive) {
                    isSafe = true;
                } else {
                    targets.pop(); // Drop 1 goblin and re-evaluate
                }
            }
        }

        const finalHpSum = targets.reduce((s, g) => s + g.hp, 0);
        const finalDmgProfile = targets.reduce((acc, g) => {
            let p = this.getGoblinDamageProfile(g);
            return { normal: acc.normal + p.normal, direct: acc.direct + p.direct };
        }, { normal: 0, direct: 0 });
        const finalDmgSum = finalDmgProfile.normal + finalDmgProfile.direct;
        
        let logMsg = `🤖 evalúa el combate: Poder Ofensivo Máx. (${totalMaxDamage}${isGuerreroOrMago ? ' + ' + bot.energy + ' de rol' : ''}) vs PV Enemigos (${finalHpSum}). Defensa Máx. (${totalMaxDefense}) vs Daño Enemigo Estimado (${finalDmgSum}).`;
        
        if (targets.length === 0) {
            logMsg += ` <span style="color:var(--dmg-color);">Evita el combate por considerarlo suicida (Déficit de PV: ${deficitDefense}).</span>`;
        } else {
            logMsg += ` <span style="color:var(--heal-color);">Riesgo aceptable. Selecciona ${targets.length} objetivo(s).</span>`;
        }
        
        this.gameState.addLog(logMsg);
        return targets;
    }

// Verifica si el equipamiento es un arma (contiene la palabra 'daño')
    isWeapon(eq) {
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        return effectStr.includes('daño') || extraStr.includes('daño');
    }

// Verifica si el equipamiento es un escudo o armadura
    isShield(eq) {
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        return effectStr.includes('escudo') || effectStr.includes('escudo') || effectStr.includes('armadura');
    }

// Verifica si el equipamiento proporciona curación
    isHeal(eq) {
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        return effectStr.includes('cura') || effectStr.includes('cura');
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
    shouldRerollBlackDie(die, bot) {
        if (die.type !== 'black' || die.rerolled) return false;

        let bestCurrentPower = 0;
        let isSpecialActivated = false;
        
        // Obtenemos equipo al que se puede asignar este dado (incluyendo roto, que puede prepararse sin coste)
        const allEquip = bot.equipped.filter(eq => eq.isActive && (eq.isBroken || (!eq.isBroken && this.canAcceptDie(die, eq))));
        // Filtramos solo los que realmente pueden aceptar el dado
        const usableEquip = allEquip.filter(eq => this.canAcceptDie(die, eq));

        if (usableEquip.length === 0) {
            // Si el dado actual es completamente inválido para todo nuestro equipo, relanzar es la única opción
            return true;
        }

        for (let eq of usableEquip) {
            let effectMax = 6;
            if (eq.effect && eq.effect.toUpperCase().includes('MAX')) {
                 let match = eq.effect.toUpperCase().match(/MAX\s*(\d+)/);
                 if (match) effectMax = parseInt(match[1]);
            }

            let actualVal = Math.min(die.value, effectMax);
            if (eq.effect && eq.effect.includes('+1')) actualVal += 1;
            else if (eq.effect && eq.effect.includes('+2')) actualVal += 2;
            else if (eq.effect && eq.effect.includes('-1')) actualVal -= 1;
            
            if (eq.effect && eq.effect.match(/Daño\s*(\d+)(?!.*dado)/i)) {
                let match = eq.effect.match(/Daño\s*(\d+)/i);
                if (match && !eq.effect.toLowerCase().includes('dado')) {
                    actualVal = parseInt(match[1]);
                    isSpecialActivated = true;
                }
            }
            if (eq.effect && eq.effect.match(/Cura\s*(\d+)(?!.*dado)/i)) {
                let match = eq.effect.match(/Cura\s*(\d+)/i);
                if (match && !eq.effect.toLowerCase().includes('dado')) {
                    actualVal = parseInt(match[1]);
                    isSpecialActivated = true;
                }
            }
            
            // Revisar si en los extras del equipo se detona algo específico con este valor
            if (eq.extra && eq.extra.includes(die.value.toString())) {
                 isSpecialActivated = true;
            }

            if (actualVal > bestCurrentPower) {
                bestCurrentPower = actualVal;
            }
        }

        // Si es un valor bajo (1 o 2) y no detona ninguna habilidad especial
        // y nuestro mejor poder actual es muy bajo, lo relanzamos esperando un > 3
        if (die.value <= 2 && !isSpecialActivated && bestCurrentPower <= 2) {
            return true;
        }

        return false;
    }

// Intenta interceptar un dado peligroso de un goblin, priorizando la reparación si es necesario
    tryInterceptDangerousDie(die, bot) {
        if (!this.gameState.currentCombat || this.gameState.currentCombat.isCrampPhase) return false;
        
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

                    // Evaluate if the attack is dangerous
                    let gobDB = gob.attacks ? gob : (typeof DB !== 'undefined' && DB.goblins ? DB.goblins[gob.level] : null);
                    if (!gobDB || !gobDB.attacks) continue;

                    let attacks = gobDB.attacks[detail.val] || [];
                    let isDangerous = attacks.some(a => {
                        let lower = a.toLowerCase();
                        return lower.includes('daño directo') || lower.includes('verdadero') || lower.includes('veneno') || lower.includes('toxina') || lower.includes('rompe') || lower.includes('escozor') || lower.includes('calambre') || lower.includes('tembleque');
                    });

                    if (isDangerous) {
                        // Check if we want to repair a broken item instead
                        let wantsToRepair = false;
                        if (bot && bot.mo >= 1) {
                            const brokenItems = bot.equipped.filter(eq => eq.isBroken && this.canAcceptDie(die, eq));
                            if (brokenItems.length > 0) {
                                wantsToRepair = true;
                            }
                        }

                        if (wantsToRepair) {
                            return false; // Skip interception to allow assignment to broken item later
                        }
                        // Perform interception
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
        }
        return false;
    }

// Verifica si el equipamiento puede aceptar el dado (límites de usos y validez)
    canAcceptDie(die, eq) {
        if (!this.gameState.isValidDieForEquipment(die.value, eq)) return false;
        const extra = (eq.extra || '').toLowerCase();
        const isReusable = extra.includes('reutilizable');
        const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
        const currentlyAssigned = window.currentAssignments && window.currentAssignments[eq.id] ? window.currentAssignments[eq.id].length : 0;
        return currentlyAssigned < maxUses;
    }

// Asigna un dado al equipamiento especificado, registrando la razón y objetivo
    assignDieToEquip(die, eq, bot, reason = "") {
        if (!currentAssignments[eq.id]) currentAssignments[eq.id] = [];
        let targetUid = null;
        let targetName = null;
        const goblins = this.gameState.currentCombat ? this.gameState.currentCombat.goblins : [];
        let dealsDamage = this.getDamageForDieInEquip(die.value, eq) > 0;
        if (goblins.length > 0 && (!this.isShield(eq) || dealsDamage)) {
            // Lógica inteligente de selección de objetivos de combate
            let goblinDamage = {};
            goblins.forEach(g => {
                goblinDamage[g.uid] = 0;
            });
            
            for (let eqId in currentAssignments) {
                let assignedEq = bot.equipped.find(e => e.id === eqId);
                if (assignedEq && this.isWeapon(assignedEq)) {
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
                    let sortedKillable = [...killableGoblins].sort((a, b) => b.level - a.level);
                    targetGoblin = sortedKillable[0];
                } else {
                    let sortedAlive = [...aliveGoblins].sort((a, b) => b.level - a.level);
                    targetGoblin = sortedAlive[0];
                }
            } else {
                let sortedGoblins = [...goblins].sort((a, b) => b.currentHp - a.currentHp);
                targetGoblin = sortedGoblins[0];
            }
            
            if (targetGoblin) {
                targetUid = targetGoblin.uid;
                targetName = targetGoblin.name || `G${targetGoblin.level}`;
            }
        }
        currentAssignments[eq.id].push({ 
            dieId: die.id, 
            value: die.value, 
            targetUid: targetUid, 
            elasticDamage: null 
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
        try {
            if (this.gameState.retaliationQueue.length === 0) {
                this.isActing = false;
                return;
            }

            const goblin = this.gameState.retaliationQueue[0];
            
            let bestPlayerIndex = -1;
            let bestScore = -999;

            this.gameState.players.forEach((p, index) => {
                if (p.isDead) return;
                
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
                    this.showBubble(bestPlayerIndex, `${advice}`);
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
                    if (typeof renderRetaliationModal === 'function') {
                        renderRetaliationModal();
                    }
                    this.isActing = false;
                    this.handleGameState();
                }, 3500);
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
                            this.showBubble(this.gameState.currentPlayerIndex, `Tomaré esta decisión por nosotros.`);
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

// Muestra un bocadillo sobre el jugador indicado con el texto especificado
    showBubble(playerIndex, text) {
        if (window.updateBotBubble) {
            window.updateBotBubble(playerIndex, text);
            
            const player = this.gameState.players[playerIndex];
            if (!player || !player.role) return;

            // Aplicar color personalizado al borde del bocadillo según el rol
            const bubble = document.getElementById(`bot-bubble-${playerIndex}`);
            if (bubble) {
                const color = this.getRoleColor(player.role.id);
                bubble.style.borderColor = color;
                
                // Actualizar el color del triángulo inferior (la "flecha" del bocadillo)
                const arrow = bubble.children[1]; // El primer div absoluto que hace de borde
                if (arrow) {
                    arrow.style.borderTopColor = color;
                }
            }
        }
    }

// Obtiene la personalidad del bot para tomar decisiones (solo 'Agresivo')
    getPersonalityForDecision(bot) {
        // All bots now use the Aggressive personality exclusively.
        return 'Agresivo';
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
            const activeWeapons = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isWeapon(eq));
            activeWeapons.forEach(w => {
                const extra = (w.extra || '').toLowerCase();
                const isReusable = extra.includes('reutilizable');
                const maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
                weaponSlots += maxUses;
            });

            let remainingDiceForShields = Math.max(0, numDice - weaponSlots);

            const activeShields = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isShield(eq));
            let shieldSlots = 0;
            activeShields.forEach(s => {
                const extra = (s.extra || '').toLowerCase();
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
                    const extra = (s.extra || '').toLowerCase();
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
                this.gameState.addLog(`🤖 <strong>${bot.name}</strong> usa su rol de Ladrón antes de finalizar el turno para convertir ${bot.energy} de energía en monedas.`);
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
        if (typeof window.updateUI === 'function') window.updateUI();
    }
}

window.BotManager = BotManager;
