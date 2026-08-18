const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Use regex to remove horda-info
const oldHordaInfoRegex = /<div id="horda-info" class="hidden"[\s\S]*?<\/div>/;
html = html.replace(oldHordaInfoRegex, '');

// Find hito-actions and inject the new button
const hitoActionsRegex = /(<div id="hito-actions"[^>]*>[\s\S]*?<button id="btn-info-hitos"[^>]*>\?<\/button>\s*)/;
const newBtn = `<button id="btn-horda-pr" class="btn secondary hidden" style="font-size: 0.85rem; padding: 5px 10px; position: relative; border-color: #ff3333; color: #ff3333; pointer-events: none;">
                    <span class="btn-text" style="color: #ff3333; font-weight: bold;">PUNTOS DE RENCOR: <span id="horda-pr">0</span></span>
                    <img src="assets/icoSH.png" class="mobile-btn-icon" alt="Rencor" style="filter: drop-shadow(0 0 2px red);">
                    <span class="hito-mobile-number" id="horda-pr-mobile" style="color: white; text-shadow: 0 0 2px red;">0</span>
                </button>
                `;
html = html.replace(hitoActionsRegex, `$1${newBtn}`);

fs.writeFileSync('index.html', html);
