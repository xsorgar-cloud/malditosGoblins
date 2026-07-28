const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

code = code.replace(/function updateUI\(\) \{\r?\n/, 'function updateUI() {\n  if (window._obsoleteDelayActive) return;\n');

const regex = /const hasDying = gameState\.battlefield\.goblins\.some\(g => g\.isDying\);\s+if \(hasDying && !window\._dyingCleanupActive\) \{\s+window\._dyingCleanupActive = true;\s+setTimeout\(\(\) => \{\s+gameState\.battlefield\.goblins = gameState\.battlefield\.goblins\.filter\(g => !g\.isDying\);\s+window\._dyingCleanupActive = false;\s+renderBattlefield\(\);\s+\}, 850\);\s+\}/;

const replacement = `const hasDying = gameState.battlefield.goblins.some(g => g.isDying);
    if (hasDying && !window._dyingCleanupActive) {
      window._dyingCleanupActive = true;
      setTimeout(() => {
        gameState.battlefield.goblins = gameState.battlefield.goblins.filter(g => !g.isDying);
        window._dyingCleanupActive = false;
        
        if (window._obsoleteDelayActive) {
          document.querySelectorAll('.goblin-card.dying, .goblin-card.dying-reward').forEach(el => el.remove());
        } else {
          renderBattlefield();
        }
      }, 850);
    }`;

code = code.replace(regex, replacement);

fs.writeFileSync('js/app.js', code, 'utf8');
console.log('Fixed app.js');
