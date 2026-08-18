const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');

const replacement = `  const hitoActionsDiv = document.getElementById('hito-actions');
  const btnDeployHito = document.getElementById('btn-deploy-hito');
  const btnInfoHitos = document.getElementById('btn-info-hitos');
  const btnHordaPr = document.getElementById('btn-horda-pr');

  if (gameState.activeSenda === 'horda') {
    if (hitoActionsDiv) hitoActionsDiv.style.display = 'flex';
    if (btnDeployHito) btnDeployHito.style.display = 'none';
    if (btnInfoHitos) btnInfoHitos.style.display = 'none';
    
    if (btnHordaPr) {
      btnHordaPr.classList.remove('hidden');
      document.getElementById('horda-pr').innerText = gameState.hordaPR || 0;
      document.getElementById('horda-pr-mobile').innerText = gameState.hordaPR || 0;
    }
  } else {
    if (btnHordaPr) btnHordaPr.classList.add('hidden');
    if (btnInfoHitos) btnInfoHitos.style.display = 'inline-block';
    
    if (gameState.currentHito <= 5) {
      const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;`;

content = content.replace(/  const hordaInfoDiv = document\.getElementById\('horda-info'\);\s+const hitoActionsDiv = document\.getElementById\('hito-actions'\);\s+if \(gameState\.activeSenda === 'horda'\) \{[\s\S]*?if \(gameState\.currentHito <= 5\) \{[\s\S]*?const sendaHitos = DB\.hitos\[gameState\.activeSenda\] \|\| DB\.hitos\.iniciacion;/, replacement);

fs.writeFileSync('js/app.js', content);
