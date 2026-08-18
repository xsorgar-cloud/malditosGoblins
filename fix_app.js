const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');

// Remove the horda element from sendasData
const targetToRemove = `{ value: 'horda', name: 'Modalidad: Señor de la Horda', stars: '', bossImg: 'assets/Monstruos/Jefes/SenorHorda.jpg', rulesImg: 'assets/Monstruos/Jefes/SenorHorda.jpg' }`;
if (content.includes(targetToRemove)) {
  content = content.replace(",\r\n    " + targetToRemove, "");
  content = content.replace(",\n    " + targetToRemove, "");
}

// Replace activeSenda === 'horda' in app.js
content = content.replace(/gameState\.activeSenda === 'horda'/g, "gameState.isHordeMode");

fs.writeFileSync('js/app.js', content);
