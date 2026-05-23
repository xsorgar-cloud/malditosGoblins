let lastWaveLevel = 0;
let lastActionCount = 0;
const gameState = new GameState();
const COIN_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align: middle; margin-right: 3px;"><circle cx="12" cy="12" r="10" fill="#ffd700" stroke="#c79a32" stroke-width="2"/><circle cx="12" cy="12" r="7" fill="none" stroke="#e6c200" stroke-width="1" stroke-dasharray="2,2"/><path d="M12 7v10" stroke="#c79a32" stroke-width="2" stroke-linecap="round"/></svg>`;
const SACK_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align: middle; margin-right: 3px;"><path d="M9 3C8.5 3 8 4 8.5 5.5C9 7 9 7 9 7C6 8 4 12 4 18C4 20.5 6 21 12 21C18 21 20 20.5 20 18C20 12 18 8 15 7C15 7 15 7 15.5 5.5C16 4 15.5 3 15 3C13 3 11 3.5 9 3Z" fill="#ffffff" stroke="#000000" stroke-width="1.8" stroke-linejoin="round"/><rect x="8" y="6.5" width="8" height="2.5" rx="1" fill="#7a7a7a" stroke="#000000" stroke-width="1.2"/><path d="M13 9C13 11 12 12 12 12C12 12 14 11 14 9Z" fill="#7a7a7a" stroke="#000000" stroke-width="1.2"/><path d="M11 9C11 11 12 12 12 12C12 12 10 11 10 9Z" fill="#7a7a7a" stroke="#000000" stroke-width="1.2"/></svg>`;
const SHIELD_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align: middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="var(--accent-blue)" stroke="#023e8a" stroke-width="2" stroke-linejoin="round"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="url(#shieldGrad)" stroke="none"/><defs><linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="rgba(255,255,255,0.4)"/><stop offset="50%" stop-color="rgba(255,255,255,0)"/></linearGradient></defs></svg>`;
const ROLE_NO_ENERGY_WARNING = "⚠️ No tienes energía en tu Rol.<br><br>Para conseguir energía, puedes:<br>1. Usar una de tus acciones en 'RELLENAR ROL' (en tu fase de tablero).<br>2. Asignar dados al Rol en este Panel de Combate.";
const NO_BROKEN_EQUIP_ALERT = "No tienes equipo roto que reparar.";
const NO_ENERGY_ALERT = "No tienes suficiente energía para usar esta habilidad.";
const showInterceptionError = (val) => {
  alert(`Para interceptar, el dado del jugador (${val}) debe coincidir con algún dado natural del Goblin que no esté ya interceptado.`);
};

// Pantalla de Presentación (Splash Screen) autogestionada y compatible con móviles/tablets
(function initSplashScreen() {
  const setupSplash = () => {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    let isRemoving = false;
    const removeSplash = (immediate = false) => {
      if (isRemoving) return;
      isRemoving = true;
      if (immediate) {
        splash.style.transition = 'none';
        splash.style.opacity = '0';
        splash.style.display = 'none';
        splash.remove();
      } else {
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        setTimeout(() => splash.remove(), 800);
      }
    };

    const timer = setTimeout(() => removeSplash(false), 1000);

    // Soporte total para clic en PC y toque táctil en móviles/tablets
    ['mousedown', 'touchstart'].forEach(evt => {
      splash.addEventListener(evt, (e) => {
        e.preventDefault();
        clearTimeout(timer);
        removeSplash(true);
      }, { once: true });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSplash);
  } else {
    setupSplash();
  }
})();

// --- SISTEMA DE TUTORIAL ---
const TutorialManager = {
  enabled: localStorage.getItem('tutorialEnabled') !== 'false',
  seen: JSON.parse(localStorage.getItem('tutorialSeen') || '{}'),
  currentSituation: null,

  content: {
    seleccion_rol: {
      title: "Selección de Grupo",
      body: `
      <ul>
        <li><strong>Roles:</strong> En el inicio de la partida debes seleccionra de 1 a 4 héroes. Cada rol tiene una habilidad única que consume ⚡ Puntos de Energía.</li>
        <li><br><strong>Ajustes (⚙️):</strong> Puedes configurar la dificultad inicial (Oleada y Hito) y los estados iniciales con los que empieza cada héroe.</li>
      </ul>`
    },
    inicio_partida: {
      title: "Tablero Principal",
      body: `
      <div style="text-align: center; margin-bottom: 15px;">
        <img src="assets/logo.png" style="height: 50px; filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.4));">
      </div>
      <ul>
        <li>La pantalla principal se divide en 3 zonas diferenciadas.</li>
        <li><strong>Mercado (Arriba):</strong> Cartas de equipo disponibles. Su coste en oro está arriba a la derecha de la carta.</li>
        <li><strong>Monstruos (Centro):</strong> Los Goblins a los que puedes enfrentarte. Goblins con borde negro <strong>no dan recompensa</strong> (nivel inferior al tuyo).</li>
        <li><strong>Acciones de Turno:</strong> En tu turno puedes <strong>Explorar</strong> (combatir), <strong>Cobrar</strong> (+ oro), o <strong>Rellenar Rol</strong> (+ energía).</li>
      </ul>`
    },
    combate: {
      title: "Combate Táctico",
      body: `
      <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 15px;">
        <div class="die red" style="position: static; transform: none; box-shadow: none;">5</div>
        <div class="die black" style="position: static; transform: none; box-shadow: none;">2</div>
      </div>
      <ul>
        <li><strong>Tus Dados:</strong> Lanza y asigna los dados a tus cartas de equipo arrastrándolos (o tocándolos). Tienes <strong>2 relanzamientos globales</strong> gratuitos.</li>
        <li><strong>Dados Negros:</strong> Algunos equipos generan dados negros de fatiga. Tócalos para relanzarlos (cuesta 1 PV) o asígnalos por su valor inicial.</li>
        <li><strong>Orbes de Daño:</strong> El daño del monstruo se representa con orbes morados. Debes cubrirlos con Escudos 🛡️ o sufrirás daño directo.</li>
      </ul>`
    },
    fin_combate: {
      title: "Represalia y Fin",
      body: `
      <div style="text-align: center; margin-bottom: 15px;">
        <img src="assets/Monstruos/03.jpg" style="height: 70px; border-radius: 8px; border: 2px solid #8B0000; box-shadow: 0 0 15px rgba(255,0,0,0.4);">
      </div>
      <ul>
        <li><strong>Daño Recibido:</strong> Recibirás 1 PV de daño por cada orbe morado no bloqueado.</li>
        <li><strong>Regla de Honor:</strong> Solo recibes oro/PEX de Goblins cuyo nivel sea igual o superior al tuyo (borde rojo). Los de borde negro no dan nada.</li>
        <li><strong>Roturas:</strong> Ciertos ataques o defensas extremas pueden <strong>romper</strong> tu equipo (se volteará). Podrás repararlo pagando 1 moneda después del combate.</li>
      </ul>`
    },
    mercado: {
      title: "Fase de Mercado",
      body: `
      <div style="text-align: center; margin-bottom: 15px;">
        <img src="assets/Equipo/inicial/!1-Espada.jpg" style="height: 70px; border-radius: 8px; border: 1px solid #aaa;">
      </div>
      <ul>
        <li><strong>Comprar:</strong> Si tienes monedas, haz clic en el equipo de arriba para comprarlo. Irá a tu inventario inactivo 📦.</li>
        <li><strong>Fin de Turno:</strong> Una vez hayas terminado, pulsa 'Pasar Turno' para ceder el control al siguiente jugador.</li>
      </ul>`
    },
    incremento_oleada: {
      title: "Nueva Oleada",
      body: `
      <div style="text-align: center; margin-bottom: 15px; font-size: 3rem;">
        🌊
      </div>
      <ul>
        <li><strong>Peligro Creciente:</strong> ¡La Oleada ha aumentado! Aparecerán monstruos más duros y equipo de nivel superior en el mercado.</li>
        <li><strong>Supervivencia:</strong> A partir de la Oleada 3 empezarán a aparecer pociones de curación en el mercado.</li>
      </ul>`
    }
  },

  init() {
    const toggle = document.getElementById('toggle-tutorial');
    if (toggle) {
      toggle.checked = this.enabled;
      toggle.addEventListener('change', (e) => {
        this.enabled = e.target.checked;
        localStorage.setItem('tutorialEnabled', this.enabled);
        this.evaluateSituation();
      });
    }

    const btnHelp = document.getElementById('btn-tutorial');
    const modal = document.getElementById('tutorial-modal');
    const btnCloseX = document.getElementById('btn-close-tutorial-x');
    const btnClose = document.getElementById('btn-close-tutorial');

    if (btnHelp) {
      btnHelp.addEventListener('click', () => {
        if (!this.currentSituation || !this.content[this.currentSituation]) return;

        // Marcar como visto
        this.seen[this.currentSituation] = true;
        localStorage.setItem('tutorialSeen', JSON.stringify(this.seen));
        this.updateButton(); // Quitar el latido

        // Mostrar modal
        document.getElementById('tutorial-title').innerHTML = `❔ ` + this.content[this.currentSituation].title;
        document.getElementById('tutorial-content').innerHTML = this.content[this.currentSituation].body;
        modal.classList.remove('hidden');
      });
    }

    const closeHandler = () => modal.classList.add('hidden');
    if (btnCloseX) btnCloseX.addEventListener('click', closeHandler);
    if (btnClose) btnClose.addEventListener('click', closeHandler);
  },

  evaluateSituation() {
    if (!this.enabled) {
      this.currentSituation = null;
      this.updateButton();
      return;
    }

    let sit = null;
    const combatOverlay = document.getElementById('combat-overlay');
    const setupModal = document.getElementById('setup-modal');

    if (setupModal && !setupModal.classList.contains('hidden')) {
      sit = 'seleccion_rol';
    } else if (combatOverlay && !combatOverlay.classList.contains('hidden')) {
      const btnResolve = document.getElementById('btn-resolve-combat');
      const btnEnd = document.getElementById('btn-end-combat');
      if (btnEnd && !btnEnd.classList.contains('hidden')) {
        sit = 'fin_combate';
      } else {
        sit = 'combate';
      }
    } else if (gameState && gameState.isMarketPhase) {
      sit = 'mercado';
    } else if (gameState && gameState.battlefield && gameState.battlefield.waveLevel > lastWaveLevel && lastWaveLevel > 0) {
      sit = 'incremento_oleada';
    } else {
      sit = 'inicio_partida';
    }

    this.currentSituation = sit;
    this.updateButton();
  },

  updateButton() {
    const btn = document.getElementById('btn-tutorial');
    if (!btn) return;

    if (!this.enabled || !this.currentSituation) {
      btn.classList.add('hidden');
      return;
    }

    btn.classList.remove('hidden');

    if (!this.seen[this.currentSituation]) {
      btn.classList.add('tutorial-pulse');
    } else {
      btn.classList.remove('tutorial-pulse');
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TutorialManager.init());
} else {
  TutorialManager.init();
}

// Variables Globales para Sistema de Respaldo Táctil (Tap-to-Select)
let activeSelectedDieId = null;
let activeSelectedEquipId = null;

// Sobrescribir window.alert nativo por un modal inmersivo del juego
window.alert = function (messageText) {
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');

  if (!overlay || !title || !desc || !container) {
    console.warn("DOM no listo para alert custom:", messageText);
    return;
  }

  title.innerText = "¡ATENCIÓN!";
  title.style.color = "var(--gold)";
  desc.innerHTML = String(messageText).replace(/\n/g, '<br>');

  container.innerHTML = '';
  const marker = document.createElement('div');
  marker.className = 'custom-alert-marker';
  container.appendChild(marker);

  const btnOk = document.createElement('button');
  btnOk.className = 'btn primary';
  btnOk.innerText = "ACEPTAR";
  btnOk.onclick = () => {
    overlay.classList.add('hidden');
  };

  container.appendChild(btnOk);
  overlay.classList.remove('hidden');
};

// DOM Elements
const numPlayersInput = document.getElementById('num-players-input');
const btnStartGame = document.getElementById('btn-start-game');
const setupModal = document.getElementById('setup-modal');

const marketDecks = document.getElementById('market-decks');
const goblinsContainer = document.getElementById('goblins-container');
const waveLevelSpan = document.getElementById('wave-level');
const actionCountSpan = document.getElementById('action-count');

const roleSelectionContainer = document.getElementById('role-selection-container');
const playersContainer = document.getElementById('players-container');

let selectedSetupRoles = ['guerrero', null, null, null];

function renderRoleSelection() {
  roleSelectionContainer.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    let row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '15px';
    row.style.padding = '10px';
    row.style.borderRadius = '8px';
    row.style.transition = 'all 0.3s';
    row.style.border = '1px solid transparent'; // Siempre presente para evitar saltos

    // Si no hay rol, la fila se ve más tenue
    if (selectedSetupRoles[i] === null) {
      row.style.opacity = '0.5';
      row.style.background = 'rgba(255,255,255,0.02)';
      row.style.borderColor = 'transparent';
    } else {
      row.style.opacity = '1';
      row.style.background = 'rgba(244, 211, 94, 0.05)';
      row.style.borderColor = 'rgba(244, 211, 94, 0.2)';
    }

    let label = document.createElement('label');
    label.style.width = '100px';
    label.style.fontWeight = 'bold';
    label.style.fontSize = '1.1rem';
    label.innerText = `Jugador ${i + 1}:`;
    row.appendChild(label);

    let optionsDiv = document.createElement('div');
    optionsDiv.style.display = 'flex';
    optionsDiv.style.gap = '10px';

    DB.roles.forEach(r => {
      let img = document.createElement('div');
      img.className = 'role-option' + (selectedSetupRoles[i] === r.id ? ' selected' : '');
      img.style.backgroundImage = `url('${r.icon}')`;
      img.title = r.name;
      img.onclick = () => {
        // Toggle: si ya estaba seleccionado, lo quitamos (excepto para el Jugador 1)
        if (selectedSetupRoles[i] === r.id) {
          if (i !== 0) selectedSetupRoles[i] = null;
        } else {
          selectedSetupRoles[i] = r.id;
        }
        renderRoleSelection();
      };
      img.onmouseenter = () => {
        const previewName = document.getElementById('setup-role-name');
        const previewCard = document.getElementById('setup-role-card');
        const previewEffect = document.getElementById('setup-role-effect');
        if (previewName && previewCard && previewEffect) {
          previewName.innerText = r.name.toUpperCase();
          const miniImage = r.image.replace('rol_', 'mini_rol_');
          previewCard.style.backgroundImage = `url('${miniImage}')`;
          previewEffect.innerText = r.effect;
        }
      };
      optionsDiv.appendChild(img);
    });

    row.appendChild(optionsDiv);
    roleSelectionContainer.appendChild(row);
  }
  TutorialManager.evaluateSituation();
}


let selectedGoblins = [];

// Initial render
renderRoleSelection();

// Previsualizacion dinamica de reglas de senda en la pantalla de inicio
function updateSetupSendaPreview() {
  const selectSenda = document.getElementById('select-senda');
  const previewContainer = document.getElementById('setup-senda-preview');
  if (!selectSenda || !previewContainer) return;

  const sendaVal = selectSenda.value;
  const rules = DB.sendaReglasGenerales[sendaVal] || [];
  
  let html = `<h4 style="margin: 0 0 12px 0; color: var(--gold); font-family: 'Cinzel', serif; border-bottom: 1px solid rgba(212,175,55,0.2); padding-bottom: 6px; font-size: 1.1rem; letter-spacing: 0.5px;">Reglas Especiales</h4>`;
  if (rules.length === 0 || (rules.length === 1 && rules[0].name === "Sin reglas especiales")) {
    html += `<p style="margin: 0; color: #aaa; font-style: italic; font-size: 0.95rem;">Esta senda no aplica ninguna regla de entorno adicional.</p>`;
  } else {
    rules.forEach(rule => {
      html += `<div style="margin-bottom: 15px;">
        <strong style="color: #fff; font-size: 0.95rem; display: block; margin-bottom: 2px;">${rule.name}</strong>
        <p style="margin: 0; color: #ccc; font-size: 0.9rem; line-height: 1.4;">${rule.desc}</p>
      </div>`;
    });
  }

  const sendaHitos = DB.hitos[sendaVal] || [];
  const bossHito = sendaHitos.find(h => h.isBoss);
  if (bossHito) {
    html += `<h4 style="margin: 25px 0 12px 0; color: var(--accent-red); font-family: 'Cinzel', serif; border-bottom: 1px solid rgba(239,35,60,0.2); padding-bottom: 6px; font-size: 1.1rem; letter-spacing: 0.5px;">Jefe Final y Reglas</h4>
    <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">`;
    if (bossHito.bossStats && bossHito.bossStats.image) {
      html += `<img id="setup-boss-image" src="${bossHito.bossStats.image}" style="width: 168px; height: 238px; border-radius: 8px; border: 2px solid #9d4edd; box-shadow: 0 4px 15px rgba(157,78,221,0.5); object-fit: cover; cursor: zoom-in;" alt="${bossHito.name}">`;
      
      const basePath = bossHito.bossStats.image.substring(0, bossHito.bossStats.image.lastIndexOf('/') + 1);
      const fileName = bossHito.bossStats.image.substring(bossHito.bossStats.image.lastIndexOf('/') + 1);
      const rulesImage = basePath + 'reglas_' + fileName;
      
      html += `<img id="setup-rules-image" src="${rulesImage}" style="width: 168px; height: 238px; border-radius: 8px; border: 2px solid var(--gold); box-shadow: 0 4px 15px rgba(212,175,55,0.5); object-fit: cover; cursor: zoom-in;" alt="Reglas de ${bossHito.name}" onerror="this.style.display='none'">`;
    }
    html += `</div>`;
  }

  previewContainer.innerHTML = html;

  // Manejar hover de la imagen del jefe para mostrar el modal de previsualizacion grande
  const bossImgEl = document.getElementById('setup-boss-image');
  const rulesImgEl = document.getElementById('setup-rules-image');
  const hoverModal = document.getElementById('boss-hover-modal');
  const hoverModalImg = document.getElementById('boss-hover-modal-img');
  
  if (hoverModal && hoverModalImg) {
    if (bossImgEl) {
      bossImgEl.addEventListener('mouseenter', () => {
        hoverModalImg.src = bossImgEl.src;
        hoverModal.style.opacity = '1';
      });
      bossImgEl.addEventListener('mouseleave', () => {
        hoverModal.style.opacity = '0';
      });
    }
    if (rulesImgEl) {
      rulesImgEl.addEventListener('mouseenter', () => {
        hoverModalImg.src = rulesImgEl.src;
        hoverModal.style.opacity = '1';
      });
      rulesImgEl.addEventListener('mouseleave', () => {
        hoverModal.style.opacity = '0';
      });
    }
  }
}

