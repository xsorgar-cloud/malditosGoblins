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
    this.retaliationEscudoDeOroTriggeredPlayers = [];
    this.isGameOver = false;
    this.isGameWon = false;
    this.activeSenda = 'iniciacion';
    this.pendingHito1Goblins = 0;
    this.pendingCorrosionChoice = null;
    this.isFirstTurnOfGame = false;
    this.lastCombatId = 0;
    this.lastActionWasCombat = false;
    this.isTurnoCompleted = false;
    this.lastWarlordExtraDmg = 0;
    this.difficulty = 'facil';
    this.lastCombatAcquiredEffects = { escozor: 0, calambre: 0, tembleque: 0 };
    this.hordaPR = 0;
    this.hordaActionLog = '';

    // --- VARIABLES DE INTERFAZ Y ESTADO TRASLADADAS DESDE APP.JS ---
    this.lastWaveLevel = 0;
    this.lastActionCount = 0;
    this.activeSelectedDieId = null;
    this.activeSelectedEquipId = null;
    this.selectedSetupRoles = ['guerrero', null, null, null];
    this.justSelectedRole = null;
    this.selectedGoblins = [];
    this.selectedSendaValue = 'iniciacion';
    this.currentSendaTargetSelectId = 'select-senda';
    this.roleFillDice = { red1: 0, red2: 0, black: 0 };
    this.roleFillAssigned = null;
    this.roleFillBlackRerolled = false;
    this.roleFillSilverSelected = null;
    this.isRollingRoleFillDice = false;
    this.animatedGoblinUids = new Set();
    this.previousGoblinHps = new Map();
    this.currentAssignments = {};
    this.interceptionAssignments = {};
    this.isRollingCombatDice = false;
    this.prevPlayerStats = [];
    this.activeSelectedOrbUids = [];

    // Log de acciones y historial de combates
    this.combatHistory = [];
    this.logs = [];

    // Barajamos el mercado
    this.shuffleDecks();
  }

  addLog(message) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Mantener un límite razonable para no consumir memoria (ampliado a 5000 para poder exportar historiales largos)
    if (this.logs.length >= 5000) this.logs.shift();
    this.logs.push(`[${time}] ${message}`);
    
    if (typeof window.renderLogs === 'function') {
      window.renderLogs();
    }

    // Recolector de Habilidades de Jefe para el Alert final de Combate
    if (this.currentCombat && this.lastCombatBossEffects !== undefined) {
      if (message.includes('Efecto de La Madre') || 
          message.includes('Defensa del Nido') || 
          message.includes('El Piromante (Dado') || 
          message.includes('El Gran Recaudador (Dado') || 
          message.includes('Drenaje:') ||
          message.includes('Rey Brujo') || 
          message.includes('Maldición:') || 
          message.includes('Invocación:') ||
          message.includes('Ininterceptable:')) {
          
          // Limpiar HTML para el texto del alert
          let cleanMsg = message.replace(/<[^>]*>?/gm, '');
          // Evitar duplicados (a veces se procesan múltiples dados iguales)
          if (!this.lastCombatBossEffects.includes(cleanMsg)) {
            this.lastCombatBossEffects.push(cleanMsg);
          }
      }
    }

    if (typeof updateChat === 'function') {
      updateChat();
    }
  }

  checkGameOver() {
    if (this.players.length > 0 && !this.players.some(p => p.hp > 0)) {
      this.isGameOver = true;
      if (!this.endTime) this.endTime = new Date().toISOString();
      this.addLog(`💀 <span style="color: #e63946;"><strong>PARTIDA FINALIZADA</strong></span>: El grupo ha sido derrotado.`);
      return true;
    }
    return false;
  }

  damagePlayer(player, damage, isDirect = false, reason = '') {
    if (damage <= 0 || player.hp <= 0) return 0;

    let finalDamage = damage;
    let goldPrevented = false;
    let extraGoldDamage = false;

    let applyEscudoDeOro = false;
    if (this.activeSenda === 'recaudador') {
      if (reason !== 'Represalia') {
        applyEscudoDeOro = true;
      } else {
        if (!this.retaliationEscudoDeOroTriggeredPlayers) {
          this.retaliationEscudoDeOroTriggeredPlayers = [];
        }
        if (!this.retaliationEscudoDeOroTriggeredPlayers.includes(player.id)) {
          applyEscudoDeOro = true;
          this.retaliationEscudoDeOroTriggeredPlayers.push(player.id);
        }
      }
    }

    this.lastDamageAppliedEscudoDeOro = applyEscudoDeOro;

    if (applyEscudoDeOro) {
      if (player.mo > 0) {
        player.mo = Math.max(0, player.mo - 1);
        finalDamage = Math.max(0, finalDamage - 1);
        goldPrevented = true;
      } else {
        finalDamage += 1;
        extraGoldDamage = true;
      }
    }

    player.hp = Math.max(0, player.hp - finalDamage);

    if (this.activeSenda === 'recaudador' && applyEscudoDeOro) {
      if (goldPrevented) {
        this.addLog(`🪙 <strong>Escudo de Oro:</strong> <strong>${player.name}</strong> pierde 1 mo y evita 1 daño. Daño resultante: <span style="color:#ff4d4d"><strong>${finalDamage}</strong></span> (HP: ${player.hp}/${player.maxHp}).`);
        this.lastCombatGoldPrevented = (this.lastCombatGoldPrevented || 0) + 1;
      } else if (extraGoldDamage) {
        this.addLog(`💸 <strong>Escudo de Oro (Sin oro):</strong> <strong>${player.name}</strong> sufre +1 Daño Extra. Daño resultante: <span style="color:#ff4d4d"><strong>${finalDamage}</strong></span> (HP: ${player.hp}/${player.maxHp}).`);
        this.lastCombatExtraGoldDamage = (this.lastCombatExtraGoldDamage || 0) + 1;
      }
    }

    this.checkGameOver();
    return finalDamage;
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
          let dieDetail = { type: 'die', faces: faces, val: val };
          
          // Pre-roll extra damage die if this attack triggers it (e.g. lanza +1d4)
          let gobDB = goblin.attacks ? goblin : (typeof DB !== 'undefined' && DB.goblins ? DB.goblins[goblin.level] : null);
          if (gobDB && gobDB.attacks && gobDB.attacks[val]) {
            let attacks = gobDB.attacks[val];
            attacks.forEach(eff => {
              if (eff.toLowerCase().includes('lanza +')) {
                const dieMatch = eff.toLowerCase().match(/(\d*)d(\d+)/);
                if (dieMatch) {
                  const num = parseInt(dieMatch[1]) || 1;
                  const facesExtra = parseInt(dieMatch[2]);
                  let extraDmg = 0;
                  for (let i = 0; i < num; i++) extraDmg += this.rollDice(facesExtra);
                  dieDetail.extraDmgRoll = extraDmg;
                }
              }
            });
          }
          
          details.push(dieDetail);
        }
      } else {
        let mod = parseInt(part);
        total += mod;
        details.push({ type: 'mod', val: mod });
      }
    }
    return { total, details };
  }

  isGoblinInvulnerable(goblin) {
    if (this.activeSenda === 'recaudador') {
      // Hito 2: El Goblin de Nivel 2 es Invulnerable hasta que pagues 2mo
      if (this.currentHito === 3 && goblin.level === 2 && !goblin.peajePagado) {
        return true;
      }
      // Hito 4: Mientras algún Nivel 1 siga vivo, el Nivel 3 y el Nivel 2 son Invulnerables
      if (this.currentHito === 5 && (goblin.level === 2 || goblin.level === 3)) {
        let lvl1Exists = this.battlefield.goblins.some(g => g.level === 1 && g.currentHp > 0 && !g.isDying);
        if (lvl1Exists) return true;
      }
    }

    if (this.activeSenda === 'guerrero') {
      // Solo los goblins del propio hito son inmunes durante la senda
      if (!goblin.isHito) return false;

      // Hito 3: El Nivel 3 es inmune al daño mientras esté acompañado de niveles inferiores (nivel 1 o 2)
      if (this.currentHito === 4 && goblin.level === 3) {
        let lowerExists = this.battlefield.goblins.some(g => (g.level === 1 || g.level === 2) && g.currentHp > 0 && g.uid !== goblin.uid);
        if (lowerExists) return true;
      }

      // Hito 4: Mientras algún nivel 1 siga vivo, el nivel 2 y el nivel 3 son invulnerables
      if (this.currentHito === 5 && (goblin.level === 2 || goblin.level === 3)) {
        let lvl1Exists = this.battlefield.goblins.some(g => g.level === 1 && g.currentHp > 0 && g.uid !== goblin.uid);
        if (lvl1Exists) return true;
      }
    }

    if (this.activeSenda === 'la_madre') {
      // Regla "Escudos de Carne": Mientras haya al menos un Goblin de Nivel inferior en la mesa, NO puedes declarar ataques contra Goblins de Nivel superior.
      if (!goblin.isDying && goblin.currentHp > 0 && !goblin.isBoss) {
        const aliveGobs = this.battlefield.goblins.filter(g => g.currentHp > 0 && !g.isDying && !g.isBoss);
        if (aliveGobs.length > 0) {
          const minLevel = Math.min(...aliveGobs.map(g => g.level));
          if (goblin.level > minLevel) {
            return true;
          }
        }
      }
    }

    if (this.activeSenda === 'cazador') {
      // Hito 2: Los Tramperos. El Nivel 2 es Invulnerable mientras esté acompañado.
      if (this.currentHito === 3 && goblin.level === 2 && goblin.isHito) {
        let lowerExists = this.battlefield.goblins.some(g => g.currentHp > 0 && !g.isDying && g.uid !== goblin.uid);
        if (lowerExists) return true;
      }
    }

    return false;
  }

  checkSpawnNextHito1Goblin(deadGoblin) {
    if ((this.activeSenda === 'guerrero' || this.activeSenda === 'rey_brujo') && this.currentHito === 2 && deadGoblin.isHito && deadGoblin.level === 1) {
      if (this.pendingHito1Goblins > 0) {
        this.pendingHito1Goblins--;
        this.battlefield.goblins.push({
          ...DB.goblins[1],
          uid: Date.now() + '-' + Math.random().toString(36).substring(2),
          currentHp: DB.goblins[1].hp,
          isHito: true
        });
        this.addLog("⚔️ El primer goblin del Hito 1 ha sido derrotado. ¡Entra el siguiente goblin!");
      }
    }
  }

  startCombat(selectedGoblins) {
    if (this.isMarketPhase || !selectedGoblins || selectedGoblins.length === 0) return false;

    let validGoblins = selectedGoblins.map(g => this.battlefield.goblins.find(bg => bg.uid === g.uid)).filter(g => g);
    if (validGoblins.length === 0) return false;

    this.lastCombatId++;

    // Ordenar los goblins en combate de izquierda a derecha según su orden en el campo de batalla (A, B, C...)
    validGoblins.sort((a, b) => {
      let idxA = this.battlefield.goblins.indexOf(a);
      let idxB = this.battlefield.goblins.indexOf(b);
      return idxA - idxB;
    });

    let p = this.players[this.currentPlayerIndex];
    if (p.isBot && window.botManager) {
      window.botManager.executePreCombatRoleAbilities(p, validGoblins);
    }
    let originalStatusSnapshot = { ...p.statusEffects };

    // RETROFIT: Ensure level 4+ players have their silver die if they didn't get it
    if (p.level >= 4 && !p.dicePool.some(d => d.type === 'silver')) {
      p.dicePool.push({ type: 'silver', faces: 3 });
    }

    // Generar la reserva de dados para este combate
    let dicePoolToRoll = [...p.dicePool];
    
    // Regla de Hito 4 de El Rey Brujo: -1 dado rojo
    if (this.activeSenda === 'rey_brujo' && this.currentHito === 5 && validGoblins.some(g => g.isHito)) {
      let redIdx = dicePoolToRoll.findIndex(d => d.type === 'red');
      if (redIdx !== -1) {
        dicePoolToRoll.splice(redIdx, 1);
        this.addLog(`🔮 <strong>El Asalto:</strong> Combates con un dado <span style="color:#ef233c">ROJO</span> menos.`);
      }
    }
    
    // Efecto "Elimina un d6 ROJO" de El Rey Brujo
    if (p.statusEffects.eliminaRojo && p.statusEffects.eliminaRojo > 0) {
      let countToRemove = p.statusEffects.eliminaRojo;
      let removedCount = 0;
      for (let i = 0; i < countToRemove; i++) {
        let redIdx = dicePoolToRoll.findIndex(d => d.type === 'red');
        if (redIdx !== -1) {
          dicePoolToRoll.splice(redIdx, 1);
          removedCount++;
        }
      }
      if (removedCount > 0) {
        this.addLog(`🔮 <strong>Efecto Rey Brujo:</strong> Pierdes ${removedCount} dado(s) <span style="color:#ef233c">ROJO(S)</span> por la maldición.`);
      }
      p.statusEffects.eliminaRojo = 0; // Se consume el efecto
    }

    // Aura de toxinas (Jefe El Cazador)
    if (this.activeSenda === 'cazador' && validGoblins.some(g => g.isBoss)) {
      p.hp = Math.max(0, p.hp - 1);
      this.addLog(`☣️ <strong>Aura de toxinas:</strong> Sufres <span style="color:#ff4d4d"><strong>1 Daño Directo</strong></span> al realizar un ataque contra El Cazador. (HP: ${p.hp}/${p.maxHp})`);
      this.checkGameOver();
    }

    // Efecto "Elimina un d6 NEGRO" de El Cazador
    if (p.statusEffects.eliminaNegro && p.statusEffects.eliminaNegro > 0) {
      let countToRemove = p.statusEffects.eliminaNegro;
      let removedCount = 0;
      for (let i = 0; i < countToRemove; i++) {
        let blackIdx = dicePoolToRoll.findIndex(d => d.type === 'black');
        if (blackIdx !== -1) {
          dicePoolToRoll.splice(blackIdx, 1);
          removedCount++;
        }
      }
      if (removedCount > 0) {
        this.addLog(`🌑 <strong>El Cazador:</strong> Pierdes ${removedCount} dado(s) <span style="color:#555">NEGRO(S)</span> en este ataque por su veneno.`);
      }
      p.statusEffects.eliminaNegro = 0; // Se consume el efecto
    }

    let combatData = {
      goblins: validGoblins,
      originalStatus: originalStatusSnapshot,
      playerDice: dicePoolToRoll.map((d, index) => ({
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
      const greenRoll = this.rollGreenDice(goblin);

      // Senda Piromante - Ordenar dados del Piromante de mayor a menor
      if (goblin.isBoss && goblin.name.includes("El Piromante")) {
        greenRoll.details.sort((a, b) => {
          if (a.type === 'die' && b.type === 'die') {
            return b.val - a.val;
          }
          return 0;
        });
      }

      // Hito 2 de El Zeñor de la Guerra: +1 al ataque del goblin Nvl 2 por cada Nvl 1 vivo
      if (this.activeSenda === 'guerrero' && goblin.level === 2) {
        let lvl1Count = this.battlefield.goblins.filter(g => g.level === 1 && g.currentHp > 0).length;
        if (lvl1Count > 0) {
          greenRoll.total += lvl1Count;
          greenRoll.details.push({ type: 'mod', val: lvl1Count, isHitoRule: true });
        }
      }

      combatData.dice.green[goblin.uid] = greenRoll;

      // Especial: Golpe Brutal de El Zeñor de la Guerra
      if (this.activeSenda === 'guerrero' && goblin.isBoss) {
        let rolledSix = greenRoll.details.some(d => d.type === 'die' && d.faces === 6 && d.val === 6);
        if (rolledSix) {
          this.addLog(`💥 <strong>¡GOLPE BRUTAL!</strong> El Zeñor de la Guerra ha sacado un 6 en su ataque y rompe una pieza de equipo antes de asignar los dados.`);
          this.breakRandomEquipment(p);
        }
      }
    });

    // Hito 4: Los Artificieros (Senda Piromante)
    // "Por cada '1' natural en tus dados, sufres 1 punto de Daño Directo."
    if (this.activeSenda === 'piromante' && this.currentHito === 5) {
      let naturalOnesCount = 0;
      combatData.playerDice.forEach(d => {
        if (d.value === 1) {
          naturalOnesCount++;
        }
      });
      if (naturalOnesCount > 0) {
        p.hp = Math.max(0, p.hp - naturalOnesCount);
        this.addLog(`💥 <strong>Los Artificieros:</strong> Sacaste ${naturalOnesCount} dado(s) con '1' natural y sufres <span style="color:#ff4d4d"><strong>${naturalOnesCount} Daño Directo</strong></span> (HP: ${p.hp}/${p.maxHp}).`);
        this.checkGameOver();
      }
    }

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
    this.addLog(`<span style="color:#B81D1D">*****<strong>${p.name}</strong> inició un combate contra: ${targetNames}.*****</span>`);
    return true;
  }

  rerollDie(dieId) {
    if (this.currentCombat) {
      let die = this.currentCombat.playerDice.find(d => d.id === dieId);
      if (die && die.type === 'black' && !die.rerolled) {
        die.value = this.rollDice(die.faces);
        die.rerolled = true;
        // Hito 4: Los Artificieros (Senda Piromante)
        if (this.activeSenda === 'piromante' && this.currentHito === 5 && die.value === 1) {
          let p = this.getCurrentPlayer();
          p.hp = Math.max(0, p.hp - 1);
          this.addLog(`💥 <strong>Los Artificieros:</strong> ¡Sacaste un 1 natural al relanzar un dado y sufres <span style="color:#ff4d4d"><strong>1 Daño Directo</strong></span>! (HP: ${p.hp}/${p.maxHp})`);
          this.checkGameOver();
        }
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
    this.isTurnoCompleted = true;
    this.isResolvingCombat = true;
    this.lastActionWasCombat = true;
    const c = this.currentCombat;
    if (!c) {
      this.isResolvingCombat = false;
      return;
    }

    this.lastCombatBossEffects = []; // Limpiar recolector de habilidades de jefe
    this.lastCombatPiromanteBombs = 0; // Limpiar contador de bombas del piromante
    let p = this.getCurrentPlayer();

    this.lastCombatGoldPrevented = 0;
    this.lastCombatExtraGoldDamage = 0;
    this.lastCombatSaqueoExperto = 0;
    this.lastCombatLosCarteristasRobo = 0;
    this.lastCombatLosCarteristasDmg = 0;
    this.lastCombatArmaduraMonedasGold = 0;

    let escozorBefore = p.statusEffects ? (p.statusEffects.escozor || 0) : 0;
    let calambreBefore = p.statusEffects ? (p.statusEffects.calambre || 0) : 0;
    let temblequeBefore = p.statusEffects ? (p.statusEffects.tembleque || 0) : 0;

    let hpBefore = p.hp;
    let shieldBefore = p.shield;
    let energyBefore = p.energy;
    let moBefore = p.mo;
    let pexBefore = p.pex;
    let levelBefore = p.level;
    let equippedBefore = p.equipped.map(eq => ({ id: eq.id, name: eq.name, isBroken: eq.isBroken, isActive: !!eq.isActive }));

    let playerDiceDetails = [];
    let goblinDiceDetails = [];
    let escozorDamageDealt = 0;
    const goblinHpsBefore = this.battlefield.goblins.map(g => ({ uid: g.uid, hp: g.currentHp }));

    // Guardar estado inicial del combate para depuración (se actualizará al final)
    try {
      this.lastCombatDebugState = JSON.parse(JSON.stringify({
        player: {
          name: p.name,
          playerNum: this.currentPlayerIndex + 1,
          hp: p.hp,
          shield: p.shield,
          energy: p.energy,
          mo: p.mo,
          pex: p.pex,
          level: p.level,
          role: p.role.id,
          equipped: p.equipped.map(eq => ({ id: eq.id, name: eq.name, isBroken: eq.isBroken, isActive: !!eq.isActive }))
        },
        goblins: this.battlefield.goblins.map(g => ({ uid: g.uid, name: g.name, level: g.level, hp: g.currentHp, maxHp: g.maxHp, isBoss: g.isBoss, bossStats: g.bossStats, isHito: g.isHito, isInvocacion: g.isInvocacion })),
        playerDice: c.playerDice,
        goblinDice: c.dice && c.dice.green ? c.dice.green : {},
        assignments: assignments,
        interceptions: interceptions
      }));
    } catch (e) {
      console.error("Error saving debug state:", e);
    }

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
    let totalPlayerShield = 0;

    // Inicializamos damagePerTarget para todos los goblins en combate
    c.goblins.forEach(g => {
      damagePerTarget[g.uid] = { damage: 0, shield: 0 };
    });

    for (let eqId in assignments) {
      let asgData = assignments[eqId];
      // Convertir a array si no lo es (para compatibilidad)
      let asgList = Array.isArray(asgData) ? asgData : [asgData];

      // Inicializar el daño acumulado por este equipo en esta resolución
      let eqDamagePerTarget = {};
      c.goblins.forEach(g => {
        eqDamagePerTarget[g.uid] = 0;
      });

      asgList.forEach(asg => {
        if (asg.isRole) {
          let dieVal = asg.value;
          let gainedEnergy = p.role.energyRates[dieVal - 1] || 0;
          p.energy += gainedEnergy;

          playerDiceDetails.push({
            dieId: asg.dieId,
            value: asg.value,
            assignedTo: "Rol (" + p.role.name + ")",
            isRole: true,
            damage: 0,
            shield: 0,
            heal: 0,
            energyGained: gainedEnergy,
            target: "Rol"
          });
          return; // equivale a continue en forEach
        }

        let eq = p.equipped.find(e => e.id === eqId);
        if (!eq) return;
        eq.usedInCombatId = this.lastCombatId;

        // Tormenta de Fuego (Senda Piromante - Jefe Final)
        // "Por cada resultado de '1' o '2' natural que apliques en el equipo, recibes automáticamente una carga de Escozor."
        if (this.activeSenda === 'piromante' && this.currentHito === 6) {
          if (asg.value === 1 || asg.value === 2) {
            p.statusEffects.escozor = (p.statusEffects.escozor || 0) + 1;
            this.addLog(`🔥 <strong>Tormenta de Fuego:</strong> Asignaste un ${asg.value} en <strong>${eq.name}</strong> y recibes <span style="color:#ff6600">1 Escozor</span>.`);
          }
        }

        // Calcular de manera aislada el efecto de este dado específico
        let healObj = { heal: 0 };
        let shieldObj = { shield: 0 };
        let tempDamagePerTarget = {};
        c.goblins.forEach(g => {
          tempDamagePerTarget[g.uid] = { damage: 0, shield: 0 };
        });

        this.applyEquipmentEffect(p, eq, asg, tempDamagePerTarget, healObj, shieldObj);

        // Toxina Goblin (Senda Cazador) - Camuflaje y Reflejos
        if (this.activeSenda === 'cazador' && asg.value < 4) {
          let missed = false;
          for (let uid in tempDamagePerTarget) {
            if (tempDamagePerTarget[uid].damage > 0) {
              tempDamagePerTarget[uid].damage = 0;
              missed = true;
            }
          }
          if (missed) {
            this.addLog(`💀 <strong>Camuflaje y Reflejos:</strong> El ataque de <em>${eq.name}</em> falló porque el dado (${asg.value}) es menor que 4.`);
          }
        }

        let damageDealt = 0;
        let targetGoblinName = "Sin objetivo";
        if (asg.targetUid) {
          damageDealt = tempDamagePerTarget[asg.targetUid] ? tempDamagePerTarget[asg.targetUid].damage : 0;
          let targetG = c.goblins.find(g => g.uid === asg.targetUid);
          if (targetG) targetGoblinName = targetG.name;
        }

        playerDiceDetails.push({
          dieId: asg.dieId,
          value: asg.value,
          assignedTo: eq.name,
          isRole: false,
          damage: damageDealt,
          shield: shieldObj.shield,
          heal: healObj.heal,
          target: targetGoblinName
        });

        playerHeal += healObj.heal;
        totalPlayerShield += shieldObj.shield;
        for (let uid in tempDamagePerTarget) {
          eqDamagePerTarget[uid] += tempDamagePerTarget[uid].damage;
        }
      });

      // Aplicar Armadura de monedas si la senda es recaudador y el objetivo es El Gran Recaudador
      let eqObj = p.equipped.find(e => e.id === eqId);
      if (eqObj) {
        for (let uid in eqDamagePerTarget) {
          let targetGoblin = c.goblins.find(g => g.uid === uid || String(g.uid) === String(uid));
          let isRecaudadorBoss = (targetGoblin && targetGoblin.isBoss && targetGoblin.name.includes("El Gran Recaudador"));
          let dmg = eqDamagePerTarget[uid];

          if (isRecaudadorBoss && dmg > 0) {
            let netDmg = Math.max(0, dmg - 1);
            if (netDmg > 0) {
              p.mo += 1;
              this.lastCombatArmaduraMonedasGold = (this.lastCombatArmaduraMonedasGold || 0) + 1;
              this.addLog(`🪙 <strong>Armadura de monedas:</strong> El equipo <em>${eqObj.name}</em> daña al Gran Recaudador. ¡Obtienes <span style="color:#ffd700">1 mo</span>! (Daño: ${dmg} -> ${netDmg}).`);
            } else {
              this.addLog(`🪙 <strong>Armadura de monedas:</strong> El ataque de <em>${eqObj.name}</em> fue reducido a 0 por la Armadura de monedas (Daño: ${dmg} -> 0).`);
            }
            eqDamagePerTarget[uid] = netDmg;
          }
        }
      }

      // Sumar al damagePerTarget global
      for (let uid in eqDamagePerTarget) {
        if (damagePerTarget[uid]) {
          damagePerTarget[uid].damage += eqDamagePerTarget[uid];
        }
      }
    }

    // Procesar cada goblin en el combate
    let goblinsDefeated = 0;
    let totalNormalGoblinDamage = 0;
    let totalDirectGoblinDamage = 0;

    c.goblins.forEach(targetGoblin => {
      let targetUid = targetGoblin.uid;
      let stats = damagePerTarget[targetUid] || { damage: 0, shield: 0 };
      let msgParts = [];

      // Aplicar Daño al Goblin
      if (stats.damage > 0) {
        if (targetGoblin.armaduraReactiva && totalPlayerShield === 0) {
          this.damagePlayer(p, 1, true, 'Armadura Reactiva');
          this.addLog(`⚡ <strong>Armadura Reactiva:</strong> ¡${p.name} recibe 1 de daño directo por atacar a ${targetGoblin.name || ('G' + targetGoblin.level)} sin escudos!`);
        }

        if (this.isGoblinInvulnerable(targetGoblin)) {
          this.addLog(`🛡️ ${targetGoblin.name || ('G' + targetGoblin.level)} es invulnerable y no recibe daño.`);
        } else {
          let damageNegated = false;
          if (targetGoblin.isBoss && (this.activeSenda === 'rey_brujo' || targetGoblin.name.includes("Rey Brujo"))) {
            let forceFieldRoll = this.rollDice(6);
            if (forceFieldRoll >= 5) {
              damageNegated = true;
              this.addLog(`🔮 <strong>Campo de Fuerza:</strong> El Rey Brujo lanzó un <strong>${forceFieldRoll}</strong> en 1d6. ¡El ataque de ${p.name} es anulado por completo!`);
            } else {
              this.addLog(`🔮 <strong>Campo de Fuerza:</strong> El Rey Brujo lanzó un <strong>${forceFieldRoll}</strong> en 1d6. El ataque atraviesa el escudo.`);
            }
          }
          
          if (targetGoblin.isBoss && this.activeSenda === 'cazador') {
            let bossDice = c.dice.green[targetGoblin.uid];
            if (bossDice && bossDice.details) {
              let goblinInterceptions = interceptions ? (interceptions[targetUid] || interceptions[String(targetUid)] || []) : [];
              let naturalDieIdx = 0;
              let invulnerableActivated = false;
              bossDice.details.forEach(d => {
                 if (d.type === 'die') {
                    let isIntercepted = goblinInterceptions.some(asg => Number(asg.goblinDieIndex) === Number(naturalDieIdx));
                    if (d.val === 4 && !isIntercepted) {
                        invulnerableActivated = true;
                    }
                    naturalDieIdx++;
                 }
              });
              if (invulnerableActivated) {
                damageNegated = true;
              }
            }
          }

          if (damageNegated) {
            msgParts.push(`evita el daño por Campo de Fuerza`);
          } else {
            if (targetGoblin.pielDeCuero > 0) {
              let absorbed = Math.min(stats.damage, targetGoblin.pielDeCuero);
              targetGoblin.pielDeCuero -= absorbed;
              stats.damage -= absorbed;
              this.addLog(`🛡️ <strong>Piel de Cuero:</strong> Absorbe ${absorbed} de daño (restante: ${targetGoblin.pielDeCuero}).`);
            }
            if (stats.damage > 0) {
              targetGoblin.currentHp -= stats.damage;
              msgParts.push(`recibe ${stats.damage} daño`);
            } else {
              msgParts.push(`el daño fue absorbido por Piel de Cuero`);
            }
            
            // Defensa del Nido (Senda de La Madre)
            if (targetGoblin.isBoss && (this.activeSenda === 'la_madre' || targetGoblin.name.includes("La Madre")) && stats.damage > 0) {
              this.battlefield.goblins.push({
                ...DB.goblins[1],
                uid: Date.now() + '-' + Math.random().toString(36).substring(2),
                currentHp: DB.goblins[1].hp,
                isInvocacion: true,
                mo: 0,
                isHito: true,
                image: 'assets/Monstruos/invocacion_01.webp'
              });
              msgParts.push(`🥚 <span style="color:#f54281">activa Defensa del Nido (Aparece 1 Invocación)</span>`);
            }
          }
        }
      }

      // El Goblin contraataca
      let greenDiceResult = c.dice.green[targetUid];
      let goblinDmg = greenDiceResult ? greenDiceResult.total : 1;

      // Si el goblin es el Rey Brujo, sus daños son estáticos según la tirada natural del dado verde
      if (targetGoblin.isBoss && targetGoblin.name.includes("Rey Brujo") && greenDiceResult && greenDiceResult.details) {
        let naturalDie = greenDiceResult.details.find(d => d.type === 'die');
        if (naturalDie) {
          let rollVal = naturalDie.val;
          if (rollVal === 1) goblinDmg = 4;
          else if (rollVal === 2) goblinDmg = 3;
          else if (rollVal === 4) goblinDmg = 1;
          else if (rollVal === 5) goblinDmg = 4;
          else if (rollVal === 6) goblinDmg = 1;
        }
      }

      // La Madre: Efectos estáticos de los dados
      if (targetGoblin.isBoss && targetGoblin.name.includes("La Madre") && greenDiceResult && greenDiceResult.details) {
        let naturalDie = greenDiceResult.details.find(d => d.type === 'die');
        if (naturalDie) {
          let rollVal = naturalDie.val;
          goblinDmg = 0; // La Madre no hace daño directo numérico de base

          if (rollVal === 1 || rollVal === 4) {
            // Invoca 2x Nivel 1
            for(let i=0; i<2; i++){
              this.battlefield.goblins.push({
                ...DB.goblins[1],
                uid: Date.now() + '-' + Math.random().toString(36).substring(2),
                currentHp: DB.goblins[1].hp,
                isInvocacion: true, 
                mo: 0,
                isHito: true,
                image: 'assets/Monstruos/invocacion_01.webp'
              });
            }
            this.addLog(`🥚 <span style="color:#f54281"><strong>Efecto de La Madre (Dado ${rollVal}):</strong> Aparecen 2 Invocaciones Nivel 1 (Hito).</span>`);
          } 
          else if (rollVal === 2 || rollVal === 3) {
            let otherGobs = this.battlefield.goblins.filter(g => g.uid !== targetGoblin.uid && !g.isDying);
            if (otherGobs.length > 0) {
              goblinDmg = otherGobs.reduce((sum, g) => sum + g.level, 0);
              this.addLog(`💀 <span style="color:#ff4d4d"><strong>Efecto de La Madre (Dado ${rollVal}):</strong> Inflige Daño igual a la suma del nivel del resto de goblins (${goblinDmg} Daño).</span>`);
            } else {
              for(let i=0; i<2; i++){
                this.battlefield.goblins.push({
                  ...DB.goblins[1], 
                  uid: Date.now() + '-' + Math.random().toString(36).substring(2), 
                  currentHp: DB.goblins[1].hp, 
                  isInvocacion: true, 
                  mo: 0, 
                  isHito: true,
                  image: 'assets/Monstruos/invocacion_01.webp'
                });
              }
              this.addLog(`🥚 <span style="color:#f54281"><strong>Efecto de La Madre (Dado ${rollVal}):</strong> Sin Goblins en mesa, invoca 2 Goblins de Nivel 1 (Hito).</span>`);
            }
          }
          else if (rollVal === 5) {
            let otherGobs = this.battlefield.goblins.filter(g => g.uid !== targetGoblin.uid && !g.isDying);
            if (otherGobs.length > 0) {
              // Sacrifica el de menor nivel
              let minLvl = Math.min(...otherGobs.map(g => g.level));
              let sacTarget = otherGobs.find(g => g.level === minLvl);
              sacTarget.currentHp = 0;
              sacTarget.isDying = true;
              
              let healAmount = 5;
              targetGoblin.currentHp = Math.min(targetGoblin.maxHp, targetGoblin.currentHp + healAmount);
              this.addLog(`🩸 <span style="color:#f54281"><strong>Efecto de La Madre (Dado 5):</strong> Sacrifica a ${sacTarget.name||('G'+sacTarget.level)} y se cura 5 PV (Total: ${targetGoblin.currentHp}/${targetGoblin.maxHp}).</span>`);
            } else {
              this.addLog(`🩸 <span style="color:#999"><strong>Efecto de La Madre (Dado 5):</strong> No hay goblins para sacrificar.</span>`);
            }
          }
          else if (rollVal === 6) {
            let otherGobs = this.battlefield.goblins.filter(g => g.uid !== targetGoblin.uid && !g.isDying);
            let pairFound = false;
            
            let countsByLevel = {};
            otherGobs.forEach(g => {
              countsByLevel[g.level] = countsByLevel[g.level] || [];
              countsByLevel[g.level].push(g);
            });
            
            for (let lvlStr in countsByLevel) {
              let arr = countsByLevel[lvlStr];
              if (arr.length >= 2) {
                let gob1 = arr[0];
                let gob2 = arr[1];
                let lvl = parseInt(lvlStr);
                
                // Mueren y mutan (no dan recompensas)
                gob1.currentHp = 0; gob1.isDying = true; gob1.gaveReward = true; // Para que no de recompensa en render
                gob1.rewardMo = 0;
                gob1.rewardPex = 0;
                gob2.currentHp = 0; gob2.isDying = true; gob2.gaveReward = true;
                gob2.rewardMo = 0;
                gob2.rewardPex = 0;
                
                let extraProps = {};
                const isGob1Wave = !gob1.isHito && !gob1.isInvocacion;
                const isGob2Wave = !gob2.isHito && !gob2.isInvocacion;
                const isGob1Hito = gob1.isHito && !gob1.isInvocacion;
                const isGob2Hito = gob2.isHito && !gob2.isInvocacion;
                const isGob1Summon = gob1.isInvocacion;
                const isGob2Summon = gob2.isInvocacion;

                // Determinar el tipo resultante de la fusión según el manual
                if ((isGob1Wave && isGob2Summon) || (isGob2Wave && isGob1Summon)) {
                  // Oleada + Invocación --> Oleada (pierde hito e invocación)
                } else if ((isGob1Wave && isGob2Hito) || (isGob2Wave && isGob1Hito)) {
                  // Oleada + Hito --> Oleada (pierde hito)
                } else if ((isGob1Summon && isGob2Hito) || (isGob2Summon && isGob1Hito)) {
                  // Invocación + Hito --> Invocación Hito (mantiene hito)
                  extraProps.isInvocacion = true;
                  extraProps.mo = 0;
                  extraProps.isHito = true;
                  extraProps.image = 'assets/Monstruos/invocacion_0' + (lvl + 1) + '.webp';
                } else if (isGob1Summon && isGob2Summon) {
                  // Invocación + Invocación --> Invocación (mantiene hito si alguno era hito)
                  extraProps.isInvocacion = true;
                  extraProps.mo = 0;
                  extraProps.image = 'assets/Monstruos/invocacion_0' + (lvl + 1) + '.webp';
                  if (gob1.isHito || gob2.isHito) {
                    extraProps.isHito = true;
                  }
                } else if (isGob1Hito && isGob2Hito) {
                  // Hito + Hito --> Hito
                  extraProps.isHito = true;
                }

                this.battlefield.goblins.push({
                  ...DB.goblins[lvl + 1],
                  ...extraProps,
                  uid: Date.now() + '-' + Math.random().toString(36).substring(2),
                  currentHp: DB.goblins[lvl + 1].hp,
                  isMutated: true
                });
                this.addLog(`🧬 <span style="color:#c975ff"><strong>Efecto de La Madre (Dado 6):</strong> Una pareja de Nivel ${lvl} muta a Nivel ${lvl + 1}.</span>`);
                pairFound = true;
                break;
              }
            }
            
            if (!pairFound) {
              this.battlefield.goblins.push({
                ...DB.goblins[2],
                uid: Date.now() + '-' + Math.random().toString(36).substring(2),
                currentHp: DB.goblins[2].hp,
                isInvocacion: true, 
                mo: 0,
                isHito: true,
                image: 'assets/Monstruos/invocacion_02.webp'
              });
              this.addLog(`🥚 <span style="color:#f54281"><strong>Efecto de La Madre (Dado 6):</strong> Sin parejas en mesa, invoca 1 Goblin de Nivel 2 (Hito).</span>`);
            }
          }
        }
      }

      // Hito 2 de El Zeñor de la Guerra: +1 al ataque del goblin Nvl 2 por cada Nvl 1 vivo
      if (this.activeSenda === 'guerrero' && targetGoblin.level === 2) {
        let lvl1Count = this.battlefield.goblins.filter(g => g.level === 1 && g.currentHp > 0).length;
        if (lvl1Count > 0) {
          this.addLog(`⚔️ El goblin de nivel 2 obtiene +${lvl1Count} de daño (+1 por cada goblin de nivel 1 vivo).`);
        }
      }

      // Buscar efectos especiales y procesar intercepciones por dado
      let gobDB = targetGoblin.attacks ? targetGoblin : DB.goblins[targetGoblin.level];
      let goblinInterceptions = [];
      if (interceptions) {
        if (interceptions[targetUid]) {
          goblinInterceptions = interceptions[targetUid];
        } else {
          const targetUidStr = String(targetUid);
          const foundKey = Object.keys(interceptions).find(k => String(k) === targetUidStr);
          if (foundKey) {
            goblinInterceptions = interceptions[foundKey];
          }
        }
      }

      let allSpecialAttacks = [];
      let directDmg = 0;
      let normalDmg = 0;
      let isSpecialBoss = (targetGoblin.isBoss && (targetGoblin.name.includes("Rey Brujo") || targetGoblin.name.includes("La Madre")));
      let isPiromanteBoss = (targetGoblin.isBoss && targetGoblin.name.includes("El Piromante"));
      let isRecaudadorBoss = (targetGoblin.isBoss && targetGoblin.name.includes("El Gran Recaudador"));

      if (greenDiceResult && greenDiceResult.details) {
        let naturalDieIdx = 0;
        greenDiceResult.details.forEach((detail, rawIdx) => {
          if (detail.type === 'die') {
            let isIntercepted = goblinInterceptions.some(asg => Number(asg.goblinDieIndex) === Number(naturalDieIdx));
            let interceptInfo = goblinInterceptions.find(asg => Number(asg.goblinDieIndex) === Number(naturalDieIdx));
            
            // Regla La Madre: Sus ataques son ininterceptables
            if (targetGoblin.isBoss && targetGoblin.name.includes("La Madre") && isIntercepted) {
              isIntercepted = false;
              this.addLog(`🛡️ <strong>Ininterceptable:</strong> Intentaste interceptar el ataque de La Madre, pero fue inútil.`);
            }

            let interceptedByVal = interceptInfo ? interceptInfo.value : null;
            let interceptedByDieId = interceptInfo ? interceptInfo.dieId : null;
            let dieEffects = [];

            // Calcular daño de este dado
            let dieDmg = detail.val;
            let modMsg = "";

            const nextDetail = greenDiceResult.details[rawIdx + 1];
            if (nextDetail && nextDetail.type === 'mod') {
              dieDmg += nextDetail.val;
              modMsg = ` y su modificador de +${nextDetail.val}`;
            }

            if (isIntercepted) {
              goblinDmg -= detail.val;
              if (nextDetail && nextDetail.type === 'mod') {
                goblinDmg -= nextDetail.val;
              }
              this.addLog(`🛡️ Un dado natural de <strong>${detail.val}</strong>${modMsg} de G${targetGoblin.level} fue interceptado.`);
            }

            let currentNaturalIdx = naturalDieIdx;
            naturalDieIdx++;

            // Procesar ataques especiales del dado
            let rollVal = detail.val;
            let attacksForThisDie = (gobDB && gobDB.attacks) ? (gobDB.attacks[rollVal] || []) : [];
            let isDieDirect = attacksForThisDie.some(eff => eff.toLowerCase().includes('daño directo'));

            attacksForThisDie.forEach(eff => {
              const effLow = eff.toLowerCase();
              const isUnskippable = effLow.includes('rotura no esquivable');
              const isNormalBreak = !isUnskippable && (effLow === 'rotura' || effLow.includes('rotura'));
              const isStatus = effLow.includes('escozor') || effLow.includes('tembleque') || effLow.includes('calambre');

              let applied = false;
              let brokenItem = null;
              let rolledValueText = '';

              if (targetGoblin.isBoss && targetGoblin.name.includes("La Madre")) {
                // Las habilidades de La Madre se resuelven de forma estática antes, no usamos el parser genérico
                applied = true;
              } else if (effLow.includes('gana+2 pv por cada carga') || effLow.includes('gana+2 pv por cada carga escozor')) {
                if (!isIntercepted) {
                  applied = true;
                  let escozorCount = p.statusEffects.escozor || 0;
                  let healAmount = escozorCount * 2;
                  targetGoblin.currentHp = Math.min(targetGoblin.maxHp, targetGoblin.currentHp + healAmount);
                  this.addLog(`🔥 <strong>El Piromante (Dado 3):</strong> Se cura <span style="color:#2a9d8f"><strong>${healAmount} PV</strong></span> (2 PV por cada uno de tus ${escozorCount} Escozor. Total: ${targetGoblin.currentHp}/${targetGoblin.maxHp}).`);
                }
              } else if (effLow.includes('1 escozor y 2 puntos de daño por cada carga') || effLow.includes('2 puntos de daño por cada carga escozor')) {
                if (!isIntercepted) {
                  applied = true;
                  let escozorCount = p.statusEffects.escozor || 0;
                  let damageDealt = escozorCount * 2;
                  directDmg += damageDealt;
                  p.statusEffects.escozor = (p.statusEffects.escozor || 0) + 1;
                  this.addLog(`🔥 <strong>El Piromante (Dado 4):</strong> Sufres <span style="color:#ff4d4d"><strong>${damageDealt} Daño Directo</strong></span> (2 PV por cada uno de tus ${escozorCount} Escozor) y recibes <span style="color:#ff6600">1 Escozor</span>.`);
                }
              } else if (effLow.includes('aplica pierde 1d6 negro')) {
                if (!isIntercepted) {
                  applied = true;
                  p.statusEffects.eliminaNegro = (p.statusEffects.eliminaNegro || 0) + 1;
                  this.addLog(`🌑 <strong>El Cazador (Dado 1):</strong> En tu próximo ataque tirarás un dado NEGRO menos.`);
                }
              } else if (effLow.includes('invulnerable a todo el daño en este ataque')) {
                if (!isIntercepted) {
                  applied = true;
                  this.addLog(`🛡️ <strong>El Cazador (Dado 4):</strong> ¡Se ha vuelto invulnerable a todo el daño en este asalto!`);
                }
              } else if (isUnskippable || (!isIntercepted && (isNormalBreak || isStatus))) {
                applied = true;
                if (isUnskippable || isNormalBreak) {
                  brokenItem = this.breakRandomEquipment(p);
                } else if (effLow.includes('2 escozor')) {
                  p.statusEffects.escozor = (p.statusEffects.escozor || 0) + 2;
                  this.addLog(`🔥 <strong>${p.name}</strong> ha recibido <span style="color:#ff6600">2 ESCOZOR</span>.`);
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
              } else if (effLow.includes('curación boss 5 pv') || effLow.includes('curacion boss 5 pv')) {
                if (!isIntercepted) {
                  applied = true;
                  let healAmount = 5;
                  targetGoblin.currentHp = Math.min(targetGoblin.maxHp, targetGoblin.currentHp + healAmount);
                  this.addLog(`🪙 <strong>El Gran Recaudador (Dado 3):</strong> Se cura <span style="color:#2a9d8f"><strong>5 PV</strong></span> (Total: ${targetGoblin.currentHp}/${targetGoblin.maxHp}).`);
                }
              } else if (effLow.includes('drena')) {
                if (!isIntercepted) {
                  applied = true;
                  let amount = 4;
                  let match = effLow.match(/drena\s+(\d+)/);
                  if (match) amount = parseInt(match[1]);
                  targetGoblin.currentHp = Math.min(targetGoblin.maxHp, targetGoblin.currentHp + amount);
                  this.addLog(`🔮 <strong>Drenaje:</strong> El Rey Brujo recupera <span style="color:#ff477e">${amount} PV</span> (Total: ${targetGoblin.currentHp}/${targetGoblin.maxHp}).`);
                }
              } else if (effLow.includes('daño directo')) {
                if (!isIntercepted) {
                  applied = true;
                }
              } else if (effLow.includes('elimina un d6 rojo')) {
                if (!isIntercepted) {
                  applied = true;
                  p.statusEffects.eliminaRojo = (p.statusEffects.eliminaRojo || 0) + 1;
                  this.addLog(`🔮 <strong>Maldición:</strong> <strong>${p.name}</strong> tendrá 1 dado <span style="color:#ef233c">ROJO</span> menos en su próximo ataque.`);
                }
              } else if (effLow.includes('invocación') || effLow.includes('invocacion')) {
                if (!isIntercepted) {
                  applied = true;
                  this.battlefield.goblins.push({
                    ...DB.goblins[1],
                    uid: Date.now() + '-' + Math.random().toString(36).substring(2),
                    currentHp: DB.goblins[1].hp,
                    mo: 0,
                    isInvocacion: true,
                    isHito: true,
                    image: 'assets/Monstruos/invocacion_01.webp'
                  });
                  this.addLog(`🔮 <strong>Invocación:</strong> ¡${targetGoblin.name} invoca un Goblin de Nivel 1 (Hito, sin recompensa de oro)!`);
                }
              } else if (effLow.includes('lanza +')) {
                if (!isIntercepted) {
                  applied = true;
                  let extraDmg = detail.extraDmgRoll;
                  if (extraDmg === undefined) {
                    const dieMatch = effLow.match(/(\d*)d(\d+)/);
                    if (dieMatch) {
                      const num = parseInt(dieMatch[1]) || 1;
                      const faces = parseInt(dieMatch[2]);
                      extraDmg = 0;
                      for (let i = 0; i < num; i++) extraDmg += this.rollDice(faces);
                    } else {
                      extraDmg = 0;
                    }
                  }
                  if (!isSpecialBoss) {
                    if (isDieDirect) directDmg += extraDmg;
                    else normalDmg += extraDmg;
                  } else {
                    goblinDmg += extraDmg;
                  }
                  this.addLog(`🎲 ¡G${targetGoblin.level} lanza un dado extra y suma <span style="color:#ff4d4d">${extraDmg} de daño</span>!`);
                  rolledValueText = ` (obtuvo ${extraDmg})`;
                }
              } else if (effLow === 'daño+2') {
                if (!isIntercepted) {
                  applied = true;
                  if (!isSpecialBoss) {
                    if (isDieDirect) directDmg += 2;
                    else normalDmg += 2;
                  } else {
                    goblinDmg += 2;
                  }
                  this.addLog(`💥 ¡El ataque del Jefe inflige +2 de daño extra!`);
                }
              }

              let effectText = eff + rolledValueText;
              if (applied && brokenItem) {
                effectText = `${eff} [Se rompió: ${brokenItem.name}]`;
              }
              dieEffects.push({ text: effectText, status: applied ? 'aplicado' : 'mitigado' });

              if (isUnskippable || !isIntercepted) {
                allSpecialAttacks.push(eff);
              }
            });

            if (!isIntercepted && !isSpecialBoss && !isRecaudadorBoss) {
              if (isDieDirect) {
                directDmg += dieDmg;
              } else {
                normalDmg += dieDmg;
              }
            }

            if (isRecaudadorBoss && !isIntercepted) {
              if (rollVal === 1) {
                directDmg += dieDmg;
              } else if (rollVal === 2 || rollVal === 4 || rollVal === 5) {
                normalDmg += dieDmg;
              }
            }

            goblinDiceDetails.push({
              goblinName: targetGoblin.name,
              val: detail.val,
              isIntercepted: isIntercepted,
              interceptedBy: interceptedByVal,
              interceptedByDieId: interceptedByDieId,
              effects: dieEffects
            });
          }
        });
      }

      // Antes de aplicar el efecto del jugador, verificamos si el dado usado ya tenía Escozor
      for (let eqId in assignments) {
        let asgs = assignments[eqId];
        if (!Array.isArray(asgs)) asgs = [asgs];

        asgs.forEach(asg => {
          if (asg.targetUid === targetUid) {
            let dieData = c.playerDice.find(d => d.id === asg.dieId);
            if (dieData && dieData.isStung && !dieData.stungDamageApplied) {
              escozorDamageDealt += 2;
              dieData.stungDamageApplied = true; // Evitar daño doble si el dado se procesa varias veces
              this.addLog(`🔥 <strong>${p.name}</strong> usó un dado con escozor contra G${targetGoblin.level} y <span style="color:#ff4d4d">sufrió 2 daño de escozor</span>!`);
              this.damagePlayer(p, 2, true, 'Escozor (dado con escozor)');
            }
          }
        });
      }

      if (isSpecialBoss) {
        let isDirect = allSpecialAttacks.some(a => a.toLowerCase().includes('daño directo'));
        goblinDmg = Math.max(0, goblinDmg);
        if (isDirect) {
          directDmg = goblinDmg;
        } else {
          normalDmg = goblinDmg;
        }
      }

      if (directDmg > 0) {
        totalDirectGoblinDamage += directDmg;
        msgParts.push(`<span style="color:#ff4d4d">contraataca con ${directDmg} Daño Directo</span>`);
      }
      if (normalDmg > 0) {
        totalNormalGoblinDamage += normalDmg;
        msgParts.push(`contraataca con ${normalDmg} daño`);
      }
      
      if (targetGoblin.imbuirAlteracion && (normalDmg > 0 || directDmg > 0)) {
        let altKey = targetGoblin.imbuirAlteracion.toLowerCase();
        if (altKey === 'maldición' || altKey === 'maldicion') {
          p.statusEffects.eliminaRojo = (p.statusEffects.eliminaRojo || 0) + 1;
        } else {
          p.statusEffects[altKey] = (p.statusEffects[altKey] || 0) + 1;
        }
        msgParts.push(`e <span style="color:#00ffff">imbuye ${targetGoblin.imbuirAlteracion}</span>`);
      }
      if (directDmg === 0 && normalDmg === 0) {
        if (goblinInterceptions.length > 0) {
          msgParts.push(`ve su ataque anulado por intercepción`);
        } else {
          msgParts.push(`no logra contraatacar`);
        }
      }

      if (msgParts.length > 0) {
        this.addLog(`Frente a <strong>${p.name}</strong>, el G${targetGoblin.level} ${msgParts.join(' y ')}.`);
      }

      if (targetGoblin.currentHp <= 0) {
        // Goblin derrotado
        goblinsDefeated++;
        if (targetGoblin.isBoss) {
          this.isGameWon = true;
          if (!this.endTime) this.endTime = new Date().toISOString();
        }
        this.checkSpawnNextHito1Goblin(targetGoblin);
        if (!targetGoblin.gaveReward) {
          targetGoblin.gaveReward = true;
          let isNormalReward = (targetGoblin.isHito || targetGoblin.level >= p.level);
          let baseMo = isNormalReward ? targetGoblin.mo : 0;
          if (targetGoblin.isInvocacion) {
            baseMo = 0;
          }
          targetGoblin.rewardMo = baseMo;
          targetGoblin.rewardPex = isNormalReward ? targetGoblin.pex : 0;
          
          let extraMo = (this.activeSenda === 'recaudador') ? 1 : 0;
          p.mo += (baseMo + extraMo);
          if (extraMo > 0) {
            this.lastCombatSaqueoExperto = (this.lastCombatSaqueoExperto || 0) + extraMo;
          }

          if (isNormalReward) {
            this.ganarPex(targetGoblin.pex);
            let moRewardText = targetGoblin.isInvocacion ? "0 mo (invocación)" : `${baseMo} mo`;
            if (extraMo > 0) {
              this.addLog(`⚔️ <strong>${p.name}</strong> eliminó a G${targetGoblin.level}. Recompensa: ${moRewardText}, ${targetGoblin.pex} PEX. <span style="color:#ffd700"><strong>+${extraMo} mo (Saqueo Experto)</strong></span>.`);
            } else {
              this.addLog(`⚔️ <strong>${p.name}</strong> eliminó a G${targetGoblin.level}. Recompensa: ${moRewardText}, ${targetGoblin.pex} PEX.`);
            }
          } else {
            let reason = targetGoblin.isInvocacion ? 'por ser una invocación' : 'por diferencia de nivel';
            if (extraMo > 0) {
              this.addLog(`⚔️ <strong>${p.name}</strong> eliminó a G${targetGoblin.level}. Sin recompensa de oro base ${reason}, pero obtiene <span style="color:#ffd700"><strong>+${extraMo} mo (Saqueo Experto)</strong></span>.`);
            } else {
              this.addLog(`⚔️ <strong>${p.name}</strong> eliminó a G${targetGoblin.level}. Sin Recompensa ${reason}.`);
            }
          }
        }
      }
    });

    // RESOLVER DAÑO Y DEFENSA GLOBAL
    let globalShield = totalPlayerShield + (p.shield || 0);

    // 1. Aplicar daño directo primero
    let directDmgTaken = 0;
    if (totalDirectGoblinDamage > 0) {
      if (this.activeSenda !== 'recaudador') {
        this.addLog(`💥 <strong>${p.name}</strong> sufre <span style="color:#ff4d4d"><strong>${totalDirectGoblinDamage} Daño Directo</strong></span> (no bloqueable).`);
      }
      directDmgTaken = this.damagePlayer(p, totalDirectGoblinDamage, true, 'Daño Directo');
    }

    // 2. Aplicar daño normal contra el escudo global
    let blockedDamage = 0;
    let netDamage = 0;
    let netDmgTaken = 0;
    if (totalNormalGoblinDamage > 0) {
      netDamage = Math.max(0, totalNormalGoblinDamage - globalShield);
      blockedDamage = Math.min(totalNormalGoblinDamage, globalShield);

      if (blockedDamage > 0) {
        this.addLog(`🛡️ <strong>${p.name}</strong> bloquea <span style="color:#3a7bd5"><strong>${blockedDamage} daño</strong></span> con sus escudos (Defensa total: ${globalShield}).`);
      }

      if (netDamage > 0) {
        if (this.activeSenda !== 'recaudador') {
          this.addLog(`💥 <strong>${p.name}</strong> recibe <span style="color:#ff4d4d"><strong>${netDamage} daño</strong></span> sobrante.`);
        }
        netDmgTaken = this.damagePlayer(p, netDamage, false, 'Daño de Combate');
      } else {
        this.addLog(`🛡️ <strong>${p.name}</strong> bloqueó todo el daño entrante.`);
      }
    }

    // Hito 1: Los Carteristas (Senda Recaudador)
    if (this.activeSenda === 'recaudador' && this.currentHito === 2) {
      let playerTookDamage = (directDmgTaken > 0) || (netDmgTaken > 0);
      if (playerTookDamage) {
        if (p.mo > 0) {
          p.mo = Math.max(0, p.mo - 1);
          this.lastCombatLosCarteristasRobo = (this.lastCombatLosCarteristasRobo || 0) + 1;
          this.addLog(`💰 <strong>Los Carteristas:</strong> Un goblin te ha dañado y te roba <span style="color:#ffd700">1 mo extra</span>.`);
        } else {
          this.lastCombatLosCarteristasDmg = (this.lastCombatLosCarteristasDmg || 0) + 1;
          this.addLog(`💸 <strong>Los Carteristas (Sin oro):</strong> Un goblin te ha dañado, no tienes oro para pagar el robo. ¡Sufres 1 Daño Directo!`);
          this.damagePlayer(p, 1, true, 'Los Carteristas (Daño Directo)');
        }
      }
    }

    // 3. Aplicar curación (si el jugador sigue con vida)
    if (p.hp > 0 && playerHeal > 0) {
      p.hp += playerHeal;
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      this.addLog(`💖 <strong>${p.name}</strong> se curó <span style="color:#2a9d8f"><strong>${playerHeal} HP</strong></span> (Total: ${p.hp}/${p.maxHp}).`);
    }

    // Check level up (10 pex = 1 level)
    this.subirNivel(p);

    // Marcar derrotados para animación en lugar de filtrarlos inmediatamente
    this.battlefield.goblins.forEach(g => {
      if (g.currentHp <= 0 && !g.isDying) {
        g.isDying = true;
        
        // Nido de Víboras (Hito 3, Senda Cazador)
        if (this.activeSenda === 'cazador' && this.currentHito === 4 && g.isHito && g.level === 1 && !g.isInvocacion) {
          this.battlefield.goblins.push({
            ...DB.goblins[1],
            uid: Date.now() + '-' + Math.random().toString(36).substring(2),
            currentHp: DB.goblins[1].hp,
            isInvocacion: true,
            mo: 0,
            isHito: true,
            image: 'assets/Monstruos/invocacion_01.webp'
          });
          this.addLog(`🐍 <strong>Nido de Víboras:</strong> Al morir un goblin del nido, aparece 1 Invocación Nivel 1 (Hito).`);
        }
        
        // El goblin da recompensa si es Hito o si su nivel >= nivel de los jugadores
        const pObj = this.players[this.currentPlayerIndex];
        let isNormal = g.isHito || g.level >= pObj.level;
        if (isNormal) {
          g.gaveReward = true;
        }
        if (g.rewardMo === undefined) {
          g.rewardMo = 0;
        }
        if (g.rewardPex === undefined) {
          g.rewardPex = 0;
        }

        // Goblins Bomba: Cada vez que derrotes a un Goblin recibes una carga de Escozor.
        if (this.activeSenda === 'piromante') {
          pObj.statusEffects.escozor = (pObj.statusEffects.escozor || 0) + 1;
          this.lastCombatPiromanteBombs++;
          this.addLog(`💣 <strong>Goblin Bomba:</strong> Al derrotar a G${g.level}, explota y recibes <span style="color:#ff6600">1 Escozor</span>.`);
        }
      }
    });

    // Habilidad del Zeñor de la Guerra: Golpe Certero
    this.lastWarlordExtraDmg = 0;
    let warlordInCombat = c.goblins.some(g => g.isBoss && (this.activeSenda === 'guerrero' || g.name === "Zeñor de la Guerra" || g.name === "Zeor de la Guerra" || g.name.includes("Guerra")));
    let warlordExtraDmg = 0;
    if (warlordInCombat) {
      let playerTookDamage = (totalDirectGoblinDamage > 0) || (totalNormalGoblinDamage > globalShield);
      if (playerTookDamage) {
        let extraD4 = this.rollDice(4);
        if (this.activeSenda !== 'recaudador') {
          this.addLog(`⚔️ <strong>Golpe Certero:</strong> ¡El Zeñor de la Guerra infligió daño y sumó <span style="color:#ff4d4d"><strong>${extraD4} (1d4) de daño extra</strong></span>!`);
        }
        this.damagePlayer(p, extraD4, false, 'Golpe Certero');
        warlordExtraDmg = extraD4;
        this.lastWarlordExtraDmg = extraD4;
      }
    }

    // Comprobar si se dañó al jugador en la senda del Rey Brujo para Corrosión
    let hasCorrosion = false;
    if (this.activeSenda === 'rey_brujo') {
      let playerTookDamage = (totalDirectGoblinDamage > 0) || (totalNormalGoblinDamage > globalShield);
      if (playerTookDamage && p.hp > 0 && p.equipped.some(eq => eq.isActive && !eq.isBroken)) {
        hasCorrosion = true;
      }
    }

    // Registrar intercepciones en playerDiceDetails para que salgan en el debug final
    if (interceptions) {
      for (let gobId in interceptions) {
        let intAsgs = interceptions[gobId] || [];
        let foundGob = c.goblins.find(g => String(g.uid) === String(gobId));
        let gobName = foundGob ? (foundGob.name && foundGob.name !== 'undefined' ? foundGob.name : `Goblin (Nvl ${foundGob.level})`) : "Goblin";
        intAsgs.forEach(asg => {
          playerDiceDetails.push({
            dieId: asg.dieId,
            value: asg.value,
            assignedTo: `Intercepción contra ${gobName}`,
            isRole: false,
            isIntercept: true,
            damage: 0,
            shield: 0,
            heal: 0,
            energyGained: 0,
            target: gobName
          });
        });
      }
    }

    // Guardar estado final detallado de depuración
    try {
      this.lastCombatDebugState = {
        player: {
          name: p.name,
          playerNum: this.currentPlayerIndex + 1,
          hp: hpBefore, // HP al inicio
          shield: shieldBefore, // Escudo al inicio
          energy: energyBefore, // Energía al inicio
          mo: moBefore, // Oro al inicio
          pex: pexBefore, // Experiencia al inicio
          level: levelBefore, // Nivel al inicio
          role: p.role.id,
          equipped: equippedBefore // Equipamiento al inicio
        },
        goblins: this.battlefield.goblins.map(g => {
          const beforeGob = goblinHpsBefore.find(bg => bg.uid === g.uid);
          return {
            uid: g.uid,
            name: g.name,
            level: g.level,
            hp: beforeGob ? beforeGob.hp : g.currentHp,
            hpAfter: g.currentHp,
            maxHp: g.maxHp,
            isBoss: g.isBoss,
            bossStats: g.bossStats,
            isHito: g.isHito,
            isInvocacion: g.isInvocacion
          };
        }),
        playerDice: c.playerDice,
        goblinDice: c.dice && c.dice.green ? c.dice.green : {},
        assignments: assignments,
        interceptions: interceptions,
        resolvedDetails: {
          playerDiceDetails: playerDiceDetails,
          goblinDiceDetails: goblinDiceDetails,
          finalPlayerOutcome: {
            hpBefore: hpBefore,
            hpAfter: p.hp,
            levelBefore: levelBefore,
            levelAfter: p.level,
            directDamageReceived: totalDirectGoblinDamage,
            normalDamageIncoming: totalNormalGoblinDamage,
            damageBlocked: blockedDamage,
            netNormalDamageReceived: netDamage,
            escozorDamageDealt: escozorDamageDealt,
            warlordExtraDmg: warlordExtraDmg,
            finalDamageHpChange: Math.max(0, hpBefore - (p.hp - ((p.level > levelBefore ? p.level - levelBefore : 0) * 5)))
          }
        }
      };
    } catch (e) {
      console.error("Error saving debug state:", e);
    }

    try {
      if (this.lastCombatDebugState) {
        this.lastCombatDebugState.id = (this.combatHistory ? this.combatHistory.length : 0) + 1;
        this.lastCombatDebugState.timestamp = new Date().toLocaleString();
        this.lastCombatDebugState.wave = this.battlefield.waveLevel;
        
        if (!this.combatHistory) {
          this.combatHistory = [];
        }
        this.combatHistory.push(JSON.parse(JSON.stringify(this.lastCombatDebugState)));
      }
    } catch(e) {
      console.error("Error saving to combatHistory:", e);
    }

    this.lastCombatAcquiredEffects = {
      escozor: Math.max(0, (p.statusEffects ? (p.statusEffects.escozor || 0) : 0) - escozorBefore),
      calambre: Math.max(0, (p.statusEffects ? (p.statusEffects.calambre || 0) : 0) - calambreBefore),
      tembleque: Math.max(0, (p.statusEffects ? (p.statusEffects.tembleque || 0) : 0) - temblequeBefore)
    };

    p.shield = 0; // Limpiar escudo tras el combate
    this.currentCombat = null;

    // Ejecutar habilidades de rol post-combate para bots (ej: rematar con Guerrero)
    if (p.isBot && window.botManager && typeof window.botManager.executeEndTurnRoleAbilities === 'function') {
      window.botManager.executeEndTurnRoleAbilities(p);
    }

    if (hasCorrosion) {
      this.pendingCorrosionChoice = {
        player: p,
        callback: () => {
          this.checkGameOver();
          this.postActionPhase();
        }
      };
    } else {
      this.checkGameOver();
      this.postActionPhase();
    }
    this.isResolvingCombat = false;
  }

  shuffleDecks() {
    for (let type in this.market) {
      this.market[type].sort(() => Math.random() - 0.5);
    }
  }

  setupPlayers(numPlayers, selectedRoles = [], customSettings = { hp: 10, maxHp: 10, energy: 0, mo: 2, hito: 1, level: 1, senda: 'iniciacion', difficulty: 'facil' }, selectedBots = []) {
    this.startTime = new Date().toISOString();
    this.endTime = null;
    this.currentHito = customSettings.hito !== undefined ? customSettings.hito : 1;
    this.activeSenda = customSettings.senda || 'iniciacion';
    this.difficulty = customSettings.difficulty || 'facil';
    this.pendingHito1Goblins = 0;
    let initLvl = customSettings.level !== undefined ? customSettings.level : 1;
    let basePex = 0;
    if (initLvl === 2) basePex = 2 * numPlayers;
    if (initLvl === 3) basePex = 6 * numPlayers;
    if (initLvl === 4) basePex = 12 * numPlayers;
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
        isBot: selectedBots[i] || false,
        shield: 0,
        role: roleObj,
        energy: customSettings.energy,
        equipped: [
          { ...DB.equipment.inicial[0], isBroken: false, isActive: true },
          { ...DB.equipment.inicial[1], isBroken: false, isActive: true }
        ],
        statusEffects: { escozor: 0, calambre: 0, tembleque: 0, eliminaRojo: 0 },
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
    
    if (this.activeSenda === 'horda') {
      this.setupHordaWave();
      this.generateHordaPRPerRound();
    } else {
      this.spawnInitialGoblins();
    }
    this.addLog(`¡La aventura comienza en la Oleada ${this.battlefield.waveLevel}! Fase de Mercado.`);
    console.log('nextTurn calling startPlayerTurn'); this.startPlayerTurn(this.getCurrentPlayer());
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

  setupHordaWave() {
    if (this.activeSenda !== 'horda') return;
    
    // 1. La Avanzadilla (Despliegue Gratis)
    let waveLv = Math.min(this.battlefield.waveLevel, 5);
    let gobTemplate = DB.goblins[waveLv];
    let spawnedCount = 0;
    if (gobTemplate) {
      for (let i = 0; i < this.players.length; i++) {
        this.battlefield.goblins.push({
          ...gobTemplate,
          uid: Date.now() + '-avanzadilla-' + i + '-' + Math.random().toString(36).substring(2),
          currentHp: gobTemplate.hp
        });
        spawnedCount++;
      }
    }
    
    // 2. La Bolsa de Rencor Inicial
    let initialPR = this.players.length;
    if (this.difficulty === 'pesadilla') initialPR += 2;
    this.hordaPR += initialPR;
    
    this.addLog(`🤖 <strong>La Avanzadilla:</strong> Llegan ${spawnedCount} Goblins de Nivel ${waveLv}.`);
    this.addLog(`💀 <strong>Bolsa de Rencor:</strong> El Señor de la Horda recibe ${initialPR} PR iniciales (Total: ${this.hordaPR}).`);
  }

  generateHordaPRPerRound() {
    if (this.activeSenda !== 'horda') return;
    let P = this.players.length;
    let W = this.battlefield.waveLevel;
    let prToGain = W + P - 1;
    this.hordaPR += prToGain;
    this.addLog(`🩸 <strong>Rencor Creciente:</strong> Nueva ronda. El Señor de la Horda gana ${prToGain} PR (Total: ${this.hordaPR}).`);
    
    if (typeof window !== 'undefined' && window.renderBattlefield) {
      setTimeout(() => window.renderBattlefield(), 50);
    }
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  getPlayerColor(player) {
    if (!player) return '#ffffff';
    // Colores de jugadores: Jugador 1 (Celeste), Jugador 2 (Púrpura/Rosa), Jugador 3 (Naranja/Ámbar), Jugador 4 (Verde vibrante)
    const colors = ["#4cc9f0", "#b5179e", "#ffb703", "#2ecc71"];
    return colors[(player.id - 1) % colors.length];
  }

  nextTurn() { console.log('nextTurn start');
    let previousPlayer = this.getCurrentPlayer();
    if (previousPlayer && previousPlayer.isBot && window.botManager) {
      window.botManager.executeEndTurnRoleAbilities(previousPlayer);
    }

    this.isMarketPhase = false;
    this.lastActionWasCombat = false;  
    
    const continueNextTurn = () => {
      if (this.players[this.currentPlayerIndex]) {
        this.players[this.currentPlayerIndex].goblinsFoughtThisTurn = [];
      }

      if (this.checkGameOver()) return;

      let iterations = 0;
      let roundFinished = false;
      do {
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.players.length) {
          this.currentPlayerIndex = 0;
          this.battlefield.actionCount++;
          roundFinished = true;

          if (this.battlefield.actionCount >= 3) {
            this.resolveWavePhase();
          }
        }
        iterations++;
        if (iterations > this.players.length * 2) break; // Fallback
      } while (this.players[this.currentPlayerIndex] && this.players[this.currentPlayerIndex].hp <= 0 && !this.isGameOver);

      if (roundFinished && this.activeSenda === 'horda' && !this.isGameOver) {
        this.generateHordaPRPerRound();
      }

      if (!this.isGameOver && !this.isRetaliationPhase && !this.isResolvingWaveSequentially) {
        console.log('nextTurn calling startPlayerTurn'); this.startPlayerTurn(this.getCurrentPlayer());
      }
      
      // Auto-guardado silencioso al iniciar el turno
      if (typeof window !== 'undefined' && window.saveGame) {
        window.saveGame(true);
      }
      
      // Forzar actualización de UI si venimos de un callback asíncrono
      if (typeof window !== 'undefined' && window.updateUI) {
        if (!this.isResolvingCombat) {
          window.updateUI();
        }
      }
    };

    if (previousPlayer) {
      const color = this.getPlayerColor(previousPlayer);
      this.addLog(`<span style="color: ${color};">🔄<<< <strong>${previousPlayer.name}</strong> ha finalizado su turno.</span>`);
      
      // Toxina Goblin (Senda Cazador)
      if (this.activeSenda === 'cazador') {
        let activeGobs = this.battlefield.goblins.filter(g => g.currentHp > 0 && !g.isDying).length;
        if (activeGobs > 0) {
          previousPlayer.hp = Math.max(0, previousPlayer.hp - activeGobs);
          this.addLog(`☣️ <strong>Toxina Goblin:</strong> Al finalizar tu turno sufres <span style="color:#ff4d4d"><strong>${activeGobs} Daño Directo</strong></span> por las toxinas. (HP: ${previousPlayer.hp}/${previousPlayer.maxHp})`);
          
          if (this.checkGameOver()) return;
          
          alert(`⚠️ Toxina Goblin:\nAl finalizar tu turno hay ${activeGobs} goblins vivos en la mesa.\n\nSufres ${activeGobs} de Daño Directo.`, () => {
             continueNextTurn();
          });
          return;
        }
      }
    }

    continueNextTurn();
  }

  startPlayerTurn(player) {
    if (!player || this.isGameOver) return;
    
    // Evitar iniciar turno si ya se está en represalia o resolución de oleada (doble salvaguarda)
    if (this.isRetaliationPhase || this.isResolvingWaveSequentially) return;

    this.isTurnoCompleted = false;

    const color = this.getPlayerColor(player);
    this.addLog(`<span style="color: ${color};">➡️>>> Turno de <strong>${player.name}</strong> (Vida: ${player.hp}/${player.maxHp}, Oro: ${player.mo}).</span>`);
    
    // Mini-turno del Señor de la Horda (Modo Horda)
    if (this.activeSenda === 'horda') {
      if (typeof window !== 'undefined' && typeof window.executeHordeLordTurn === 'function') {
        window.executeHordeLordTurn();
      } else {
        // IA pospuesta a una fase posterior
        this.addLog(`💀 <strong>El Señor de la Horda</strong> evalúa la mesa en silencio... (La IA llegará pronto)`);
      }
    }

    if (this.activeSenda === 'rey_brujo') {
      const brokenCount = player.equipped.filter(eq => eq.isActive && eq.isBroken).length;
      if (brokenCount >= 2) {
        this.addLog(`💨 <strong>Aire Viciado:</strong> <strong>${player.name}</strong> tiene ${brokenCount} equipos rotos y sufre <span style="color:#ff4d4d"><strong>${brokenCount} Daño Directo</strong></span>.`);
        this.damagePlayer(player, brokenCount, true, 'Aire Viciado');
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(`¡AIRE VICIADO!
La atmósfera corrupta del Rey Brujo te envenena:
Equipos rotos: Tienes ${brokenCount} equipos rotos.
Daño directo: Sufres ${brokenCount} de daño.`);
        }
      }
    }
  }

  consumeAction() {
    this.isTurnoCompleted = true;
    this.postActionPhase();
  }

  postActionPhase() {
    let p = this.getCurrentPlayer();
    if (!p) return;

    // Hito 3: El Prestamista (Senda Recaudador)
    // "Al final de cada acción, si el Nivel 3 sigue vivo, debes pagar 1mo o sufres 1 Daño Directo."
    if (this.activeSenda === 'recaudador' && this.currentHito === 4) {
      let lvl3Exists = this.battlefield.goblins.some(g => g.level === 3 && g.currentHp > 0 && !g.isDying);
      if (lvl3Exists) {
        if (p.mo > 0) {
          p.mo = Math.max(0, p.mo - 1);
          this.addLog(`💰 <strong>El Prestamista:</strong> Pagas 1 mo al final de tu acción para evitar la penalización del Goblin de Nivel 3.`);
        } else {
          this.addLog(`💸 <strong>El Prestamista (Sin oro):</strong> No tienes oro para pagar la tasa del prestamista. ¡Sufres 1 Daño Directo!`);
          this.damagePlayer(p, 1, true, 'El Prestamista');
        }
      }
    }
    
    if (p.hp <= 0) {
      this.nextTurn();
      return;
    }
    
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

      const justBoughtId = Date.now() + '-' + Math.random().toString(36).substring(2);
      p.equipped.push({ ...card, isBroken: false, isActive: canFit, _justBoughtId: justBoughtId });

      // Limpiar la flag después de 500ms para evitar problemas si se guarda la partida
      setTimeout(() => {
        let eq = p.equipped.find(e => e._justBoughtId === justBoughtId);
        if (eq) delete eq._justBoughtId;
      }, 500);

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
    if (this.activeSenda === 'horda') return false;
    if (this.currentHito > 5) return false;

    // Validar que no haya Goblins de Hito activos
    if (this.battlefield.goblins.some(g => g.isHito)) {
      this.addLog("⚠️ No se puede desplegar un nuevo Hito mientras haya Goblins de Hito en la mesa.");
      return false;
    }

    const sendaHitos = DB.hitos[this.activeSenda] || DB.hitos.iniciacion;
    let hito = sendaHitos[this.currentHito - 1];

    if (hito.isBoss) {
      let bossHp = hito.bossStats.hpMultiplier * this.players.length;
      this.battlefield.goblins.push({
        ...DB.goblins[5],
        uid: Date.now() + '-' + Math.random().toString(36).substring(2),
        currentHp: bossHp,
        maxHp: bossHp,
        isBoss: true,
        isHito: true,
        name: hito.name,
        dice: hito.bossStats.dice,
        attacks: hito.bossStats.attacks || DB.goblins[5].attacks,
        image: hito.bossStats.image || 'assets/Monstruos/Jefes/Inicicion.webp'
      });
    } else {
      if ((this.activeSenda === 'guerrero' || this.activeSenda === 'rey_brujo') && this.currentHito === 1) {
        // Hito 1: Despliégalos uno a uno
        let totalGobs = hito.goblins.length * this.players.length;
        this.pendingHito1Goblins = totalGobs - 1;
        this.battlefield.goblins.push({
          ...DB.goblins[1],
          uid: Date.now() + '-' + Math.random().toString(36).substring(2),
          currentHp: DB.goblins[1].hp,
          isHito: true
        });
      } else {
        for (let p = 0; p < this.players.length; p++) {
          let pairGoblins = [];
          for (let lvl of hito.goblins) {
            let extraProps = {};
            if (this.activeSenda === 'la_madre' && hito.id === 3) {
              extraProps.mo = 0;
              extraProps.image = 'assets/Monstruos/invocacion_01.webp';
            }
            let gob = {
              ...DB.goblins[lvl],
              ...extraProps,
              uid: Date.now() + '-' + Math.random().toString(36).substring(2),
              currentHp: DB.goblins[lvl].hp,
              isHito: true
            };
            pairGoblins.push(gob);
            this.battlefield.goblins.push(gob);
          }
          // Emparejar goblins si es el Hito 2 del Rey Brujo (El Oficial)
          if (this.activeSenda === 'rey_brujo' && this.currentHito === 2) {
            if (pairGoblins.length === 2) {
              pairGoblins[0].partnerUid = pairGoblins[1].uid;
              pairGoblins[1].partnerUid = pairGoblins[0].uid;
            }
          }
        }
      }
    }
    this.currentHito++;
    let hitoName = sendaHitos[this.currentHito - 2].name;
    this.addLog(`🔥 <strong>HITO DESPLEGADO: ${hitoName}</strong> 🔥`);

    // Hito 1: La Chispa (Senda Piromante)
    if (this.activeSenda === 'piromante' && this.currentHito === 2) {
      this.players.forEach(p => {
        if (p.hp > 0) {
          p.statusEffects.escozor = (p.statusEffects.escozor || 0) + 1;
          this.addLog(`💥 <strong>La Chispa:</strong> <strong>${p.name}</strong> recibe inmediatamente <span style="color:#ff6600">1 Escozor</span>.`);
        }
      });
    }

    // Hito 4: Emboscada (Senda Cazador)
    if (this.activeSenda === 'cazador' && this.currentHito === 5) {
      let hitosGobs = this.battlefield.goblins.filter(g => g.isHito && !g.isDying && g.currentHp > 0);
      if (hitosGobs.length > 0) {
        this.addLog(`⚠️ <strong>Emboscada:</strong> Sufres inmediatamente el efecto de Represalia.`);
        this.retaliationQueue = [...hitosGobs];
        this.isRetaliationPhase = true;
      }
    }

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
      this.retaliationEscudoDeOroTriggeredPlayers = [];
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
      let damage = goblin.level;
      if (goblin.frenesi) {
        damage += 1;
        this.addLog(`🩸 <strong>Frenesí:</strong> El ataque de ${goblin.name || ('G' + goblin.level)} hace +1 de daño.`);
      }

      if (this.activeSenda !== 'recaudador') {
        this.addLog(`💀 <strong>Represalia:</strong> Causó ${damage} daño a <strong>${player.name}</strong>.`);
      }

      if (!this.retaliationEscudoDeOroTriggers) {
        this.retaliationEscudoDeOroTriggers = [];
      }
      const hpBefore = player.hp;
      const moBefore = player.mo;

      this.damagePlayer(player, damage, false, 'Represalia');

      if (this.activeSenda === 'recaudador') {
        if (this.lastDamageAppliedEscudoDeOro) {
          const hpDiff = hpBefore - player.hp;
          const moDiff = moBefore - player.mo;
          this.retaliationEscudoDeOroTriggers.push({
            playerName: player.name,
            goblinLevel: goblin.level,
            moLost: moDiff,
            hpLost: hpDiff,
            hasGold: moBefore > 0
          });
        } else {
          this.addLog(`💀 <strong>Represalia:</strong> Causó ${damage} daño a <strong>${player.name}</strong> (HP: ${player.hp}/${player.maxHp}).`);
        }
      }

      // Eliminar de la cola
      this.retaliationQueue.splice(gobIdx, 1);

      if (this.isGameOver) {
        this.isRetaliationPhase = false;
        return true;
      }

      const anyAlive = this.players.some(p => p.hp > 0);
      
      // Comprobar Corrosión en represalia
      if (this.activeSenda === 'rey_brujo' && damage > 0 && player.hp > 0 && player.equipped.some(eq => eq.isActive && !eq.isBroken)) {
        this.pendingCorrosionChoice = {
          player: player,
          callback: () => {
            if (this.retaliationQueue.length === 0 || !anyAlive) {
              this.isRetaliationPhase = false;
              this.completeWaveAdvancement();
            }
          }
        };
      } else {
        if (this.retaliationQueue.length === 0 || !anyAlive) {
          this.isRetaliationPhase = false;
          this.completeWaveAdvancement();
        }
      }
      return true;
    }
    return false;
  }

  completeWaveAdvancement() {
    this.battlefield.actionCount = 0;
    
    // Restablecer la vida de los goblins normales supervivientes (no jefes) a su valor original
    let restoredCount = 0;
    this.battlefield.goblins.forEach(g => {
      if (!g.isBoss && g.currentHp > 0 && !g.isDying) {
        let originalHp = g.hp;
        if (originalHp !== undefined && g.currentHp < originalHp) {
          g.currentHp = originalHp;
          restoredCount++;
        }
      }
    });
    if (restoredCount > 0) {
      this.addLog(`💖 La vida de los goblins supervivientes se ha restablecido al máximo.`);
    }

    this.battlefield.waveLevel++;
    if (this.activeSenda === 'horda') {
      
    }

    this.addLog(`<span style="color:#f54281"><strong>*******************************************</strong></span>`);
    this.addLog(`<span style="color:#f54281"><strong>RESOLVIENDO FASE DE OLEADA ${this.battlefield.waveLevel} </strong></span>`);

    // Iniciar máquina de estados para mutaciones visuales
    this.isResolvingWaveSequentially = true;
    this.wavePhaseState = {
      active: true,
      phase: 'mutations',
      currentLvl: 1
    };
  }

  // Ejecuta 1 paso visual de la fase de oleada. Devuelve un objeto detallando el evento.
  executeNextWaveStep() { console.log('executeNextWaveStep', this.wavePhaseState.phase);
    if (!this.wavePhaseState.active) return null;

    if (this.wavePhaseState.phase === 'mutations') {
      while (this.wavePhaseState.currentLvl < 5) {
        let lvl = this.wavePhaseState.currentLvl;
        
        // Función auxiliar para buscar y fusionar una pareja
        const findAndMerge = (conditionFn, typeName, logHtml, extraProps = {}) => {
          let candidates = this.battlefield.goblins.filter(g => g.level === lvl && conditionFn(g));
          if (candidates.length >= 2) {
            let gob1 = candidates[0];
            let gob2 = candidates[1];
            
            // Eliminar ambos
            this.battlefield.goblins = this.battlefield.goblins.filter(g => g.uid !== gob1.uid && g.uid !== gob2.uid);
            
            // Determinar si conserva el hito según el manual
            const isGob1Wave = !gob1.isHito && !gob1.isInvocacion;
            const isGob2Wave = !gob2.isHito && !gob2.isInvocacion;
            const keepHito = (gob1.isHito || gob2.isHito) && !isGob1Wave && !isGob2Wave;

            // Crear el nuevo
            let newGoblin = {
              ...DB.goblins[lvl + 1],
              ...extraProps,
              uid: Date.now() + '-' + Math.random().toString(36).substring(2),
              currentHp: DB.goblins[lvl + 1].hp,
              isMutated: true
            };
            if (keepHito) {
              newGoblin.isHito = true;
            }
            this.battlefield.goblins.push(newGoblin);
            
            this.addLog(`🧬 <span style="color:#f54281"><strong>Mutación:</strong></span> ${logHtml}`);
            
            return {
              type: 'mutation',
              uidsToRemove: [gob1.uid, gob2.uid],
              newGoblin: newGoblin
            };
          }
          return null;
        };

        // 1. Clases Puras
        let res = findAndMerge(g => !g.isHito && !g.isInvocacion, 'normal', `G${lvl} + G${lvl} --> G${lvl + 1}`);
        if (res) return res;
        
        res = findAndMerge(g => g.isHito && !g.isInvocacion, 'hito', `<span style="color:#a545d1">Hito G${lvl}</span> + <span style="color:#a545d1">Hito G${lvl}</span> --> <span style="color:#a545d1">Hito G${lvl + 1}</span>`, { isHito: true });
        if (res) return res;

        res = findAndMerge(g => g.isInvocacion, 'invocacion', `<span style="color:#4cc9f0">Invocación G${lvl}</span> + <span style="color:#4cc9f0">Invocación G${lvl}</span> --> <span style="color:#4cc9f0">Invocación G${lvl + 1}</span>`, { isInvocacion: true, mo: 0, image: 'assets/Monstruos/invocacion_0' + (lvl + 1) + '.webp' });
        if (res) return res;

        // 2. Clases Mixtas (si no hay puras)
        let normales = this.battlefield.goblins.filter(g => g.level === lvl && !g.isHito && !g.isInvocacion);
        let hitos = this.battlefield.goblins.filter(g => g.level === lvl && g.isHito && !g.isInvocacion);
        let invocaciones = this.battlefield.goblins.filter(g => g.level === lvl && g.isInvocacion);

        if (normales.length >= 1 && invocaciones.length >= 1) {
          this.battlefield.goblins = this.battlefield.goblins.filter(g => g.uid !== normales[0].uid && g.uid !== invocaciones[0].uid);
          let newGob = { ...DB.goblins[lvl + 1], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[lvl + 1].hp, isMutated: true };
          this.battlefield.goblins.push(newGob);
          this.addLog(`🧬 <span style="color:#f54281"><strong>Mutación Mixta:</strong></span> G${lvl} + <span style="color:#4cc9f0">Invocación G${lvl}</span> --> G${lvl + 1}`);
          return { type: 'mutation', uidsToRemove: [normales[0].uid, invocaciones[0].uid], newGoblin: newGob };
        }

        if (normales.length >= 1 && hitos.length >= 1) {
          this.battlefield.goblins = this.battlefield.goblins.filter(g => g.uid !== normales[0].uid && g.uid !== hitos[0].uid);
          let newGob = { ...DB.goblins[lvl + 1], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[lvl + 1].hp, isMutated: true };
          this.battlefield.goblins.push(newGob);
          this.addLog(`🧬 <span style="color:#f54281"><strong>Mutación Mixta:</strong></span> G${lvl} + <span style="color:#a545d1">Hito G${lvl}</span> --> G${lvl + 1}`);
          return { type: 'mutation', uidsToRemove: [normales[0].uid, hitos[0].uid], newGoblin: newGob };
        }

        if (invocaciones.length >= 1 && hitos.length >= 1) {
          this.battlefield.goblins = this.battlefield.goblins.filter(g => g.uid !== invocaciones[0].uid && g.uid !== hitos[0].uid);
          let newGob = { ...DB.goblins[lvl + 1], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[lvl + 1].hp, isMutated: true, isInvocacion: true, mo: 0, isHito: true, image: 'assets/Monstruos/invocacion_0' + (lvl + 1) + '.webp' };
          this.battlefield.goblins.push(newGob);
          this.addLog(`🧬 <span style="color:#f54281"><strong>Mutación Mixta:</strong></span> <span style="color:#4cc9f0">Invocación G${lvl}</span> + <span style="color:#a545d1">Hito G${lvl}</span> --> <span style="color:#4cc9f0">Invocación G${lvl + 1} (Hito)</span>`);
          return { type: 'mutation', uidsToRemove: [invocaciones[0].uid, hitos[0].uid], newGoblin: newGob };
        }

        // Si llegamos aquí, no hay más parejas en este nivel, pasamos al siguiente
        this.wavePhaseState.currentLvl++;
      }

      // Terminamos mutaciones, pasamos a spawns
      this.wavePhaseState.phase = 'spawns';
      return { type: 'continue' };
    }

    if (this.wavePhaseState.phase === 'spawns') {

      let spawns = [];
      const diff = this.difficulty || 'facil';

      if (diff === 'chupado') {
        // Nivel Chupado: Voltea boca arriba tantos Goblins de nivel 1 como jugadores.
        for (let i = 0; i < this.players.length; i++) {
          let gob = { ...DB.goblins[1], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[1].hp };
          this.battlefield.goblins.push(gob);
          spawns.push(gob);
        }
        this.addLog(`🔥 <span style="color:#f54281"><strong>Aparición (Chupado):</strong></span> ${this.players.length} x G1`);
      } 
      else if (diff === 'facil') {
        // Nivel Fácil: Voltea boca arriba tantos Goblins de nivel de la Oleada actual como jugadores.
        let nivelAparecer = Math.min(this.battlefield.waveLevel, 5);
        if (DB.goblins[nivelAparecer]) {
          for (let i = 0; i < this.players.length; i++) {
            let gob = { ...DB.goblins[nivelAparecer], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[nivelAparecer].hp };
            this.battlefield.goblins.push(gob);
            spawns.push(gob);
          }
          this.addLog(`🔥 <span style="color:#f54281"><strong>Aparición (Fácil):</strong></span> ${this.players.length} x G${nivelAparecer}`);
        }
      } 
      else if (diff === 'medio') {
        // Nivel Medio: Voltea boca arriba tantos Goblins de nivel 1 como jugadores. A continuación voltea un goblin del nivel de la oleada actual.
        for (let i = 0; i < this.players.length; i++) {
          let gob = { ...DB.goblins[1], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[1].hp };
          this.battlefield.goblins.push(gob);
          spawns.push(gob);
        }
        this.addLog(`🔥 <span style="color:#f54281"><strong>Aparición (Medio):</strong></span> ${this.players.length} x G1`);

        let nivelAparecer = Math.min(this.battlefield.waveLevel, 5);
        if (DB.goblins[nivelAparecer]) {
          let gob = { ...DB.goblins[nivelAparecer], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[nivelAparecer].hp };
          this.battlefield.goblins.push(gob);
          spawns.push(gob);
          this.addLog(`🔥 <span style="color:#f54281"><strong>Aparición (Medio):</strong></span> 1 x G${nivelAparecer}`);
        }
      } 
      else if (diff === 'dificil') {
        // Nivel Difícil: Voltea boca arriba tantos Goblins de nivel 1 como jugadores. A continuación voltea un goblin de cada nivel superior hasta la oleada actual, incluida.
        for (let i = 0; i < this.players.length; i++) {
          let gob = { ...DB.goblins[1], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[1].hp };
          this.battlefield.goblins.push(gob);
          spawns.push(gob);
        }
        this.addLog(`🔥 <span style="color:#f54281"><strong>Aparición (Difícil):</strong></span> ${this.players.length} x G1`);

        let nivelMax = Math.min(this.battlefield.waveLevel, 5);
        for (let lvl = 2; lvl <= nivelMax; lvl++) {
          if (DB.goblins[lvl]) {
            let gob = { ...DB.goblins[lvl], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[lvl].hp };
            this.battlefield.goblins.push(gob);
            spawns.push(gob);
            this.addLog(`🔥 <span style="color:#f54281"><strong>Aparición (Difícil):</strong></span> 1 x G${lvl}`);
          }
        }
      }

      // Eclosión Tardía (Senda de La Madre)
      if (this.activeSenda === 'la_madre') {
        let gob = { ...DB.goblins[1], uid: Date.now() + '-' + Math.random().toString(36).substring(2), currentHp: DB.goblins[1].hp };
        this.battlefield.goblins.push(gob);
        spawns.push(gob);
        this.addLog(`🥚 <span style="color:#f54281"><strong>Eclosión Tardía:</strong></span> 1 x G1 extra por La Madre`);
      }

      // Regeneración de Jefes
      this.battlefield.goblins.forEach(g => {
        if (g.isBoss && g.currentHp > 0) {
          let regenAmount = (g.regen || 5) * this.players.length;
          g.currentHp = Math.min(g.maxHp, g.currentHp + regenAmount);
          this.addLog(`💖 <span style="color:#ff477e"><strong>Regeneración de Jefe:</strong></span> ${g.name} recuperó ${regenAmount} PV (Total: ${g.currentHp}/${g.maxHp}).`);
        }
      });

      // Regla de Hito 3 de El Rey Brujo: La Plaga (respawn de derrotados)
      if (this.activeSenda === 'rey_brujo' && this.currentHito === 4) {
        let aliveHitoGoblins = this.battlefield.goblins.filter(g => g.isHito && g.currentHp > 0);
        let targetCount = 3 * this.players.length;
        if (aliveHitoGoblins.length > 0 && aliveHitoGoblins.length < targetCount) {
          let toSpawn = targetCount - aliveHitoGoblins.length;
          for (let i = 0; i < toSpawn; i++) {
            let gob = {
              ...DB.goblins[1],
              uid: Date.now() + '-' + Math.random().toString(36).substring(2),
              currentHp: DB.goblins[1].hp,
              isHito: true,
              isInvocacion: true,
              mo: 0,
              image: 'assets/Monstruos/invocacion_01.webp'
            };
            this.battlefield.goblins.push(gob);
            spawns.push(gob);
          }
          this.addLog(`🔮 <strong>La Plaga:</strong> ¡Se reinvocan ${toSpawn} G1 del Hito 3 que habían sido eliminados!`);
        }
      }

      this.addLog(`<span style="color:#f54281"><strong>*******************************************</strong></span>`);
      
      this.wavePhaseState.phase = 'done';
      this.wavePhaseState.active = false;
      this.isResolvingWaveSequentially = false;

      return { type: 'spawn', goblins: spawns };
    }

    return null;
  }


  // MÉTODOS DE ACCIÓN BÁSICOS

  performActionGold() {
    if (this.isMarketPhase) return false;
    this.lastActionWasCombat = false;
    let p = this.players[this.currentPlayerIndex];
    
    if (this.activeSenda === 'piromante') {
      if (this.currentHito === 6) { // Contra el Jefe Final
        p.mo += 1;
        this.addLog(`<strong>${p.name}</strong> cobró 1 mo. *(Botín Humeante desactivado)*`);
      } else {
        p.mo += 1;
        p.hp = Math.max(0, p.hp - 2);
        let escozorCleared = p.statusEffects.escozor || 0;
        p.statusEffects.escozor = 0;
        this.addLog(`🔥 <strong>Botín Humeante:</strong> <strong>${p.name}</strong> cobró 1 mo, sufrió <span style="color:#ff4d4d">2 Daño Directo</span> y eliminó sus estados de Escozor (se limpiaron ${escozorCleared} cargas, HP: ${p.hp}/${p.maxHp}).`);
        if (this.checkGameOver()) return true;
      }
    } else {
      p.mo += 1;
      this.addLog(`<strong>${p.name}</strong> cobró 1 mo.`);
    }
    this.consumeAction();
    return true;
  }

  performActionGoldAndDamage() {
    if (this.isMarketPhase) return false;
    this.lastActionWasCombat = false;
    let p = this.players[this.currentPlayerIndex];
    
    if (this.activeSenda === 'piromante') {
      if (this.currentHito === 6) { // Contra el Jefe Final
        p.mo += 2;
        p.hp = Math.max(0, p.hp - 1);
        this.addLog(`<strong>${p.name}</strong> cobró 2 mo pero sufrió 1 daño (HP: ${p.hp}/${p.maxHp}). *(Botín Humeante desactivado)*`);
        if (this.checkGameOver()) return true;
      } else {
        p.mo += 2;
        p.hp = Math.max(0, p.hp - 2);
        let escozorCleared = p.statusEffects.escozor || 0;
        p.statusEffects.escozor = 0;
        this.addLog(`🔥 <strong>Botín Humeante:</strong> <strong>${p.name}</strong> cobró 2 mo, sufrió <span style="color:#ff4d4d">2 Daño Directo</span> y eliminó sus estados de Escozor (se limpiaron ${escozorCleared} cargas, HP: ${p.hp}/${p.maxHp}).`);
        if (this.checkGameOver()) return true;
      }
    } else {
      p.mo += 2;
      if (this.activeSenda !== 'recaudador') {
        this.addLog(`<strong>${p.name}</strong> cobró 2 mo pero sufrió 1 daño (HP: ${p.hp}/${p.maxHp}).`);
      } else {
        this.addLog(`<strong>${p.name}</strong> cobró 2 mo.`);
      }
      this.damagePlayer(p, 1, false, 'Cobrar 2 mo');
    }
    this.consumeAction();
    return true;
  }

  performActionRole() {
    if (this.isMarketPhase) return false;
    this.lastActionWasCombat = false;
    let p = this.players[this.currentPlayerIndex];
    
    // Simular tirada de dados para coger el valor que dé más energía
    let bestEnergy = 0;
    let bestDieVal = 1;
    
    p.dicePool.forEach(d => {
      let val = Math.floor(Math.random() * d.faces) + 1;
      let energyGain = p.role.energyRates[val - 1] || 0;
      if (energyGain > bestEnergy) {
        bestEnergy = energyGain;
        bestDieVal = val;
      }
    });

    p.energy += bestEnergy;
    this.addLog(`🔷 <strong>${p.name}</strong> usó la acción Rellenar Rol. Sacó un ${bestDieVal} y ganó ${bestEnergy} Energía.`);
    this.consumeAction();
    return true;
  }

  useRoleAbility(playerIndex, targetId = null, energyCost = null, damageAmount = 1) {
    let p = this.players[playerIndex];
    const roleId = p.role.id;

    // Si no hay objetivo, pedimos objetivo mediante el modal
    if (targetId === null) {
      return "NEED_TARGET";
    }

    let isSelf = (targetId === 'self' || targetId === playerIndex);
    let actualEnergyCost = energyCost;
    let equipIndex = null;

    if (roleId === 'curandero') {
      // Para Curandero, el tercer parámetro de la UI es el equipIndex
      equipIndex = energyCost;
      actualEnergyCost = isSelf ? 1 : 2;
    } else {
      if (actualEnergyCost === null) {
        if (roleId === 'guerrero' || roleId === 'mago') {
          actualEnergyCost = damageAmount;
        } else {
          actualEnergyCost = isSelf ? 1 : 2;
        }
      }
    }

    if (p.energy < actualEnergyCost) return false;

    if (roleId === 'ladron') {
      let targetP = isSelf ? p : (typeof targetId === 'number' ? this.players[targetId] : null);
      if (targetP && !isSelf) {
        p.energy -= actualEnergyCost;
        targetP.mo += 1;
        this.addLog(`🔷 <strong>${p.name}</strong> usó su rol (Ladrón) para dar 1 mo a ${targetP.name}.`);
        return true;
      } else {
        p.energy -= actualEnergyCost;
        p.mo += 1;
        this.addLog(`🔷 <strong>${p.name}</strong> usó su rol (Ladrón) para obtener 1 mo.`);
        return true;
      }
    }
    else if (roleId === 'guerrero' || roleId === 'mago') {
      let gob = this.battlefield.goblins.find(g => g.uid === targetId);
      if (gob && gob.currentHp > 0) {
        if (this.isGoblinInvulnerable(gob)) {
          this.addLog(`⚠️ El rol no puede dañar a ${gob.name} porque es invulnerable.`);
          return false;
        }
        // Restricción Mago: Nunca puede eliminar el último punto de vida de un goblin
        if (roleId === 'mago' && gob.currentHp === 1) {
          return false;
        }
        if (roleId === 'guerrero') {
          const isInCombat = this.currentCombat && this.currentCombat.goblins.some(cg => cg.uid === gob.uid);
          const wasFought = (p.goblinsFoughtThisTurn && p.goblinsFoughtThisTurn.includes(gob.uid)) || isInCombat;
          if (!wasFought) return false;
        }
        p.energy -= actualEnergyCost;
        let damageNegated = false;
        if (gob.isBoss && (this.activeSenda === 'rey_brujo' || gob.name.includes("Rey Brujo"))) {
          let forceFieldRoll = this.rollDice(6);
          if (forceFieldRoll >= 5) {
            damageNegated = true;
            this.addLog(`🔮 <strong>Campo de Fuerza:</strong> El Rey Brujo lanzó un <strong>${forceFieldRoll}</strong> en 1d6. ¡El ataque de rol de ${p.name} es anulado por completo!`);
          } else {
            this.addLog(`🔮 <strong>Campo de Fuerza:</strong> El Rey Brujo lanzó un <strong>${forceFieldRoll}</strong> en 1d6. El ataque de rol atraviesa el escudo.`);
          }
        }

        if (damageNegated) {
          // No hace nada más, pero la energía se consumió
        } else {
          gob.currentHp -= damageAmount;
          this.addLog(`🔷 <strong>${p.name}</strong> usó su rol para infligir ${damageAmount} daño directo a ${gob.name}.`);
          if (gob.currentHp <= 0) {
            // Goblin derrotado - Marcar para animación
            gob.isDying = true;

            // Goblins Bomba: Cada vez que derrotes a un Goblin recibes una carga de Escozor.
            if (this.activeSenda === 'piromante') {
              p.statusEffects.escozor = (p.statusEffects.escozor || 0) + 1;
              this.addLog(`💣 <strong>Goblin Bomba:</strong> Al derrotar a ${gob.name} con habilidad de rol, explota y recibes <span style="color:#ff6600">1 Escozor</span>.`);
            }
            if (gob.isBoss) {
              this.isGameWon = true;
              if (!this.endTime) this.endTime = new Date().toISOString();
            }
            this.checkSpawnNextHito1Goblin(gob);
            let isNormalReward = (gob.isHito || gob.level >= p.level);
            let baseMo = isNormalReward ? gob.mo : 0;
            if (gob.isInvocacion) {
              baseMo = 0;
            }
            gob.rewardMo = baseMo;
            gob.rewardPex = isNormalReward ? gob.pex : 0;

            let extraMo = (this.activeSenda === 'recaudador') ? 1 : 0;
            p.mo += (baseMo + extraMo);
            gob.gaveReward = true;

            if (isNormalReward) {
              this.ganarPex(gob.pex);
              let moRewardText = gob.isInvocacion ? "0 mo (invocación)" : `${baseMo} mo`;
              if (extraMo > 0) {
                this.addLog(`⚔️ ¡El ataque de rol eliminó a ${gob.name}! (+${moRewardText}, +${gob.pex} PEX) <span style="color:#ffd700"><strong>+${extraMo} mo (Saqueo Experto)</strong></span>.`);
              } else {
                this.addLog(`⚔️ ¡El ataque de rol eliminó a ${gob.name}! (+${moRewardText}, +${gob.pex} PEX).`);
              }
            } else {
              let reason = gob.isInvocacion ? 'por ser una invocación' : 'por diferencia de nivel';
              if (extraMo > 0) {
                this.addLog(`⚔️ ¡El ataque de rol eliminó a ${gob.name}! (Sin recompensa de oro base ${reason}, obtiene <span style="color:#ffd700"><strong>+${extraMo} mo (Saqueo Experto)</strong></span>).`);
              } else {
                this.addLog(`⚔️ ¡El ataque de rol eliminó a ${gob.name}! (Sin recompensa ${reason}).`);
              }
            }
            this.subirNivel(p);
          }
        }
        return true;
      }
    }
    else if (roleId === 'sanador') {
      let targetP = isSelf ? p : (typeof targetId === 'number' ? this.players[targetId] : null);
      if (targetP && targetP.hp < targetP.maxHp) {
        p.energy -= actualEnergyCost;
        targetP.hp += 1;
        this.addLog(`🔷 <strong>${p.name}</strong> usó su rol (Sanador) para curar 1 PV a ${targetP.name}.`);
        return true;
      }
    }
    else if (roleId === 'protector') {
      let targetP = isSelf ? p : (typeof targetId === 'number' ? this.players[targetId] : null);
      if (targetP) {
        p.energy -= actualEnergyCost;
        targetP.shield = (targetP.shield || 0) + 1;
        this.addLog(`🔷 <strong>${p.name}</strong> usó su rol (Protector) para dar 1 Escudo a ${targetP.name}.`);
        return true;
      }
    }
    else if (roleId === 'curandero') {
      let targetP = isSelf ? p : (typeof targetId === 'number' ? this.players[targetId] : null);
      if (targetP) {
        if (equipIndex !== null && targetP.equipped[equipIndex]) {
          let eq = targetP.equipped[equipIndex];
          if (eq.isBroken) {
            p.energy -= actualEnergyCost;
            eq.isBroken = false;
            eq.brokenAnimationPlayed = false;
            eq.justRepaired = true;
            this.addLog(`🔷 <strong>${p.name}</strong> usó su rol (Curandero) para <span style="color:#2a9d8f">REPARAR</span> la carta <strong>${eq.name}</strong> de ${targetP.name}.`);
            return true;
          }
        } else {
          // Si no se especifica equipIndex, reparamos una única carta rota de mayor a menor prioridad
          const brokenItems = targetP.equipped.filter(e => e.isBroken);
          if (brokenItems.length > 0) {
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
            brokenItems.sort((a, b) => getPriority(b) - getPriority(a));
            let eq = brokenItems[0];
            p.energy -= actualEnergyCost;
            eq.isBroken = false;
            eq.brokenAnimationPlayed = false;
            eq.justRepaired = true;
            this.addLog(`🔷 <strong>${p.name}</strong> usó su rol (Curandero) para <span style="color:#2a9d8f">REPARAR</span> la carta <strong>${eq.name}</strong> de ${targetP.name}.`);
            return true;
          }
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
      1: 2 * this.players.length,
      2: 6 * this.players.length,
      3: 12 * this.players.length,
      4: 22 * this.players.length
    };

    const pLeader = this.players[0];
    if (!pLeader) return;

    // El bucle comprueba dos cosas:
    // 1. Que exista una configuración de experiencia para el nivel actual (evita errores si llega a nivel 5).
    // 2. Que los PEX del jugador líder (que representa al grupo) sean mayores o iguales a la experiencia requerida para ese nivel.
    while (expRequerida[pLeader.level] && pLeader.pex >= expRequerida[pLeader.level]) {
      // PEX es acumulativo, por lo que NO restamos los PEX. Solo subimos de nivel a todos los jugadores.
      for (let i = 0; i < this.players.length; i++) {
        let pl = this.players[i];
        pl.level += 1;
        pl.maxHp += 5;
        pl.hp += 5;
      }
      this.addLog(`🎉 <span style="color:#ecf542">¡<strong>Los jugadores subieron al Nivel ${pLeader.level}!  ❤️+5</strong></span> 🎉`);

      // Activar flag de elección para todos los jugadores
      this.players.forEach(pl => {
        this.adjustDicePoolToLevel(pl, pl.level);
      });
    }
  }

  adjustDicePoolToLevel(pl, newLevel) {
    // 1. Manejo del dado plateado (Nivel 4+)
    if (newLevel < 4) {
      pl.dicePool = pl.dicePool.filter(d => d.type !== 'silver');
    } else {
      const hasSilver = pl.dicePool.some(d => d.type === 'silver');
      if (!hasSilver) {
        pl.dicePool.push({ type: 'silver', faces: 3 });
        this.addLog(`🎁 <span style="color:#c0c0c0">¡<strong>${pl.name}</strong> ha recibido un <strong>Dado Plateado d3</strong> por alcanzar el Nivel 4!</span>`);
      }
    }

    // 2. Ajustar dados extra elegidos (deben ser newLevel - 1 en total, incluyendo elecciones pendientes)
    const targetExtraCount = newLevel - 1;
    
    let baseRedFound = false;
    let baseBlackFound = false;
    
    const baseDice = [];
    const extraDice = [];
    const silverDice = [];

    pl.dicePool.forEach(d => {
      if (d.type === 'silver') {
        silverDice.push(d);
      } else if (d.type === 'red' && d.faces === 6 && !baseRedFound) {
        baseRedFound = true;
        baseDice.push(d);
      } else if (d.type === 'black' && d.faces === 6 && !baseBlackFound) {
        baseBlackFound = true;
        baseDice.push(d);
      } else {
        extraDice.push(d);
      }
    });

    if (baseDice.length < 2) {
      if (!baseRedFound) baseDice.push({ type: 'red', faces: 6 });
      if (!baseBlackFound) baseDice.push({ type: 'black', faces: 6 });
    }

    let currentExtraCount = extraDice.length + (pl.pendingLevelUpChoices || 0);

    if (currentExtraCount > targetExtraCount) {
      let toReduce = currentExtraCount - targetExtraCount;
      if (pl.pendingLevelUpChoices > 0) {
        const reducePending = Math.min(pl.pendingLevelUpChoices, toReduce);
        pl.pendingLevelUpChoices -= reducePending;
        toReduce -= reducePending;
      }
      if (toReduce > 0 && extraDice.length > 0) {
        extraDice.splice(-toReduce);
      }
    } else if (currentExtraCount < targetExtraCount) {
      const toIncrease = targetExtraCount - currentExtraCount;
      pl.pendingLevelUpChoices = (pl.pendingLevelUpChoices || 0) + toIncrease;
    }

    pl.dicePool = [...baseDice, ...extraDice, ...silverDice];
    pl.pendingLevelUpChoice = (pl.pendingLevelUpChoices || 0) > 0;
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

  applyEquipmentEffect(p, eq, asg, damagePerTarget, healObj, shieldObj = { shield: 0 }) {
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
          shieldObj.shield += val;
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
      shieldObj.shield += shield;
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

    // Hito 2: Barriles de Pólvora (Senda Piromante)
    // "Cualquier carta de equipo que te cure PV, recupera 1 PV menos."
    if (this.activeSenda === 'piromante' && this.currentHito === 3 && healObj.heal > 0) {
      healObj.heal = Math.max(0, healObj.heal - 1);
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
      this.addLog(`💔 ¡CRACK! El equipo <strong>${itemToBreak.name}</strong> de <strong>${player.name}</strong> se ha <span style="color:var(--accent-red)">ROTO</span>.`);
      return itemToBreak;
    }
    return null;
  }

  assignGoblinLetters() {
    if (this.goblinLetterCounter === undefined) this.goblinLetterCounter = 0;
    if (!this.battlefield || !this.battlefield.goblins) return;
    
    this.battlefield.goblins.forEach(g => {
      if (!g.letterAssigned) {
        let letters = "";
        let temp = this.goblinLetterCounter;
        let first = true;
        do {
          if (!first) temp--;
          letters = String.fromCharCode(65 + (temp % 26)) + letters;
          temp = Math.floor(temp / 26);
          first = false;
        } while (temp > 0);
        
        g.letterAssigned = letters;
        if (!g.isBoss) {
          g.name = (g.name || "Goblin") + " " + letters;
        }
        this.goblinLetterCounter++;
      }
    });
  }
}

