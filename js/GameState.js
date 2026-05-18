class GameState {
  constructor() {
    this.players = [];
    this.currentPlayerIndex = 0;

    this.market = {
      ataque: [...DB.equipment.ataque, ...DB.equipment.ataque],
      escudos: [...DB.equipment.escudos, ...DB.equipment.escudos],
      curacion: [...DB.equipment.curacion, ...DB.equipment.curacion]
    };

    this.battlefield = {
      waveLevel: 1,
      actionCount: 0, // 3 actions per player per wave
      goblins: []
    };

    this.currentCombat = null;
    this.isMarketPhase = false;
    this.currentHito = 1;
    this.isRetaliationPhase = false;
    this.retaliationQueue = [];
    this.isGameOver = false;
    this.lastCombatId = 0;
    this.lastActionWasCombat = false;

    // Log de acciones
    this.logs = [];

    // Barajamos el mercado
    this.shuffleDecks();
  }

  addLog(msg) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.logs.push(`[${time}] ${msg}`);
    // Mantener un límite razonable para no consumir memoria infinita
    if (this.logs.length > 200) this.logs.shift();
  }

  checkGameOver() {
    if (this.players.length > 0 && !this.players.some(p => p.hp > 0)) {
      this.isGameOver = true;
      this.addLog(`🛑 <span style="color: #e63946;"><strong>PARTIDA FINALIZADA</strong></span>: El grupo ha sido derrotado.`);
      return true;
    }
    return false;
  }

  // Utils para dados
  rollDice(faces = 6) {
    return Math.floor(Math.random() * faces) + 1;
  }

  rollGreenDice(goblin) {
    let total = 0;
    let details = [];
    for (let part of goblin.dice) {
      if (part.includes('d')) {
        let parts = part.split('d');
        let count = parseInt(parts[0]) || 1;
        let faces = parseInt(parts[1]);
        for (let c = 0; c < count; c++) {
          let val = this.rollDice(faces);
          total += val;
          details.push({ type: 'die', faces: faces, val: val });
        }
      } else {
        let mod = parseInt(part);
        total += mod;
        details.push({ type: 'mod', val: mod });
      }
    }
    return { total, details };
  }

  startCombat(selectedGoblins) {
    if (this.isMarketPhase || !selectedGoblins || selectedGoblins.length === 0) return false;

    let validGoblins = selectedGoblins.map(g => this.battlefield.goblins.find(bg => bg.uid === g.uid)).filter(g => g);
    if (validGoblins.length === 0) return false;

    let p = this.players[this.currentPlayerIndex];
    let combatData = {
      goblins: validGoblins,
      originalStatus: { ...p.statusEffects }, // Snapshot para restaurar si se cancela
      playerDice: p.dicePool.map((d, index) => ({
        ...d,
        id: `die-${index}`,
        value: this.rollDice(d.faces),
        rerolled: false,
        assignedTo: null
      })),
      dice: {
        green: {}
      }
    };

    validGoblins.forEach(goblin => {
      combatData.dice.green[goblin.uid] = this.rollGreenDice(goblin);
    });

    // APLICAR ESTADOS DIFERIDOS (Tembleque > Escozor)
    let redDice = combatData.playerDice.filter(d => d.type === 'red');

    // 1. Prioridad: TEMBLEQUE (Pone el dado a 1)
    if (p.statusEffects.tembleque > 0) {
      let count = 0;
      for (let i = 0; i < p.statusEffects.tembleque && i < redDice.length; i++) {
        redDice[i].value = 1;
        redDice[i].isShaking = true;
        count++;
      }
      p.statusEffects.tembleque -= count;
    }

    // 2. Prioridad: ESCOZOR (Marca el dado pero no cambia valor)
    // 2. Prioridad: ESCOZOR (Marca el dado pero no cambia valor)
    // Solo se aplica a dados rojos que no tengan ya Tembleque
    if (p.statusEffects.escozor > 0) {
      let cleanRedDice = redDice.filter(d => !d.isShaking);
      let count = 0;
      for (let i = 0; i < p.statusEffects.escozor && i < cleanRedDice.length; i++) {
        cleanRedDice[i].isStung = true;
        count++;
      }
      // Se consume el escozor aplicado, el resto se guarda
      p.statusEffects.escozor -= count;
    }

    // 3. Prioridad: CALAMBRE (Afecta a dados negros, D6 antes que D4)
    if (p.statusEffects.calambre > 0) {
      let blackDice = combatData.playerDice.filter(d => d.type === 'black');
      // Ordenar: D6 (faces=6) antes que D4 (faces=4)
      blackDice.sort((a, b) => b.faces - a.faces);

      let count = 0;
      for (let i = 0; i < p.statusEffects.calambre && i < blackDice.length; i++) {
        blackDice[i].isCramped = true;
        blackDice[i].rerolled = true; // No se puede relanzar
        count++;
      }
      p.statusEffects.calambre -= count;
      if (count > 0) {
        combatData.needsCrampResolution = true;
      }
    }

    this.currentCombat = combatData;
    this.isCombat = true;
    p = this.players[this.currentPlayerIndex];
    let targetNames = validGoblins.map(t => 'G' + t.level).join(' + ');
    this.addLog(`<strong>${p.name}</strong> inició un combate contra: ${targetNames}.`);
    return true;
  }

  rerollDie(dieId) {
    if (this.currentCombat) {
      let die = this.currentCombat.playerDice.find(d => d.id === dieId);
      if (die && die.type === 'black' && !die.rerolled) {
        die.value = this.rollDice(die.faces);
        die.rerolled = true;
        return die.value;
      }
    }
    return null;
  }

  cancelCombat() {
    if (this.currentCombat && this.currentCombat.originalStatus) {
      const p = this.players[this.currentPlayerIndex];
      p.statusEffects = { ...this.currentCombat.originalStatus };
    }
    this.currentCombat = null;
  }

  resolveCombat(assignments, interceptions = {}) {
    this.lastCombatId++;
    this.lastActionWasCombat = true;
    let p = this.getCurrentPlayer();
    let c = this.currentCombat;

    if (c && c.goblins) {
      if (!p.goblinsFoughtThisTurn) p.goblinsFoughtThisTurn = [];
      c.goblins.forEach(g => {
        if (!p.goblinsFoughtThisTurn.includes(g.uid)) {
          p.goblinsFoughtThisTurn.push(g.uid);
        }
      });
    }

    let damagePerTarget = {};
    let playerHeal = 0;

    for (let eqId in assignments) {
      let asgData = assignments[eqId];
      // Convertir a array si no lo es (para compatibilidad)
      let asgList = Array.isArray(asgData) ? asgData : [asgData];

      asgList.forEach(asg => {
        if (asg.isRole) {
          let dieVal = asg.value;
          let gainedEnergy = p.role.energyRates[dieVal - 1] || 0;
          p.energy += gainedEnergy;
          return; // equivale a continue en forEach
        }

        let eq = p.equipped.find(e => e.id === eqId);
        if (!eq) return;
        eq.usedInCombatId = this.lastCombatId;

        let targetUid = asg.targetUid;
        if (targetUid && !damagePerTarget[targetUid]) {
          damagePerTarget[targetUid] = { damage: 0, shield: 0 };
        }

        // Aplicar el efecto usando la lógica específica
        let healObj = { heal: 0 };
        this.applyEquipmentEffect(p, eq, asg, damagePerTarget, healObj);
        playerHeal += healObj.heal;
      });
    }

    // Procesar cada goblin en el combate
    let goblinsDefeated = 0;

    c.goblins.forEach(targetGoblin => {
      let targetUid = targetGoblin.uid;
      let stats = damagePerTarget[targetUid] || { damage: 0, shield: 0 };
      let msgParts = [];

      // Aplicar Daño al Goblin
      if (stats.damage > 0) {
        targetGoblin.currentHp -= stats.damage;
        msgParts.push(`inflige ${stats.damage} daño a G${targetGoblin.level}`); //targetGoblin.name
      }

      // El Goblin contraataca
      let greenDiceResult = c.dice.green[targetUid];
      let goblinDmg = greenDiceResult ? greenDiceResult.total : 1;

      // Buscar efectos especiales y procesar intercepciones por dado
      let gobDB = DB.goblins[targetGoblin.level];
      let goblinInterceptions = interceptions[targetUid] || []; // Ahora es un array
      let allSpecialAttacks = [];

      if (greenDiceResult && greenDiceResult.details) {
        let naturalDieIdx = 0;
        greenDiceResult.details.forEach((detail, rawIdx) => {
          if (detail.type === 'die') {
            const isIntercepted = goblinInterceptions.some(asg => asg.goblinDieIndex === naturalDieIdx);

            if (isIntercepted) {
              goblinDmg -= detail.val;
              let modMsg = "";

              // OPCIÓN B: Anular modificador adyacente si existe
              const nextDetail = greenDiceResult.details[rawIdx + 1];
              if (nextDetail && nextDetail.type === 'mod') {
                goblinDmg -= nextDetail.val;
                modMsg = ` y su modificador de +${nextDetail.val}`;
              }

              this.addLog(`🛡️ Un dado natural de <strong>${detail.val}</strong>${modMsg} de G${targetGoblin.level} fue interceptado.`);
            }

            // Incrementar contador de dados naturales para la siguiente iteración
            let currentNaturalIdx = naturalDieIdx;
            naturalDieIdx++;

            // Procesar ataques especiales del dado
            let rollVal = detail.val;
            let attacksForThisDie = (gobDB && gobDB.attacks) ? (gobDB.attacks[rollVal] || []) : [];

            attacksForThisDie.forEach(eff => {
              const effLow = eff.toLowerCase();
              const isUnskippable = effLow === 'rotura no esquivable';
              const isNormalBreak = effLow === 'rotura';
              const isStatus = effLow.includes('escozor') || effLow.includes('tembleque') || effLow.includes('calambre');

              // La Rotura no esquivable se aplica SIEMPRE.
              // El resto solo si NO está interceptado ese dado específico.
              if (isUnskippable || (!isIntercepted && (isNormalBreak || isStatus))) {
                if (isUnskippable || isNormalBreak) {
                  this.breakRandomEquipment(p);
                } else if (effLow.includes('escozor')) {
                  p.statusEffects.escozor = (p.statusEffects.escozor || 0) + 1;
                  this.addLog(`🔥 <strong>${p.name}</strong> ha recibido <span style="color:#ff6600">ESCOZOR</span>.`);
                } else if (effLow.includes('tembleque')) {
                  p.statusEffects.tembleque = (p.statusEffects.tembleque || 0) + 1;
                  this.addLog(`🌀 <strong>${p.name}</strong> ha recibido <span style="color:#99ccff">TEMBLEQUE</span>.`);
                } else if (effLow.includes('calambre')) {
                  p.statusEffects.calambre = (p.statusEffects.calambre || 0) + 1;
                  this.addLog(`⚡ <strong>${p.name}</strong> ha recibido <span style="color:#ffcc00">CALAMBRE</span>.`);
                }
              } else if (effLow.includes('lanza +')) {
                // El daño extra de un dado NO interceptado se suma
                if (!isIntercepted) {
                  const dieMatch = effLow.match(/(\d*)d(\d+)/);
                  if (dieMatch) {
                    const num = parseInt(dieMatch[1]) || 1;
                    const faces = parseInt(dieMatch[2]);
                    let extraDmg = 0;
                    for (let i = 0; i < num; i++) extraDmg += this.rollDice(faces);
                    goblinDmg += extraDmg;
                    this.addLog(`🎲 ¡G${targetGoblin.level} lanza un dado extra y suma <span style="color:#ff4d4d">${extraDmg} de daño</span>!`);
                  }
                }
              }

              // Recoger todos los efectos para saber si es daño directo al final
              allSpecialAttacks.push(eff);
            });
          }
        });
      }

      // Antes de aplicar el efecto del jugador, verificamos si el dado usado ya tenía Escozor
      // Nota: Si el escozor se recibe en este mismo contraataque, afectará a futuras aplicaciones
      // pero si el dado ya estaba marcado por un goblin anterior, el daño se aplica ahora.
      for (let eqId in assignments) {
        let asgs = assignments[eqId];
        if (!Array.isArray(asgs)) asgs = [asgs];

        asgs.forEach(asg => {
          if (asg.targetUid === targetUid) {
            let dieData = c.playerDice.find(d => d.id === asg.dieId);
            if (dieData && dieData.isStung && !dieData.stungDamageApplied) {
              p.hp = Math.max(0, p.hp - 2);
              dieData.stungDamageApplied = true; // Evitar daño doble si el dado se procesa varias veces
              this.addLog(`🔥 <strong>${p.name}</strong> usó un dado con escozor y <span style="color:#ff4d4d">sufrió 2 daño</span>!`);
            }
          }
        });
      }

      let isDirect = allSpecialAttacks.includes('Daño Directo');

      if (isDirect) {
        if (goblinDmg > 0) {
          p.hp = Math.max(0, p.hp - goblinDmg);
          msgParts.push(`<span style="color:#ff4d4d">sufre ${goblinDmg} Daño Directo</span>`);
        }
      } else {
        // Restar escudos
        let totalShield = stats.shield + (p.shield || 0);
        if (totalShield > 0) {
          msgParts.push(`bloquea ${totalShield} daño`);
          goblinDmg -= totalShield;
        }

        if (goblinDmg > 0) {
          p.hp = Math.max(0, p.hp - goblinDmg);
          msgParts.push(`<span style="color:#ff4d4d">sufre ${goblinDmg} daño</span>`);
        } else if (goblinInterceptions.length > 0) {
          msgParts.push(`anula el ataque de G${targetGoblin.level} gracias a la intercepción`);
        } else {
          msgParts.push(`anula el contraataque de G${targetGoblin.level}`);
        }
      }

      if (msgParts.length > 0) {
        this.addLog(`Frente a G${targetGoblin.level}: <strong>${p.name}</strong> ${msgParts.join(' y ')}.`);
      } else {
        this.addLog(`Frente a G${targetGoblin.level}: <strong>${p.name}</strong> no hizo nada y <span style="color:#ff4d4d">sufrió ${goblinDmg} daño</span>.`);
      }

      if (targetGoblin.currentHp <= 0) {
        // Goblin derrotado
        goblinsDefeated++;
        if (targetGoblin.isHito || targetGoblin.level >= p.level) {
          p.mo += targetGoblin.mo;
          this.ganarPex(targetGoblin.pex);
          this.addLog(`⚔️ <strong>${p.name}</strong> eliminó a G${targetGoblin.level}. Recompensa: ${targetGoblin.mo} mo, ${targetGoblin.pex} PEX.`); //targetGoblin.name
        } else {
          this.addLog(`⚔️ <strong>${p.name}</strong> eliminó a G${targetGoblin.level}. Sin Recompensa.`); //targetGoblin.name
        }
      }
    });

    // Aplicar curación
    if (playerHeal > 0) {
      p.hp += playerHeal;
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      this.addLog(`💖 <strong>${p.name}</strong> se curó ${playerHeal} HP (Total: ${p.hp}/${p.maxHp}).`);
    }

    // Check level up (10 pex = 1 level)
    this.subirNivel(p);

    // Marcar derrotados para animación en lugar de filtrarlos inmediatamente
    this.battlefield.goblins.forEach(g => {
      if (g.currentHp <= 0 && !g.isDying) {
        g.isDying = true;
        // El goblin da recompensa si es Hito o si su nivel >= nivel de los jugadores
        const p = this.players[this.currentPlayerIndex];
        if (g.isHito || g.level >= p.level) {
          g.gaveReward = true;
        }
      }
    });

    p.shield = 0; // Limpiar escudo tras el combate
    this.currentCombat = null;
    this.checkGameOver();
    this.postActionPhase();
  }

  shuffleDecks() {
    for (let type in this.market) {
      this.market[type].sort(() => Math.random() - 0.5);
    }
  }

  setupPlayers(numPlayers, selectedRoles = [], customSettings = { hp: 10, maxHp: 10, energy: 0, mo: 2, hito: 1, level: 1 }) {
    this.currentHito = customSettings.hito !== undefined ? customSettings.hito : 1;
    let initLvl = customSettings.level !== undefined ? customSettings.level : 1;
    let basePex = 0;
    if (initLvl === 2) basePex = 2;
    if (initLvl === 3) basePex = 6;
    if (initLvl === 4) basePex = 12;
    let pendingChoices = initLvl > 1 ? initLvl - 1 : 0;

    this.players = [];
    for (let i = 0; i < numPlayers; i++) {
      let roleId = selectedRoles[i] || 'guerrero';
      let roleObj = DB.roles.find(r => r.id === roleId) || DB.roles[0];

      this.players.push({
        id: i + 1,
        name: `Jugador ${i + 1}`,
        hp: customSettings.hp,
        maxHp: customSettings.maxHp !== undefined ? customSettings.maxHp : customSettings.hp,
        mo: customSettings.mo,
        pex: basePex,
        level: initLvl,
        shield: 0,
        role: roleObj,
        energy: customSettings.energy,
        equipped: [
          { ...DB.equipment.inicial[0], isBroken: false, isActive: true },
          { ...DB.equipment.inicial[1], isBroken: false, isActive: true }
        ],
        statusEffects: { escozor: 0, calambre: 0, tembleque: 0 },
        dicePool: [
          { type: 'red', faces: 6 },
          { type: 'black', faces: 6 }
        ],
        pendingLevelUpChoices: pendingChoices,
        pendingLevelUpChoice: pendingChoices > 0,
        goblinsFoughtThisTurn: []
      });
    }
    this.battlefield.waveLevel = customSettings.wave !== undefined ? customSettings.wave : 1;
    this.currentPlayerIndex = 0;
    this.spawnInitialGoblins();
    this.addLog(`¡La aventura comienza en la Oleada ${this.battlefield.waveLevel}! Fase de Mercado.`);
  }

  spawnInitialGoblins() {
    for (let i = 0; i < this.players.length; i++) {
      this.battlefield.goblins.push({
        ...DB.goblins[1],
        uid: Date.now() + i,
        currentHp: DB.goblins[1].hp
      });
    }
    // Si empieza en una oleada avanzada, generar el enemigo de oleada correspondiente
    if (this.battlefield.waveLevel > 1) {
      let nivelMaximoBD = 5;
      let nivelAparecer = Math.min(this.battlefield.waveLevel, nivelMaximoBD);
      if (DB.goblins[nivelAparecer]) {
        this.battlefield.goblins.push({
          ...DB.goblins[nivelAparecer],
          uid: Date.now() + 1000,
          currentHp: DB.goblins[nivelAparecer].hp
        });
      }
    }
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextTurn() {
    const prevIndex = this.currentPlayerIndex;
    this.isMarketPhase = false;
    this.currentPlayerIndex++;
    if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
      this.battlefield.actionCount++;

      if (this.battlefield.actionCount >= 3) {
        this.resolveWavePhase();
      }
    }
    if (this.currentPlayerIndex !== prevIndex) {
      this.lastActionWasCombat = false;
      if (this.players[this.currentPlayerIndex]) {
        this.players[this.currentPlayerIndex].goblinsFoughtThisTurn = [];
      }
    }
  }

  consumeAction() {
    this.postActionPhase();
  }

  postActionPhase() {
    let p = this.getCurrentPlayer();
    let canBuy = false;

    // 1. Comprobar equipos en el mercado
    for (let type in this.market) {
      if (this.market[type].length > 0) {
        let topCard = this.market[type][0];
        if (p.mo >= topCard.cost) {
          canBuy = true;
          break;
        }
      }
    }

    // 2. Comprobar pociones si están desbloqueadas (Oleada 3+) y el jugador necesita curación
    if (!canBuy && this.battlefield.waveLevel >= 3 && p.hp < p.maxHp) {
      if (DB.equipment.pociones.some(poc => p.mo >= poc.cost)) {
        canBuy = true;
      }
    }

    // 3. Comprobar si puede explorar el mercado (al menos 1 moneda)
    if (!canBuy && p.mo >= 1) {
      canBuy = true;
    }

    // 4. Comprobar si tiene energía para usar su rol
    if (!canBuy && p.energy > 0) {
      canBuy = true;
    }

    if (canBuy) {
      this.isMarketPhase = true;
    } else {
      this.nextTurn();
    }
  }

  buyFromMarket(type) {
    let p = this.getCurrentPlayer();
    let deck = this.market[type];

    if (deck && deck.length > 0) {
      let card = deck[0];

      // Comprobar si tiene dinero
      if (p.mo < card.cost) return false;

      p.mo -= card.cost;

      const currentBlocks = this.getPlayerBlocks(p);
      const maxBlocks = DB.playerLevels[p.level - 1].blocks;
      const hasDuplicate = p.equipped.some(eq => eq.id === card.id && eq.isActive);

      // Solo entra activo si hay espacio Y no es un duplicado de uno ya activo
      const canFit = (currentBlocks + card.blocks <= maxBlocks) && !hasDuplicate;

      p.equipped.push({ ...card, isBroken: false, isActive: canFit });

      if (canFit) {
        this.addLog(`<strong>${p.name}</strong> compró y EQUIPÓ <em>${card.name}</em> por ${card.cost} mo.`);
      } else {
        const reason = hasDuplicate ? "(duplicado)" : "(sin espacio)";
        this.addLog(`<strong>${p.name}</strong> compró <em>${card.name}</em> por ${card.cost} mo. Se ha guardado en la mochila ${reason}.`);
      }

      deck.shift();

      // Al comprar, entramos en fase de mercado (bloquea acciones) y evaluamos si puede seguir comprando
      this.isMarketPhase = true;
      this.postActionPhase();
      return true;
    }
    return false;
  }

  getPlayerBlocks(p) {
    return p.equipped.reduce((sum, eq) => sum + (eq.isActive ? (eq.blocks || 0) : 0), 0);
  }

  toggleEquipment(playerIndex, eqIndex) {
    const p = this.players[playerIndex];
    const eq = p.equipped[eqIndex];
    if (!eq) return false;

    if (!eq.isActive) {
      // 1. Comprobar si ya hay uno igual activo
      const isDuplicateActive = p.equipped.some(item => item.id === eq.id && item.isActive);
      if (isDuplicateActive) {
        return "DUPLICATE_ACTIVE";
      }

      // 2. Comprobar peso
      const currentBlocks = this.getPlayerBlocks(p);
      const maxBlocks = DB.playerLevels[p.level - 1].blocks;
      if (currentBlocks + eq.blocks > maxBlocks) {
        return "OVERWEIGHT";
      }
      eq.isActive = true;
      this.addLog(`🎒 <strong>${p.name}</strong> ha equipado <em>${eq.name}</em>.`);
    } else {
      // Desactivar: siempre permitido
      eq.isActive = false;
      this.addLog(`📦 <strong>${p.name}</strong> ha guardado <em>${eq.name}</em> en la mochila.`);
    }
    return true;
  }

  buyPotion(id) {
    let p = this.getCurrentPlayer();
    let potion = DB.equipment.pociones.find(poc => poc.id === id);

    if (potion && p.mo >= potion.cost) {
      p.mo -= potion.cost;

      let amount = 0;
      const effectStr = potion.effect.toLowerCase();

      // Parser genérico: extraemos la fórmula (ej: "4 + 2d4")
      let formula = effectStr.replace(/cura|recupera|pv|energía|energia/g, '').trim();
      const parts = formula.split('+');

      parts.forEach(part => {
        part = part.trim();
        if (part.includes('d')) {
          const [numStr, facesStr] = part.split('d');
          const num = parseInt(numStr) || 1;
          const faces = parseInt(facesStr) || 6;
          for (let i = 0; i < num; i++) {
            amount += this.rollDice(faces);
          }
        } else {
          amount += (parseInt(part) || 0);
        }
      });

      // Aplicar curación de PV (todas las pociones son de PV)
      p.hp = Math.min(p.maxHp, p.hp + amount);
      this.addLog(`🧪 <strong>${p.name}</strong> usó <em>${potion.name}</em> y recuperó ${amount} PV.`);

      return amount; // Devolvemos la cantidad para feedback visual
    }
    return null;
  }

  deployHito() {
    if (this.currentHito > 5) return false;

    // Validar que no haya Goblins de Hito activos
    if (this.battlefield.goblins.some(g => g.isHito)) {
      this.addLog("⚠️ No se puede desplegar un nuevo Hito mientras haya Goblins de Hito en la mesa.");
      return false;
    }

    let hito = DB.hitos.iniciacion[this.currentHito - 1];

    if (hito.isBoss) {
      let bossHp = hito.bossStats.hpMultiplier * this.players.length;
      this.battlefield.goblins.push({
        ...DB.goblins[5],
        uid: Date.now() + Math.random(),
        currentHp: bossHp,
        maxHp: bossHp,
        isBoss: true,
        isHito: true,
        name: hito.name,
        dice: hito.bossStats.dice,
        image: hito.bossStats.image || 'assets/Monstruos/Jefes/Inicicion.jpg'
      });
    } else {
      for (let p = 0; p < this.players.length; p++) {
        for (let lvl of hito.goblins) {
          this.battlefield.goblins.push({
            ...DB.goblins[lvl],
            uid: Date.now() + Math.random(),
            currentHp: DB.goblins[lvl].hp,
            isHito: true
          });
        }
      }
    }
    this.currentHito++;
    let hitoName = DB.hitos.iniciacion[this.currentHito - 2].name;
    this.addLog(`🔥 <strong>HITO DESPLEGADO: ${hitoName}</strong> 🔥`);
    return true;
  }

  resolveWavePhase() {
    this.selectedGoblins = [];

    // Filtramos los que NO están muriendo para la represalia
    const activeGoblins = this.battlefield.goblins.filter(g => !g.isDying);

    if (activeGoblins.length > 0) {
      // Si no queda nadie vivo, no hay represalia posible, avanzamos
      if (!this.players.some(p => p.hp > 0)) {
        this.addLog(`💀 Todos los jugadores han caído. Los goblins campan a sus anchas...`);
        this.completeWaveAdvancement();
        return;
      }

      this.isRetaliationPhase = true;
      this.retaliationQueue = [...activeGoblins];
      this.addLog(`⚠️ <span style="color: #e63946;"><strong>¡REPRESALIA!</strong></span> Los ${activeGoblins.length} goblins restantes atacan.`);
      return; // Esperamos a que los jugadores asignen el daño
    }

    this.completeWaveAdvancement();
  }

  assignRetaliationDamage(goblinUid, playerIndex) {
    const gobIdx = this.retaliationQueue.findIndex(g => g.uid == goblinUid);
    if (gobIdx === -1) return false;

    const goblin = this.retaliationQueue[gobIdx];
    const player = this.players[playerIndex];

    if (player) {
      const damage = goblin.level;
      player.hp = Math.max(0, player.hp - damage);
      this.addLog(`💀 <strong>Represalia:</strong> Causó ${damage} daño a <strong>${player.name}</strong>.`);

      // Eliminar de la cola
      this.retaliationQueue.splice(gobIdx, 1);

      if (this.checkGameOver()) {
        this.isRetaliationPhase = false;
        return true;
      }
      const anyAlive = this.players.some(p => p.hp > 0);
      if (this.retaliationQueue.length === 0 || !anyAlive) {
        this.isRetaliationPhase = false;
        this.completeWaveAdvancement();
      }
      return true;
    }
    return false;
  }

  completeWaveAdvancement() {
    this.battlefield.actionCount = 0;
    this.battlefield.waveLevel++;

    this.addLog(`<span style="color:#f54281"><strong>*******************************************</strong></span>`);
    this.addLog(`<span style="color:#f54281"><strong>RESOLVIENDO FASE DE OLEADA ${this.battlefield.waveLevel} </strong></span>`);

    let counts = {};

    // El bucle evalúa la mesa en tiempo real
    for (let lvl = 1; lvl < 5; lvl++) {
      // 1. Separamos los índices de los goblins del nivel actual según su tipo
      let idxNormales = [];
      let idxHitos = [];

      this.battlefield.goblins.forEach((g, index) => {
        //reset de los PV
        g.currentHp = g.hp;
        if (g.level === lvl) {
          if (g.isHito) {
            idxHitos.push(index);
          } else {
            idxNormales.push(index);
          }
        }
      });

      let paresCrearNormal = 0;
      let paresCrearHito = 0;
      let indicesAeliminar = [];

      // 2. Prioridad 1: Fusionar Hito con Oleada -> Produce GSuperior Normal
      while (idxHitos.length > 0 && idxNormales.length > 0) {
        indicesAeliminar.push(idxHitos.pop());
        indicesAeliminar.push(idxNormales.pop());
        paresCrearNormal++;
        this.addLog(`🔥 <span style="color:#f54281"><strong>Mutación:</strong></span> <span style="color:#a545d1">G${lvl}</span> + G${lvl} --> G${lvl + 1}`);
      }

      // 3. Prioridad 2: Fusionar Oleada con Oleada -> Produce GSuperior Normal
      while (idxNormales.length >= 2) {
        indicesAeliminar.push(idxNormales.pop());
        indicesAeliminar.push(idxNormales.pop());
        paresCrearNormal++;
        this.addLog(`🔥 <span style="color:#f54281"><strong>Mutación:</strong></span> G${lvl} + G${lvl} --> G${lvl + 1}`);
      }

      // 4. Prioridad 3: Fusionar Hito con Hito -> Produce GSuperior Hito
      while (idxHitos.length >= 2) {
        indicesAeliminar.push(idxHitos.pop());
        indicesAeliminar.push(idxHitos.pop());
        paresCrearHito++;
        this.addLog(`🔥 <span style="color:#f54281"><strong>Mutación:</strong></span> <span style="color:#a545d1">G${lvl}</span> + <span style="color:#a545d1">G${lvl}</span> --> <span style="color:#a545d1">G${lvl + 1}</span>`);
      }

      // 5. Eliminar los originales consumidos en la mesa
      indicesAeliminar.sort((a, b) => b - a);
      indicesAeliminar.forEach(idx => {
        this.battlefield.goblins.splice(idx, 1);
      });

      // 6. Añadir los evolucionados de Oleada (Normales)
      for (let i = 0; i < paresCrearNormal; i++) {
        this.battlefield.goblins.push({
          ...DB.goblins[lvl + 1],
          uid: Date.now() + Math.random(),
          currentHp: DB.goblins[lvl + 1].hp,
          isMutated: true
        });
      }

      // 7. Añadir los evolucionados de Hito
      for (let i = 0; i < paresCrearHito; i++) {
        this.battlefield.goblins.push({
          ...DB.goblins[lvl + 1],
          uid: Date.now() + Math.random(),
          currentHp: DB.goblins[lvl + 1].hp,
          isHito: true,
          isMutated: true
        });
      }
    }

    // Aparición de nuevos enemigos de nivel 1
    for (let i = 0; i < this.players.length; i++) {
      this.battlefield.goblins.push({
        ...DB.goblins[1],
        uid: Date.now() + Math.random(),
        currentHp: DB.goblins[1].hp
      });
    }
    this.addLog(`🔥 <span style="color:#f54281"><strong>Aparición:</strong></span> ${this.players.length} x G1`);

    // Aparición de nuevos enemigos de nivel de la oleada
    let nivelMaximoBD = 5;
    let nivelAparecer = Math.min(this.battlefield.waveLevel, nivelMaximoBD);

    if (DB.goblins[nivelAparecer]) {
      this.battlefield.goblins.push({
        ...DB.goblins[nivelAparecer],
        uid: Date.now() + Math.random(),
        currentHp: DB.goblins[nivelAparecer].hp
      });
      this.addLog(`🔥 <span style="color:#f54281"><strong>Aparición:</strong></span> 1 x G${nivelAparecer}`);
    }

    // Regeneración de Jefes en la mesa
    this.battlefield.goblins.forEach(g => {
      if (g.isBoss && g.currentHp > 0) {
        let regenAmount = (g.regen || 5) * this.players.length;
        g.currentHp = Math.min(g.maxHp, g.currentHp + regenAmount);
        this.addLog(`💖 <span style="color:#ff477e"><strong>Regeneración de Jefe:</strong></span> ${g.name} recuperó ${regenAmount} PV (Total: ${g.currentHp}/${g.maxHp}).`);
      }
    });

    this.addLog(`<span style="color:#f54281"><strong>*******************************************</strong></span>`);
  }

  // MÉTODOS DE ACCIÓN BÁSICOS

  performActionGold() {
    if (this.isMarketPhase) return false;
    this.lastActionWasCombat = false;
    let p = this.players[this.currentPlayerIndex];
    p.mo += 1;
    this.addLog(`<strong>${p.name}</strong> cobró 1 mo.`);
    this.consumeAction();
    return true;
  }

  performActionGoldAndDamage() {
    if (this.isMarketPhase) return false;
    this.lastActionWasCombat = false;
    let p = this.players[this.currentPlayerIndex];
    p.mo += 2;
    p.hp = Math.max(0, p.hp - 1);
    this.addLog(`<strong>${p.name}</strong> cobró 2 mo pero sufrió 1 daño (HP: ${p.hp}/${p.maxHp}).`);

    if (this.checkGameOver()) return true;

    this.consumeAction();
    return true;
  }

  performActionRole() {
    if (this.isMarketPhase) return false;
    this.lastActionWasCombat = false;
    let p = this.players[this.currentPlayerIndex];
    let fill = p.role.energyPerAction;
    p.energy += fill;
    this.addLog(`<strong>${p.name}</strong> rellenó su Rol (+${fill} Energía).`);
    this.consumeAction();
    return true;
  }

  useRoleAbility(playerIndex, targetId = null, energyCost = null) {
    let p = this.players[playerIndex];
    const roleId = p.role.id;

    // Si no hay objetivo, pedimos objetivo mediante el modal
    if (targetId === null) {
      return "NEED_TARGET";
    }

    let isSelf = (targetId === 'self' || targetId === playerIndex);

    // Si no se pasa el coste, lo calculamos (1 propio, 2 ajeno - excepto ataques que valen 1)
    if (energyCost === null) {
      const roleId = p.role.id;
      if (roleId === 'guerrero' || roleId === 'mago') {
        energyCost = 1;
      } else {
        energyCost = isSelf ? 1 : 2;
      }
    }

    if (p.energy < energyCost) return false;

    if (roleId === 'ladron') {
      let targetP = isSelf ? p : (typeof targetId === 'number' ? this.players[targetId] : null);
      if (targetP && !isSelf) {
        p.energy -= energyCost;
        targetP.mo += 1;
        this.addLog(`⚡ <strong>${p.name}</strong> usó su rol (Ladrón) para dar 1 mo a ${targetP.name}.`);
        return true;
      } else {
        p.energy -= energyCost;
        p.mo += 1;
        this.addLog(`⚡ <strong>${p.name}</strong> usó su rol (Ladrón) para obtener 1 mo.`);
        return true;
      }
    }
    else if (roleId === 'guerrero' || roleId === 'mago') {
      let gob = this.battlefield.goblins.find(g => g.uid === targetId);
      if (gob && gob.currentHp > 0) {
        // Restricción Mago: Nunca puede eliminar el último punto de vida de un goblin
        if (roleId === 'mago' && gob.currentHp === 1) {
          return false;
        }
        if (roleId === 'guerrero') {
          const isInCombat = this.currentCombat && this.currentCombat.goblins.some(cg => cg.uid === gob.uid);
          const wasFought = (p.goblinsFoughtThisTurn && p.goblinsFoughtThisTurn.includes(gob.uid)) || isInCombat;
          if (!wasFought) return false;
        }
        p.energy -= energyCost;
        gob.currentHp -= 1;
        this.addLog(`⚡ <strong>${p.name}</strong> usó su rol para infligir 1 daño directo a ${gob.name}.`);
        if (gob.currentHp <= 0) {
          // Goblin derrotado - Marcar para animación
          gob.isDying = true;
          if (gob.isHito || gob.level >= p.level) {
            p.mo += gob.mo;
            this.ganarPex(gob.pex);
            gob.gaveReward = true;
            this.addLog(`⚔️ ¡El ataque de rol eliminó a ${gob.name}! (+${gob.mo} mo, +${gob.pex} PEX).`);
          } else {
            this.addLog(`⚔️ ¡El ataque de rol eliminó a ${gob.name}! (Sin recompensa por diferencia de nivel).`);
          }
          this.subirNivel(p);
        }
        return true;
      }
    }
    else if (roleId === 'sanador') {
      let targetP = isSelf ? p : (typeof targetId === 'number' ? this.players[targetId] : null);
      if (targetP && targetP.hp < targetP.maxHp) {
        p.energy -= energyCost;
        targetP.hp += 1;
        this.addLog(`⚡ <strong>${p.name}</strong> usó su rol (Sanador) para curar 1 PV a ${targetP.name}.`);
        return true;
      }
    }
    else if (roleId === 'protector') {
      let targetP = isSelf ? p : (typeof targetId === 'number' ? this.players[targetId] : null);
      if (targetP) {
        p.energy -= energyCost;
        targetP.shield = (targetP.shield || 0) + 1;
        this.addLog(`⚡ <strong>${p.name}</strong> usó su rol (Protector) para dar 1 Escudo a ${targetP.name}.`);
        return true;
      }
    }
    else if (roleId === 'curandero') {
      let targetP = isSelf ? p : (typeof targetId === 'number' ? this.players[targetId] : null);
      if (targetP) {
        const brokenItems = targetP.equipped.filter(e => e.isBroken);
        if (brokenItems.length > 0) {
          p.energy -= energyCost;
          brokenItems.forEach(e => { e.isBroken = false; e.brokenAnimationPlayed = false; });
          this.addLog(`⚡ <strong>${p.name}</strong> usó su rol (Curandero) para <span style="color:#2a9d8f">REPARAR</span> el equipo de ${targetP.name}.`);
          return true;
        }
      }
    }

    return false;
  }

  ganarPex(pex) {
    for (let i = 0; i < this.players.length; i++) {
      let p = this.players[i];
      p.pex += pex;
    }
  }

  subirNivel(p) {
    // Definimos la tabla de experiencia requerida para pasar de cada nivel al siguiente.
    // La clave es el nivel actual, el valor son los PEX necesarios.
    const expRequerida = {
      1: 2,
      2: 6,
      3: 12,
      4: 22
    };

    // El bucle comprueba dos cosas:
    // 1. Que exista una configuración de experiencia para el nivel actual (evita errores si llega a nivel 5).
    // 2. Que los PEX del jugador sean mayores o iguales a la experiencia requerida para ese nivel.
    while (expRequerida[p.level] && p.pex >= expRequerida[p.level]) {
      // Restamos exactamente los PEX que costó subir desde el nivel actual
      for (let i = 0; i < this.players.length; i++) {
        let p = this.players[i];

        p.pex -= expRequerida[p.level];

        p.level += 1;
        p.maxHp += 5;
        p.hp += 5;
      }
      this.addLog(`🌟 <span style="color:#ecf542">¡<strong>Los jugadores subieron al Nivel ${p.level}! </span> 🌟`);

      // Activar flag de elección para todos los jugadores
      this.players.forEach(pl => {
        pl.pendingLevelUpChoices = (pl.pendingLevelUpChoices || 0) + 1;
        pl.pendingLevelUpChoice = true;
      });
    }
  }

  addDieToPool(playerIndex, dieType, faces) {
    const p = this.players[playerIndex];
    if (p && p.pendingLevelUpChoice) {
      p.dicePool.push({ type: dieType, faces: faces });

      let bonusMsg = "";
      if (dieType === 'black') {
        p.mo += 1;
        bonusMsg = " y ganó 1 mo extra";
      }

      if (p.pendingLevelUpChoices && p.pendingLevelUpChoices > 1) {
        p.pendingLevelUpChoices--;
      } else {
        p.pendingLevelUpChoices = 0;
        p.pendingLevelUpChoice = false;
      }
      this.addLog(`🎲 <strong>${p.name}</strong> añadió un dado ${dieType === 'red' ? 'Rojo d6' : 'Negro d4'} a su colección${bonusMsg}.`);
      return true;
    }
    return false;
  }

  isValidDieForEquipment(val, eq) {
    // Prioridad al límite de la versión rota si la carta lo está
    const limitStr = (eq.isBroken && eq.broken && eq.broken.limit) ? eq.broken.limit : (eq.limit || '-');

    if (!limitStr || limitStr === '-') return true;

    const upperLimit = limitStr.toUpperCase();
    if (upperLimit === 'PAR') return val % 2 === 0;
    if (upperLimit === 'IMPAR') return val % 2 !== 0;

    if (upperLimit.startsWith('MAX ')) {
      const maxVal = parseInt(upperLimit.split(' ')[1].trim());
      return val <= maxVal;
    }
    if (upperLimit.startsWith('MIN ')) {
      const minVal = parseInt(upperLimit.split(' ')[1].trim());
      return val >= minVal;
    }

    // Soporte para formatos antiguos como "MAX4" o "+4"
    if (upperLimit.includes('+')) return val >= parseInt(upperLimit.replace('+', ''));
    if (upperLimit.includes('-')) return val <= parseInt(upperLimit.replace('-', ''));

    const exact = parseInt(upperLimit);
    if (!isNaN(exact)) return val === exact;

    return true;
  }

  applyEquipmentEffect(p, eq, asg, damagePerTarget, healObj) {
    const val = asg.value;
    const targetUid = asg.targetUid;

    // Extraemos los strings según el estado de la carta
    const effectStr = (eq.isBroken && eq.broken ? eq.broken.effect : eq.effect).toLowerCase();
    const extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();

    // 1. LÓGICA POR ID (Casos con comportamientos únicos)
    switch (eq.id) {
      case 'afilado':
      case 'anadir_pinchos':
        let dmg = val;
        // Solo aplica el "bono" si el texto de extra lo contiene (la versión rota lo tiene vacío)
        if (extraStr.includes('con un 4: daño 6') && val === 4) dmg = 6;
        if (extraStr.includes('con un 5: daño 6') && val === 5) dmg = 6;
        if (targetUid) damagePerTarget[targetUid].damage += dmg;
        return;

      case 'oxidado':
        let dmgO = val;
        if (effectStr.includes('max 4')) dmgO = Math.min(val, 4);
        if (effectStr.includes('+1')) dmgO += 1;
        if (targetUid) damagePerTarget[targetUid].damage += dmgO;
        return;

      case 'gema_regeneracion':
        if (targetUid) damagePerTarget[targetUid].damage += val;
        // La versión rota dice "cura 1", la sana "cura 2"
        if (val % 2 !== 0) {
          if (extraStr.includes('cura 2')) healObj.heal += 2;
          else if (extraStr.includes('cura 1')) healObj.heal += 1;
        }
        return;

      case 'drenar_justo':
        // Normal: Daño 2, con un 3: cura 3 | Roto: Daño 1, con un 2: cura 2
        let dJustoDmg = effectStr.includes('daño 2') ? 2 : 1;
        if (targetUid) damagePerTarget[targetUid].damage += dJustoDmg;

        if (extraStr.includes('con un 3: cura 3') && val === 3) healObj.heal += 3;
        if (extraStr.includes('con un 2: cura 2') && val === 2) healObj.heal += 2;
        return;

      case 'corazon_elastico':
        let dmgElastic = (asg.elasticDamage !== undefined && asg.elasticDamage !== null) ? asg.elasticDamage : (val % 2 === 0 ? val : 0);
        let healElastic = (asg.elasticDamage !== undefined && asg.elasticDamage !== null) ? (val - asg.elasticDamage) : (val % 2 === 0 ? 0 : val);

        if (dmgElastic > 0 && targetUid) {
          damagePerTarget[targetUid].damage += dmgElastic;
        }
        if (healElastic > 0) {
          healObj.heal += healElastic;
        }
        return;

      case 'reforzado_pinchos':
        // Par: daño, Impar: Escudo
        if (val % 2 === 0) {
          if (targetUid) damagePerTarget[targetUid].damage += val;
        } else {
          p.shield += val;
        }
        return;
    }

    // 2. LÓGICA GENÉRICA PARA EL RESTO (Ataque, Escudo, Cura)
    if (effectStr.includes('daño')) {
      let dmg = 0;
      if (effectStr.includes('dado')) {
        dmg = val;

        // Detectar modificadores genéricos (+X o -X)
        const modMatch = effectStr.match(/([+-]\s*\d+)/);
        if (modMatch) {
          dmg += parseInt(modMatch[0].replace(/\s+/g, ''));
        }
      } else {
        let match = effectStr.match(/daño\s+(\d+)/);
        if (match) dmg = parseInt(match[1]);
      }
      // Aplicar límites MAX/MIN si existen
      if (effectStr.includes('max')) {
        let maxMatch = effectStr.match(/max\s+(\d+)/);
        if (maxMatch) dmg = Math.min(dmg, parseInt(maxMatch[1]));
      }
      if (effectStr.includes('min')) {
        let minMatch = effectStr.match(/min\s+(\d+)/);
        if (minMatch) dmg = Math.max(dmg, parseInt(minMatch[1]));
      }
      if (targetUid) damagePerTarget[targetUid].damage += dmg;
    }

    if (effectStr.includes('escudo')) {
      let shield = 0;
      if (effectStr.includes('dado')) {
        shield = val;
        if (effectStr.includes('-1')) shield -= 1;
        if (effectStr.includes('+1')) shield += 1;
        if (effectStr.includes('x2')) shield *= 2;
      } else {
        let match = effectStr.match(/escudo\s+(\d+)/);
        if (match) shield = parseInt(match[1]);
      }
      // Aplicar límites MAX/MIN si existen
      if (effectStr.includes('max')) {
        let maxMatch = effectStr.match(/max\s+(\d+)/);
        if (maxMatch) shield = Math.min(shield, parseInt(maxMatch[1]));
      }
      if (effectStr.includes('min')) {
        let minMatch = effectStr.match(/min\s+(\d+)/);
        if (minMatch) shield = Math.max(shield, parseInt(minMatch[1]));
      }
      if (targetUid) damagePerTarget[targetUid].shield += shield;
    }

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
      healObj.heal += heal;
    }

    // 3. EXTRAS GENÉRICOS (Se suman al efecto base)
    if (extraStr.includes('cura max')) {
      let maxMatch = extraStr.match(/cura max\s+(\d+)/);
      if (maxMatch) healObj.heal += Math.min(val, parseInt(maxMatch[1]));
    }
  }


  breakRandomEquipment(player) {
    // Solo podemos romper equipo que esté activo y NO esté ya roto
    const breakable = player.equipped.filter(eq => eq.isActive && !eq.isBroken);

    if (breakable.length > 0) {
      const randomIndex = Math.floor(Math.random() * breakable.length);
      const itemToBreak = breakable[randomIndex];
      itemToBreak.isBroken = true;
      itemToBreak.brokenAnimationPlayed = false;
      itemToBreak.brokenInCombatId = this.lastCombatId;
      this.addLog(`🛠️ ¡CRACK! El equipo <strong>${itemToBreak.name}</strong> de <strong>${player.name}</strong> se ha <span style="color:var(--accent-red)">ROTO</span>.`);
      return true;
    }
    return false;
  }
}
