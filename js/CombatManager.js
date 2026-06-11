// Renderiza la superposición del combate y gestiona los listeners de eventos
function renderCombatOverlay() {
  if (window.combatDieOnEquipHandler) {
    document.removeEventListener('dd:die-on-equip', window.combatDieOnEquipHandler);
    document.removeEventListener('dd:die-on-combat-role', window.combatDieOnCombatRoleHandler);
    document.removeEventListener('dd:die-fusion', window.combatDieFusionHandler);
    document.removeEventListener('dd:die-on-goblin', window.combatDieOnGoblinHandler);
    document.removeEventListener('dd:equip-on-goblin', window.combatEquipOnGoblinHandler);
    document.removeEventListener('dd:equip-unassign', window.combatEquipUnassignHandler);
  }

    // Maneja la asignación de dados a equipamiento cuando se hace click en un dado
window.combatDieOnEquipHandler = (e) => {
    const dieId = e.detail.dieId;
    const eqId = e.detail.targetId;
    if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
    let eq = gameState.getCurrentPlayer().equipped.find(eq => eq.id === eqId);
    let dieData = gameState.currentCombat.playerDice.find(d => d.id === dieId);
    if (!eq || !dieData) return;

    // Si el dado es de tipo plateado, solo puede fusionarse desde la reserva
if (dieData.type === 'silver') {
      alert("Los dados plateados solo pueden fusionarse con otros dados de la reserva.");
      return;
    }

    // Restricción de asignación de dado en modo cazador: solo valores >=4
if (gameState.activeSenda === 'cazador' && dieData.value < 4) {
      if (doesEquipmentDealDamage(eq, 6, {dieId: dieData.id, value: 6})) {
        alert("Camuflaje y Reflejos: Solo puedes asignar un 4, 5 o 6 a cartas de ataque.");
        return;
      }
    }

    // Verifica que el dado sea válido para el equipamiento seleccionado
if (!gameState.isValidDieForEquipment(dieData.value, eq)) return;

    const extra = (eq.extra || '').toLowerCase();
    const isReusable = extra.includes('reutilizable');
    const maxUses = extra.includes('x3') ? 3 : (isReusable ? 6 : 1);

    // Si el equipamiento solo permite un uso y ya tiene un dado asignado, reemplazamos el anterior
if (maxUses === 1 && currentAssignments[eq.id] && currentAssignments[eq.id].length > 0) {
      const oldDieId = currentAssignments[eq.id][0].dieId;
      const oldDieData = gameState.currentCombat.playerDice.find(d => d.id === oldDieId);
      if (oldDieData && oldDieData.isCramped) {
        alert("No puedes sustituir un dado con Calambre.");
        return;
      }
      // Liberamos el dado previamente asignado antes de asignar el nuevo
clearDieAssignment(oldDieId);
    }

    // Si el equipamiento ya ha alcanzado su número máximo de usos, abortamos la asignación
if (currentAssignments[eq.id] && currentAssignments[eq.id].length >= maxUses) return;
    
    clearDieAssignment(dieId);
    if (!currentAssignments[eq.id]) currentAssignments[eq.id] = [];

    // Caso especial: el equipamiento 'corazón elástico' permite elegir daño elástico
if (eq.id === 'corazon_elastico') {
      const curDieId = dieId;
      const curDieVal = dieData.value;
      showElasticModal(curDieId, curDieVal, eq.id, (damageChosen) => {
        currentAssignments[eq.id].push({ dieId: curDieId, value: curDieVal, targetUid: null, elasticDamage: damageChosen });
        dieData.assignedTo = eq.id;
        renderCombatOverlay();
      });
      return;
    }

    // Asignamos el dado al equipamiento (sin daño elástico)
currentAssignments[eq.id].push({ dieId: dieId, value: dieData.value, targetUid: null, elasticDamage: null });
    dieData.assignedTo = eq.id;
    renderCombatOverlay();
  };

  // Maneja la asignación de dados a goblins (interceptación) durante el combate
window.combatDieOnGoblinHandler = (e) => {
    const dieId = e.detail.dieId;
    const gobUid = e.detail.targetId;
    if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
    let gob = gameState.currentCombat.goblins.find(g => String(g.uid) === String(gobUid));
    let dieData = gameState.currentCombat.playerDice.find(d => d.id === dieId);
    if (!gob || !dieData) return;
    // Los dados plateados no pueden usarse para interceptar goblins
if (dieData.type === 'silver') { alert("Los dados plateados solo pueden fusionarse con otros dados de la reserva."); return; }
    // Los ataques del jefe 'La Madre' son ininterceptables
if (gob.isBoss && (gameState.activeSenda === 'la_madre' || gob.name === 'La Madre')) {
      alert('🛡️ Los ataques de La Madre son Ininterceptables.');
      return;
    }
    // No permitir interceptar con dados que tienen calambre fuera de la fase de calambre
if (dieData.isCramped && !gameState.currentCombat.isCrampPhase) return;

    if (gob.isBoss && gob.name.includes("La Madre")) {
      if (typeof gameState !== 'undefined' && gameState.addLog) {
        gameState.addLog(`🛡️ <strong>Ininterceptable:</strong> No puedes interceptar los dados de La Madre.`);
      }
      return;
    }

    // Valor del dado del jugador que intenta interceptar
const playerDieVal = dieData.value;
    const goblinDice = gameState.currentCombat.dice.green[gob.uid].details.filter(d => d.type === 'die');
    // Inicializar la lista de interceptaciones para este goblin si no existe
if (!interceptionAssignments[gob.uid]) interceptionAssignments[gob.uid] = [];
    let targetDieIndex = -1;
    // Recorrer los dados del goblin para encontrar una coincidencia exacta
for (let i = 0; i < goblinDice.length; i++) {
      const alreadyIntercepted = interceptionAssignments[gob.uid].some(asg => Number(asg.goblinDieIndex) === Number(i));
      if (!alreadyIntercepted && goblinDice[i].val === playerDieVal) {
        targetDieIndex = i;
        break;
      }
    }
    if (targetDieIndex !== -1) {
      clearDieAssignment(dieId);
      // Eliminar cualquier asignación previa de interceptación para este dado
clearInterception(dieId);
      if (!interceptionAssignments[gob.uid]) interceptionAssignments[gob.uid] = [];
      interceptionAssignments[gob.uid].push({
        dieId: dieId,
        value: playerDieVal,
        goblinDieIndex: targetDieIndex
      });
      dieData.assignedTo = `intercept-${gob.uid}-${targetDieIndex}`;
      renderCombatOverlay();
    } else {
      showInterceptionError(playerDieVal);
    }
  };

    // Asigna equipamiento a un goblin cuando se hace click en un equipamiento sobre un goblin
window.combatEquipOnGoblinHandler = (e) => {
    const eqId = e.detail.equipId;
    const gobUid = e.detail.targetId;
    if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
    let targetGoblin = gameState.currentCombat.goblins.find(g => String(g.uid) === String(gobUid));
    let eq = gameState.getCurrentPlayer().equipped.find(eq => eq.id === eqId);
    if (!targetGoblin || !eq) return;

    let eqObj = gameState.getCurrentPlayer().equipped.find(e => e.id === eqId);
    let asgs = currentAssignments[eqId];
    let firstAsg = Array.isArray(asgs) ? asgs[0] : asgs;
    if (doesEquipmentDealDamage(eqObj, firstAsg ? firstAsg.value : 0, firstAsg)) {
        if (Array.isArray(asgs)) {
          asgs.forEach(a => a.targetUid = targetGoblin.uid);
        } else if (asgs) {
          asgs.targetUid = targetGoblin.uid;
        }
        renderCombatOverlay();
    }
  };

  // Desasigna equipamiento del goblin o del jugador
window.combatEquipUnassignHandler = (e) => {
    const eqId = e.detail.eqId;
    if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
    
    // Check if currentAssignments[eqId] exists
    if (currentAssignments[eqId]) {
      let asgs = currentAssignments[eqId];
      if (Array.isArray(asgs)) {
        asgs.forEach(a => a.targetUid = null);
      } else {
        asgs.targetUid = null;
      }
      renderCombatOverlay();
    }
  };

  // Fusiona dos dados (uno rojo/negro con otro) para crear un dado plateado
window.combatDieFusionHandler = (e) => {
     let dieId = e.detail.dieId;
     let targetId = e.detail.targetId;
     if(dieId === targetId) return;
     let sourceDie = gameState.currentCombat.playerDice.find(d => d.id === dieId);
     let targetDie = gameState.currentCombat.playerDice.find(d => d.id === targetId);
     if(!sourceDie || !targetDie) return;
     if((sourceDie.type !== 'red' && sourceDie.type !== 'black' && sourceDie.type !== 'silver') || (targetDie.type !== 'red' && targetDie.type !== 'black')) return;
     if(sourceDie.silverDieId || targetDie.silverDieId) return;
     if(targetDie.assignedTo) {
       return;
     }
     clearDieAssignment(sourceDie.id);
     sourceDie.assignedTo = targetDie.id;
     targetDie.silverDieId = sourceDie.id;
     targetDie.originalValue = targetDie.value;
     targetDie.value += sourceDie.value;
     targetDie.isSilver = true;
     gameState.addLog(`🎲 <strong>Dado Plateado</strong> fusionado. ¡Nuevo valor de dado: <span style="color:#c0c0c0; font-weight:bold">${targetDie.value}</span>!`);
     renderCombatOverlay();
  };

  // Asigna un dado al rol de combate (ej. ataque especial) del jugador
window.combatDieOnCombatRoleHandler = (e) => {
      const dieId = e.detail.dieId;
      if (gameState.currentCombat && gameState.currentCombat.isCrampPhase) return;
      let dieData = gameState.currentCombat.playerDice.find(d => d.id === dieId);
      if (!dieData) return;

      if (dieData.type === 'silver') {
        alert("Los dados plateados solo pueden fusionarse con otros dados de la reserva.");
        return;
      }

      if (currentAssignments['role'] && currentAssignments['role'].length >= 1) {
         // Eject the oldest assigned die
         let ejectedAsg = currentAssignments['role'].shift();
         let ejectedDie = gameState.currentCombat.playerDice.find(d => d.id === ejectedAsg.dieId);
         if (ejectedDie) ejectedDie.assignedTo = null;
      }
      clearDieAssignment(dieId);
      if (!currentAssignments['role']) currentAssignments['role'] = [];
      currentAssignments['role'].push({ dieId: dieData.id, value: dieData.value, isRole: true });
      dieData.assignedTo = 'role';
      renderCombatOverlay();
  };

  document.addEventListener('dd:die-on-equip', window.combatDieOnEquipHandler);
  document.addEventListener('dd:die-on-combat-role', window.combatDieOnCombatRoleHandler);
  document.addEventListener('dd:die-fusion', window.combatDieFusionHandler);

  document.addEventListener('dd:die-on-goblin', window.combatDieOnGoblinHandler);
  document.addEventListener('dd:equip-on-goblin', window.combatEquipOnGoblinHandler);
  document.addEventListener('dd:equip-unassign', window.combatEquipUnassignHandler);
  const overlay = document.getElementById('combat-overlay');
  const c = gameState.currentCombat;
  if (!c) {
    overlay.classList.add('hidden');
    if (typeof window.drawCombatArrows === 'function') {
      window.drawCombatArrows();
    }
    return;
  }
  overlay.classList.remove('hidden');

  const goblinsContainer = document.getElementById('combat-goblins-container');
  goblinsContainer.innerHTML = '';

  const p = gameState.getCurrentPlayer();
  const isCrampPhase = c.needsCrampResolution;

  // Render Player Stats Header
  // Contenedor para mostrar estadísticas del jugador durante el combate
const statsContainer = document.getElementById('combat-player-stats');
  const expReq = {
    1: 2 * gameState.players.length,
    2: 6 * gameState.players.length,
    3: 12 * gameState.players.length,
    4: 22 * gameState.players.length
  };
  const nextExp = expReq[p.level] || '-';
  if (statsContainer) {
    const isLowHP = p.hp <= (p.maxHp * 0.25);
    const combatRoles = ['guerrero', 'mago', 'protector'];
    const canUseRole = combatRoles.includes(p.role.id) && p.energy > 0;

    // --- PROYECCIÓN DE DAÑO ---
    let projDamageObj = { direct: 0, normal: 0 };
    let projShield = p.shield || 0;
    let projHeal = 0;
    let projDamagePerTarget = {};
    let uninterceptedExtraD4Count = 0;
    let uninterceptedExtraDmgSum = 0;
    
    if (!isCrampPhase) {
      c.goblins.forEach(g => { projDamagePerTarget[g.uid] = { damage: 0, shield: 0 }; });

      for (let eqId in currentAssignments) {
        let asgData = currentAssignments[eqId];
        let asgList = Array.isArray(asgData) ? asgData : [asgData];

        let eqDamagePerTarget = {};
        c.goblins.forEach(g => { eqDamagePerTarget[g.uid] = 0; });

        asgList.forEach(asg => {
          if (asg.isRole) return;
          let eq = p.equipped.find(e => e.id === eqId);
          if (!eq) return;
          let simulatedAsg = { ...asg };
          if (!simulatedAsg.targetUid && c.goblins.length === 1 && doesEquipmentDealDamage(eq, simulatedAsg.value, simulatedAsg)) {
            simulatedAsg.targetUid = c.goblins[0].uid;
          }

          let healObj = { heal: 0 };
          let shieldObj = { shield: 0 };
          let tempDamage = {};
          c.goblins.forEach(g => { tempDamage[g.uid] = { damage: 0, shield: 0 }; });

          gameState.applyEquipmentEffect(p, eq, simulatedAsg, tempDamage, healObj, shieldObj);
          projHeal += healObj.heal;
          projShield += shieldObj.shield;

          for (let uid in tempDamage) {
            eqDamagePerTarget[uid] += tempDamage[uid].damage;
          }
        });

        // Apply Armadura de Monedas to the total damage of this equipment card against the boss in projection
        for (let uid in eqDamagePerTarget) {
          let targetGoblin = c.goblins.find(g => g.uid === uid || String(g.uid) === String(uid));
          let isRecaudadorBoss = (targetGoblin && targetGoblin.isBoss && targetGoblin.name.includes("El Gran Recaudador"));
          let dmg = eqDamagePerTarget[uid];
          if (isRecaudadorBoss && dmg > 0) {
            eqDamagePerTarget[uid] = Math.max(0, dmg - 1);
          }
        }

        // Add to the global projDamagePerTarget
        for (let uid in eqDamagePerTarget) {
          if (projDamagePerTarget[uid]) {
            projDamagePerTarget[uid].damage += eqDamagePerTarget[uid];
          }
        }
      }

      uninterceptedExtraD4Count = 0;
      uninterceptedExtraDmgSum = 0;

      c.goblins.forEach(gob => {
        if (gob.isDying) return;
        let greenDiceResult = c.dice.green[gob.uid];
        let goblinDmg = greenDiceResult ? greenDiceResult.total : 1;
        let directDmg = 0;
        let normalDmg = 0;
        let isSpecialBoss = (gob.isBoss && (gob.name.includes("Rey Brujo") || gob.name.includes("La Madre") || gameState.activeSenda === "rey_brujo" || gameState.activeSenda === "la_madre"));

        if (gob.isBoss && (gob.name.includes("La Madre") || gameState.activeSenda === "la_madre")) {
           goblinDmg = 0;
        } else if (gob.isBoss && (gob.name.includes("Rey Brujo") || gameState.activeSenda === "rey_brujo") && greenDiceResult && greenDiceResult.details) {
           let naturalDie = greenDiceResult.details.find(d => d.type === 'die');
           if (naturalDie) {
              let rollVal = naturalDie.val;
              if (rollVal === 1 || rollVal === 5) goblinDmg = 4;
              else if (rollVal === 2) goblinDmg = 3;
              else if (rollVal === 4 || rollVal === 6) goblinDmg = 1;
           }
        }
        
        let goblinInterceptions = [];
        if (interceptionAssignments) {
          if (interceptionAssignments[gob.uid]) {
            goblinInterceptions = interceptionAssignments[gob.uid];
          } else {
            const uidStr = String(gob.uid);
            const foundKey = Object.keys(interceptionAssignments).find(k => String(k) === uidStr);
            if (foundKey) goblinInterceptions = interceptionAssignments[foundKey];
          }
        }

        let allSpecialAttacks = [];
        if (greenDiceResult && greenDiceResult.details) {
          let naturalDieIdx = 0;
          greenDiceResult.details.forEach((detail, rawIdx) => {
            if (detail.type === 'die') {
              const isIntercepted = goblinInterceptions.some(asg => Number(asg.goblinDieIndex) === Number(naturalDieIdx));
              
              let dieDmg = detail.val;
              const nextDetail = greenDiceResult.details[rawIdx + 1];
              if (nextDetail && nextDetail.type === 'mod') {
                dieDmg += nextDetail.val;
              }

              if (gob.isBoss && gob.name.includes("El Gran Recaudador") && (detail.val === 3 || detail.val === 6)) {
                dieDmg = 0;
              }

              if (isIntercepted) {
                goblinDmg -= detail.val;
                if (nextDetail && nextDetail.type === 'mod') {
                  goblinDmg -= nextDetail.val;
                }
              }
              
              naturalDieIdx++;
              
              let gobDB = gob.attacks ? gob : DB.goblins[gob.level];
              let attacks = (gobDB && gobDB.attacks) ? (gobDB.attacks[detail.val] || []) : [];
              let isDieDirect = attacks.some(a => a.toLowerCase().includes('daño directo'));

              if (!isIntercepted) {
                if (isDieDirect) {
                  directDmg += dieDmg;
                } else {
                  normalDmg += dieDmg;
                }
                attacks.forEach(eff => allSpecialAttacks.push(eff));

                if (gob.level === 3 && detail.val === 4) {
                  uninterceptedExtraD4Count++;
                  let extraDmg = detail.extraDmgRoll !== undefined ? detail.extraDmgRoll : 0;
                  uninterceptedExtraDmgSum += extraDmg;
                  if (isDieDirect) {
                    directDmg += extraDmg;
                  } else {
                    normalDmg += extraDmg;
                  }
                }
              }
            }
          });
        }

        if (gameState.activeSenda === 'guerrero' && gob.level === 2) {
           let lvl1Count = gameState.battlefield.goblins.filter(g => g.level === 1 && g.currentHp > 0).length;
           if (lvl1Count > 0) {
              if (isSpecialBoss) goblinDmg += lvl1Count;
              else normalDmg += lvl1Count;
           }
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

        projDamageObj.direct += directDmg;
        projDamageObj.normal += normalDmg;
      });
    }

    let projNetDamage = isCrampPhase ? 0 : Math.max(0, projDamageObj.normal - projShield) + projDamageObj.direct;
    let finalProjectedHp = Math.min(p.maxHp, Math.max(0, p.hp - projNetDamage + projHeal));
    
    let projectedHtml = '';
    let goblinsProjHtml = '';
    if (!isCrampPhase) {
       let extraD4Text = "";
       if (uninterceptedExtraD4Count > 0) {
         if (uninterceptedExtraDmgSum > 0) {
           extraD4Text = ` <span style="color: #ff4d4d; font-weight: bold;">(+${uninterceptedExtraDmgSum} extra)</span>`;
         } else {
           extraD4Text = ` <span style="color: #ff4d4d; font-weight: bold;">(+${uninterceptedExtraD4Count}d4 extra)</span>`;
         }
       }

       if (finalProjectedHp < p.hp) {
           projectedHtml = `<div style="color: #ff4d4d; font-size: 0.9rem; margin-top: -10px; margin-left: 34px;">Daño Previsto: -${p.hp - finalProjectedHp} PV${extraD4Text}</div>`;
       } else if (finalProjectedHp > p.hp) {
           projectedHtml = `<div style="color: #33cc33; font-size: 0.9rem; margin-top: -10px; margin-left: 34px;">Cura Prevista: +${finalProjectedHp - p.hp} PV${extraD4Text}</div>`;
       } else {
           if (uninterceptedExtraD4Count > 0) {
               projectedHtml = `<div style="color: #ff4d4d; font-size: 0.9rem; margin-top: -10px; margin-left: 34px;">Daño Previsto: 0 PV${extraD4Text}</div>`;
           } else {
               projectedHtml = `<div style="color: #888; font-size: 0.9rem; margin-top: -10px; margin-left: 34px;">Sin daños previstos</div>`;
           }
       }

       c.goblins.forEach(gob => {
         let stats = projDamagePerTarget[gob.uid] || { damage: 0, shield: 0 };
         let finalGobHp = gob.currentHp - stats.damage;
         let isDamaged = finalGobHp < gob.currentHp;
         let finalColor = isDamaged ? '#ff4d4d' : '#888';
         let displayName = gob.isBoss ? gob.name : `Goblin ${gob.level}`;
         goblinsProjHtml += `<div style="font-size: 0.95rem; margin-top: 5px; color: #888;">
             <span style="color: #33cc33;">${displayName}</span>: ${gob.currentHp} &rarr; <span style="color: ${finalColor}; font-weight: bold;">${finalGobHp}</span>
         </div>`;
       });
    }

    let goblinSection = goblinsProjHtml ? `
      <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid rgba(212, 175, 55, 0.3);">
        <div style="font-size: 1rem; font-weight: bold; color: var(--gold); margin-bottom: 8px;">Proyección Goblins</div>
        ${goblinsProjHtml}
      </div>
    ` : '';
    // --- FIN PROYECCION ---

    statsContainer.innerHTML = `
      <div class="player-name-hover" data-player-index="${gameState.players.indexOf(p)}" style="font-size: 1.4rem; font-weight: bold; color: var(--gold); margin-bottom: 5px; cursor: pointer; width: fit-content; margin-left: auto; margin-right: auto;">${p.name}</div>
      <div style="font-size: 0.9rem; color: #aaa; margin-bottom: 15px; font-weight: bold; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 5px;">
        Acción: 
        <span style="font-size: 1.2rem; color: ${gameState.battlefield.actionCount >= 0 ? '#ff4d4d' : '#444'}; text-shadow: ${gameState.battlefield.actionCount >= 0 ? '0 0 10px rgba(255, 77, 77, 0.6)' : 'none'};">★</span>
        <span style="font-size: 1.2rem; color: ${gameState.battlefield.actionCount >= 1 ? '#ff4d4d' : '#444'}; text-shadow: ${gameState.battlefield.actionCount >= 1 ? '0 0 10px rgba(255, 77, 77, 0.6)' : 'none'};">★</span>
        <span style="font-size: 1.2rem; color: ${gameState.battlefield.actionCount >= 2 ? '#ff4d4d' : '#444'}; text-shadow: ${gameState.battlefield.actionCount >= 2 ? '0 0 10px rgba(255, 77, 77, 0.6)' : 'none'};">★</span>
      </div>
      <div class="stats" style="display: flex; flex-direction: column; gap: 15px; font-size: 1.2rem;">
        <div class="stat hp ${isLowHP ? 'low-hp' : ''}" style="display: flex; align-items: center; gap: 10px; height: 24px;"><span style="display: flex; align-items: center; width: 24px; justify-content: center;">❤️</span> <span>Vida: <span>${p.hp}</span>/<span>${p.maxHp}</span> ${finalProjectedHp !== p.hp && !isCrampPhase ? `<span style="color:${finalProjectedHp < p.hp ? '#ff4d4d' : '#33cc33'}; font-size: 0.9em; margin-left: 8px;">(➔ ${finalProjectedHp}/${p.maxHp})</span>` : ''}</span></div>
        ${projectedHtml}
        ${p.shield > 0 ? `<div class="stat shield" style="display: flex; align-items: center; gap: 10px; height: 24px; color: #33cc33;" title="Escudos del Protector"><span style="display: flex; align-items: center; width: 24px; justify-content: center;">🛡️</span> <span>Escudos: <span>${p.shield}</span></span></div>` : ''}
        <div class="stat gold" style="display: flex; align-items: center; gap: 10px; height: 24px;"><span style="display: flex; align-items: center; width: 24px; justify-content: center;">${COIN_SVG}</span> <span>Oro: <span>${p.mo}</span></span></div>
        <div class="stat energy" style="display: flex; align-items: center; gap: 10px; height: 24px; color: #00d2ff;" title="Energía del Rol"><span style="display: flex; align-items: center; width: 24px; justify-content: center;">🔷</span> <span>Energía: <span>${p.energy}</span></span></div>
      </div>
      ${goblinSection}
    `;
  }

  const btnResolve = document.getElementById('btn-resolve-combat');
  const btnCancel = document.getElementById('btn-cancel-combat');

  if (isRollingCombatDice) {
    btnResolve.disabled = true;
    btnCancel.disabled = true;
  } else {
    btnResolve.disabled = false;
    btnCancel.disabled = false;
  }

  if (isCrampPhase) {
    btnResolve.innerText = "Lanzar dados rojos";
    btnResolve.style.background = 'linear-gradient(135deg, #ffcc00, #ff9900)';
    btnResolve.onclick = () => {
      if (isRollingCombatDice) return;
      c.needsCrampResolution = false;
      gameState.addLog(`⚡ <strong>${p.name}</strong> ha resuelto sus calambres.`);
      triggerCombatDiceRoll();
    };
  } else {
    btnResolve.innerText = "Resolver Ataque";
    btnResolve.style.background = '';
    btnResolve.onclick = () => {
      if (isRollingCombatDice) return;
      // Automatización: Si solo hay un goblin, asignar automáticamente lo que falte (solo las que hacen daño)
      const combatGoblins = c.goblins;
      if (combatGoblins.length === 1) {
        const targetUid = combatGoblins[0].uid;
        for (let id in currentAssignments) {
          let eqObj = p.equipped.find(e => e.id === id);
          let asgs = currentAssignments[id];
          if (Array.isArray(asgs)) {
            asgs.forEach(a => {
              if (!a.isRole && !a.targetUid && doesEquipmentDealDamage(eqObj, a.value, a)) {
                a.targetUid = targetUid;
              }
            });
          } else {
            if (!asgs.isRole && !asgs.targetUid && doesEquipmentDealDamage(eqObj, asgs.value, asgs)) {
              asgs.targetUid = targetUid;
            }
          }
        }
      }

      // Validar que todo el equipo cargado que hace daño tiene un objetivo
      for (let eqId in currentAssignments) {
        let eqObj = p.equipped.find(e => e.id === eqId);
        let asgs = currentAssignments[eqId];
        const asgList = Array.isArray(asgs) ? asgs : [asgs];

        if (asgList.some(a => !a.isRole && !a.targetUid && doesEquipmentDealDamage(eqObj, a.value, a))) {
          alert("Asigna un objetivo a todas las cartas de ataque cargadas arrastrándolas sobre un Goblin.");
          return;
        }
      }

      const pBefore = gameState.getCurrentPlayer();
      const hpBefore = pBefore.hp;

      gameState.resolveCombat(currentAssignments, interceptionAssignments);

      const pAfter = gameState.getCurrentPlayer();
      const dbg = gameState.lastCombatDebugState;

      let hasStatsChange = false;
      let statsLine = "";
      let hasLevelUp = false;
      let levelUpLine = "";
      let brokenItems = [];
      let statusEffectsLines = [];
      let sendaLines = [];

      if (dbg && dbg.player) {
        const pBeforeState = dbg.player;

        // Level Up
        let levelUpHpBonus = 0;
        if (pAfter.level > pBeforeState.level) {
          hasLevelUp = true;
          levelUpLine = `🎉 Nivel: ¡Subida de nivel! (Nivel ${pBeforeState.level} ➔ ${pAfter.level})`;
          levelUpHpBonus = (pAfter.level - pBeforeState.level) * 5;
        }

        // 1. ESTADÍSTICAS DEL COMBATE
        const hpDiff = pAfter.hp - pBeforeState.hp - levelUpHpBonus;
        const moDiff = pAfter.mo - pBeforeState.mo;
        const energyDiff = pAfter.energy - pBeforeState.energy;
        const pexDiff = pAfter.pex - pBeforeState.pex;

        if (hpDiff !== 0 || moDiff !== 0 || energyDiff !== 0 || pexDiff !== 0) {
          hasStatsChange = true;
          statsLine = `COMBAT_STATS: hp=${hpDiff};mo=${moDiff};energy=${energyDiff};pex=${pexDiff}`;
        }

        // 3. DAÑO A TU EQUIPO
        pAfter.equipped.forEach(eq => {
          let beforeEq = pBeforeState.equipped.find(e => e.id === eq.id);
          if (beforeEq && !beforeEq.isBroken && eq.isBroken) {
            brokenItems.push(eq.name);
          }
        });
      }

      // 4. EFECTOS DE ESTADO ADQUIRIDOS
      if (gameState.lastCombatAcquiredEffects) {
        const effects = gameState.lastCombatAcquiredEffects;
        if (effects.escozor > 0 || effects.calambre > 0 || effects.tembleque > 0) {
          if (effects.escozor > 0) statusEffectsLines.push(`🔥 Escozor: +${effects.escozor}`);
          if (effects.calambre > 0) statusEffectsLines.push(`⚡ Calambre: +${effects.calambre}`);
          if (effects.tembleque > 0) statusEffectsLines.push(`🌀 Tembleque: +${effects.tembleque}`);
        }
      }

      // 5. DETALLES DE LA SENDA Y OTROS DETALLES
      if (gameState.lastWarlordExtraDmg > 0) {
        sendaLines.push(`• Golpe Certero: El Zeñor de la Guerra infligió +${gameState.lastWarlordExtraDmg} de daño extra.`);
      }

      if (gameState.activeSenda === 'recaudador') {
        if (gameState.lastCombatGoldPrevented > 0) {
          sendaLines.push(`• Escudo de Oro: perdiste ${gameState.lastCombatGoldPrevented} mo y evitaste ${gameState.lastCombatGoldPrevented} de daño.`);
        }
        if (gameState.lastCombatExtraGoldDamage > 0) {
          sendaLines.push(`• Escudo de Oro (sin oro): sufriste +${gameState.lastCombatExtraGoldDamage} de Daño Extra.`);
        }
        if (gameState.lastCombatSaqueoExperto > 0) {
          sendaLines.push(`• Saqueo Experto: obtuviste +${gameState.lastCombatSaqueoExperto} mo extra.`);
        }
        if (gameState.lastCombatLosCarteristasRobo > 0) {
          sendaLines.push(`• Los Carteristas: un goblin te robó ${gameState.lastCombatLosCarteristasRobo} mo extra.`);
        }
        if (gameState.lastCombatLosCarteristasDmg > 0) {
          sendaLines.push(`• Los Carteristas: sufriste +${gameState.lastCombatLosCarteristasDmg} Daño Directo por no tener oro.`);
        }
        if (gameState.lastCombatArmaduraMonedasGold > 0) {
          sendaLines.push(`• Armadura de monedas: obtuviste +${gameState.lastCombatArmaduraMonedasGold} mo por dañar al jefe.`);
        }
      }

      const hasBossEffects = (gameState.lastCombatBossEffects && gameState.lastCombatBossEffects.length > 0);
      const hasSomethingToShow = hasStatsChange || hasLevelUp || (brokenItems.length > 0) || (statusEffectsLines.length > 0) || (sendaLines.length > 0) || hasBossEffects;

      const runEndOfCombatUI = () => {
        const hpAfter = pBefore.hp;
        if (hpAfter < hpBefore) {
          const flash = document.createElement('div');
          flash.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(230, 57, 70, 0.55);
            pointer-events: none;
            z-index: 999999;
            transition: background 0.5s ease-out;
          `;
          document.body.appendChild(flash);
          flash.getBoundingClientRect(); // Forzar reflow
          flash.style.background = 'rgba(230, 57, 70, 0)';
          setTimeout(() => flash.remove(), 500);
        }

        document.getElementById('combat-overlay').classList.add('hidden');
        selectedGoblins = [];
        activeSelectedDieId = null;
        activeSelectedEquipId = null;
        document.querySelectorAll('.goblin-card').forEach(el => el.classList.remove('selectable', 'selected'));
        document.getElementById('btn-confirm-attack').innerHTML = `<span class="txt-largo">Atacar Goblins (0)</span><span class="txt-corto">Atacar (0)</span>`;
        updateUI();

        const debugCombatModal = document.getElementById('debug-combat-modal');
        if (debugCombatModal && !debugCombatModal.classList.contains('hidden') && typeof window.updateDebugCombatModalData === 'function') {
          window.updateDebugCombatModalData();
        }

        // Trigger bounce animation for damaged surviving Goblins
        setTimeout(() => {
          console.log("[BOUNCE] Starting animation check...");
          if (dbg && dbg.goblins) {
            const container = document.getElementById('goblins-container');
            if (container) {
              console.log("[BOUNCE] goblins-container found. Children count:", container.children.length);
              dbg.goblins.forEach(g => {
                let liveG = gameState.battlefield.goblins.find(bg => bg.uid === g.uid && !bg.isDying);
                if (liveG) {
                  console.log(`[BOUNCE] Goblin UID: ${g.uid}, Name: ${g.name || g.level}, Before HP: ${g.hp}, Current HP: ${liveG.currentHp}`);
                  if (liveG.currentHp < g.hp) {
                    const cardEl = Array.from(container.children).find(el => String(el.dataset.uid) === String(g.uid));
                    if (cardEl) {
                      console.log("[BOUNCE] Match found in DOM! Adding animation class...");
                      cardEl.classList.remove('goblin-wobble-active', 'goblin-mutation-active');
                      void cardEl.offsetWidth; // Force reflow/repaint
                      cardEl.classList.add('goblin-damaged-bounce-active');
                      setTimeout(() => {
                        cardEl.classList.remove('goblin-damaged-bounce-active');
                        console.log("[BOUNCE] Animation class removed.");
                      }, 900);
                    } else {
                      console.error(`[BOUNCE] Match NOT found in DOM for UID ${g.uid}`);
                    }
                  } else {
                    console.log(`[BOUNCE] Goblin did not take damage or took 0 damage.`);
                  }
                } else {
                  console.log(`[BOUNCE] Goblin UID ${g.uid} is dead or not found on board.`);
                }
              });
            } else {
              console.error("[BOUNCE] goblins-container NOT found!");
            }
          } else {
            console.error("[BOUNCE] dbg.goblins not found!");
          }
        }, 150);

        window.saveGame(true);
      };

      if (hasSomethingToShow) {
        let combatSummaryLines = ["¡COMBATE COMPLETADO!\n"];
        if (hasStatsChange) {
          combatSummaryLines.push(statsLine);
        }
        if (hasLevelUp) {
          combatSummaryLines.push(levelUpLine);
        }
        if (brokenItems.length > 0) {
          combatSummaryLines.push("\n🔧 DAÑO A TU EQUIPO:");
          combatSummaryLines.push(`💥 Roto: ${brokenItems.join(', ')}`);
        }
        if (statusEffectsLines.length > 0) {
          combatSummaryLines.push("\n🔥 EFECTOS DE ESTADO ADQUIRIDOS:");
          statusEffectsLines.forEach(line => combatSummaryLines.push(line));
        }
        if (gameState.lastCombatBossEffects && gameState.lastCombatBossEffects.length > 0) {
          combatSummaryLines.push("\n👑 HABILIDADES DEL JEFE:");
          gameState.lastCombatBossEffects.forEach(line => combatSummaryLines.push(`• ${line}`));
        }
        if (sendaLines.length > 0) {
          combatSummaryLines.push("\n🗺️ DETALLES DE LA SENDA:");
          sendaLines.forEach(line => combatSummaryLines.push(line));
        }

        alert(combatSummaryLines.join('\n'), runEndOfCombatUI);
      } else {
        runEndOfCombatUI();
      }
    };
  }

  btnCancel.onclick = () => {
    if (isRollingCombatDice) return;
    gameState.cancelCombat();
    document.getElementById('combat-overlay').classList.add('hidden');
    selectedGoblins = [];
    activeSelectedDieId = null;
    activeSelectedEquipId = null;
    document.querySelectorAll('.goblin-card').forEach(el => el.classList.remove('selectable', 'selected'));
    document.getElementById('btn-confirm-attack').innerHTML = `<span class="txt-largo">Atacar Goblins (0)</span><span class="txt-corto">Atacar (0)</span>`;
    updateUI();
  };

  c.goblins.forEach(gob => {
    let gobWrapper = document.createElement('div');
    gobWrapper.className = 'goblin-combat-wrapper';

    // Goblin card
    let gobCard = document.createElement('div');
    gobCard.className = 'goblin-card';
    gobCard.id = `goblin-card-${gob.uid}`;
    let imageUrl = gob.image;
    if (gob.isHito) {
      gobCard.classList.add('goblin-hito');
    } else {
      const pActive = gameState.players[gameState.currentPlayerIndex] || gameState.players[0];
      if (gob.level < pActive.level) {
        gobCard.classList.add('goblin-no-reward');
        if (!gob.isInvocacion && !imageUrl.includes('invocacion')) {
          imageUrl = imageUrl.replace(/([^\/]+)$/, 'nomo_$1');
        }
      }
    }
    imageUrl = getGoblinImageWithHpState(gob, imageUrl);
    gobCard.style.backgroundImage = `url('${imageUrl}')`;
    const isInvulnerable = gameState.isGoblinInvulnerable(gob);
    if (isInvulnerable) {
      gobCard.classList.add('invulnerable');
    }
    let invulnTitle = "Invulnerable por Regla de Hito";
    if (gameState.activeSenda === 'la_madre') {
      invulnTitle = "Escudos de Carne: ¡La Madre protege a sus crías!";
    } else if (gameState.activeSenda === 'recaudador') {
      if (gameState.currentHito === 3) {
        invulnTitle = "El Peaje: ¡Paga 2 mo de peaje para hacerlo vulnerable!";
      } else if (gameState.currentHito === 5) {
        invulnTitle = "La Banda del Saco: ¡Vence primero a los goblins de Nivel 1!";
      }
    }
    const badgeHTML = isInvulnerable 
      ? `<div class="goblin-invulnerable-badge" title="${invulnTitle}">🛡️</div>` 
      : '';
    gobCard.innerHTML = `<div class="goblin-hp">${gob.currentHp}</div>${badgeHTML}`;

    // Drop zone logic for the goblin
    gobCard.classList.add('dropzone');
    gobCard.dataset.dropType = 'goblin';
    gobCard.dataset.goblinUid = gob.uid;

    // SISTEMA DE RESPALDO (TAP-TO-SELECT): Asignar dado seleccionado o equipo seleccionado al goblin al hacer clic
    gobCard.addEventListener('click', (e) => {
      if (activeSelectedDieId) {
        const dieData = c.playerDice.find(d => d.id === activeSelectedDieId);
        if (dieData) {
          if (dieData.type === 'silver') { alert("Los dados plateados solo pueden fusionarse con otros dados de la reserva."); return; }
          if (isCrampPhase) return;
          
          if (gob.isBoss && (gameState.activeSenda === 'la_madre' || gob.name === 'La Madre')) {
            alert('🛡️ Los ataques de La Madre son Ininterceptables.');
            return;
          }

          if (dieData.isCramped && !isCrampPhase) return;

          if (gob.isBoss && gob.name.includes("La Madre")) {
            if (typeof gameState !== 'undefined' && gameState.addLog) {
              gameState.addLog(`🛡️ <strong>Ininterceptable:</strong> No puedes interceptar los dados de La Madre.`);
            }
            // Limpiar la selección si falla
            clearDieAssignment(activeSelectedDieId);
            clearInterception(activeSelectedDieId);
            activeSelectedDieId = null;
            renderCombatOverlay();
            return;
          }

          const playerDieVal = dieData.value;
          const goblinDice = c.dice.green[gob.uid].details.filter(d => d.type === 'die');

          if (!interceptionAssignments[gob.uid]) interceptionAssignments[gob.uid] = [];

          let targetDieIndex = -1;
          for (let i = 0; i < goblinDice.length; i++) {
            const alreadyIntercepted = interceptionAssignments[gob.uid].some(asg => Number(asg.goblinDieIndex) === Number(i));
            if (!alreadyIntercepted && goblinDice[i].val === playerDieVal) {
              targetDieIndex = i;
              break;
            }
          }

          if (targetDieIndex !== -1) {
            clearDieAssignment(activeSelectedDieId);
            clearInterception(activeSelectedDieId);

            if (!interceptionAssignments[gob.uid]) interceptionAssignments[gob.uid] = [];

            interceptionAssignments[gob.uid].push({
              dieId: activeSelectedDieId,
              value: playerDieVal,
              goblinDieIndex: targetDieIndex
            });
            dieData.assignedTo = `intercept-${gob.uid}-${targetDieIndex}`;
            activeSelectedDieId = null;
            renderCombatOverlay();
          } else {
            showInterceptionError(playerDieVal);
          }
          e.stopPropagation();
        }
      } else if (activeSelectedEquipId) {
        if (currentAssignments[activeSelectedEquipId]) {
          let asgs = currentAssignments[activeSelectedEquipId];
          if (Array.isArray(asgs)) {
            asgs.forEach(a => a.targetUid = gob.uid);
          } else {
            asgs.targetUid = gob.uid;
          }
          activeSelectedEquipId = null;
          renderCombatOverlay();
          e.stopPropagation();
        }
      }
    });

    let assignedEqContainer = document.createElement('div');
    assignedEqContainer.id = `assigned-${gob.uid}`;
    assignedEqContainer.className = 'goblin-assigned-equipment';

    // RESTAURAR ICONOS DE EQUIPO ASIGNADO
    for (let eqId in currentAssignments) {
      let asgData = currentAssignments[eqId];
      let firstAsg = Array.isArray(asgData) ? asgData[0] : asgData;

      if (firstAsg && firstAsg.targetUid === gob.uid) {
        let eqObj = p.equipped.find(eq => eq.id === eqId);
        if (eqObj) {
          let miniEl = document.createElement('div');
          miniEl.className = `mini-equip-icon mini-icon-${eqId}`;
          miniEl.style.backgroundImage = `url('${eqObj.image}')`;
          miniEl.title = `Asignado a ${gob.name}`;
          miniEl.draggable = true;
          miniEl.classList.add('draggable');
          assignedEqContainer.appendChild(miniEl);
        }
      }
    }

    // RESTAURAR ICONOS DE INTERCEPCIÓN
    const intAsgs = interceptionAssignments[gob.uid];
    if (intAsgs && Array.isArray(intAsgs)) {
      intAsgs.forEach(asg => {
        const dieData = c.playerDice.find(d => d.id === asg.dieId);
        if (dieData) {
          let interceptIcon = document.createElement('div');
          interceptIcon.className = `intercept-icon intercept-${asg.dieId}`;
          interceptIcon.innerHTML = `🛡️ ${asg.value}`;
          interceptIcon.style.display = 'inline-flex';
          interceptIcon.style.alignItems = 'center';
          interceptIcon.style.justifyContent = 'center';
          interceptIcon.className += ' ' + dieData.type;
          if (dieData.faces === 4) interceptIcon.classList.add('d4');
          interceptIcon.style.color = 'white';
          interceptIcon.style.border = '1px solid gold';
          interceptIcon.style.padding = '5px';
          interceptIcon.style.borderRadius = '5px';
          interceptIcon.style.margin = '2px';
          interceptIcon.style.cursor = 'pointer';
          interceptIcon.title = `Intercepción: Click para retirar (Anula dado index ${asg.goblinDieIndex})`;
          interceptIcon.onclick = (e) => {
            e.stopPropagation();
            clearInterception(asg.dieId);
          };
          assignedEqContainer.appendChild(interceptIcon);
        }
      });
    }

    // Green dice for this goblin (Ocultos en fase de calambre)
    let diceCont = document.createElement('div');
    diceCont.className = 'dice-container';
    diceCont.style.position = 'absolute';
    diceCont.style.top = '36%';
    diceCont.style.left = '0';
    diceCont.style.transform = 'translateY(-50%)';
    diceCont.style.width = '100%';
    diceCont.style.margin = '0';
    diceCont.style.padding = '8px 0';
    diceCont.style.background = 'rgba(0, 0, 0, 0.75)';
    diceCont.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.9)';
    diceCont.style.gap = '2px';
    diceCont.style.alignItems = 'center';

    if (!isCrampPhase && c.dice.green[gob.uid]) {
      let naturalDieIdx = 0;
      c.dice.green[gob.uid].details.forEach((item, idx) => {
        let el = document.createElement('div');
        if (item.type === 'die') {
          el.className = `die green d${item.faces}`;
          if (isRollingCombatDice) el.classList.add('die-rolling');
          el.id = `green-die-${gob.uid}-${idx}`;
          el.dataset.goblinUid = gob.uid;
          el.dataset.dieIndex = idx;
          // Marcar si está interceptado
          const currentNaturalIdx = naturalDieIdx;
          const isIntercepted = intAsgs && intAsgs.some(asg => Number(asg.goblinDieIndex) === Number(currentNaturalIdx));
          if (isIntercepted) el.classList.add('intercepted');
          naturalDieIdx++;

          el.innerText = item.val;
          el.style.width = '50px';
          el.style.height = '50px';
          el.style.fontSize = '1.8rem';
          el.style.borderRadius = '10px';
          el.style.boxShadow = '0 3px 8px rgba(0,0,0,0.9), inset 0 0 8px rgba(0,0,0,0.6)';

        } else {
          el.className = 'mod-green';
          let valToShow = item.val;
          let isExtraDmgModifier = false;
          
          if (idx > 0) {
            let prevDie = c.dice.green[gob.uid].details[idx - 1];
            if (prevDie && prevDie.type === 'die' && prevDie.extraDmgRoll !== undefined) {
              let prevNaturalIdx = 0;
              for (let i = 0; i < idx - 1; i++) {
                if (c.dice.green[gob.uid].details[i].type === 'die') {
                  prevNaturalIdx++;
                }
              }
              const isPrevIntercepted = intAsgs && intAsgs.some(asg => Number(asg.goblinDieIndex) === Number(prevNaturalIdx));
              if (!isPrevIntercepted) {
                valToShow = item.val + prevDie.extraDmgRoll;
                isExtraDmgModifier = true;
              }
            }
          }

          el.innerText = (valToShow >= 0 ? '+' : '') + valToShow;
          el.style.fontSize = '1.6rem';
          el.style.padding = '2px 6px';
          el.style.background = 'rgba(0,0,0,0.7)';
          el.style.borderRadius = '4px';
          el.style.fontWeight = 'bold';
          
          if (isExtraDmgModifier) {
            el.style.color = '#ff4d4d';
            el.title = `Daño extra del dado (+${valToShow - item.val}) aplicado`;
          } else if (item.isHitoRule) {
            el.style.color = '#ff4d4d';
            el.style.border = '1px solid #ff4d4d';
            el.style.boxShadow = '0 0 8px rgba(255, 77, 77, 0.4)';
            el.title = 'Regla Hito: +1 daño por cada goblin de nivel 1 vivo';
          } else {
            el.style.color = '#4CAF50';
          }
        }
        diceCont.appendChild(el);
      });
    }

    gobCard.appendChild(diceCont);

    gobWrapper.appendChild(gobCard);
    gobWrapper.appendChild(assignedEqContainer);
    goblinsContainer.appendChild(gobWrapper);
  });

  // Permitir desasignar equipo soltándolo en el fondo
  const combatMain = document.getElementById('combat-main');
  if (combatMain) {
    combatMain.classList.add('dropzone');
    combatMain.dataset.dropType = 'combat-main';
  }

  // Render Dados
  const dicePoolContainer = document.getElementById('combat-dice-pool');
  dicePoolContainer.innerHTML = '';
  c.playerDice.forEach(die => {
    // Si es un dado plateado y ya está fusionado, no lo renderizamos en la reserva
    if (die.type === 'silver' && die.assignedTo && die.assignedTo.startsWith('die-')) return;

    // En fase de calambre, ocultar cualquier dado que no tenga calambre (rojos, plateados, negros normales)
    if (isCrampPhase && !die.isCramped) return;

    // Fuera de la fase de calambre, ocultar dados con calambre no asignados (dados perdidos)
    if (!isCrampPhase && die.isCramped && !die.assignedTo) return;

    let dieWrapper = document.createElement('div');
    dieWrapper.className = 'die-wrapper';
    dieWrapper.style.position = 'relative';

    let dieEl = document.createElement('div');
    dieEl.className = `die ${die.type}`;
    if (die.faces === 4) dieEl.classList.add('d4');
    if (die.isStung) dieEl.classList.add('stung');
    if (die.isShaking) dieEl.classList.add('shaking');
    if (die.isCramped) dieEl.classList.add('cramped');

    dieEl.id = die.id;
    dieEl.innerText = die.value;
    dieEl.style.opacity = die.assignedTo ? '0.3' : '1';

    if (isRollingCombatDice) {
      dieEl.draggable = false;
      if (!die.isCramped && !die.isShaking) {
        dieEl.classList.add('die-rolling');
      }
      dieEl.style.cursor = 'default';
      dieWrapper.appendChild(dieEl);
      dicePoolContainer.appendChild(dieWrapper);
      return;
    }

    dieEl.draggable = !die.assignedTo;

    // Bloquear movimiento de dados con calambre si ya pasó la fase
    if (!isCrampPhase && die.isCramped) {
      dieEl.draggable = false;
      dieEl.style.opacity = "0.3";
      dieEl.title = die.assignedTo ? "Calambre: Asignado" : "Calambre: Dado perdido";
    }

    dieEl.classList.add('draggable');
    if (die.type === 'red' || die.type === 'black') {
        dieEl.classList.add('dropzone');
        dieEl.dataset.dropType = 'die';
        dieEl.dataset.targetId = die.id;
    }

    // --- LÓGICA DE FUSIÓN DE DADO PLATEADO ---
    if (die.type === 'red' || die.type === 'black') {
      dieEl.addEventListener('dragover', (e) => {
        if (!die.assignedTo && !die.silverDieId && !isCrampPhase) {
          e.preventDefault(); // Permitir drop
        }
      });
    }

    if (die.silverDieId) {
      let badge = document.createElement('div');
      badge.className = 'silver-badge';
      badge.innerText = '+';
      badge.style.pointerEvents = 'auto';
      if (!die.assignedTo) {
        badge.style.cursor = 'pointer';
        badge.title = `Valor original: ${die.originalValue}. Click para separar el dado plateado.`;
        badge.onclick = (e) => {
           e.stopPropagation();
           let sDie = c.playerDice.find(d => d.id === die.silverDieId);
           if (sDie) sDie.assignedTo = null;
           die.value = die.originalValue;
           delete die.silverDieId;
           delete die.originalValue;
           renderCombatOverlay();
        };
      } else {
        badge.title = "Dado potenciado (No se puede separar mientras esté asignado)";
      }
      dieWrapper.appendChild(badge);
    }
    // --- FIN LÓGICA PLATEADO ---

    if (die.assignedTo) {
      // No permitir desasignar calambre si ya pasó su fase
      if (die.isCramped && !isCrampPhase) {
        dieEl.style.cursor = 'default';
        dieEl.title = "Calambre: Asignación fija";
      } else {
        dieEl.style.cursor = 'pointer';
        dieEl.title = 'Click para desasignar';
        dieEl.onclick = (e) => {
          if (activeSelectedDieId) {
             let selectedDie = c.playerDice.find(d => d.id === activeSelectedDieId);
             if (selectedDie && selectedDie.type === 'silver') {
                e.stopPropagation();
                return;
             }
          }
          clearDieAssignment(die.id);
        };
      }
    } else if (!die.assignedTo && (!die.isCramped || isCrampPhase)) {
      // SISTEMA DE RESPALDO (TAP-TO-SELECT): Seleccionar dado para aplicarlo a un objetivo (incluso negros)
      dieEl.style.cursor = 'pointer';
      dieEl.title = 'Click para seleccionar dado';
      if (activeSelectedDieId === die.id) {
        dieEl.classList.add('die-selected');
      }
      dieEl.onclick = () => {
        if (activeSelectedDieId === die.id) {
          activeSelectedDieId = null;
          renderCombatOverlay();
        } else {
          if (activeSelectedDieId) {
             let selectedDie = c.playerDice.find(d => d.id === activeSelectedDieId);
             if (selectedDie && selectedDie.type === 'silver' && !selectedDie.assignedTo && (die.type === 'red' || die.type === 'black') && !die.assignedTo && !die.silverDieId) {
                selectedDie.assignedTo = die.id;
                die.silverDieId = selectedDie.id;
                die.originalValue = die.value;
                die.value += selectedDie.value;
                gameState.addLog(`🎁 <strong>Dado Plateado</strong> fusionado vía clic. ¡Nuevo valor de dado: <span style="color:#c0c0c0; font-weight:bold">${die.value}</span>!`);
                activeSelectedDieId = null;
                renderCombatOverlay();
                return;
             }
          }
          activeSelectedDieId = die.id;
          activeSelectedEquipId = null; // Limpiar selección de equipo
          renderCombatOverlay();
        }
      };
    }

    if (die.type === 'black' && !die.rerolled && !die.assignedTo && (!die.isCramped || isCrampPhase)) {
      const rerollBtn = document.createElement('div');
      rerollBtn.className = 'die-reroll-icon';
      rerollBtn.innerHTML = '↻';
      rerollBtn.title = 'Relanzar dado negro';
      rerollBtn.onclick = (e) => {
        e.stopPropagation(); // Evitar seleccionar el dado
        if (die.silverDieId) {
           let sDie = c.playerDice.find(d => d.id === die.silverDieId);
           if (sDie) sDie.assignedTo = null;
           delete die.silverDieId;
           delete die.originalValue;
        }
        dieEl.classList.add('die-spin');
        setTimeout(() => {
          let newVal = gameState.rerollDie(die.id);
          if (newVal) {
            dieEl.innerText = newVal;
          }
        }, 300);
        setTimeout(() => {
          renderCombatOverlay();
        }, 600);
      };
      dieWrapper.appendChild(rerollBtn);
    }

    if (die.rerolled) {
      let lock = document.createElement('div');
      lock.innerHTML = '🔒';
      lock.style.cssText = 'position: absolute; top: -5px; right: -5px; font-size: 0.8rem; background: #222; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gold); z-index: 10;';
      dieWrapper.appendChild(lock);
      dieEl.title = 'Dado bloqueado';
    }

    dieWrapper.appendChild(dieEl);
    dicePoolContainer.appendChild(dieWrapper);
  });

  function clearInterception(dieId, skipRender = false) {
    for (let gobUid in interceptionAssignments) {
      const initialLength = interceptionAssignments[gobUid].length;
      interceptionAssignments[gobUid] = interceptionAssignments[gobUid].filter(asg => asg.dieId !== dieId);

      if (interceptionAssignments[gobUid].length < initialLength) {
        let dieData = c.playerDice.find(d => d.id === dieId);
        if (dieData) dieData.assignedTo = null;
      }

      if (interceptionAssignments[gobUid].length === 0) {
        delete interceptionAssignments[gobUid];
      }
    }
    if (!skipRender) renderCombatOverlay();
  }

  function clearDieAssignment(dieId) {
    for (let eqId in currentAssignments) {
      let asgData = currentAssignments[eqId];
      if (Array.isArray(asgData)) {
        currentAssignments[eqId] = asgData.filter(a => a.dieId !== dieId);
        if (currentAssignments[eqId].length === 0) delete currentAssignments[eqId];
      } else if (asgData.dieId === dieId) {
        delete currentAssignments[eqId];
      }
    }
    clearInterception(dieId, true);

    let dieData = c.playerDice.find(d => d.id === dieId);
    if (dieData) dieData.assignedTo = null;

    renderCombatOverlay();
  }

  // Render Equipo para asignar
  const equipSlots = document.getElementById('combat-equipment-slots');
  equipSlots.innerHTML = '';

  // Contenedor para la carta de Rol y su botón
  const roleContainer = document.createElement('div');
  roleContainer.className = 'equip-slot-container';
  roleContainer.style.position = 'relative';
  roleContainer.style.display = 'flex';
  roleContainer.style.flexDirection = 'column';
  roleContainer.style.alignItems = 'center';
  roleContainer.style.gap = '8px';

  const combatRoles = ['guerrero', 'mago', 'protector'];
  const hasCombatRole = combatRoles.includes(p.role.id);

  // 1. Render Role Slot
  const roleSlot = document.createElement('div');
  roleSlot.id = `equip-slot-role`;
  roleSlot.className = `equip-slot ${hasCombatRole && p.energy > 0 ? 'role-ready' : ''}`;
  roleSlot.style.backgroundImage = `url('${p.role.image}')`;
  if (!hasCombatRole) roleSlot.style.borderColor = '#00d2ff'; // Azul para el rol
  roleSlot.innerHTML = `<div class="die-placeholder" data-id="role"></div>`;
  if (hasCombatRole) {
    roleSlot.style.cursor = 'pointer';
    roleSlot.title = `Rol: ${p.role.name} (${p.role.effect}). Haz clic en la carta para usar la habilidad.`;
  }

  roleSlot.classList.add('dropzone');
  roleSlot.dataset.dropType = 'combat-role';

  // SISTEMA DE RESPALDO (TAP-TO-SELECT): Asignar dado activo al rol al hacer clic.
  // Si no hay dado seleccionado, al hacer clic en el rol se activa su habilidad.
  roleSlot.addEventListener('click', (e) => {
    if (isRollingCombatDice) return;
    if (activeSelectedDieId) {
      const dieData = c.playerDice.find(d => d.id === activeSelectedDieId);
      if (!dieData) return;
      if (dieData.type === 'silver') { alert("Los dados plateados solo pueden fusionarse con otros dados de la reserva."); return; }

      clearDieAssignment(activeSelectedDieId);

      if (currentAssignments['role'] && currentAssignments['role'].length >= 1) {
        let ejectedAsg = currentAssignments['role'].shift();
        let ejectedDie = c.playerDice.find(d => d.id === ejectedAsg.dieId);
        if (ejectedDie) ejectedDie.assignedTo = null;
      }

      if (!currentAssignments['role']) currentAssignments['role'] = [];
      currentAssignments['role'].push({ dieId: activeSelectedDieId, value: dieData.value, isRole: true });

      dieData.assignedTo = 'role';
      activeSelectedDieId = null;
      renderCombatOverlay();
      e.stopPropagation();
    } else {
      if (hasCombatRole) {
        if (p.energy <= 0) {
          alert(ROLE_NO_ENERGY_WARNING);
          return;
        }
        showTargetSelectionModal(gameState.currentPlayerIndex);
        e.stopPropagation();
      }
    }
  });

  // RESTAURAR ESTADO DE ROL
  const roleAsgs = currentAssignments['role'];
  if (roleAsgs && Array.isArray(roleAsgs)) {
    roleSlot.innerHTML = ''; // Limpiar para re-renderizar múltiples
    roleAsgs.forEach((asg, idx) => {
      const placeholder = document.createElement('div');
      placeholder.className = 'die-placeholder active';
      const dieData = c.playerDice.find(d => d.id === asg.dieId);
      if (dieData) {
        placeholder.innerText = dieData.value;
        placeholder.classList.add(dieData.type);
        if (dieData.faces === 4) placeholder.classList.add('d4');
        if (dieData.isStung) placeholder.classList.add('stung');
        if (dieData.isShaking) placeholder.classList.add('shaking');
        if (dieData.isCramped) placeholder.classList.add('cramped');

        // Ajuste de posición si hay múltiples
        if (roleAsgs.length > 1) {
          placeholder.style.right = (15 + (idx * 40)) + 'px';
        }
        roleSlot.appendChild(placeholder);
      }
    });
  } else {
    roleSlot.innerHTML = `<div class="die-placeholder" data-id="role"></div>`;
  }
  roleContainer.appendChild(roleSlot);

  const energyPulse = p.energy > 0 ? 'energy-pulse' : '';
  const energyBadge = document.createElement('div');
  energyBadge.className = `role-energy-badge ${energyPulse}`;
  energyBadge.innerText = `🔷 ${p.energy}`;
  roleContainer.appendChild(energyBadge);

  equipSlots.appendChild(roleContainer);

  // 2. Render normal equipment slots
  p.equipped.filter(eq => eq.isActive).forEach((eq, index) => {
    const slot = document.createElement('div');
    slot.id = `equip-slot-${eq.id}`;
    
    const currentCombatId = gameState.lastCombatId || 0;
    const isNewBreak = eq.isBroken && eq.brokenInCombatId === currentCombatId;
    const justBroken = isNewBreak && !eq.brokenAnimationPlayed;

    let extraStyle = '';
    let justBrokenClass = '';
    let brokenClass = '';

    if (eq.isBroken) {
      if (isNewBreak && isRollingCombatDice) {
        // No mostrar como roto mientras giran los dados
      } else if (justBroken) {
        justBrokenClass = 'just-broken';
        extraStyle = 'transform: rotate(0deg); transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);';
      } else {
        brokenClass = 'broken';
        extraStyle = 'transform: rotate(180deg);';
      }
    }

    slot.className = `equip-slot ${justBrokenClass} ${brokenClass}`.trim();
    slot.style.backgroundImage = `url('${eq.image}')`;
    if (extraStyle) {
      slot.style.cssText += extraStyle;
    }
    slot.innerHTML = `<div class="die-placeholder" data-id="${eq.id}"></div>`;

    if (activeSelectedEquipId === eq.id) {
      slot.classList.add('equip-selected');
    }

    slot.classList.add('dropzone');
    slot.dataset.dropType = 'equipment';
    slot.dataset.eqId = eq.id;

    // SISTEMA DE RESPALDO (TAP-TO-SELECT): Asignar dado activo al equipo o seleccionar equipo cargado al hacer clic
    slot.addEventListener('click', (e) => {
      if (isRollingCombatDice) return;
      if (activeSelectedDieId) {
        const dieData = c.playerDice.find(d => d.id === activeSelectedDieId);
        if (!dieData) return;
        if (dieData.type === 'silver') { alert("Los dados plateados solo pueden fusionarse con otros dados de la reserva."); return; }

        if (!gameState.isValidDieForEquipment(dieData.value, eq)) return;

        clearDieAssignment(activeSelectedDieId);

        const extra = (eq.isBroken && eq.broken && eq.broken.extra !== undefined ? eq.broken.extra : (eq.extra || '')).toLowerCase();
        const isReusable = extra.includes('reutilizable');
        const maxUses = extra.includes('x3') ? 3 : (isReusable ? 6 : 1);

        if (maxUses === 1 && currentAssignments[eq.id] && currentAssignments[eq.id].length > 0) {
          const oldDieId = currentAssignments[eq.id][0].dieId;
          const oldDieData = c.playerDice.find(d => d.id === oldDieId);
          if (oldDieData && oldDieData.isCramped) {
            alert("No puedes sustituir un dado con Calambre.");
            return;
          }
          clearDieAssignment(oldDieId);
        }

        if (!currentAssignments[eq.id]) currentAssignments[eq.id] = [];

        if (currentAssignments[eq.id].length >= maxUses) return;

        if (eq.id === 'corazon_elastico') {
          const curDieId = activeSelectedDieId;
          const curDieVal = dieData.value;
          activeSelectedDieId = null;

          showElasticModal(curDieId, curDieVal, eq.id, (damageChosen) => {
            currentAssignments[eq.id].push({ dieId: curDieId, value: curDieVal, targetUid: null, elasticDamage: damageChosen });
            dieData.assignedTo = eq.id;
            renderCombatOverlay();
          });
          e.stopPropagation();
          return;
        }

        currentAssignments[eq.id].push({ dieId: activeSelectedDieId, value: dieData.value, targetUid: null, elasticDamage: null });
        dieData.assignedTo = eq.id;
        activeSelectedDieId = null;
        renderCombatOverlay();
        e.stopPropagation();
      } else {
        const asgs = currentAssignments[eq.id];
        if (asgs && asgs.length > 0) {
          const eqObj = p.equipped.find(e => e.id === eq.id);
          const dealsDamage = doesEquipmentDealDamage(eqObj, asgs[0].value, asgs[0]);
          if (!dealsDamage) {
            e.stopPropagation();
            return;
          }
          if (activeSelectedEquipId === eq.id) {
            activeSelectedEquipId = null;
            renderCombatOverlay();
          } else {
            activeSelectedEquipId = eq.id;
            activeSelectedDieId = null; // Limpiar selección de dado
            renderCombatOverlay();
          }
          e.stopPropagation();
        }
      }
    });

    // RESTAURAR ESTADO DE EQUIPO
    const asgs = currentAssignments[eq.id];
    if (asgs && Array.isArray(asgs)) {
      slot.innerHTML = '';
      asgs.forEach((asg, idx) => {
        const placeholder = document.createElement('div');
        placeholder.className = 'die-placeholder active';
        const dieData = c.playerDice.find(d => d.id === asg.dieId);
        if (dieData) {
          placeholder.innerText = dieData.value;
          placeholder.classList.add(dieData.type);
          if (dieData.faces === 4) placeholder.classList.add('d4');
          if (dieData.isStung) placeholder.classList.add('stung');
          if (dieData.isShaking) placeholder.classList.add('shaking');
          if (dieData.isCramped) placeholder.classList.add('cramped');

          // Ajuste de posición si hay múltiples
          if (asgs.length > 1) {
            placeholder.style.top = (15 + (idx * 55)) + 'px';
          }
          slot.appendChild(placeholder);
        }
      });

      // El primer dado del equipo decide si la carta está "cargada" para ser arrastrada al objetivo
      // (En este juego, toda la carta se asigna a un objetivo)
      if (asgs.length > 0) {
        slot.classList.add('loaded');
        const eqObj = p.equipped.find(e => e.id === eq.id);
        const dealsDamage = doesEquipmentDealDamage(eqObj, asgs[0].value, asgs[0]);
        if (dealsDamage) {
          slot.draggable = !isRollingCombatDice;
          slot.classList.add('draggable');
          if (asgs.some(a => a.targetUid)) slot.style.opacity = '0.5';
        } else {
          slot.draggable = false;
          slot.style.cursor = 'default';
        }
      }
    }

    equipSlots.appendChild(slot);
  });

  TutorialManager.evaluateSituation();

  setTimeout(() => {
    document.querySelectorAll('#combat-equipment-slots .equip-slot.just-broken').forEach(slot => {
      slot.style.transform = 'rotate(180deg)';
      slot.classList.add('broken');
      slot.classList.remove('just-broken');
      const eqId = slot.id.replace('equip-slot-', '');
      const eq = p.equipped.find(e => e.id === eqId);
      if (eq) {
        eq.brokenAnimationPlayed = true;
      }
    });
  }, 100);

  // Dibujar flechas de asignación y objetivos
  if (typeof window.drawCombatArrows === 'function') {
    window.drawCombatArrows();
    setTimeout(() => {
      if (typeof window.drawCombatArrows === 'function') window.drawCombatArrows();
    }, 50);
    setTimeout(() => {
      if (typeof window.drawCombatArrows === 'function') window.drawCombatArrows();
    }, 150);
  }
}

// ============================================================================
// DIBUJADO DINÁMICO DE FLECHAS DE COMBATE (ASIGNACIONES DE DADOS Y OBJETIVOS)
// ============================================================================
window.drawCombatArrows = function() {
  const overlay = document.getElementById('combat-overlay');
  if (!overlay || overlay.classList.contains('hidden')) {
    const svg = document.getElementById('combat-arrows-svg');
    if (svg) {
      const defs = svg.querySelector('defs');
      svg.innerHTML = '';
      if (defs) svg.appendChild(defs);
    }
    return;
  }

  const svg = document.getElementById('combat-arrows-svg');
  if (!svg) return;

  // Limpiar paths anteriores manteniendo las definiciones
  const defs = svg.querySelector('defs');
  svg.innerHTML = '';
  if (defs) svg.appendChild(defs);

  const overlayRect = overlay.getBoundingClientRect();

  function getCenter(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: rect.left - overlayRect.left + rect.width / 2,
      y: rect.top - overlayRect.top + rect.height / 2,
      rect: rect
    };
  }

  function drawArrow(startX, startY, endX, endY, type, isCurved = false) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    let d = '';
    let startOffset = 20; // Radio del dado / margen
    let endOffset = 25;   // Margen del objetivo (deja espacio para el marcador de punta de flecha)
    
    if (isCurved) {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) return;

      // Desplazamiento perpendicular de la curva para dar efecto arqueado
      const curveAmount = 45;
      const px = (-dy / dist) * curveAmount;
      const py = (dx / dist) * curveAmount;
      
      const controlX = midX + px;
      const controlY = midY + py;
      
      // Ajuste de los extremos basándose en la tangente para que salgan y entren limpios
      const dxStart = controlX - startX;
      const dyStart = controlY - startY;
      const distStart = Math.hypot(dxStart, dyStart);
      const sX = startX + (dxStart / distStart) * startOffset;
      const sY = startY + (dyStart / distStart) * startOffset;
      
      const dxEnd = endX - controlX;
      const dyEnd = endY - controlY;
      const distEnd = Math.hypot(dxEnd, dyEnd);
      const eX = endX - (dxEnd / distEnd) * endOffset;
      const eY = endY - (dyEnd / distEnd) * endOffset;
      
      d = `M ${sX} ${sY} Q ${controlX} ${controlY} ${eX} ${eY}`;
    } else {
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) return;
      
      const sX = startX + (dx / dist) * startOffset;
      const sY = startY + (dy / dist) * startOffset;
      const eX = endX - (dx / dist) * endOffset;
      const eY = endY - (dy / dist) * endOffset;
      
      d = `M ${sX} ${sY} L ${eX} ${eY}`;
    }
    
    path.setAttribute('d', d);
    
    let colorClass = '';
    let markerId = '';
    let strokeColor = '';
    
    switch (type) {
      case 'equip':
        colorClass = 'dash-flow-equip';
        markerId = 'arrowhead-gold';
        strokeColor = '#d4af37';
        break;
      case 'role':
        colorClass = 'dash-flow-role';
        markerId = 'arrowhead-blue';
        strokeColor = '#00d2ff';
        break;
      case 'intercept':
        colorClass = 'dash-flow-intercept';
        markerId = 'arrowhead-green';
        strokeColor = '#33cc33';
        break;
      case 'target':
        colorClass = 'dash-flow-target';
        markerId = 'arrowhead-red';
        strokeColor = '#ff4d4d';
        break;
    }
    
    path.setAttribute('class', `combat-arrow-path ${colorClass}`);
    path.setAttribute('marker-end', `url(#${markerId})`);
    path.setAttribute('stroke', strokeColor);
    svg.appendChild(path);
  }

  // 1. Dibujar flechas desde los dados a los slots de equipamiento o rol
  for (let eqId in currentAssignments) {
    const asgData = currentAssignments[eqId];
    const asgList = Array.isArray(asgData) ? asgData : [asgData];
    
    asgList.forEach(asg => {
      const dieEl = document.getElementById(asg.dieId);
      if (!dieEl) return;
      
      const centerStart = getCenter(dieEl);
      if (!centerStart) return;
      
      if (eqId === 'role') {
        const slotEl = document.getElementById('equip-slot-role');
        const centerEnd = getCenter(slotEl);
        if (centerEnd) {
          drawArrow(centerStart.x, centerStart.y, centerEnd.x, centerEnd.y, 'role');
        }
      } else {
        const slotEl = document.getElementById(`equip-slot-${eqId}`);
        const centerEnd = getCenter(slotEl);
        if (centerEnd) {
          drawArrow(centerStart.x, centerStart.y, centerEnd.x, centerEnd.y, 'equip');
        }
      }
    });
  }

  // 2. Dibujar flechas desde los dados a los Goblins (intercepciones)
  for (let gobUid in interceptionAssignments) {
    const asgData = interceptionAssignments[gobUid];
    const asgList = Array.isArray(asgData) ? asgData : [asgData];
    
    asgList.forEach(asg => {
      const dieEl = document.getElementById(asg.dieId);
      if (!dieEl) return;
      
      const centerStart = getCenter(dieEl);
      if (!centerStart) return;
      
      // Intentar apuntar al dado verde específico primero, o a la carta de goblin en su defecto
      const targetDieEl = document.getElementById(`green-die-${gobUid}-${asg.goblinDieIndex}`);
      const goblinCardEl = document.getElementById(`goblin-card-${gobUid}`);
      
      const centerEnd = getCenter(targetDieEl) || getCenter(goblinCardEl);
      if (centerEnd) {
        drawArrow(centerStart.x, centerStart.y, centerEnd.x, centerEnd.y, 'intercept');
      }
    });
  }

  // 3. Dibujar flechas desde el equipamiento a los Goblins (objetivos de ataque)
  for (let eqId in currentAssignments) {
    if (eqId === 'role') continue;
    
    const asgData = currentAssignments[eqId];
    const asgList = Array.isArray(asgData) ? asgData : [asgData];
    
    const firstAsg = asgList[0];
    if (firstAsg && firstAsg.targetUid) {
      const slotEl = document.getElementById(`equip-slot-${eqId}`);
      const goblinCardEl = document.getElementById(`goblin-card-${firstAsg.targetUid}`);
      
      const centerStart = getCenter(slotEl);
      const centerEnd = getCenter(goblinCardEl);
      
      if (centerStart && centerEnd) {
        drawArrow(centerStart.x, centerStart.y, centerEnd.x, centerEnd.y, 'target', true);
      }
    }
  }
};

// Registrar el listener de redimensionado solo una vez
if (!window.combatArrowsResizeRegistered) {
  window.addEventListener('resize', () => {
    if (typeof window.drawCombatArrows === 'function') {
      window.drawCombatArrows();
    }
  });
  window.combatArrowsResizeRegistered = true;
}

// El control de btn-cancel-combat y btn-resolve-combat se gestiona íntegramente
// dentro de renderCombatOverlay para soportar las fases de Calambre.

let prevPlayerStats = [];

function renderPlayer() {
  playersContainer.innerHTML = '';
  const currentPlayerIdx = gameState.currentPlayerIndex;

  gameState.players.forEach((p, index) => {
    const isCurrent = index === currentPlayerIdx;

    // Obtener estadísticas previas para comparar
    const prev = prevPlayerStats[index] || {};
    const getPulseClass = (current, previous) => (previous !== undefined && current !== previous) ? 'pulse-stat' : '';

    const hpPulse = getPulseClass(p.hp, prev.hp);
    const moPulse = getPulseClass(p.mo, prev.mo);
    const energyPulse = getPulseClass(p.energy, prev.energy);
    const pexPulse = getPulseClass(p.pex, prev.pex);
    const levelPulse = getPulseClass(p.level, prev.level);
    const blocksPulse = getPulseClass(gameState.getPlayerBlocks(p), prev.blocks);

    const currentBlocks = gameState.getPlayerBlocks(p);
    const maxBlocks = DB.playerLevels[p.level - 1].blocks;
    const isOverweight = currentBlocks >= maxBlocks;

    // Generar HTML del equipo
    let eqHTML = '';
    p.equipped.forEach((eq, eqIdx) => {
      const currentCombatId = gameState.lastCombatId || 0;
      const justBroken = eq.isBroken && eq.brokenInCombatId === currentCombatId && !eq.brokenAnimationPlayed;

      let extraStyle = '';
      let justBrokenClass = '';
      if (justBroken) {
        justBrokenClass = 'just-broken';
        extraStyle = 'transform: rotate(0deg); transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);';
      } else if (eq.isBroken) {
        extraStyle = 'transform: rotate(180deg);';
      }

      let activeClass = eq.isActive ? '' : 'inactive';

      const canRepair = eq.isBroken &&
        p.mo >= 1 &&
        gameState.lastActionWasCombat &&
        currentCombatId > 0 &&
        eq.brokenInCombatId !== currentCombatId &&
        eq.usedInCombatId === currentCombatId;
      const repairBtnHTML = canRepair ? `<button class="btn primary repair-btn" style="position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%) rotate(180deg); font-size: 0.75rem; padding: 4px 8px; z-index: 20;">Reparar</button>` : '';
      let repairableClass = canRepair ? 'can-repair-glow' : '';
      
      let justBoughtClass = eq._justBoughtId ? 'just-bought-hidden' : '';

      eqHTML += `<div class="equipment-card ${activeClass} ${justBrokenClass} ${repairableClass} ${justBoughtClass}" 
                      data-player-index="${index}" 
                      data-eq-index="${eqIdx}" 
                      style="background-image: url('${eq.image}'); ${extraStyle}">
                      ${!eq.isActive ? '<div class="inactive-overlay">📦</div>' : ''}
                      ${repairBtnHTML}
                 </div>`;
    });

    let statusHTML = '';
    if (p.shield > 0) {
      statusHTML += `<div class="status-icon escudo" title="Escudos: ${p.shield}">${SHIELD_SVG} <span>${p.shield}</span></div>`;
    }
    if (p.statusEffects.escozor > 0) {
      statusHTML += `<div class="status-icon escozor" title="Escozor: ${p.statusEffects.escozor}">&#128293; <span>${p.statusEffects.escozor}</span></div>`;
    }
    if (p.statusEffects.eliminaRojo > 0) {
      statusHTML += `<div class="status-icon elimina-rojo" style="background: #ef233c; border-color: #d90429;" title="Dado rojo anulado: ${p.statusEffects.eliminaRojo}">&#127922;&#10060; <span>${p.statusEffects.eliminaRojo}</span></div>`;
    }
    if (p.statusEffects.calambre > 0) {
      statusHTML += `<div class="status-icon calambre" title="Calambre: ${p.statusEffects.calambre}">&#9889; <span>${p.statusEffects.calambre}</span></div>`;
    }
    if (p.statusEffects.tembleque > 0) {
      statusHTML += `<div class="status-icon tembleque" title="Tembleque: ${p.statusEffects.tembleque}">&#10052; <span>${p.statusEffects.tembleque}</span></div>`;
    }

    const expReq = {
      1: 2 * gameState.players.length,
      2: 6 * gameState.players.length,
      3: 12 * gameState.players.length,
      4: 22 * gameState.players.length
    };
    const nextExp = expReq[p.level] || '-';
    const isLowHP = p.hp <= (p.maxHp * 0.25);

    let canUseRole = false;
    if (isCurrent && p.energy > 0) {
      const rId = p.role.id;
      if (rId === 'guerrero') {
        if (gameState.currentCombat) {
          canUseRole = gameState.currentCombat.goblins.some(g => !g.isDying);
        } else {
          canUseRole = gameState.battlefield.goblins.some(g => p.goblinsFoughtThisTurn && p.goblinsFoughtThisTurn.includes(g.uid) && !g.isDying);
        }
      } else if (rId === 'mago') {
        canUseRole = gameState.battlefield.goblins.some(g => g.currentHp > 1 && !g.isDying);
      } else if (rId === 'protector') {
        canUseRole = true;
      } else if (rId === 'sanador') {
        canUseRole = gameState.players.some(pl => pl.hp < pl.maxHp && (pl.id === p.id ? p.energy >= 1 : p.energy >= 2));
      } else if (rId === 'curandero') {
        canUseRole = gameState.players.some(pl => pl.equipped.some(eq => eq.isBroken) && (pl.id === p.id ? p.energy >= 1 : p.energy >= 2));
      } else if (rId === 'ladron') {
        canUseRole = true;
      }
    }

    const isDead = p.hp <= 0;
    const activePlayer = gameState.getCurrentPlayer();
    const canRevive = isDead && !isCurrent && activePlayer && activePlayer.hp >= 2 && !gameState.isMarketPhase && !gameState.currentCombat;
    
    let reviveBtnHTML = '';
    if (canRevive) {
        reviveBtnHTML = `
        <button class="btn revive-btn" data-target-id="${p.id}" style="
            width: 120px; 
            height: 168px; 
            background: linear-gradient(135deg, #1f6b45, #2ecc71); 
            color: white; 
            border: 2px solid var(--gold); 
            border-radius: 8px; 
            cursor: pointer; 
            box-shadow: 0 0 15px rgba(46, 204, 113, 0.6); 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            font-family: 'Cinzel', serif;
            font-size: 1.2rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.8);
            transition: transform 0.2s;
            flex-shrink: 0;
            margin-right: 5px;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <span style="font-size: 3rem; margin-bottom: 10px;">&#10084;&#65039;</span>
            Dar Vida
        </button>`;
    }

    let botBubbleHTML = '';
    if (p.isBot) {
        botBubbleHTML = `
            <div id="bot-bubble-${index}" class="bot-bubble" style="
                position: absolute;
                bottom: 150px;
                left: 50%;
                transform: translateX(-50%) translateY(10px);
                background: rgba(245, 245, 250, 0.95);
                border: 4px solid var(--gold);
                border-radius: 12px;
                padding: 14px 20px;
                color: #222;
                font-family: 'Outfit', sans-serif;
                font-size: 0.95rem;
                font-weight: 500;
                z-index: 9999999;
                box-shadow: 0 8px 25px rgba(0,0,0,0.5), 0 0 15px rgba(212,175,55,0.2);
                backdrop-filter: blur(5px);
                width: 300px;
                text-align: center;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.4s ease, transform 0.4s ease;
            ">
               <div id="bot-bubble-text-${index}" style="line-height: 1.4;"></div>
               <div style="position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid var(--gold);"></div>
               <div style="position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 7px solid rgba(245, 245, 250, 0.95);"></div>
            </div>
        `;
    }

    let dnaHTML = '';
    if (p.isBot && p.botDNA && p.botDNA.length >= 2) {
        dnaHTML = `<div style="font-size: 0.65rem; color: #a5a5a5; background: rgba(0,0,0,0.6); padding: 2px 5px; border-radius: 4px; border: 1px solid var(--gold); display: flex; align-items: center; justify-content: center; cursor: help;" title="ADN Bot:&#10;1. ${p.botDNA[0]}&#10;2. ${p.botDNA[1]}&#10;3. ${p.botDNA[2]}">&#129302;</div>`;
    }

    const panelHTML = `
      <div class="player-panel ${isCurrent ? 'active-turn' : ''} ${isDead ? 'player-dead' : ''}" style="position: relative;">
        ${botBubbleHTML}
        <div class="player-hud-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 8px; margin-bottom: 8px; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <h3 class="player-name-hover" data-player-index="${index}" style="font-size: 1.2rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 60px; max-width: 120px; cursor: pointer;">${p.name}</h3>
                ${dnaHTML}
                <div class="status-effects-container">${statusHTML}</div>
            </div>
            <div class="stats">
                <div class="stat hp ${isLowHP ? 'low-hp' : ''}" title="Puntos de Vida">&#10084;&#65039; <span class="${hpPulse}">${p.hp}</span>/<span>${p.maxHp}</span></div>
                <div class="stat gold" title="Monedas">${COIN_SVG} <span class="${moPulse}">${p.mo}</span></div>
                <div class="stat blocks" title="Carga de Equipo" style="${isOverweight ? 'color: var(--accent-red);' : ''}">${SACK_SVG} <span class="${blocksPulse}">${currentBlocks}</span>/<span>${maxBlocks}</span></div>
            </div>
        </div>
        
        <div class="player-dashboard">
            <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; height: 100%;">
                <div class="player-role ${canUseRole ? 'role-ready' : ''}" 
                     data-player-index="${index}"
                     style="background-image: url('${p.role.image.replace('rol_', 'mini_rol_')}'); background-size: cover; background-position: left; cursor: ${isCurrent ? 'pointer' : 'default'};">
                     <div class="role-energy-badge ${energyPulse}">🔷 ${p.energy}</div>
                </div>
            </div>
            <div class="player-equipment">
                ${reviveBtnHTML}
                ${eqHTML}
            </div>
        </div>
      </div>
    `;

    const panelDiv = document.createElement('div');
    panelDiv.innerHTML = panelHTML;
    playersContainer.appendChild(panelDiv.firstElementChild);
    const lastPanel = playersContainer.lastElementChild;

    // Eventos para las cartas de equipo (toggle y reparar)
    const cards = lastPanel.querySelectorAll('.equipment-card');
    cards.forEach(cardEl => {
      const repairBtn = cardEl.querySelector('.repair-btn');
      if (repairBtn) {
        repairBtn.onclick = (e) => {
          e.stopPropagation();
          const pIdx = parseInt(cardEl.dataset.playerIndex);
          const eqIdx = parseInt(cardEl.dataset.eqIndex);
          const playerObj = gameState.players[pIdx];
          const eqObj = playerObj.equipped[eqIdx];
          if (playerObj.mo >= 1 && eqObj.isBroken) {
            playerObj.mo -= 1;
            eqObj.isBroken = false;
            eqObj.brokenAnimationPlayed = false;
            gameState.addLog(`🛠️ <strong>${playerObj.name}</strong> pagó 1 mo para reparar <strong>${eqObj.name}</strong>.`);
            updateUI();
          }
        };
      }

      cardEl.onclick = () => {
        const pIdx = parseInt(cardEl.dataset.playerIndex);
        const eqIdx = parseInt(cardEl.dataset.eqIndex);
        const res = gameState.toggleEquipment(pIdx, eqIdx);

        if (res === "OVERWEIGHT") {
          alert("¡DEMASIADO PESO! No puedes equipar este objeto sin quitar otro antes.");
        } else if (res === "DUPLICATE_ACTIVE") {
          alert("¡OBJETO DUPLICADO! <br>Ya tienes un objeto idéntico activo. Desactiva el actual si quieres equipar este.");
        } else {
          updateUI();
        }
      };
    });

    // Evento para la carta de rol
    const roleCard = lastPanel.querySelector('.player-role');
    if (roleCard) {
      roleCard.onclick = () => {
        const pIdx = parseInt(roleCard.dataset.playerIndex);
        if (pIdx !== gameState.currentPlayerIndex) return;

        const p = gameState.players[pIdx];
        const roleId = p.role.id;

        if (p.energy <= 0) {
          alert(ROLE_NO_ENERGY_WARNING);
          return;
        }

        if (roleId === 'guerrero' && !gameState.currentCombat) {
          const validGobs = gameState.battlefield.goblins.filter(g => p.goblinsFoughtThisTurn && p.goblinsFoughtThisTurn.includes(g.uid) && !g.isDying);
          if (validGobs.length === 0) {
            alert("El Guerrero solo puede atacar con su habilidad a Goblins con los que haya combatido durante este mismo turno.");
            return;
          }
        }

        // Si solo hay un jugador, aplicar a sí mismo directamente (excepto Mago y Guerrero que atacan goblins y Curandero con varias roturas)
        if (gameState.players.length === 1 && roleId !== 'mago' && roleId !== 'guerrero') {
          if (roleId === 'curandero') {
            const brokenItems = p.equipped.filter(eq => eq.isBroken);
            if (brokenItems.length > 1) {
              // Si hay varias, abrir modal para elegir
              showTargetSelectionModal(pIdx);
              return;
            } else if (brokenItems.length === 0) {
              alert(NO_BROKEN_EQUIP_ALERT);
              return;
            }
            // Si solo hay una, aplicar directamente
          }

          const res = gameState.useRoleAbility(pIdx, pIdx);
          if (res === true) {
            updateUI();
          } else if (res === "NOT_ENOUGH_ENERGY") {
            alert(NO_ENERGY_ALERT);
          } else if (res === false) {
            if (roleId === 'sanador' && p.hp >= p.maxHp) {
              alert("Ya tienes la vida al máximo.");
            } else if (roleId === 'curandero') {
              alert(NO_BROKEN_EQUIP_ALERT);
            }
          }
          return;
        }

        // Lógica existente para múltiples jugadores (abre el modal)
        const result = gameState.useRoleAbility(pIdx);

        if (result === "NEED_TARGET") {
          showTargetSelectionModal(pIdx);
        } else if (result === "NOT_ENOUGH_ENERGY") {
          alert(NO_ENERGY_ALERT);
        } else if (result === true) {
          updateUI();
        }
      };
    }

    const reviveBtn = lastPanel.querySelector('.revive-btn');
    if (reviveBtn) {
      reviveBtn.onclick = () => {
        const targetId = parseInt(reviveBtn.dataset.targetId);
        const activePlayer = gameState.getCurrentPlayer();
        const targetPlayer = gameState.players.find(pl => pl.id === targetId);
        
        if (!activePlayer || !targetPlayer || activePlayer.hp < 2) return;
        
        const maxGive = Math.floor(activePlayer.hp / 2);
        
        const modal = document.getElementById('revive-modal');
        const slider = document.getElementById('revive-slider');
        const targetHpEl = document.getElementById('revive-target-hp');
        const donorHpEl = document.getElementById('revive-donor-hp');
        const targetNameEl = document.getElementById('revive-target-name');
        const donorNameEl = document.getElementById('revive-donor-name');
        const btnCancel = document.getElementById('btn-cancel-revive');
        const btnConfirm = document.getElementById('btn-confirm-revive');
        
        targetNameEl.innerText = targetPlayer.name;
        donorNameEl.innerText = activePlayer.name;
        slider.max = maxGive;
        slider.value = 1;
        
        const updateHpPreview = () => {
            const amount = parseInt(slider.value, 10);
            targetHpEl.innerText = targetPlayer.hp + amount;
            donorHpEl.innerText = activePlayer.hp - (amount * 2);
        };
        
        slider.oninput = updateHpPreview;
        updateHpPreview();
        
        btnCancel.onclick = () => {
            modal.classList.add('hidden');
        };
        
        btnConfirm.onclick = () => {
            modal.classList.add('hidden');
            const amount = parseInt(slider.value, 10);
            const cost = amount * 2;
            activePlayer.hp -= cost;
            targetPlayer.hp += amount;
            gameState.addLog(`&#10084;&#65039; <strong>${activePlayer.name}</strong> sacrificó ${cost} PV para darle ${amount} PV a <strong>${targetPlayer.name}</strong>.`);
            
            if (activePlayer.hp <= 0) {
              gameState.addLog(`&#128128; <strong>${activePlayer.name}</strong> ha caído inconsciente por el esfuerzo.`);
              if (!gameState.checkGameOver()) {
                gameState.nextTurn();
              }
            }
            updateUI();
        };
        
        modal.classList.remove('hidden');
      };
    }

    // Actualizar historial de stats para el próximo render
    prevPlayerStats[index] = { hp: p.hp, mo: p.mo, energy: p.energy, pex: p.pex, level: p.level, blocks: currentBlocks };
  });

  setTimeout(() => {
    document.querySelectorAll('.equipment-card.just-broken').forEach(card => {
      card.style.transform = 'rotate(180deg)';
      card.classList.remove('just-broken');
      const pIdx = card.dataset.playerIndex;
      const eqIdx = card.dataset.eqIndex;
      if (gameState.players[pIdx] && gameState.players[pIdx].equipped[eqIdx]) {
        gameState.players[pIdx].equipped[eqIdx].brokenAnimationPlayed = true;
      }
    });
  }, 100);
}

window.showTargetSelectionModal = function (playerIndex) {
  const p = gameState.players[playerIndex];
  const modal = document.getElementById('target-modal');
  const title = document.getElementById('target-modal-title');
  const desc = document.getElementById('target-modal-desc');
  const options = document.getElementById('target-modal-options');

  title.innerText = `Habilidad: ${p.role.name}`;
  desc.innerText = p.role.effect;
  options.innerHTML = '';

  const roleId = p.role.id;

  // Clase específica para el layout del curandero
  const modalContent = modal.querySelector('.modal-content');
  if (roleId === 'curandero') {
    options.classList.add('curandero-layout');
    modalContent.classList.add('wide-modal');
    modalContent.style.maxWidth = '';
  } else if (roleId === 'guerrero' || roleId === 'mago') {
    options.classList.remove('curandero-layout');
    modalContent.classList.remove('wide-modal');
    modalContent.style.maxWidth = '1800px';
  } else {
    options.classList.remove('curandero-layout');
    modalContent.classList.remove('wide-modal');
    modalContent.style.maxWidth = '';
  }

  // Visor de Energía Actual del Jugador (Visible para todos)
  const energyVisor = document.createElement('div');
  energyVisor.className = 'modal-energy-visor';
  energyVisor.innerHTML = `
    <span>TU ENERGÍA:</span>
    <span class="energy-val" style="font-size: 1.5rem;">${p.energy} 🔷</span>
  `;
  options.appendChild(energyVisor);

  // LÓGICA ESPECIAL PARA CURANDERO (Mostrar cartas rotas)
  if (roleId === 'curandero') {
    desc.innerHTML = `Selecciona una carta equipada para <strong>repararla</strong>.<br><small>(Coste: 1🔷 Propio / 2🔷 Aliado)</small>`;

    let anyBroken = false;
    gameState.players.forEach((targetP, targetIdx) => {
      const brokenOfThisPlayer = targetP.equipped.filter(eq => eq.isBroken);

      if (brokenOfThisPlayer.length > 0) {
        anyBroken = true;
        const isSelf = targetIdx === playerIndex;
        const cost = isSelf ? 1 : 2;

        // Contenedor por jugador
        const playerGroup = document.createElement('div');
        playerGroup.className = 'player-repair-group';
        playerGroup.innerHTML = `
          <div class="repair-group-header">
            <div class="repair-group-title">${isSelf ? 'TU EQUIPO' : targetP.name.toUpperCase()}</div>
            <div class="repair-group-cost ${p.energy < cost ? 'insufficient' : ''}">Coste: ${cost}🔷</div>
          </div>
        `;

        const cardsGrid = document.createElement('div');
        cardsGrid.className = 'repair-cards-grid';

        targetP.equipped.forEach((eq, eqIdx) => {
          if (eq.isBroken) {
            const card = document.createElement('div');
            card.className = `equipment-card ${p.energy < cost ? 'disabled' : ''}`;
            card.style.backgroundImage = `url('${eq.image}')`;
            card.style.width = '120px';
            card.style.height = '180px';
            card.style.cursor = p.energy >= cost ? 'pointer' : 'not-allowed';

            card.onclick = () => {
              if (p.energy < cost) return;
              gameState.useRoleAbility(playerIndex, targetIdx, eqIdx);
              updateUI();
              if (p.energy > 0) showTargetSelectionModal(playerIndex);
              else modal.classList.add('hidden');
            };
            cardsGrid.appendChild(card);
          }
        });

        playerGroup.appendChild(cardsGrid);
        options.appendChild(playerGroup);
      }
    });

  } else if (roleId === 'guerrero' || roleId === 'mago') {
    // LÓGICA PARA GUERRERO / MAGO (Atacar Goblins)
    desc.innerHTML = `Selecciona un Goblin para infligirle <strong>daño directo</strong>.<br><small>(Coste: 1🔷 por daño)</small>`;

    let allGoblins = [];
    if (roleId === 'mago') {
      allGoblins = gameState.battlefield.goblins;
    } else { // guerrero
      if (gameState.currentCombat) {
        allGoblins = gameState.currentCombat.goblins;
      } else {
        allGoblins = gameState.battlefield.goblins.filter(g => p.goblinsFoughtThisTurn && p.goblinsFoughtThisTurn.includes(g.uid));
      }
    }
    const activeGoblins = allGoblins.filter(g => !g.isDying);

    if (activeGoblins.length === 0) {
      options.innerHTML = '<p style="color:#ccc; padding: 20px;">No hay goblins activos a los que atacar.</p>';
    } else {
      const gobGrid = document.createElement('div');
      gobGrid.className = 'others-grid';
      gobGrid.style.justifyContent = 'center';

      activeGoblins.forEach(gob => {
        const isInCombat = gameState.currentCombat && gameState.currentCombat.goblins.some(cg => cg.uid === gob.uid);
        
        let maxDamage = gob.currentHp;
        if (roleId === 'mago') maxDamage -= 1;
        maxDamage = Math.min(p.energy, maxDamage);
        
        const isMagoRestricted = (roleId === 'mago' && gob.currentHp === 1);
        const isDisabled = (maxDamage < 1 || p.energy < 1 || isMagoRestricted);
        
        let borderColor = 'var(--accent-red)';
        let displayImg = gob.image;
        if (gob.isHito) {
          borderColor = '#9d4edd';
        } else if (gob.level < p.level) {
          borderColor = '#000000';
          if (!gob.isInvocacion && !displayImg.includes('invocacion')) {
            displayImg = displayImg.replace(/([^\/]+)$/, 'nomo_$1');
          }
        }

        const cardWrapper = document.createElement('div');
        cardWrapper.style.display = 'flex';
        cardWrapper.style.flexDirection = 'column';
        cardWrapper.style.alignItems = 'center';
        cardWrapper.style.gap = '8px';

        const gbtn = document.createElement('div');
        gbtn.className = 'target-btn other-btn';
        if (isDisabled) gbtn.classList.add('disabled');
        
        gbtn.style.width = '220px';
        gbtn.style.height = '308px';
        gbtn.style.minHeight = '308px';
        gbtn.style.flexShrink = '0';
        gbtn.style.minWidth = '220px';
        gbtn.style.maxWidth = '220px';
        gbtn.style.padding = '0';
        gbtn.style.overflow = 'hidden';
        gbtn.style.position = 'relative';
        gbtn.style.border = `4px solid ${borderColor}`;
        if (gob.level < p.level) {
          gbtn.style.boxShadow = '0 0 25px rgba(0,0,0,0.9)';
        }
        gbtn.style.borderRadius = '12px';
        displayImg = getGoblinImageWithHpState(gob, displayImg);
        gbtn.style.backgroundImage = `url('${displayImg}')`;
        gbtn.style.backgroundSize = '100% 100%';
        gbtn.style.display = 'block';

        gbtn.innerHTML = `
          <div style="position: absolute; top: -16px; right: -16px; background: var(--accent-red); color: white; border-radius: 50%; width: 56px; height: 56px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1.9rem; box-shadow: 0 0 10px rgba(0,0,0,0.8); z-index: 10; border: 2px solid white;">${gob.currentHp}</div>
          <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.8); color: ${isDisabled ? '#ff4d4d' : 'var(--gold)'}; text-align: center; font-size: 1.0rem; padding: 8px 0; font-weight: bold; text-shadow: 0 0 4px black;">COSTE: <span class="cost-val">1</span>&#9889;</div>
          ${isMagoRestricted ? '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,0,0,0.5); display: flex; justify-content: center; align-items: center; font-size: 5rem; text-shadow: 0 0 15px black; z-index: 5;">&#10060;</div>' : ''}
          ${isInCombat ? '<div style="position: absolute; top: 10px; left: 10px; font-size: 1.8rem; filter: drop-shadow(0 0 5px black); z-index: 5;">&#9876;&#65039;</div>' : ''}
          <div class="dmg-preview" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ff3366; font-size: 5rem; font-weight: bold; text-shadow: 0 0 15px black, 0 0 5px white; z-index: 6; pointer-events: none; opacity: 0; transition: opacity 0.2s;">-1</div>
        `;

        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'damage-slider-container';
        sliderContainer.style.width = '100%';
        sliderContainer.style.display = isDisabled ? 'none' : 'flex';
        sliderContainer.style.flexDirection = 'column';
        sliderContainer.style.alignItems = 'center';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'damage-slider';
        slider.min = '1';
        slider.max = Math.max(1, maxDamage).toString();
        slider.value = '1';
        slider.style.width = '90%';
        slider.style.cursor = 'pointer';
        
        const sliderLabel = document.createElement('span');
        sliderLabel.style.fontSize = '0.85rem';
        sliderLabel.style.color = 'var(--text-dim)';
        sliderLabel.style.marginTop = '4px';
        sliderLabel.innerHTML = `Infligir <strong style="color: var(--accent-red);" class="slider-dmg-val">1</strong> daño`;
        
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(sliderLabel);

        const costValEl = gbtn.querySelector('.cost-val');
        const dmgPreview = gbtn.querySelector('.dmg-preview');
        const sliderDmgVal = sliderLabel.querySelector('.slider-dmg-val');
        
        slider.oninput = () => {
           const val = slider.value;
           costValEl.innerText = val;
           sliderDmgVal.innerText = val;
           dmgPreview.innerText = `-${val}`;
           dmgPreview.style.opacity = '1';
           
           clearTimeout(gbtn._previewTimeout);
           gbtn._previewTimeout = setTimeout(() => {
              dmgPreview.style.opacity = '0';
           }, 800);
        };

        gbtn.onclick = () => {
          if (isDisabled) return;
          const dmgAmount = parseInt(slider.value, 10);
          
          gbtn.classList.remove('goblin-wobble-active', 'goblin-mutation-active');
          void gbtn.offsetWidth;
          gbtn.classList.add('goblin-damaged-bounce-active');
          
          modal.style.pointerEvents = 'none';
          
          setTimeout(() => {
            gameState.useRoleAbility(playerIndex, gob.uid, dmgAmount, dmgAmount);
            updateUI();
            modal.style.pointerEvents = 'auto';
            if (p.energy > 0) showTargetSelectionModal(playerIndex);
            else modal.classList.add('hidden');
          }, 450);
        };
        
        cardWrapper.appendChild(gbtn);
        cardWrapper.appendChild(sliderContainer);
        gobGrid.appendChild(cardWrapper);
      });
      options.appendChild(gobGrid);
    }
  } else {
    // LÓGICA NORMAL (Sanador, Ladrón, Protector)
    // El visor de energía ya se añadió arriba

    // Botón para SI MISMO (Coste 1)
    const hasBrokenSelf = p.equipped.some(e => e.isBroken);
    const isSanadorFullSelf = (p.role.id === 'sanador' && p.hp >= p.maxHp);
    const isCuranderoFullSelf = (p.role.id === 'curandero' && !hasBrokenSelf);
    const isDisabledSelf = (p.energy < 1 || isSanadorFullSelf || isCuranderoFullSelf);

    let selfDesc = 'Uso personal';
    if (p.role.id === 'sanador') {
      selfDesc = isSanadorFullSelf ? 'VIDA AL MÁXIMO' : '❤️ Curar 1 PV a ti mismo';
    } else if (p.role.id === 'curandero') {
      selfDesc = isCuranderoFullSelf ? 'EQUIPO INTACTO' : '🛠️ Reparar todo tu equipo roto';
    } else if (p.role.id === 'protector') {
      selfDesc = '🛡️ Generar +1 Escudo de armadura';
    } else if (p.role.id === 'ladron') {
      selfDesc = `${COIN_SVG} Obtener 1 Moneda de oro`;
    }

    const btnSelf = document.createElement('button');
    btnSelf.className = 'target-btn self-btn';
    if (isDisabledSelf) btnSelf.classList.add('disabled');

    btnSelf.innerHTML = `
    <div class="target-name">✨ A TI MISMO</div>
    <div class="target-stats">❤️ ${p.hp}/${p.maxHp} ${COIN_SVG} ${p.mo}</div>
    <div class="target-desc">${selfDesc}</div>
    <div class="target-cost ${p.energy < 1 ? 'insufficient' : ''}">COSTE: 1🔷</div>
  `;
    btnSelf.onclick = () => {
      if (isDisabledSelf) return;
      gameState.useRoleAbility(playerIndex, playerIndex);
      updateUI();
      if (p.energy > 0) {
        showTargetSelectionModal(playerIndex);
      } else {
        modal.classList.add('hidden');
      }
    };
    options.appendChild(btnSelf);

    // Sección para OTROS (Coste 2)
    if (gameState.players.length > 1) {
      const divOthers = document.createElement('div');
      divOthers.className = 'others-section';
      divOthers.innerHTML = '<div class="section-divider"><span>AYUDAR A COMPAÑEROS</span></div>';

      const othersContainer = document.createElement('div');
      othersContainer.className = 'others-grid';

      gameState.players.forEach((otherP, otherIdx) => {
        if (otherIdx !== playerIndex) {
          const hasBrokenOther = otherP.equipped.some(e => e.isBroken);
          const isSanadorFullOther = (p.role.id === 'sanador' && otherP.hp >= otherP.maxHp);
          const isCuranderoFullOther = (p.role.id === 'curandero' && !hasBrokenOther);
          const isDisabledOther = (p.energy < 2 || isSanadorFullOther || isCuranderoFullOther);

          let otherDesc = 'Ayudar a compañero';
          if (p.role.id === 'sanador') {
            otherDesc = isSanadorFullOther ? 'VIDA AL MÁXIMO' : `❤️ Curar 1 PV a ${otherP.name}`;
          } else if (p.role.id === 'curandero') {
            otherDesc = isCuranderoFullOther ? 'EQUIPO INTACTO' : `🛠️ Reparar equipo roto de ${otherP.name}`;
          } else if (p.role.id === 'protector') {
            otherDesc = `🛡️ Otorgar +1 Escudo a ${otherP.name}`;
          } else if (p.role.id === 'ladron') {
            otherDesc = `${COIN_SVG} Dar 1 Moneda a ${otherP.name}`;
          }

          const obtn = document.createElement('button');
          obtn.className = 'target-btn other-btn';
          if (isDisabledOther) {
            obtn.classList.add('disabled');
          }

          obtn.innerHTML = `
          <div class="target-name">🤝 ${otherP.name}</div>
          <div class="target-stats">❤️ ${otherP.hp}/${otherP.maxHp} ${COIN_SVG} ${otherP.mo}</div>
          <div class="target-desc">${otherDesc}</div>
          <div class="target-cost ${p.energy < 2 ? 'insufficient' : ''}">COSTE: 2🔷</div>
        `;

          obtn.onclick = () => {
            if (isDisabledOther) return;
            gameState.useRoleAbility(playerIndex, otherIdx);
            updateUI();
            if (p.energy > 0) {
              showTargetSelectionModal(playerIndex);
            } else {
              modal.classList.add('hidden');
            }
          };
          othersContainer.appendChild(obtn);
        }
      });
      divOthers.appendChild(othersContainer);
      options.appendChild(divOthers);
    }

  }

  // Botón de cierre (Para todos los roles)
  const btnClose = document.createElement('button');
  btnClose.className = 'btn secondary';
  btnClose.style.marginTop = '20px';
  btnClose.style.width = '100%';
  btnClose.innerText = 'CERRAR';
  btnClose.onclick = () => modal.classList.add('hidden');
  options.appendChild(btnClose);

  modal.classList.remove('hidden');
};

function checkLevelUpChoice() {
  const container = document.getElementById('event-choices-container');
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');

  if (!container || !overlay) return;

  const playersWithChoice = gameState.players.filter(p => p.pendingLevelUpChoice);

  if (playersWithChoice.length > 0) {
    // Retrasar si hay animaciones activas (muerte de Goblins o rotura de equipo)
    const hasDyingGoblins = gameState.battlefield.goblins.some(g => g.isDying);
    const hasJustBrokenEquip = gameState.players.some(p => p.equipped.some(eq => eq.isBroken && !eq.brokenAnimationPlayed));
    
    if (hasDyingGoblins || hasJustBrokenEquip) {
      if (!window._levelUpDelayActive) {
        window._levelUpDelayActive = true;
        setTimeout(() => {
          window._levelUpDelayActive = false;
          checkLevelUpChoice();
        }, 1000);
      }
      return;
    }

    title.innerText = "¡SUBIDA DE NIVEL!";
    desc.innerText = "¡Habéis ganado experiencia suficiente! Cada jugador debe elegir un nuevo dado:";
    container.innerHTML = '';

    playersWithChoice.forEach(p => {
      const pIndex = gameState.players.indexOf(p);
      const card = document.createElement('div');
      card.className = 'level-up-card';

      // Header con nombre y colección mini
      const header = document.createElement('div');
      header.className = 'player-info-header';
      header.innerHTML = `
        <div style="text-align: left;">
          <h3 class="player-name-hover" data-player-index="${pIndex}" style="margin: 0; font-size: 1.4rem; cursor: pointer;">${p.name}</h3>
          <span style="color: var(--text-dim); font-size: 0.9rem;">Ha subido al nivel ${p.level}${p.pendingLevelUpChoices > 1 ? ` (Elección 1 de ${p.pendingLevelUpChoices})` : ''}</span>
        </div>
        <div class="collection-mini">
          <span style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-right: 5px;">Colección:</span>
          ${p.dicePool.map(d => `<div class="die ${d.type} ${d.faces === 4 ? 'd4' : ''}" style="width: 20px; height: 20px; font-size: 0.7rem;">${d.faces}</div>`).join('')}
        </div>
      `;
      card.appendChild(header);

      // Grid de opciones
      const grid = document.createElement('div');
      grid.className = 'choices-grid';

      // Opción Rojo d6
      const redOption = document.createElement('div');
      redOption.className = 'die-option';
      redOption.innerHTML = `
        <div class="die red">6</div>
        <p>Dado Rojo</p>
        <span class="die-desc">Ideal para ataques físicos. Mayor probabilidad de daño alto.</span>
      `;
      redOption.onclick = () => handleLevelUpChoice(pIndex, 'red');

      // Opción Negro d4
      const blackOption = document.createElement('div');
      blackOption.className = 'die-option';
      blackOption.innerHTML = `
        <div class="die black d4">4</div>
        <p>Dado Negro</p>
        <span class="die-desc">Desbloquea habilidades y relanzamientos. <strong style="color: var(--gold);"><br><br>+1 mo de regalo.</strong></span>
      `;
      blackOption.onclick = () => handleLevelUpChoice(pIndex, 'black');

      grid.appendChild(redOption);
      grid.appendChild(blackOption);
      card.appendChild(grid);

      container.appendChild(card);
    });

    overlay.classList.remove('hidden');
  } else {
    // SOLO ocultamos si lo que hay en el contenedor es una carta de subida de nivel
    // Esto evita cerrar otros modales como el de pociones o advertencias.
    if (container.querySelector('.level-up-card')) {
      overlay.classList.add('hidden');
    }
  }
}

window.showPlayerDiceTooltip = function(e, playerIndex) {
  let tooltip = document.getElementById('player-dice-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'player-dice-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: linear-gradient(135deg, #1a1e29 0%, #0a0c10 100%);
      border: 2px solid var(--gold);
      border-radius: 8px;
      padding: 6px 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.8), 0 0 15px rgba(212,175,55,0.25);
      z-index: 99999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease-out;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 6px;
      flex-direction: row;
    `;
    document.body.appendChild(tooltip);
  }

  const p = gameState.players[playerIndex];
  if (!p) return;

  let diceHTML = p.dicePool.map(d => {
    const isD4 = d.faces === 4;
    const paddingStyle = isD4 ? 'padding-top: 5px !important;' : 'padding: 0 !important;';

    return `
      <div class="die ${d.type} ${isD4 ? 'd4' : ''}" style="width: 24px !important; height: 24px !important; font-size: 0.8rem !important; ${paddingStyle} flex-shrink: 0 !important; position: relative !important; margin: 0 !important; cursor: default !important; display: flex !important; align-items: center !important; justify-content: center !important;">
        ${d.faces}
      </div>
    `;
  }).join('');

  tooltip.innerHTML = diceHTML;
  tooltip.style.display = 'flex';

  const rect = e.target.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth || (p.dicePool.length * 30 + 20);
  const tooltipHeight = tooltip.offsetHeight || 38;
  const x = window.scrollX + rect.left + (rect.width / 2) - (tooltipWidth / 2);
  const y = window.scrollY + rect.top - tooltipHeight - 8;

  tooltip.style.left = `${Math.max(10, Math.min(window.innerWidth - tooltipWidth - 10, x))}px`;
  tooltip.style.top = `${Math.max(10, y)}px`;
  tooltip.style.opacity = '1';
};

window.hidePlayerDiceTooltip = function () {
  const tooltip = document.getElementById('player-dice-tooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
    tooltip.style.display = 'none';
  }
};

window.handleLevelUpChoice = function (playerIndex, dieType) {
  const faces = dieType === 'red' ? 6 : 4;
  if (gameState.addDieToPool(playerIndex, dieType, faces)) {
    updateUI();
  }
};

// Global Hover Preview para las cartas y Tooltip de Dados
document.addEventListener('mouseover', (e) => {
  const card = e.target.closest('.equipment-card, .deck, .goblin-card, .equip-slot, .player-role, .mini-equip-icon');
  const preview = document.getElementById('card-preview-overlay');

  if (card) {
    let bg = card.style.backgroundImage;
    if (bg && bg !== 'none') {
      // Si es un rol mini, mostrar la versión normal en el preview
      const fullResBg = bg.replace('mini_rol_', 'rol_');
      preview.style.backgroundImage = fullResBg;
      preview.style.display = 'block';

      // Sincronizar rotación si la carta está rota
      if (card.classList.contains('broken') || card.style.transform.includes('180deg')) {
        preview.style.transform = 'rotate(180deg)';
      } else {
        preview.style.transform = 'none';
      }

      const combatOverlay = document.getElementById('combat-overlay');
      if (combatOverlay && !combatOverlay.classList.contains('hidden')) {
        preview.classList.add('in-combat');
      } else {
        preview.classList.remove('in-combat');
      }
    }
  } else {
    preview.style.display = 'none';
  }

  // Tooltip de Dados del Jugador al pasar por su nombre
  const playerName = e.target.closest('.player-name-hover');
  if (playerName) {
    const pIdx = parseInt(playerName.dataset.playerIndex);
    window.showPlayerDiceTooltip(e, pIdx);
  } else {
    window.hidePlayerDiceTooltip();
  }
});

let activeSelectedOrbUids = [];