const settingsModal = document.getElementById('settings-modal');
document.getElementById('btn-open-settings').addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});
document.getElementById('btn-close-settings-x').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});
document.getElementById('btn-save-settings').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

btnStartGame.addEventListener('click', () => {
  const finalRoles = selectedSetupRoles.filter(r => r !== null);

  if (finalRoles.length === 0) {
    alert("Debes seleccionar al menos un rol para un jugador.");
    return;
  }

  const numPlayers = finalRoles.length;
  if (numPlayers === 4) {
    playersContainer.classList.add('count-4');
  } else {
    playersContainer.classList.remove('count-4');
  }

  const rawHp = parseInt(document.getElementById('input-init-hp').value, 10);
  const initHp = isNaN(rawHp) ? 10 : rawHp;

  const rawMaxHp = parseInt(document.getElementById('input-init-maxhp').value, 10);
  const initMaxHp = isNaN(rawMaxHp) ? 10 : rawMaxHp;

  const rawEnergy = parseInt(document.getElementById('input-init-energy').value, 10);
  const initEnergy = isNaN(rawEnergy) ? 10 : rawEnergy;

  const rawGold = parseInt(document.getElementById('input-init-gold').value, 10);
  const initGold = isNaN(rawGold) ? 2 : rawGold;

  const rawHito = parseInt(document.getElementById('input-init-hito').value, 10);
  const initHito = isNaN(rawHito) ? 1 : rawHito;

  const rawLevel = parseInt(document.getElementById('input-init-level').value, 10);
  const initLevel = isNaN(rawLevel) ? 1 : rawLevel;

  const selectSendaEl = document.getElementById('select-senda');
  const initSenda = selectSendaEl ? selectSendaEl.value : 'iniciacion';

  const rawWave = parseInt(document.getElementById('input-init-wave').value, 10);
  const initWave = isNaN(rawWave) ? 1 : rawWave;
  lastWaveLevel = initWave;

  gameState.setupPlayers(numPlayers, finalRoles, { hp: initHp, maxHp: initMaxHp, energy: initEnergy, mo: initGold, hito: initHito, level: initLevel, wave: initWave, senda: initSenda });
  setupModal.classList.add('hidden');
  const versionBadge = document.getElementById('game-version-badge');
  if (versionBadge) versionBadge.style.display = 'none';
  updateUI();
  if (typeof window !== 'undefined' && window.saveGame) {
    window.saveGame(true);
  }
});

document.getElementById('btn-gold').addEventListener('click', () => {
  gameState.performActionGold();
  updateUI();
});

document.getElementById('btn-gold-dmg').addEventListener('click', () => {
  gameState.performActionGoldAndDamage();
  updateUI();
});

document.getElementById('btn-end-turn').addEventListener('click', () => {
  gameState.nextTurn();
  updateUI();
});

const btnDeployHito = document.getElementById('btn-deploy-hito');
btnDeployHito.addEventListener('click', () => {
  const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;
  const hitoToDeploy = sendaHitos[gameState.currentHito - 1];

  if (gameState.deployHito()) {
    if (hitoToDeploy && hitoToDeploy.ruleDesc) {
      showHitoRuleNotification(hitoToDeploy);
    }
    updateUI();
  }
});

function openHitosModal() {
  const modal = document.getElementById('hitos-modal');
  const content = document.getElementById('hitos-info-content');
  const bossPreview = document.getElementById('hitos-boss-preview');

  const titleEl = modal.querySelector('h2');
  if (titleEl) {
    const sendaNames = {
      iniciacion: "Senda de Iniciaci\u00F3n",
      guerrero: "Senda de El Ze\u00F1or de la Guerra",
      rey_brujo: "Senda de El Rey Brujo"
    };
    const sendaName = sendaNames[gameState.activeSenda] || "Senda de Iniciaci\u00F3n";
    titleEl.innerText = `${sendaName} - Hitos y Reglas`;
  }

  let html = '';
  let rulesHTML = '';

  // 1. Preparar las reglas generales de la Senda
  const generalRules = DB.sendaReglasGenerales[gameState.activeSenda] || [];
  if (generalRules.length > 0) {
    rulesHTML += `<div style="background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.2); padding: 15px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
      <h3 style="color: var(--gold); margin-top: 0; font-family: 'Cinzel', serif; font-size: 1.15rem; border-bottom: 1px solid rgba(212, 175, 55, 0.2); padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 1px;">&#128220; REGLAS GENERALES</h3>
      <div style="display: flex; flex-direction: column; gap: 12px;">`;
    generalRules.forEach(rule => {
      rulesHTML += `<div>
        <strong style="color: #fff; font-size: 1rem; display: flex; align-items: center; gap: 6px;">${rule.name}</strong>
        <p style="margin: 4px 0 0 0; color: #bbb; font-size: 0.92rem; line-height: 1.5; font-family: 'Inter', sans-serif;">${rule.desc}</p>
      </div>`;
    });
    rulesHTML += `</div></div>`;
  }

  html += '<p style="font-size: 1rem; color: #ccc; margin-bottom: 15px; font-family: \'Cinzel\', serif; letter-spacing: 1px;">&#128739;&#65039; Goblins a invocar (Por jugador):</p>';
  html += '<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px;">';
  let bossImgHTML = '';

  const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;

  sendaHitos.forEach(hito => {
    let gobsDesc = hito.isBoss
      ? `Jefe: ${hito.name}`
      : hito.goblins.map(lvl => `<img src="assets/g${lvl}.png" style="height: 50px; vertical-align: middle; margin: 0 4px;" alt="G${lvl}">`).join(' ');

    if (hito.isBoss && hito.bossStats.image) {
      bossImgHTML = `<div style="width: 100%; max-width: 261px; max-height: 373px; aspect-ratio: 2.5/3.5; background-image: url('${hito.bossStats.image}'); background-size: cover; background-position: center; border-radius: 10px; border: 2px solid #9d4edd; box-shadow: 0 0 20px rgba(157,78,221,0.5); margin: 0 auto;"></div>`;
    }

    const isCompleted = hito.id < gameState.currentHito;
    const bgStyle = isCompleted ? 'background: rgba(27, 67, 50, 0.7); border: 1px solid #52b788;' : 'background: rgba(0,0,0,0.6); border: 1px solid rgba(212, 175, 55, 0.5);';
    const titleColor = isCompleted ? '#74c69d' : 'var(--accent-red)';
    const badgeHTML = isCompleted ? `<div style="background: #2d6a4f; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; border: 1px solid #52b788; box-shadow: 0 0 10px rgba(82,183,136,0.5);">&#10003;</div>` : '';

    let ruleHTML = '';
    if (hito.ruleDesc) {
      ruleHTML = `<div style="font-size: 0.85rem; color: var(--gold); margin-top: 4px; font-style: italic;">Regla: ${hito.ruleDesc}</div>`;
    }

    html += `<li style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: 8px; ${bgStyle}">
      <div>
        <strong style="color: ${titleColor}; font-size: 1.0rem;">Hito ${hito.id}: ${hito.name}</strong><br>
        <span style="color: #ccc;">${gobsDesc}</span>
        ${ruleHTML}
      </div>
      ${badgeHTML}
    </li>`;
  });
  html += '</ul>';

  content.innerHTML = html;
  bossPreview.innerHTML = rulesHTML + bossImgHTML;
  modal.classList.remove('hidden');
}

document.getElementById('btn-info-hitos').addEventListener('click', openHitosModal);

document.getElementById('btn-close-hitos').addEventListener('click', () => {
  document.getElementById('hitos-modal').classList.add('hidden');
});

document.getElementById('btn-close-hito-rule-notif').addEventListener('click', () => {
  document.getElementById('hito-rule-notification-modal').classList.add('hidden');
});

function showHitoRuleNotification(hitoObj) {
  const modal = document.getElementById('hito-rule-notification-modal');
  const title = document.getElementById('hito-rule-notif-title');
  const name = document.getElementById('hito-rule-notif-name');
  const desc = document.getElementById('hito-rule-notif-desc');
  const goblinsContainer = document.getElementById('hito-rule-notif-goblins');

  if (modal && title && name && desc && goblinsContainer) {
    name.innerText = `Hito ${hitoObj.id}: ${hitoObj.name}`;
    desc.innerText = hitoObj.ruleDesc || '';

    let gobsHTML = '';
    if (hitoObj.isBoss) {
      const bossImg = hitoObj.bossStats && hitoObj.bossStats.image ? hitoObj.bossStats.image : 'assets/Monstruos/05.jpg';
      gobsHTML = `<div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <span style="color: var(--accent-red); font-weight: bold; font-family: 'Cinzel', serif; letter-spacing: 1px; font-size: 0.9rem;">JEFE DE LA SENDA</span>
        <img src="${bossImg}" style="height: 120px; border-radius: 8px; border: 2px solid var(--accent-red); box-shadow: 0 0 15px rgba(230, 57, 70, 0.4);" alt="Jefe">
      </div>`;
    } else if (hitoObj.goblins && hitoObj.goblins.length > 0) {
      gobsHTML = hitoObj.goblins.map(lvl => 
        `<img src="assets/g${lvl}.png" style="height: 60px; vertical-align: middle; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); margin: 0 5px;" alt="G${lvl}">`
      ).join('');
    }
    goblinsContainer.innerHTML = gobsHTML;

    modal.classList.remove('hidden');
  }
}

// -- LÓGICA RELLENAR ROL --
let roleFillDice = { red1: 0, red2: 0, black: 0 };
let roleFillAssigned = null;
let roleFillBlackRerolled = false;

document.getElementById('btn-role').addEventListener('click', () => {
  if (gameState.isMarketPhase) return;

  const p = gameState.players[gameState.currentPlayerIndex];

  // Tirar dados de la colección del jugador
  roleFillDice = p.dicePool.map((d, index) => ({
    ...d,
    id: `role-die-${index}`,
    val: Math.floor(Math.random() * d.faces) + 1,
    rerolled: false
  }));

  roleFillAssigned = null;

  //p = gameState.players[gameState.currentPlayerIndex];
  document.getElementById('role-fill-player-stats').innerHTML = `<p style="font-size: 1.2rem; margin:0;">${p.name}</p><p style="color: #00d2ff; margin:0;">Energía Actual: ${p.energy}</p>`;

  const roleSlot = document.getElementById('role-fill-slot');
  roleSlot.style.backgroundImage = `url('${p.role.image}')`;
  document.getElementById('role-fill-placeholder').innerText = '';
  document.getElementById('role-fill-placeholder').style.background = 'rgba(0,0,0,0.5)';

  renderRoleFillDice();
  document.getElementById('role-fill-overlay').classList.remove('hidden');
  document.getElementById('btn-confirm-role-fill').disabled = true;
});


function renderRoleFillDice() {
  const container = document.getElementById('role-fill-dice-container');
  if (!container) return;
  container.innerHTML = '';

  roleFillDice.forEach(die => {
    let dieEl = document.createElement('div');
    dieEl.className = `die ${die.type}`;
    if (die.faces === 4) dieEl.classList.add('d4');
    dieEl.id = die.id;
    dieEl.innerText = die.val;
    dieEl.draggable = roleFillAssigned !== die.id;
    dieEl.style.opacity = roleFillAssigned === die.id ? '0.3' : '1';

    dieEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', die.id);
    });

    if (roleFillAssigned === die.id) {
      dieEl.style.cursor = 'pointer';
      dieEl.title = 'Click para desasignar';
      dieEl.onclick = () => {
        roleFillAssigned = null;
        document.getElementById('role-fill-placeholder').innerText = '';
        document.getElementById('role-fill-placeholder').className = 'die-placeholder';
        document.getElementById('btn-confirm-role-fill').disabled = true;
        renderRoleFillDice();
      };
    } else if (roleFillAssigned !== die.id) {
      // SISTEMA DE RESPALDO: Permitir asignar el dado al rol haciendo clic en él (incluso negros)
      dieEl.style.cursor = 'pointer';
      dieEl.title = 'Click para asignar al rol';
      dieEl.onclick = () => {
        roleFillAssigned = die.id;
        const placeholder = document.getElementById('role-fill-placeholder');
        placeholder.innerText = die.val;
        placeholder.className = 'die-placeholder active ' + die.type;
        if (die.faces === 4) placeholder.classList.add('d4');
        renderRoleFillDice();
        document.getElementById('btn-confirm-role-fill').disabled = false;
      };
    }

    let dieWrapper = document.createElement('div');
    dieWrapper.className = 'die-wrapper';
    dieWrapper.style.position = 'relative';

    if (die.type === 'black' && !die.rerolled && roleFillAssigned !== die.id) {
      const rerollBtn = document.createElement('button');
      rerollBtn.className = 'die-reroll-icon';
      rerollBtn.innerHTML = '↻';
      rerollBtn.title = 'Relanzar dado negro';
      rerollBtn.onclick = (e) => {
        e.stopPropagation();
        dieEl.classList.add('die-spin');
        const newVal = Math.floor(Math.random() * die.faces) + 1;
        setTimeout(() => {
          dieEl.innerText = newVal;
        }, 300);
        setTimeout(() => {
          die.val = newVal;
          die.rerolled = true;
          renderRoleFillDice();
        }, 600);
      };
      dieWrapper.appendChild(rerollBtn);
    }

    if (die.rerolled) {
      let lock = document.createElement('div');
      lock.innerHTML = '🔒';
      lock.style.cssText = 'position: absolute; top: -5px; right: -5px; font-size: 0.8rem; background: #222; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gold); z-index: 10;';
      dieWrapper.appendChild(lock);
      dieEl.title = 'Dado ya relanzado (Bloqueado)';
    }

    dieWrapper.appendChild(dieEl);
    container.appendChild(dieWrapper);
  });
}

document.getElementById('role-fill-slot').addEventListener('dragover', (e) => e.preventDefault());
document.getElementById('role-fill-slot').addEventListener('drop', (e) => {
  e.preventDefault();
  const dieId = e.dataTransfer.getData('text/plain');
  const die = roleFillDice.find(d => d.id === dieId);
  if (!die) return;

  roleFillAssigned = dieId;
  const val = die.val;

  const placeholder = document.getElementById('role-fill-placeholder');
  placeholder.innerText = val;
  placeholder.className = 'die-placeholder active ' + die.type;
  if (die.faces === 4) placeholder.classList.add('d4');

  renderRoleFillDice();
  document.getElementById('btn-confirm-role-fill').disabled = false;
});

document.getElementById('btn-confirm-role-fill').addEventListener('click', () => {
  if (!roleFillAssigned) return;

  const p = gameState.players[gameState.currentPlayerIndex];
  const die = roleFillDice.find(d => d.id === roleFillAssigned);
  const val = die.val;
  const energyGain = p.role.energyRates[val - 1] || 0;

  p.energy += energyGain;

  gameState.addLog(`⚡ <strong>${p.name}</strong> usó la acción Rellenar Rol. Asignó un ${val} y ganó ${energyGain} Energía.`);
  gameState.consumeAction();

  document.getElementById('role-fill-overlay').classList.add('hidden');
  updateUI();
});

document.getElementById('btn-cancel-role-fill').addEventListener('click', () => {
  document.getElementById('role-fill-overlay').classList.add('hidden');
});



// Lógica del Log
const logPanel = document.getElementById('log-panel');
const logContent = document.getElementById('log-content');

document.getElementById('btn-toggle-log').addEventListener('click', () => {
  if (logPanel.style.display === 'none' || logPanel.style.display === '') {
    logPanel.style.display = 'flex';
    renderLogs();
  } else {
    logPanel.style.display = 'none';
  }
});

function renderLogs() {
  logContent.innerHTML = gameState.logs.map(log => `<div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 3px;">${log}</div>`).join('');
  logContent.scrollTop = logContent.scrollHeight; // Auto-scroll al final
}

function showWaveAnnouncement(level) {
  const overlay = document.getElementById('wave-announcement');
  const levelSpan = document.getElementById('announcement-level');
  if (!overlay || !levelSpan) return;

  levelSpan.innerText = level;
  overlay.classList.remove('hidden');
  overlay.style.opacity = '1';

  // Ocultar después de 2.5 segundos
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 500);
  }, 2500);
}

function showActionNotification(count) {
  const overlay = document.getElementById('action-notification');
  const toastStars = document.querySelectorAll('#toast-action-stars .toast-star');
  if (!overlay || toastStars.length === 0) return;

  toastStars.forEach((star, idx) => {
    star.classList.remove('star-pop-active');
    star.style.transform = 'scale(1)';

    if (idx < count) {
      star.style.color = '#ff4d4d';
      star.style.textShadow = '0 0 20px rgba(255, 77, 77, 0.8)';
    } else if (idx === count) {
      star.style.color = '#ff4d4d';
      star.style.textShadow = '0 0 20px rgba(255, 77, 77, 0.8)';
      void star.offsetWidth; // Forzar reflow para reiniciar la animación
      star.classList.add('star-pop-active');
    } else {
      star.style.color = '#444';
      star.style.textShadow = 'none';
    }
  });

  overlay.classList.remove('hidden');
  overlay.style.opacity = '1';

  // Empieza a desvanecerse pronto (700ms) pero tarda más en irse (0.8s en CSS)
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 800); // Esperar a que termine la transición de 0.8s
  }, 700);
}

