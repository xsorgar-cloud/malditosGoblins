const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// Function to generate the HTML dynamically from constants
const newMenu1 = `<li><strong style="color:#ff4d4d;">X PR</strong>: Invocar Goblin Nivel 1 a 5 (Costo: \${window.GAME_CONFIG.SUMMON_COSTS[1]}, \${window.GAME_CONFIG.SUMMON_COSTS[2]}, \${window.GAME_CONFIG.SUMMON_COSTS[3]}, \${window.GAME_CONFIG.SUMMON_COSTS[4]}, \${window.GAME_CONFIG.SUMMON_COSTS[5]} PR)</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.BOSS_COSTS.cazador} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.cazador}</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.BOSS_COSTS.recaudador} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.recaudador}</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.BOSS_COSTS.rey_brujo} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.rey_brujo}</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.BOSS_COSTS.guerrero} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.guerrero}</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.BOSS_COSTS.la_madre} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.la_madre}</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.UPGRADE_COSTS.piel} PR</strong>: Piel de Cuero (+1 Absorción de daño, acumulable)</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.UPGRADE_COSTS.frenesi} PR</strong>: Frenesí (+1 Daño en Represalia, acumulable)</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.UPGRADE_COSTS.escozor} PR</strong>: Imbuir Escozor (Escozor al impactar)</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.UPGRADE_COSTS.calambre} PR</strong>: Imbuir Calambre (Calambre al impactar)</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.UPGRADE_COSTS.tembleque} PR</strong>: Imbuir Tembleque (Tembleque al impactar)</li>
          <li><strong style="color:#ff4d4d;">\${window.GAME_CONFIG.UPGRADE_COSTS.armadura} PR</strong>: Armadura Reactiva (1 Daño al atacarle sin escudo, acumulable)</li>`;

// Around line 958
const regex1 = /<li><strong style="color:#ff4d4d;">X PR<\/strong>: Invocar Goblin Nivel 1 a 5[\s\S]*?Armadura Reactiva \(1 Daño al atacarle sin escudo, acumulable\)<\/li>/;
code = code.replace(regex1, newMenu1);

// Now for the second one around line 6820
const newMenu2 = `<li><strong style="\${window.getCostColor(window.GAME_CONFIG.SUMMON_COSTS[1])}">\${window.GAME_CONFIG.SUMMON_COSTS[1]} PR</strong>: Invocar Goblin de Nivel 1</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.SUMMON_COSTS[2])}">\${window.GAME_CONFIG.SUMMON_COSTS[2]} PR</strong>: Invocar Goblin de Nivel 2</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.SUMMON_COSTS[3])}">\${window.GAME_CONFIG.SUMMON_COSTS[3]} PR</strong>: Invocar Goblin de Nivel 3</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.SUMMON_COSTS[4])}">\${window.GAME_CONFIG.SUMMON_COSTS[4]} PR</strong>: Invocar Goblin de Nivel 4</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.SUMMON_COSTS[5])}">\${window.GAME_CONFIG.SUMMON_COSTS[5]} PR</strong>: Invocar Goblin de Nivel 5</li>
          
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.BOSS_COSTS.cazador)}">\${window.GAME_CONFIG.BOSS_COSTS.cazador} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.cazador}</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.BOSS_COSTS.recaudador)}">\${window.GAME_CONFIG.BOSS_COSTS.recaudador} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.recaudador}</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.BOSS_COSTS.rey_brujo)}">\${window.GAME_CONFIG.BOSS_COSTS.rey_brujo} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.rey_brujo}</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.BOSS_COSTS.guerrero)}">\${window.GAME_CONFIG.BOSS_COSTS.guerrero} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.guerrero}</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.BOSS_COSTS.la_madre)}">\${window.GAME_CONFIG.BOSS_COSTS.la_madre} PR</strong>: Invocar Jefe: \${window.GAME_CONFIG.BOSS_NAMES.la_madre}</li>
          
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.UPGRADE_COSTS.piel)}">\${window.GAME_CONFIG.UPGRADE_COSTS.piel} PR</strong>: Piel de Cuero (+1 Absorción de daño, acumulable)</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.UPGRADE_COSTS.frenesi)}">\${window.GAME_CONFIG.UPGRADE_COSTS.frenesi} PR</strong>: Frenesí (+1 Daño en Represalia, acumulable)</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.UPGRADE_COSTS.escozor)}">\${window.GAME_CONFIG.UPGRADE_COSTS.escozor} PR</strong>: Imbuir Escozor (Escozor al impactar)</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.UPGRADE_COSTS.calambre)}">\${window.GAME_CONFIG.UPGRADE_COSTS.calambre} PR</strong>: Imbuir Calambre (Calambre al impactar)</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.UPGRADE_COSTS.tembleque)}">\${window.GAME_CONFIG.UPGRADE_COSTS.tembleque} PR</strong>: Imbuir Tembleque (Tembleque al impactar)</li>
          <li><strong style="\${window.getCostColor(window.GAME_CONFIG.UPGRADE_COSTS.armadura)}">\${window.GAME_CONFIG.UPGRADE_COSTS.armadura} PR</strong>: Armadura Reactiva (1 Daño al atacarle sin escudo, acumulable)</li>`;

// For the second replace, we need a custom function because it has color functions
const regex2 = /<li><strong style="\$\{getCostColor\(1\)\};">1 PR<\/strong>: Invocar Goblin de Nivel 1<\/li>[\s\S]*?Armadura Reactiva \(1 Daño al atacarle sin escudo, acumulable\)<\/li>/;
code = code.replace(regex2, newMenu2);

fs.writeFileSync('js/app.js', code);
