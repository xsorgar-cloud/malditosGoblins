const fs = require('fs');
let code = fs.readFileSync('js/GameState.js', 'utf8');

// 1. Replace calculateAndAddHordaPR
const calculateRegex = /calculateAndAddHordaPR\(\) \{[\s\S]*?\n  \}/;
const setupHordaWaveFn = `setupHordaWave() {
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
    
    this.addLog(\`🤖 <strong>La Avanzadilla:</strong> Llegan \${spawnedCount} Goblins de Nivel \${waveLv}.\`);
    this.addLog(\`💀 <strong>Bolsa de Rencor:</strong> El Señor de la Horda empieza la oleada con \${initialPR} PR (Total: \${this.hordaPR}).\`);
  }

  generateHordaPRPerRound() {
    if (this.activeSenda !== 'horda') return;
    let P = this.players.length;
    let W = Math.min(this.battlefield.waveLevel, 5);
    let prToGain = Math.max(1, W + P - 1);
    this.hordaPR += prToGain;
    this.addLog(\`🩸 <strong>Rencor Creciente:</strong> Nueva ronda. El Señor de la Horda gana \${prToGain} PR (Total: \${this.hordaPR}).\`);
    
    if (typeof window !== 'undefined' && window.renderBattlefield) {
      setTimeout(() => window.renderBattlefield(), 50);
    }
  }`;
code = code.replace(calculateRegex, setupHordaWaveFn);

// 2. Update calls to calculateAndAddHordaPR
code = code.replace(/this\.calculateAndAddHordaPR\(\);/g, "this.setupHordaWave();");

// 3. Update setupPlayers to remove manual Horda goblin and call generateHordaPRPerRound
const setupRegex = /if \(this\.activeSenda === 'horda'\) \{[\s\S]*?this\.addLog\([^)]+\);[\s\S]*?\} else \{/;
const newSetup = `if (this.activeSenda === 'horda') {
      this.setupHordaWave();
      this.generateHordaPRPerRound();
    } else {`;
code = code.replace(setupRegex, newSetup);

// 4. Update nextTurn to track roundFinished and call generateHordaPRPerRound
// Let's replace the do-while loop in nextTurn
const nextTurnRegex = /let iterations = 0;[\s\S]*?\} while \(this\.players\[this\.currentPlayerIndex\] && this\.players\[this\.currentPlayerIndex\]\.hp <= 0 && !this\.isGameOver\);/;
const newNextTurn = `let iterations = 0;
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
      if (iterations > this.players.length * 2) break;
    } while (this.players[this.currentPlayerIndex] && this.players[this.currentPlayerIndex].hp <= 0 && !this.isGameOver);

    if (roundFinished && this.activeSenda === 'horda' && !this.isGameOver) {
      this.generateHordaPRPerRound();
    }`;
code = code.replace(nextTurnRegex, newNextTurn);

fs.writeFileSync('js/GameState.js', code);
