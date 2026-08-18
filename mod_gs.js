const fs = require('fs');
let lines = fs.readFileSync('js/GameState.js', 'utf8').split('\n');

// Update setupPlayers signature
let setupIdx = lines.findIndex(l => l.includes("setupPlayers(num, roles, config, isBotList = []) {"));
if (setupIdx !== -1) {
  lines.splice(setupIdx + 1, 0, "    this.isHordeMode = config.isHordeMode || false;");
}

for (let i = 0; i < lines.length; i++) {
  // Replace activeSenda === 'horda'
  if (lines[i].includes("this.activeSenda === 'horda'") || lines[i].includes("this.activeSenda === \"horda\"")) {
    lines[i] = lines[i].replace(/this\.activeSenda === ['"]horda['"]/g, "this.isHordeMode");
  }
  // Replace activeSenda !== 'horda'
  if (lines[i].includes("this.activeSenda !== 'horda'") || lines[i].includes("this.activeSenda !== \"horda\"")) {
    lines[i] = lines[i].replace(/this\.activeSenda !== ['"]horda['"]/g, "!this.isHordeMode");
  }
}

fs.writeFileSync('js/GameState.js', lines.join('\n'));
