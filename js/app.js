let lastWaveLevel = 0;
let lastActionCount = 0;
let lastActivePlayerUid = null;
let focusHighlightTimeouts = [];
const gameState = new GameState();
const botManager = typeof BotManager !== 'undefined' ? new BotManager(gameState) : null;
window.botManager = botManager;
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
    const logoEl = document.getElementById('game-logo');

    if (!splash) return;

    let isRemoving = false;
    let fadeTimeout = null;

    const removeSplash = (immediate = false) => {
      if (immediate) {
        if (fadeTimeout) clearTimeout(fadeTimeout);
        splash.style.transition = 'none';
        splash.style.opacity = '0';
        splash.style.display = 'none';
        splash.remove();
        isRemoving = true;
      } else {
        if (isRemoving) return;
        isRemoving = true;
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        fadeTimeout = setTimeout(() => splash.remove(), 800);
      }
    };

    const timer = setTimeout(() => removeSplash(false), 1000);

    const handleTrigger = (e) => {
      e.preventDefault();
      clearTimeout(timer);
      removeSplash(true);
    };

    // Soporte total para clic en PC, toque táctil en móviles/tablets y punteros estándar
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(evt => {
      splash.addEventListener(evt, handleTrigger, { once: true });
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
  enabled: localStorage.getItem('tutorialEnabled') === 'true',
  seen: JSON.parse(localStorage.getItem('tutorialSeen') || '{}'),
  currentSituation: null,

  content: {
    seleccion_rol: {
      title: "Selección de Grupo",
      body: `
      <ul>
        <li><strong>Roles:</strong> En el inicio de la partida debes seleccionra de 1 a 4 héroes. Cada rol tiene una habilidad única que consume 🔷 Puntos de Energía.</li>
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
        <img src="assets/Monstruos/03.webp" style="height: 70px; border-radius: 8px; border: 2px solid #8B0000; box-shadow: 0 0 15px rgba(255,0,0,0.4);">
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
        <img src="assets/Equipo/inicial/!1-Espada.webp" style="height: 70px; border-radius: 8px; border: 1px solid #aaa;">
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
var activeSelectedDieId = null;
var activeSelectedEquipId = null;

// Sobrescribir window.alert nativo por un modal inmersivo del juego
window.alert = function (messageText, callback = null) {
  if (window.activeAlertTimerInterval) {
    clearInterval(window.activeAlertTimerInterval);
    window.activeAlertTimerInterval = null;
  }
  const oldTimer = document.getElementById('combat-alert-timer-btn');
  if (oldTimer) {
    oldTimer.remove();
  }

  window.resetEventModalTransparency();
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');

  if (!overlay || !title || !desc || !container) {
    console.warn("DOM no listo para alert custom:", messageText);
    if (typeof callback === 'function') callback();
    return;
  }

  overlay.classList.remove('victory-theme');

  // Cabecera grande y amarilla y coloreado de contenido
  let headerText = "¡ATENCIÓN!";
  let processedText = messageText;

  // Intentamos extraer un título principal del mensaje si empieza por "¡...!" o si la primera línea es un título claro
  const tempLines = messageText.split('\n');
  const firstLineRaw = tempLines[0] ? tempLines[0].trim() : '';
  let firstLineClean = firstLineRaw.replace(/^<br\s*\/?>|<br\s*\/?>$/gi, '').trim();

  // Caso A: La primera línea empieza por ¡ y tiene ! (ej: "¡DEMASIADO PESO! No puedes llevar...")
  const exclamationMatch = firstLineClean.match(/^¡([^!]+)!(.*)/i);
  if (exclamationMatch) {
    headerText = `¡${exclamationMatch[1].trim()}!`;
    const restOfFirstLine = exclamationMatch[2].trim();
    if (restOfFirstLine || tempLines.length > 1) {
      if (restOfFirstLine) {
        tempLines[0] = restOfFirstLine;
      } else {
        tempLines.shift();
      }
      processedText = tempLines.join('\n');
    } else {
      processedText = "";
    }
  }
  // Caso B: La primera línea termina con ":" (ej: "Senda del Gran Recaudador - Resumen:")
  else if (firstLineClean.endsWith(':')) {
    headerText = firstLineClean.substring(0, firstLineClean.length - 1).trim();
    tempLines.shift();
    processedText = tempLines.join('\n');
  }
  // Caso C: La primera línea contiene un ":" y hay más líneas en el mensaje, o la parte antes del ":" es corta (ej: "⚠️ Fuego Cruzado: Durante este...")
  else if (firstLineClean.includes(':') && (tempLines.length > 1 || firstLineClean.indexOf(':') < 30)) {
    const colonIndex = firstLineClean.indexOf(':');
    headerText = firstLineClean.substring(0, colonIndex).trim();
    const restOfFirstLine = firstLineClean.substring(colonIndex + 1).trim();
    if (restOfFirstLine || tempLines.length > 1) {
      if (restOfFirstLine) {
        tempLines[0] = restOfFirstLine;
      } else {
        tempLines.shift();
      }
      processedText = tempLines.join('\n');
    } else {
      processedText = "";
    }
  }

  // Ajustar tamaño del título según la longitud para evitar desbordamientos
  let titleFontSize = "2.2rem";
  if (headerText.length > 30) {
    titleFontSize = "1.8rem";
  }
  if (headerText.length > 50) {
    titleFontSize = "1.5rem";
  }

  title.innerHTML = headerText.replace(/🪙/g, COIN_SVG);

  const eyeBtn = document.getElementById('event-modal-eye-btn');
  if (eyeBtn && (messageText.includes('COMBAT_STATS:') || messageText.includes('¡COMBATE COMPLETADO!'))) {
    eyeBtn.classList.remove('hidden');
  }
  title.style.cssText = `font-family: 'Cinzel', serif; font-size: ${titleFontSize}; font-weight: 800; color: #ffd700; text-shadow: 0 0 15px rgba(255, 215, 0, 0.4); text-align: center; margin-bottom: 25px; letter-spacing: 2px; text-transform: uppercase;`;

  // Función de parseo interno para colorear y estructurar el mensaje
  const parseAlertMessage = (text) => {
    const lines = text.split('\n');
    let html = '';
    
    // Todos los textos de las alertas deben estar centrados
    const alignStyle = 'text-align: center;';

    lines.forEach(line => {
      let trimmed = line.trim();
      if (!trimmed) {
        html += '<div style="margin-bottom: 12px;"></div>';
        return;
      }

      // Quitar br superfluos al inicio/fin
      trimmed = trimmed.replace(/^<br\s*\/?>|<br\s*\/?>$/gi, '');
      if (!trimmed) {
        html += '<div style="margin-bottom: 12px;"></div>';
        return;
      }

      if (trimmed.startsWith('COMBAT_STATS:')) {
        const query = trimmed.substring('COMBAT_STATS:'.length).trim();
        const params = {};
        query.split(';').forEach(part => {
          const [key, val] = part.split('=');
          if (key && val !== undefined) {
            params[key] = parseInt(val, 10);
          }
        });

        let rowHtml = '<div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 15px; margin-bottom: 15px; flex-wrap: wrap;">';
        let hasPriorElement = false;
        let hasAnyElement = false;

        // 1. Vida (HP)
        if (params.hp !== undefined && params.hp !== 0) {
          const val = params.hp;
          const sign = val > 0 ? '+' : '';
          const color = val < 0 ? '#ff4d4d' : '#2ecc71';
          rowHtml += `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 2.5rem; filter: drop-shadow(0 0 6px rgba(255,77,77,0.4)); line-height: 1;">❤️</span>
              <span style="font-size: 1.8rem; font-weight: bold; color: ${color}; line-height: 1;">${sign}${val}</span>
            </div>
          `;
          hasPriorElement = true;
          hasAnyElement = true;
        }

        // 2. Monedas (mo)
        if (params.mo !== undefined && params.mo !== 0) {
          const val = params.mo;
          const sign = val > 0 ? '+' : '';
          const color = val < 0 ? '#ff4d4d' : '#ffd700';
          const coinSvgLarge = COIN_SVG.replace('width="18" height="18"', 'width="34" height="34"').replace('margin-right: 3px;', 'margin-right: 0px;');
          rowHtml += `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-flex; align-items: center; filter: drop-shadow(0 0 8px rgba(255,215,0,0.4)); line-height: 1;">${coinSvgLarge}</span>
              <span style="font-size: 1.8rem; font-weight: bold; color: ${color}; line-height: 1;">${sign}${val}</span>
            </div>
          `;
          hasPriorElement = true;
          hasAnyElement = true;
        }

        // 3. Energía
        if (params.energy !== undefined && params.energy !== 0) {
          const val = params.energy;
          const sign = val > 0 ? '+' : '';
          const color = '#00d2ff';
          rowHtml += `
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 2.5rem; filter: drop-shadow(0 0 6px rgba(0, 210, 255, 0.4)); line-height: 1;">🔷</span>
              <span style="font-size: 1.8rem; font-weight: bold; color: ${color}; line-height: 1;">${sign}${val}</span>
            </div>
          `;
          hasPriorElement = true;
          hasAnyElement = true;
        }

        // 4. PEX (Separado del resto por un margen izquierdo considerable si hay elementos previos)
        if (params.pex !== undefined && params.pex !== 0) {
          const val = params.pex;
          const sign = val > 0 ? '+' : '';
          const color = val < 0 ? '#ff4d4d' : '#f1c40f';
          const marginStyle = hasPriorElement ? 'margin-left: 50px;' : '';
          rowHtml += `
            <div style="display: flex; align-items: center; gap: 8px; ${marginStyle}">
              <span style="font-size: 2.5rem; filter: drop-shadow(0 0 6px rgba(241,196,15,0.4)); line-height: 1;">✨</span>
              <span style="font-size: 1.8rem; font-weight: bold; color: ${color}; line-height: 1;">${sign}${val}</span>
            </div>
          `;
          hasAnyElement = true;
        }

        if (hasAnyElement) {
          rowHtml += '</div>';
          html += rowHtml;
        }
        return;
      }

      // Detectar subcabeceras secundarias dentro del mensaje (por ejemplo, "Senda del Gran Recaudador - Resumen:")
      if (trimmed.endsWith(':') || (trimmed.startsWith('¡') && trimmed.endsWith('!')) || trimmed.toLowerCase().includes('resumen')) {
        let cleanText = trimmed.replace(/<br\s*\/?>/gi, '').replace(/🪙/g, COIN_SVG);
        let headerColor = '#ffd700'; // Dorado por defecto
        if (cleanText.toLowerCase().includes('equipo') || cleanText.toLowerCase().includes('rotura') || cleanText.toLowerCase().includes('roto')) {
          headerColor = '#c975ff'; // Nuevo púrpura para rotura/daño equipo
        }
        let textShadow = headerColor === '#c975ff' ? 'rgba(201, 117, 255, 0.4)' : 'rgba(212, 175, 55, 0.4)';
        let marginTop = '18px';
        if (cleanText.toLowerCase().includes('senda')) {
          marginTop = '32px';
        }
        html += `<div style="font-family: 'Cinzel', serif; font-size: 1.25rem; font-weight: bold; color: ${headerColor}; margin-top: ${marginTop}; margin-bottom: 10px; text-shadow: 0 0 8px ${textShadow}; text-transform: uppercase; text-align: center;">${cleanText}</div>`;
      } 
      // Contenido diferenciado por Título: Descripción
      else if (trimmed.includes(':')) {
        let colonIndex = trimmed.indexOf(':');
        let blockTitle = trimmed.substring(0, colonIndex + 1);
        let blockDesc = trimmed.substring(colonIndex + 1);

        // Elegir color para el TÍTULO según las palabras clave
        let titleColor = '#ffcc00'; // Color por defecto (dorado/amarillo suave)
        let descColor = '#cbd5e1'; // Color por defecto de descripción (grisáceo)
        
        if (blockTitle.toLowerCase().includes('roto') || blockTitle.toLowerCase().includes('rotura') || blockTitle.toLowerCase().includes('equipo')) {
          titleColor = '#c975ff'; // Nuevo púrpura para rotura/daño equipo
          descColor = '#c975ff';  // Todo el texto de rotura en el color específico
        } else if (blockTitle.includes('⚔️') || blockTitle.toLowerCase().includes('daño') || blockTitle.toLowerCase().includes('golpe') || blockTitle.toLowerCase().includes('ataque') || blockTitle.toLowerCase().includes('vida')) {
          titleColor = '#ff4d4d'; // Rojo vibrante para daño/combate/vida
        } else if (blockTitle.includes('🪙') || blockTitle.includes('💰') || blockTitle.includes('💸') || blockTitle.toLowerCase().includes('escudo de oro') || blockTitle.toLowerCase().includes('saqueo') || blockTitle.toLowerCase().includes('carteristas') || blockTitle.toLowerCase().includes('armadura') || blockTitle.toLowerCase().includes('peaje') || blockTitle.toLowerCase().includes('prestamista') || blockTitle.toLowerCase().includes('recaudador') || blockTitle.toLowerCase().includes('mo') || blockTitle.toLowerCase().includes('monedas') || blockTitle.toLowerCase().includes('oro')) {
          titleColor = '#ffd700'; // Dorado brillante
        } else if (blockTitle.includes('🔥') || blockTitle.toLowerCase().includes('escozor') || blockTitle.toLowerCase().includes('fuego') || blockTitle.toLowerCase().includes('piromante')) {
          titleColor = '#ff6600'; // Naranja para escozor
        } else if (blockTitle.includes('⚡') || blockTitle.toLowerCase().includes('calambre')) {
          titleColor = '#f1c40f'; // Amarillo para calambre
        } else if (blockTitle.includes('🔷') || blockTitle.toLowerCase().includes('energía') || blockTitle.toLowerCase().includes('habilidad')) {
          titleColor = '#00d2ff'; // Nuevo celeste de energía
          descColor = '#00d2ff';  // Todo el texto de energía en el color específico
        } else if (blockTitle.includes('🌀') || blockTitle.toLowerCase().includes('tembleque')) {
          titleColor = '#34ace0'; // Azul claro para tembleque
        } else if (blockTitle.includes('🛡️') || blockTitle.toLowerCase().includes('escudo') || blockTitle.toLowerCase().includes('defensa') || blockTitle.toLowerCase().includes('invulnerable')) {
          titleColor = '#33d9b2'; // Turquesa para escudos y defensas
        } else if (blockTitle.includes('🚨') || blockTitle.includes('⚠️') || blockTitle.toLowerCase().includes('peso') || blockTitle.toLowerCase().includes('duplicado')) {
          titleColor = '#ff5252'; // Rojo brillante para alertas críticas
        }

        let displayTitle = blockTitle.replace(/🪙/g, COIN_SVG);
        let displayDesc = blockDesc.replace(/🪙/g, COIN_SVG);

        // Título en negrita y coloreado distinto a la descripción
        html += `<div style="margin-bottom: 8px; font-size: 1.05rem; line-height: 1.4; ${alignStyle}">
          <span style="font-weight: bold; color: ${titleColor};">${displayTitle}</span>
          <span style="color: ${descColor}; font-weight: normal; margin-left: 4px;">${displayDesc}</span>
        </div>`;
      } 
      // Líneas normales de descripción o texto plano
      else {
        let displayText = trimmed.replace(/🪙/g, COIN_SVG);
        html += `<div style="font-size: 1.05rem; color: #cbd5e1; line-height: 1.4; margin-bottom: 8px; ${alignStyle}">${displayText}</div>`;
      }
    });

    return html;
  };

  desc.innerHTML = parseAlertMessage(processedText);

  container.innerHTML = '';
  const marker = document.createElement('div');
  marker.className = 'custom-alert-marker';
  container.appendChild(marker);

  const btnOk = document.createElement('button');
  btnOk.className = 'btn primary';
  btnOk.innerText = "ACEPTAR";
  btnOk.onclick = () => {
    if (window.activeAlertTimerInterval) {
      clearInterval(window.activeAlertTimerInterval);
      window.activeAlertTimerInterval = null;
    }
    const timerBtn = document.getElementById('combat-alert-timer-btn');
    if (timerBtn) {
      timerBtn.remove();
    }
    overlay.classList.add('hidden');
    window.resetEventModalTransparency();
    if (typeof callback === 'function') {
      callback();
    }
  };

  container.appendChild(btnOk);

  // Lógica de temporizador automático para bots en resolución de combate
  const isCombatResolution = messageText.includes('¡COMBATE COMPLETADO!');
  const activePlayer = typeof gameState !== 'undefined' && gameState.getCurrentPlayer ? gameState.getCurrentPlayer() : null;
  const isBot = activePlayer && activePlayer.isBot;

  if (isCombatResolution && isBot) {
    const modalDiv = document.querySelector('#global-event-overlay .event-modal');
    if (modalDiv) {
      const timerBtn = document.createElement('div');
      timerBtn.id = 'combat-alert-timer-btn';
      timerBtn.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        background: rgba(10, 10, 15, 0.95);
        border-radius: 50%;
        box-shadow: 0 0 15px rgba(0, 0, 0, 0.6), inset 0 0 5px rgba(255, 255, 255, 0.1);
        transition: transform 0.2s ease, border-color 0.2s ease;
      `;
      timerBtn.title = "Pausar/Reanudar cuenta atrás de Bot";

      // Circular SVG con radio r=21 (circunferencia ≈ 131.95)
      timerBtn.innerHTML = `
        <svg width="50" height="50" style="position: absolute; top: 0; left: 0; transform: rotate(-90deg);">
          <circle cx="25" cy="25" r="21" fill="none" stroke="rgba(255, 255, 255, 0.1)" stroke-width="3.5" />
          <circle id="timer-progress-bar" cx="25" cy="25" r="21" fill="none" stroke="var(--gold)" stroke-width="3.5"
                  stroke-dasharray="131.95" stroke-dashoffset="131.95" stroke-linecap="round"
                  style="transition: stroke-dashoffset 0.1s linear;" />
        </svg>
        <span id="timer-pause-icon" style="position: relative; z-index: 2; font-size: 0.9rem; color: var(--gold); font-family: 'Inter', sans-serif; font-weight: bold; user-select: none;">⏸</span>
      `;

      modalDiv.appendChild(timerBtn);

      let timeLeft = 5000; // 5 segundos
      const tickRate = 100; // Actualizar cada 100ms
      let isTimerPaused = false;
      const circumference = 131.95;

      // Evento click para pausar/reanudar
      timerBtn.onclick = () => {
        isTimerPaused = !isTimerPaused;
        const iconSpan = document.getElementById('timer-pause-icon');
        if (iconSpan) {
          iconSpan.innerText = isTimerPaused ? '▶' : '⏸';
          iconSpan.style.left = isTimerPaused ? '1px' : '0px'; // Pequeño ajuste visual para centrar el icono de play
        }
        if (isTimerPaused) {
          timerBtn.style.boxShadow = "0 0 15px rgba(255, 51, 102, 0.4), inset 0 0 5px rgba(255, 255, 255, 0.1)";
          const bar = document.getElementById('timer-progress-bar');
          if (bar) bar.style.stroke = "#ff3366"; // Rojo cuando está pausado
        } else {
          timerBtn.style.boxShadow = "0 0 15px rgba(0, 0, 0, 0.6), inset 0 0 5px rgba(255, 255, 255, 0.1)";
          const bar = document.getElementById('timer-progress-bar');
          if (bar) bar.style.stroke = "var(--gold)"; // Volver a dorado
        }
      };

      window.activeAlertTimerInterval = setInterval(() => {
        if (isTimerPaused) return;

        timeLeft -= tickRate;
        const progress = Math.max(0, timeLeft) / 5000;
        const offset = circumference * progress; // Se va llenando en sentido horario, es decir, el dashoffset disminuye de 131.95 a 0
        const bar = document.getElementById('timer-progress-bar');
        if (bar) {
          bar.style.strokeDashoffset = offset;
        }

        if (timeLeft <= 0) {
          clearInterval(window.activeAlertTimerInterval);
          window.activeAlertTimerInterval = null;
          timerBtn.remove();
          btnOk.click(); // Autocierre llamando al botón OK
        }
      }, tickRate);
    }
  }

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
let selectedSetupBots = [false, true, true, true];
let justSelectedRole = null;

function renderRoleSelection() {
  roleSelectionContainer.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    let row = document.createElement('div');
    row.className = 'setup-player-row';
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

    let leftCol = document.createElement('div');
    leftCol.style.width = '120px';
    leftCol.style.display = 'flex';
    leftCol.style.flexDirection = 'column';
    leftCol.style.alignItems = 'center';
    leftCol.style.justifyContent = 'center';
    leftCol.style.gap = '8px';

    let label = document.createElement('label');
    label.style.fontWeight = 'bold';
    label.style.fontSize = '1.1rem';
    label.innerText = `Jugador ${i + 1}`;
    leftCol.appendChild(label);

      let aiToggle = document.createElement('div');
      aiToggle.style.display = 'flex';
      aiToggle.style.alignItems = 'center';
      aiToggle.style.justifyContent = 'center';
      aiToggle.style.gap = '6px';
      aiToggle.style.cursor = 'pointer';
      aiToggle.style.padding = '4px 10px';
      aiToggle.style.borderRadius = '20px';
      aiToggle.style.transition = 'all 0.3s ease';
      aiToggle.style.userSelect = 'none';
      
      let aiIcon = document.createElement('span');
      aiIcon.innerText = '🤖'; // Puedes cambiarlo por una imagen <img>
      aiIcon.style.fontSize = '1.2rem';
      
      let aiText = document.createElement('span');
      aiText.innerText = 'IA';
      aiText.style.fontWeight = 'bold';
      aiText.style.fontSize = '0.85rem';
      aiText.style.letterSpacing = '1px';

      if (selectedSetupBots[i]) {
        aiToggle.style.background = 'rgba(212, 175, 55, 0.15)';
        aiToggle.style.border = '1px solid var(--gold)';
        aiToggle.style.boxShadow = '0 0 10px rgba(212, 175, 55, 0.3) inset';
        aiIcon.style.filter = 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.8))';
        aiText.style.color = 'var(--gold)';
        aiText.style.textShadow = '0 0 5px rgba(255, 215, 0, 0.6)';
      } else {
        aiToggle.style.background = 'rgba(255, 255, 255, 0.05)';
        aiToggle.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        aiToggle.style.boxShadow = 'none';
        aiIcon.style.filter = 'grayscale(100%) opacity(0.5)';
        aiText.style.color = '#666';
        aiText.style.textShadow = 'none';
      }
      
      aiToggle.appendChild(aiIcon);
      aiToggle.appendChild(aiText);
      
      aiToggle.onclick = () => {
         selectedSetupBots[i] = !selectedSetupBots[i];
         renderRoleSelection();
      };
      
      leftCol.appendChild(aiToggle);

    row.appendChild(leftCol);

    let optionsDiv = document.createElement('div');
    optionsDiv.style.display = 'flex';
    optionsDiv.style.gap = '6px'; // Reducir un poco el espacio para evitar que desplace elementos
    optionsDiv.style.flexWrap = 'nowrap';

    DB.roles.forEach(r => {
      let img = document.createElement('div');
      img.className = 'role-option' + (selectedSetupRoles[i] === r.id ? ' selected' : '');
      img.style.backgroundImage = `url('${r.icon}')`;
      img.title = r.name;
      img.onclick = () => {
        // Toggle: si ya estaba seleccionado, lo quitamos (excepto para el Jugador 1)
        if (selectedSetupRoles[i] === r.id) {
          if (i !== 0) {
            selectedSetupRoles[i] = null;
            justSelectedRole = { playerIndex: i, roleId: null, wasDeselected: r.id };
          } else {
            return;
          }
        } else {
          selectedSetupRoles[i] = r.id;
          justSelectedRole = { playerIndex: i, roleId: r.id };
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

      // Si este rol acaba de ser seleccionado (o deseleccionado), mostramos la segunda mitad del giro y el cartel
      if (justSelectedRole && justSelectedRole.playerIndex === i && (justSelectedRole.roleId === r.id || justSelectedRole.wasDeselected === r.id)) {
        img.classList.add('card-spin-second-half');
        
        if (justSelectedRole.roleId !== null) {
          let toast = document.createElement('span');
          toast.className = 'role-option-toast';
          toast.style.setProperty('--text-len', r.name.length);
          toast.innerText = r.name.toUpperCase();
          
          img.appendChild(toast);
          
          setTimeout(() => {
            if (toast.parentNode) {
              toast.parentNode.removeChild(toast);
            }
          }, 1500);
        }
      }

      optionsDiv.appendChild(img);
    });

    // Botón para seleccionar un rol aleatorio
    let randomBtn = document.createElement('div');
    randomBtn.className = 'role-option';
    randomBtn.style.display = 'flex';
    randomBtn.style.alignItems = 'center';
    randomBtn.style.justifyContent = 'center';
    randomBtn.style.fontSize = '1.2rem';
    randomBtn.style.fontWeight = 'bold';
    randomBtn.style.color = '#fff';
    randomBtn.style.textShadow = '0 0 5px rgba(255,255,255,0.5)';
    randomBtn.style.background = 'linear-gradient(135deg, rgba(80,80,80,0.4), rgba(40,40,40,0.6))';
    randomBtn.style.border = '2px dashed rgba(255,255,255,0.3)';
    randomBtn.style.width = '35px'; // Aún más estrecho para que encaje bien
    randomBtn.innerText = '?';
    randomBtn.title = 'Rol Aleatorio';
    
    randomBtn.onclick = () => {
      const randomIndex = Math.floor(Math.random() * DB.roles.length);
      const randomRole = DB.roles[randomIndex];
      selectedSetupRoles[i] = randomRole.id;
      justSelectedRole = { playerIndex: i, roleId: randomRole.id, isRandom: true };
      
      // Actualizar visor inmediatamente al elegir aleatorio (sin animación en la carta)
      const previewName = document.getElementById('setup-role-name');
      const previewCard = document.getElementById('setup-role-card');
      const previewEffect = document.getElementById('setup-role-effect');
      if (previewName && previewCard && previewEffect) {
        previewName.innerText = randomRole.name.toUpperCase();
        const miniImage = randomRole.image.replace('rol_', 'mini_rol_');
        previewCard.style.backgroundImage = `url('${miniImage}')`;
        previewEffect.innerText = randomRole.effect;
      }
      
      window._randomBtnClickedAt = Date.now();
      renderRoleSelection();
    };

    randomBtn.onmouseenter = () => {
      // Suprimir el efecto hover si se acaba de hacer clic para permitir ver el rol elegido
      if (window._randomBtnClickedAt && Date.now() - window._randomBtnClickedAt < 1500) {
        return;
      }
      const previewName = document.getElementById('setup-role-name');
      const previewCard = document.getElementById('setup-role-card');
      const previewEffect = document.getElementById('setup-role-effect');
      if (previewName && previewCard && previewEffect) {
        previewName.innerText = 'ALEATORIO';
        previewCard.style.backgroundImage = "url('assets/Roles/back_rol.webp')";
        previewCard.style.backgroundColor = '';
        previewEffect.innerText = 'El sistema elegirá un rol al azar para este jugador.';
      }
    };
    randomBtn.onmouseleave = () => {
      const previewCard = document.getElementById('setup-role-card');
      if (previewCard) previewCard.style.backgroundColor = '';
    };
    
    optionsDiv.appendChild(randomBtn);

    row.appendChild(optionsDiv);
    roleSelectionContainer.appendChild(row);
  }
  
  // Agregar botón para mostrar/ocultar jugadores extra en móviles
  if (window.innerWidth <= 1180) {
    let toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn secondary toggle-players-btn';
    toggleBtn.innerText = roleSelectionContainer.classList.contains('show-all-players') ? 'Ocultar jugadores' : 'Añadir más jugadores...';
    toggleBtn.onclick = () => {
      roleSelectionContainer.classList.toggle('show-all-players');
      renderRoleSelection();
    };
    roleSelectionContainer.appendChild(toggleBtn);
  }

  // Limpiar justSelectedRole al final de toda la selección
  justSelectedRole = null;
  TutorialManager.evaluateSituation();
}


var selectedGoblins = [];

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

function openSettingsModal() {
  if (gameState.players && gameState.players.length > 0) {
    const p = gameState.getCurrentPlayer();
    document.getElementById('input-init-level').value = p.level;
    document.getElementById('range-init-level').value = p.level;

    document.getElementById('input-init-hp').value = p.hp;
    document.getElementById('range-init-hp').value = p.hp;

    document.getElementById('input-init-maxhp').value = p.maxHp;
    document.getElementById('range-init-maxhp').value = p.maxHp;

    document.getElementById('input-init-energy').value = p.energy;
    document.getElementById('range-init-energy').value = p.energy;

    document.getElementById('input-init-gold').value = p.mo;
    document.getElementById('range-init-gold').value = p.mo;

    document.getElementById('input-init-hito').value = gameState.currentHito;
    document.getElementById('range-init-hito').value = gameState.currentHito;

    document.getElementById('input-init-wave').value = gameState.battlefield.waveLevel;
    document.getElementById('range-init-wave').value = gameState.battlefield.waveLevel;

    const selectSettingsSenda = document.getElementById('select-settings-senda');
    if (selectSettingsSenda) {
      selectSettingsSenda.value = gameState.activeSenda;
      if (window.syncCustomSettingsSendaSelect) {
        window.syncCustomSettingsSendaSelect();
      }
    }

    const selectSettingsDifficulty = document.getElementById('select-settings-difficulty');
    if (selectSettingsDifficulty) {
      selectSettingsDifficulty.value = gameState.difficulty || 'medio';
      if (window.syncCustomDifficultySelect) {
        window.syncCustomDifficultySelect();
      }
    }
  } else {
    // Sincronizar desde la pantalla principal al engranaje si la partida no ha empezado
    const selectSettingsSenda = document.getElementById('select-settings-senda');
    const selectSendaMain = document.getElementById('select-senda');
    if (selectSettingsSenda && selectSendaMain) {
      selectSettingsSenda.value = selectSendaMain.value;
      if (window.syncCustomSettingsSendaSelect) {
        window.syncCustomSettingsSendaSelect();
      }
    }
  }
  settingsModal.classList.remove('hidden');
}

// Escuchar en el botón de ajustes principal y en el de configuración inicial
const btnOpenSettings = document.getElementById('btn-open-settings');
if (btnOpenSettings) {
  btnOpenSettings.addEventListener('click', openSettingsModal);
}
const btnOpenSettingsSetup = document.getElementById('btn-open-settings-setup');
if (btnOpenSettingsSetup) {
  btnOpenSettingsSetup.addEventListener('click', openSettingsModal);
}

// --- CUSTOM SELECT, TOOLTIPS Y COMPONENTES DE AJUSTES ---
const difficultyDescriptions = {
  chupado: "<strong>Chupado:</strong> Se invoca 1 Goblin de Nivel 1 por jugador en cada oleada. Ideal para aprender a jugar.",
  facil: "<strong>Fácil:</strong> Se invocan tantos Goblins del nivel de la oleada actual como jugadores. Curva de dificultad muy suave.",
  medio: "<strong>Medio (Recomendado):</strong> Se invocan tantos Goblins de Nivel 1 como jugadores, más un Goblin adicional del nivel de la oleada actual. Dificultad equilibrada.",
  dificil: "<strong>Difícil:</strong> Se invocan tantos Goblins de Nivel 1 como jugadores, más un Goblin de cada nivel superior hasta la oleada actual, incluida. ¡Un auténtico desafío!"
};

function showDifficultyTooltipForValue(selectedValue, targetEl) {
  let tooltip = document.getElementById('difficulty-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'difficulty-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(15, 15, 20, 0.95);
      border: 1px solid var(--gold);
      border-radius: 8px;
      padding: 10px 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.8), 0 0 10px rgba(212,175,55,0.2);
      z-index: 100005;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease-out;
      display: none;
      max-width: 300px;
      font-family: 'Outfit', sans-serif;
      color: #eee;
      font-size: 0.9rem;
      line-height: 1.45;
    `;
    document.body.appendChild(tooltip);
  }

  const desc = difficultyDescriptions[selectedValue] || "Sin descripción disponible.";

  tooltip.innerHTML = `
    <div style="font-weight: bold; color: #ff9f1c; font-family: 'Cinzel', serif; font-size: 0.95rem; border-bottom: 1px solid rgba(212,175,55,0.3); padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
      🎮 MODO DE DIFICULTAD
    </div>
    <div>${desc}</div>
  `;
  tooltip.style.display = 'block';

  const rect = targetEl.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth || 280;
  const tooltipHeight = tooltip.offsetHeight || 80;
  const x = window.scrollX + rect.left + (rect.width / 2) - (tooltipWidth / 2);
  const y = window.scrollY + rect.top - tooltipHeight - 8;

  tooltip.style.left = `${Math.max(10, Math.min(window.innerWidth - tooltipWidth - 10, x))}px`;
  tooltip.style.top = `${Math.max(10, y)}px`;
  tooltip.style.opacity = '1';
}

function hideDifficultyTooltip() {
  const tooltip = document.getElementById('difficulty-tooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
    tooltip.style.display = 'none';
  }
}

function showSendaTooltipForValue(selectedValue, targetEl) {
  let tooltip = document.getElementById('senda-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'senda-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: rgba(15, 15, 20, 0.95);
      border: 1px solid var(--gold);
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.8), 0 0 10px rgba(212,175,55,0.2);
      z-index: 100005;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease-out;
      display: none;
      max-width: 320px;
      font-family: 'Outfit', sans-serif;
      color: #eee;
      font-size: 0.85rem;
      line-height: 1.4;
    `;
    document.body.appendChild(tooltip);
  }

  const names = {
    iniciacion: "Senda de Iniciación",
    guerrero: "Senda de El Zeñor de la Guerra",
    rey_brujo: "Senda de El Rey Brujo",
    recaudador: "Senda de El Gran Recaudador",
    piromante: "Senda de El Piromante",
    cazador: "Senda de El Cazador",
    la_madre: "Senda de La Madre"
  };
  const pathName = names[selectedValue] || selectedValue;

  const rules = DB.sendaReglasGenerales[selectedValue] || [];
  let rulesText = "";
  if (rules.length === 0 || (rules.length === 1 && rules[0].name === "Sin reglas especiales")) {
    rulesText = "<p style='margin: 0; color: #aaa; font-style: italic;'>Sin reglas adicionales de entorno.</p>";
  } else {
    rules.forEach(rule => {
      rulesText += `<div style='margin-bottom: 6px;'>
        <strong style='color: #fff;'>${rule.name}:</strong> 
        <span style='color: #ccc;'>${rule.desc.replace(/<BR>/gi, ' ')}</span>
      </div>`;
    });
  }

  const sendaHitos = DB.hitos[selectedValue] || [];
  const bossHito = sendaHitos.find(h => h.isBoss);
  const bossText = bossHito ? `<div style='margin-top: 8px; border-top: 1px solid rgba(212,175,55,0.2); padding-top: 6px; color: var(--accent-red); font-weight: bold;'>👿 Jefe: ${bossHito.name}</div>` : "";

  tooltip.innerHTML = `
    <div style="font-weight: bold; color: var(--gold); font-family: 'Cinzel', serif; font-size: 0.95rem; border-bottom: 1px solid rgba(212,175,55,0.3); padding-bottom: 4px; margin-bottom: 8px;">
      🗺️ ${pathName.toUpperCase()}
    </div>
    <div>${rulesText}</div>
    ${bossText}
  `;
  tooltip.style.display = 'block';

  const rect = targetEl.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth || 300;
  const tooltipHeight = tooltip.offsetHeight || 100;
  const x = window.scrollX + rect.left + (rect.width / 2) - (tooltipWidth / 2);
  const y = window.scrollY + rect.top - tooltipHeight - 8;

  tooltip.style.left = `${Math.max(10, Math.min(window.innerWidth - tooltipWidth - 10, x))}px`;
  tooltip.style.top = `${Math.max(10, y)}px`;
  tooltip.style.opacity = '1';
}

function hideSendaTooltip() {
  const tooltip = document.getElementById('senda-tooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
    tooltip.style.display = 'none';
  }
}

function closeAllCustomSelects() {
  document.querySelectorAll('.custom-select-options').forEach(el => {
    el.style.display = 'none';
    const arrowEl = el.previousElementSibling.querySelector('span:last-child');
    if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';
  });
  hideDifficultyTooltip();
  hideSendaTooltip();
}

function createCustomDifficultySelect() {
  const nativeSelect = document.getElementById('select-settings-difficulty');
  if (!nativeSelect) return;

  const existingContainer = nativeSelect.nextElementSibling;
  if (existingContainer && existingContainer.classList.contains('custom-select-container')) {
    existingContainer.remove();
  }

  nativeSelect.style.display = 'none';

  const container = document.createElement('div');
  container.className = 'custom-select-container';
  container.style.cssText = `
    position: relative;
    width: 100%;
    box-sizing: border-box;
  `;

  const trigger = document.createElement('div');
  trigger.className = 'custom-select-trigger';
  trigger.style.cssText = `
    padding: 6px 10px;
    border-radius: 6px;
    border: 2px solid #ff9f1c;
    background: #0a0a0a;
    color: #fff;
    font-size: 0.95rem;
    font-family: 'Outfit', sans-serif;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-sizing: border-box;
    transition: all 0.2s;
  `;
  
  const triggerText = document.createElement('span');
  triggerText.textContent = nativeSelect.options[nativeSelect.selectedIndex]?.text || 'Fácil';
  trigger.appendChild(triggerText);

  const arrow = document.createElement('span');
  arrow.innerHTML = '&#9662;';
  arrow.style.cssText = `
    font-size: 0.8rem;
    color: #ff9f1c;
    transition: transform 0.2s;
    margin-left: 6px;
  `;
  trigger.appendChild(arrow);
  container.appendChild(trigger);

  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'custom-select-options';
  optionsContainer.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #0d0d0f;
    border: 2px solid #ff9f1c;
    border-radius: 6px;
    margin-top: 4px;
    z-index: 100000;
    box-shadow: 0 8px 24px rgba(0,0,0,0.9);
    display: none;
    overflow: hidden;
    box-sizing: border-box;
  `;

  const optionsList = Array.from(nativeSelect.options);
  optionsList.forEach(opt => {
    const optEl = document.createElement('div');
    optEl.className = 'custom-select-option';
    optEl.dataset.value = opt.value;
    optEl.textContent = opt.text;
    
    const isSelected = opt.value === nativeSelect.value;
    
    optEl.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      font-family: 'Outfit', sans-serif;
      color: ${isSelected ? '#ff9f1c' : '#ccc'};
      font-weight: ${isSelected ? 'bold' : 'normal'};
      font-size: 0.95rem;
      background: ${isSelected ? 'rgba(255, 159, 28, 0.08)' : 'transparent'};
      border-left: 3px solid ${isSelected ? '#ff9f1c' : 'transparent'};
      transition: all 0.15s;
    `;

    optEl.addEventListener('mouseenter', () => {
      optEl.style.background = 'rgba(255, 159, 28, 0.15)';
      optEl.style.color = '#ff9f1c';
      showDifficultyTooltipForValue(opt.value, optEl);
    });

    optEl.addEventListener('mouseleave', () => {
      const currentSelected = nativeSelect.value === opt.value;
      optEl.style.background = currentSelected ? 'rgba(255, 159, 28, 0.08)' : 'transparent';
      optEl.style.color = currentSelected ? '#ff9f1c' : '#ccc';
      hideDifficultyTooltip();
    });

    optEl.addEventListener('click', (e) => {
      e.stopPropagation();
      nativeSelect.value = opt.value;
      triggerText.textContent = opt.text;
      optionsContainer.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
      hideDifficultyTooltip();

      Array.from(optionsContainer.children).forEach(child => {
        const childVal = child.dataset.value;
        const childSelected = childVal === opt.value;
        child.style.color = childSelected ? '#ff9f1c' : '#ccc';
        child.style.fontWeight = childSelected ? 'bold' : 'normal';
        child.style.background = childSelected ? 'rgba(255, 159, 28, 0.08)' : 'transparent';
        child.style.borderLeft = `3px solid ${childSelected ? '#ff9f1c' : 'transparent'}`;
      });
      
      const event = new Event('change');
      nativeSelect.dispatchEvent(event);
    });

    optionsContainer.appendChild(optEl);
  });

  container.appendChild(optionsContainer);
  nativeSelect.parentNode.insertBefore(container, nativeSelect.nextSibling);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = optionsContainer.style.display === 'block';
    closeAllCustomSelects();

    if (!isOpen) {
      optionsContainer.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
      showDifficultyTooltipForValue(nativeSelect.value, trigger);
    }
  });

  trigger.addEventListener('mouseenter', () => {
    if (optionsContainer.style.display !== 'block') {
      showDifficultyTooltipForValue(nativeSelect.value, trigger);
    }
  });
  trigger.addEventListener('mouseleave', () => {
    if (optionsContainer.style.display !== 'block') {
      hideDifficultyTooltip();
    }
  });

  window.syncCustomDifficultySelect = () => {
    const activeIndex = nativeSelect.selectedIndex;
    const activeOpt = nativeSelect.options[activeIndex];
    if (activeOpt) {
      triggerText.textContent = activeOpt.text;
      
      Array.from(optionsContainer.children).forEach(child => {
        const childVal = child.dataset.value;
        const childSelected = childVal === activeOpt.value;
        child.style.color = childSelected ? '#ff9f1c' : '#ccc';
        child.style.fontWeight = childSelected ? 'bold' : 'normal';
        child.style.background = childSelected ? 'rgba(255, 159, 28, 0.08)' : 'transparent';
        child.style.borderLeft = `3px solid ${childSelected ? '#ff9f1c' : 'transparent'}`;
      });
    }
  };
}

function createCustomSendaSelect(selectId) {
  const nativeSelect = document.getElementById(selectId);
  if (!nativeSelect) return;

  const existingContainer = nativeSelect.nextElementSibling;
  if (existingContainer && existingContainer.classList.contains('custom-select-container')) {
    existingContainer.remove();
  }

  nativeSelect.style.display = 'none';

  // Create a single button replacing the container element
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'custom-select-container custom-senda-select-btn';
  button.style.cssText = `
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 2px solid var(--gold);
    background: #0a0a0a;
    color: #fff;
    font-size: 1rem;
    font-family: 'Outfit', sans-serif;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-sizing: border-box;
    transition: all 0.2s;
  `;
  
  if (selectId === 'select-settings-senda') {
    button.style.padding = '6px 10px';
    button.style.borderRadius = '6px';
    button.style.fontSize = '0.95rem';
  }
  
  const triggerText = document.createElement('span');
  triggerText.textContent = nativeSelect.options[nativeSelect.selectedIndex]?.text || '';
  button.appendChild(triggerText);

  const arrow = document.createElement('span');
  arrow.innerHTML = '&#9662;'; // Flecha abajo
  arrow.style.cssText = `
    font-size: 0.8rem;
    color: var(--gold);
    margin-left: 6px;
  `;
  button.appendChild(arrow);

  nativeSelect.parentNode.insertBefore(button, nativeSelect.nextSibling);

  // Abrir la pantalla modal de selección
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllCustomSelects();
    openSendaSelectionScreen(selectId);
  });

  // Hover en el trigger para mostrar el tooltip
  button.addEventListener('mouseenter', () => {
    showSendaTooltipForValue(nativeSelect.value, button);
  });
  button.addEventListener('mouseleave', () => {
    hideSendaTooltip();
  });

  const syncFunc = () => {
    const activeOpt = nativeSelect.options[nativeSelect.selectedIndex];
    if (activeOpt) {
      triggerText.textContent = activeOpt.text;
    }
  };

  if (selectId === 'select-settings-senda') {
    window.syncCustomSettingsSendaSelect = syncFunc;
  } else {
    window.syncCustomSendaSelect = syncFunc;
  }
}

let selectedSendaValue = 'iniciacion';
let currentSendaTargetSelectId = 'select-senda';

function initSendaSelectionScreen() {
  if (document.getElementById('senda-selection-screen')) return;

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .split-card-screen {
      --senda-card-w: 310px;
      --senda-card-h: 440px;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(10, 10, 12, 0.98);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      z-index: 110000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      box-sizing: border-box;
      padding: 40px 20px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      overflow-y: auto;
    }
    .split-card-screen.visible {
      opacity: 1;
      pointer-events: auto;
    }
    .split-card-container {
      position: relative;
      display: flex;
      flex-direction: row;
      gap: 24px;
      justify-content: flex-start;
      align-items: center;
      max-width: 98%;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 30px 15px;
      box-sizing: border-box;
      margin-bottom: 25px;
      flex-shrink: 0;
    }
    .split-card-container::-webkit-scrollbar {
      height: 8px;
    }
    .split-card-container::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
    }
    .split-card-container::-webkit-scrollbar-thumb {
      background: var(--gold);
      border-radius: 4px;
    }

    .senda-card-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .senda-card-header {
      text-align: center;
      font-family: 'Cinzel', serif;
      font-weight: bold;
      color: var(--gold);
      font-size: 1rem;
      min-height: 50px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 4px;
    }
    .senda-card-stars {
      color: #ff9f1c;
      font-size: 0.9rem;
      letter-spacing: 2px;
    }

    .split-card {
      position: relative;
      width: var(--senda-card-w);
      height: var(--senda-card-h);
      border-radius: 12px;
      border: 2px solid rgba(212, 175, 55, 0.4);
      background: #000;
      overflow: hidden;
      cursor: pointer;
      box-shadow: 0 8px 25px rgba(0,0,0,0.8);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-sizing: border-box;
    }

    .split-card.selected {
      border: 3px solid var(--gold);
      box-shadow: 0 0 30px rgba(212,175,55,0.6), inset 0 0 15px rgba(212,175,55,0.2);
      transform: translateY(-8px) scale(1.02);
    }

    .split-card .half-left,
    .split-card .half-right {
      position: absolute;
      top: 0;
      height: 100%;
      overflow: hidden;
      transition: width 0.35s ease;
      box-sizing: border-box;
    }

    .split-card .half-left {
      left: 0;
      width: 50%;
      border-right: 1.5px solid rgba(212, 175, 55, 0.4);
      z-index: 2;
    }

    .split-card .half-right {
      right: 0;
      width: 50%;
      z-index: 2;
    }

    .split-card .card-image {
      position: absolute;
      top: 0;
      height: 100%;
      width: calc(var(--senda-card-w) - 4px);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      transition: left 0.35s ease, width 0.35s ease;
    }

    .split-card .boss-img {
      left: 0;
      background-position: left center;
    }

    .split-card .rules-img {
      left: 0;
      background-position: left center;
    }

    .split-card:has(.half-left:hover) .half-left {
      width: 100%;
      border-right-color: transparent;
      z-index: 3;
    }
    .split-card:has(.half-left:hover) .half-right {
      width: 0%;
    }

    .split-card:has(.half-right:hover) .half-right {
      width: 100%;
      z-index: 3;
    }
    .split-card:has(.half-right:hover) .half-left {
      width: 0%;
      border-right-color: transparent;
    }

    .split-card.show-left .half-left { width: 100% !important; border-right-color: transparent !important; z-index: 3 !important; }
    .split-card.show-left .half-right { width: 0% !important; }
    .split-card.show-right .half-right { width: 100% !important; z-index: 3 !important; }
    .split-card.show-right .half-left { width: 0% !important; border-right-color: transparent !important; }

    .split-card-btn-container {
      display: flex;
      gap: 20px;
      margin-top: 15px;
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      .split-card-screen {
        --senda-card-w: 180px;
        --senda-card-h: 252px;
        padding: 15px 10px;
      }
      .split-card-container {
        gap: 12px;
        padding: 10px 5px;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
      }
      .senda-card-wrapper {
        scroll-snap-align: center;
        gap: 6px;
      }
      .split-card-screen h2 {
        font-size: 1.3rem !important;
      }
      .split-card-screen p {
        font-size: 0.8rem !important;
        margin-bottom: 2px !important;
      }
      .senda-card-header {
        font-size: 0.75rem;
        min-height: 32px;
      }
      .senda-card-stars {
        font-size: 0.65rem;
        letter-spacing: 1px;
      }
      .split-card-btn-container button {
        padding: 6px 16px !important;
        font-size: 0.8rem !important;
      }
    }
  `;
  document.head.appendChild(styleEl);

  const screen = document.createElement('div');
  screen.id = 'senda-selection-screen';
  screen.className = 'split-card-screen';
  
  const title = document.createElement('h2');
  title.innerText = "SELECCIONA TU SENDA";
  title.style.cssText = "margin: 0 0 5px 0; color: var(--gold); font-family: 'Cinzel', serif; font-size: 2.2rem; letter-spacing: 2px; text-shadow: 0 2px 10px rgba(0,0,0,0.5); flex-shrink: 0;";
  screen.appendChild(title);

  const subtitle = document.createElement('p');
  subtitle.innerText = "Descubre las reglas de cada senda y su jefe final antes de comenzar tu aventura.";
  subtitle.style.cssText = "margin: 0 0 10px 0; color: #aaa; font-family: 'Outfit', sans-serif; font-size: 1rem; text-align: center; flex-shrink: 0;";
  screen.appendChild(subtitle);

  const container = document.createElement('div');
  container.className = 'split-card-container';
  screen.appendChild(container);

  const sendasData = [
    { value: 'iniciacion', name: 'Senda de Iniciación', stars: '★', bossImg: 'assets/Monstruos/Jefes/Inicicion.webp', rulesImg: 'assets/Monstruos/Jefes/reglas_Inicicion.webp' },
    { value: 'guerrero', name: 'Senda de El Zeñor de la Guerra', stars: '★★', bossImg: 'assets/Monstruos/Jefes/Señor-de-la-Guerra.webp', rulesImg: 'assets/Monstruos/Jefes/reglas_Señor-de-la-Guerra.webp' },
    { value: 'rey_brujo', name: 'Senda de El Rey Brujo', stars: '★★★', bossImg: 'assets/Monstruos/Jefes/Rey-Brujo.webp', rulesImg: 'assets/Monstruos/Jefes/reglas_Rey-Brujo.webp' },
    { value: 'recaudador', name: 'Senda de El Gran Recaudador', stars: '★★★', bossImg: 'assets/Monstruos/Jefes/Gran-Recaudador.webp', rulesImg: 'assets/Monstruos/Jefes/reglas_Gran-Recaudador.webp' },
    { value: 'piromante', name: 'Senda de El Piromante', stars: '★★★★', bossImg: 'assets/Monstruos/Jefes/El-Piromante.webp', rulesImg: 'assets/Monstruos/Jefes/reglas_El-Piromante.webp' },
    { value: 'cazador', name: 'Senda de El Cazador', stars: '★★★★', bossImg: 'assets/Monstruos/Jefes/El-Cazador.webp', rulesImg: 'assets/Monstruos/Jefes/reglas_El-Cazador.webp' },
    { value: 'la_madre', name: 'Senda de La Madre', stars: '★★★★★', bossImg: 'assets/Monstruos/Jefes/La-Madre.webp', rulesImg: 'assets/Monstruos/Jefes/reglas_La-Madre.webp' }
  ];

  sendasData.forEach(senda => {
    const wrapper = document.createElement('div');
    wrapper.className = 'senda-card-wrapper';

    const header = document.createElement('div');
    header.className = 'senda-card-header';
    header.innerHTML = `
      <div>${senda.name}</div>
      <div class="senda-card-stars">${senda.stars}</div>
    `;
    wrapper.appendChild(header);

    const card = document.createElement('div');
    card.className = 'split-card';
    card.dataset.value = senda.value;

    const halfLeft = document.createElement('div');
    halfLeft.className = 'half-left';
    const bossImg = document.createElement('div');
    bossImg.className = 'card-image boss-img';
    bossImg.style.backgroundImage = `url('${senda.bossImg}')`;
    halfLeft.appendChild(bossImg);
    card.appendChild(halfLeft);

    const halfRight = document.createElement('div');
    halfRight.className = 'half-right';
    const rulesImg = document.createElement('div');
    rulesImg.className = 'card-image rules-img';
    rulesImg.style.backgroundImage = `url('${senda.rulesImg}')`;
    halfRight.appendChild(rulesImg);
    card.appendChild(halfRight);

    card.addEventListener('click', (e) => {
      if (card.classList.contains('selected')) {
        let isClickingRight = e.target.closest('.half-right') !== null;
        
        if (card.classList.contains('show-right')) {
          card.classList.remove('show-right');
          card.classList.add('show-left');
        } else if (card.classList.contains('show-left')) {
          card.classList.remove('show-left');
          card.classList.add('show-right');
        } else {
          // Si no tiene clases, significa que lo vemos por CSS hover.
          // Alternamos a la contraria de donde se hizo click.
          if (isClickingRight) {
            card.classList.add('show-left');
          } else {
            card.classList.add('show-right');
          }
        }
      } else {
        container.querySelectorAll('.split-card').forEach(c => {
          c.classList.remove('selected', 'show-left', 'show-right');
        });
        card.classList.add('selected');
        selectedSendaValue = senda.value;
      }
    });

    card.addEventListener('dblclick', () => {
      container.querySelectorAll('.split-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedSendaValue = senda.value;
      btnConfirm.click();
    });

    wrapper.appendChild(card);
    container.appendChild(wrapper);
  });

  const btnContainer = document.createElement('div');
  btnContainer.className = 'split-card-btn-container';
  
  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn secondary';
  btnCancel.innerText = "CANCELAR";
  btnCancel.style.padding = "10px 30px";
  btnCancel.addEventListener('click', () => {
    screen.classList.remove('visible');
  });

  const btnConfirm = document.createElement('button');
  btnConfirm.className = 'btn primary';
  btnConfirm.innerText = "CONFIRMAR SENDA";
  btnConfirm.style.padding = "10px 40px";
  btnConfirm.addEventListener('click', () => {
    const targetSelect = document.getElementById(currentSendaTargetSelectId);
    if (targetSelect) {
      targetSelect.value = selectedSendaValue;
      
      const triggerBtn = targetSelect.nextElementSibling;
      if (triggerBtn && triggerBtn.classList.contains('custom-select-container')) {
        const textSpan = triggerBtn.querySelector('span');
        const nativeOpt = targetSelect.options[targetSelect.selectedIndex];
        if (textSpan && nativeOpt) {
          textSpan.textContent = nativeOpt.text;
        }
      }

      const event = new Event('change');
      targetSelect.dispatchEvent(event);
    }
    screen.classList.remove('visible');
  });
  btnContainer.appendChild(btnConfirm);
  btnContainer.appendChild(btnCancel);

  screen.appendChild(btnContainer);
  document.body.appendChild(screen);
}

function openSendaSelectionScreen(targetSelectId) {
  initSendaSelectionScreen();

  currentSendaTargetSelectId = targetSelectId;
  const nativeSelect = document.getElementById(targetSelectId);
  if (nativeSelect) {
    selectedSendaValue = nativeSelect.value;
  }

  const screen = document.getElementById('senda-selection-screen');
  if (screen) {
    screen.querySelectorAll('.split-card').forEach(card => {
      if (card.dataset.value === selectedSendaValue) {
        card.classList.add('selected');
        setTimeout(() => {
          const container = screen.querySelector('.split-card-container');
          const wrapper = card.parentElement;
          if (container && wrapper) {
            const scrollLeftToSet = wrapper.offsetLeft - (container.clientWidth / 2) + (wrapper.clientWidth / 2);
            container.scrollTo({ left: scrollLeftToSet, behavior: 'smooth' });
          }
        }, 50);
      } else {
        card.classList.remove('selected');
      }
    });

    screen.classList.add('visible');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    createCustomDifficultySelect();
    createCustomSendaSelect('select-senda');
    createCustomSendaSelect('select-settings-senda');
    initSendaSelectionScreen();
  });
} else {
  createCustomDifficultySelect();
  createCustomSendaSelect('select-senda');
  createCustomSendaSelect('select-settings-senda');
  initSendaSelectionScreen();
}

// Click global para cerrar
document.addEventListener('click', () => {
  closeAllCustomSelects();
});


document.getElementById('btn-close-settings-x').addEventListener('click', () => {
  closeAllCustomSelects();
  settingsModal.classList.add('hidden');
});

document.getElementById('btn-save-settings').addEventListener('click', () => {
  if (gameState.players && gameState.players.length > 0) {
    const level = parseInt(document.getElementById('input-init-level').value, 10);
    const hp = parseInt(document.getElementById('input-init-hp').value, 10);
    const maxHp = parseInt(document.getElementById('input-init-maxhp').value, 10);
    const energy = parseInt(document.getElementById('input-init-energy').value, 10);
    const gold = parseInt(document.getElementById('input-init-gold').value, 10);
    const hito = parseInt(document.getElementById('input-init-hito').value, 10);
    const wave = parseInt(document.getElementById('input-init-wave').value, 10);
    const selectSettingsSenda = document.getElementById('select-settings-senda');
    const senda = selectSettingsSenda ? selectSettingsSenda.value : gameState.activeSenda;
    const selectSettingsDifficulty = document.getElementById('select-settings-difficulty');
    const difficulty = selectSettingsDifficulty ? selectSettingsDifficulty.value : (gameState.difficulty || 'medio');

    // Actualizar jugadores
    gameState.players.forEach(pl => {
      gameState.adjustDicePoolToLevel(pl, level);
      pl.level = level;
      pl.hp = hp;
      pl.maxHp = maxHp;
      pl.energy = energy;
      pl.mo = gold;
    });

    // Actualizar entorno
    gameState.currentHito = hito;
    gameState.battlefield.waveLevel = wave;
    lastWaveLevel = wave;
    gameState.activeSenda = senda;
    gameState.difficulty = difficulty;

    // Guardar partida y refrescar UI
    updateUI();
    if (typeof window !== 'undefined' && window.saveGame) {
      window.saveGame(true);
    }
  } else {
    // Sincronizar desde el engranaje a la pantalla principal si la partida no ha empezado
    const selectSettingsSenda = document.getElementById('select-settings-senda');
    const selectSendaMain = document.getElementById('select-senda');
    if (selectSettingsSenda && selectSendaMain) {
      selectSendaMain.value = selectSettingsSenda.value;
      // Actualizar la interfaz personalizada de la pantalla de inicio
      const triggerBtn = selectSendaMain.nextElementSibling;
      if (triggerBtn && triggerBtn.classList.contains('custom-select-container')) {
        const textSpan = triggerBtn.querySelector('span');
        const nativeOpt = selectSendaMain.options[selectSendaMain.selectedIndex];
        if (textSpan && nativeOpt) {
          textSpan.textContent = nativeOpt.text;
        }
      }
      if (typeof window.updateSetupSendaPreview === 'function') {
        window.updateSetupSendaPreview();
      }
    }
  }
  closeAllCustomSelects();
  settingsModal.classList.add('hidden');
});

btnStartGame.addEventListener('click', () => {
  const finalRoles = [];
  const finalBots = [];
  for (let i = 0; i < 4; i++) {
    if (selectedSetupRoles[i] !== null) {
      finalRoles.push(selectedSetupRoles[i]);
      finalBots.push(selectedSetupBots[i]);
    }
  }

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

  const selectDifficultyEl = document.getElementById('select-settings-difficulty');
  const initDifficulty = selectDifficultyEl ? selectDifficultyEl.value : 'facil';

  const rawWave = parseInt(document.getElementById('input-init-wave').value, 10);
  const initWave = isNaN(rawWave) ? 1 : rawWave;
  lastWaveLevel = initWave - 1; // Force wave announcement on start
  lastActionCount = -1; // Force action announcement on start
  lastActivePlayerUid = null;
  removeInitialFocusHighlights();

  gameState.setupPlayers(numPlayers, finalRoles, { hp: initHp, maxHp: initMaxHp, energy: initEnergy, mo: initGold, hito: initHito, level: initLevel, wave: initWave, senda: initSenda, difficulty: initDifficulty }, finalBots);
  setupModal.classList.add('hidden');
  const versionBadge = document.getElementById('game-version-badge');
  if (versionBadge) versionBadge.style.display = 'none';
  gameState.isFirstTurnOfGame = true;
  updateUI();

  if (typeof window !== 'undefined' && window.saveGame) {
    window.saveGame(true);
  }
});

document.getElementById('btn-gold').addEventListener('click', () => {
  const btn = document.getElementById('btn-gold');
  window.animateGoldDrop(btn, 1);
  gameState.performActionGold();
  updateUI();
});

document.getElementById('btn-gold-dmg').addEventListener('click', () => {
  const btn = document.getElementById('btn-gold-dmg');
  window.animateGoldDrop(btn, 2);
  gameState.performActionGoldAndDamage();
  updateUI();
});

document.getElementById('btn-end-turn').addEventListener('click', () => {
  gameState.nextTurn();
  updateUI();
});

window.showHitoGoblinsTooltip = function(e) {
  if (gameState.currentHito > 5) return;
  const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;
  const nextHito = sendaHitos[gameState.currentHito - 1];
  if (!nextHito || !nextHito.goblins) return;

  let tooltip = document.getElementById('hito-goblins-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'hito-goblins-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: transparent;
      border: none;
      box-shadow: none;
      z-index: 99999;
      pointer-events: none !important;
      opacity: 0;
      transition: opacity 0.15s ease-out;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 0px;
      flex-direction: column;
    `;
    document.body.appendChild(tooltip);
  } else {
    tooltip.style.flexDirection = 'column';
  }

  const cardHeight = 140;
  const cardWidth = 60; // Proporción exacta 214x502 para 140px de alto (140 * 214/502 = 59.7px)
  const overlap = 20;  // Solape de exactamente 1/3 (20px)
  const numGoblins = nextHito.goblins.length;
  const calculatedWidth = numGoblins === 1 ? cardWidth : cardWidth + (numGoblins - 1) * (cardWidth - overlap);

  const btnEl = document.getElementById('btn-deploy-hito');
  const btnWidth = btnEl ? btnEl.getBoundingClientRect().width : 220;

  const textHtml = `
    <div style="background: rgba(15, 10, 25, 0.96); border: 2px solid var(--gold); border-radius: 8px; padding: 8px 12px; color: #cbd5e1; text-align: center; font-size: 0.8rem; box-shadow: 0 4px 15px rgba(0,0,0,0.8); max-width: ${btnWidth}px; width: ${btnWidth}px; box-sizing: border-box; margin-bottom: 10px; backdrop-filter: blur(5px); font-family: 'Inter', sans-serif; font-weight: normal; line-height: 1.35;">
      ${nextHito.ruleDesc || 'Sin reglas especiales.'}
    </div>
  `;

  const goblinsHtml = `
    <div style="display: flex; flex-direction: row; align-items: center; justify-content: center; width: ${calculatedWidth}px; height: ${cardHeight}px;">
      ${nextHito.goblins.map((lvl, idx) => {
        const overlapStyle = idx > 0 ? `margin-left: -${overlap}px !important;` : '';
        let imgSrc = `assets/Monstruos/t${lvl}.webp`;
        if (lvl === 5 && nextHito.bossStats && nextHito.bossStats.image) {
          const parts = nextHito.bossStats.image.split('/');
          const fileWithExt = parts[parts.length - 1];
          const bossName = fileWithExt.substring(0, fileWithExt.lastIndexOf('.'));
          imgSrc = `assets/Monstruos/Jefes/t5_${bossName}.webp`;
        }
        return `<img src="${imgSrc}" style="height: ${cardHeight}px !important; width: ${cardWidth}px !important; flex-shrink: 0 !important; pointer-events: none !important; border-radius: 6px; border: none; box-shadow: none; opacity: 0.95; display: block; position: relative; z-index: ${idx}; ${overlapStyle}" alt="G${lvl}">`;
      }).join('')}
    </div>
  `;

  tooltip.innerHTML = textHtml + goblinsHtml;
  tooltip.style.display = 'flex';
  tooltip.style.width = 'auto';
  tooltip.style.height = 'auto';

  const targetBtn = e.currentTarget || e.target;
  if (!targetBtn) return;
  
  const rect = targetBtn.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth || btnWidth;
  const tooltipHeight = tooltip.offsetHeight || (cardHeight + 70);
  
  // Determinamos de forma precisa si es el botón del pie de página (o de información de hitos)
  // para usar alineación a la izquierda, o centrado para botones del campo de batalla.
  let leftPos;
  const isFooterButton = targetBtn.id === 'btn-deploy-hito' || targetBtn.id === 'btn-info-hitos' || targetBtn.closest('#hito-actions');
  if (isFooterButton) {
    leftPos = window.scrollX + rect.left;
  } else {
    leftPos = window.scrollX + rect.left + (rect.width / 2) - (tooltipWidth / 2);
  }
  
  const y = window.scrollY + rect.top - tooltipHeight - 8;

  tooltip.style.left = `${Math.max(10, Math.min(window.innerWidth - tooltipWidth - 10, leftPos))}px`;
  tooltip.style.top = `${Math.max(10, y)}px`;
  tooltip.style.opacity = '1';
};

window.hideHitoGoblinsTooltip = function() {
  const tooltip = document.getElementById('hito-goblins-tooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
    tooltip.style.display = 'none';
  }
};

window.showSendaRulesTooltip = function(e) {
  const btnDeployHito = document.getElementById('btn-deploy-hito');
  const btnInfoHitos = document.getElementById('btn-info-hitos');
  const hitoActions = document.getElementById('hito-actions');
  let combinedWidth = 255;
  if (hitoActions) {
    combinedWidth = hitoActions.getBoundingClientRect().width;
  } else if (btnDeployHito && btnInfoHitos) {
    combinedWidth = btnDeployHito.getBoundingClientRect().width + btnInfoHitos.getBoundingClientRect().width + 5;
  } else if (btnDeployHito) {
    combinedWidth = btnDeployHito.getBoundingClientRect().width + 35;
  }

  const generalRules = DB.sendaReglasGenerales[gameState.activeSenda] || [];
  let rulesHtml = '';
  if (generalRules.length === 0) {
    rulesHtml = '<div style="color: #cbd5e1; font-size: 0.8rem; font-style: italic;">Sin reglas especiales.</div>';
  } else {
    rulesHtml = generalRules.map((rule, idx) => {
      const marginStyle = idx < generalRules.length - 1 ? 'margin-bottom: 8px;' : '';
      return `<div style="${marginStyle} text-align: left;">
        <strong style="color: var(--gold); display: block; margin-bottom: 3px; font-size: 0.82rem; font-family: 'Cinzel', serif;">${rule.name}</strong>
        <div style="font-size: 0.76rem; color: #cbd5e1; line-height: 1.35;">${rule.desc}</div>
      </div>`;
    }).join('');
  }

  let tooltip = document.getElementById('senda-rules-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'senda-rules-tooltip';
    tooltip.style.cssText = `
      position: absolute;
      background: transparent;
      border: none;
      box-shadow: none;
      z-index: 99999;
      pointer-events: none !important;
      opacity: 0;
      transition: opacity 0.15s ease-out;
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    `;
    document.body.appendChild(tooltip);
  }

  tooltip.innerHTML = `
    <div style="background: rgba(15, 10, 25, 0.96); border: 2px solid var(--gold); border-radius: 8px; padding: 10px 12px; color: #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.8); max-width: ${combinedWidth}px; width: ${combinedWidth}px; box-sizing: border-box; backdrop-filter: blur(5px); font-family: 'Inter', sans-serif; font-weight: normal;">
      ${rulesHtml}
    </div>
  `;

  tooltip.style.display = 'flex';
  tooltip.style.width = 'auto';
  tooltip.style.height = 'auto';

  const targetBtn = e.currentTarget || e.target;
  if (!targetBtn) return;

  const rect = targetBtn.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth || combinedWidth;
  const tooltipHeight = tooltip.offsetHeight || 80;

  const refBtn = btnDeployHito || targetBtn;
  const refRect = refBtn.getBoundingClientRect();
  const leftPos = window.scrollX + refRect.left;

  const y = window.scrollY + rect.top - tooltipHeight - 8;

  tooltip.style.left = `${Math.max(10, Math.min(window.innerWidth - tooltipWidth - 10, leftPos))}px`;
  tooltip.style.top = `${Math.max(10, y)}px`;
  tooltip.style.opacity = '1';
};

window.hideSendaRulesTooltip = function() {
  const tooltip = document.getElementById('senda-rules-tooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
    tooltip.style.display = 'none';
  }
};

const btnDeployHito = document.getElementById('btn-deploy-hito');
btnDeployHito.addEventListener('click', () => {
  window.hideHitoGoblinsTooltip();
  
  if (gameState.currentHito > 5) return;

  // Validar si ya hay Goblins de Hito activos
  if (gameState.battlefield.goblins.some(g => g.isHito)) {
    gameState.addLog("⚠️ No se puede desplegar un nuevo Hito mientras haya Goblins de Hito en la mesa.");
    updateUI();
    return;
  }

  const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;
  const hitoToDeploy = sendaHitos[gameState.currentHito - 1];

  if (!hitoToDeploy) return;

  window.showHitoConfirmModal(hitoToDeploy, () => {
    if (gameState.deployHito()) {
      updateUI();
    }
  });
});
btnDeployHito.addEventListener('mouseenter', window.showHitoGoblinsTooltip);
btnDeployHito.addEventListener('mouseleave', window.hideHitoGoblinsTooltip);

function openHitosModal() {
  const modal = document.getElementById('hitos-modal');
  const content = document.getElementById('hitos-info-content');
  const bossPreview = document.getElementById('hitos-boss-preview');

  const titleEl = modal.querySelector('h2');
  if (titleEl) {
    const sendaNames = {
      iniciacion: "Senda de Iniciaci\u00F3n",
      guerrero: "Senda de El Ze\u00F1or de la Guerra",
      rey_brujo: "Senda de El Rey Brujo",
      recaudador: "Senda de El Gran Recaudador",
      piromante: "Senda de El Piromante",
      cazador: "Senda de El Cazador",
      la_madre: "Senda de La Madre"
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
      : hito.goblins.map(lvl => `<img src="assets/Monstruos/t${lvl}.webp" style="height: 50px; vertical-align: middle; margin: 0 4px;" alt="G${lvl}">`).join(' ');

    if (hito.isBoss && hito.bossStats.image) {
      bossImgHTML = `<div style="width: 100%; max-width: 261px; max-height: 373px; aspect-ratio: 2.5/3.5; background-image: url('${hito.bossStats.image}'); background-size: cover; background-position: center; border-radius: 10px; border: 2px solid #9d4edd; box-shadow: 0 0 20px rgba(157,78,221,0.5); margin: 0 auto;"></div>`;
    }

    const isCompleted = hito.id < gameState.currentHito;
    const bgStyle = isCompleted ? 'background: rgba(27, 67, 50, 0.7); border: 1px solid #52b788;' : 'background: rgba(0,0,0,0.6); border: 1px solid rgba(212, 175, 55, 0.5);';
    const titleColor = isCompleted ? '#74c69d' : 'var(--accent-red)';
    const badgeHTML = isCompleted ? `<div style="background: #2d6a4f; color: white; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; border: 1px solid #52b788; box-shadow: 0 0 10px rgba(82,183,136,0.5);">&#10003;</div>` : '';

    let ruleHTML = '';
    if (hito.ruleDesc && !hito.isBoss) {
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

const btnInfoHitos = document.getElementById('btn-info-hitos');
if (btnInfoHitos) {
  btnInfoHitos.addEventListener('click', () => {
    window.hideSendaRulesTooltip();
    openHitosModal();
  });
  btnInfoHitos.addEventListener('mouseenter', window.showSendaRulesTooltip);
  btnInfoHitos.addEventListener('mouseleave', window.hideSendaRulesTooltip);
}

document.getElementById('btn-close-hitos').addEventListener('click', () => {
  document.getElementById('hitos-modal').classList.add('hidden');
});

document.getElementById('btn-close-hito-rule-notif').addEventListener('click', () => {
  document.getElementById('hito-rule-notification-modal').classList.add('hidden');
});

window.showHitoConfirmModal = function(hitoObj, onAccept) {
  const overlay = document.getElementById('hito-confirm-modal');
  const modal = overlay ? overlay.querySelector('.event-modal') : null;
  const name = document.getElementById('hito-confirm-name');
  const desc = document.getElementById('hito-confirm-desc');
  const goblinsContainer = document.getElementById('hito-confirm-goblins');
  const btnAccept = document.getElementById('btn-accept-hito-confirm');
  const btnCancel = document.getElementById('btn-cancel-hito-confirm');
  const eyeBtn = document.getElementById('hito-confirm-eye-btn');

  if (overlay && modal && name && desc && goblinsContainer && btnAccept && btnCancel && eyeBtn) {
    // Restaurar opacidades y clases de transparencia previas
    modal.classList.remove('modal-transparent');
    overlay.classList.remove('overlay-transparent');
    eyeBtn.innerHTML = '👁️';
    eyeBtn.title = 'Hacer modal transparente';
    eyeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    eyeBtn.style.color = 'var(--gold)';

    name.innerText = `Hito ${hitoObj.id}: ${hitoObj.name}`;
    desc.innerText = hitoObj.ruleDesc || 'Sin reglas especiales para este hito.';

    let gobsHTML = '';
    if (hitoObj.isBoss) {
      const bossImg = hitoObj.bossStats && hitoObj.bossStats.image ? hitoObj.bossStats.image : 'assets/Monstruos/05.webp';
      gobsHTML = `<div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <span style="color: var(--accent-red); font-weight: bold; font-family: 'Cinzel', serif; letter-spacing: 1px; font-size: 0.9rem;">JEFE DE LA SENDA</span>
        <img src="${bossImg}" style="height: 320px; border-radius: 8px; border: 2px solid var(--accent-red); box-shadow: 0 0 15px rgba(230, 57, 70, 0.4);" alt="Jefe">
      </div>`;
    } else if (hitoObj.goblins && hitoObj.goblins.length > 0) {
      gobsHTML = hitoObj.goblins.map(lvl => 
        `<img src="assets/Monstruos/t${lvl}.webp" style="height: 160px; vertical-align: middle; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); margin: 0 5px;" alt="G${lvl}">`
      ).join('');
    } else {
      gobsHTML = `<span style="color: #cbd5e1; font-style: italic;">Ninguno</span>`;
    }
    goblinsContainer.innerHTML = gobsHTML;

    // Remover listeners anteriores clonando los botones
    const newBtnAccept = btnAccept.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnAccept.parentNode.replaceChild(newBtnAccept, btnAccept);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnAccept.addEventListener('click', () => {
      overlay.classList.add('hidden');
      if (typeof onAccept === 'function') {
        onAccept();
      }
    });

    newBtnCancel.addEventListener('click', () => {
      overlay.classList.add('hidden');
    });

    // Event listener para el botón del ojo (transparencia)
    const newEyeBtn = eyeBtn.cloneNode(true);
    eyeBtn.parentNode.replaceChild(newEyeBtn, eyeBtn);
    newEyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isTransparent = modal.classList.toggle('modal-transparent');
      overlay.classList.toggle('overlay-transparent', isTransparent);
      if (isTransparent) {
        newEyeBtn.innerHTML = '👁️‍🗨️';
        newEyeBtn.title = 'Restaurar opacidad';
        newEyeBtn.style.background = 'var(--gold)';
        newEyeBtn.style.color = '#000';
      } else {
        newEyeBtn.innerHTML = '👁️';
        newEyeBtn.title = 'Hacer modal transparente';
        newEyeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        newEyeBtn.style.color = 'var(--gold)';
      }
    });

    overlay.classList.remove('hidden');
  }
};

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
      const bossImg = hitoObj.bossStats && hitoObj.bossStats.image ? hitoObj.bossStats.image : 'assets/Monstruos/05.webp';
      gobsHTML = `<div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <span style="color: var(--accent-red); font-weight: bold; font-family: 'Cinzel', serif; letter-spacing: 1px; font-size: 0.9rem;">JEFE DE LA SENDA</span>
        <img src="${bossImg}" style="height: 120px; border-radius: 8px; border: 2px solid var(--accent-red); box-shadow: 0 0 15px rgba(230, 57, 70, 0.4);" alt="Jefe">
      </div>`;
    } else if (hitoObj.goblins && hitoObj.goblins.length > 0) {
      gobsHTML = hitoObj.goblins.map(lvl => 
        `<img src="assets/Monstruos/t${lvl}.webp" style="height: 60px; vertical-align: middle; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); margin: 0 5px;" alt="G${lvl}">`
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
let roleFillSilverSelected = null;
let isRollingRoleFillDice = false;

function triggerRoleFillDiceRoll() {
  isRollingRoleFillDice = true;
  document.getElementById('btn-cancel-role-fill').disabled = true;
  document.getElementById('btn-confirm-role-fill').disabled = true;
  renderRoleFillDice();

  const container = document.getElementById('role-fill-dice-container');
  const diceEls = container.querySelectorAll('.die');
  const intervals = [];
  
  diceEls.forEach(el => {
    const dieId = el.id;
    const dieObj = roleFillDice.find(d => d.id === dieId);
    if (!dieObj) return;
    const faces = dieObj.faces;
    const interval = setInterval(() => {
      el.innerText = Math.floor(Math.random() * faces) + 1;
    }, 60);
    intervals.push(interval);
  });

  setTimeout(() => {
    intervals.forEach(clearInterval);
    isRollingRoleFillDice = false;
    document.getElementById('btn-cancel-role-fill').disabled = false;
    renderRoleFillDice();
  }, 300);
}

document.getElementById('btn-role').addEventListener('click', () => {
  if (gameState.isMarketPhase) return;

  const p = gameState.players[gameState.currentPlayerIndex];

  // RETROFIT: Ensure level 4+ players have their silver die if they didn't get it
  if (p.level >= 4 && !p.dicePool.some(d => d.type === 'silver')) {
    p.dicePool.push({ type: 'silver', faces: 3 });
  }

  // Tirar dados de la colección del jugador
  roleFillDice = p.dicePool.map((d, index) => ({
    ...d,
    id: `role-die-${index}`,
    val: Math.floor(Math.random() * d.faces) + 1,
    rerolled: false
  }));

  roleFillAssigned = null;

  document.getElementById('role-fill-player-stats').innerHTML = `<p style="font-size: 1.2rem; margin:0;">${p.name}</p><p style="color: #00d2ff; margin:0;">Energía Actual: ${p.energy}</p>`;

  const roleSlot = document.getElementById('role-fill-slot');
  roleSlot.style.backgroundImage = `url('${p.role.image}')`;
  document.getElementById('role-fill-placeholder').innerText = '';
  document.getElementById('role-fill-placeholder').style.background = 'rgba(0,0,0,0.5)';

  document.getElementById('role-fill-overlay').classList.remove('hidden');
  triggerRoleFillDiceRoll();
});


function renderRoleFillDice() {
  const container = document.getElementById('role-fill-dice-container');
  if (!container) return;
  container.innerHTML = '';

  roleFillDice.forEach(die => {
    // Si es un dado plateado y ya está fusionado, no lo renderizamos
    if (die.type === 'silver' && die.assignedTo && die.assignedTo.startsWith('role-die-')) return;

    let dieWrapper = document.createElement('div');
    dieWrapper.className = 'die-wrapper';
    dieWrapper.style.position = 'relative';

    let dieEl = document.createElement('div');
    dieEl.className = `die ${die.type}`;
    if (die.faces === 4) dieEl.classList.add('d4');
    dieEl.id = die.id;
    dieEl.innerText = die.val;
    dieEl.style.opacity = roleFillAssigned === die.id ? '0.3' : '1';

    if (isRollingRoleFillDice) {
      dieEl.draggable = false;
      dieEl.classList.add('die-rolling');
      dieEl.style.cursor = 'default';
      dieWrapper.appendChild(dieEl);
      container.appendChild(dieWrapper);
      return;
    }

    dieEl.draggable = roleFillAssigned !== die.id;

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
      dieEl.title = 'Click para interactuar';
      if (roleFillSilverSelected === die.id) {
         dieEl.classList.add('die-selected');
      }
      dieEl.onclick = () => {
        if (die.type === 'silver') {
           if (roleFillSilverSelected === die.id) {
               roleFillSilverSelected = null;
           } else {
               roleFillSilverSelected = die.id;
           }
           renderRoleFillDice();
           return;
        }

        if (roleFillSilverSelected && (die.type === 'red' || die.type === 'black')) {
           let droppedDie = roleFillDice.find(d => d.id === roleFillSilverSelected);
           if (droppedDie && !droppedDie.assignedTo) {
             droppedDie.assignedTo = die.id;
             die.silverDieId = droppedDie.id;
             die.originalValue = die.val;
             die.val += droppedDie.val;
             roleFillSilverSelected = null;
             renderRoleFillDice();
             return;
           }
        }

        roleFillAssigned = die.id;
        const placeholder = document.getElementById('role-fill-placeholder');
        placeholder.innerText = die.val;
        placeholder.className = 'die-placeholder active ' + die.type;
        if (die.faces === 4) placeholder.classList.add('d4');
        renderRoleFillDice();
        document.getElementById('btn-confirm-role-fill').disabled = false;
      };
    }

    // --- LÓGICA DE FUSIÓN DE DADO PLATEADO EN ROLE FILL ---
    if (die.type === 'red' || die.type === 'black') {
      dieEl.addEventListener('dragover', (e) => {
        if (!die.silverDieId && roleFillAssigned !== die.id) {
          e.preventDefault();
        }
      });
      dieEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        let droppedDieId = e.dataTransfer.getData('text/plain');
        let droppedDie = roleFillDice.find(d => d.id === droppedDieId);
        if (droppedDie && droppedDie.type === 'silver' && !droppedDie.assignedTo) {
          droppedDie.assignedTo = die.id;
          die.silverDieId = droppedDie.id;
          die.originalValue = die.val;
          die.val += droppedDie.val;
          renderRoleFillDice();
        }
      });
    }

    if (die.silverDieId) {
      let badge = document.createElement('div');
      badge.className = 'silver-badge';
      badge.innerText = '+';
      badge.style.pointerEvents = 'auto';
      if (roleFillAssigned !== die.id) {
        badge.style.cursor = 'pointer';
        badge.title = `Valor original: ${die.originalValue}. Click para separar el dado plateado.`;
        badge.onclick = (e) => {
           e.stopPropagation();
           let sDie = roleFillDice.find(d => d.id === die.silverDieId);
           if (sDie) sDie.assignedTo = null;
           die.val = die.originalValue;
           delete die.silverDieId;
           delete die.originalValue;
           renderRoleFillDice();
        };
      } else {
        badge.title = "Dado potenciado (No se puede separar mientras esté asignado)";
      }
      dieWrapper.appendChild(badge);
    }
    // --- FIN LÓGICA PLATEADO ---

    if (die.type === 'black' && !die.rerolled && roleFillAssigned !== die.id) {
      const rerollBtn = document.createElement('div');
      rerollBtn.className = 'die-reroll-icon';
      rerollBtn.innerHTML = '↻';
      rerollBtn.title = 'Relanzar dado negro';
      rerollBtn.onclick = (e) => {
        e.stopPropagation();
        if (die.silverDieId) {
           let sDie = roleFillDice.find(d => d.id === die.silverDieId);
           if (sDie) sDie.assignedTo = null;
           die.val = die.originalValue;
           delete die.silverDieId;
           delete die.originalValue;
        }
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

document.getElementById('role-fill-slot').addEventListener('dragover', (e) => {
  if (!isRollingRoleFillDice) e.preventDefault();
});
document.getElementById('role-fill-slot').addEventListener('drop', (e) => {
  if (isRollingRoleFillDice) return;
  e.preventDefault();
  const dieId = e.dataTransfer.getData('text/plain');
  const die = roleFillDice.find(d => d.id === dieId);
  if (!die) return;
  if (die.type === 'silver') { alert("Los dados plateados solo pueden fusionarse con otros dados de la reserva."); return; }

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
  if (isRollingRoleFillDice) return;
  if (!roleFillAssigned) return;

  const p = gameState.players[gameState.currentPlayerIndex];
  const die = roleFillDice.find(d => d.id === roleFillAssigned);
  const val = die.val;
  const energyGain = p.role.energyRates[val - 1] || 0;

  if (energyGain > 0) {
    const sourceEl = document.getElementById('btn-role');
    const activePanel = document.querySelector('.player-panel.active-turn');
    const destEl = activePanel ? activePanel.querySelector('.role-energy-badge') : null;
    window.animateEnergyRefill(sourceEl, destEl, energyGain);
  }

  p.energy += energyGain;

  gameState.addLog(`🔷 <strong>${p.name}</strong> usó la acción Rellenar Rol. Asignó un ${val} y ganó ${energyGain} Energía.`);
  gameState.consumeAction();

  document.getElementById('role-fill-overlay').classList.add('hidden');
  updateUI();
});

document.getElementById('btn-cancel-role-fill').addEventListener('click', () => {
  if (isRollingRoleFillDice) return;
  document.getElementById('role-fill-overlay').classList.add('hidden');
});



// Lógica del Log
const logPanel = document.getElementById('log-panel');
const logContent = document.getElementById('log-content');

const btnToggleMenu = document.getElementById('btn-toggle-global-menu');
if (btnToggleMenu) {
  btnToggleMenu.addEventListener('click', () => {
    const menuCollapsible = document.getElementById('global-menu-collapsible');
    if (menuCollapsible) {
      if (menuCollapsible.style.display === 'none') {
        menuCollapsible.style.display = 'flex';
        btnToggleMenu.innerText = '▶';
      } else {
        menuCollapsible.style.display = 'none';
        btnToggleMenu.innerText = '◀';
        
        const logPanelEl = document.getElementById('log-panel');
        if (logPanelEl && logPanelEl.style.display !== 'none') {
            logPanelEl.style.display = 'none';
        }
        
        const debugModalEl = document.getElementById('debug-combat-modal');
        if (debugModalEl && !debugModalEl.classList.contains('hidden')) {
            debugModalEl.classList.add('hidden');
        }
      }
    }
  });
}

window.botsPaused = false;
const btnToggleBots = document.getElementById('btn-toggle-bots');
if (btnToggleBots) {
  btnToggleBots.addEventListener('click', () => {
    window.botsPaused = !window.botsPaused;
    if (window.botsPaused) {
      btnToggleBots.innerHTML = '▶️ Bots';
      btnToggleBots.style.borderColor = '#ff3366';
      btnToggleBots.style.color = '#ff3366';
    } else {
      btnToggleBots.innerHTML = '⏸️ Bots';
      btnToggleBots.style.borderColor = 'rgba(212, 175, 55, 0.3)';
      btnToggleBots.style.color = '';
      if (window.botManager) window.botManager.handleGameState();
    }
  });
}
document.getElementById('btn-toggle-log').addEventListener('click', () => {
  if (logPanel.style.display === 'none' || logPanel.style.display === '') {
    logPanel.style.display = 'flex';
    renderLogs();
  } else {
    logPanel.style.display = 'none';
  }
});

const btnExportJson = document.getElementById('btn-export-json');
if (btnExportJson) {
  btnExportJson.addEventListener('click', async () => {
    if (!gameState) return;
    
    const playersClean = gameState.players.map(p => {
      const equippedItems = p.equipped.filter(eq => eq.isActive).map(eq => ({
        id: eq.id,
        name: eq.name,
        type: eq.type,
        isBroken: !!eq.isBroken,
        effect: eq.effect,
        extra: eq.extra,
        cost: eq.cost
      }));
      const backpackItems = p.equipped.filter(eq => !eq.isActive).map(eq => ({
        id: eq.id,
        name: eq.name,
        type: eq.type,
        isBroken: !!eq.isBroken,
        effect: eq.effect,
        extra: eq.extra,
        cost: eq.cost
      }));
      
      return {
        id: p.id,
        name: p.name,
        isBot: !!p.isBot,
        hp: p.hp,
        maxHp: p.maxHp,
        mo: p.mo,
        pex: p.pex,
        level: p.level,
        role: p.role ? { id: p.role.id, name: p.role.name } : null,
        statusEffects: p.statusEffects ? { ...p.statusEffects } : {},
        equipped: equippedItems,
        backpack: backpackItems
      };
    });

    const marketClean = {};
    if (gameState.market) {
      for (let deckType in gameState.market) {
        const deck = gameState.market[deckType];
        if (Array.isArray(deck) && deck.length > 0) {
          const topCard = deck[0];
          marketClean[deckType] = {
            id: topCard.id,
            name: topCard.name,
            cost: topCard.cost,
            effect: topCard.effect,
            extra: topCard.extra
          };
        } else {
          marketClean[deckType] = null;
        }
      }
    }

    const battlefieldClean = {
      waveLevel: gameState.battlefield ? gameState.battlefield.waveLevel : 1,
      actionCount: gameState.battlefield ? gameState.battlefield.actionCount : 0,
      goblins: (gameState.battlefield && gameState.battlefield.goblins) ? gameState.battlefield.goblins.map(g => ({
        name: g.name,
        level: g.level,
        currentHp: g.currentHp,
        maxHp: g.maxHp,
        isBoss: !!g.isBoss,
        isHito: !!g.isHito,
        isDying: !!g.isDying
      })) : []
    };

    // Parsear de forma estructurada los logs para crear una lista de acciones del turno
    const structuredActions = [];
    if (gameState.logs) {
      gameState.logs.forEach(logLine => {
        // Extraer marca de tiempo
        const tsMatch = logLine.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
        const timestamp = tsMatch ? tsMatch[1] : null;
        
        // Limpiar HTML y marcas de tiempo
        const cleanLog = logLine.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '').replace(/<[^>]*>?/gm, '');
        
        let parsed = null;
        
        // A. Compras de equipamiento
        if (cleanLog.includes(' compró y EQUIPÓ ') || cleanLog.includes(' compró ')) {
          const buyRegex = /^(.+?) compró (?:y EQUIPÓ )?(.+?) por (\d+) mo\.(?:\s*Se ha guardado en la mochila (.+))?/;
          const match = cleanLog.match(buyRegex);
          if (match) {
            parsed = {
              type: 'buy_equipment',
              player: match[1].trim(),
              item: match[2].trim(),
              cost: parseInt(match[3]),
              destination: cleanLog.includes('y EQUIPÓ') ? 'equipped' : 'backpack',
              reason: match[4] ? match[4].replace(/[()]/g, '').trim() : null
            };
          }
        }
        // B. Pociones (compra/uso)
        else if (cleanLog.includes(' usó ') && (cleanLog.includes(' recuperó ') || cleanLog.includes(' PV.'))) {
          const potionRegex = /^(.+?) usó (.+?) y recuperó (\d+) PV\./;
          const match = cleanLog.match(potionRegex);
          if (match) {
            parsed = {
              type: 'use_potion',
              player: match[1].trim(),
              potionName: match[2].trim(),
              healing: parseInt(match[3])
            };
          }
        }
        // C. Dado en subida de nivel
        else if (cleanLog.includes(' añadió un dado ') && cleanLog.includes(' a su colección')) {
          const dieRegex = /^(.+?) añadió un dado (Rojo d6|Negro d4) a su colección(.*)/;
          const match = cleanLog.match(dieRegex);
          if (match) {
            parsed = {
              type: 'level_up_die',
              player: match[1].trim(),
              dieType: match[2].includes('Rojo') ? 'red' : 'black',
              bonus: match[3].includes('ganó') ? '1 mo' : null
            };
          }
        }
        // D. Subida de nivel del grupo
        else if (cleanLog.includes('Los jugadores subieron al Nivel')) {
          const lvlRegex = /Los jugadores subieron al Nivel (\d+)/;
          const match = cleanLog.match(lvlRegex);
          if (match) {
            parsed = {
              type: 'group_level_up',
              level: parseInt(match[1])
            };
          }
        }
        // E. Resolución de oleada
        else if (cleanLog.includes('RESOLVIENDO FASE DE OLEADA')) {
          const waveRegex = /RESOLVIENDO FASE DE OLEADA (\d+)/;
          const match = cleanLog.match(waveRegex);
          if (match) {
            parsed = {
              type: 'wave_phase_start',
              wave: parseInt(match[1])
            };
          }
        }
        // F. Aparición de Goblins
        else if (cleanLog.includes('Aparición (')) {
          const spawnRegex = /Aparición \((.+?)\):\s*(.+)/;
          const match = cleanLog.match(spawnRegex);
          if (match) {
            parsed = {
              type: 'goblin_spawn',
              difficulty: match[1].trim(),
              details: match[2].trim()
            };
          }
        }
        // G. Mutación de Goblins
        else if (cleanLog.includes('Mutación:')) {
          const mutRegex = /Mutación:\s*(.+)/;
          const match = cleanLog.match(mutRegex);
          if (match) {
            parsed = {
              type: 'goblin_mutation',
              details: match[1].trim()
            };
          }
        }
        // H. Desplegar Hito
        else if (cleanLog.includes('HITO DESPLEGADO:')) {
          const hitoRegex = /HITO DESPLEGADO:\s*(.+?)(?:\s*🔥|$)/;
          const match = cleanLog.match(hitoRegex);
          if (match) {
            parsed = {
              type: 'deploy_hito',
              hitoName: match[1].trim()
            };
          }
        }
        // I. Reparación de equipamiento
        else if (cleanLog.includes('pagó 1 mo para reparar')) {
          const repairRegex = /^(.+?) pagó 1 mo para reparar (.+?)\.?$/;
          const match = cleanLog.match(repairRegex);
          if (match) {
            parsed = {
              type: 'repair_equipment',
              player: match[1].replace('(Bot)', '').trim(),
              item: match[2].trim()
            };
          }
        }
        // J. Explorar mercado
        else if (cleanLog.includes('gastó 1 mo en explorar el mercado')) {
          const exploreRegex = /^(.+?) gastó 1 mo en explorar el mercado, descartando (.+?)\.?$/;
          const match = cleanLog.match(exploreRegex);
          if (match) {
            parsed = {
              type: 'explore_market',
              player: match[1].trim(),
              discardedCard: match[2].trim()
            };
          }
        }
        // K. Fin de partida
        else if (cleanLog.includes('PARTIDA FINALIZADA')) {
          parsed = {
            type: 'game_over',
            outcome: 'defeat'
          };
        }
        else if (cleanLog.includes('VICTORIA') && cleanLog.includes('ganado')) {
          parsed = {
            type: 'game_over',
            outcome: 'victory'
          };
        }
        
        if (parsed) {
          if (timestamp) parsed.timestamp = timestamp;
          parsed.rawLog = logLine;
          structuredActions.push(parsed);
        }
      });
    }

    const exportData = {
      gameInfo: {
        startTime: gameState.startTime,
        endTime: gameState.endTime,
        activeSenda: gameState.activeSenda,
        currentHito: gameState.currentHito,
        isGameOver: !!gameState.isGameOver,
        isGameWon: !!gameState.isGameWon,
        players: playersClean
      },
      marketState: marketClean,
      battlefieldState: battlefieldClean,
      combatHistory: gameState.combatHistory || [],
      structuredActions: structuredActions,
      logs: gameState.logs || []
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = `partida_goblins_${new Date().getTime()}`;
    a.download = `${baseName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    try {
        const htmlContent = await window.ReportGenerator.generate(exportData);
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(htmlBlob);
        const aHtml = document.createElement('a');
        aHtml.href = htmlUrl;
        aHtml.download = `reporte_visual_${baseName}.html`;
        document.body.appendChild(aHtml);
        aHtml.click();
        document.body.removeChild(aHtml);
        URL.revokeObjectURL(htmlUrl);
    } catch (e) {
        console.error("Error generating HTML report", e);
    }
  });
}

const btnExportLog = document.getElementById('btn-export-log');
if (btnExportLog) {
  btnExportLog.addEventListener('click', () => {
    if (!gameState || !gameState.logs) return;
    
    const logsHtml = gameState.logs.map(log => `<div class="log-entry">${log}</div>`).join('');
    
    const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Historial de Partida - Malditos Goblins</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a24; color: #eee; padding: 20px; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; background: #232333; padding: 30px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.8); border: 1px solid #d4af37; }
    h1 { color: #d4af37; text-align: center; font-family: 'Georgia', serif; border-bottom: 2px solid #d4af37; padding-bottom: 15px; margin-bottom: 25px; }
    .log-entry { margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; font-size: 0.95rem; }
    strong { color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Historial de Partida - Malditos Goblins</h1>
    <p style="text-align: center; color: #aaa; margin-top: -15px; margin-bottom: 30px;">Exportado el ${new Date().toLocaleString()}</p>
    ${logsHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_goblins_${new Date().getTime()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

function renderLogs() {
  logContent.innerHTML = gameState.logs.map(log => `<div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 3px;">${log}</div>`).join('');
  logContent.scrollTop = logContent.scrollHeight; // Auto-scroll al final
}
window.renderLogs = renderLogs;

function showWaveAnnouncement(wave, triggerAction = false) {
  const overlay = document.getElementById('wave-announcement');
  const levelSpan = document.getElementById('announcement-level');
  if (!overlay || !levelSpan) return;

  levelSpan.innerText = wave;
  overlay.classList.remove('hidden');
  overlay.style.opacity = '1';

  if (triggerAction && gameState && gameState.battlefield) {
    // Lanzar el hachazo dramáticamente antes (en pleno apogeo del cartel de oleada)
    setTimeout(() => {
      if (!gameState.isRetaliationPhase) {
        showActionNotification(gameState.battlefield.actionCount);
      }
    }, 1200); 
  }

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
      // Dejar gris durante el vuelo de entrada
      star.style.color = '#444';
      star.style.textShadow = 'none';
      
      // Sincronizado para estallar de color justo cuando frena en el centro (a los 300ms)
      setTimeout(() => {
        star.style.color = '#ff4d4d';
        star.style.textShadow = '0 0 20px rgba(255, 77, 77, 0.8)';
        star.classList.add('star-pop-active');
      }, 300);
    } else {
      star.style.color = '#444';
      star.style.textShadow = 'none';
    }
  });

  overlay.classList.remove('hidden');
  overlay.style.opacity = '1';

  const activePlayer = gameState.getCurrentPlayer();
  if (activePlayer && !activePlayer.isBot) {
    setTimeout(() => {
      highlightInitialFocusButtons();
    }, 1600); // Lanzar casi al final del hachazo
  }

  // Trigger market cards flip synchronized with the end of the action notification
  // This executes for BOTH human and bot players
  if (gameState && gameState.isFirstTurnOfGame) {
    setTimeout(() => {
      flipInitialMarketCards();
    }, 2000); // 1600ms + 400ms delay to match the original human timing
  }

  // Dar tiempo a la animación CSS de corte diagonal completo (1.8s)
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 1800);
}

async function processWaveSequence() {
  while (gameState.isResolvingWaveSequentially) {
    let stepResult = gameState.executeNextWaveStep();
    if (!stepResult) break;

    if (stepResult.type === 'mutation') {
      // Aplicar clase CSS a las cartas que se van a fusionar
      stepResult.uidsToRemove.forEach(uid => {
        let gobel = document.querySelector(`.goblin-card[data-uid="${uid}"]`);
        if (gobel) {
          gobel.classList.remove('goblin-mutation-active', 'goblin-wobble-active');
          
          // Forzar reflujo para asegurar que el navegador reinicia las animaciones
          void gobel.offsetWidth;
          
          gobel.classList.add('goblin-merging');
        }
      });
      
      // Esperar a que la animación de fusión termine
      await new Promise(r => setTimeout(r, 600));
      
      // Renderizar la mesa para que aparezca el nuevo (que tendrá isMutated=true y hará goblin-mutation-active)
      renderBattlefield();
      
      // Esperar a que el jugador vea el nuevo goblin antes de la siguiente fusión
      await new Promise(r => setTimeout(r, 800));
      
    } else if (stepResult.type === 'spawn') {
      // Mostrar todos los nuevos goblins a la vez
      renderBattlefield();
      // Esperar a que terminen su animación wobble
      await new Promise(r => setTimeout(r, 1000));
    } else if (stepResult.type === 'continue') {
      // Internal step, no delay needed
    }
  }

  window.isAnimatingWave = false;
  
  if (!gameState.isGameOver) {
    gameState.startPlayerTurn(gameState.getCurrentPlayer());
  }

  // Guardado automático silencioso
  window.saveGame(true);
  
  // Continuar con el ciclo normal del juego
  updateUI();
}

// Render Functions
function getBotBubbleIcon(actionType, text) {
  const type = (actionType || '').toLowerCase();
  if (type === 'combat') return 'assets/ico_combat.png';
  if (type === 'gold') return 'assets/ico_gold.png';
  if (type === 'gold-dmg') return 'assets/ico_gold-dmg.png';
  if (type === 'role') return 'assets/ico_role.png';
  if (type === 'hito') return 'assets/ico_hito.png';
  if (type === 'pot' || type === 'potion' || type === 'pots') return 'assets/ico_pot.png';
  if (type === 'market' || type === 'mercado') return 'assets/ico_mercado.png';
  if (type === 'think' || type === 'pensar') return 'assets/ico_pensar.png';
  
  
  // Fallback por palabras clave si no viene definido
  const txt = (text || '').toLowerCase();
  if (txt.includes('ahorraré') || txt.includes('guardaré este oro') || txt.includes('sin oro poca cosa') || txt.includes('pensar') || txt.includes('think')) {
      return 'assets/ico_pensar.png';
  }
  if (txt.includes('pocion') || txt.includes('poción') || txt.includes('curar')) {
      return 'assets/ico_pot.png';
  }
  if (txt.includes('compr') || txt.includes('tienda') || txt.includes('mercado') || txt.includes('compra')) {
      return 'assets/ico_mercado.png';
  }
  if (txt.includes('gold-dmg') || txt.includes('robar') || txt.includes('atacar y oro') || txt.includes('oro y daño') || txt.includes('monedas y daño')) {
      return 'assets/ico_gold-dmg.png';
  }
  if (txt.includes('combat') || txt.includes('attack') || txt.includes('peligro') || txt.includes('crítico') || txt.includes('crítica') || txt.includes('combate') || txt.includes('atacar')) {
      return 'assets/ico_combat.png';
  }
  if (txt.includes('gold') || txt.includes('moneda') || txt.includes('sisar') || txt.includes('oro')) {
      return 'assets/ico_gold.png';
  }
  if (txt.includes('role') || txt.includes('habilidad') || txt.includes('energ') || txt.includes('rol')) {
      return 'assets/ico_role.png';
  }
  if (txt.includes('hito') || txt.includes('senda')) {
      return 'assets/ico_hito.png';
  }
  
  return 'assets/ico_combat.png'; // Fallback por defecto
}

window.updateBotBubble = function(playerIndex, text, actionType = null) {
  const combatOverlay = document.getElementById('combat-overlay');
  const isCombatActive = combatOverlay && !combatOverlay.classList.contains('hidden');
  
  const retaliationOverlay = document.getElementById('global-event-overlay');
  const isRetaliationActive = retaliationOverlay && !retaliationOverlay.classList.contains('hidden') && gameState.isRetaliationPhase;

  const bubble = document.getElementById(`bot-bubble-${playerIndex}`);
  const bubbleText = document.getElementById(`bot-bubble-text-${playerIndex}`);
  
  const combatBubble = document.getElementById(`combat-bot-bubble-${playerIndex}`);
  const combatBubbleText = document.getElementById(`combat-bot-bubble-text-${playerIndex}`);
  
  const retaliationBubble = document.getElementById(`retaliation-bot-bubble-${playerIndex}`);
  const retaliationBubbleText = document.getElementById(`retaliation-bot-bubble-text-${playerIndex}`);
  
  if (isCombatActive) {
      if (combatBubble && combatBubbleText) {
          if (text) {
              combatBubbleText.innerHTML = text;
              combatBubble.style.display = 'block';
              // Trigger reflow/animation
              setTimeout(() => {
                  combatBubble.classList.add('show');
              }, 10);
          } else {
              combatBubble.classList.remove('show');
              setTimeout(() => {
                  if (!combatBubble.classList.contains('show')) {
                      combatBubble.style.display = 'none';
                  }
              }, 300);
          }
      }
      if (bubble) {
          bubble.style.opacity = '0';
          bubble.style.transform = 'translateX(-50%) translateY(10px)';
      }
      if (retaliationBubble) {
          retaliationBubble.classList.remove('show');
          retaliationBubble.style.display = 'none';
      }
  } else if (isRetaliationActive) {
      if (retaliationBubble && retaliationBubbleText) {
          if (text) {
              retaliationBubbleText.innerHTML = text;
              retaliationBubble.style.display = 'block';
              // Trigger reflow/animation
              setTimeout(() => {
                  retaliationBubble.classList.add('show');
              }, 10);
          } else {
              retaliationBubble.classList.remove('show');
              setTimeout(() => {
                  if (!retaliationBubble.classList.contains('show')) {
                      retaliationBubble.style.display = 'none';
                  }
              }, 300);
          }
      }
      if (bubble) {
          bubble.style.opacity = '0';
          bubble.style.transform = 'translateX(-50%) translateY(10px)';
      }
      if (combatBubble) {
          combatBubble.classList.remove('show');
          combatBubble.style.display = 'none';
      }
  } else {
      if (bubble && bubbleText) {
          if (text) {
              const iconPath = getBotBubbleIcon(actionType, text);
              bubbleText.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; text-align: left;">
                  <img src="${iconPath}" style="width: 60px; height: 61px; flex-shrink: 0; border: none; box-shadow: none;" alt="Action Icon">
                  <div style="flex-grow: 1; line-height: 1.4; font-size: 0.95rem;">${text}</div>
                </div>
              `;
              bubble.style.opacity = '1';
              bubble.style.transform = 'translateX(-50%) translateY(0)';
          } else {
              bubble.style.opacity = '0';
              bubble.style.transform = 'translateX(-50%) translateY(10px)';
          }
      }
      if (combatBubble) {
          combatBubble.classList.remove('show');
          combatBubble.style.display = 'none';
      }
      if (retaliationBubble) {
          retaliationBubble.classList.remove('show');
          retaliationBubble.style.display = 'none';
      }
  }
};

// Cerrar cualquier bocadillo de bot al hacer click sobre él
document.addEventListener('click', function(e) {
  const clickedBubble = e.target.closest('.bot-bubble, .combat-bot-bubble, .retaliation-bot-bubble');
  if (clickedBubble) {
      const match = clickedBubble.id.match(/-(\d+)$/);
      if (match && match[1]) {
          const playerIndex = parseInt(match[1]);
          if (window.updateBotBubble) {
              window.updateBotBubble(playerIndex, null);
          }
      }
  }
});

function updateUI() {
  // Asegurar que botDNA está inicializado antes de cualquier renderizado
  if (gameState && gameState.players) {
      gameState.players.forEach(p => {
          if (p.isBot && !p.botDNA) {
              p.botDNA = ['Agresivo', 'Agresivo', 'Agresivo'];
          }
      });
  }

  if (gameState && gameState.assignGoblinLetters) gameState.assignGoblinLetters();
  // 1. Siempre renderizamos primero para que el estado visual refleje los últimos cambios (ej: 0 HP)
  renderMarket();
  renderBattlefield();
  renderPlayer();
  renderLogs(); // Actualizar el log si está abierto

  if (gameState.isResolvingWaveSequentially) {
    if (!window.isAnimatingWave) {
      window.isAnimatingWave = true;
      processWaveSequence();
    }
    // Bloquear UI mientras animamos
    document.body.style.pointerEvents = 'none';
    return;
  }
  
  // Asegurarnos de desbloquear siempre
  document.body.style.pointerEvents = 'auto';

  // Evaluar heurísticas de la IA para actualizar bocadillos
  if (botManager) {
      botManager.evaluateState();
  }

  if (gameState.pendingCorrosionChoice) {
    // Retrasar si hay animaciones activas (muerte de Goblins o rotura de equipo)
    const hasDyingGoblins = gameState.battlefield.goblins.some(g => g.isDying);
    const hasJustBrokenEquip = gameState.players.some(p => p.equipped.some(eq => eq.isBroken && !eq.brokenAnimationPlayed));
    
    if (hasDyingGoblins || hasJustBrokenEquip) {
      if (!window._corrosionDelayActive) {
        window._corrosionDelayActive = true;
        setTimeout(() => {
          window._corrosionDelayActive = false;
          updateUI();
        }, 1000);
      }
      return;
    }
    showCorrosionModal(gameState.pendingCorrosionChoice);
    return;
  }

  if (gameState.currentCombat) {
    renderCombatOverlay();
  }

  // 2. Comprobamos estados de fin de partida o fases especiales
  if (gameState.isGameWon) {
    renderGameWon();
    return;
  }
  if (gameState.isGameOver) {
    renderGameOver();
    return;
  }

  // Detectar cambio de oleada para anuncio
  if (gameState.battlefield.waveLevel > lastWaveLevel) {
    showWaveAnnouncement(gameState.battlefield.waveLevel, true);
    lastWaveLevel = gameState.battlefield.waveLevel;
    lastActionCount = gameState.battlefield.actionCount; // Reset sin aviso de acción si hay aviso de oleada (se lanzará encadenado)
  } else if (gameState.battlefield.actionCount > lastActionCount) {
    if (!gameState.isRetaliationPhase) {
      showActionNotification(gameState.battlefield.actionCount);
    }
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
  const hitoBtnText = document.querySelector('#btn-deploy-hito .btn-text');
  if (gameState.currentHito > 5) {
    if (hitoBtnText) hitoBtnText.innerText = "Senda Completada";
    else hitoBtn.innerText = "Senda Completada";
    hitoBtn.disabled = true;
  } else {
    const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;
    let hito = sendaHitos[gameState.currentHito - 1];
    if (hitoBtnText) hitoBtnText.innerText = `Enfrentar Hito ${gameState.currentHito}`;
    else hitoBtn.innerText = `Enfrentar Hito ${gameState.currentHito}`;
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
    btnConfirmAttack.disabled = !hasGoblinsAlive;
    btnConfirmAttack.innerHTML = `<span class="txt-largo">Atacar Goblins (${selectedGoblins.length})</span><span class="txt-corto">Atacar (${selectedGoblins.length})</span><img src="assets/ico_combat.png" class="mobile-btn-icon" alt="Atacar">`;

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

  // Iluminar botones al inicio del turno del jugador activo humano si no hay overlays
  const activePlayer = gameState.getCurrentPlayer();
  if (activePlayer && !activePlayer.isBot) {
    if (activePlayer.uid !== lastActivePlayerUid) {
      lastActivePlayerUid = activePlayer.uid;

      const actionOverlay = document.getElementById('action-notification');
      const waveOverlay = document.getElementById('wave-announcement');
      const isActionNotificationVisible = actionOverlay && !actionOverlay.classList.contains('hidden');
      const isWaveAnnouncementVisible = waveOverlay && !waveOverlay.classList.contains('hidden');

      if (!isActionNotificationVisible && !isWaveAnnouncementVisible) {
        setTimeout(() => {
          highlightInitialFocusButtons();
        }, 300);
      }
    }
  } else {
    lastActivePlayerUid = activePlayer ? activePlayer.uid : null;
    removeInitialFocusHighlights();
  }

  // Si estamos en fases inactivas de botones (mercado o represalia), forzar limpieza de iluminación
  if (gameState.isMarketPhase || gameState.isRetaliationPhase) {
    removeInitialFocusHighlights();
  }

  const hasObsoleteAnim = document.querySelector('.goblin-obsolete-anim');
  if (hasObsoleteAnim) {
    if (!window._obsoleteDelayActive) {
      window._obsoleteDelayActive = true;
      setTimeout(() => {
        window._obsoleteDelayActive = false;
        updateUI();
      }, 2500);
    }
    return;
  }

  checkLevelUpChoice();
  TutorialManager.evaluateSituation();

  // Activar turno automático de Bot (si es el jugador actual y no hay animaciones/bloqueos)
  if (window.botManager && !gameState.isFirstTurnOfGame) {
      window.botManager.handleGameState();
  }
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
    if (gameState.currentCombat.needsCrampResolution) {
      renderCombatOverlay();
    } else {
      triggerCombatDiceRoll();
    }
  }
});

window.animateCardPurchase = function(sourceEl, onComplete) {
  console.log("animateCardPurchase called", { sourceEl, onComplete });
  const rect = sourceEl.getBoundingClientRect();
  const clone = sourceEl.cloneNode(true);
  console.log("Source rect:", rect);
  
  // Convert source card into its back side immediately
  const type = sourceEl.getAttribute('data-deck-type');
  if (type) {
    if (typeof gameState !== 'undefined' && gameState.market[type] && gameState.market[type].length > 0) {
      let backImg = 'assets/Equipo/back_esp.webp';
      if (type === 'escudos') backImg = 'assets/Equipo/back_esc.webp';
      if (type === 'curacion') backImg = 'assets/Equipo/back_cure.webp';
      sourceEl.style.backgroundImage = `url('${backImg}')`;
    } else {
      sourceEl.style.opacity = '0'; // Hide the source element because the deck is now empty
    }
  }
  
  clone.style.position = 'fixed';
  clone.style.left = rect.left + 'px';
  clone.style.top = rect.top + 'px';
  clone.style.width = rect.width + 'px';
  clone.style.height = rect.height + 'px';
  clone.style.margin = '0';
  clone.style.zIndex = '9999';
  clone.style.pointerEvents = 'none';
  clone.style.boxShadow = '0 0 30px var(--gold)';
  
  // Configurar la animación de forma limpia usando solo transformaciones e !important
  clone.style.setProperty('transform', 'translate(0, 0) scale(1)', 'important');
  clone.style.setProperty('transform-origin', 'top left', 'important');
  clone.style.setProperty('transition', 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)', 'important');
  
  document.body.appendChild(clone);
  console.log("Clone appended to body", clone);
  
  const equipmentContainer = document.querySelector('.player-panel.active-turn .player-equipment');
  console.log("Equipment container found:", equipmentContainer);
  let targetRect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: rect.width * 0.5, height: rect.height * 0.5 };
  
  if (equipmentContainer) {
    // Generar un elemento falso para medir dónde caerá la carta
    const dummy = document.createElement('div');
    dummy.className = 'equipment-card';
    dummy.style.visibility = 'hidden';
    dummy.style.margin = '0';
    equipmentContainer.appendChild(dummy);
    targetRect = dummy.getBoundingClientRect();
    console.log("Dummy rect (destination):", targetRect);
    dummy.remove();
  } else {
    console.warn("No equipment container found for active player!");
  }
  
  // Force reflow
  clone.getBoundingClientRect();

  // Animación asíncrona para que se registre la posición inicial en el siguiente tick del navegador
  setTimeout(() => {
    const deltaX = targetRect.left - rect.left;
    const deltaY = targetRect.top - rect.top;
    const scaleX = targetRect.width / rect.width;
    const scaleY = targetRect.height / rect.height;
    const scale = Math.min(scaleX, scaleY);
    
    console.log("setTimeout animating clone with transform:", { deltaX, deltaY, scale });
    clone.style.setProperty('transform', `translate(${deltaX}px, ${deltaY}px) scale(${scale})`, 'important');
  }, 20);
  
  setTimeout(() => {
    console.log("Removing clone and completing purchase animation");
    clone.remove();
    // Limpiar flag _justBoughtId para que la carta se dibuje visible de inmediato al llamar a updateUI
    if (gameState && gameState.players) {
      gameState.players.forEach(p => {
        if (p.equipped) {
          p.equipped.forEach(eq => {
            delete eq._justBoughtId;
          });
        }
      });
    }
    if (onComplete) onComplete();
  }, 480);
}

window.animateGoldDrop = function(sourceElOrRect, coinCount) {
  if (typeof gameState !== 'undefined' && (gameState.isGameOver || gameState.isGameWon)) return;
  if (!sourceElOrRect || !coinCount || coinCount <= 0) return;

  let rect;
  if (sourceElOrRect instanceof HTMLElement) {
    rect = sourceElOrRect.getBoundingClientRect();
  } else {
    rect = sourceElOrRect;
  }
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  // Buscar el indicador de oro del jugador activo
  const destEl = document.querySelector('.player-panel.active-turn .stat.gold') || 
                 document.querySelector('.player-panel.active-turn .gold') ||
                 document.querySelector('.stat.gold');
                 
  let destX = window.innerWidth * 0.9;
  let destY = window.innerHeight * 0.9;

  if (destEl) {
    const destRect = destEl.getBoundingClientRect();
    destX = destRect.left + destRect.width / 2;
    destY = destRect.top + destRect.height / 2;
  }

  // Generar monedas
  for (let i = 0; i < coinCount; i++) {
    const coin = document.createElement('div');
    coin.className = 'flying-coin';
    
    // Crear el elemento interior que contiene la animación 3D de giro (coinSpin en CSS)
    const coinInner = document.createElement('div');
    coinInner.className = 'coin-inner';
    coin.appendChild(coinInner);
    
    // Posición inicial: centro del goblin
    coin.style.left = (startX - 24) + 'px';
    coin.style.top = (startY - 24) + 'px';
    
    // Estado inicial de la transformación
    coin.style.setProperty('transform', 'translate(0, 0) scale(0.5)', 'important');
    coin.style.setProperty('opacity', '0', 'important');
    coin.style.setProperty('transition', 'transform 0.4s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.3s ease-out', 'important');
    
    document.body.appendChild(coin);

    // Calcular dirección y fuerza de dispersión aleatoria
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 50;
    const scatterX = Math.cos(angle) * distance;
    // Añadimos una fuerza vertical hacia arriba para simular que saltan
    const scatterY = Math.sin(angle) * distance - 30;

    // Ejecutar la fase de explosión inicial en un setTimeout
    setTimeout(() => {
      coin.style.setProperty('transform', `translate(${scatterX}px, ${scatterY}px) scale(1.2)`, 'important');
      coin.style.setProperty('opacity', '1', 'important');
    }, 10 + i * 50); // Ligeramente escalonado para mayor dinamismo

    // Fase 2: Vuelo hacia el HUD
    setTimeout(() => {
      // Nueva transición acelerada hacia el destino
      coin.style.setProperty('transition', 'transform 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045), opacity 0.5s ease-in', 'important');
      
      const deltaX = destX - startX;
      const deltaY = destY - startY;
      
      coin.style.setProperty('transform', `translate(${deltaX}px, ${deltaY}px) scale(0.6)`, 'important');
      coin.style.setProperty('opacity', '1', 'important');
    }, 350 + i * 50);

    // Fase 3: Impacto y destrucción
    setTimeout(() => {
      coin.remove();
      
      // Activar efecto visual en el indicador del HUD
      if (destEl) {
        destEl.classList.remove('gold-pulse');
        void destEl.offsetWidth; // Forzar reflow para reiniciar la animación
        destEl.classList.add('gold-pulse');
      }
    }, 850 + i * 50);
  }
};

window.animatePexDrop = function(sourceElOrRect, pexCount) {
  if (typeof gameState !== 'undefined' && (gameState.isGameOver || gameState.isGameWon)) return;
  if (!sourceElOrRect || !pexCount || pexCount <= 0) return;

  let rect;
  if (sourceElOrRect instanceof HTMLElement) {
    rect = sourceElOrRect.getBoundingClientRect();
  } else {
    rect = sourceElOrRect;
  }
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  // Buscar el indicador de PEX de grupo (esquina superior izquierda)
  const destEl = document.querySelector('.group-info');
                 
  let destX = window.innerWidth * 0.1;
  let destY = window.innerHeight * 0.1;

  if (destEl) {
    const destRect = destEl.getBoundingClientRect();
    destX = destRect.left + destRect.width / 2;
    destY = destRect.top + destRect.height / 2;
  }

  // Generar estrellas
  for (let i = 0; i < pexCount; i++) {
    const star = document.createElement('div');
    star.className = 'flying-star';
    
    // Crear el elemento interior que contiene la animación 3D de giro (starRotate en CSS)
    const starInner = document.createElement('div');
    starInner.className = 'star-inner';
    starInner.textContent = '✨';
    star.appendChild(starInner);
    
    // Posición inicial: centro del goblin (48px de tamaño / 2 = 24 de offset)
    star.style.left = (startX - 24) + 'px';
    star.style.top = (startY - 24) + 'px';
    
    // Estado inicial de la transformación
    star.style.setProperty('transform', 'translate(0, 0) scale(0.3)', 'important');
    star.style.setProperty('opacity', '0', 'important');
    star.style.setProperty('transition', 'transform 0.4s cubic-bezier(0.1, 0.8, 0.3, 1.45), opacity 0.3s ease-out', 'important');
    
    document.body.appendChild(star);

    // Calcular dirección y fuerza de dispersión aleatoria flotante
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 50;
    const scatterX = Math.cos(angle) * distance;
    const scatterY = Math.sin(angle) * distance - 40; // Mayor flotación hacia arriba

    // Ejecutar la fase de explosión inicial en un setTimeout
    setTimeout(() => {
      star.style.setProperty('transform', `translate(${scatterX}px, ${scatterY}px) scale(1.2)`, 'important');
      star.style.setProperty('opacity', '1', 'important');
    }, 10 + i * 50); // Ligeramente escalonado para mayor dinamismo

    // Fase 2: Vuelo hacia el HUD
    setTimeout(() => {
      // Transición suave hacia el destino
      star.style.setProperty('transition', 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.6s ease-in', 'important');
      
      const deltaX = destX - startX;
      const deltaY = destY - startY;
      
      star.style.setProperty('transform', `translate(${deltaX}px, ${deltaY}px) scale(0.4)`, 'important');
      star.style.setProperty('opacity', '1', 'important');
    }, 450 + i * 50);

    // Fase 3: Impacto y destrucción
    setTimeout(() => {
      star.remove();
      
      // Activar efecto visual en el indicador del HUD
      if (destEl) {
        destEl.classList.remove('pex-pulse');
        void destEl.offsetWidth; // Forzar reflow para reiniciar la animación
        destEl.classList.add('pex-pulse');
      }
    }, 1050 + i * 50);
  }
};

window.animateEnergyRefill = function(sourceElOrRect, destEl, energyCount) {
  if (typeof gameState !== 'undefined' && (gameState.isGameOver || gameState.isGameWon)) return;
  if (!sourceElOrRect || !energyCount || energyCount <= 0) return;

  let rect;
  if (sourceElOrRect instanceof HTMLElement) {
    rect = sourceElOrRect.getBoundingClientRect();
  } else {
    rect = sourceElOrRect;
  }
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  let destX = window.innerWidth * 0.5;
  let destY = window.innerHeight * 0.5;

  if (destEl) {
    const destRect = destEl.getBoundingClientRect();
    destX = destRect.left + destRect.width / 2;
    destY = destRect.top + destRect.height / 2;
  }

  for (let i = 0; i < energyCount; i++) {
    const energyNode = document.createElement('div');
    energyNode.style.position = 'fixed';
    energyNode.style.zIndex = '99999';
    energyNode.style.pointerEvents = 'none';
    energyNode.style.fontSize = '26px';
    energyNode.innerText = '🔷';
    energyNode.style.filter = 'drop-shadow(0 0 6px rgba(0, 210, 255, 0.6))';
    
    // Posición inicial: centro del botón
    energyNode.style.left = (startX - 15) + 'px';
    energyNode.style.top = (startY - 15) + 'px';
    
    // Estado inicial de la transformación
    energyNode.style.setProperty('transform', 'translate(0, 0) scale(0.5)', 'important');
    energyNode.style.setProperty('opacity', '0', 'important');
    energyNode.style.setProperty('transition', 'transform 0.4s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.3s ease-out', 'important');
    
    document.body.appendChild(energyNode);

    // Calcular dirección y fuerza de dispersión aleatoria
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 40;
    const scatterX = Math.cos(angle) * distance;
    const scatterY = Math.sin(angle) * distance - 20;

    // Fase 1: Explosión inicial dispersa
    setTimeout(() => {
      energyNode.style.setProperty('transform', `translate(${scatterX}px, ${scatterY}px) scale(1.1)`, 'important');
      energyNode.style.setProperty('opacity', '1', 'important');
    }, 10 + i * 50);

    // Fase 2: Vuelo hacia el rol
    setTimeout(() => {
      energyNode.style.setProperty('transition', 'transform 0.5s cubic-bezier(0.6, -0.28, 0.735, 0.045), opacity 0.5s ease-in', 'important');
      
      const deltaX = destX - startX;
      const deltaY = destY - startY;
      
      energyNode.style.setProperty('transform', `translate(${deltaX}px, ${deltaY}px) scale(0.6)`, 'important');
      energyNode.style.setProperty('opacity', '1', 'important');
    }, 350 + i * 50);

    // Fase 3: Impacto y destrucción
    setTimeout(() => {
      energyNode.remove();
      
      // Activar efecto visual de pulso en el badge de energía de rol
      if (destEl) {
        const badge = destEl.querySelector('.role-energy-badge');
        if (badge) {
          badge.classList.remove('energy-pulse');
          void badge.offsetWidth;
          badge.classList.add('energy-pulse');
        }
      }
    }, 850 + i * 50);
  }
};

window.animateHealthLoss = function(sourceElOrRect, hpCount) {
  if (typeof gameState !== 'undefined' && (gameState.isGameOver || gameState.isGameWon)) return;
  if (!sourceElOrRect || !hpCount || hpCount <= 0) return;

  let rect;
  if (sourceElOrRect instanceof HTMLElement) {
    rect = sourceElOrRect.getBoundingClientRect();
  } else {
    rect = sourceElOrRect;
  }

  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  for (let i = 0; i < hpCount; i++) {
    const heart = document.createElement('div');
    heart.style.position = 'fixed';
    heart.style.zIndex = '99999';
    heart.style.pointerEvents = 'none';
    heart.style.fontSize = '24px';
    heart.innerText = '❤️';
    
    // Posición inicial: centro del indicador
    let x = startX - 12;
    let y = startY - 12;
    
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    heart.style.transform = 'scale(1)';
    heart.style.opacity = '1';
    document.body.appendChild(heart);

    // Parámetros de la simulación física (dispersión y caída con rebote)
    let vx = (Math.random() - 0.5) * 3.5; 
    let vy = -(Math.random() * 3.0 + 2.0); 
    const gravity = 0.35;
    const bounce = 0.5;
    let rotation = 0;
    
    // Suelo virtual para el rebote (parte inferior de la pantalla)
    const floorY = window.innerHeight - 35 - Math.random() * 10;
    let bounceCount = 0;
    let opacity = 1.0;
    let frames = 0;

    function step() {
      frames++;
      vy += gravity;
      x += vx;
      y += vy;

      if (y >= floorY && vy > 0) {
        y = floorY;
        vy = -vy * bounce;
        vx *= 0.7; // Fricción
        if (bounceCount === 0) {
          rotation = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 15 + 15); // Inclinación aleatoria entre 15 y 30 grados
        }
        bounceCount++;
      }

      if (bounceCount >= 2 || frames > 70) {
        opacity -= 0.05;
        vx *= 0.85;
      }

      heart.style.left = `${x}px`;
      heart.style.top = `${y}px`;
      heart.style.opacity = `${opacity}`;
      heart.style.transform = `rotate(${rotation}deg)`;

      if (opacity > 0) {
        requestAnimationFrame(step);
      } else {
        heart.remove();
      }
    }
    
    requestAnimationFrame(step);
  }
};

window.animateCoinLoss = function(sourceElOrRect, coinCount) {
  if (typeof gameState !== 'undefined' && (gameState.isGameOver || gameState.isGameWon)) return;
  if (!sourceElOrRect || !coinCount || coinCount <= 0) return;

  let rect;
  if (sourceElOrRect instanceof HTMLElement) {
    rect = sourceElOrRect.getBoundingClientRect();
  } else {
    rect = sourceElOrRect;
  }

  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  // Si son muchas monedas, limitamos la animación visual a un máximo de 10 para no saturar
  const visualCoins = Math.min(coinCount, 10);

  for (let i = 0; i < visualCoins; i++) {
    const coin = document.createElement('div');
    coin.style.position = 'fixed';
    coin.style.zIndex = '99999';
    coin.style.pointerEvents = 'none';
    coin.innerHTML = COIN_SVG;
    
    // Hacer que el SVG sea un poco más grande para la animación si se desea
    const svgEl = coin.querySelector('svg');
    if (svgEl) {
      svgEl.setAttribute('width', '24');
      svgEl.setAttribute('height', '24');
    }
    
    // Posición inicial: centro del indicador
    let x = startX - 12;
    let y = startY - 12;
    
    coin.style.left = `${x}px`;
    coin.style.top = `${y}px`;
    coin.style.transform = 'scale(1)';
    coin.style.opacity = '1';
    document.body.appendChild(coin);

    // Parámetros de la simulación física (dispersión y caída con rebote)
    let vx = (Math.random() - 0.5) * 3.5; 
    let vy = -(Math.random() * 3.0 + 2.0); 
    const gravity = 0.35;
    const bounce = 0.5;
    let rotation = 0;
    
    // Suelo virtual para el rebote (parte inferior de la pantalla)
    const floorY = window.innerHeight - 35 - Math.random() * 10;
    let bounceCount = 0;
    let opacity = 1.0;
    let frames = 0;

    function step() {
      frames++;
      vy += gravity;
      x += vx;
      y += vy;

      if (y >= floorY && vy > 0) {
        y = floorY;
        vy = -vy * bounce;
        vx *= 0.7; // Fricción
        if (bounceCount === 0) {
          rotation = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 15 + 15); // Inclinación aleatoria
        }
        bounceCount++;
      }

      if (bounceCount >= 2 || frames > 70) {
        opacity -= 0.05;
        vx *= 0.85;
      }

      coin.style.left = `${x}px`;
      coin.style.top = `${y}px`;
      coin.style.opacity = `${opacity}`;
      coin.style.transform = `rotate(${rotation}deg)`;

      if (opacity > 0) {
        requestAnimationFrame(step);
      } else {
        coin.remove();
      }
    }
    
    requestAnimationFrame(step);
  }
};

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
      deckEl.setAttribute('data-deck-type', type);
      deckEl.innerHTML = '';

      if (gameState.isFirstTurnOfGame || gameState.justBoughtDeck === type) {
        // Set the back image depending on the deck type
        let backImg = 'assets/Equipo/back_esp.webp';
        if (type === 'escudos') backImg = 'assets/Equipo/back_esc.webp';
        if (type === 'curacion') backImg = 'assets/Equipo/back_cure.webp';
        
        deckEl.style.backgroundImage = `url('${backImg}')`;
        deckEl.classList.add('start-covered');
        deckEl.setAttribute('data-front-image', topCard.image);
      } else {
        deckEl.style.backgroundImage = `url('${topCard.image}')`;
      }

      if (p && p.mo >= topCard.cost) {
        deckEl.classList.add('market-affordable');
      }

      deckEl.addEventListener('click', () => {
        // Hito 3: Fuego Cruzado (Senda Piromante)
        if (gameState.activeSenda === 'piromante' && gameState.currentHito === 4) {
          alert("🔥 Fuego Cruzado: Durante este hito no puedes comprar equipo.");
          return;
        }
        const topCard = deck[0];
        const player = gameState.getCurrentPlayer();

        // Si no tiene dinero, no hacemos nada (la UI ya debería reflejarlo o buyFromMarket fallará)
        if (player.mo < topCard.cost) return;

        const executeBuy = () => {
          // Temporarily bypass synchronous updateUI during the purchase operation
          // to prevent nextTurn() from changing the active turn panel in the DOM mid-animation
          const originalUpdateUI = window.updateUI;
          window.updateUI = () => {};
          
          const result = gameState.buyFromMarket(type);
          
          window.updateUI = originalUpdateUI; // Restore immediately
          
          if (result === "OVERWEIGHT") {
            alert(`¡DEMASIADO PESO! No puedes llevar más de ${DB.playerLevels[player.level - 1].blocks} bloques de equipo. Sube de nivel para aumentar tu capacidad.`);
          } else if (result) {
            animateCardPurchase(deckEl, () => {
              gameState.justBoughtDeck = type;
              updateUI();
              if (window.flipSingleMarketCard && gameState.market[type] && gameState.market[type].length > 0) {
                window.flipSingleMarketCard(type);
              }
              gameState.justBoughtDeck = null;
            });
          }
        };

        const hasCard = player.equipped.some(eq => eq.id === topCard.id);

        const promptBuy = () => {
          if (hasCard) {
            openDuplicateWarningModal(type, topCard, executeBuy);
          } else {
            openPurchaseConfirmationModal(topCard, executeBuy);
          }
        };

        if (!gameState.isMarketPhase) {
          openActionLossWarningModal(promptBuy);
        } else {
          promptBuy();
        }
      });

      marketDecks.appendChild(deckEl);
    }
  });

  // 4. Mazo de Pociones (Especial)
  const potionsDeck = document.createElement('div');
  potionsDeck.className = 'deck';
  const isUnlocked = gameState.battlefield.waveLevel >= 3;

  const imgUrl = isUnlocked ? 'assets/Pociones/Pociones.webp' : 'assets/Pociones/bloqueo_pociones.webp';
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

let animatedGoblinUids = new Map();
let previousGoblinHps = new Map();

function getGoblinImageWithHpState(goblin, imageUrl) {
  if (!goblin || goblin.isBoss) return imageUrl;

  const maxHp = goblin.maxHp || (DB.goblins[goblin.level] ? DB.goblins[goblin.level].hp : goblin.currentHp);
  if (!maxHp) return imageUrl;

  const p = goblin.currentHp / maxHp;
  let suffix = "";
  if (p >= 0.75) {
    suffix = "";
  } else if (p >= 0.50) {
    suffix = "_r1";
  } else if (p >= 0.25) {
    suffix = "_r2";
  } else {
    suffix = "_r3";
  }

  if (suffix && imageUrl && typeof imageUrl === 'string') {
    const isStandard = /\/(nomo_)?(0\d|invocacion.*)\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(imageUrl);
    if (isStandard) {
      return imageUrl.replace(/(\.(jpg|jpeg|png|webp))(\?.*)?$/i, `${suffix}$1$3`);
    }
  }
  return imageUrl;
}

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
    
    const hitoBtnText = document.querySelector('#btn-deploy-hito .btn-text');
    if (hitoBtnText) hitoBtnText.innerText = `Enfrentar Hito ${gameState.currentHito}`;
    else btnDeployHito.innerText = `Enfrentar Hito ${gameState.currentHito}`;
    
    if (hitoActionsDiv) hitoActionsDiv.style.display = 'flex';
    btnDeployHito.style.display = 'inline-block';

    // Desactivar si ya hay goblins de hito vivos
    let hasHitoGoblins = gameState.battlefield.goblins.some(g => g.isHito);
    btnDeployHito.disabled = hasHitoGoblins;
    if (hasHitoGoblins) {
      btnDeployHito.title = "Debes derrotar a todos los Goblins de Hito actuales antes de iniciar uno nuevo.";
    } else {
      btnDeployHito.title = "Desplegar el siguiente Hito.";
    }
  } else {
    if (hitoActionsDiv) hitoActionsDiv.style.display = 'flex';
    btnDeployHito.innerText = "Senda Completada";
    btnDeployHito.disabled = true;
  }

  // Capturar coordenadas de los goblins que están muriendo antes de limpiar el contenedor
  const dyingGoblinCoords = new Map();
  if (gameState && gameState.battlefield && gameState.battlefield.goblins) {
    gameState.battlefield.goblins.forEach(goblin => {
      if (goblin.isDying && goblin.gaveReward && !goblin.goldAnimationPlayed) {
        const existingEl = goblinsContainer.querySelector(`[data-uid="${goblin.uid}"]`);
        if (existingEl) {
          const rect = existingEl.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            dyingGoblinCoords.set(goblin.uid, {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height
            });
          }
        }
      }
    });
  }

  goblinsContainer.innerHTML = '';

  const hasGoblinsAlive = gameState.battlefield.goblins.some(g => !g.isDying);
  const showWarlordChoice = (gameState.activeSenda === 'guerrero' && !hasGoblinsAlive && !gameState.isMarketPhase && !gameState.isRetaliationPhase && !gameState.isGameOver);

  if (showWarlordChoice) {
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
        uid: Date.now() + '-' + Math.random().toString(36).substring(2),
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
    btnOptB.addEventListener('mouseenter', (e) => {
      if (!btnOptB.disabled) {
        btnOptB.style.transform = 'scale(1.05)';
        btnOptB.style.boxShadow = '0 6px 20px rgba(212, 175, 55, 0.4)';
        window.showHitoGoblinsTooltip(e);
      }
    });
    btnOptB.addEventListener('mouseleave', () => {
      btnOptB.style.transform = 'scale(1)';
      btnOptB.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.2)';
      window.hideHitoGoblinsTooltip();
    });
    btnOptB.addEventListener('click', () => {
      window.hideHitoGoblinsTooltip();
      const sendaHitos = DB.hitos[gameState.activeSenda] || DB.hitos.iniciacion;
      const hitoToDeploy = sendaHitos[gameState.currentHito - 1];

      if (gameState.deployHito()) {
        updateUI();
      }
    });
    buttonsWrapper.appendChild(btnOptB);

    choiceContainer.appendChild(buttonsWrapper);
    goblinsContainer.appendChild(choiceContainer);
  }

  // Si no hay goblins en mesa y no se muestra la elección del Zeñor de la Guerra, pintar el dorso
  if (gameState.battlefield.goblins.length === 0 && !showWarlordChoice) {
    const backEl = document.createElement('div');
    backEl.className = 'goblin-card goblin-card-back';
    goblinsContainer.appendChild(backEl);
  }

  // Usamos el array original de la mesa para garantizar que el orden NO cambie
  gameState.battlefield.goblins.forEach(goblin => {
    const gobEl = document.createElement('div');
    gobEl.className = 'goblin-card';
    gobEl.dataset.uid = goblin.uid;
    let imageUrl = goblin.image;
    if (goblin.isHito) {
      gobEl.classList.add('goblin-hito');
    } else {
      const pLeader = gameState.players[gameState.currentPlayerIndex] || gameState.players[0];
      if (goblin.level < pLeader.level) {
        gobEl.classList.add('goblin-no-reward');
        if (!goblin.isInvocacion && !imageUrl.includes('invocacion')) {
          imageUrl = imageUrl.replace(/([^\/]+)$/, 'nomo_$1');
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
          pexIcon.innerHTML = `<div class="half-left">💠</div><div class="half-right">💠</div>`;
          
          overlay.appendChild(goldIcon);
          overlay.appendChild(pexIcon);
          gobEl.appendChild(overlay);
          
          setTimeout(() => {
            if (overlay.parentNode) overlay.remove();
            gobEl.classList.remove('goblin-obsolete-anim');
          }, 2500);
        }
      }
    }
    imageUrl = getGoblinImageWithHpState(goblin, imageUrl);
    gobEl.style.backgroundImage = `url('${imageUrl}')`;

    if (goblin.isDying) {
      const hasRealReward = goblin.gaveReward && (goblin.rewardMo > 0 || goblin.rewardPex > 0);
      gobEl.classList.add(hasRealReward ? 'dying-reward' : 'dying');
      gobEl.innerHTML = `<div class="goblin-hp" style="background: var(--accent-red); color: white;">0</div>`;
    } else {
      const isInvulnerable = gameState.isGoblinInvulnerable(goblin);
      if (isInvulnerable) {
        gobEl.classList.add('invulnerable');
      }
      let invulnTitle = "Invulnerable por Regla de Hito";
      if (gameState.activeSenda === 'la_madre') {
        invulnTitle = "Escudos de Carne: ¡La Madre protege a sus crías!";
      } else if (gameState.activeSenda === 'recaudador') {
        if (gameState.currentHito === 3) {
          invulnTitle = "El Peaje: ¡Paga 2 mo de peaje para hacerlo vulnerable!";
        } else if (gameState.currentHito === 5) {
          invulnTitle = "La Banda del Saco: ¡Vence primero a los goblins de Nivel 1!";
        }
      }
      const badgeHTML = isInvulnerable 
        ? `<div class="goblin-invulnerable-badge" title="${invulnTitle}">🛡️</div>` 
        : '';
      gobEl.innerHTML = `<div class="goblin-hp">${goblin.currentHp}</div>${badgeHTML}`;

      // Botón de pago del peaje (Hito 2 Senda Recaudador)
      if (gameState.activeSenda === 'recaudador' && gameState.currentHito === 3 && goblin.level === 2 && !goblin.peajePagado) {
        const payBtn = document.createElement('button');
        payBtn.innerText = 'Pagar Peaje (2 mo)';
        payBtn.style.cssText = 'position: absolute; bottom: 10px; left: 5%; width: 90%; padding: 6px 4px; font-family: "Outfit", sans-serif; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; color: #fff; background: linear-gradient(135deg, #d4af37 0%, #aa7c11 100%); border: 1px solid var(--gold); border-radius: 6px; cursor: pointer; transition: all 0.2s ease; z-index: 10; box-shadow: 0 4px 8px rgba(0,0,0,0.5);';
        
        let activeP = gameState.getCurrentPlayer();
        if (activeP && activeP.mo < 2) {
          payBtn.disabled = true;
          payBtn.style.background = '#444';
          payBtn.style.border = '1px solid #666';
          payBtn.style.cursor = 'not-allowed';
          payBtn.title = "No tienes suficiente oro (se requieren 2 mo)";
        } else {
          payBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (activeP) {
              activeP.mo -= 2;
              goblin.peajePagado = true;
              gameState.addLog(`🪙 <strong>Peaje Pagado:</strong> Pagas <span style="color:#ffd700">2 mo</span>. ¡El Goblin Nivel 2 ya no es Invulnerable!`);
              updateUI();
            }
          });
          payBtn.addEventListener('mouseenter', () => {
            payBtn.style.transform = 'scale(1.05)';
            payBtn.style.boxShadow = '0 0 10px var(--gold)';
          });
          payBtn.addEventListener('mouseleave', () => {
            payBtn.style.transform = 'scale(1)';
            payBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';
          });
        }
        gobEl.appendChild(payBtn);
      }

      // Comprobar si es un goblin nuevo para aplicarle la animación correspondiente
      const spawnTime = animatedGoblinUids.get(goblin.uid);
      if (!spawnTime) {
        animatedGoblinUids.set(goblin.uid, Date.now());
        if (goblin.isMutated) {
          gobEl.classList.add('goblin-mutation-active');
        } else {
          gobEl.classList.add('goblin-wobble-active');
        }
      } else if (Date.now() - spawnTime < 850) {
        if (goblin.isMutated) {
          gobEl.classList.add('goblin-mutation-active');
        } else {
          gobEl.classList.add('goblin-wobble-active');
        }
      } else {
        // Si no es nuevo, comprobar si ha sufrido daño para hacer la animación de saltito
        const prevHp = previousGoblinHps.get(goblin.uid);
        if (prevHp !== undefined && goblin.currentHp < prevHp && !goblin.isDying) {
          console.log(`[BOUNCE-LIVE] Goblin UID: ${goblin.uid}, HP decreased: ${prevHp} -> ${goblin.currentHp}`);
          gobEl.classList.remove('goblin-wobble-active', 'goblin-mutation-active');
          void gobEl.offsetWidth; // Force reflow/repaint
          gobEl.classList.add('goblin-damaged-bounce-active');
          setTimeout(() => {
            gobEl.classList.remove('goblin-damaged-bounce-active');
          }, 900);
        }
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

          // Deseleccionar también al compañero si tiene
          if (goblin.partnerUid) {
            const partnerIdx = selectedGoblins.findIndex(g => g.uid === goblin.partnerUid);
            if (partnerIdx !== -1) {
              selectedGoblins.splice(partnerIdx, 1);
              const partnerEl = goblinsContainer.querySelector(`[data-uid="${goblin.partnerUid}"]`);
              if (partnerEl) {
                partnerEl.classList.remove('selected');
              }
            }
          }
        } else {
          // Escudos de Carne (Senda de La Madre)
          if (gameState.activeSenda === 'la_madre' && !goblin.isDying && gameState.isGoblinInvulnerable(goblin)) {
            const aliveGobs = gameState.battlefield.goblins.filter(g => !g.isDying);
            const minLevel = Math.min(...aliveGobs.map(g => g.level));
            alert(`🛡️ Escudos de Carne: ¡La Madre protege a sus crías!\n\nDebes eliminar primero a los Goblins de nivel inferior (Nivel ${minLevel}) antes de poder atacar a este Goblin de Nivel ${goblin.level}.`);
            return;
          }

          // Senda Recaudador - Goblins Invulnerables
          if (gameState.activeSenda === 'recaudador' && !goblin.isDying && gameState.isGoblinInvulnerable(goblin)) {
            if (gameState.currentHito === 3 && goblin.level === 2 && !goblin.peajePagado) {
              alert(`💰 El Peaje: ¡El Goblin de Nivel 2 es Invulnerable hasta que pagues su peaje de 2 mo!\n\nUsa el botón "Pagar Peaje (2 mo)" en su carta para poder atacarlo.`);
            } else if (gameState.currentHito === 5 && (goblin.level === 2 || goblin.level === 3)) {
              alert(`🛍️ La Banda del Saco: ¡Los Goblins de Nivel 2 y Nivel 3 son Invulnerables mientras haya algún goblin de Nivel 1 vivo!`);
            }
            return;
          }

          // Check general de invulnerabilidad
          if (gameState.isGoblinInvulnerable(goblin) && !goblin.isDying) {
            alert("Este Goblin es Invulnerable. No puedes seleccionarlo como objetivo de tus ataques.");
            return;
          }

          selectedGoblins.push(goblin);
          gobEl.classList.add('selected');

          // Seleccionar también al compañero si tiene y sigue vivo en el tablero
          if (goblin.partnerUid) {
            const partner = gameState.battlefield.goblins.find(g => g.uid === goblin.partnerUid && !g.isDying);
            if (partner && !selectedGoblins.some(sg => sg.uid === partner.uid)) {
              selectedGoblins.push(partner);
              const partnerEl = goblinsContainer.querySelector(`[data-uid="${partner.uid}"]`);
              if (partnerEl) {
                partnerEl.classList.add('selected');
              }
            }
          }
        }
        const btn = document.getElementById('btn-confirm-attack');
        if (btn) btn.innerHTML = `<span class="txt-largo">Atacar Goblins (${selectedGoblins.length})</span><span class="txt-corto">Atacar (${selectedGoblins.length})</span><img src="assets/ico_combat.png" class="mobile-btn-icon" alt="Atacar">`;
      });
    }

    goblinsContainer.appendChild(gobEl);

    // Trigger coin and PEX explosion animations if the goblin gave reward and it hasn't played yet
    if (goblin.isDying && goblin.gaveReward && !goblin.goldAnimationPlayed) {
      goblin.goldAnimationPlayed = true;
      const activePlayer = gameState.getCurrentPlayer();
      const isNormalReward = (goblin.isHito || (activePlayer && goblin.level >= activePlayer.level));
      
      // Oro (hacia el HUD a la derecha)
      let baseMo = isNormalReward ? (goblin.mo || 0) : 0;
      if (goblin.isInvocacion) {
        baseMo = 0;
      }
      const extraMo = (gameState.activeSenda === 'recaudador') ? 1 : 0;
      
      // Usar los valores precálculados si existen para evitar desincronizaciones al subir de nivel
      const coinsToSpawn = (goblin.rewardMo !== undefined) 
        ? (goblin.rewardMo + extraMo) 
        : (baseMo + extraMo);
      
      // Obtener coordenadas desde el elemento anterior o desde el nuevo ya insertado en el DOM
      let coords = dyingGoblinCoords.get(goblin.uid);
      if (!coords) {
        const rect = gobEl.getBoundingClientRect();
        coords = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        };
      }

      if (coinsToSpawn > 0) {
        // Delay ligeramente para que comience después de iniciar la opacidad de muerte
        setTimeout(() => {
          window.animateGoldDrop(coords, coinsToSpawn);
        }, 150);
      }

      // PEX (hacia el panel de grupo a la izquierda)
      const pexToSpawn = (goblin.rewardPex !== undefined)
        ? goblin.rewardPex
        : (isNormalReward ? (goblin.pex || 0) : 0);
        
      if (pexToSpawn > 0) {
        // Ligeramente desfasado del oro para un flujo dinámico secuencial
        setTimeout(() => {
          window.animatePexDrop(coords, pexToSpawn);
        }, 250);
      }
    }
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

  // Actualizar el historial de vidas de los goblins para la detección de daño en el siguiente render
  previousGoblinHps.clear();
  gameState.battlefield.goblins.forEach(gob => {
    previousGoblinHps.set(gob.uid, gob.currentHp);
  });
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

var currentAssignments = {};
var interceptionAssignments = {};

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

let isRollingCombatDice = false;

function triggerCombatDiceRoll() {
  isRollingCombatDice = true;
  renderCombatOverlay();

  const dicePoolContainer = document.getElementById('combat-dice-pool');
  const playerDiceEls = dicePoolContainer.querySelectorAll('.die');
  
  const goblinDiceEls = [];
  const combatGoblinsContainer = document.getElementById('combat-goblins-container');
  if (combatGoblinsContainer) {
    const greenDice = combatGoblinsContainer.querySelectorAll('.die.green');
    greenDice.forEach(d => goblinDiceEls.push(d));
  }
  
  const intervals = [];
  
  playerDiceEls.forEach(el => {
    const dieId = el.id;
    const dieObj = gameState.currentCombat.playerDice.find(d => d.id === dieId);
    if (!dieObj) return;
    
    if (dieObj.isCramped || dieObj.isShaking) return;
    
    const faces = dieObj.faces;
    const interval = setInterval(() => {
      el.innerText = Math.floor(Math.random() * faces) + 1;
    }, 60);
    intervals.push(interval);
  });
  
  goblinDiceEls.forEach(el => {
    let faces = 6;
    const match = el.className.match(/d(\d+)/);
    if (match) {
      faces = parseInt(match[1], 10);
    }
    const interval = setInterval(() => {
      el.innerText = Math.floor(Math.random() * faces) + 1;
    }, 60);
    intervals.push(interval);
  });
  
  setTimeout(() => {
    intervals.forEach(clearInterval);
    isRollingCombatDice = false;
    renderCombatOverlay();
    if (window.botManager) window.botManager.handleGameState();
  }, 300);
}

function renderRetaliationModal() {
  if (!gameState.isRetaliationPhase || !gameState.retaliationQueue || gameState.retaliationQueue.length === 0) {
    const overlay = document.getElementById('global-event-overlay');
    if (overlay) overlay.classList.add('hidden');
    const modal = document.querySelector('.event-modal');
    if (modal) modal.classList.remove('retaliation-theme');
    const container = document.getElementById('event-choices-container');
    if (container) container.classList.remove('retaliation-layout');
    window.resetEventModalTransparency();
    return;
  }

  window.resetEventModalTransparency();
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');
  const modal = document.querySelector('.event-modal');
  const eyeBtn = document.getElementById('event-modal-eye-btn');
  if (eyeBtn) {
    eyeBtn.classList.remove('hidden');
  }

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

      let botBubbleHTML = '';
      if (p.isBot) {
        botBubbleHTML = `
          <div id="retaliation-bot-bubble-${idx}" class="retaliation-bot-bubble" style="display: none;">
            <div id="retaliation-bot-bubble-text-${idx}" style="line-height: 1.4;"></div>
            <div style="position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid var(--gold); transition: border-top-color 0.3s;"></div>
            <div style="position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 7px solid rgba(245, 245, 250, 0.95);"></div>
          </div>
        `;
      }

      zone.innerHTML = `
        ${botBubbleHTML}
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
        bulkBtn.style.cssText = 'font-size: 0.8rem; margin-top: 10px; padding: 12px 10px; width: 100%; box-sizing: border-box;';
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

  gameState.retaliationEscudoDeOroTriggers = [];

  remaining.forEach(gob => {
    gameState.assignRetaliationDamage(gob.uid, pIndex);
  });

  const triggers = gameState.retaliationEscudoDeOroTriggers || [];

  const showNextUI = () => {
    updateUI();
    if (!gameState.isGameOver) {
      if (!gameState.isRetaliationPhase) {
        document.getElementById('global-event-overlay').classList.add('hidden');
        const modal = document.querySelector('.event-modal');
        if (modal) modal.classList.remove('retaliation-theme');
        container.classList.remove('retaliation-layout');
        window.resetEventModalTransparency();
      } else if (gameState.retaliationQueue.length > 0) {
        renderRetaliationModal();
      }
    }
  };

  if (triggers.length > 0) {
    let messageLines = ["¡ESCUDO DE ORO!\n"];
    triggers.forEach(t => {
      if (t.hasGold) {
        messageLines.push(`🪙 **${t.playerName}** usa 1 mo para mitigar el ataque del Goblin de Nvl ${t.goblinLevel}.\n• Monedas perdidas: -1 mo\n• Vida perdida: -${t.hpLost} PV\n`);
      } else {
        messageLines.push(`💸 **${t.playerName}** no tiene monedas de oro. ¡Sufre +1 daño de penalización!\n• Vida perdida: -${t.hpLost} PV (Ataque Nvl ${t.goblinLevel} + 1 extra)\n`);
      }
    });
    alert(messageLines.join('\n'), showNextUI);
  } else {
    showNextUI();
  }
}

function handleRetaliationChoice(gobUids, playerIdx) {
  activeSelectedOrbUids = [];
  const uids = Array.isArray(gobUids) ? gobUids : [gobUids];

  gameState.retaliationEscudoDeOroTriggers = [];

  let anyAssigned = false;
  uids.forEach(uid => {
    if (gameState.assignRetaliationDamage(uid, playerIdx)) {
      anyAssigned = true;
    }
  });

  if (anyAssigned) {
    const triggers = gameState.retaliationEscudoDeOroTriggers || [];

    const showNextUI = () => {
      updateUI();
      if (!gameState.isGameOver) {
        if (!gameState.isRetaliationPhase) {
          document.getElementById('global-event-overlay').classList.add('hidden');
          const modal = document.querySelector('.event-modal');
          if (modal) modal.classList.remove('retaliation-theme');
          const container = document.getElementById('event-choices-container');
          if (container) container.classList.remove('retaliation-layout');
          window.resetEventModalTransparency();
        } else {
          renderRetaliationModal();
        }
      }
    };

    if (triggers.length > 0) {
      let messageLines = ["¡ESCUDO DE ORO!\n"];
      triggers.forEach(t => {
        if (t.hasGold) {
          messageLines.push(`🪙 **${t.playerName}** usa 1 mo para mitigar el ataque del Goblin de Nvl ${t.goblinLevel}.\n• Monedas perdidas: -1 mo\n• Vida perdida: -${t.hpLost} PV\n`);
        } else {
          messageLines.push(`💸 **${t.playerName}** no tiene monedas de oro. ¡Sufre +1 daño de penalización!\n• Vida perdida: -${t.hpLost} PV (Ataque Nvl ${t.goblinLevel} + 1 extra)\n`);
        }
      });
      alert(messageLines.join('\n'), showNextUI);
    } else {
      setTimeout(showNextUI, 100);
    }
  }
}

function renderGameWon() {
  window.resetEventModalTransparency();
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');
  const modal = document.querySelector('.event-modal');

  if (overlay) {
    overlay.classList.add('victory-theme');
  }

  if (modal) {
    modal.classList.remove('retaliation-theme');
    modal.classList.add('victory-theme');
    modal.style.border = '';
    modal.style.boxShadow = '';
  }

  title.innerHTML = `🌟 ¡VICTORIA! 🌟`;
  title.style.color = 'var(--gold)';

  const phrase = DB.victoryPhrases ? DB.victoryPhrases[Math.floor(Math.random() * DB.victoryPhrases.length)] : "¡Habéis limpiado la senda y la gloria es vuestra!";

  desc.innerHTML = `
    <img src="assets/victoria.jpg" style="width: 100%; max-height: 500px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(212, 175, 55, 0.5); pointer-events: none; -webkit-user-drag: none; user-select: none;" onerror="this.src='assets/final.jpg'">
    <div style="font-size: 1.5rem; margin-bottom: 20px; color: #fff;">¡El Jefe ha caído!</div>
    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(212, 175, 55, 0.3);">
      <p style="margin-bottom: 10px;">Completasteis la <strong>${gameState.activeSenda.replace('_', ' ').toUpperCase()}</strong></p>
      <p style="font-size: 0.9rem; color: var(--text-cita); font-style: italic;">"${phrase}"</p>
    </div>
  `;

  container.innerHTML = `
    <button class="choice-btn" style="background: var(--gold); color: #000; border: none; font-weight: bold; font-size: 1.2rem; padding: 15px 30px; border-radius: 8px; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);" onclick="location.reload()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Jugar de Nuevo</button>
  `;

  const eyeBtn = document.getElementById('event-modal-eye-btn');
  if (eyeBtn) eyeBtn.classList.remove('hidden');
  
  overlay.classList.remove('hidden');
}

function renderGameOver() {
  window.resetEventModalTransparency();
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
    <img src="assets/final.jpg" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(230, 57, 70, 0.5); pointer-events: none; -webkit-user-drag: none; user-select: none;">
    <div style="font-size: 1.5rem; margin-bottom: 20px; color: #fff;">¡Habéis sido derrotados!</div>
    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(230, 57, 70, 0.3);">
      <p style="margin-bottom: 10px;">Llegasteis hasta la <strong>Oleada ${gameState.battlefield.waveLevel}</strong> &nbsp;&nbsp;|&nbsp;&nbsp; Llegasteis hasta el <strong>Hito ${gameState.currentHito}</strong></p>
      <p style="font-size: 0.9rem; color: var(--text-cita); font-style: italic;">"${phrase}"</p>
    </div>
  `;


  container.innerHTML = `
    <button class="btn primary" onclick="location.reload()" style="padding: 15px 40px; font-size: 1.2rem;">
      INTENTAR DE NUEVO
    </button>
  `;

  const eyeBtn = document.getElementById('event-modal-eye-btn');
  if (eyeBtn) eyeBtn.classList.remove('hidden');
  
  overlay.classList.remove('hidden');
}

function openPotionsModal() {
  window.resetEventModalTransparency();
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
        Salud: <span id="potion-modal-current-hp">${p.hp}</span> / ${p.maxHp}
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

    let minHeal = 0;
    let maxHeal = 0;
    let formula = poc.effect.toLowerCase().replace(/cura|pv|\s/g, '');
    let parts = formula.split('+');
    parts.forEach(part => {
      let diceMatch = part.match(/(\d+)d(\d+)/);
      if (diceMatch) {
        let numDice = parseInt(diceMatch[1]);
        let faces = parseInt(diceMatch[2]);
        minHeal += numDice;
        maxHeal += numDice * faces;
      } else {
        let val = parseInt(part);
        if (!isNaN(val)) {
          minHeal += val;
          maxHeal += val;
        }
      }
    });
    
    let rangeHtml = '';
    if (minHeal > 0) {
      rangeHtml = `<br><span style="color: #888; font-size: 0.8rem;">(${minHeal} - ${maxHeal})</span>`;
    }

    card.innerHTML = `
      <div style="width: 80px; height: 80px; background-image: url('${poc.image}'); background-size: cover; border-radius: 50%; border: 2px solid var(--gold);"></div>
      <div style="font-weight: bold; color: var(--gold);">${poc.name}</div>
      <div style="font-size: 0.85rem; text-align: center; color: #ccc; min-height: 40px;">${poc.effect}${rangeHtml}</div>
      <button class="btn secondary" style="width: 100%;" ${p.mo < poc.cost ? 'disabled' : ''}>
        Comprar <BR> ${poc.cost} mo
      </button>
    `;

    const btn = card.querySelector('button');
    btn.onclick = () => {
      // Hito 3: Fuego Cruzado (Senda Piromante)
      if (gameState.activeSenda === 'piromante' && gameState.currentHito === 4) {
        alert("🔥 Fuego Cruzado: Durante este hito no puedes comprar equipo.");
        return;
      }
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
    window.resetEventModalTransparency();
  };
  container.appendChild(closeBtn);

  overlay.classList.remove('hidden');
}

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

// Observador para cambios de tamaño en ventana
window.addEventListener('resize', updateNarrowStates);

function openDuplicateWarningModal(type, card, onConfirm) {
  window.resetEventModalTransparency();
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');

  title.innerText = "¡OBJETO DUPLICADO!";
  title.style.color = "var(--accent-red)";
  desc.innerHTML = `Ya tienes un <strong>${card.name}</strong> equipado.<br><br>¿Deseas comprar otra copia para guardarla en el almacén de tu mochila?<br><br><em>(Podras intercambiarlos cuando quieras si alguno se rompe o para gestionar tu peso)</em>`;

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
    overlay.classList.add('hidden');
    window.resetEventModalTransparency();
    if (onConfirm) {
      onConfirm();
    } else {
      gameState.buyFromMarket(type);
      updateUI();
    }
  };

  const btnNo = document.createElement('button');
  btnNo.className = 'btn secondary';
  btnNo.innerText = "CANCELAR COMPRA";
  btnNo.onclick = () => {
    overlay.classList.add('hidden');
    window.resetEventModalTransparency();
  };

  container.appendChild(btnYes);
  container.appendChild(btnNo);
  overlay.classList.remove('hidden');
}

function openPurchaseConfirmationModal(card, onConfirm) {
  window.resetEventModalTransparency();
  const overlay = document.getElementById('global-event-overlay');
  const title = document.getElementById('event-modal-title');
  const desc = document.getElementById('event-modal-desc');
  const container = document.getElementById('event-choices-container');

  title.innerText = "CONFIRMAR COMPRA";
  title.style.color = "var(--gold)";
  desc.innerHTML = `¿Deseas comprar <strong>${card.name}</strong> por <strong>${card.cost} mo</strong>?`;

  container.innerHTML = '';
  const marker = document.createElement('div');
  marker.className = 'purchase-confirmation-card';
  container.appendChild(marker);

  const btnYes = document.createElement('button');
  btnYes.className = 'btn primary';
  btnYes.style.marginRight = '10px';
  btnYes.innerText = "SÍ, COMPRAR";
  btnYes.onclick = () => {
    overlay.classList.add('hidden');
    window.resetEventModalTransparency();
    onConfirm();
  };

  const btnNo = document.createElement('button');
  btnNo.className = 'btn secondary';
  btnNo.innerText = "CANCELAR";
  btnNo.onclick = () => {
    overlay.classList.add('hidden');
    window.resetEventModalTransparency();
  };

  container.appendChild(btnYes);
  container.appendChild(btnNo);
  overlay.classList.remove('hidden');
}

function openActionLossWarningModal(onConfirm) {
  window.resetEventModalTransparency();
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
    window.resetEventModalTransparency();
    onConfirm();
  };

  const btnNo = document.createElement('button');
  btnNo.className = 'btn secondary';
  btnNo.innerText = "CANCELAR COMPRA";
  btnNo.onclick = () => {
    overlay.classList.add('hidden');
    window.resetEventModalTransparency();
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
                  if (d.type === 'die' || d.type === 'fixed' || d.type === 'mod') newTotal += d.val;
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

const btnSaveGame = document.getElementById('btn-save-game');
if (btnSaveGame) {
  btnSaveGame.addEventListener('click', () => {
    window.saveGame();
    const originalText = btnSaveGame.innerHTML;
    btnSaveGame.innerHTML = '&#128190; ¡Guardado!';
    btnSaveGame.style.color = '#4caf50';
    btnSaveGame.style.borderColor = '#4caf50';
    setTimeout(() => {
      btnSaveGame.innerHTML = originalText;
      btnSaveGame.style.color = '';
      btnSaveGame.style.borderColor = '';
    }, 2000);
  });
};

window.loadGame = function() {
  const saveData = localStorage.getItem('malditosGoblinsSave');
  if (saveData) {
    const data = JSON.parse(saveData);
    Object.assign(gameState, data);

    if (!gameState.combatHistory) {
      gameState.combatHistory = [];
    }

    // RETROFIT: Ensure level 4+ players have their silver die
    if (gameState.players) {
       gameState.players.forEach(p => {
          if (p.level >= 4 && !p.dicePool.some(d => d.type === 'silver')) {
             p.dicePool.push({ type: 'silver', faces: 3 });
          }
       });
    }
    gameState.addLog(`&#128190; <strong>Partida cargada correctamente.</strong>`);
    
    document.querySelectorAll('.modal, .overlay').forEach(el => {
      el.classList.add('hidden');
      el.style.display = '';
    });
    
    updateUI();
  }
};



const btnLoadGame = document.getElementById('btn-load-game');
if (btnLoadGame) {
  if (localStorage.getItem('malditosGoblinsSave')) {
    btnLoadGame.style.display = 'inline-block';
  }
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
// --- DEBUG COMBAT ---
const btnDebugCombat = document.getElementById('btn-debug-combat');

window.getCombatDebugHtml = function(state) {
  if (!state) return "<em>No hay datos disponibles.</em>";
  let html = `<div style="font-family: sans-serif; color: #ddd; line-height: 1.4;">`;
  
  html += `<h3 style="color: var(--gold); border-bottom: 1px solid var(--gold); padding-bottom: 5px; margin-top: 5px;">Héroe al Inicio: ${state.player.playerNum ? 'J' + state.player.playerNum + ' - ' : ''}${state.player.name}</h3>`;
  html += `<ul>`;
  html += `<li><strong>Salud:</strong> ${state.player.hp} | <strong>Escudos:</strong> ${state.player.shield} | <strong>Energía:</strong> ${state.player.energy}</li>`;
  html += `<li><strong>Oro:</strong> ${state.player.mo} | <strong>Experiencia:</strong> ${state.player.pex}</li>`;
  
  let equipList = state.player.equipped.map(eq => eq.isBroken ? `<s>${eq.name}</s> (Roto)` : eq.name).join(', ');
  html += `<li><strong>Equipo:</strong> ${equipList || 'Ninguno'}</li>`;
  html += `</ul>`;

  html += `<h3 style="color: var(--accent-red); border-bottom: 1px solid var(--accent-red); padding-bottom: 5px;">Goblins en combate</h3>`;
  html += `<ul>`;
  if (state.goblins && state.goblins.length > 0) {
    state.goblins.forEach(g => {
      let gobName = g.name && g.name !== 'undefined' ? g.name : "Goblin";
      let hpAfterStr = g.hpAfter !== undefined ? ` ➔ ${g.hpAfter}` : '';
      html += `<li><strong>${gobName}</strong> (Nivel ${g.level}) - PV: ${g.hp}${hpAfterStr}</li>`;
    });
  } else {
    html += `<li>Ninguno</li>`;
  }
  html += `</ul>`;

  if (state.resolvedDetails) {
    const details = state.resolvedDetails;
    
    // 1. Tus Dados (Héroe)
    html += `<h3 style="color: #f1c40f; border-bottom: 1px solid #f1c40f; padding-bottom: 5px;">Tus Dados (Héroe)</h3>`;
    if (state.playerDice && state.playerDice.length > 0) {
      html += `<div style="margin-bottom: 12px; display: flex; gap: 6px; flex-wrap: wrap;">`;
      state.playerDice.forEach(d => {
        let bg = d.type === 'yellow' ? '#f1c40f' : (d.type === 'black' ? '#333' : (d.type === 'red' ? '#e74c3c' : (d.type === 'silver' ? 'linear-gradient(135deg, #e0e0e0, #999999)' : '#3498db')));
        let col = d.type === 'yellow' ? '#000' : (d.type === 'silver' ? '#111' : '#fff');
        let border = d.type === 'silver' ? '1px solid #666' : '1px solid #fff';
        let val = d.value !== undefined ? d.value : d.val;
        html += `<span style="display:inline-block; background:${bg}; color:${col}; padding:3px 10px; border-radius:4px; font-weight:bold; border:${border}; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">${val}</span>`;
      });
      html += `</div>`;
    }

    if (details.playerDiceDetails && details.playerDiceDetails.length > 0) {
      html += `<ul style="padding-left: 20px; margin-top: 8px;">`;
      details.playerDiceDetails.forEach(d => {
        let actions = [];
        if (d.damage > 0) actions.push(`infligió <span style="color:#ff4d4d; font-weight:bold;">${d.damage} daño</span> a <strong>${d.target}</strong>`);
        if (d.shield > 0) actions.push(`otorgó <span style="color:#3498db; font-weight:bold;">${d.shield} escudo</span>`);
        if (d.heal > 0) actions.push(`curó <span style="color:#2ecc71; font-weight:bold;">${d.heal} PV</span>`);
        if (d.energyGained > 0) actions.push(`generó <span style="color:#00d2ff; font-weight:bold;">${d.energyGained} energía de rol</span>`);
        
        let actionStr = actions.length > 0 ? actions.join(' y ') : "no aportó efectos numéricos (carta rota o no coincidente)";
        if (d.isIntercept) {
          actionStr = `anuló el dado del goblin de valor <span style="color:#2ecc71; font-weight:bold;">${d.value}</span>`;
        }
        
        // Buscar tipo del dado para renderizarlo con su color
        let dieType = 'red';
        if (state.playerDice) {
          const found = state.playerDice.find(pd => pd.id === d.dieId);
          if (found) dieType = found.type;
        }
        let bg = dieType === 'yellow' ? '#f1c40f' : (dieType === 'black' ? '#333' : (dieType === 'red' ? '#e74c3c' : (dieType === 'silver' ? 'linear-gradient(135deg, #e0e0e0, #999999)' : '#3498db')));
        let col = dieType === 'yellow' ? '#000' : (dieType === 'silver' ? '#111' : '#fff');
        let border = dieType === 'silver' ? '1px solid #666' : '1px solid #fff';
        let dieBadge = `<span style="display:inline-block; background:${bg}; color:${col}; padding:1px 6px; border-radius:4px; font-weight:bold; border:${border}; font-size:0.9rem; margin: 0 2px;">${d.value}</span>`;

        html += `<li style="margin-bottom:6px;">Dado ${dieBadge} asignado a <strong>${d.assignedTo}</strong>: ${actionStr}.</li>`;
      });
      html += `</ul>`;
    } else {
      html += `<p>No se asignaron dados a equipo o rol.</p>`;
    }

    // 2. Dados de Goblins (Verdes)
    html += `<h3 style="color: #2ecc71; border-bottom: 1px solid #2ecc71; padding-bottom: 5px;">Dados de Goblins (Verdes)</h3>`;
    if (details.goblinDiceDetails && details.goblinDiceDetails.length > 0) {
      html += `<ul style="padding-left: 20px;">`;
      details.goblinDiceDetails.forEach(d => {
        let statusStr = '';
        if (d.isIntercepted) {
          // Buscar tipo del dado interceptor para colorearlo
          let interceptDieType = 'red';
          if (state.playerDice && d.interceptedByDieId) {
            const found = state.playerDice.find(pd => pd.id === d.interceptedByDieId);
            if (found) interceptDieType = found.type;
          }
          let ibg = interceptDieType === 'yellow' ? '#f1c40f' : (interceptDieType === 'black' ? '#333' : (interceptDieType === 'red' ? '#e74c3c' : (interceptDieType === 'silver' ? 'linear-gradient(135deg, #e0e0e0, #999999)' : '#3498db')));
          let icol = interceptDieType === 'yellow' ? '#000' : (interceptDieType === 'silver' ? '#111' : '#fff');
          let iborder = interceptDieType === 'silver' ? '1px solid #666' : '1px solid #fff';
          let interceptBadge = `<span style="display:inline-block; background:${ibg}; color:${icol}; padding:1px 6px; border-radius:4px; font-weight:bold; border:${iborder}; font-size:0.9rem; margin: 0 2px;">${d.interceptedBy}</span>`;
          
          statusStr = ` <span style="color:#2ecc71; font-size:0.9rem;">(Interceptado por dado ${interceptBadge})</span>`;
        }
        
        let dieBadge = `<span style="display:inline-block; background:#2ecc71; color:#000; padding:2px 8px; border-radius:4px; font-weight:bold; margin-right:4px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">${d.val}</span>`;
        let gName = d.goblinName && d.goblinName !== 'undefined' ? d.goblinName : "Goblin";
        
        html += `<li style="margin-bottom:10px;"><strong>${gName}</strong> sacó: ${dieBadge}${statusStr}`;
        if (d.effects && d.effects.length > 0) {
          html += `<ul style="padding-left: 15px; margin-top: 4px; font-size:0.95rem;">`;
          d.effects.forEach(eff => {
            const effTextLow = eff.text.toLowerCase();
            let color = '#888';
            
            if (eff.status === 'aplicado') {
              if (effTextLow.includes('rotura no esquivable')) {
                color = '#c975ff'; // Morado
              } else if (effTextLow.includes('calambre')) {
                color = '#f1c40f'; // Amarillo
              } else if (effTextLow.includes('tembleque')) {
                color = '#00d2ff'; // Azul cielo
              } else if (effTextLow.includes('escozor')) {
                color = '#ff8c00'; // Naranja
              } else {
                color = '#ff6b6b'; // Rojo standard
              }
            }
            
            let decoration = eff.status === 'aplicado' ? 'font-weight:bold;' : 'text-decoration:line-through;';
            let icon = eff.status === 'aplicado' ? '💥' : '🛡️';
            
            let textToShow = eff.text;
            if (eff.status === 'mitigado') {
              textToShow = `${eff.text} (Mitigado)`;
            }
            
            html += `<li style="color:${color}; ${decoration}">${icon} ${textToShow}</li>`;
          });
          html += `</ul>`;
        } else {
          html += `<div style="font-size:0.9rem; color:#aaa; margin-left: 15px; font-style:italic;">(Sin efectos especiales de ataque para este dado)</div>`;
        }
        html += `</li>`;
      });
      html += `</ul>`;
    } else {
      html += `<p>Los goblins no tiraron dados de ataque.</p>`;
    }

    // 3. Resultado Final del Héroe
    const outcome = details.finalPlayerOutcome;
    html += `<h3 style="color: #e74c3c; border-bottom: 1px solid #e74c3c; padding-bottom: 5px;">Daño e Impacto Final en Héroe</h3>`;
    html += `<ul style="padding-left: 20px; font-size: 1.05rem;">`;
    html += `<li><strong>Daño Directo Recibido:</strong> <span style="color:#ff4d4d; font-weight:bold;">${outcome.directDamageReceived}</span></li>`;
    html += `<li><strong>Daño Normal Recibido (antes de escudo):</strong> <span style="color:#e67e22; font-weight:bold;">${outcome.normalDamageIncoming}</span></li>`;
    html += `<li><strong>Daño Bloqueado por Escudos:</strong> <span style="color:#3498db; font-weight:bold;">${outcome.damageBlocked}</span></li>`;
    html += `<li><strong>Daño Normal Neto Recibido:</strong> <span style="color:#ff4d4d; font-weight:bold;">${outcome.netNormalDamageReceived}</span></li>`;
    if (outcome.escozorDamageDealt > 0) {
      html += `<li><strong>Daño por usar dados con Escozor:</strong> <span style="color:#ff8c00; font-weight:bold;">${outcome.escozorDamageDealt}</span></li>`;
    }
    if (outcome.warlordExtraDmg > 0) {
      html += `<li><strong>Daño Extra por Golpe Certero (Jefe):</strong> <span style="color:#ff4d4d; font-weight:bold;">${outcome.warlordExtraDmg}</span></li>`;
    }
    if (outcome.healed > 0) {
      html += `<li><strong>Curación Recibida:</strong> <span style="color:#2ecc71; font-weight:bold;">+${outcome.healed}</span></li>`;
    }
    
    let hpChangeStr = '';
    let hpGainFromLevelUp = 0;
    if (outcome.levelAfter > outcome.levelBefore) {
      hpGainFromLevelUp = (outcome.levelAfter - outcome.levelBefore) * 5;
    }
    let netHpChange = outcome.hpAfter - outcome.hpBefore - hpGainFromLevelUp;
    
    if (outcome.finalDamageHpChange > 0) {
      hpChangeStr = `<span style="color:#ff4d4d; font-weight:bold;">-${outcome.finalDamageHpChange} PV</span>`;
    } else if (netHpChange > 0) {
      hpChangeStr = `<span style="color:#2ecc71; font-weight:bold;">+${netHpChange} PV</span>`;
    } else {
      hpChangeStr = `<span style="color:#888; font-weight:bold;">Sin cambio neto</span>`;
    }
    
    let levelUpExtraText = hpGainFromLevelUp > 0 ? ` <span style="color:#f1c40f; font-size:0.9rem;">(+${hpGainFromLevelUp} PV de Nivel)</span>` : "";
    html += `<li style="margin-top:10px; border-top:1px solid #444; padding-top:8px;"><strong>Salud del Héroe:</strong> ${outcome.hpBefore} ➔ <strong>${outcome.hpAfter}</strong> (${hpChangeStr}${levelUpExtraText})</li>`;
    html += `</ul>`;
    
  } else {
    // Fallback para combates antiguos
    html += `<h3 style="color: #f1c40f; border-bottom: 1px solid #f1c40f; padding-bottom: 5px;">Tus Dados (Héroe)</h3>`;
    if (state.playerDice && state.playerDice.length > 0) {
      html += `<p>${state.playerDice.map(d => {
        let bg = d.type === 'yellow' ? '#f1c40f' : (d.type === 'black' ? '#333' : (d.type === 'red' ? '#e74c3c' : '#3498db'));
        let col = d.type === 'yellow' ? '#000' : '#fff';
        let val = d.value !== undefined ? d.value : d.val;
        return `<span style="display:inline-block; background:${bg}; color:${col}; padding:2px 8px; border-radius:4px; margin-right:5px; font-weight:bold; border: 1px solid #fff;">${val}</span>`;
      }).join('')}</p>`;
    } else {
      html += `<p>Sin dados</p>`;
    }

    html += `<h3 style="color: #2ecc71; border-bottom: 1px solid #2ecc71; padding-bottom: 5px;">Dados de Goblins (Verdes)</h3>`;
    if (state.goblinDice && Object.keys(state.goblinDice).length > 0) {
      html += `<ul>`;
      for (let gId in state.goblinDice) {
        let gob = state.goblins.find(g => g.uid == gId);
        let gName = gob && gob.name && gob.name !== 'undefined' ? gob.name : "Goblin";
        let res = state.goblinDice[gId];
        let diceStr = (res.details || []).filter(d => d.type === 'die').map(d => d.val || d.value).join(', ');
        html += `<li><strong>${gName}</strong> sacó: <span style="display:inline-block; background:#2ecc71; color:#000; padding:2px 8px; border-radius:4px; margin-right:5px; font-weight:bold;">${diceStr || res.total}</span> (Daño total: ${res.total})</li>`;
      }
      html += `</ul>`;
    } else {
      html += `<p>Los goblins no tiraron dados.</p>`;
    }

    html += `<h3 style="color: #40bae9; border-bottom: 1px solid #40bae9; padding-bottom: 5px;">Asignaciones de Dados</h3>`;
    if (state.assignments && Object.keys(state.assignments).length > 0) {
      html += `<ul>`;
      for (let eqId in state.assignments) {
        let asgs = state.assignments[eqId];
        if (!Array.isArray(asgs)) asgs = [asgs];
        
        let eqName = eqId;
        if (eqId === 'rol' || eqId === 'role') eqName = 'Habilidad de Rol';
        else {
          let foundEq = state.player.equipped.find(e => e.id === eqId);
          if (foundEq) eqName = foundEq.name;
        }

        asgs.forEach(a => {
          let targetName = "Sin objetivo";
          if (a.targetUid) {
             let foundGob = state.goblins.find(g => g.uid == a.targetUid);
             if (foundGob) targetName = foundGob.name && foundGob.name !== 'undefined' ? foundGob.name : "Goblin";
             else targetName = "Goblin";
          }
          html += `<li>Dado <strong>${a.value}</strong> ··> asignado a <strong>${eqName}</strong> (Objetivo: ${targetName})</li>`;
        });
      }
      html += `</ul>`;
    } else {
      html += `<p>No se asignaron dados a equipo o rol.</p>`;
    }

    html += `<h3 style="color: #f15bb5; border-bottom: 1px solid #f15bb5; padding-bottom: 5px;">Intercepciones (Defensa)</h3>`;
    if (state.interceptions && Object.keys(state.interceptions).length > 0) {
      html += `<ul>`;
      for (let gobId in state.interceptions) {
        let diceIds = state.interceptions[gobId];
        let foundGob = state.goblins.find(g => g.uid == gobId);
        let targetName = foundGob && foundGob.name && foundGob.name !== 'undefined' ? foundGob.name : "Goblin";
        
        let diceVals = diceIds.map(asg => {
          let id = typeof asg === 'string' ? asg : asg.dieId;
          let d = state.playerDice.find(pd => pd.id === id);
          return d ? (d.value !== undefined ? d.value : d.val) : (asg.value || "?");
        });

        html += `<li>Ataque de <strong>${targetName}</strong> Interceptado con dado(s): <strong>${diceVals.join(', ')}</strong></li>`;
      }
      html += `</ul>`;
    } else {
      html += `<p>No se interceptó ningún ataque.</p>`;
    }
  }

  html += `</div>`;
  return html;
};

window.updateCombatHistorySelect = function() {
  const select = document.getElementById('combat-history-select');
  if (!select) return;
  
  select.innerHTML = '';
  
  if (!gameState || !gameState.combatHistory || gameState.combatHistory.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Sin combates';
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  
  select.disabled = false;
  // Populate dropdown, newest first
  for (let i = gameState.combatHistory.length - 1; i >= 0; i--) {
    const c = gameState.combatHistory[i];
    const opt = document.createElement('option');
    opt.value = i;
    
    let playerRole = c.player && c.player.role ? c.player.role.toUpperCase() : 'HEROE';
    let JPrefix = c.player && c.player.playerNum ? `J${c.player.playerNum} ` : '';
    let enemies = c.goblins ? c.goblins.map(g => `G${g.level}`).join('+') : 'Goblins';
    opt.textContent = `#${c.id} (O.${c.wave}) - ${JPrefix}${playerRole} vs ${enemies}`;
    select.appendChild(opt);
  }
};

window.renderSpecificCombatDebug = function(state) {
  const debugCombatData = document.getElementById('debug-combat-data');
  if (debugCombatData) {
    debugCombatData.innerHTML = window.getCombatDebugHtml(state);
  }
};

window.updateDebugCombatModalData = function() {
    const debugCombatModal = document.getElementById('debug-combat-modal');
    const debugCombatData = document.getElementById('debug-combat-data');
    if (!debugCombatModal || !debugCombatData) return;
    
    window.updateCombatHistorySelect();
    
    if (!gameState || !gameState.combatHistory || gameState.combatHistory.length === 0) {
      debugCombatData.innerHTML = "<em>No hay datos de combates registrados aún.</em>";
    } else {
      const lastIdx = gameState.combatHistory.length - 1;
      const select = document.getElementById('combat-history-select');
      if (select) select.value = lastIdx;
      
      debugCombatData.innerHTML = window.getCombatDebugHtml(gameState.combatHistory[lastIdx]);
    }
    
    const btnCloseDebugModal = document.getElementById('btn-close-debug-modal');
    if (btnCloseDebugModal) {
      btnCloseDebugModal.onclick = () => {
        debugCombatModal.classList.add('hidden');
      };
    }
};

// Bind change and export events once elements are in DOM
document.addEventListener('DOMContentLoaded', () => {
  const historySelect = document.getElementById('combat-history-select');
  if (historySelect) {
    historySelect.addEventListener('change', () => {
      const idx = parseInt(historySelect.value);
      if (!isNaN(idx) && gameState.combatHistory && gameState.combatHistory[idx]) {
        window.renderSpecificCombatDebug(gameState.combatHistory[idx]);
      }
    });
  }

  const btnExportHistory = document.getElementById('btn-export-combat-history');
  if (btnExportHistory) {
    btnExportHistory.addEventListener('click', () => {
      if (!gameState || !gameState.combatHistory || gameState.combatHistory.length === 0) return;
      
      let combatsHtml = '';
      gameState.combatHistory.forEach(c => {
        let playerRole = c.player && c.player.role ? c.player.role.toUpperCase() : 'HEROE';
        let JPrefix = c.player && c.player.playerNum ? `J${c.player.playerNum} ` : '';
        let enemies = c.goblins ? c.goblins.map(g => `G${g.level}`).join('+') : 'Goblins';
        
        combatsHtml += `<div class="combat-card" style="background:#232333; padding:20px; border-radius:12px; margin-bottom:30px; border:1px solid #ff3366; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">`;
        combatsHtml += `<h2 style="color:#ff3366; font-family:'Georgia',serif; margin-top:0; border-bottom:1px dashed rgba(255, 51, 102, 0.4); padding-bottom:10px;">`;
        combatsHtml += `Combate #${c.id} (Oleada ${c.wave}) - ${JPrefix}${playerRole} vs ${enemies} <span style="font-size:0.8rem; color:#aaa; font-weight:normal; float:right;">${c.timestamp}</span>`;
        combatsHtml += `</h2>`;
        combatsHtml += window.getCombatDebugHtml(c);
        combatsHtml += `</div>`;
      });
      
      const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Historial de Combates - Malditos Goblins</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a24; color: #eee; padding: 20px; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #ff3366; text-align: center; font-family: 'Georgia', serif; border-bottom: 2px solid #ff3366; padding-bottom: 15px; margin-bottom: 25px; }
    strong { color: #fff; }
    ul { padding-left: 20px; }
    li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Historial de Combates - Malditos Goblins</h1>
    <p style="text-align: center; color: #aaa; margin-top: -15px; margin-bottom: 30px;">Exportado el ${new Date().toLocaleString()}</p>
    ${combatsHtml}
  </div>
</body>
</html>`;

      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historial_combates_${new Date().getTime()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
});

if (btnDebugCombat) {
  btnDebugCombat.addEventListener('click', () => {
    const debugCombatModal = document.getElementById('debug-combat-modal');
    if (debugCombatModal && !debugCombatModal.classList.contains('hidden')) {
      const closeBtn = document.getElementById('btn-close-debug-modal');
      if (closeBtn) closeBtn.click();
    } else {
      window.updateDebugCombatModalData();
      if (debugCombatModal) debugCombatModal.classList.remove('hidden');
    }
  });
}
// Make debug modal draggable
document.addEventListener('DOMContentLoaded', () => {
  const debugHeader = document.getElementById('debug-combat-header');
  if (debugHeader) {
    const modal = document.getElementById('debug-combat-modal');
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    debugHeader.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = modal.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      debugHeader.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      modal.style.left = newX + 'px';
      modal.style.top = newY + 'px';
      modal.style.right = 'auto'; // Disable initial right alignment
      modal.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        debugHeader.style.cursor = 'grab';
      }
    });
  }
});

function highlightInitialFocusButtons() {
  // Cancelar timeouts pendientes de previas ejecuciones para evitar solapamientos
  focusHighlightTimeouts.forEach(clearTimeout);
  focusHighlightTimeouts = [];

  removeInitialFocusHighlights();
  const activePlayer = gameState.getCurrentPlayer();
  if (activePlayer && activePlayer.isBot) return;

  const ids = ['btn-confirm-attack', 'btn-gold', 'btn-gold-dmg', 'btn-role'];
  ids.forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) {
      const t = setTimeout(() => {
        el.classList.add('focus-highlight');
      }, index * 75); // Secuencial rapidísimo: cada 75ms
      focusHighlightTimeouts.push(t);
    }
  });
}

function flipInitialMarketCards() {
  const coveredCards = document.querySelectorAll('.deck.start-covered');
  if (coveredCards.length === 0) return;

  coveredCards.forEach((card, index) => {
    // Escalonar cada carta (200ms de diferencia entre cada una)
    setTimeout(() => {
      card.style.transform = 'scaleX(0)';
      card.style.transition = 'transform 0.15s ease-in';

      // Cambiar la imagen cuando está encogida a la mitad (150ms)
      setTimeout(() => {
        const frontImg = card.getAttribute('data-front-image');
        if (frontImg) {
          card.style.backgroundImage = `url('${frontImg}')`;
        }
        card.classList.remove('start-covered');
        card.style.transform = 'scaleX(1)';
        card.style.transition = 'transform 0.15s ease-out';

        // Cuando la última carta termine de voltear, reiniciamos el flag
        if (index === coveredCards.length - 1) {
          gameState.isFirstTurnOfGame = false;
          if (window.botManager) {
            setTimeout(() => { window.botManager.handleGameState(); }, 300);
          }
        }
      }, 150);
    }, index * 200);
  });
}

window.flipSingleMarketCard = function(type) {
  const card = document.querySelector(`.deck.start-covered[data-deck-type="${type}"]`);
  if (!card) return;

  card.style.transform = 'scaleX(0)';
  card.style.transition = 'transform 0.15s ease-in';

  setTimeout(() => {
    const frontImg = card.getAttribute('data-front-image');
    if (frontImg) {
      card.style.backgroundImage = `url('${frontImg}')`;
    }
    card.classList.remove('start-covered');
    card.style.transform = 'scaleX(1)';
    card.style.transition = 'transform 0.15s ease-out';
  }, 150);
};

function removeInitialFocusHighlights() {
  const ids = ['btn-confirm-attack', 'btn-gold', 'btn-gold-dmg', 'btn-role'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('focus-highlight');
    }
  });
}

// Escuchar clics en los botones enfocados para remover el foco tras el primer uso
document.addEventListener('DOMContentLoaded', () => {
  const ids = ['btn-confirm-attack', 'btn-gold', 'btn-gold-dmg', 'btn-role'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', removeInitialFocusHighlights);
    }
  });
});

// Función global para limpiar el estado de transparencia del modal de eventos
window.resetEventModalTransparency = function() {
  const overlay = document.getElementById('global-event-overlay');
  const modal = overlay ? overlay.querySelector('.event-modal') : null;
  const eyeBtn = document.getElementById('event-modal-eye-btn');
  if (overlay) {
    overlay.classList.remove('overlay-transparent');
  }
  if (modal) {
    modal.classList.remove('modal-transparent');
  }
  if (eyeBtn) {
    eyeBtn.classList.add('hidden');
    eyeBtn.innerHTML = '👁️';
    eyeBtn.title = 'Hacer modal transparente';
    eyeBtn.style.background = '';
    eyeBtn.style.color = '';
  }
};

// Escuchar clics en el botón de ojo de transparencia de modales
document.addEventListener('DOMContentLoaded', () => {
  const eyeBtn = document.getElementById('event-modal-eye-btn');
  if (eyeBtn) {
    eyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const overlay = document.getElementById('global-event-overlay');
      const modal = overlay ? overlay.querySelector('.event-modal') : null;
      if (overlay && modal) {
        const isTransparent = modal.classList.toggle('modal-transparent');
        overlay.classList.toggle('overlay-transparent', isTransparent);
        if (isTransparent) {
          eyeBtn.innerHTML = '👁️‍🗨️';
          eyeBtn.title = 'Restaurar opacidad';
          eyeBtn.style.background = 'var(--gold)';
          eyeBtn.style.color = '#000';
        } else {
          eyeBtn.innerHTML = '👁️';
          eyeBtn.title = 'Hacer modal transparente';
          eyeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
          eyeBtn.style.color = 'var(--gold)';
        }
      }
    });
  }
});






