const fs = require('fs'); 
let lines = fs.readFileSync('js/app.js', 'utf8').split('\n'); 

// 1. Insert logic
lines.splice(1846, 0, `  const btnHordeMode = document.createElement('button');
  btnHordeMode.className = 'btn';
  btnHordeMode.style.cssText = 'padding: 0; border-radius: 50%; width: 50px; height: 50px; background: transparent; border: 2px solid #555; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden; margin: 0 15px; display: flex; align-items: center; justify-content: center;';
  btnHordeMode.title = "Modalidad: Señor de la Horda (Desactivado)";
  btnHordeMode.innerHTML = '<img src="assets/Monstruos/Jefes/SenorHorda.jpg" style="width:100%; height:100%; object-fit:cover; filter: grayscale(100%); transition: all 0.3s ease;">';
  
  btnHordeMode.addEventListener('click', () => {
    window.pendingHordeMode = !window.pendingHordeMode;
    if (window.pendingHordeMode) {
      btnHordeMode.style.border = '2px solid #ff3333';
      btnHordeMode.style.boxShadow = '0 0 15px rgba(255,51,51,0.6)';
      btnHordeMode.querySelector('img').style.filter = 'grayscale(0%)';
      btnHordeMode.title = "Modalidad: Señor de la Horda (Activado)";
    } else {
      btnHordeMode.style.border = '2px solid #555';
      btnHordeMode.style.boxShadow = 'none';
      btnHordeMode.querySelector('img').style.filter = 'grayscale(100%)';
      btnHordeMode.title = "Modalidad: Señor de la Horda (Desactivado)";
    }
  });`);

// 2. Remove the old appendChilds and insert the new order
let idx = lines.findIndex(l => l.includes("btnContainer.appendChild(btnConfirm);"));
if (idx !== -1) {
  lines.splice(idx, 2, 
    "  btnContainer.appendChild(btnCancel);",
    "  btnContainer.appendChild(btnHordeMode);",
    "  btnContainer.appendChild(btnConfirm);"
  );
}

// 3. Fix the parameter passed to setupPlayers
let setupIdx = lines.findIndex(l => l.includes("gameState.setupPlayers(numPlayers"));
if (setupIdx !== -1) {
  lines[setupIdx] = lines[setupIdx].replace("difficulty: initDifficulty }", "difficulty: initDifficulty, isHordeMode: window.pendingHordeMode }");
}

fs.writeFileSync('js/app.js', lines.join('\n'));
