  if (window.combatDieOnEquipHandler) {
    document.removeEventListener('dd:die-on-equip', window.combatDieOnEquipHandler);
    document.removeEventListener('dd:die-on-combat-role', window.combatDieOnCombatRoleHandler);
    document.removeEventListener('dd:die-fusion', window.combatDieFusionHandler);
    document.removeEventListener('dd:die-on-goblin', window.combatDieOnGoblinHandler);
    document.removeEventListener('dd:equip-on-goblin', window.combatEquipOnGoblinHandler);
    document.removeEventListener('dd:equip-unassign', window.combatEquipUnassignHandler);
  }

  window.combatDieOnEquipHandler = (e) => {
    const dieId = e.detail.dieId;
    const eqId = e.detail.targetId;
    if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
    let eq = gameState.currentCombat.playerEquipment.find(eq => eq.id === eqId);
    let die = gameState.currentCombat.playerDice.find(d => d.id === dieId);
    if (!eq || !die) return;
    if (eq.assignedDice && eq.assignedDice.length >= eq.diceSlots) {
      alert("Este equipo ya no admite más dados.");
      return;
    }
    if (eq.restrictions && eq.restrictions.type && die.type !== eq.restrictions.type) {
      alert(`Este equipo requiere un dado de tipo ${eq.restrictions.type}.`);
      return;
    }
    clearDieAssignment(dieId);
    if (!eq.assignedDice) eq.assignedDice = [];
    eq.assignedDice.push({ dieId: die.id, value: die.value, originalValue: die.originalValue });
    die.assignedTo = eqId;
    renderCombatOverlay();
  };

  window.combatDieOnGoblinHandler = (e) => {
    const dieId = e.detail.dieId;
    const gobUid = e.detail.targetId;
    if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
    let targetGoblin = gameState.currentCombat.goblins.find(g => g.uid === gobUid);
    let die = gameState.currentCombat.playerDice.find(d => d.id === dieId);
    if (!targetGoblin || !die) return;
    if (gameState.currentCombat.rules.mustDefeatLevel1First) {
      let isLvl1Alive = gameState.currentCombat.goblins.some(g => g.level === 1 && g.hp > 0);
      if (isLvl1Alive && targetGoblin.level > 1) {
        alert('Regla de sala: Debes derrotar primero a los goblins de nivel 1.');
        return;
      }
    }
    clearDieAssignment(dieId);
    clearInterception(dieId, true);
    if (targetGoblin.assignedDice.length >= targetGoblin.maxDice) {
      if (targetGoblin.interceptTarget !== null && targetGoblin.interceptTarget !== undefined) {
         let pIdx = targetGoblin.interceptTarget;
         let asgData = { goblinDieIndex: 0, goblinUid: targetGoblin.uid, type: 'die', value: die.value, dieId: die.id };
         if (targetGoblin.interceptTargetType && targetGoblin.interceptTargetType !== 'player') {
             pIdx = targetGoblin.interceptTargetIndex;
             asgData.targetType = targetGoblin.interceptTargetType;
         }
         if(!interceptionAssignments[pIdx]) interceptionAssignments[pIdx] = [];
         interceptionAssignments[pIdx].push(asgData);
         die.assignedTo = targetGoblin.uid;
         renderCombatOverlay();
         return;
      }
      alert("Este goblin no puede recibir más dados directos (usa equipo o comprueba si intercepta).");
      return;
    }
    targetGoblin.assignedDice.push({ dieId: die.id, value: die.value });
    die.assignedTo = targetGoblin.uid;
    renderCombatOverlay();
  };

  window.combatEquipOnGoblinHandler = (e) => {
    const eqId = e.detail.eqId;
    const gobUid = e.detail.targetId;
    if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
    let targetGoblin = gameState.currentCombat.goblins.find(g => g.uid === gobUid);
    let eq = gameState.currentCombat.playerEquipment.find(eq => eq.id === eqId);
    if (!targetGoblin || !eq) return;
    if (gameState.currentCombat.rules.mustDefeatLevel1First) {
      let isLvl1Alive = gameState.currentCombat.goblins.some(g => g.level === 1 && g.hp > 0);
      if (isLvl1Alive && targetGoblin.level > 1) {
        alert('Regla de sala: Debes derrotar primero a los goblins de nivel 1.');
        return;
      }
    }
    let dmg = 0;
    if (eq.type === 'weapon' && eq.assignedDice && eq.assignedDice.length > 0) {
      dmg = eq.assignedDice.reduce((acc, d) => acc + d.value, 0) + (eq.damageBonus || 0);
    } else if (eq.type === 'spell' && eq.assignedDice && eq.assignedDice.length > 0) {
      dmg = eq.damage || 0;
    }
    if (dmg <= 0) {
      alert("Este equipo no genera daño (faltan dados o no es arma/hechizo ofensivo).");
      return;
    }
    let prev = currentAssignments.find(a => a.sourceId === eq.id && a.sourceType === 'equipment');
    if (prev) { prev.targetUid = targetGoblin.uid; } 
    else { currentAssignments.push({ sourceId: eq.id, sourceType: 'equipment', targetUid: targetGoblin.uid, damage: dmg }); }
    renderCombatOverlay();
  };

  window.combatEquipUnassignHandler = (e) => {
    const eqId = e.detail.eqId;
    if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
    let idx = currentAssignments.findIndex(a => a.sourceId === eqId && a.sourceType === 'equipment');
    if (idx !== -1) {
      currentAssignments.splice(idx, 1);
      renderCombatOverlay();
    }
  };

  window.combatDieFusionHandler = (e) => {
     let dieId = e.detail.dieId;
     let targetId = e.detail.targetId;
     if(dieId === targetId) return;
     let sourceDie = gameState.currentCombat.playerDice.find(d => d.id === dieId);
     let targetDie = gameState.currentCombat.playerDice.find(d => d.id === targetId);
     if(!sourceDie || !targetDie) return;
     if((sourceDie.type !== 'red' && sourceDie.type !== 'black') || (targetDie.type !== 'red' && targetDie.type !== 'black')) return;
     if(sourceDie.silverDieId || targetDie.silverDieId) return;
     clearDieAssignment(sourceDie.id);
     sourceDie.silverDieId = targetDie.id;
     targetDie.originalValue = targetDie.value;
     targetDie.value += sourceDie.value;
     targetDie.isSilver = true;
     gameState.addLog(`🎲 <strong>Dado Plateado</strong> fusionado. ¡Nuevo valor de dado: <span style="color:#c0c0c0; font-weight:bold">${targetDie.value}</span>!`);
     renderCombatOverlay();
  };

  window.combatDieOnCombatRoleHandler = (e) => {
      const dieId = e.detail.dieId;
      if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
      let die = gameState.currentCombat.playerDice.find(d => d.id === dieId);
      if (!die) return;
      if (!currentAssignments) window.currentAssignments = [];
      let currentRoleAsg = currentAssignments.filter(a => a.targetType === 'combat-role');
      if (currentRoleAsg.length >= gameState.currentRoleSlots) {
         alert(`Solo puedes asignar un máximo de ${gameState.currentRoleSlots} dados al rol en este combate.`);
         return;
      }
      clearDieAssignment(dieId);
      currentAssignments.push({ sourceId: die.id, targetType: 'combat-role', value: die.value });
      die.assignedTo = 'combat-role';
      renderCombatOverlay();
  };

  document.addEventListener('dd:die-on-equip', window.combatDieOnEquipHandler);
  document.addEventListener('dd:die-on-combat-role', window.combatDieOnCombatRoleHandler);
  document.addEventListener('dd:die-fusion', window.combatDieFusionHandler);
  document.addEventListener('dd:die-on-goblin', window.combatDieOnGoblinHandler);
  document.addEventListener('dd:equip-on-goblin', window.combatEquipOnGoblinHandler);
  document.addEventListener('dd:equip-unassign', window.combatEquipUnassignHandler);
