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

    // 1. INVOCAR GOBLINS Y JEFES
    let summonWeight = boardGoblins.length === 0 ? 100 : (boardGoblins.length < 3 ? 40 : 5);

    const summonCosts = {
      1: 1,
      2: 2,
      3: 4,
      4: 6,
      5: 9
    };
    
    // Attempt to invoke a normal goblin
    let possibleLevels = Object.keys(summonCosts).map(Number).filter(lvl => budget >= summonCosts[lvl] && lvl <= gameState.battlefield.waveLevel + 1);
    if (possibleLevels.length > 0) {
      // Prefer highest possible level, or sometimes spam level 1
      let targetLvl = Math.max(...possibleLevels);
      if (boardGoblins.some(g => g.level === 1) && possibleLevels.includes(1) && boardGoblins.length > 0) {
         targetLvl = 1;
         summonWeight += 20;
      }
      
      possibleActions.push({
        id: 'summon_normal',
        name: `Invocar G${targetLvl}`,
        cost: summonCosts[targetLvl],
        weight: summonWeight,
        execute: () => {
          let newGob = {
            ...DB.goblins[targetLvl],
            uid: Date.now() + '-' + Math.random().toString(36).substring(2),
            currentHp: DB.goblins[targetLvl].hp,
            isHito: true,
            
          };
          gameState.battlefield.goblins.push(newGob);
          return `Invocación (G${targetLvl})`;
        }
      });
    }

    // Attempt to invoke a Boss
    const bossCosts = {
      'cazador': 10,
      'recaudador': 11,
      'rey_brujo': 12,
      'piromante': 13,
      'guerrero': 14,
      'la_madre': 16
    };
    
    // Find bosses that can be summoned (we need to match them to DB.hitos)
    let possibleBosses = [];
    for (const [sendaId, cost] of Object.entries(bossCosts)) {
      if (budget >= cost) {
         // Find the boss hito in DB.hitos[sendaId]
         const sendaHitos = DB.hitos[sendaId];
         if (sendaHitos) {
           const bossHito = sendaHitos.find(h => h.isBoss);
           if (bossHito && !boardGoblins.some(g => g.name === bossHito.name)) {
             possibleBosses.push({ sendaId, cost, bossHito });
           }
         }
      }
    }
    
    if (possibleBosses.length > 0) {
       // Pick the most expensive one we can afford
       possibleBosses.sort((a, b) => b.cost - a.cost);
       let chosenBoss = possibleBosses[0];
       possibleActions.push({
         id: 'summon_boss_' + chosenBoss.sendaId,
         name: `Invocar Jefe: ${chosenBoss.bossHito.name}`,
         cost: chosenBoss.cost,
         weight: 400, // Altísima prioridad, invoca Jefe siempre que pueda
         execute: () => {
           let bossGob = {
             uid: Date.now() + '-' + Math.random().toString(36).substring(2),
             name: chosenBoss.bossHito.name,
             level: chosenBoss.bossHito.level,
             hp: chosenBoss.bossHito.bossStats.hp,
             currentHp: chosenBoss.bossHito.bossStats.hp,
             damage: chosenBoss.bossHito.bossStats.damage,
             image: chosenBoss.bossHito.bossStats.image,
             isHito: true,
             
             isBoss: true
           };
           gameState.battlefield.goblins.push(bossGob);
           return `Invocación de Jefe (${bossGob.name})`;
         }
       });
    }

    // 2. MEJORAS A GOBLINS EXISTENTES
    if (boardGoblins.length > 0) {
      boardGoblins.sort((a, b) => b.level - a.level);
      
      // We can apply Piel de Cuero multiple times. Other buffs only once.
      let targetGob = boardGoblins[0];
      let gobName = targetGob.name || ('G' + targetGob.level);

      // Piel de Cuero (+1 acumulable) - Costo: 1 PR
      if (budget >= 1) {
        possibleActions.push({
          id: 'piel',
          name: `Piel de Cuero`,
          cost: 1,
          weight: player.hp > 3 ? 50 : 20,
          execute: () => {
            targetGob.pielDeCuero = (targetGob.pielDeCuero || 0) + 1;
            return `Piel de Cuero a ${gobName} (Absorbe ${targetGob.pielDeCuero} de daño)`;
          }
        });
      }

      // Frenesí (+1 Daño en Represalia) - Costo: 1 PR (antes 2)
      if (budget >= 1) {
        possibleActions.push({
          id: 'frenesi',
          name: `Frenesí`,
          cost: 1,
          weight: player.hp <= 3 ? 90 : 35,
          execute: () => {
            targetGob.frenesi = (targetGob.frenesi || 0) + 1;
            return `Frenesí a ${gobName} (+${targetGob.frenesi} Daño en Represalia)`;
          }
        });
      }

      // Armadura Reactiva (1 Daño al atacarle sin escudo) - Costo: 2 PR
      if (budget >= 2) {
        possibleActions.push({
          id: 'armadura',
          name: `Armadura Reactiva`,
          cost: 2,
          weight: 40,
          execute: () => {
            targetGob.armaduraReactiva = (targetGob.armaduraReactiva || 0) + 1;
            return `Armadura Reactiva a ${gobName} (Sufres ${targetGob.armaduraReactiva} daño si le atacas sin escudo)`;
          }
        });
      }

      // Imbuir Alteración (Aplica al impactar) - Maldición eliminada
      if (budget >= 1 && !targetGob.imbuirAlteracion) {
        let altType = '';
        let altCost = 1;
        
        let rnd = Math.random();
        if (budget >= 2 && rnd < 0.33) {
           altType = 'Tembleque';
           altCost = 2; // Imbuir Tembleque: 2 PR
        } else if (rnd < 0.66) {
           altType = 'Escozor';
           altCost = 1; // Imbuir Escozor: 1 PR
        } else {
           altType = 'Calambre';
           altCost = 1; // Imbuir Calambre: 1 PR
        }

        if (budget >= altCost) {
          possibleActions.push({
            id: `imbuir_${altType}`,
            name: `Imbuir ${altType}`,
            cost: altCost,
            weight: 30,
            execute: () => {
              targetGob.imbuirAlteracion = altType;
              let expl = '';
              if (altType === 'Escozor') expl = ' (Si te daña, sufres 2 daño al usar dado rojo)';
              else if (altType === 'Tembleque') expl = ' (Si te daña, tu próximo dado rojo valdrá 1)';
              else if (altType === 'Calambre') expl = ' (Si te daña, bloquea un dado negro)';
              return `Imbuye ${altType} a ${gobName}${expl}`;
            }
          });
        }
      }
    }

    // Accion de Ahorrar PR
    let saveWeight = 55; // Base altísima (gana a mejoras de 1 PR que tienen ~40-50)
    if (budget >= 3) saveWeight += 30; // 85 (casi seguro ahorra)
    if (budget >= 6) saveWeight += 50; // 135 (ahorra 100% para jefe)
    if (budget >= 9) saveWeight += 50; // 185 (ahorra sí o sí)
    
    // Reducimos las ganas de ahorrar si hay pocos goblins para defenderle (emergencia)
    if (boardGoblins.length === 0) saveWeight -= 50;
    else if (boardGoblins.length === 1) saveWeight -= 15;

    if (saveWeight > 0) {
      possibleActions.push({
        id: 'ahorrar',
        name: 'Ahorrar PR',
        cost: 0,
        weight: saveWeight,
        execute: () => {
          return 'AHORRAR';
        }
      });
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
    
    if (logMsg === 'AHORRAR') {
      break;
    }
    
    actionsTaken.push(`- ${logMsg} <font color="#ff4d4d">(-${chosenAction.cost} PR)</font>`);
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
                     actionsTaken.join('\n');
      window.alert(alertMsg);
    }
    
  } else if (availablePR > 0) {
    gameState.addLog(`💀 <strong>El Señor de la Horda</strong> reserva sus ${availablePR} PR para más adelante...`);
  }
    
  } catch (err) {
    console.error("AI ERROR CRASH:", err);
  }
};
