const fs = require('fs');
let code = fs.readFileSync('js/HordeLordAI.js', 'utf8');

// Replace Piel de Cuero cost (around line 134)
code = code.replace(/if \(budget >= 1\) \{\n\s*\/\/ Armadura \(Piel\)/, 'if (budget >= window.GAME_CONFIG.UPGRADE_COSTS.piel) {\n      // Armadura (Piel)');
code = code.replace(/budget \-= 1; \/\/ Coste Piel/, 'budget -= window.GAME_CONFIG.UPGRADE_COSTS.piel; // Coste Piel');

// Replace Frenesi cost (around line 148)
code = code.replace(/if \(budget >= 1\) \{\n\s*\/\/ Frenesi/, 'if (budget >= window.GAME_CONFIG.UPGRADE_COSTS.frenesi) {\n      // Frenesi');
code = code.replace(/budget \-= 1; \/\/ Coste Frenesi/, 'budget -= window.GAME_CONFIG.UPGRADE_COSTS.frenesi; // Coste Frenesi');

// Replace Armadura Reactiva cost (around line 162)
code = code.replace(/if \(budget >= 2\) \{\n\s*\/\/ Armadura Reactiva/, 'if (budget >= window.GAME_CONFIG.UPGRADE_COSTS.armadura) {\n      // Armadura Reactiva');
code = code.replace(/budget \-= 2; \/\/ Coste Reactiva/, 'budget -= window.GAME_CONFIG.UPGRADE_COSTS.armadura; // Coste Reactiva');

// Replace Alteraciones cost (line 176)
// The original alteracion code randomly picks tembleque (cost 2) or others (cost 1).
const altRegex = /let altCost = 1;\n\s*if \(budget >= 2 && rnd < 0\.33\) \{\n\s*altName = 'tembleque';\n\s*altCost = 2;\n\s*\} else if \(rnd < 0\.66\) \{\n\s*altName = 'calambre';\n\s*\} else \{\n\s*altName = 'escozor';\n\s*\}/;
const newAltCode = `let altCost = window.GAME_CONFIG.UPGRADE_COSTS.escozor;
        if (budget >= window.GAME_CONFIG.UPGRADE_COSTS.tembleque && rnd < 0.33) {
          altName = 'tembleque';
          altCost = window.GAME_CONFIG.UPGRADE_COSTS.tembleque;
        } else if (rnd < 0.66) {
          altName = 'calambre';
          altCost = window.GAME_CONFIG.UPGRADE_COSTS.calambre;
        } else {
          altName = 'escozor';
          altCost = window.GAME_CONFIG.UPGRADE_COSTS.escozor;
        }`;
code = code.replace(altRegex, newAltCode);

code = code.replace(/if \(budget >= 1 && !targetGob\.imbuirAlteracion\)/, 'if (budget >= Math.min(window.GAME_CONFIG.UPGRADE_COSTS.escozor, window.GAME_CONFIG.UPGRADE_COSTS.calambre) && !targetGob.imbuirAlteracion)');

fs.writeFileSync('js/HordeLordAI.js', code);