// Render Functions
function updateUI() {
  // 1. Siempre renderizamos primero para que el estado visual refleje los últimos cambios (ej: 0 HP)
  renderMarket();
  renderBattlefield();
  renderPlayer();
  renderLogs(); // Actualizar el log si est\u00E1 abierto

  if (gameState.pendingCorrosionChoice) {
    showCorrosionModal(gameState.pendingCorrosionChoice);
    return;
  }

  if (gameState.currentCombat) {
    renderCombatOverlay();
  }

  // 2. Comprobamos estados de fin de partida o fases especiales
  if (gameState.isGameOver) {
    renderGameOver();
    return;
  }

  // Detectar cambio de oleada para anuncio
  if (gameState.battlefield.waveLevel > lastWaveLevel) {
    showWaveAnnouncement(gameState.battlefield.waveLevel);
    lastWaveLevel = gameState.battlefield.waveLevel;
    lastActionCount = gameState.battlefield.actionCount; // Reset sin aviso de acción si hay aviso de oleada
  } else if (gameState.battlefield.actionCount > lastActionCount) {
    showActionNotification(gameState.battlefield.actionCount);
    lastActionCount = gameState.battlefield.actionCount;

    // Pulso en el HUD
    const hudAction = document.getElementById('action-count');
    if (hudAction) {
      hudAction.classList.remove('pulse-action');
      void hudAction.offsetWidth; // Force reflow
      hudAction.classList.add('pulse-action');
    }
  }

  if (gameState.isRetaliationPhase) {
    renderRetaliationModal();
    return;
  }

  const hitoBtn = document.getElementById('btn-deploy-hito');
  if (gameState.currentHito > 5) {
    hitoBtn.innerText = "Senda Completada";
    hitoBtn.disabled = true;
  } else {
    const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;
    let hito = sendaHitos[gameState.currentHito - 1];
    hitoBtn.innerText = `Enfrentar Hito ${gameState.currentHito}`;
    hitoBtn.disabled = false;
  }

  const btnConfirmAttack = document.getElementById('btn-confirm-attack');
  const btnGold = document.getElementById('btn-gold');
  const btnGoldDmg = document.getElementById('btn-gold-dmg');
  const btnRole = document.getElementById('btn-role');
  const btnEndTurn = document.getElementById('btn-end-turn');

  btnEndTurn.classList.remove('hidden');

  const hasGoblinsAlive = gameState.battlefield.goblins.some(g => !g.isDying);
  const isWarlordChoicePhase = gameState.activeSenda === 'guerrero' && !hasGoblinsAlive && !gameState.isMarketPhase && !gameState.isRetaliationPhase && !gameState.isGameOver;

  if (gameState.isMarketPhase || isWarlordChoicePhase) {
    btnConfirmAttack.disabled = true;
    btnGold.disabled = true;
    btnGoldDmg.disabled = true;
    btnRole.disabled = true;
  } else {
    btnConfirmAttack.disabled = false;
    btnConfirmAttack.innerText = `Atacar Goblins (${selectedGoblins.length})`;

    if (gameState.activeSenda === 'guerrero' && hasGoblinsAlive) {
      // Si hay goblins vivos, obligatorio luchar: las demás acciones se desactivan
      btnGold.disabled = true;
      btnGoldDmg.disabled = true;
      btnRole.disabled = true;
    } else {
      btnGold.disabled = false;
      btnGoldDmg.disabled = false;
      btnRole.disabled = false;
    }
  }

  checkLevelUpChoice();
  TutorialManager.evaluateSituation();
}

// Botones de acción
const btnConfirmAttack = document.getElementById('btn-confirm-attack');

btnConfirmAttack.addEventListener('click', () => {
  if (gameState.isMarketPhase) return;

  // Automatización: Si no hay seleccionados pero solo hay 1 goblin vivo, seleccionarlo automáticamente
  if (selectedGoblins.length === 0) {
    const aliveGoblins = gameState.battlefield.goblins.filter(g => !g.isDying);
    if (aliveGoblins.length === 1) {
      selectedGoblins.push(aliveGoblins[0]);
    }
  }

  if (selectedGoblins.length === 0) {
    alert("Selecciona al menos un Goblin en la mesa haciendo clic en su carta antes de atacar.");
    return;
  }

  if (gameState.startCombat(selectedGoblins)) {
    currentAssignments = {};
    interceptionAssignments = {};
    activeSelectedDieId = null;
    activeSelectedEquipId = null;
    renderCombatOverlay();
  }
});

function renderMarket() {
  marketDecks.innerHTML = '';
  const types = ['ataque', 'escudos', 'curacion'];
  const p = gameState.getCurrentPlayer();

  types.forEach(type => {
    const deck = gameState.market[type];
    if (deck && deck.length > 0) {
      const topCard = deck[0];
      const deckEl = document.createElement('div');
      deckEl.className = 'deck';
      deckEl.style.backgroundImage = `url('${topCard.image}')`;
      deckEl.innerHTML = '';

      if (p && p.mo >= topCard.cost) {
        deckEl.classList.add('market-affordable');
      }

      deckEl.addEventListener('click', () => {
        const topCard = deck[0];
        const player = gameState.getCurrentPlayer();

        // Si no tiene dinero, no hacemos nada (la UI ya debería reflejarlo o buyFromMarket fallará)
        if (player.mo < topCard.cost) return;

        const buyAction = () => {
          const hasCard = player.equipped.some(eq => eq.id === topCard.id);

          if (hasCard) {
            openDuplicateWarningModal(type, topCard);
          } else {
            const result = gameState.buyFromMarket(type);
            if (result === "OVERWEIGHT") {
              alert(`¡DEMASIADO PESO! No puedes llevar más de ${DB.playerLevels[player.level - 1].blocks} bloques de equipo. Sube de nivel para aumentar tu capacidad.`);
            } else if (result) {
              updateUI();
            }
          }
        };

        if (!gameState.isMarketPhase) {
          openActionLossWarningModal(buyAction);
        } else {
          buyAction();
        }
      });

      marketDecks.appendChild(deckEl);
    }
  });

  // 4. Mazo de Pociones (Especial)
  const potionsDeck = document.createElement('div');
  potionsDeck.className = 'deck';
  const isUnlocked = gameState.battlefield.waveLevel >= 3;

  const imgUrl = isUnlocked ? 'assets/Pociones/Pociones.jpg' : 'assets/Pociones/bloqueo_pociones.jpg';
  potionsDeck.style.backgroundImage = `url('${imgUrl}')`;

  if (!isUnlocked) {
    potionsDeck.style.opacity = '0.6';
    potionsDeck.title = "Se desbloquea en la Oleada 3";
  } else {
    potionsDeck.style.cursor = 'pointer';
    potionsDeck.title = "Comprar Pociones";
    potionsDeck.onclick = () => openPotionsModal();
  }

  marketDecks.appendChild(potionsDeck);

  // 5. Botón de Explorar Mercado (si tiene al menos 1 moneda)
  const marketZone = document.getElementById('market-zone');
  if (marketZone) {
    const oldBtn = marketZone.querySelector('.btn-explore-market');
    if (oldBtn) oldBtn.remove();
  }

  if (p && p.mo >= 1) {
    const btnExplore = document.createElement('button');
    btnExplore.className = 'btn secondary btn-explore-market';
    btnExplore.style.position = 'absolute';
    btnExplore.style.left = 'calc(50% + 295px)';
    btnExplore.style.top = '10px';
    btnExplore.style.padding = '8px 14px';
    btnExplore.style.fontSize = '1.1rem';
    btnExplore.style.borderColor = 'var(--gold)';
    btnExplore.style.background = 'rgba(20,20,30,0.85)';
    btnExplore.innerHTML = '🔍';
    btnExplore.title = 'Paga 1 moneda para descartar una carta del mercado y revelar la siguiente del mazo.';
    btnExplore.onclick = () => openExploreMarketModal();

    if (marketZone) {
      marketZone.appendChild(btnExplore);
    } else {
      marketDecks.appendChild(btnExplore);
    }
  }
}

function openExploreMarketModal() {
  const modal = document.getElementById('explore-market-modal');
  const optionsContainer = document.getElementById('explore-market-options');
  const btnClose = document.getElementById('btn-close-explore-market');
  if (!modal || !optionsContainer) return;

  const p = gameState.getCurrentPlayer();
  const goldSpan = document.getElementById('explore-market-player-gold');
  if (goldSpan && p) {
    goldSpan.innerText = p.mo;
  }

  optionsContainer.innerHTML = '';
  const types = ['ataque', 'escudos', 'curacion'];

  types.forEach(type => {
    const deck = gameState.market[type];
    if (deck && deck.length > 0) {
      const topCard = deck[0];
      const cardEl = document.createElement('div');
      cardEl.className = 'deck';
      cardEl.style.backgroundImage = `url('${topCard.image}')`;
      cardEl.style.cursor = 'pointer';
      cardEl.title = `Descartar ${topCard.name} (Coste: 1 Moneda)`;

      cardEl.onclick = () => {
        const p = gameState.getCurrentPlayer();
        if (p.mo < 1) {
          alert("No tienes suficientes monedas para explorar el mercado.");
          return;
        }
        p.mo -= 1;
        const removedCard = gameState.market[type].shift();
        gameState.market[type].push(removedCard); // Rotar la carta al fondo del mazo
        gameState.addLog(`🔍 <strong>${p.name}</strong> gastó 1 mo en explorar el mercado, descartando <strong>${removedCard.name}</strong>.`);
        updateUI();

        if (p.mo >= 1) {
          openExploreMarketModal(); // Mantener abierto y refrescar las cartas
        } else {
          modal.classList.add('hidden'); // Cerrar solo si se queda sin monedas
        }
      };

      optionsContainer.appendChild(cardEl);
    }
  });

  if (btnClose) {
    btnClose.onclick = () => modal.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

let animatedGoblinUids = new Set();

function renderBattlefield() {
  waveLevelSpan.innerText = gameState.battlefield.waveLevel;

  const actionStars = document.querySelectorAll('#action-stars-container .action-star');
  const currentAction = gameState.battlefield.actionCount; // 0, 1, 2
  actionStars.forEach((star, idx) => {
    if (idx <= currentAction) {
      star.style.color = '#ff4d4d';
      star.style.textShadow = '0 0 10px rgba(255, 77, 77, 0.6)';
    } else {
      star.style.color = '#444';
      star.style.textShadow = 'none';
    }
  });

  const pLeader = gameState.players[0];
  if (pLeader) {
    const expReq = {
      1: 2 * gameState.players.length,
      2: 6 * gameState.players.length,
      3: 12 * gameState.players.length,
      4: 22 * gameState.players.length
    };
    const nextExpLeader = expReq[pLeader.level] || 'MAX';
    const groupLevelSpan = document.getElementById('group-level');
    const groupPexSpan = document.getElementById('group-pex');
    const groupNextPexSpan = document.getElementById('group-next-pex');
    if (groupLevelSpan) groupLevelSpan.innerText = pLeader.level;
    if (groupPexSpan) groupPexSpan.innerText = pLeader.pex;
    if (groupNextPexSpan) groupNextPexSpan.innerText = nextExpLeader;
  }


  const hitoActionsDiv = document.getElementById('hito-actions');

  if (gameState.currentHito <= 5) {
    const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;
    let hito = sendaHitos[gameState.currentHito - 1];
    btnDeployHito.innerText = `Enfrentar Hito ${gameState.currentHito}`;
    if (hitoActionsDiv) hitoActionsDiv.style.display = 'flex';

    // Desactivar si ya hay goblins de hito vivos
    let hasHitoGoblins = gameState.battlefield.goblins.some(g => g.isHito);
    btnDeployHito.disabled = hasHitoGoblins;
    if (hasHitoGoblins) {
      btnDeployHito.title = "Debes derrotar a todos los Goblins de Hito actuales antes de iniciar uno nuevo.";
    } else {
      btnDeployHito.title = "Desplegar el siguiente Hito.";
    }
  } else {
    if (hitoActionsDiv) hitoActionsDiv.style.display = 'none';
  }

  goblinsContainer.innerHTML = '';

  const hasGoblinsAlive = gameState.battlefield.goblins.some(g => !g.isDying);

  if (gameState.activeSenda === 'guerrero' && !hasGoblinsAlive && !gameState.isMarketPhase && !gameState.isRetaliationPhase && !gameState.isGameOver) {
    const choiceContainer = document.createElement('div');
    choiceContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 15px; grid-column: 1 / -1; width: 100%; max-width: 600px; margin: 20px auto; padding: 25px; background: rgba(0, 0, 0, 0.6); border: 2px solid var(--gold); border-radius: 15px; box-shadow: 0 0 30px rgba(212, 175, 55, 0.2); backdrop-filter: blur(10px); text-align: center;';

    const title = document.createElement('h3');
    title.innerText = 'MESA VACÍA - EL ZEÑOR DE LA GUERRA';
    title.style.cssText = 'margin: 0; color: var(--gold); font-family: "Cinzel", serif; font-size: 1.3rem; letter-spacing: 1px;';
    choiceContainer.appendChild(title);

    const desc = document.createElement('p');
    desc.innerText = 'Debes elegir una opción para poder continuar con tus acciones:';
    desc.style.cssText = 'margin: 5px 0 15px 0; color: #ccc; font-size: 0.95rem;';
    choiceContainer.appendChild(desc);

    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.style.cssText = 'display: flex; gap: 20px; width: 100%; justify-content: center;';

    const btnOptA = document.createElement('button');
    btnOptA.innerText = 'Sacar Goblin Nv. 1';
    btnOptA.className = 'btn warlord-choice-btn';
    btnOptA.style.cssText = 'padding: 12px 20px; font-family: "Cinzel", serif; font-size: 0.95rem; color: #fff; background: linear-gradient(135deg, #1a1a1a 0%, #2e0854 100%); border: 2px solid #9d4edd; border-radius: 8px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(157, 78, 221, 0.2);';
    btnOptA.addEventListener('mouseenter', () => {
      btnOptA.style.transform = 'scale(1.05)';
      btnOptA.style.boxShadow = '0 6px 20px rgba(157, 78, 221, 0.4)';
    });
    btnOptA.addEventListener('mouseleave', () => {
      btnOptA.style.transform = 'scale(1)';
      btnOptA.style.boxShadow = '0 4px 15px rgba(157, 78, 221, 0.2)';
    });
    btnOptA.addEventListener('click', () => {
      gameState.battlefield.goblins.push({
        ...DB.goblins[1],
        uid: Date.now() + Math.random(),
        currentHp: DB.goblins[1].hp,
        isHito: false
      });
      gameState.addLog(`⚠️ Ha aparecido un goblin de Nivel 1 (Opción A - Mesa Vacía).`);
      updateUI();
    });
    buttonsWrapper.appendChild(btnOptA);

    const btnOptB = document.createElement('button');
    btnOptB.innerText = gameState.currentHito > 5 ? 'Senda Completada' : `Desplegar Hito ${gameState.currentHito}`;
    btnOptB.className = 'btn warlord-choice-btn';
    btnOptB.style.cssText = 'padding: 12px 20px; font-family: "Cinzel", serif; font-size: 0.95rem; color: #fff; background: linear-gradient(135deg, #1a1a1a 0%, #d4af37 100%); border: 2px solid var(--gold); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.2);';
    if (gameState.currentHito > 5) {
      btnOptB.disabled = true;
      btnOptB.style.opacity = '0.5';
      btnOptB.style.cursor = 'not-allowed';
    }
    btnOptB.addEventListener('mouseenter', () => {
      if (!btnOptB.disabled) {
        btnOptB.style.transform = 'scale(1.05)';
        btnOptB.style.boxShadow = '0 6px 20px rgba(212, 175, 55, 0.4)';
      }
    });
    btnOptB.addEventListener('mouseleave', () => {
      btnOptB.style.transform = 'scale(1)';
      btnOptB.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.2)';
    });
    btnOptB.addEventListener('click', () => {
      const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;
      const hitoToDeploy = sendaHitos[gameState.currentHito - 1];

      if (gameState.deployHito()) {
        if (hitoToDeploy && hitoToDeploy.ruleDesc) {
          showHitoRuleNotification(hitoToDeploy);
        }
        updateUI();
      }
    });
    buttonsWrapper.appendChild(btnOptB);

    choiceContainer.appendChild(buttonsWrapper);
    goblinsContainer.appendChild(choiceContainer);
  }

  // Usamos el array original de la mesa para garantizar que el orden NO cambie
  gameState.battlefield.goblins.forEach(goblin => {
    const gobEl = document.createElement('div');
    gobEl.className = 'goblin-card';
    if (goblin.isHito) {
      gobEl.classList.add('goblin-hito');
    } else {
      const pLeader = gameState.players[gameState.currentPlayerIndex] || gameState.players[0];
      if (goblin.level < pLeader.level) {
        gobEl.classList.add('goblin-no-reward');
      }
    }
    gobEl.style.backgroundImage = `url('${goblin.image}')`;

    if (goblin.isDying) {
      gobEl.classList.add(goblin.gaveReward ? 'dying-reward' : 'dying');
      gobEl.innerHTML = `<div class="goblin-hp" style="background: var(--accent-red); color: white;">0</div>`;
    } else {
      const isInvulnerable = gameState.isGoblinInvulnerable(goblin);
      if (isInvulnerable) {
        gobEl.classList.add('invulnerable');
      }
      const badgeHTML = isInvulnerable 
        ? `<div class="goblin-invulnerable-badge" title="Invulnerable por Regla de Hito">🛡️</div>` 
        : '';
      gobEl.innerHTML = `<div class="goblin-hp">${goblin.currentHp}</div>${badgeHTML}`;

      // Comprobar si es un goblin nuevo para aplicarle la animación correspondiente
      if (!animatedGoblinUids.has(goblin.uid)) {
        animatedGoblinUids.add(goblin.uid);
        setTimeout(() => {
          if (goblin.isMutated) {
            gobEl.classList.add('goblin-mutation-active');
          } else {
            gobEl.classList.add('goblin-wobble-active');
          }
        }, 150); // 150ms después de aparecer en el DOM
      }

      if (!gameState.isMarketPhase) {
        gobEl.classList.add('selectable');
      }

      if (selectedGoblins.find(g => g.uid === goblin.uid)) {
        gobEl.classList.add('selected');
      }

      gobEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const index = selectedGoblins.findIndex(g => g.uid === goblin.uid);
        if (index !== -1) {
          selectedGoblins.splice(index, 1);
          gobEl.classList.remove('selected');
        } else {
          // Escudos de Carne (Senda de La Madre)
          if (gameState.activeSenda === 'la_madre' && !goblin.isDying) {
            const aliveGobs = gameState.battlefield.goblins.filter(g => !g.isDying);
            const minLevel = Math.min(...aliveGobs.map(g => g.level));
            if (goblin.level > minLevel) {
              alert(`🛡️ Escudos de Carne: ¡La Madre protege a sus crías!\n\nDebes eliminar primero a los Goblins de nivel inferior (Nivel ${minLevel}) antes de poder atacar a este Goblin de Nivel ${goblin.level}.`);
              return;
            }
          }

          selectedGoblins.push(goblin);
          gobEl.classList.add('selected');
        }
        const btn = document.getElementById('btn-confirm-attack');
        if (btn) btn.innerText = `Atacar Goblins (${selectedGoblins.length})`;
      });
    }

    goblinsContainer.appendChild(gobEl);
  });

  // Cleanup: eliminar del array los que ya han terminado la animación
  const hasDying = gameState.battlefield.goblins.some(g => g.isDying);
  if (hasDying && !window._dyingCleanupActive) {
    window._dyingCleanupActive = true;
    setTimeout(() => {
      gameState.battlefield.goblins = gameState.battlefield.goblins.filter(g => !g.isDying);
      window._dyingCleanupActive = false;
      renderBattlefield();
    }, 850);
  }
}

