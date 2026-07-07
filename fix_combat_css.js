const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf8');

const regex = /\/\* --- PANTALLA DE COMBATE \(COMBAT OVERLAY\) --- \*\/[\s\S]*?(?=\/\* ===================================================\r?\n\s*SOPORTE DRAG AND DROP TÁCTIL)/;

const newBlock = \/* --- PANTALLA DE COMBATE (COMBAT OVERLAY) --- */
  #combat-overlay .combat-panel {
    display: flex !important;
    flex-direction: column !important; /* COLUMNA EN MÓVIL */
    width: 100% !important;
    max-width: 100% !important;
    height: 98vh !important;
    overflow: hidden !important;
    padding: 0 !important;
    gap: 0 !important;
    position: relative;
  }

  /* HEADER SUPERIOR */
  #combat-sidebar {
    width: 100% !important;
    height: auto !important;
    padding: 10px 10px 5px 10px !important;
    border-right: none !important;
    border-bottom: 1px solid rgba(212, 175, 55, 0.3) !important;
    flex: 0 0 auto !important;
    overflow-y: visible !important;
    position: relative;
    box-sizing: border-box !important;
  }

  #combat-title {
    font-size: 1.1rem !important;
    margin-bottom: 5px !important;
    text-align: left;
  }

  #combat-player-stats {
    gap: 5px !important;
  }

  #combat-player-stats > div:first-child {
    /* La fila de Acción */
    justify-content: flex-start !important;
    margin-top: 0 !important;
    margin-bottom: 5px !important;
  }

  #combat-player-stats .stats {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    gap: 8px 12px !important;
    font-size: 1rem !important;
  }

  /* El div de Daño previsto (hijo de .stats sin clase) */
  #combat-player-stats .stats > div:not(.stat) {
    margin-top: 0 !important;
    margin-left: 0 !important;
    width: 100% !important;
    text-align: left !important;
  }

  /* Proyección Goblins (el tercer div de combat-player-stats) */
  #combat-player-stats > div:nth-child(3) {
    margin-top: 5px !important;
    padding-top: 5px !important;
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 5px 10px !important;
  }
  
  #combat-player-stats > div:nth-child(3) > div:first-child {
    width: 100% !important;
    margin-bottom: 2px !important;
    font-size: 0.85rem !important;
  }
  
  #combat-player-stats > div:nth-child(3) > div:not(:first-child) {
    font-size: 0.8rem !important;
    margin-top: 0 !important;
  }

  /* Botón cancelar pequeño arriba a la derecha */
  #combat-sidebar > div:last-child {
    position: absolute !important;
    top: 10px !important;
    right: 10px !important;
    margin-top: 0 !important;
  }

  #btn-cancel-combat {
    width: 32px !important;
    height: 32px !important;
    padding: 0 !important;
    font-size: 0 !important; /* Oculta el texto */
    border-radius: 50% !important;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns=\x22http://www.w3.org/2000/svg\x22 width=\x2224\x22 height=\x2224\x22 viewBox=\x220 0 24 24\x22 fill=\x22none\x22 stroke=\x22white\x22 stroke-width=\x222\x22 stroke-linecap=\x22round\x22 stroke-linejoin=\x22round\x22><line x1=\x2218\x22 y1=\x226\x22 x2=\x226\x22 y2=\x2218\x22></line><line x1=\x226\x22 y1=\x226\x22 x2=\x2218\x22 y2=\x2218\x22></line></svg>') !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    background-size: 20px !important;
    background-color: rgba(200, 50, 50, 0.8) !important;
    border: 1px solid rgba(255,255,255,0.3) !important;
  }

  /* ZONA DE JUEGO INFERIOR */
  #combat-main {
    flex: 1 !important;
    overflow-y: auto !important;
    width: 100% !important;
    padding: 5px !important;
    box-sizing: border-box !important;
  }

  .die {
    font-size: 1.3rem !important;
    width: 40px !important;
    height: 40px !important;
  }

  #combat-goblins-container {
    flex-wrap: wrap !important;
    gap: 10px !important;
    justify-content: center !important;
    margin-bottom: 2px !important;
  }

  #combat-goblins-container .goblin-combat-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  #combat-goblins-container .goblin-card {
    flex: 0 0 clamp(90px, 28vw, 160px) !important;
    width: clamp(90px, 28vw, 160px) !important;
    min-width: clamp(90px, 28vw, 160px) !important;
    max-width: clamp(90px, 28vw, 160px) !important;
    height: calc(clamp(90px, 28vw, 160px) * 255 / 180) !important;
    max-height: calc(clamp(90px, 28vw, 160px) * 255 / 180) !important;
    aspect-ratio: 180 / 255 !important;
  }

  .combat-equipment {
    flex-wrap: wrap !important;
    justify-content: center !important;
    gap: 10px !important;
    width: 100% !important;
  }

  .combat-equipment .equip-slot {
    flex: 0 0 clamp(75px, 22vw, 130px) !important;
    width: clamp(75px, 22vw, 130px) !important;
    min-width: clamp(75px, 22vw, 130px) !important;
    max-width: clamp(75px, 22vw, 130px) !important;
    height: calc(clamp(75px, 22vw, 130px) * 255 / 180) !important;
    max-height: calc(clamp(75px, 22vw, 130px) * 255 / 180) !important;
    aspect-ratio: 180 / 250 !important;
  }
}

\;

if (css.match(regex)) {
  css = css.replace(regex, newBlock);
  fs.writeFileSync('css/style.css', css);
  console.log('Successfully replaced block.');
} else {
  console.log('Could not find block to replace.');
}
