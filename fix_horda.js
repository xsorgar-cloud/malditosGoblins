const fs = require('fs');
let lines = fs.readFileSync('js/app.js', 'utf8').split('\n');

const targetToRemove = "{ value: 'horda', name: 'Modalidad: Señor de la Horda', stars: '', bossImg: 'assets/Monstruos/Jefes/SenorHorda.jpg', rulesImg: 'assets/Monstruos/Jefes/SenorHorda.jpg' }";
const idx = lines.findIndex(l => l.includes(targetToRemove));
if (idx !== -1) {
  lines.splice(idx, 1);
  lines[idx-1] = lines[idx-1].replace(/,(\r)?$/, "$1");
}

// Inject button
const cancelIdx = lines.findIndex(l => l.includes("btnCancel.addEventListener('click', () => {"));
if (cancelIdx !== -1) {
  lines.splice(cancelIdx + 3, 0, `  const btnHordeMode = document.createElement('button');
  btnHordeMode.className = 'btn';
  btnHordeMode.style.cssText = 'padding: 0; border-radius: 50%; width: 50px; height: 50px; background: transparent; border: 2px solid #555; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden; margin: 0 15px; display: flex; align-items: center; justify-content: center;';
  btnHordeMode.title = "Modalidad: Señor de la Horda";
  btnHordeMode.innerHTML = '<img src="assets/icoSH.png" style="width:100%; height:100%; object-fit:cover; transition: all 0.3s ease;">';
  
  btnHordeMode.addEventListener('click', () => {
    selectedSendaValue = 'horda';
    btnConfirm.click();
  });`);
}

// Add to btnContainer
const appendIdx = lines.findIndex(l => l.includes("btnContainer.appendChild(btnConfirm);"));
if (appendIdx !== -1) {
  lines.splice(appendIdx, 2, 
    "  btnContainer.appendChild(btnCancel);",
    "  btnContainer.appendChild(btnHordeMode);",
    "  btnContainer.appendChild(btnConfirm);"
  );
}

fs.writeFileSync('js/app.js', lines.join('\n'));
