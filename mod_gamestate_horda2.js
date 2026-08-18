const fs = require('fs');
let code = fs.readFileSync('js/GameState.js', 'utf8');

const oldCalculate = `  calculateAndAddHordaPR() {
    if (this.activeSenda !== 'horda') return;
    let sumNiveles = 0;
    let maxLevel = Math.min(this.battlefield.waveLevel, 5);
    for (let i = 1; i <= maxLevel; i++) {
      sumNiveles += i;
    }
    const prIngreso = (this.players.length + 1) + sumNiveles;
    this.hordaPR += prIngreso;
    this.addLog(\`💀 <strong>El Señor de la Horda</strong> obtiene \${prIngreso} PR (Total: \${this.hordaPR}).\`);
  }`;

const newFns = `  setupHordaWave() {
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
code = code.replace(oldCalculate, newFns);

const oldSetupBlock = `    if (this.activeSenda === 'horda') {
      this.calculateAndAddHordaPR();
      this.battlefield.goblins.push({
        ...DB.goblins[1],
        uid: Date.now() + '-horda',
        currentHp: DB.goblins[1].hp
      });
      this.addLog(\`🔥 La Horda envía su primera avanzadilla (1 x G1).\`);
    } else {`;
const newSetupBlock = `    if (this.activeSenda === 'horda') {
      this.setupHordaWave();
      this.generateHordaPRPerRound();
    } else {`;
code = code.replace(oldSetupBlock, newSetupBlock);

code = code.replace("this.calculateAndAddHordaPR();", "this.setupHordaWave();");

const oldNextTurnEnd = `      let iterations = 0;
      do {
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.players.length) {
          this.currentPlayerIndex = 0;
          this.battlefield.actionCount++;

          if (this.battlefield.actionCount >= 3) {
            this.resolveWavePhase();
          }
        }
        iterations++;
        if (iterations > this.players.length * 2) break; // Fallback
      } while (this.players[this.currentPlayerIndex] && this.players[this.currentPlayerIndex].hp <= 0 && !this.isGameOver);

      if (!this.isGameOver && !this.isRetaliationPhase && !this.isResolvingWaveSequentially) {
        this.startPlayerTurn(this.getCurrentPlayer());
      }`;
const newNextTurnEnd = `      let iterations = 0;
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
        this.startPlayerTurn(this.getCurrentPlayer());
      }`;
code = code.replace(oldNextTurnEnd, newNextTurnEnd);

fs.writeFileSync('js/GameState.js', code);