function doesEquipmentDealDamage(eq, value, asg) {
  if (!eq) return false;
  const effectStr = (eq.isBroken && eq.broken ? eq.broken.effect : eq.effect).toLowerCase();
  
  if (eq.id === 'corazon_elastico') {
    if (asg && asg.elasticDamage !== undefined && asg.elasticDamage !== null) {
      return asg.elasticDamage > 0;
    }
    return true;
  }
  if (['afilado', 'anadir_pinchos', 'oxidado', 'gema_regeneracion', 'drenar_justo'].includes(eq.id)) {
    return true;
  }
  if (eq.id === 'reforzado_pinchos') {
    return value % 2 === 0;
  }
  return effectStr.includes('daño');
}

let currentAssignments = {};
let interceptionAssignments = {};

function showElasticModal(dieId, dieValue, eqId, onConfirm) {
  const modal = document.getElementById('elastic-modal');
  const btnClose = document.getElementById('btn-close-elastic-x');
  const btnConfirm = document.getElementById('btn-confirm-elastic');
  const rangeInput = document.getElementById('range-elastic');
  const dieValSpan = document.getElementById('elastic-die-val');
  const dmgPreview = document.getElementById('elastic-dmg-preview');
  const healPreview = document.getElementById('elastic-heal-preview');

  dieValSpan.innerText = dieValue;
  rangeInput.max = dieValue;
  rangeInput.value = Math.floor(dieValue / 2);

  const updatePreviews = () => {
    const heal = parseInt(rangeInput.value);
    const dmg = dieValue - heal;
    dmgPreview.innerText = dmg;
    healPreview.innerText = heal;
  };

  updatePreviews();
  rangeInput.oninput = updatePreviews;

  btnConfirm.onclick = null;
  btnClose.onclick = null;
  const closeModal = () => {
    modal.classList.add('hidden');
  };

  btnClose.onclick = () => {
    closeModal();
  };

  btnConfirm.onclick = () => {
    closeModal();
    const heal = parseInt(rangeInput.value);
    const chosenDmg = dieValue - heal;
    onConfirm(chosenDmg);
  };

  modal.classList.remove('hidden');
}

function showCorrosionModal(pendingChoice) {
  const modal = document.getElementById('corrosion-modal');
  const messageEl = document.getElementById('corrosion-message');
  const listContainer = document.getElementById('corrosion-items-list');

  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.style.maxWidth = '1000px';
  }

  let previewImg = document.getElementById('corrosion-hover-preview');
  if (previewImg) {
    previewImg.remove();
  }

  const player = pendingChoice.player;
  messageEl.innerHTML = `<strong>${player.name}</strong> ha recibido da\u00F1o de un goblin. Debes elegir una carta de tu equipo equipado para romperla a causa del entorno de <strong>Corrosi\u00F3n</strong>.`;
  
  listContainer.innerHTML = '';
  listContainer.style.display = 'flex';
  listContainer.style.flexDirection = 'row';
  listContainer.style.flexWrap = 'wrap';
  listContainer.style.justifyContent = 'center';
  listContainer.style.alignItems = 'center';
  listContainer.style.gap = '20px';
  listContainer.style.maxHeight = '60vh';

  const breakable = player.equipped.filter(eq => eq.isActive && !eq.isBroken);
  
  breakable.forEach(eq => {
    const card = document.createElement('div');
    card.style.width = '180px';
    card.style.height = '252px';
    card.style.backgroundImage = `url('${eq.image}')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.style.borderRadius = '8px';
    card.style.border = '2px solid transparent';
    card.style.cursor = 'pointer';
    card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
    card.style.transition = 'transform 0.2s, border-color 0.2s, box-shadow 0.2s';
    card.title = eq.name;

    card.onmouseover = () => {
      card.style.transform = 'scale(1.05)';
      card.style.borderColor = 'var(--accent-red)';
      card.style.boxShadow = '0 0 15px rgba(239, 35, 60, 0.8)';
    };
    
    card.onmouseout = () => {
      card.style.transform = 'scale(1)';
      card.style.borderColor = 'transparent';
      card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
    };

    card.onclick = () => {
      eq.isBroken = true;
      eq.brokenAnimationPlayed = false;
      eq.brokenInCombatId = gameState.lastCombatId;
      gameState.addLog(`&#128736;&#65039; <strong>Corrosi\u00F3n:</strong> <strong>${player.name}</strong> elige romper su <strong>${eq.name}</strong>.`);
      
      gameState.pendingCorrosionChoice = null;
      modal.classList.add('hidden');
      
      if (pendingChoice.callback) {
        pendingChoice.callback();
      }

      if (!gameState.isRetaliationPhase && !gameState.isGameOver) {
        document.getElementById('global-event-overlay').classList.add('hidden');
        const evModal = document.querySelector('.event-modal');
        if (evModal) evModal.classList.remove('retaliation-theme');
        const evContainer = document.getElementById('event-choices-container');
        if (evContainer) evContainer.classList.remove('retaliation-layout');
      }

      updateUI();
    };

    listContainer.appendChild(card);
  });

  modal.classList.remove('hidden');
}

