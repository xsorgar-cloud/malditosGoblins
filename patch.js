const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');

// Normalize newlines to \n for easier regex replacing
content = content.replace(/\r\n/g, '\n');

// 1. Add needsObsoleteOverlay
content = content.replace(/let imageUrl = goblin\.image;\s*/, "let imageUrl = goblin.image;\n    let needsObsoleteOverlay = false;\n    ");

// 2. Replace the first block
const regex1 = /if \(!goblin\.obsoleteAnimationPlayed\) \{[\s\S]*?\}, 2500\);\s*\}\s*\}/;
const replace1 = `if (!goblin.obsoleteAnimationPlayed && !goblin.isDying) {
          goblin.obsoleteAnimationPlayed = true;
          needsObsoleteOverlay = true;
        }
      }`;
content = content.replace(regex1, replace1);

// 3. Replace the second block
const regex2 = /gobEl\.appendChild\(payBtn\);\s*\}\s*\/\/\s*Comprobar si es un goblin nuevo para aplicarle la animaci.n correspondiente/;
const replace2 = `gobEl.appendChild(payBtn);
      }
    }

    if (needsObsoleteOverlay) {
      gobEl.classList.add('goblin-obsolete-anim');
      
      const overlay = document.createElement('div');
      overlay.className = 'broken-rewards-overlay';
      
      const goldIcon = document.createElement('div');
      goldIcon.className = 'icon-crack';
      const coinSvgLarge = COIN_SVG.replace('width="18" height="18"', 'width="34" height="34"').replace('margin-right: 3px;', 'margin-right: 0px;');
      goldIcon.innerHTML = \`<div class="half-left" style="display:flex;align-items:center;justify-content:center;">\${coinSvgLarge}</div><div class="half-right" style="display:flex;align-items:center;justify-content:center;">\${coinSvgLarge}</div>\`;
      
      const pexIcon = document.createElement('div');
      pexIcon.className = 'icon-crack';
      pexIcon.innerHTML = \`<div class="half-left">⭐</div><div class="half-right">⭐</div>\`;
      
      overlay.appendChild(goldIcon);
      overlay.appendChild(pexIcon);
      gobEl.appendChild(overlay);
      
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
        gobEl.classList.remove('goblin-obsolete-anim');
      }, 2500);
    }

    // Comprobar si es un goblin nuevo para aplicarle la animación correspondiente`;
content = content.replace(regex2, replace2);

// Re-normalize to original if needed, or just write \n (git handles it)
fs.writeFileSync('js/app.js', content, 'utf8');
console.log("Done");
