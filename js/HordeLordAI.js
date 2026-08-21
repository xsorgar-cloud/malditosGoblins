// Lógica de Inteligencia Artificial para el Señor de la Horda

window.executeHordeLordTurn = function() { console.log('Starting executeHordeLordTurn');
  try {
  if (!gameState || gameState.activeSenda !== 'horda' || gameState.hordaPR <= 0) {
    if (gameState && gameState.activeSenda === 'horda') {
      gameState.addLog(`💀 <strong>El Señor de la Horda</strong> te observa sin suficientes Puntos de Rencor para actuar.`);
    }
    return;
  }

  let player = gameState.getCurrentPlayer();
  let availablePR = gameState.hordaPR;
  let actionsTaken = [];
  let budget = availablePR;

  // Limite de seguridad para evitar bucles infinitos
  let safety = 20; 
  console.log('AI starting while loop. budget:', budget);
  
  while (budget > 0 && safety > 0) {
    safety--;
    console.log('AI loop iteration, safety:', safety, 'budget:', budget);
    let possibleActions = [];
    let boardGoblins = gameState.battlefield.goblins.filter(g => !g.isDying && g.currentHp > 0);

    // 1. INVOCAR GOBLINS (Costo: Nivel * 2)
    let summonWeight = boardGoblins.length === 0 ? 100 : (boardGoblins.length < 3 ? 40 : 5);
    
    let maxSummonLvl = Math.min(Math.floor(budget / 2), Math.min(gameState.battlefield.waveLevel + 1, 5));
    if (maxSummonLvl >= 1) {
      let targetLvl = maxSummonLvl;
      if (boardGoblins.some(g => g.level === 1) && budget >= 2 && boardGoblins.length > 0) {
        targetLvl = 1;
        summonWeight += 20;
      }

      possibleActions.push({
        id: 'summon',
        name: `Invocar G${targetLvl}`,
        cost: targetLvl * 2,
        weight: summonWeight,
        execute: () => {
          let newGob = {
            ...DB.goblins[targetLvl],
            uid: Date.now() + '-' + Math.random().toString(36).substring(2),
            currentHp: DB.goblins[targetLvl].hp,
            isHito: true
          };
          gameState.battlefield.goblins.push(newGob);
          return `Invocación (G${targetLvl})`;
        }
      });
    }

    // 2. MEJORAS A GOBLINS EXISTENTES
    if (boardGoblins.length > 0) {
      boardGoblins.sort((a, b) => b.level - a.level);
      let buffable = boardGoblins.filter(g => !g.pielDeCuero || !g.frenesi || !g.armaduraReactiva || !g.imbuirAlteracion);
      if (buffable.length === 0) buffable = boardGoblins;
      let targetGob = buffable[0];
      let gobName = targetGob.name || ('G' + targetGob.level);

      // Piel de Cuero (+2 PV temp) - Costo: 1 PR
      if (budget >= 1 && !targetGob.pielDeCuero) {
        possibleActions.push({
          id: 'piel',
          name: `Piel de Cuero`,
          cost: 1,
          weight: player.hp > 3 ? 50 : 20,
          execute: () => {
            targetGob.pielDeCuero = 2;
            return `Piel de Cuero a ${gobName} (+2 PV)`;
          }
        });
      }

      // Frenesí (+1 Daño en Represalia) - Costo: 2 PR
      if (budget >= 2 && !targetGob.frenesi) {
        possibleActions.push({
          id: 'frenesi',
          name: `Frenesí`,
          cost: 2,
          weight: player.hp <= 3 ? 90 : 35,
          execute: () => {
            targetGob.frenesi = true;
            return `Frenesí a ${gobName} (+1 Daño)`;
          }
        });
      }

      // Armadura Reactiva (1 Daño al atacarle sin escudo) - Costo: 2 PR
      if (budget >= 2 && !targetGob.armaduraReactiva) {
        possibleActions.push({
          id: 'armadura',
          name: `Armadura Reactiva`,
          cost: 2,
          weight: 40,
          execute: () => {
            targetGob.armaduraReactiva = true;
            return `Armadura Reactiva a ${gobName}`;
          }
        });
      }

      // Imbuir Alteración (Aplica al impactar) - Costo: 1-2 PR
      if (budget >= 1 && !targetGob.imbuirAlteracion) {
        let altType = '';
        let altCost = 1;
        let altWeight = 30;

        if (budget >= 2 && Math.random() > 0.5) {
          altType = 'Maldición';
          altCost = 2;
          altWeight = 20;
        } else {
          let rnd = Math.random();
          if (rnd < 0.33) altType = 'Escozor';
          else if (rnd < 0.66) altType = 'Tembleque';
          else altType = 'Calambre';
        }

        possibleActions.push({
          id: `imbuir_${altType}`,
          name: `Imbuir ${altType}`,
          cost: altCost,
          weight: altWeight,
          execute: () => {
            targetGob.imbuirAlteracion = altType;
            return `Imbuye ${altType} a ${gobName}`;
          }
        });
      }
    }

    if (possibleActions.length === 0) break;

    possibleActions.forEach(a => {
      a.score = a.weight + Math.floor(Math.random() * 15); 
    });
    
    possibleActions.sort((a, b) => b.score - a.score);
    let chosenAction = possibleActions[0];

    if (chosenAction.score < 10 && boardGoblins.length > 0) {
      break; 
    }

    budget -= chosenAction.cost;
    let logMsg = chosenAction.execute();
    actionsTaken.push(`- ${logMsg} (-${chosenAction.cost} PR)`);
  }

  let totalSpent = availablePR - budget;
  gameState.hordaPR = budget;
  
  if (actionsTaken.length > 0) {
    let finalLog = `💀 <strong>El Señor de la Horda</strong> ha gastado ${totalSpent} PR:<br>` + actionsTaken.join('<br>');
    gameState.hordaActionLog = actionsTaken.join('\n');
    gameState.addLog(finalLog);
    
    if (typeof renderBattlefield === 'function') {
      renderBattlefield();
    }
    
    if (typeof updateUI === 'function') {
      updateUI();
    }
    if (typeof window !== 'undefined' && window.alert) {
      let alertMsg = `¡EL SEÑOR DE LA HORDA HA ACTUADO!\n\n` + 
                     `Ha gastado ${totalSpent} Puntos de Rencor:\n` +
                     actionsTaken.join('\n') + 
                     `\n\n(Revisa el registro para más detalles)`;
      window.alert(alertMsg);
    }
    
    gameState.addLog(`💀 <strong>El Señor de la Horda</strong> reserva sus ${availablePR} PR para más adelante...`);
  }
    
  } catch (err) {
    console.error("AI ERROR CRASH:", err);
  }
};
\n    if (typeof window !== 'undefined' && window.alert) {\n      let alertMsg = `¡EL SEÑOR DE LA HORDA HA ACTUADO!\n\nHa gastado ${totalSpent} Puntos de Rencor:\n` + actionsTaken.join('\n');\n      window.alert(alertMsg);\n    }\n  } else if (availablePR > 0) {\n    gameState.addLog(`💀 <strong>El Señor de la Horda</strong> reserva sus ${availablePR} PR para más adelante...`);\n  }\n} catch (err) {\n  console.error('AI ERROR CRASH:', err);\n}\n};