function renderCombatOverlay() {
  const overlay = document.getElementById('combat-overlay');
  const c = gameState.currentCombat;
  if (!c) {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');

  const goblinsContainer = document.getElementById('combat-goblins-container');
  goblinsContainer.innerHTML = '';

  const p = gameState.getCurrentPlayer();
  const isCrampPhase = c.needsCrampResolution;

  // Render Player Stats Header
  const statsContainer = document.getElementById('combat-player-stats');
  const expReq = { 1: 2, 2: 6, 3: 12, 4: 22 };
  const nextExp = expReq[p.level] || '-';
  if (statsContainer) {
    const isLowHP = p.hp <= (p.maxHp * 0.25);
    const combatRoles = ['guerrero', 'mago', 'protector'];
    const canUseRole = combatRoles.includes(p.role.id) && p.energy > 0;

    statsContainer.innerHTML = `
      <div style="font-size: 1.4rem; font-weight: bold; color: var(--gold); margin-bottom: 15px;">${p.name}</div>
      <div class="stats" style="display: flex; flex-direction: column; gap: 15px; font-size: 1.2rem;">
        <div class="stat hp ${isLowHP ? 'low-hp' : ''}" style="display: flex; align-items: center; gap: 10px; height: 24px;"><span style="display: flex; align-items: center; width: 24px; justify-content: center;">❤️</span> <span>Vida: <span>${p.hp}</span>/<span>${p.maxHp}</span></span></div>
        ${p.shield > 0 ? `<div class="stat shield" style="display: flex; align-items: center; gap: 10px; height: 24px; color: #33cc33;" title="Escudos del Protector"><span style="display: flex; align-items: center; width: 24px; justify-content: center;">🛡️</span> <span>Escudos: <span>${p.shield}</span></span></div>` : ''}
        <div class="stat gold" style="display: flex; align-items: center; gap: 10px; height: 24px;"><span style="display: flex; align-items: center; width: 24px; justify-content: center;">${COIN_SVG}</span> <span>Oro: <span>${p.mo}</span></span></div>
        <div class="stat energy" style="display: flex; align-items: center; gap: 10px; height: 24px; color: #00d2ff;" title="Energía del Rol"><span style="display: flex; align-items: center; width: 24px; justify-content: center;">⚡</span> <span>Energía: <span>${p.energy}</span></span></div>
      </div>
    `;
  }

  // Actualizar Botones del Sidebar para Fase de Calambre
  const btnResolve = document.getElementById('btn-resolve-combat');
  const btnCancel = document.getElementById('btn-cancel-combat');

  if (isCrampPhase) {
    btnResolve.innerText = "Lanzar dados rojos";
    btnResolve.style.background = 'linear-gradient(135deg, #ffcc00, #ff9900)';
    btnResolve.onclick = () => {
      c.needsCrampResolution = false;
      gameState.addLog(`⚡ <strong>${p.name}</strong> ha resuelto sus calambres.`);
      renderCombatOverlay();
    };
  } else {
    btnResolve.innerText = "Resolver Ataque";
    btnResolve.style.background = '';
    btnResolve.onclick = () => {
      // Automatización: Si solo hay un goblin, asignar automáticamente lo que falte (solo las que hacen daño)
      const combatGoblins = c.goblins;
      if (combatGoblins.length === 1) {
        const targetUid = combatGoblins[0].uid;
        for (let id in currentAssignments) {
          let eqObj = p.equipped.find(e => e.id === id);
          let asgs = currentAssignments[id];
          if (Array.isArray(asgs)) {
            asgs.forEach(a => {
              if (!a.isRole && !a.targetUid && doesEquipmentDealDamage(eqObj, a.value, a)) {
                a.targetUid = targetUid;
              }
            });
          } else {
            if (!asgs.isRole && !asgs.targetUid && doesEquipmentDealDamage(eqObj, asgs.value, asgs)) {
              asgs.targetUid = targetUid;
            }
          }
        }
      }

      // Validar que todo el equipo cargado que hace daño tiene un objetivo
      for (let eqId in currentAssignments) {
        let eqObj = p.equipped.find(e => e.id === eqId);
        let asgs = currentAssignments[eqId];
        const asgList = Array.isArray(asgs) ? asgs : [asgs];

        if (asgList.some(a => !a.isRole && !a.targetUid && doesEquipmentDealDamage(eqObj, a.value, a))) {
          alert("Asigna un objetivo a todas las cartas de ataque cargadas arrastrándolas sobre un Goblin.");
          return;
        }
      }

      const pBefore = gameState.getCurrentPlayer();
      const hpBefore = pBefore.hp;

      gameState.resolveCombat(currentAssignments, interceptionAssignments);

      const hpAfter = pBefore.hp;
      if (hpAfter < hpBefore) {
        const flash = document.createElement('div');
        flash.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(230, 57, 70, 0.55);
          pointer-events: none;
          z-index: 999999;
          transition: background 0.5s ease-out;
        `;
        document.body.appendChild(flash);
        flash.getBoundingClientRect(); // Forzar reflow
        flash.style.background = 'rgba(230, 57, 70, 0)';
        setTimeout(() => flash.remove(), 500);
      }

      document.getElementById('combat-overlay').classList.add('hidden');
      selectedGoblins = [];
      activeSelectedDieId = null;
      activeSelectedEquipId = null;
      document.querySelectorAll('.goblin-card').forEach(el => el.classList.remove('selectable', 'selected'));
      document.getElementById('btn-confirm-attack').innerText = `Atacar Goblins (0)`;
      updateUI();
    };
  }

  btnCancel.onclick = () => {
    gameState.cancelCombat();
    document.getElementById('combat-overlay').classList.add('hidden');
    selectedGoblins = [];
    activeSelectedDieId = null;
    activeSelectedEquipId = null;
    document.querySelectorAll('.goblin-card').forEach(el => el.classList.remove('selectable', 'selected'));
    document.getElementById('btn-confirm-attack').innerText = `Atacar Goblins (0)`;
    updateUI();
  };

  c.goblins.forEach(gob => {
    let gobWrapper = document.createElement('div');
    gobWrapper.className = 'goblin-combat-wrapper';

    // Goblin card
    let gobCard = document.createElement('div');
    gobCard.className = 'goblin-card';
    if (gob.isHito) {
      gobCard.classList.add('goblin-hito');
    } else {
      const pActive = gameState.players[gameState.currentPlayerIndex] || gameState.players[0];
      if (gob.level < pActive.level) {
        gobCard.classList.add('goblin-no-reward');
      }
    }
    gobCard.style.backgroundImage = `url('${gob.image}')`;
    const isInvulnerable = gameState.isGoblinInvulnerable(gob);
    if (isInvulnerable) {
      gobCard.classList.add('invulnerable');
    }
    const badgeHTML = isInvulnerable 
      ? `<div class="goblin-invulnerable-badge" title="Invulnerable por Regla de Hito">🛡️</div>` 
      : '';
    gobCard.innerHTML = `<div class="goblin-hp">${gob.currentHp}</div>${badgeHTML}`;

    // Drop zone logic for the goblin
    gobCard.addEventListener('dragover', (e) => e.preventDefault());
    gobCard.addEventListener('drop', (e) => {
      e.preventDefault();

      // 1. Intercepción con dados del jugador
      let dieId = e.dataTransfer.getData('text/plain');
      const dieData = c.playerDice.find(d => d.id === dieId);
      if (dieData) {
        // No permitir interceptar NADA si estamos en fase de calambre (primero asignar a equipo)
        if (isCrampPhase) return;
        
        if (gob.name === 'La Madre') {
          alert('🛡️ Los ataques de La Madre son Ininterceptables.');
          return;
        }

        // No permitir usar un dado con calambre después de su fase
        if (dieData.isCramped && !isCrampPhase) return;

        const playerDieVal = dieData.value;
        const goblinDice = c.dice.green[gob.uid].details.filter(d => d.type === 'die');

        // Inicializar array si no existe
        if (!interceptionAssignments[gob.uid]) interceptionAssignments[gob.uid] = [];

        // Buscar un dado del goblin que coincida y no esté interceptado
        let targetDieIndex = -1;
        for (let i = 0; i < goblinDice.length; i++) {
          const alreadyIntercepted = interceptionAssignments[gob.uid].some(asg => asg.goblinDieIndex === i);
          if (!alreadyIntercepted && goblinDice[i].val === playerDieVal) {
            targetDieIndex = i;
            break;
          }
        }

        if (targetDieIndex !== -1) {
          clearDieAssignment(dieId);
          clearInterception(dieId);

          if (!interceptionAssignments[gob.uid]) interceptionAssignments[gob.uid] = [];

          interceptionAssignments[gob.uid].push({
            dieId: dieId,
            value: playerDieVal,
            goblinDieIndex: targetDieIndex
          });
          dieData.assignedTo = `intercept-${gob.uid}-${targetDieIndex}`;
          renderCombatOverlay();
        } else {
          showInterceptionError(playerDieVal);
        }
        e.stopPropagation();
        return;
      }

      // 2. Asignación de equipo
      let sourceEqId = e.dataTransfer.getData('text/equipId');
      if (sourceEqId && currentAssignments[sourceEqId]) {
        let eqObj = p.equipped.find(e => e.id === sourceEqId);
        let asgs = currentAssignments[sourceEqId];
        let firstAsg = Array.isArray(asgs) ? asgs[0] : asgs;
        if (doesEquipmentDealDamage(eqObj, firstAsg.value, firstAsg)) {
          if (Array.isArray(asgs)) {
            asgs.forEach(a => a.targetUid = gob.uid);
          } else {
            asgs.targetUid = gob.uid;
          }
          renderCombatOverlay();
          e.stopPropagation();
        }
      }
    });

    // SISTEMA DE RESPALDO (TAP-TO-SELECT): Asignar dado seleccionado o equipo seleccionado al goblin al hacer clic
    gobCard.addEventListener('click', (e) => {
      if (activeSelectedDieId) {
        const dieData = c.playerDice.find(d => d.id === activeSelectedDieId);
        if (dieData) {
          if (isCrampPhase) return;
          
          if (gob.name === 'La Madre') {
            alert('🛡️ Los ataques de La Madre son Ininterceptables.');
            return;
          }

          if (dieData.isCramped && !isCrampPhase) return;

          const playerDieVal = dieData.value;
          const goblinDice = c.dice.green[gob.uid].details.filter(d => d.type === 'die');

          if (!interceptionAssignments[gob.uid]) interceptionAssignments[gob.uid] = [];

          let targetDieIndex = -1;
          for (let i = 0; i < goblinDice.length; i++) {
            const alreadyIntercepted = interceptionAssignments[gob.uid].some(asg => asg.goblinDieIndex === i);
            if (!alreadyIntercepted && goblinDice[i].val === playerDieVal) {
              targetDieIndex = i;
              break;
            }
          }

          if (targetDieIndex !== -1) {
            clearDieAssignment(activeSelectedDieId);
            clearInterception(activeSelectedDieId);

            if (!interceptionAssignments[gob.uid]) interceptionAssignments[gob.uid] = [];

            interceptionAssignments[gob.uid].push({
              dieId: activeSelectedDieId,
              value: playerDieVal,
              goblinDieIndex: targetDieIndex
            });
            dieData.assignedTo = `intercept-${gob.uid}-${targetDieIndex}`;
            activeSelectedDieId = null;
            renderCombatOverlay();
          } else {
            showInterceptionError(playerDieVal);
          }
          e.stopPropagation();
        }
      } else if (activeSelectedEquipId) {
        if (currentAssignments[activeSelectedEquipId]) {
          let asgs = currentAssignments[activeSelectedEquipId];
          if (Array.isArray(asgs)) {
            asgs.forEach(a => a.targetUid = gob.uid);
          } else {
            asgs.targetUid = gob.uid;
          }
          activeSelectedEquipId = null;
          renderCombatOverlay();
          e.stopPropagation();
        }
      }
    });

    let assignedEqContainer = document.createElement('div');
    assignedEqContainer.id = `assigned-${gob.uid}`;
    assignedEqContainer.className = 'goblin-assigned-equipment';

    // RESTAURAR ICONOS DE EQUIPO ASIGNADO
    for (let eqId in currentAssignments) {
      let asgData = currentAssignments[eqId];
      let firstAsg = Array.isArray(asgData) ? asgData[0] : asgData;

      if (firstAsg && firstAsg.targetUid === gob.uid) {
        let eqObj = p.equipped.find(eq => eq.id === eqId);
        if (eqObj) {
          let miniEl = document.createElement('div');
          miniEl.className = `mini-equip-icon mini-icon-${eqId}`;
          miniEl.style.backgroundImage = `url('${eqObj.image}')`;
          miniEl.title = `Asignado a ${gob.name}`;
          miniEl.draggable = true;
          miniEl.addEventListener('dragstart', (ev) => {
            ev.dataTransfer.setData('text/equipId', eqId);
          });
          assignedEqContainer.appendChild(miniEl);
        }
      }
    }

    // RESTAURAR ICONOS DE INTERCEPCIÓN
    const intAsgs = interceptionAssignments[gob.uid];
    if (intAsgs && Array.isArray(intAsgs)) {
      intAsgs.forEach(asg => {
        const dieData = c.playerDice.find(d => d.id === asg.dieId);
        if (dieData) {
          let interceptIcon = document.createElement('div');
          interceptIcon.className = `intercept-icon intercept-${asg.dieId}`;
          interceptIcon.innerHTML = `🛡️ ${asg.value}`;
          interceptIcon.style.display = 'inline-flex';
          interceptIcon.style.alignItems = 'center';
          interceptIcon.style.justifyContent = 'center';
          interceptIcon.className += ' ' + dieData.type;
          if (dieData.faces === 4) interceptIcon.classList.add('d4');
          interceptIcon.style.color = 'white';
          interceptIcon.style.border = '1px solid gold';
          interceptIcon.style.padding = '5px';
          interceptIcon.style.borderRadius = '5px';
          interceptIcon.style.margin = '2px';
          interceptIcon.style.cursor = 'pointer';
          interceptIcon.title = `Intercepción: Click para retirar (Anula dado index ${asg.goblinDieIndex})`;
          interceptIcon.onclick = (e) => {
            e.stopPropagation();
            clearInterception(asg.dieId);
          };
          assignedEqContainer.appendChild(interceptIcon);
        }
      });
    }

    // Green dice for this goblin (Ocultos en fase de calambre)
    let diceCont = document.createElement('div');
    diceCont.className = 'dice-container';
    diceCont.style.position = 'absolute';
    diceCont.style.top = '36%';
    diceCont.style.left = '0';
    diceCont.style.transform = 'translateY(-50%)';
    diceCont.style.width = '100%';
    diceCont.style.margin = '0';
    diceCont.style.padding = '8px 0';
    diceCont.style.background = 'rgba(0, 0, 0, 0.85)';
    diceCont.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.9)';
    diceCont.style.gap = '2px';
    diceCont.style.alignItems = 'center';

    if (!isCrampPhase && c.dice.green[gob.uid]) {
      c.dice.green[gob.uid].details.forEach((item, idx) => {
        let el = document.createElement('div');
        if (item.type === 'die') {
          el.className = `die green d${item.faces}`;
          el.id = `green-die-${gob.uid}-${idx}`;
          el.dataset.goblinUid = gob.uid;
          el.dataset.dieIndex = idx;
          // Marcar si está interceptado
          const isIntercepted = intAsgs && intAsgs.some(asg => asg.goblinDieIndex === idx);
          if (isIntercepted) el.classList.add('intercepted');

          el.innerText = item.val;
          el.style.width = '50px';
          el.style.height = '50px';
          el.style.fontSize = '1.8rem';
          el.style.borderRadius = '10px';
          el.style.boxShadow = '0 3px 8px rgba(0,0,0,0.9), inset 0 0 8px rgba(0,0,0,0.6)';
        } else {
          el.className = 'mod-green';
          el.innerText = (item.val >= 0 ? '+' : '') + item.val;
          el.style.fontSize = '1.2rem';
          el.style.padding = '2px 6px';
          el.style.background = 'rgba(0,0,0,0.7)';
          el.style.borderRadius = '4px';
          el.style.fontWeight = 'bold';
          if (item.isHitoRule) {
            el.style.color = '#ff4d4d';
            el.style.border = '1px solid #ff4d4d';
            el.style.boxShadow = '0 0 8px rgba(255, 77, 77, 0.4)';
            el.title = 'Regla Hito: +1 daño por cada goblin de nivel 1 vivo';
          } else {
            el.style.color = '#4CAF50';
          }
        }
        diceCont.appendChild(el);
      });
    }

    gobCard.appendChild(diceCont);

    gobWrapper.appendChild(gobCard);
    gobWrapper.appendChild(assignedEqContainer);
    goblinsContainer.appendChild(gobWrapper);
  });

  // Permitir desasignar equipo soltándolo en el fondo
  const combatMain = document.getElementById('combat-main');
  if (combatMain) {
    combatMain.addEventListener('dragover', (e) => e.preventDefault());
    combatMain.addEventListener('drop', (e) => {
      let eqId = e.dataTransfer.getData('text/equipId');
      if (eqId && currentAssignments[eqId]) {
        let asgData = currentAssignments[eqId];
        if (Array.isArray(asgData)) {
          asgData.forEach(a => a.targetUid = null);
        } else {
          asgData.targetUid = null;
        }

        // El renderCombatOverlay se encargará de limpiar los mini-iconos y resetear los slots
        renderCombatOverlay();
      }
    });
  }

  // Render Dados
  const dicePoolContainer = document.getElementById('combat-dice-pool');
  dicePoolContainer.innerHTML = '';
  c.playerDice.forEach(die => {
    // En fase de calambre, ocultar dados rojos y dados negros que no tengan calambre
    if (isCrampPhase && (die.type === 'red' || (die.type === 'black' && !die.isCramped))) return;

    // Fuera de la fase de calambre, ocultar dados con calambre no asignados (dados perdidos)
    if (!isCrampPhase && die.isCramped && !die.assignedTo) return;

    let dieEl = document.createElement('div');
    dieEl.className = `die ${die.type}`;
    if (die.faces === 4) dieEl.classList.add('d4');
    if (die.isStung) dieEl.classList.add('stung');
    if (die.isShaking) dieEl.classList.add('shaking');
    if (die.isCramped) dieEl.classList.add('cramped');

    dieEl.id = die.id;
    dieEl.innerText = die.value;
    dieEl.draggable = !die.assignedTo;
    dieEl.style.opacity = die.assignedTo ? '0.3' : '1';

    // Bloquear movimiento de dados con calambre si ya pasó la fase
    if (!isCrampPhase && die.isCramped) {
      dieEl.draggable = false;
      dieEl.style.opacity = die.assignedTo ? "1" : "0.3";
      dieEl.title = die.assignedTo ? "Calambre: Asignado" : "Calambre: Dado perdido";
    }

    dieEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', die.id);
    });

    if (die.assignedTo) {
      // No permitir desasignar calambre si ya pasó su fase
      if (die.isCramped && !isCrampPhase) {
        dieEl.style.cursor = 'default';
        dieEl.title = "Calambre: Asignación fija";
      } else {
        dieEl.style.cursor = 'pointer';
        dieEl.title = 'Click para desasignar';
        dieEl.onclick = () => {
          clearDieAssignment(die.id);
        };
      }
    } else if (!die.assignedTo && (!die.isCramped || isCrampPhase)) {
      // SISTEMA DE RESPALDO (TAP-TO-SELECT): Seleccionar dado para aplicarlo a un objetivo (incluso negros)
      dieEl.style.cursor = 'pointer';
      dieEl.title = 'Click para seleccionar dado';
      if (activeSelectedDieId === die.id) {
        dieEl.classList.add('die-selected');
      }
      dieEl.onclick = () => {
        if (activeSelectedDieId === die.id) {
          activeSelectedDieId = null;
          renderCombatOverlay();
        } else {
          activeSelectedDieId = die.id;
          activeSelectedEquipId = null; // Limpiar selección de equipo
          renderCombatOverlay();
        }
      };
    }
    let dieWrapper = document.createElement('div');
    dieWrapper.className = 'die-wrapper';
    dieWrapper.style.position = 'relative';

    if (die.type === 'black' && !die.rerolled && !die.assignedTo && (!die.isCramped || isCrampPhase)) {
      const rerollBtn = document.createElement('button');
      rerollBtn.className = 'die-reroll-icon';
      rerollBtn.innerHTML = '↻';
      rerollBtn.title = 'Relanzar dado negro';
      rerollBtn.onclick = (e) => {
        e.stopPropagation(); // Evitar seleccionar el dado
        dieEl.classList.add('die-spin');
        setTimeout(() => {
          let newVal = gameState.rerollDie(die.id);
          if (newVal) {
            dieEl.innerText = newVal;
          }
        }, 300);
        setTimeout(() => {
          renderCombatOverlay();
        }, 600);
      };
      dieWrapper.appendChild(rerollBtn);
    }

    if (die.rerolled) {
      let lock = document.createElement('div');
      lock.innerHTML = '🔒';
      lock.style.cssText = 'position: absolute; top: -5px; right: -5px; font-size: 0.8rem; background: #222; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gold); z-index: 10;';
      dieWrapper.appendChild(lock);
      dieEl.title = 'Dado bloqueado';
    }

    dieWrapper.appendChild(dieEl);
    dicePoolContainer.appendChild(dieWrapper);
  });

  function clearInterception(dieId, skipRender = false) {
    for (let gobUid in interceptionAssignments) {
      const initialLength = interceptionAssignments[gobUid].length;
      interceptionAssignments[gobUid] = interceptionAssignments[gobUid].filter(asg => asg.dieId !== dieId);

      if (interceptionAssignments[gobUid].length < initialLength) {
        let dieData = c.playerDice.find(d => d.id === dieId);
        if (dieData) dieData.assignedTo = null;
      }

      if (interceptionAssignments[gobUid].length === 0) {
        delete interceptionAssignments[gobUid];
      }
    }
    if (!skipRender) renderCombatOverlay();
  }

  function clearDieAssignment(dieId) {
    for (let eqId in currentAssignments) {
      let asgData = currentAssignments[eqId];
      if (Array.isArray(asgData)) {
        currentAssignments[eqId] = asgData.filter(a => a.dieId !== dieId);
        if (currentAssignments[eqId].length === 0) delete currentAssignments[eqId];
      } else if (asgData.dieId === dieId) {
        delete currentAssignments[eqId];
      }
    }
    clearInterception(dieId, true);

    let dieData = c.playerDice.find(d => d.id === dieId);
    if (dieData) dieData.assignedTo = null;

    renderCombatOverlay();
  }

  // Render Equipo para asignar
  const equipSlots = document.getElementById('combat-equipment-slots');
  equipSlots.innerHTML = '';

  // Contenedor para la carta de Rol y su botón (con dimensiones fijas para no empujar el layout)
  const roleContainer = document.createElement('div');
  roleContainer.className = 'equip-slot-container';
  roleContainer.style.position = 'relative';
  roleContainer.style.width = '180px';
  roleContainer.style.height = '250px';

  const combatRoles = ['guerrero', 'mago', 'protector'];
  const hasCombatRole = combatRoles.includes(p.role.id);

  // 1. Render Role Slot
  const roleSlot = document.createElement('div');
  roleSlot.id = `equip-slot-role`;
  roleSlot.className = `equip-slot ${hasCombatRole && p.energy > 0 ? 'role-ready' : ''}`;
  roleSlot.style.backgroundImage = `url('${p.role.image}')`;
  if (!hasCombatRole) roleSlot.style.borderColor = '#00d2ff'; // Azul para el rol
  roleSlot.innerHTML = `<div class="die-placeholder" data-id="role"></div>`;

  roleSlot.addEventListener('dragover', (e) => e.preventDefault());
  roleSlot.addEventListener('drop', (e) => {
    e.preventDefault();
    const dieId = e.dataTransfer.getData('text/plain');
    const dieData = c.playerDice.find(d => d.id === dieId);
    if (!dieData) return;

    clearDieAssignment(dieId);

    if (!currentAssignments['role']) currentAssignments['role'] = [];
    currentAssignments['role'].push({ dieId: dieId, value: dieData.value, isRole: true });

    dieData.assignedTo = 'role';
    renderCombatOverlay();
  });

  // SISTEMA DE RESPALDO (TAP-TO-SELECT): Asignar dado activo al rol al hacer clic
  roleSlot.addEventListener('click', (e) => {
    if (activeSelectedDieId) {
      const dieData = c.playerDice.find(d => d.id === activeSelectedDieId);
      if (!dieData) return;

      clearDieAssignment(activeSelectedDieId);

      if (!currentAssignments['role']) currentAssignments['role'] = [];
      currentAssignments['role'].push({ dieId: activeSelectedDieId, value: dieData.value, isRole: true });

      dieData.assignedTo = 'role';
      activeSelectedDieId = null;
      renderCombatOverlay();
      e.stopPropagation();
    }
  });

  // RESTAURAR ESTADO DE ROL
  const roleAsgs = currentAssignments['role'];
  if (roleAsgs && Array.isArray(roleAsgs)) {
    roleSlot.innerHTML = ''; // Limpiar para re-renderizar múltiples
    roleAsgs.forEach((asg, idx) => {
      const placeholder = document.createElement('div');
      placeholder.className = 'die-placeholder active';
      const dieData = c.playerDice.find(d => d.id === asg.dieId);
      if (dieData) {
        placeholder.innerText = dieData.value;
        placeholder.classList.add(dieData.type);
        if (dieData.faces === 4) placeholder.classList.add('d4');
        if (dieData.isStung) placeholder.classList.add('stung');
        if (dieData.isShaking) placeholder.classList.add('shaking');

        // Ajuste de posición si hay múltiples
        if (roleAsgs.length > 1) {
          placeholder.style.right = (15 + (idx * 40)) + 'px';
        }
        roleSlot.appendChild(placeholder);
      }
    });
  } else {
    roleSlot.innerHTML = `<div class="die-placeholder" data-id="role"></div>`;
  }
  roleContainer.appendChild(roleSlot);

  const energyPulse = p.energy > 0 ? 'energy-pulse' : '';
  const energyBadge = document.createElement('div');
  energyBadge.className = `role-energy-badge ${energyPulse}`;
  energyBadge.innerText = `⚡ ${p.energy}`;
  roleContainer.appendChild(energyBadge);

  // Añadir el botón posicionado de forma absoluta debajo de la carta de rol
  if (hasCombatRole) {
    const btnRole = document.createElement('button');
    btnRole.id = 'btn-combat-role';
    btnRole.className = 'btn primary';
    btnRole.style.position = 'absolute';
    btnRole.style.bottom = '-40px';
    btnRole.style.left = '50%';
    btnRole.style.transform = 'translateX(-50%)';
    btnRole.style.fontSize = '0.85rem';
    btnRole.style.padding = '6px 16px';
    btnRole.style.whiteSpace = 'nowrap';
    btnRole.style.zIndex = '10';
    if (p.energy <= 0) {
      btnRole.style.background = 'linear-gradient(135deg, #555, #777)';
    } else {
      btnRole.style.background = 'linear-gradient(135deg, #00d2ff, #3a7bd5)';
    }
    btnRole.innerText = `Usar Rol`;
    btnRole.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (p.energy <= 0) {
        alert(ROLE_NO_ENERGY_WARNING);
        return;
      }
      showTargetSelectionModal(gameState.currentPlayerIndex);
    };
    roleContainer.appendChild(btnRole);
  }

  equipSlots.appendChild(roleContainer);

  // 2. Render normal equipment slots
  p.equipped.filter(eq => eq.isActive).forEach((eq, index) => {
    const slot = document.createElement('div');
    slot.id = `equip-slot-${eq.id}`;
    slot.className = 'equip-slot';
    if (eq.isBroken) slot.classList.add('broken');
    slot.style.backgroundImage = `url('${eq.image}')`;
    slot.innerHTML = `<div class="die-placeholder" data-id="${eq.id}"></div>`;

    if (activeSelectedEquipId === eq.id) {
      slot.classList.add('equip-selected');
    }

    slot.addEventListener('dragover', (e) => e.preventDefault());
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      const dieId = e.dataTransfer.getData('text/plain');
      const dieData = c.playerDice.find(d => d.id === dieId);
      if (!dieData) return;

      if (!gameState.isValidDieForEquipment(dieData.value, eq)) {
        return;
      }

      clearDieAssignment(dieId);

      const extra = (eq.extra || '').toLowerCase();
      const isReusable = extra.includes('reutilizable');
      const maxUses = extra.includes('x3') ? 3 : (isReusable ? 6 : 1);

      if (maxUses === 1 && currentAssignments[eq.id] && currentAssignments[eq.id].length > 0) {
        const oldDieId = currentAssignments[eq.id][0].dieId;
        clearDieAssignment(oldDieId);
      }

      if (!currentAssignments[eq.id]) currentAssignments[eq.id] = [];

      if (currentAssignments[eq.id].length >= maxUses) {
        return;
      }

      if (eq.id === 'corazon_elastico') {
        showElasticModal(dieId, dieData.value, eq.id, (damageChosen) => {
          currentAssignments[eq.id].push({ dieId: dieId, value: dieData.value, targetUid: null, elasticDamage: damageChosen });
          dieData.assignedTo = eq.id;
          renderCombatOverlay();
        });
        return;
      }

      currentAssignments[eq.id].push({ dieId: dieId, value: dieData.value, targetUid: null, elasticDamage: null });
      dieData.assignedTo = eq.id;
      renderCombatOverlay();
    });

    // SISTEMA DE RESPALDO (TAP-TO-SELECT): Asignar dado activo al equipo o seleccionar equipo cargado al hacer clic
    slot.addEventListener('click', (e) => {
      if (activeSelectedDieId) {
        const dieData = c.playerDice.find(d => d.id === activeSelectedDieId);
        if (!dieData) return;

        if (!gameState.isValidDieForEquipment(dieData.value, eq)) return;

        clearDieAssignment(activeSelectedDieId);

        const extra = (eq.extra || '').toLowerCase();
        const isReusable = extra.includes('reutilizable');
        const maxUses = extra.includes('x3') ? 3 : (isReusable ? 6 : 1);

        if (maxUses === 1 && currentAssignments[eq.id] && currentAssignments[eq.id].length > 0) {
          const oldDieId = currentAssignments[eq.id][0].dieId;
          clearDieAssignment(oldDieId);
        }

        if (!currentAssignments[eq.id]) currentAssignments[eq.id] = [];

        if (currentAssignments[eq.id].length >= maxUses) return;

        if (eq.id === 'corazon_elastico') {
          const curDieId = activeSelectedDieId;
          const curDieVal = dieData.value;
          activeSelectedDieId = null;

          showElasticModal(curDieId, curDieVal, eq.id, (damageChosen) => {
            currentAssignments[eq.id].push({ dieId: curDieId, value: curDieVal, targetUid: null, elasticDamage: damageChosen });
            dieData.assignedTo = eq.id;
            renderCombatOverlay();
          });
          e.stopPropagation();
          return;
        }

        currentAssignments[eq.id].push({ dieId: activeSelectedDieId, value: dieData.value, targetUid: null, elasticDamage: null });
        dieData.assignedTo = eq.id;
        activeSelectedDieId = null;
        renderCombatOverlay();
        e.stopPropagation();
      } else {
        const asgs = currentAssignments[eq.id];
        if (asgs && asgs.length > 0) {
          const eqObj = p.equipped.find(e => e.id === eq.id);
          const dealsDamage = doesEquipmentDealDamage(eqObj, asgs[0].value, asgs[0]);
          if (!dealsDamage) {
            e.stopPropagation();
            return;
          }
          if (activeSelectedEquipId === eq.id) {
            activeSelectedEquipId = null;
            renderCombatOverlay();
          } else {
            activeSelectedEquipId = eq.id;
            activeSelectedDieId = null; // Limpiar selección de dado
            renderCombatOverlay();
          }
          e.stopPropagation();
        }
      }
    });

    // RESTAURAR ESTADO DE EQUIPO
    const asgs = currentAssignments[eq.id];
    if (asgs && Array.isArray(asgs)) {
      slot.innerHTML = '';
      asgs.forEach((asg, idx) => {
        const placeholder = document.createElement('div');
        placeholder.className = 'die-placeholder active';
        const dieData = c.playerDice.find(d => d.id === asg.dieId);
        if (dieData) {
          placeholder.innerText = dieData.value;
          placeholder.classList.add(dieData.type);
          if (dieData.faces === 4) placeholder.classList.add('d4');
          if (dieData.isStung) placeholder.classList.add('stung');
          if (dieData.isShaking) placeholder.classList.add('shaking');

          // Ajuste de posición si hay múltiples
          if (asgs.length > 1) {
            placeholder.style.top = (15 + (idx * 55)) + 'px';
          }
          slot.appendChild(placeholder);
        }
      });

      // El primer dado del equipo decide si la carta está "cargada" para ser arrastrada al objetivo
      // (En este juego, toda la carta se asigna a un objetivo)
      if (asgs.length > 0) {
        slot.classList.add('loaded');
        const eqObj = p.equipped.find(e => e.id === eq.id);
        const dealsDamage = doesEquipmentDealDamage(eqObj, asgs[0].value, asgs[0]);
        if (dealsDamage) {
          slot.draggable = true;
          slot.addEventListener('dragstart', (ev) => {
            ev.dataTransfer.setData('text/equipId', eq.id);
          });
          if (asgs.some(a => a.targetUid)) slot.style.opacity = '0.5';
        } else {
          slot.draggable = false;
          slot.style.cursor = 'default';
        }
      }
    }

    equipSlots.appendChild(slot);
  });

  TutorialManager.evaluateSituation();
}

// El control de btn-cancel-combat y btn-resolve-combat se gestiona íntegramente
// dentro de renderCombatOverlay para soportar las fases de Calambre.

let prevPlayerStats = [];

function renderPlayer() {
  playersContainer.innerHTML = '';
  const currentPlayerIdx = gameState.currentPlayerIndex;

  gameState.players.forEach((p, index) => {
    const isCurrent = index === currentPlayerIdx;

    // Obtener estadísticas previas para comparar
    const prev = prevPlayerStats[index] || {};
    const getPulseClass = (current, previous) => (previous !== undefined && current !== previous) ? 'pulse-stat' : '';

    const hpPulse = getPulseClass(p.hp, prev.hp);
    const moPulse = getPulseClass(p.mo, prev.mo);
    const energyPulse = getPulseClass(p.energy, prev.energy);
    const pexPulse = getPulseClass(p.pex, prev.pex);
    const levelPulse = getPulseClass(p.level, prev.level);
    const blocksPulse = getPulseClass(gameState.getPlayerBlocks(p), prev.blocks);

    const currentBlocks = gameState.getPlayerBlocks(p);
    const maxBlocks = DB.playerLevels[p.level - 1].blocks;
    const isOverweight = currentBlocks >= maxBlocks;

    // Generar HTML del equipo
    let eqHTML = '';
    p.equipped.forEach((eq, eqIdx) => {
      const currentCombatId = gameState.lastCombatId || 0;
      const justBroken = eq.isBroken && eq.brokenInCombatId === currentCombatId && !eq.brokenAnimationPlayed;

      let extraStyle = '';
      let justBrokenClass = '';
      if (justBroken) {
        justBrokenClass = 'just-broken';
        extraStyle = 'transform: rotate(0deg); transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);';
      } else if (eq.isBroken) {
        extraStyle = 'transform: rotate(180deg);';
      }

      let activeClass = eq.isActive ? '' : 'inactive';

      const canRepair = eq.isBroken &&
        p.mo >= 1 &&
        gameState.lastActionWasCombat &&
        currentCombatId > 0 &&
        eq.brokenInCombatId !== currentCombatId &&
        eq.usedInCombatId === currentCombatId;
      const repairBtnHTML = canRepair ? `<button class="btn primary repair-btn" style="position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%) rotate(180deg); font-size: 0.75rem; padding: 4px 8px; z-index: 20;">Reparar</button>` : '';
      let repairableClass = canRepair ? 'can-repair-glow' : '';

      eqHTML += `<div class="equipment-card ${activeClass} ${justBrokenClass} ${repairableClass}" 
                      data-player-index="${index}" 
                      data-eq-index="${eqIdx}" 
                      style="background-image: url('${eq.image}'); ${extraStyle}">
                      ${!eq.isActive ? '<div class="inactive-overlay">📦</div>' : ''}
                      ${repairBtnHTML}
                 </div>`;
    });

    let statusHTML = '';
    if (p.shield > 0) {
      statusHTML += `<div class="status-icon escudo" title="Escudos: ${p.shield}">${SHIELD_SVG} <span>${p.shield}</span></div>`;
    }
    if (p.statusEffects.escozor > 0) {
      statusHTML += `<div class="status-icon escozor" title="Escozor: ${p.statusEffects.escozor}">&#128293; <span>${p.statusEffects.escozor}</span></div>`;
    }
    if (p.statusEffects.eliminaRojo > 0) {
      statusHTML += `<div class="status-icon elimina-rojo" style="background: #ef233c; border-color: #d90429;" title="Dado rojo anulado: ${p.statusEffects.eliminaRojo}">&#127922;&#10060; <span>${p.statusEffects.eliminaRojo}</span></div>`;
    }
    if (p.statusEffects.calambre > 0) {
      statusHTML += `<div class="status-icon calambre" title="Calambre: ${p.statusEffects.calambre}">&#9889; <span>${p.statusEffects.calambre}</span></div>`;
    }
    if (p.statusEffects.tembleque > 0) {
      statusHTML += `<div class="status-icon tembleque" title="Tembleque: ${p.statusEffects.tembleque}">&#10052; <span>${p.statusEffects.tembleque}</span></div>`;
    }

    const expReq = { 1: 2, 2: 6, 3: 12, 4: 22 };
    const nextExp = expReq[p.level] || '-';
    const isLowHP = p.hp <= (p.maxHp * 0.25);

    let canUseRole = false;
    if (isCurrent && p.energy > 0) {
      const rId = p.role.id;
      if (rId === 'guerrero') {
        if (gameState.currentCombat) {
          canUseRole = gameState.currentCombat.goblins.some(g => !g.isDying);
        } else {
          canUseRole = gameState.battlefield.goblins.some(g => p.goblinsFoughtThisTurn && p.goblinsFoughtThisTurn.includes(g.uid) && !g.isDying);
        }
      } else if (rId === 'mago') {
        canUseRole = gameState.battlefield.goblins.some(g => g.currentHp > 1 && !g.isDying);
      } else if (rId === 'protector') {
        canUseRole = true;
      } else if (rId === 'sanador') {
        canUseRole = gameState.players.some(pl => pl.hp < pl.maxHp && (pl.id === p.id ? p.energy >= 1 : p.energy >= 2));
      } else if (rId === 'curandero') {
        canUseRole = gameState.players.some(pl => pl.equipped.some(eq => eq.isBroken) && (pl.id === p.id ? p.energy >= 1 : p.energy >= 2));
      } else if (rId === 'ladron') {
        canUseRole = true;
      }
    }

    const isDead = p.hp <= 0;
    const activePlayer = gameState.getCurrentPlayer();
    const canRevive = isDead && !isCurrent && activePlayer && activePlayer.hp >= 2 && !gameState.isMarketPhase && !gameState.currentCombat;
    
    let reviveBtnHTML = '';
    if (canRevive) {
        reviveBtnHTML = `
        <button class="btn revive-btn" data-target-id="${p.id}" style="
            width: 120px; 
            height: 168px; 
            background: linear-gradient(135deg, #1f6b45, #2ecc71); 
            color: white; 
            border: 2px solid var(--gold); 
            border-radius: 8px; 
            cursor: pointer; 
            box-shadow: 0 0 15px rgba(46, 204, 113, 0.6); 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            font-family: 'Cinzel', serif;
            font-size: 1.2rem;
            text-shadow: 0 2px 4px rgba(0,0,0,0.8);
            transition: transform 0.2s;
            flex-shrink: 0;
            margin-right: 5px;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <span style="font-size: 3rem; margin-bottom: 10px;">&#10084;&#65039;</span>
            Dar Vida
        </button>`;
    }

    const panelHTML = `
      <div class="player-panel ${isCurrent ? 'active-turn' : ''} ${isDead ? 'player-dead' : ''}">
        <div class="player-hud-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 8px; margin-bottom: 8px; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 15px; overflow: hidden;">
                <h3 style="font-size: 1.2rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 80px; max-width: 140px;">${p.name}</h3>
                <div class="status-effects-container">${statusHTML}</div>
            </div>
            <div class="stats">
                <div class="stat hp ${isLowHP ? 'low-hp' : ''}" title="Puntos de Vida">&#10084;&#65039; <span class="${hpPulse}">${p.hp}</span>/<span>${p.maxHp}</span></div>
                <div class="stat gold" title="Monedas">${COIN_SVG} <span class="${moPulse}">${p.mo}</span></div>
                <div class="stat blocks" title="Carga de Equipo" style="${isOverweight ? 'color: var(--accent-red);' : ''}">${SACK_SVG} <span class="${blocksPulse}">${currentBlocks}</span>/<span>${maxBlocks}</span></div>
            </div>
        </div>
        
        <div class="player-dashboard">
            <div style="display: flex; flex-direction: column; gap: 5px; align-items: center; height: 100%;">
                <div class="player-role ${canUseRole ? 'role-ready' : ''}" 
                     data-player-index="${index}"
                     style="background-image: url('${p.role.image.replace('rol_', 'mini_rol_')}'); background-size: cover; background-position: left; cursor: ${isCurrent ? 'pointer' : 'default'};">
                     <div class="role-energy-badge ${energyPulse}">⚡ ${p.energy}</div>
                </div>
            </div>
            <div class="player-equipment">
                ${reviveBtnHTML}
                ${eqHTML}
            </div>
        </div>
      </div>
    `;

    const panelDiv = document.createElement('div');
    panelDiv.innerHTML = panelHTML;
    playersContainer.appendChild(panelDiv.firstElementChild);
    const lastPanel = playersContainer.lastElementChild;

    // Eventos para las cartas de equipo (toggle y reparar)
    const cards = lastPanel.querySelectorAll('.equipment-card');
    cards.forEach(cardEl => {
      const repairBtn = cardEl.querySelector('.repair-btn');
      if (repairBtn) {
        repairBtn.onclick = (e) => {
          e.stopPropagation();
          const pIdx = parseInt(cardEl.dataset.playerIndex);
          const eqIdx = parseInt(cardEl.dataset.eqIndex);
          const playerObj = gameState.players[pIdx];
          const eqObj = playerObj.equipped[eqIdx];
          if (playerObj.mo >= 1 && eqObj.isBroken) {
            playerObj.mo -= 1;
            eqObj.isBroken = false;
            eqObj.brokenAnimationPlayed = false;
            gameState.addLog(`🛠️ <strong>${playerObj.name}</strong> pagó 1 mo para reparar <strong>${eqObj.name}</strong>.`);
            updateUI();
          }
        };
      }

      cardEl.onclick = () => {
        const pIdx = parseInt(cardEl.dataset.playerIndex);
        const eqIdx = parseInt(cardEl.dataset.eqIndex);
        const res = gameState.toggleEquipment(pIdx, eqIdx);

        if (res === "OVERWEIGHT") {
          alert("¡DEMASIADO PESO! No puedes equipar este objeto sin quitar otro antes.");
        } else if (res === "DUPLICATE_ACTIVE") {
          alert("¡OBJETO DUPLICADO! <br>Ya tienes un objeto idéntico activo. Desactiva el actual si quieres equipar este.");
        } else {
          updateUI();
        }
      };
    });

    // Evento para la carta de rol
    const roleCard = lastPanel.querySelector('.player-role');
    if (roleCard) {
      roleCard.onclick = () => {
        const pIdx = parseInt(roleCard.dataset.playerIndex);
        if (pIdx !== gameState.currentPlayerIndex) return;

        const p = gameState.players[pIdx];
        const roleId = p.role.id;

        if (p.energy <= 0) {
          alert(ROLE_NO_ENERGY_WARNING);
          return;
        }

        if (roleId === 'guerrero' && !gameState.currentCombat) {
          const validGobs = gameState.battlefield.goblins.filter(g => p.goblinsFoughtThisTurn && p.goblinsFoughtThisTurn.includes(g.uid) && !g.isDying);
          if (validGobs.length === 0) {
            alert("El Guerrero solo puede atacar con su habilidad a Goblins con los que haya combatido durante este mismo turno.");
            return;
          }
        }

        // Si solo hay un jugador, aplicar a sí mismo directamente (excepto Mago y Guerrero que atacan goblins y Curandero con varias roturas)
        if (gameState.players.length === 1 && roleId !== 'mago' && roleId !== 'guerrero') {
          if (roleId === 'curandero') {
            const brokenItems = p.equipped.filter(eq => eq.isBroken);
            if (brokenItems.length > 1) {
              // Si hay varias, abrir modal para elegir
              showTargetSelectionModal(pIdx);
              return;
            } else if (brokenItems.length === 0) {
              alert(NO_BROKEN_EQUIP_ALERT);
              return;
            }
            // Si solo hay una, aplicar directamente
          }

          const res = gameState.useRoleAbility(pIdx, pIdx);
          if (res === true) {
            updateUI();
          } else if (res === "NOT_ENOUGH_ENERGY") {
            alert(NO_ENERGY_ALERT);
          } else if (res === false) {
            if (roleId === 'sanador' && p.hp >= p.maxHp) {
              alert("Ya tienes la vida al máximo.");
            } else if (roleId === 'curandero') {
              alert(NO_BROKEN_EQUIP_ALERT);
            }
          }
          return;
        }

        // Lógica existente para múltiples jugadores (abre el modal)
        const result = gameState.useRoleAbility(pIdx);

        if (result === "NEED_TARGET") {
          showTargetSelectionModal(pIdx);
        } else if (result === "NOT_ENOUGH_ENERGY") {
          alert(NO_ENERGY_ALERT);
        } else if (result === true) {
          updateUI();
        }
      };
    }

    const reviveBtn = lastPanel.querySelector('.revive-btn');
    if (reviveBtn) {
      reviveBtn.onclick = () => {
        const targetId = parseInt(reviveBtn.dataset.targetId);
        const activePlayer = gameState.getCurrentPlayer();
        const targetPlayer = gameState.players.find(pl => pl.id === targetId);
        
        if (!activePlayer || !targetPlayer || activePlayer.hp < 2) return;
        
        const maxGive = Math.floor(activePlayer.hp / 2);
        
        const modal = document.getElementById('revive-modal');
        const slider = document.getElementById('revive-slider');
        const targetHpEl = document.getElementById('revive-target-hp');
        const donorHpEl = document.getElementById('revive-donor-hp');
        const targetNameEl = document.getElementById('revive-target-name');
        const donorNameEl = document.getElementById('revive-donor-name');
        const btnCancel = document.getElementById('btn-cancel-revive');
        const btnConfirm = document.getElementById('btn-confirm-revive');
        
        targetNameEl.innerText = targetPlayer.name;
        donorNameEl.innerText = activePlayer.name;
        slider.max = maxGive;
        slider.value = 1;
        
        const updateHpPreview = () => {
            const amount = parseInt(slider.value, 10);
            targetHpEl.innerText = targetPlayer.hp + amount;
            donorHpEl.innerText = activePlayer.hp - (amount * 2);
        };
        
        slider.oninput = updateHpPreview;
        updateHpPreview();
        
        btnCancel.onclick = () => {
            modal.classList.add('hidden');
        };
        
        btnConfirm.onclick = () => {
            modal.classList.add('hidden');
            const amount = parseInt(slider.value, 10);
            const cost = amount * 2;
            activePlayer.hp -= cost;
            targetPlayer.hp += amount;
            gameState.addLog(`&#10084;&#65039; <strong>${activePlayer.name}</strong> sacrificó ${cost} PV para darle ${amount} PV a <strong>${targetPlayer.name}</strong>.`);
            
            if (activePlayer.hp <= 0) {
              gameState.addLog(`&#128128; <strong>${activePlayer.name}</strong> ha caído inconsciente por el esfuerzo.`);
              if (!gameState.checkGameOver()) {
                gameState.nextTurn();
              }
            }
            updateUI();
        };
        
        modal.classList.remove('hidden');
      };
    }

    // Actualizar historial de stats para el próximo render
    prevPlayerStats[index] = { hp: p.hp, mo: p.mo, energy: p.energy, pex: p.pex, level: p.level, blocks: currentBlocks };
  });

  setTimeout(() => {
    document.querySelectorAll('.equipment-card.just-broken').forEach(card => {
      card.style.transform = 'rotate(180deg)';
      card.classList.remove('just-broken');
      const pIdx = card.dataset.playerIndex;
      const eqIdx = card.dataset.eqIndex;
      if (gameState.players[pIdx] && gameState.players[pIdx].equipped[eqIdx]) {
        gameState.players[pIdx].equipped[eqIdx].brokenAnimationPlayed = true;
      }
    });
  }, 100);
}

window.showTargetSelectionModal = function (playerIndex) {
  const p = gameState.players[playerIndex];
  const modal = document.getElementById('target-modal');
  const title = document.getElementById('target-modal-title');
  const desc = document.getElementById('target-modal-desc');
  const options = document.getElementById('target-modal-options');

  title.innerText = `Habilidad: ${p.role.name}`;
  desc.innerText = p.role.effect;
  options.innerHTML = '';

  const roleId = p.role.id;

  // Clase específica para el layout del curandero
  const modalContent = modal.querySelector('.modal-content');
  if (roleId === 'curandero') {
    options.classList.add('curandero-layout');
    modalContent.classList.add('wide-modal');
  } else {
    options.classList.remove('curandero-layout');
    modalContent.classList.remove('wide-modal');
  }

  // Visor de Energía Actual del Jugador (Visible para todos)
  const energyVisor = document.createElement('div');
  energyVisor.className = 'modal-energy-visor';
  energyVisor.innerHTML = `
    <span>TU ENERGÍA:</span>
    <span class="energy-val" style="font-size: 1.5rem;">${p.energy} ⚡</span>
  `;
  options.appendChild(energyVisor);

  // LÓGICA ESPECIAL PARA CURANDERO (Mostrar cartas rotas)
  if (roleId === 'curandero') {
    desc.innerHTML = `Selecciona una carta equipada para <strong>repararla</strong>.<br><small>(Coste: 1⚡ Propio / 2⚡ Aliado)</small>`;

    let anyBroken = false;
    gameState.players.forEach((targetP, targetIdx) => {
      const brokenOfThisPlayer = targetP.equipped.filter(eq => eq.isBroken);

      if (brokenOfThisPlayer.length > 0) {
        anyBroken = true;
        const isSelf = targetIdx === playerIndex;
        const cost = isSelf ? 1 : 2;

        // Contenedor por jugador
        const playerGroup = document.createElement('div');
        playerGroup.className = 'player-repair-group';
        playerGroup.innerHTML = `
          <div class="repair-group-header">
            <div class="repair-group-title">${isSelf ? 'TU EQUIPO' : targetP.name.toUpperCase()}</div>
            <div class="repair-group-cost ${p.energy < cost ? 'insufficient' : ''}">Coste: ${cost}⚡</div>
          </div>
        `;

        const cardsGrid = document.createElement('div');
        cardsGrid.className = 'repair-cards-grid';

        targetP.equipped.forEach((eq, eqIdx) => {
          if (eq.isBroken) {
            const card = document.createElement('div');
            card.className = `equipment-card ${p.energy < cost ? 'disabled' : ''}`;
            card.style.backgroundImage = `url('${eq.image}')`;
            card.style.width = '120px';
            card.style.height = '180px';
            card.style.cursor = p.energy >= cost ? 'pointer' : 'not-allowed';

            card.onclick = () => {
              if (p.energy < cost) return;
              gameState.useRoleAbility(playerIndex, targetIdx, eqIdx);
              updateUI();
              if (p.energy > 0) showTargetSelectionModal(playerIndex);
              else modal.classList.add('hidden');
            };
            cardsGrid.appendChild(card);
          }
        });

        playerGroup.appendChild(cardsGrid);
        options.appendChild(playerGroup);
      }
    });

    if (!anyBroken) {
      options.innerHTML = '<p style="color:#ccc; padding: 20px;">No hay equipo roto en la mesa.</p>';
    }
  } else if (roleId === 'guerrero' || roleId === 'mago') {
    // LÓGICA PARA GUERRERO / MAGO (Atacar Goblins)
    desc.innerHTML = `Selecciona un Goblin para infligirle <strong>1 daño directo</strong>.<br><small>(Coste: 1⚡)</small>`;

    let allGoblins = [];
    if (roleId === 'mago') {
      allGoblins = gameState.battlefield.goblins;
    } else { // guerrero
      if (gameState.currentCombat) {
        allGoblins = gameState.currentCombat.goblins;
      } else {
        allGoblins = gameState.battlefield.goblins.filter(g => p.goblinsFoughtThisTurn && p.goblinsFoughtThisTurn.includes(g.uid));
      }
    }
    const activeGoblins = allGoblins.filter(g => !g.isDying);

    if (activeGoblins.length === 0) {
      options.innerHTML = '<p style="color:#ccc; padding: 20px;">No hay goblins activos a los que atacar.</p>';
    } else {
      const gobGrid = document.createElement('div');
      gobGrid.className = 'others-grid';
      gobGrid.style.justifyContent = 'center';

      activeGoblins.forEach(gob => {
        const isInCombat = gameState.currentCombat && gameState.currentCombat.goblins.some(cg => cg.uid === gob.uid);
        const isMagoRestricted = (roleId === 'mago' && gob.currentHp === 1);
        const gbtn = document.createElement('button');
        gbtn.className = 'target-btn other-btn';
        if (p.energy < 1 || isMagoRestricted) gbtn.classList.add('disabled');

        gbtn.innerHTML = `
          <div class="target-name">⚔️ ${gob.name || ('Goblin L' + gob.level)}</div>
          <div class="target-stats">❤️ Vida: ${gob.currentHp}</div>
          <div class="target-desc">${isMagoRestricted ? '<span style="color:#ff4d4d">El Mago no puede rematar a un goblin</span>' : 'Infligir 1 daño directo'}</div>
          <div class="target-cost ${p.energy < 1 ? 'insufficient' : ''}">COSTE: 1⚡</div>
        `;

        gbtn.onclick = () => {
          if (p.energy < 1 || isMagoRestricted) return;
          gameState.useRoleAbility(playerIndex, gob.uid);
          updateUI();
          if (p.energy > 0) showTargetSelectionModal(playerIndex);
          else modal.classList.add('hidden');
        };
        gobGrid.appendChild(gbtn);
      });
      options.appendChild(gobGrid);
    }
  } else {
    // LÓGICA NORMAL (Sanador, Ladrón, Protector)
    // El visor de energía ya se añadió arriba

    // Botón para SI MISMO (Coste 1)
    const hasBrokenSelf = p.equipped.some(e => e.isBroken);
    const isSanadorFullSelf = (p.role.id === 'sanador' && p.hp >= p.maxHp);
    const isCuranderoFullSelf = (p.role.id === 'curandero' && !hasBrokenSelf);
    const isDisabledSelf = (p.energy < 1 || isSanadorFullSelf || isCuranderoFullSelf);

    let selfDesc = 'Uso personal';
    if (p.role.id === 'sanador') {
      selfDesc = isSanadorFullSelf ? 'VIDA AL MÁXIMO' : '❤️ Curar 1 PV a ti mismo';
    } else if (p.role.id === 'curandero') {
      selfDesc = isCuranderoFullSelf ? 'EQUIPO INTACTO' : '🛠️ Reparar todo tu equipo roto';
    } else if (p.role.id === 'protector') {
      selfDesc = '🛡️ Generar +1 Escudo de armadura';
    } else if (p.role.id === 'ladron') {
      selfDesc = `${COIN_SVG} Obtener 1 Moneda de oro`;
    }

    const btnSelf = document.createElement('button');
    btnSelf.className = 'target-btn self-btn';
    if (isDisabledSelf) btnSelf.classList.add('disabled');

    btnSelf.innerHTML = `
    <div class="target-name">✨ A TI MISMO</div>
    <div class="target-stats">❤️ ${p.hp}/${p.maxHp} ${COIN_SVG} ${p.mo}</div>
    <div class="target-desc">${selfDesc}</div>
    <div class="target-cost ${p.energy < 1 ? 'insufficient' : ''}">COSTE: 1⚡</div>
  `;
    btnSelf.onclick = () => {
      if (isDisabledSelf) return;
      gameState.useRoleAbility(playerIndex, playerIndex);
      updateUI();
      if (p.energy > 0) {
        showTargetSelectionModal(playerIndex);
      } else {
        modal.classList.add('hidden');
      }
    };
    options.appendChild(btnSelf);

    // Sección para OTROS (Coste 2)
    if (gameState.players.length > 1) {
      const divOthers = document.createElement('div');
      divOthers.className = 'others-section';
      divOthers.innerHTML = '<div class="section-divider"><span>AYUDAR A COMPAÑEROS</span></div>';

      const othersContainer = document.createElement('div');
      othersContainer.className = 'others-grid';

      gameState.players.forEach((otherP, otherIdx) => {
        if (otherIdx !== playerIndex) {
          const hasBrokenOther = otherP.equipped.some(e => e.isBroken);
          const isSanadorFullOther = (p.role.id === 'sanador' && otherP.hp >= otherP.maxHp);
          const isCuranderoFullOther = (p.role.id === 'curandero' && !hasBrokenOther);
          const isDisabledOther = (p.energy < 2 || isSanadorFullOther || isCuranderoFullOther);

          let otherDesc = 'Ayudar a compañero';
          if (p.role.id === 'sanador') {
            otherDesc = isSanadorFullOther ? 'VIDA AL MÁXIMO' : `❤️ Curar 1 PV a ${otherP.name}`;
          } else if (p.role.id === 'curandero') {
            otherDesc = isCuranderoFullOther ? 'EQUIPO INTACTO' : `🛠️ Reparar equipo roto de ${otherP.name}`;
          } else if (p.role.id === 'protector') {
            otherDesc = `🛡️ Otorgar +1 Escudo a ${otherP.name}`;
          } else if (p.role.id === 'ladron') {
            otherDesc = `${COIN_SVG} Dar 1 Moneda a ${otherP.name}`;
          }

          const obtn = document.createElement('button');
          obtn.className = 'target-btn other-btn';
          if (isDisabledOther) {
            obtn.classList.add('disabled');
          }

          obtn.innerHTML = `
          <div class="target-name">🤝 ${otherP.name}</div>
          <div class="target-stats">❤️ ${otherP.hp}/${otherP.maxHp} ${COIN_SVG} ${otherP.mo}</div>
          <div class="target-desc">${otherDesc}</div>
          <div class="target-cost ${p.energy < 2 ? 'insufficient' : ''}">COSTE: 2⚡</div>
        `;

          obtn.onclick = () => {
            if (isDisabledOther) return;
            gameState.useRoleAbility(playerIndex, otherIdx);
            updateUI();
            if (p.energy > 0) {
              showTargetSelectionModal(playerIndex);
            } else {
              modal.classList.add('hidden');
            }
          };
          othersContainer.appendChild(obtn);
        }
      });
      divOthers.appendChild(othersContainer);
      options.appendChild(divOthers);
    }

  }

  // Botón de cierre (Para todos los roles)
  const btnClose = document.createElement('button');
  btnClose.className = 'btn secondary';
  btnClose.style.marginTop = '20px';
  btnClose.style.width = '100%';
  btnClose.innerText = 'CERRAR';
  btnClose.onclick = () => modal.classList.add('hidden');
  options.appendChild(btnClose);

  modal.classList.remove('hidden');
};

function checkLevelUpChoice() {
  const container = document.getElementById('event-choices-container');
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');

  if (!container || !overlay) return;

  const playersWithChoice = gameState.players.filter(p => p.pendingLevelUpChoice);

  if (playersWithChoice.length > 0) {
    title.innerText = "¡SUBIDA DE NIVEL!";
    desc.innerText = "¡Habéis ganado experiencia suficiente! Cada jugador debe elegir un nuevo dado:";
    container.innerHTML = '';

    playersWithChoice.forEach(p => {
      const pIndex = gameState.players.indexOf(p);
      const card = document.createElement('div');
      card.className = 'level-up-card';

      // Header con nombre y colección mini
      const header = document.createElement('div');
      header.className = 'player-info-header';
      header.innerHTML = `
        <div style="text-align: left;">
          <h3 style="margin: 0; font-size: 1.4rem;">${p.name}</h3>
          <span style="color: var(--text-dim); font-size: 0.9rem;">Ha subido al nivel ${p.level}${p.pendingLevelUpChoices > 1 ? ` (Elección 1 de ${p.pendingLevelUpChoices})` : ''}</span>
        </div>
        <div class="collection-mini">
          <span style="font-size: 0.7rem; color: #888; text-transform: uppercase; margin-right: 5px;">Colección:</span>
          ${p.dicePool.map(d => `<div class="die ${d.type} ${d.faces === 4 ? 'd4' : ''}" style="width: 20px; height: 20px; font-size: 0.7rem;">${d.faces}</div>`).join('')}
        </div>
      `;
      card.appendChild(header);

      // Grid de opciones
      const grid = document.createElement('div');
      grid.className = 'choices-grid';

      // Opción Rojo d6
      const redOption = document.createElement('div');
      redOption.className = 'die-option';
      redOption.innerHTML = `
        <div class="die red">6</div>
        <p>Dado Rojo</p>
        <span class="die-desc">Ideal para ataques físicos. Mayor probabilidad de daño alto.</span>
      `;
      redOption.onclick = () => handleLevelUpChoice(pIndex, 'red');

      // Opción Negro d4
      const blackOption = document.createElement('div');
      blackOption.className = 'die-option';
      blackOption.innerHTML = `
        <div class="die black d4">4</div>
        <p>Dado Negro</p>
        <span class="die-desc">Desbloquea habilidades y relanzamientos. <strong style="color: var(--gold);"><br><br>+1 mo de regalo.</strong></span>
      `;
      blackOption.onclick = () => handleLevelUpChoice(pIndex, 'black');

      grid.appendChild(redOption);
      grid.appendChild(blackOption);
      card.appendChild(grid);

      container.appendChild(card);
    });

    overlay.classList.remove('hidden');
  } else {
    // SOLO ocultamos si lo que hay en el contenedor es una carta de subida de nivel
    // Esto evita cerrar otros modales como el de pociones o advertencias.
    if (container.querySelector('.level-up-card')) {
      overlay.classList.add('hidden');
    }
  }
}

window.handleLevelUpChoice = function (playerIndex, dieType) {
  const faces = dieType === 'red' ? 6 : 4;
  if (gameState.addDieToPool(playerIndex, dieType, faces)) {
    updateUI();
  }
};

// Global Hover Preview para las cartas
document.addEventListener('mouseover', (e) => {
  const card = e.target.closest('.equipment-card, .deck, .goblin-card, .equip-slot, .player-role, .mini-equip-icon');
  const preview = document.getElementById('card-preview-overlay');

  if (card) {
    let bg = card.style.backgroundImage;
    if (bg && bg !== 'none') {
      // Si es un rol mini, mostrar la versión normal en el preview
      const fullResBg = bg.replace('mini_rol_', 'rol_');
      preview.style.backgroundImage = fullResBg;
      preview.style.display = 'block';

      // Sincronizar rotación si la carta está rota
      if (card.classList.contains('broken') || card.style.transform.includes('180deg')) {
        preview.style.transform = 'rotate(180deg)';
      } else {
        preview.style.transform = 'none';
      }

      const combatOverlay = document.getElementById('combat-overlay');
      if (combatOverlay && !combatOverlay.classList.contains('hidden')) {
        preview.classList.add('in-combat');
      } else {
        preview.classList.remove('in-combat');
      }
    }
  } else {
    preview.style.display = 'none';
  }
});
function updateNarrowStates() {
  const cards = document.querySelectorAll('#goblins-container .goblin-card');
  cards.forEach(card => {
    if (card.offsetWidth < 175) {
      card.classList.add('is-narrow');
    } else {
      card.classList.remove('is-narrow');
    }
  });
}

let activeSelectedOrbUids = [];

function renderRetaliationModal() {
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');
  const modal = document.querySelector('.event-modal');

  // Aplicar tema rojizo
  if (modal) modal.classList.add('retaliation-theme');

  const totalDamage = gameState.retaliationQueue.reduce((sum, gob) => sum + gob.level, 0);

  title.innerHTML = `⚔️ FASE DE REPRESALIA ⚔️`;
  title.style.color = 'var(--accent-red)';
  desc.innerHTML = `Tienes un total de <strong style="font-size: 1.4rem; color: var(--accent-red);">${totalDamage} </strong> de daño por asignar.<br>Arrastra los orbes hacia los jugadores o tócalos para seleccionar varios.`;

  container.innerHTML = '';
  // Asegurar flujo vertical con clase CSS
  container.classList.add('retaliation-layout');

  if (gameState.retaliationQueue.length > 0) {
    // 1. Zona de Orbes de Daño
    const orbsContainer = document.createElement('div');
    orbsContainer.className = 'damage-orbs-container';

    gameState.retaliationQueue.forEach(gob => {
      const orb = document.createElement('div');
      orb.className = 'damage-orb';
      orb.innerText = gob.level;
      orb.draggable = true;
      orb.dataset.uid = gob.uid;
      orb.title = "Arrastra o haz clic para seleccionar/deseleccionar";

      if (activeSelectedOrbUids.includes(gob.uid)) {
        orb.classList.add('orb-selected');
        orb.style.boxShadow = '0 0 15px 5px var(--accent-red), 0 0 25px 10px #ff0000';
        orb.style.transform = 'scale(1.15)';
      }

      orb.addEventListener('click', (e) => {
        const pos = activeSelectedOrbUids.indexOf(gob.uid);
        if (pos !== -1) {
          activeSelectedOrbUids.splice(pos, 1);
        } else {
          activeSelectedOrbUids.push(gob.uid);
        }
        renderRetaliationModal();
        e.stopPropagation();
      });

      orb.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', gob.uid);
        orb.style.opacity = '0.5';
      });

      orb.addEventListener('dragend', () => {
        orb.style.opacity = '1';
      });

      orbsContainer.appendChild(orb);
    });

    container.appendChild(orbsContainer);

    // 2. Zona de Jugadores (Drop Zones)
    const zonesContainer = document.createElement('div');
    zonesContainer.className = 'drop-zones-container';

    gameState.players.forEach((p, idx) => {
      const zone = document.createElement('div');
      zone.className = 'player-drop-zone';
      if (p.hp <= 0) zone.classList.add('is-dead');
      zone.title = "Arrastra un orbe aquí o haz clic si tienes orbes seleccionados";

      zone.innerHTML = `
        <h4>${p.name}</h4>
        <div class="hp-info">HP Actual: ${p.hp}</div>
      `;

      zone.addEventListener('click', (e) => {
        if (activeSelectedOrbUids.length > 0 && p.hp > 0) {
          const chosenUids = [...activeSelectedOrbUids];
          activeSelectedOrbUids = [];
          handleRetaliationChoice(chosenUids, idx);
          e.stopPropagation();
        }
      });

      if (p.hp > 0) {
        const bulkBtn = document.createElement('button');
        bulkBtn.className = 'btn secondary bulk-retaliation-btn';
        bulkBtn.style.cssText = 'font-size: 0.7rem; margin-top: 10px; padding: 5px;';
        bulkBtn.innerText = "Recibir todo el daño";
        bulkBtn.onclick = (e) => {
          e.stopPropagation();
          assignAllRetaliationToPlayer(idx);
        };
        zone.appendChild(bulkBtn);
      }

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const gobUid = e.dataTransfer.getData('text/plain');
        handleRetaliationChoice(gobUid, idx);
      });

      zonesContainer.appendChild(zone);
    });

    container.appendChild(orbsContainer);
    container.appendChild(zonesContainer);
  }

  overlay.classList.remove('hidden');
}

