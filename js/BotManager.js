class BotManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.activeBots = [];
        this.isActing = false;
    }

    // --- AUTOMATIZACIÓN DE TURNOS ---

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
                setTimeout(() => this.performMainTurn(activePlayer), 1500);
            }
        }
    }

    triggerAction(type, target = null, reason = "") {
        if (type === 'gold') {
            this.gameState.performActionGold();
            window.updateUI();
        } else if (type === 'gold-dmg') {
            this.gameState.performActionGoldAndDamage();
            window.updateUI();
        } else if (type === 'role') {
            this.gameState.performActionRole();
            window.updateUI();
        } else if (type === 'hito') {
            this.gameState.deployHito();
            window.updateUI();
        } else if (type === 'end-turn') {
            this.gameState.nextTurn();
            window.updateUI();
            setTimeout(() => { this.isActing = false; this.handleGameState(); }, 500);
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
                window.updateUI();
                this.isActing = false;
            }, 500);
            return;
        } else if (type === 'buy-potion') {
            const result = this.gameState.buyPotion(target);
            if (result) {
                const decks = document.querySelectorAll('.deck');
                const pDeck = Array.from(decks).find(d => d.style.backgroundImage.includes('Pociones.webp'));
                if (pDeck) window.animateCardPurchase(pDeck);
            }
            setTimeout(() => {
                window.updateUI();
                this.isActing = false;
            }, 500);
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
                window.updateUI();
                this.isActing = false;
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
            setTimeout(() => { this.isActing = false; this.handleGameState(); }, 500);
            return;
        }
        
        setTimeout(() => { this.isActing = false; this.handleGameState(); }, 500);
    }

    evaluateSurvivalOverride(bot) {
        if (bot.hp > bot.maxHp * 0.30) return false; // Solo actúa si HP <= 30%

        // Prioridad 1: Si el sanador necesita energía para curar, recargar rol
        if (bot.role.id === 'sanador' && bot.energy < 3) {
            this.showBubble(this.gameState.currentPlayerIndex, `<strong style="color: red;">[Supervivencia]</strong> ¡Necesito energía para curarme!`);
            this.triggerAction('role');
            return true;
        }

        // Prioridad 2: ¿Cobrar oro tiene sentido? Solo si con 1-2 monedas más podrá comprar curación
        const canAffordHealingSoon = (() => {
            // Comprobar pociones (oleada 3+)
            if (this.gameState.battlefield.waveLevel >= 3 && typeof DB !== 'undefined' && DB.equipment && DB.equipment.pociones) {
                const cheapestPotion = DB.equipment.pociones.reduce((min, p) => p.cost < min ? p.cost : min, Infinity);
                if (bot.mo + 1 >= cheapestPotion || bot.mo + 2 >= cheapestPotion) return true;
            }
            // Comprobar equipo de curación en mercado
            const healMarket = this.gameState.market && this.gameState.market['curacion'];
            if (healMarket && healMarket.length > 0) {
                const healCost = healMarket[0].cost;
                if (bot.mo + 1 >= healCost || bot.mo + 2 >= healCost) return true;
            }
            return false;
        })();

        if (canAffordHealingSoon) {
            this.showBubble(this.gameState.currentPlayerIndex, `<strong style="color: red;">[Supervivencia]</strong> ¡Estoy muy malherido! Necesito reunir oro para curarme.`);
            this.triggerAction('gold');
            return true;
        }

        // Si no puede comprar curación pronto con oro, NO cobrar oro (sería inútil).
        // Dejar que performMainTurn decida con su lógica normal (combate, rol, etc.)
        return false;
    }

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
        else if (personality === 'Conservador') score -= 5;
        
        return score;
    }

    performMainTurn(bot) {
        try {
            if (this.evaluateSurvivalOverride(bot)) return;

            const currentPersonality = this.getPersonalityForDecision(bot);
            const pColor = this.getPersonalityColor(currentPersonality);
            const goblinsEnMesa = this.gameState.battlefield.goblins.filter(g => !g.isDying);
            const hitoBtn = document.getElementById('btn-deploy-hito');
            const canDeployHito = hitoBtn && !hitoBtn.disabled && goblinsEnMesa.length === 0;
            
            // Si es la última acción de la oleada, no queremos abrir un Hito para evitar 
            // que los enemigos generados ataquen (represalia) y muten de inmediato al cerrar la oleada.
            const isLastAction = typeof this.gameState.battlefield.actionCount !== 'undefined' && this.gameState.battlefield.actionCount >= 2;
            const safeToDeployHito = canDeployHito && !isLastAction;

            const combatScore = this.calculateCombatScore(bot, goblinsEnMesa);
            let chosenAction = null;
            let decisionText = "";
            let targetForCombat = [];

            // Helper to determine if we should fight
            const asequible = combatScore >= 15;
            const hasRewards = goblinsEnMesa.some(g => (g.pexReward && g.pexReward > 0) || (g.moReward && g.moReward > 0) || g.type === 'minijefe' || g.type === 'jefe');
            const isLastResort = this.gameState.players.filter(p => !p.isDead && p.isBot).length === 1 && this.gameState.players.filter(p => !p.isDead).length === 1;
            const allyInDanger = this.gameState.players.some(p => !p.isDead && p.id !== bot.id && p.hp <= p.maxHp * 0.35);
            const bufferGoblins = goblinsEnMesa.filter(g => g.skill && (g.skill.includes('inmune') || g.skill.includes('protege')));

            // Check desired item shortfall for Agresivo
            const attackMarket = this.gameState.market && this.gameState.market['ataque'];
            const topAttackCard = attackMarket && attackMarket.length > 0 ? attackMarket[0] : null;
            const shortfall = topAttackCard ? topAttackCard.cost - bot.mo : 0;
            
            // Calculamos objetivos de combate de forma inteligente
            const potentialTargets = this.getSafeCombatTargets(bot, goblinsEnMesa, currentPersonality);

            if (currentPersonality === 'Agresivo') {
                if (potentialTargets.length > 0) {
                    chosenAction = 'combat';
                    decisionText = "¡A por ellos! No dejaré a ni uno vivo.";
                    targetForCombat = potentialTargets;
                } else if (canDeployHito && safeToDeployHito) {
                    chosenAction = 'hito';
                    decisionText = "El camino está libre. ¡Avancemos rápido!";
                } else {
                    // Not recommended to deploy Hito or cannot deploy
                    if (shortfall === 1 || shortfall === 2) {
                        if (bot.hp > 1) {
                            chosenAction = shortfall === 2 ? 'gold-dmg' : 'gold';
                            decisionText = "Me faltan pocas monedas para esa arma. " + (shortfall === 2 ? "Un poco de sangre valdrá la pena." : "Aseguraré una moneda.");
                        } else {
                            chosenAction = 'role';
                            decisionText = "Me falta oro pero estoy al límite de vida. Mejor recargo mi habilidad.";
                        }
                    } else {
                        chosenAction = 'role';
                        decisionText = "No hay compras claras ni puedo avanzar. Mejor recargar mi habilidad.";
                    }
                }
            } 
            else if (currentPersonality === 'Conservador') {
                if (potentialTargets.length > 0) {
                    chosenAction = 'combat';
                    decisionText = potentialTargets.length > 1 ? "Mi equipo me permite soportar el combate. Atacaré a varios." : "Podemos con ellos de forma segura. Me centraré en un objetivo.";
                    targetForCombat = potentialTargets;
                } else if (canDeployHito && safeToDeployHito && goblinsEnMesa.length === 0) {
                    chosenAction = 'hito';
                    decisionText = "El camino es seguro. Avancemos con precaución.";
                } else {
                    // Prioritize Gold or Role
                    if (bot.energy < 3) {
                        chosenAction = 'role';
                        decisionText = "Necesitamos estar preparados. Recargo mi habilidad.";
                    } else {
                        chosenAction = 'gold';
                        decisionText = "No me arriesgaré. Tomo una moneda segura para equipo.";
                    }
                }
            } 
            else if (currentPersonality === 'Cooperativo') {
                if (potentialTargets.length > 0) {
                    chosenAction = 'combat';
                    decisionText = allyInDanger ? "¡Resistid! Yo me encargo de ellos." : "Quitaré estos Goblins de en medio para ayudar al grupo.";
                    targetForCombat = potentialTargets;
                } else if (bot.energy < 4) {
                    chosenAction = 'role';
                    decisionText = "Cargaré mi habilidad para asistir al grupo cuando lo necesiten.";
                } else if (canDeployHito && safeToDeployHito && goblinsEnMesa.length === 0) {
                    chosenAction = 'hito';
                    decisionText = "El grupo está listo. Abriré el siguiente obstáculo.";
                } else {
                    chosenAction = 'gold';
                    decisionText = "Tomaré algo de oro para poder ayudar más adelante.";
                }
            }
            else {
                // Fallback for missing/other personality
                if (potentialTargets.length > 0) {
                    chosenAction = 'combat';
                    targetForCombat = potentialTargets;
                    decisionText = "¡Al combate!";
                } else {
                    chosenAction = 'gold';
                    decisionText = "Tomaré una moneda.";
                }
            }

            this.showBubble(this.gameState.currentPlayerIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> ${decisionText}`);
            this.gameState.addLog(`🤖 <strong>${bot.name} (${currentPersonality}):</strong> "${decisionText}"`);

            if (chosenAction === 'combat') {
                setTimeout(() => {
                    this.hideAllBubbles();
                    this.triggerAction('combat', targetForCombat);
                }, 3500);
            } else {
                setTimeout(() => {
                    this.hideAllBubbles();
                    this.triggerAction(chosenAction);
                }, 3500);
            }
        } catch(e) {
            console.error("Error in performMainTurn", e);
            this.isActing = false;
        }
    }

    performMarketTurn(bot) {
        try {
            const currentPersonality = this.getPersonalityForDecision(bot);
            const pColor = this.getPersonalityColor(currentPersonality);
            
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
                needsHealing = true; // Force them to look for healing if they have none
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
                if (currentPersonality === 'Agresivo') {
                    bought = buyIfPossible('ataque');
                    if (!bought && bot.mo < 3) {
                        advice = "Ahorraré para un arma mejor.";
                    } else if (!bought) {
                        bought = buyIfPossible('escudos') || buyIfPossible('curacion');
                    }
                    
                    if (bought && !advice) {
                        advice = "¡Poder! Dame todo el poder para aplastar goblins.";
                    } else if (!bought && bot.mo > 6 && this.gameState.market['ataque'] && this.gameState.market['ataque'].length > 0) {
                        chosenAction = 'explore-market';
                        chosenTarget = 'ataque';
                        advice = "No me gusta esta arma. Pagaré por ver la siguiente.";
                        
                        const topCard = this.gameState.market['ataque'][0];
                        if (bot.mo < topCard.cost) {
                            if (topCard.cost >= 5) {
                                actionReason = `El coste de ${topCard.cost} mo es bastante caro.`;
                            } else {
                                actionReason = `Aún le faltan monedas para los ${topCard.cost} mo que cuesta.`;
                            }
                        } else if (bot.equipped.some(eq => eq.id === topCard.id)) {
                            actionReason = `Ya tiene una copia de ${topCard.name}.`;
                        } else {
                            actionReason = `Prefiere buscar algo más destructivo.`;
                        }
                        
                        bought = true;
                    }
                } else if (currentPersonality === 'Conservador') {
                    bought = buyIfPossible('escudos') || buyIfPossible('curacion');
                    if (!bought && bot.mo < 3) {
                        advice = "Mejor guardo el oro para una buena armadura o poción.";
                    } else if (!bought) {
                        bought = buyIfPossible('ataque');
                    }
                    
                    if (bought && !advice) {
                        advice = "Hay que ir sobre seguro. Este equipo me protegerá.";
                    }
                } else if (currentPersonality === 'Cooperativo') {
                    bought = buyIfPossible('escudos') || buyIfPossible('curacion') || buyIfPossible('ataque');
                    if (bought && !advice) {
                        advice = "Este equipo nos ayudará a sobrevivir como grupo.";
                    } else if (!bought && bot.mo < 3) {
                        advice = "Guardaré este oro para cuando realmente nos haga falta.";
                    } else if (!bought) {
                        const types = ['ataque', 'escudos', 'curacion'];
                        const rType = types[Math.floor(Math.random() * types.length)];
                        const threshold = rType === 'curacion' ? 4 : 6;
                        
                        if (bot.mo > threshold) {
                            chosenAction = 'explore-market';
                            chosenTarget = rType;
                            advice = "Limpiaré el mercado de chatarra para el próximo.";
                            
                            if (this.gameState.market[rType] && this.gameState.market[rType].length > 0) {
                                const topCard = this.gameState.market[rType][0];
                                if (bot.mo < topCard.cost) {
                                    if (topCard.cost >= 5) {
                                        actionReason = `El coste de ${topCard.cost} mo por ${topCard.name} es muy elevado.`;
                                    } else {
                                        actionReason = `No tiene suficiente oro para los ${topCard.cost} mo de ${topCard.name}.`;
                                    }
                                } else if (bot.equipped.some(eq => eq.id === topCard.id)) {
                                    actionReason = `Ya posee una copia de ${topCard.name}.`;
                                } else if (isProtector && rType === 'escudos') {
                                    actionReason = `Su rol le limita el uso de equipo defensivo adicional.`;
                                } else {
                                    actionReason = `Considera que ${topCard.name} no es útil para el equipo actualmente.`;
                                }
                            }
                            
                            bought = true;
                        }
                    }
                }
            }

            if (bought || advice) {
                if (!advice) advice = "He terminado mis compras.";
                this.showBubble(this.gameState.currentPlayerIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> ${advice}`);
                this.gameState.addLog(`🤖 <strong>${bot.name} (${currentPersonality}):</strong> "${advice}"`);
            }
            
            if (!bought) {
                chosenAction = 'end-turn';
            }
            
            if (chosenAction) {
                setTimeout(() => {
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

    performCombatTurn(bot) {
        console.log("[BotManager] performCombatTurn started for bot:", bot.id);
        try {
            const currentPersonality = this.getPersonalityForDecision(bot);
            const pColor = this.getPersonalityColor(currentPersonality);
            
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

            const totalNonCramped = this.gameState.currentCombat.playerDice.filter(d => !d.isCramped).length;
            const availableDice = this.gameState.currentCombat.playerDice.filter(d => !d.assignedTo && !d.isCramped);
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
                    this.isActing = false;
                    this.handleGameState();
                }, 1500);
                return;
            }

            const die = availableDice[0]; // Assign one by one


            let advice = "";
            if (currentPersonality === 'Agresivo') {
                advice = "¡Acabemos rápido con esto! Poned dados en las armas más fuertes.";
            } else if (currentPersonality === 'Conservador') {
                advice = "Cubríos bien las espaldas. Activad los escudos primero.";
            } else if (currentPersonality === 'Cooperativo') {
                advice = "Yo me encargo de apoyar donde haga falta. ¡Usad vuestros mejores ataques!";
            } else if (currentPersonality === 'Egoista') {
                advice = "Mis dados son para mis cosas. No esperéis que os salve el pellejo.";
            } else if (currentPersonality === 'Caotico') {
                advice = "¡A la carga! A ver qué sale.";
            }
            
            let delay = availableDice.length === totalNonCramped ? 2500 : 800;

            if (advice && availableDice.length === totalNonCramped) {
                console.log("[BotManager] Showing combat advice:", advice);
                this.showBubble(this.gameState.currentPlayerIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> ${advice}`);
                this.gameState.addLog(`🤖 <strong>${bot.name} (${currentPersonality}):</strong> "${advice}"`);
            }

            if (typeof window.renderCombatOverlay === 'function') {
                window.renderCombatOverlay();
            }
            
            setTimeout(() => {
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
                
                if (!forceAttack && incomingNormalDmg > 0 && incomingNormalDmg <= 2 && energyGain >= 3 && bot.hp >= 5) {
                    this.assignDieToRole(die, bot, `Daño entrante trivial (${incomingNormalDmg}), es más rentable ganar ${energyGain} de energía en el Rol`);
                    roleOverrideAssigned = true;
                }

                // Helper variables
                const brokenEquipsToRepair = (bot.mo >= 1) ? bot.equipped.filter(eq => eq.isBroken && this.canAcceptDie(die, eq)) : [];
                const weapons = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isWeapon(eq) && this.canAcceptDie(die, eq));
                const shields = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.isShield(eq) && this.canAcceptDie(die, eq));
                
                const fallbackToRole = (reason) => {
                    let eGain = bot.role && bot.role.energyRates ? bot.role.energyRates[die.value - 1] : 0;
                    if (eGain === 0) {
                        if (brokenEquipsToRepair.length > 0) {
                            this.assignDieToEquip(die, brokenEquipsToRepair[0], bot, "Rol da 0 energía, usando equipo roto por descarte");
                            return;
                        } else if (weapons.length > 0) {
                            this.assignDieToEquip(die, weapons[0], bot, "Rol da 0 energía, usando arma por descarte");
                            return;
                        } else if (shields.length > 0) {
                            this.assignDieToEquip(die, shields[0], bot, "Rol da 0 energía, usando escudo por descarte");
                            return;
                        }
                    }
                    this.assignDieToRole(die, bot, reason);
                };

                // Assign based on personality
                if (!roleOverrideAssigned) {
                    if (brokenEquipsToRepair.length > 0) {
                        this.assignDieToEquip(die, brokenEquipsToRepair[0], bot, "Asignando a equipo roto para prepararlo para reparación");
                    } else if (forceAttack) {
                        if (weapons.length > 0) {
                            this.assignDieToEquip(die, weapons[0], bot, "Puedo eliminar a la amenaza y sobrevivir. Priorizo atacar.");
                        } else if (shields.length > 0 && (incomingNormalDmg > 0 || this.getDamageForDieInEquip(die.value, shields[0]) > 0)) {
                            this.assignDieToEquip(die, shields[0], bot, "Sin armas disponibles, usando escudo alternativo");
                        } else {
                            fallbackToRole("Sin armas ni escudos útiles, recargando Rol");
                        }
                    } else if (currentPersonality === 'Agresivo') {
                        if (weapons.length > 0) {
                            this.assignDieToEquip(die, weapons[0], bot, "Prioridad de ataque por personalidad Agresiva");
                        } else if (shields.length > 0 && (incomingNormalDmg > 0 || this.getDamageForDieInEquip(die.value, shields[0]) > 0)) {
                            this.assignDieToEquip(die, shields[0], bot, "Sin armas disponibles, usando escudo alternativo");
                        } else {
                            fallbackToRole("Sin armas ni escudos útiles, recargando Rol");
                        }
                    } else if (currentPersonality === 'Conservador') {
                        if (shields.length > 0 && (incomingNormalDmg > 0 || this.getDamageForDieInEquip(die.value, shields[0]) > 0)) {
                            this.assignDieToEquip(die, shields[0], bot, "Prioridad defensiva por personalidad Conservadora");
                        } else if (weapons.length > 0) {
                            let reason = incomingNormalDmg === 0 && shields.length > 0 ? "El daño entrante es nulo, priorizando ataque" : "Sin escudos disponibles, priorizando ataque";
                            this.assignDieToEquip(die, weapons[0], bot, reason);
                        } else {
                            fallbackToRole("Sin armas ni escudos útiles, recargando Rol");
                        }
                    } else if (currentPersonality === 'Cooperativo') {
                        let energyGain = bot.role && bot.role.energyRates ? bot.role.energyRates[die.value - 1] : 0;
                        if (bot.energy < 2 && energyGain >= 2) {
                            this.assignDieToRole(die, bot, "Priorizando recargar Rol para apoyar al equipo");
                        } else {
                            if (weapons.length > 0) {
                                this.assignDieToEquip(die, weapons[0], bot, "Atacando para reducir la amenaza del grupo");
                            } else if (shields.length > 0 && (incomingNormalDmg > 0 || this.getDamageForDieInEquip(die.value, shields[0]) > 0)) {
                                this.assignDieToEquip(die, shields[0], bot, "Sin armas, usando escudo para mitigar daño");
                            } else {
                                fallbackToRole("Asignación estándar por descarte");
                            }
                        }
                    } else {
                        // Fallback for any other personality
                        if (weapons.length > 0) {
                            this.assignDieToEquip(die, weapons[0], bot, "Asignación estándar");
                        } else if (shields.length > 0 && (incomingNormalDmg > 0 || this.getDamageForDieInEquip(die.value, shields[0]) > 0)) {
                            this.assignDieToEquip(die, shields[0], bot, "Sin armas, asignación estándar a escudo");
                        } else {
                            fallbackToRole("Asignación estándar a Rol");
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
        const maxUses = extra.includes('x3') ? 3 : (isReusable ? 6 : 1);
        
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
        
        // Ajuste por personalidad
        if (currentPersonality === 'Conservador') {
            targets = targets.slice(0, 1);
        } else if (currentPersonality === 'Cooperativo') {
            const bufferGoblins = targets.filter(g => g.skill && (g.skill.includes('inmune') || g.skill.includes('protege')));
            targets = bufferGoblins.length > 0 ? bufferGoblins : targets.slice(0, 1);
        }

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
        
        let logMsg = `🤖 <strong>${bot.name} (${currentPersonality})</strong> evalúa el combate: Poder Ofensivo Máx. (${totalMaxDamage}${isGuerreroOrMago ? ' + ' + bot.energy + ' de rol' : ''}) vs PV Enemigos (${finalHpSum}). Defensa Máx. (${totalMaxDefense}) vs Daño Enemigo Estimado (${finalDmgSum}).`;
        
        if (targets.length === 0) {
            logMsg += ` <span style="color:var(--dmg-color);">Evita el combate por considerarlo suicida (Déficit de PV: ${deficitDefense}).</span>`;
        } else {
            logMsg += ` <span style="color:var(--heal-color);">Riesgo aceptable. Selecciona ${targets.length} objetivo(s).</span>`;
        }
        
        this.gameState.addLog(logMsg);
        return targets;
    }

    isWeapon(eq) {
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        return effectStr.includes('daño') || extraStr.includes('daño');
    }

    isShield(eq) {
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        return effectStr.includes('escudo') || extraStr.includes('escudo') || effectStr.includes('armadura');
    }

    isHeal(eq) {
        let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
        let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
        return effectStr.includes('cura') || extraStr.includes('cura');
    }

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

    shouldRerollBlackDie(die, bot) {
        if (die.type !== 'black' || die.rerolled) return false;

        let bestCurrentPower = 0;
        let isSpecialActivated = false;
        
        // Obtenemos solo el equipo al que se puede asignar este dado
        const allEquip = bot.equipped.filter(eq => eq.isActive && !eq.isBroken && this.canAcceptDie(die, eq));

        if (allEquip.length === 0) {
            // Si el dado actual es completamente inválido para todo nuestro equipo, relanzar es la única opción de darle uso en equipo (además de asignar al Rol)
            return true;
        }

        for (let eq of allEquip) {
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

    canAcceptDie(die, eq) {
        if (!this.gameState.isValidDieForEquipment(die.value, eq)) return false;
        const extra = (eq.extra || '').toLowerCase();
        const isReusable = extra.includes('reutilizable');
        const maxUses = extra.includes('x3') ? 3 : (isReusable ? 6 : 1);
        const currentlyAssigned = window.currentAssignments && window.currentAssignments[eq.id] ? window.currentAssignments[eq.id].length : 0;
        return currentlyAssigned < maxUses;
    }

    assignDieToEquip(die, eq, bot, reason = "") {
        if (!currentAssignments[eq.id]) currentAssignments[eq.id] = [];
        let targetUid = null;
        let targetName = null;
        const goblins = this.gameState.currentCombat ? this.gameState.currentCombat.goblins : [];
        let dealsDamage = this.getDamageForDieInEquip(die.value, eq) > 0;
        if (goblins.length > 0 && (!this.isShield(eq) || dealsDamage)) {
            let targetGoblin = goblins[Math.floor(Math.random() * goblins.length)];
            targetUid = targetGoblin.uid;
            targetName = targetGoblin.name || `G${targetGoblin.level}`;
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

    assignDieToRole(die, bot, reason = "") {
        if (!currentAssignments['role']) currentAssignments['role'] = [];
        currentAssignments['role'].push({ dieId: die.id, value: die.value, isRole: true });
        die.assignedTo = 'role';
        if (bot) {
            let reasonText = reason ? ` <br><span style="font-size:0.9em; color:#888;"><i>(${reason})</i></span>` : '';
            this.gameState.addLog(`⚡ <strong>${bot.name}</strong> asigna un <strong>${die.value}</strong> a su <strong>Habilidad de Rol</strong>.${reasonText}`);
        }
    }

    performRetaliationTurn() {
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
                
                // Evaluamos según el % de vida restante o la vida actual.
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
                    const currentPersonality = this.getPersonalityForDecision(botConf);
                    const pColor = this.getPersonalityColor(currentPersonality);
                    let advice = "Aguantaré este golpe por el equipo.";
                    if (currentPersonality === 'Agresivo') advice = "¡Un rasguño! Yo lo recibo.";
                    if (currentPersonality === 'Conservador') advice = "Tengo salud de sobra, yo me encargo.";
                    this.showBubble(bestPlayerIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> ${advice}`);
                    this.gameState.addLog(`🤖 <strong>${botConf.name} (${currentPersonality}):</strong> "${advice}"`);
                }

                setTimeout(() => {
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

    performEventTurn(bot) {
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
                            const currentPersonality = this.getPersonalityForDecision(bot);
                            const pColor = this.getPersonalityColor(currentPersonality);
                            
                            let choiceIndex = 0;
                            if (buttons.length > 1) {
                                if (currentPersonality === 'Conservador') choiceIndex = buttons.length - 1;
                                else if (currentPersonality === 'Agresivo') choiceIndex = 0;
                            }

                            this.showBubble(this.gameState.currentPlayerIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> Tomaré esta decisión por nosotros.`);
                            this.gameState.addLog(`🤖 <strong>${bot.name} (${currentPersonality}):</strong> "Tomaré esta decisión por nosotros."`);
                            setTimeout(() => {
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
                this.isActing = false;
                this.handleGameState();
            }, 1000);
            
        } catch(e) {
            console.error("Error in performEventTurn", e);
            this.isActing = false;
        }
    }

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
    evaluateState() {
        if (!this.gameState || this.gameState.isGameOver) return;
        
        this.activeBots = this.gameState.players.filter(p => p.isBot);
        if (this.activeBots.length === 0) return;

        // Asegurar que todos los bots tienen su ADN generado
        this.activeBots.forEach(bot => {
            if (!bot.botDNA) {
                const personalities = ['Agresivo', 'Conservador', 'Cooperativo'];
                bot.botDNA = personalities.sort(() => Math.random() - 0.5);
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

    hideAllBubbles() {
        this.activeBots.forEach(bot => {
            const pIndex = this.gameState.players.findIndex(p => p.id === bot.id);
            if (window.updateBotBubble) window.updateBotBubble(pIndex, null);
        });
    }

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

    getPersonalityForDecision(bot) {
        if (!bot || !bot.botDNA) return 'Agresivo';
        
        // Cascada del 80%
        for (let i = 0; i < bot.botDNA.length - 1; i++) {
            const roll = Math.floor(Math.random() * 100) + 1;
            if (roll <= 80) {
                return bot.botDNA[i];
            }
        }
        // Fallo total de las 3 primeras, actúa como la última
        return bot.botDNA[bot.botDNA.length - 1];
    }

    getPersonalityColor(personality) {
        const colors = {
            'Agresivo': '#d62828',    // Rojo
            'Conservador': '#000000', // Negro
            'Cooperativo': '#0077b6'  // Azul
        };
        return colors[personality] || '#333';
    }

    // --- HEURÍSTICAS DE FASES COMPARTIDAS ---

    handleMarketAdvice() {
        return; // CONSEJOS DESACTIVADOS TEMPORALMENTE
        this.activeBots.forEach((bot) => {
            const pIndex = this.gameState.players.findIndex(p => p.id === bot.id);
            const currentPersonality = this.getPersonalityForDecision(bot);
            let advice = "";
            
            const isLowHp = bot.hp <= (bot.maxHp * 0.3);
            const hasBrokenEquip = bot.equipped.some(eq => eq.isBroken);
            
            if (currentPersonality === 'Agresivo') {
                advice = "Comprad armas o equipo que sume dados. ¡Las pociones son para los débiles!";
            } else if (currentPersonality === 'Conservador') {
                advice = "Buscad escudos, armaduras y pociones. Hay que sobrevivir a toda costa.";
            } else if (currentPersonality === 'Cooperativo') {
                advice = "Mirad el equipo de todos. Si a alguien le falta de algo, le ayudamos.";
            }

            // Contextos extremos (sobrescribe un poco la recomendación genérica)
            if (isLowHp && currentPersonality !== 'Agresivo') {
                advice = "¡Estoy en las últimas! 🩸 Deberíamos priorizar una poción curativa o equipo protector.";
            } else if (hasBrokenEquip && bot.mo > 0) {
                advice = "Tengo equipo roto 🛠️. Deberíamos reservar dinero para repararlo.";
            }

            const pColor = this.getPersonalityColor(currentPersonality);
            this.showBubble(pIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> ${advice}`);
        });
    }

    handleRetaliationAdvice() {
        this.activeBots.forEach((bot) => {
            const pIndex = this.gameState.players.findIndex(p => p.id === bot.id);
            const currentPersonality = this.getPersonalityForDecision(bot);
            let advice = "";
            
            const isLowHp = bot.hp <= (bot.maxHp * 0.3);
            const isHealthy = bot.hp >= (bot.maxHp * 0.8);

            if (currentPersonality === 'Agresivo') {
                advice = "¡A mí no me miréis! Que se coma este daño el que tenga más defensa.";
            } else if (currentPersonality === 'Conservador') {
                if (isHealthy) advice = "Estoy casi intacto, podría asumir algo de daño si os sirve.";
                else advice = "¡No pienso asumir este daño sin mis escudos a tope!";
            } else if (currentPersonality === 'Cooperativo') {
                advice = "Si alguien corre peligro mortal, decídmelo y levantaré yo la mano.";
                if (isHealthy) advice = "💪 Estoy en plenas facultades. ¡Dejadme asumir este golpe para protegeros!";
            }

            if (isLowHp && currentPersonality !== 'Cooperativo') {
                advice = "⚠️ ¡Estoy crítico! Si recibo más daño caeré inconsciente. Que alguien más lo reciba, por favor.";
            }

            const pColor = this.getPersonalityColor(currentPersonality);
            this.showBubble(pIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> ${advice}`);
        });
    }

    handleCombatAdvice() {
        this.activeBots.forEach((bot) => {
            const pIndex = this.gameState.players.findIndex(p => p.id === bot.id);
            const currentPersonality = this.getPersonalityForDecision(bot);
            let advice = "";
            
            const isBotInCombat = this.gameState.currentCombat && this.gameState.players[this.gameState.currentPlayerIndex].id === bot.id;
            const unusedDice = isBotInCombat ? this.gameState.currentCombat.playerDice.filter(d => !d.assignedTo) : [];
            const roleReady = bot.energy > 0;
            const hasActiveEquip = bot.equipped.some(eq => eq.isActive && !eq.isBroken);

            if (currentPersonality === 'Agresivo') {
                if (unusedDice.length > 0) advice = "¡Tengo dados libres! Asignadlos al arma que haga más daño contra el nivel más alto.";
                else advice = "¡Matadlos a todos! No dejéis ninguno vivo.";
            } else if (currentPersonality === 'Conservador') {
                if (unusedDice.length > 0) advice = "Aseguraos de poner dados primero en mis escudos, por si algo sale mal.";
                else advice = "Concéntrate en eliminar a los Goblins que hagan más daño, no quiero que me toquen.";
            } else if (currentPersonality === 'Cooperativo') {
                if (roleReady && unusedDice.length > 0) advice = `⚡ ¡Tengo mi habilidad de rol lista y un dado libre! Úsala si nos beneficia.`;
                else if (unusedDice.length > 0) advice = "Tengo dados libres. Si te faltan valores altos, arrástralos a tu lado.";
                else advice = "¡Confiamos en tu estrategia para ganar este combate!";
            }

            const pColor = this.getPersonalityColor(currentPersonality);
            this.showBubble(pIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> ${advice}`);
        });
    }

    handlePlayerTurnAdvice() {
        const activePlayer = this.gameState.getCurrentPlayer();
        if (!activePlayer || activePlayer.isBot) return;

        const goblinsEnMesa = this.gameState.battlefield.goblins.length;
        const activeLowHp = activePlayer.hp <= (activePlayer.maxHp * 0.35);
        const activeNoEnergy = activePlayer.energy === 0;

        this.activeBots.forEach((bot) => {
            const pIndex = this.gameState.players.findIndex(p => p.id === bot.id);
            const currentPersonality = this.getPersonalityForDecision(bot);
            let advice = "";
            
            if (currentPersonality === 'Agresivo') {
                if (goblinsEnMesa >= 1) advice = "¡Entra en Combate! No dejes que esos asquerosos Goblins respiren.";
                else advice = "La mesa está limpia. ¡Avanza para encontrar más enemigos rápido!";
            } else if (currentPersonality === 'Conservador') {
                if (activeLowHp) advice = "¡Cuidado con tu vida! Deberías usar tu acción para curarte con algo o cobrar oro seguro.";
                else if (goblinsEnMesa >= 3) advice = "Mucha presión en la mesa... Prioriza limpiar Goblins antes de que sea tarde.";
                else advice = "Mantente a salvo. Si cobras oro, asegúrate de no sufrir daño.";
            } else if (currentPersonality === 'Cooperativo') {
                if (activeLowHp && bot.role.id === 'sanador' && bot.energy >= 2) advice = "¡Estás fatal! Si aguantas, podré usar mi curación en mi turno.";
                else if (activeNoEnergy) advice = "Tener tu habilidad lista nos salva de apuros. Deberías Rellenar Rol.";
                else advice = "Recuerda que si combates, puedes invitarme a mí o a otros para ayudar.";
            }

            const pColor = this.getPersonalityColor(currentPersonality);
            this.showBubble(pIndex, `<strong style="color: ${pColor};">[${currentPersonality}]</strong> ${advice}`);
        });
    }
}

window.BotManager = BotManager;
