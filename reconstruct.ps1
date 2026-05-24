$head = Get-Content 'temp_app_backup.js'
$tail = $head[3316..($head.Length - 1)]
$currentApp = Get-Content 'js\app.js'

$index = 0
foreach ($line in $currentApp) {
    if ($line -match "function renderGameWon") { break }
    $index++
}

$newContent = @()
for ($i = 0; $i -lt $index; $i++) {
    $newContent += $currentApp[$i]
}

$victoryContent = @"
function renderGameWon() {
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');
  const modal = document.querySelector('.event-modal');

  if (modal) {
    modal.classList.remove('retaliation-theme');
    modal.classList.add('victory-theme');
    modal.style.border = '';
    modal.style.boxShadow = '';
  }

  title.innerHTML = `🌟 ¡VICTORIA! 🌟`;
  title.style.color = 'var(--gold)';

  const phrase = "¡Habéis limpiado la senda y la gloria es vuestra!";

  desc.innerHTML = `
    <img src="assets/victoria.jpg" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(212, 175, 55, 0.5);" onerror="this.src='assets/final.jpg'">
    <div style="font-size: 1.5rem; margin-bottom: 20px; color: #fff;">¡El Jefe ha caído!</div>
    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(212, 175, 55, 0.3);">
      <p style="margin-bottom: 10px;">Completasteis la <strong>`\${gameState.activeSenda.replace('_', ' ').toUpperCase()}</strong></p>
      <p style="font-size: 0.9rem; color: var(--text-cita); font-style: italic;">"`${phrase}"</p>
    </div>
  `;

  container.innerHTML = `
    <button class="choice-btn" style="background: var(--gold); color: #000; border: none; font-weight: bold; font-size: 1.2rem; padding: 15px 30px; border-radius: 8px; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);" onclick="location.reload()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Jugar de Nuevo</button>
  `;

  overlay.classList.remove('hidden');
}

"@

$newContent += $victoryContent
$newContent += $tail

Set-Content 'js\app.js' -Value $newContent