function assignAllRetaliationToPlayer(pIndex) {
  const container = document.getElementById('event-choices-container');
  const remaining = [...gameState.retaliationQueue];
  activeSelectedOrbUids = [];

  remaining.forEach(gob => {
    gameState.assignRetaliationDamage(gob.uid, pIndex);
  });

  updateUI();

  // Solo realizamos limpieza de represalia si la partida NO ha terminado
  if (!gameState.isGameOver) {
    if (!gameState.isRetaliationPhase) {
      document.getElementById('global-event-overlay').classList.add('hidden');
      const modal = document.querySelector('.event-modal');
      if (modal) modal.classList.remove('retaliation-theme');
      container.classList.remove('retaliation-layout');
    } else if (gameState.retaliationQueue.length > 0) {
      renderRetaliationModal();
    }
  }
}

function handleRetaliationChoice(gobUids, playerIdx) {
  activeSelectedOrbUids = [];
  const uids = Array.isArray(gobUids) ? gobUids : [gobUids];

  let anyAssigned = false;
  uids.forEach(uid => {
    if (gameState.assignRetaliationDamage(uid, playerIdx)) {
      anyAssigned = true;
    }
  });

  if (anyAssigned) {
    // Pequeño retardo para que se vea la actualización del HUD antes de re-renderizar el modal
    setTimeout(() => {
      updateUI();
      // Solo cerramos el overlay si la fase de represalia ha terminado Y la partida sigue activa
      if (!gameState.isRetaliationPhase && !gameState.isGameOver) {
        document.getElementById('global-event-overlay').classList.add('hidden');
        const modal = document.querySelector('.event-modal');
        if (modal) modal.classList.remove('retaliation-theme');
        const container = document.getElementById('event-choices-container');
        if (container) container.classList.remove('retaliation-layout');
      }
    }, 100);
  }
}

