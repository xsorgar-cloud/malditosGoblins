import re

with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# First replace: the needsObsoleteOverlay logic and removing the inline overlay addition
original_block1 = """      if (goblin.level < pLeader.level) {
        gobEl.classList.add('goblin-no-reward');
        if (!goblin.isInvocacion && !imageUrl.includes('invocacion')) {
          imageUrl = imageUrl.replace(/([^\\/]+)$/, 'nomo_$1');
        }

        if (!goblin.obsoleteAnimationPlayed) {
          goblin.obsoleteAnimationPlayed = true;
          gobEl.classList.add('goblin-obsolete-anim');
          
          const overlay = document.createElement('div');
          overlay.className = 'broken-rewards-overlay';
          
          const goldIcon = document.createElement('div');
          goldIcon.className = 'icon-crack';
          goldIcon.innerHTML = `<div class="half-left" style="background-image: url('assets/mo.png')"></div><div class="half-right" style="background-image: url('assets/mo.png')"></div>`;
          
          const pexIcon = document.createElement('div');
          pexIcon.className = 'icon-crack';
          pexIcon.innerHTML = `<div class="half-left">⭐</div><div class="half-right">⭐</div>`;
          
          overlay.appendChild(goldIcon);
          overlay.appendChild(pexIcon);
          gobEl.appendChild(overlay);
          
          setTimeout(() => {
            if (overlay.parentNode) overlay.remove();
            gobEl.classList.remove('goblin-obsolete-anim');
          }, 2500);
        }
      }"""

new_block1 = """      if (goblin.level < pLeader.level) {
        gobEl.classList.add('goblin-no-reward');
        if (!goblin.isInvocacion && !imageUrl.includes('invocacion')) {
          imageUrl = imageUrl.replace(/([^\\/]+)$/, 'nomo_$1');
        }

        if (!goblin.obsoleteAnimationPlayed && !goblin.isDying) {
          goblin.obsoleteAnimationPlayed = true;
          needsObsoleteOverlay = true;
        }
      }"""

content = content.replace("let imageUrl = goblin.image;", "let imageUrl = goblin.image;\n    let needsObsoleteOverlay = false;")

content = content.replace(original_block1, new_block1)

# Second replace: inserting the overlay creation AFTER the gobEl is completely built (e.g., after the payBtn)
original_block2 = """        }
        gobEl.appendChild(payBtn);
      }

      // Comprobar si es un goblin nuevo para aplicarle la animación correspondiente"""

new_block2 = """        }
        gobEl.appendChild(payBtn);
      }
    }

    if (needsObsoleteOverlay) {
      gobEl.classList.add('goblin-obsolete-anim');
      
      const overlay = document.createElement('div');
      overlay.className = 'broken-rewards-overlay';
      
      const goldIcon = document.createElement('div');
      goldIcon.className = 'icon-crack';
      const coinSvgLarge = COIN_SVG.replace('width="18" height="18"', 'width="34" height="34"').replace('margin-right: 3px;', 'margin-right: 0px;');
      goldIcon.innerHTML = `<div class="half-left" style="display:flex;align-items:center;justify-content:center;">${coinSvgLarge}</div><div class="half-right" style="display:flex;align-items:center;justify-content:center;">${coinSvgLarge}</div>`;
      
      const pexIcon = document.createElement('div');
      pexIcon.className = 'icon-crack';
      pexIcon.innerHTML = `<div class="half-left">⭐</div><div class="half-right">⭐</div>`;
      
      overlay.appendChild(goldIcon);
      overlay.appendChild(pexIcon);
      gobEl.appendChild(overlay);
      
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
        gobEl.classList.remove('goblin-obsolete-anim');
      }, 2500);
    }

    // Comprobar si es un goblin nuevo para aplicarle la animación correspondiente"""

content = content.replace(original_block2, new_block2)

with open('js/app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement successful!" if "needsObsoleteOverlay" in content else "Replacement failed!")
