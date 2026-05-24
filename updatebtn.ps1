$c = Get-Content 'js\app.js' -Raw

$target1 = @"
        gbtn.innerHTML = ``
          <div class="target-name">🧌 `${gob.name || ('Goblin L' + gob.level)}</div>
          <div class="target-stats">❤️ Vida: `${gob.currentHp}</div>
          <div class="target-desc">`${isMagoRestricted ? '<span style="color:#ff4d4d">El Mago no puede rematar a un goblin</span>' : 'Infligir 1 daño directo'}</div>
          <div class="target-cost `${p.energy < 1 ? 'insufficient' : ''}">COSTE: 1⚡</div>
        ``;
"@

$replacement1 = @"
        gbtn.style.flexDirection = 'row';
        gbtn.style.justifyContent = 'space-between';
        gbtn.style.alignItems = 'stretch';
        gbtn.style.padding = '0';
        gbtn.style.overflow = 'hidden';

        gbtn.innerHTML = ``
          <div style="flex: 1; padding: 10px 15px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; text-align: left;">
            <div class="target-name" style="margin-bottom: 5px;">🧌 `${gob.name || ('Goblin L' + gob.level)}</div>
            <div class="target-stats" style="margin-bottom: 5px;">❤️ Vida: `${gob.currentHp}</div>
            <div class="target-desc" style="margin-bottom: 5px; font-size: 0.85rem;">`${isMagoRestricted ? '<span style="color:#ff4d4d">El Mago no puede rematar a un goblin</span>' : 'Infligir 1 daño directo'}</div>
            <div class="target-cost `${p.energy < 1 ? 'insufficient' : ''}">COSTE: 1⚡</div>
          </div>
          <div style="width: 80px; flex-shrink: 0; background-image: url('`${gob.image}'); background-size: cover; background-position: center; border-left: 1px solid rgba(0, 210, 255, 0.3);"></div>
        ``;
"@

$c = $c.Replace($target1, $replacement1)
Set-Content 'js\app.js' -Value $c