function renderGameOver() {
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');
  const modal = document.querySelector('.event-modal');

  if (modal) modal.classList.add('retaliation-theme');

  title.innerHTML = `☠️ PARTIDA FINALIZADA ☠️`;
  title.style.color = 'var(--accent-red)';

  const phrase = DB.gameOverPhrases[Math.floor(Math.random() * DB.gameOverPhrases.length)];

  desc.innerHTML = `
    <img src="assets/final.jpg" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(230, 57, 70, 0.5);">
    <div style="font-size: 1.5rem; margin-bottom: 20px; color: #fff;">¡Habéis sido derrotados!</div>
    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(230, 57, 70, 0.3);">
      <p style="margin-bottom: 10px;">Llegasteis hasta la <strong>Oleada ${gameState.battlefield.waveLevel}</strong></p>
      <p style="font-size: 0.9rem; color: var(--text-cita); font-style: italic;">"${phrase}"</p>
    </div>
  `;

  container.innerHTML = `
    <button class="btn primary" onclick="location.reload()" style="padding: 15px 40px; font-size: 1.2rem;">
      INTENTAR DE NUEVO
    </button>
  `;

  overlay.classList.remove('hidden');
}

function openPotionsModal() {
  const overlay = document.getElementById('global-event-overlay');
  const container = document.getElementById('event-choices-container');
  const p = gameState.getCurrentPlayer();

  // Si el modal ya está abierto y tiene contenido, solo actualizamos los botones y la vida
  const existingCards = container.querySelectorAll('.potion-card');
  if (existingCards.length > 0 && !overlay.classList.contains('hidden')) {
    existingCards.forEach(card => {
      const pocId = card.dataset.potionId;
      const poc = DB.equipment.pociones.find(x => x.id === pocId);
      const btn = card.querySelector('button');
      if (btn && poc) {
        const canAfford = p.mo >= poc.cost;
        btn.disabled = !canAfford;
        if (canAfford) {
          card.classList.add('potion-affordable');
        } else {
          card.classList.remove('potion-affordable');
        }
      }
    });
    const hpSpan = document.getElementById('potion-modal-current-hp');
    if (hpSpan) hpSpan.innerText = p.hp;
    const goldSpan = document.getElementById('potion-modal-current-gold');
    if (goldSpan) goldSpan.innerText = p.mo;
    return;
  }

  // Si no, construimos el modal de cero (primera apertura)
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const modal = document.querySelector('.event-modal');

  title.innerText = "ALQUIMIA Y POCIONES";
  title.style.color = "var(--gold)";
  desc.innerHTML = `Elige una pócima para ayudarte en tu aventura. No ocupan espacio de equipo.<br><br>
    <div style="display: flex; gap: 20px; justify-content: center; align-items: center; flex-wrap: wrap;">
      <div style="background: rgba(255, 0, 0, 0.15); border: 1px solid var(--accent-red); padding: 6px 18px; border-radius: 20px; font-weight: bold; font-size: 1.1rem; color: white; box-shadow: 0 0 12px rgba(255,0,0,0.4);">
        Salud: <span id="potion-modal-current-hp">${p.hp}</span> / ${p.maxHp} ❤️
      </div>
      <div style="background: rgba(212, 175, 55, 0.15); border: 1px solid var(--gold); padding: 6px 18px; border-radius: 20px; font-weight: bold; font-size: 1.1rem; color: white; box-shadow: 0 0 12px rgba(212, 175, 55, 0.4); display: flex; align-items: center; gap: 6px;">
        Monedas: <span id="potion-modal-current-gold">${p.mo}</span> ${COIN_SVG}
      </div>
    </div>`;

  container.innerHTML = '';
  container.classList.add('potions-layout');

  DB.equipment.pociones.forEach(poc => {
    const card = document.createElement('div');
    card.className = 'potion-card';
    if (p.mo >= poc.cost) {
      card.classList.add('potion-affordable');
    }
    card.dataset.potionId = poc.id; // Guardamos el ID para actualizaciones rápidas
    card.style.cssText = `
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--gold);
      border-radius: 8px;
      padding: 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      width: 180px;
      transition: all 0.2s;
    `;

    card.innerHTML = `
      <div style="width: 80px; height: 80px; background-image: url('${poc.image}'); background-size: cover; border-radius: 50%; border: 2px solid var(--gold);"></div>
      <div style="font-weight: bold; color: var(--gold);">${poc.name}</div>
      <div style="font-size: 0.85rem; text-align: center; color: #ccc; min-height: 40px;">${poc.effect}</div>
      <button class="btn secondary" style="width: 100%;" ${p.mo < poc.cost ? 'disabled' : ''}>
        Comprar <BR> ${poc.cost} mo
      </button>
    `;

    const btn = card.querySelector('button');
    btn.onclick = () => {
      const healed = gameState.buyPotion(poc.id);
      if (healed !== null) {
        // Feedback visual en el modal
        const feedback = document.createElement('div');
        feedback.style.cssText = `
          position: fixed;
          color: var(--accent-green);
          font-weight: bold;
          font-size: 1.5rem;
          text-shadow: 0 0 10px #000;
          pointer-events: none;
          z-index: 10000;
          animation: floatUp 1s forwards;
        `;
        feedback.innerText = `+${healed} PV`;
        const rect = btn.getBoundingClientRect();
        feedback.style.left = `${rect.left + rect.width / 2}px`;
        feedback.style.top = `${rect.top}px`;
        document.body.appendChild(feedback);
        setTimeout(() => feedback.remove(), 1000);

        // 1. Actualizamos la interfaz general (HUD, oro, etc)
        updateUI();

        // 2. ACTUALIZACIÓN DIRECTA (Sin parpadeos): 
        // Buscamos todos los botones en el modal y los actualizamos según el nuevo oro del jugador
        const newP = gameState.getCurrentPlayer();
        const allCards = container.querySelectorAll('.potion-card');
        allCards.forEach(c => {
          const cPocId = c.dataset.potionId;
          const cPoc = DB.equipment.pociones.find(x => x.id === cPocId);
          const cBtn = c.querySelector('button');
          if (cBtn && cPoc) {
            const canAfford = newP.mo >= cPoc.cost;
            cBtn.disabled = !canAfford;
            if (canAfford) {
              c.classList.add('potion-affordable');
            } else {
              c.classList.remove('potion-affordable');
            }
          }
        });
        const hpSpan = document.getElementById('potion-modal-current-hp');
        if (hpSpan) hpSpan.innerText = newP.hp;
        const goldSpan = document.getElementById('potion-modal-current-gold');
        if (goldSpan) goldSpan.innerText = newP.mo;
      }
    };

    container.appendChild(card);
  });

  // Botón para cerrar
  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn primary';
  closeBtn.style.marginTop = '20px';
  closeBtn.innerText = "CERRAR";
  closeBtn.onclick = () => {
    overlay.classList.add('hidden');
    container.classList.remove('potions-layout');
  };
  container.appendChild(closeBtn);

  overlay.classList.remove('hidden');
}

// Observador para cambios de tamaño en ventana
window.addEventListener('resize', updateNarrowStates);

function openDuplicateWarningModal(type, card) {
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');

  title.innerText = "¡OBJETO DUPLICADO!";
  title.style.color = "var(--accent-red)";
  desc.innerHTML = `Ya tienes un <strong>${card.name}</strong> equipado.<br><br>¿Deseas comprar otra copia para guardarla en el almacén de tu mochila?<br><br><em>(Podrás intercambiarlos cuando quieras si alguno se rompe o para gestionar tu peso)</em>`;

  container.innerHTML = '';
  // Añadimos un marcador para que checkLevelUpChoice no cierre el modal
  const marker = document.createElement('div');
  marker.className = 'duplicate-warning-card';
  container.appendChild(marker);

  const btnYes = document.createElement('button');
  btnYes.className = 'btn primary';
  btnYes.style.marginRight = '10px';
  btnYes.innerText = "SÍ, COMPRAR Y ALMACENAR";
  btnYes.onclick = () => {
    gameState.buyFromMarket(type);
    overlay.classList.add('hidden');
    updateUI();
  };

  const btnNo = document.createElement('button');
  btnNo.className = 'btn secondary';
  btnNo.innerText = "CANCELAR COMPRA";
  btnNo.onclick = () => {
    overlay.classList.add('hidden');
  };

  container.appendChild(btnYes);
  container.appendChild(btnNo);
  overlay.classList.remove('hidden');
}

function openActionLossWarningModal(onConfirm) {
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');

  title.innerText = "¡ACCIÓN PENDIENTE!";
  title.style.color = "var(--gold)";
  desc.innerHTML = `Aún tienes la oportunidad de realizar tu acción básica de este turno (Atacar, Cobrar o Rellenar Rol).<br><br>Si continúas con la compra, <strong>perderás la oportunidad</strong> de realizar tu acción de este turno.<br><br>¿Deseas continuar con la compra de todos modos?`;

  container.innerHTML = '';
  // Añadimos un marcador para evitar cierres accidentales
  const marker = document.createElement('div');
  marker.className = 'action-loss-warning-card';
  container.appendChild(marker);

  const btnYes = document.createElement('button');
  btnYes.className = 'btn primary';
  btnYes.style.marginRight = '10px';
  btnYes.innerText = "SÍ, CONTINUAR";
  btnYes.onclick = () => {
    overlay.classList.add('hidden');
    onConfirm();
  };

  const btnNo = document.createElement('button');
  btnNo.className = 'btn secondary';
  btnNo.innerText = "CANCELAR COMPRA";
  btnNo.onclick = () => {
    overlay.classList.add('hidden');
  };

  container.appendChild(btnYes);
  container.appendChild(btnNo);
  overlay.classList.remove('hidden');
}

// Soporte global para navegación por teclado (Escape, Enter y Teclas Numéricas)
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.key === 'Escape' || e.key === 'Enter') {
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Capa 1: Modales y Overlays superiores (targeting, hitos, mercado, rellenar rol, eventos)
    const topModals = Array.from(document.querySelectorAll('.modal:not(.hidden), .overlay:not(.hidden)'));
    if (topModals.length > 0) {
      for (let i = topModals.length - 1; i >= 0; i--) {
        const modal = topModals[i];
        if (e.key === 'Escape') {
          const closeBtn = modal.querySelector('#btn-close-hitos, #btn-close-explore-market, #btn-close-target-modal, #btn-cancel-role-fill, #btn-close-potions, .btn.secondary');
          if (closeBtn) {
            closeBtn.click();
            break;
          }
        } else if (e.key === 'Enter') {
          let confirmBtn = modal.querySelector('#btn-confirm-role-fill');
          if (!confirmBtn) {
            confirmBtn = modal.querySelector('.btn.primary:not(#btn-combat-role)');
          }
          if (confirmBtn && !confirmBtn.disabled) {
            confirmBtn.click();
            break;
          }
          break; // Bloquear propagación a capas inferiores si el modal superior no tiene botón primario
        }
      }
      return;
    }

    // Capa 2: Pantalla de Combate
    const combatOverlay = document.getElementById('combat-overlay');
    if (combatOverlay && !combatOverlay.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        const cancelBtn = combatOverlay.querySelector('#btn-cancel-combat');
        if (cancelBtn) cancelBtn.click();
      } else if (e.key === 'Enter') {
        const resolveBtn = combatOverlay.querySelector('#btn-resolve-combat');
        if (resolveBtn && !resolveBtn.disabled) resolveBtn.click();
      }
      return;
    }

    // Capa 3: Tablero Principal
    if (e.key === 'Enter') {
      const mainAttackBtn = document.getElementById('btn-confirm-attack');
      if (mainAttackBtn && !mainAttackBtn.disabled) {
        mainAttackBtn.click();
      }
    }
  } else if (/^[0-9]$/.test(e.key)) {
    const topModals = Array.from(document.querySelectorAll('.modal:not(.hidden), .overlay:not(.hidden)'));
    const combatOverlay = document.getElementById('combat-overlay');
    const isCombatOpen = combatOverlay && !combatOverlay.classList.contains('hidden');

    if (topModals.length === 0 && !isCombatOpen && !gameState.isMarketPhase) {
      e.preventDefault();
      const num = parseInt(e.key, 10);
      const goblinIndex = num === 0 ? 9 : num - 1;

      const goblinsContainer = document.getElementById('goblins-container');
      if (goblinsContainer && goblinIndex < goblinsContainer.children.length) {
        const gobCard = goblinsContainer.children[goblinIndex];
        if (gobCard && gobCard.classList.contains('selectable')) {
          gobCard.click();
        }
      }
    }
  }
});


// Inicializar preview de Senda en setup-modal
setTimeout(() => {
  const selectSendaEl = document.getElementById('select-senda');
  if (selectSendaEl) {
    selectSendaEl.addEventListener('change', updateSetupSendaPreview);
    updateSetupSendaPreview();
  }
}, 100);

// --- CHEAT MODE: MODIFICAR VALOR DE LOS DADOS ---
document.addEventListener('click', (e) => {
  const toggle = document.getElementById('cheat-dice-toggle');
  if (toggle && toggle.checked) {
    const dieEl = e.target.closest('.die');
    if (dieEl && dieEl.id) {
      e.preventDefault();
      e.stopPropagation();

      const newStr = prompt("Trampas: Nuevo valor para este dado:", dieEl.innerText);
      if (newStr !== null) {
        const newVal = parseInt(newStr, 10);
        if (!isNaN(newVal)) {
          let found = false;
          
          if (typeof roleFillDice !== 'undefined' && Array.isArray(roleFillDice)) {
            let d = roleFillDice.find(x => x.id === dieEl.id);
            if (d) {
              d.val = newVal;
              d.value = newVal;
              found = true;
            }
          }
          
          if (gameState.currentCombat && gameState.currentCombat.playerDice) {
            let d = gameState.currentCombat.playerDice.find(x => x.id === dieEl.id);
            if (d) {
              d.val = newVal;
              d.value = newVal;
              found = true;
            }
          }

          if (dieEl.classList.contains('green') && dieEl.dataset.goblinUid && dieEl.dataset.dieIndex) {
            const uid = dieEl.dataset.goblinUid;
            const idx = parseInt(dieEl.dataset.dieIndex, 10);
            if (gameState.currentCombat && gameState.currentCombat.dice && gameState.currentCombat.dice.green[uid]) {
              let greenDetails = gameState.currentCombat.dice.green[uid].details;
              if (greenDetails[idx]) {
                greenDetails[idx].val = newVal;
                // recalculate total
                let newTotal = 0;
                greenDetails.forEach(d => {
                  if (d.type === 'die' || d.type === 'fixed') newTotal += d.val;
                });
                gameState.currentCombat.dice.green[uid].total = newTotal;
                found = true;
              }
            }
          }
          
          if (found) {
            const combatOverlay = document.getElementById('combat-overlay');
            if (combatOverlay && !combatOverlay.classList.contains('hidden')) {
              if (typeof renderCombatOverlay === 'function') renderCombatOverlay();
            } else {
              if (typeof renderRoleFillDice === 'function') renderRoleFillDice();
            }
          }
        }
      }
    }
  }
}, true);

window.saveGame = function(silent = false) {
  if (gameState.players.length === 0) return;
  const saveData = JSON.stringify(gameState);
  localStorage.setItem('malditosGoblinsSave', saveData);
  if (!silent) {
    gameState.addLog(`&#128190; <strong>Partida guardada correctamente.</strong>`);
    updateUI();
  }
};

window.loadGame = function() {
  const saveData = localStorage.getItem('malditosGoblinsSave');
  if (saveData) {
    const data = JSON.parse(saveData);
    Object.assign(gameState, data);
    gameState.addLog(`&#128190; <strong>Partida cargada correctamente.</strong>`);
    
    document.querySelectorAll('.modal, .overlay').forEach(el => {
      el.classList.add('hidden');
      el.style.display = '';
    });
    
    updateUI();
  }
};

const btnSaveGame = document.getElementById('btn-save-game');
if (btnSaveGame) {
  btnSaveGame.addEventListener('click', () => {
    window.saveGame();
  });
}

const btnLoadGame = document.getElementById('btn-load-game');
if (btnLoadGame) {
  btnLoadGame.addEventListener('click', () => {
    window.loadGame();
  });
}

setInterval(() => {
  const btnSave = document.getElementById('btn-save-game');
  if (!btnSave) return;
  
  if (gameState.players.length === 0) {
    btnSave.style.display = 'none';
    return;
  }
  
  const blockingModals = [
    'setup-modal',
    'combat-overlay',
    'role-fill-overlay',
    'global-event-overlay',
    'target-modal',
    'explore-market-modal',
    'corrosion-modal',
    'elastic-modal'
  ];
  
  let shouldHide = false;
  for (let id of blockingModals) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
      shouldHide = true;
      break;
    }
  }
  
  if (shouldHide) {
    btnSave.style.display = 'none';
  } else {
    btnSave.style.display = 'flex';
  }
}, 300);