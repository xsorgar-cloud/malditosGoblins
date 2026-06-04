/**
 * DragDropManager - Gestor centralizado de Drag & Drop (Delegación de Eventos)
 * Recoge los eventos globales del ratón y emite CustomEvents semánticos para que
 * app.js ejecute la lógica de negocio sin estar acoplado al DOM.
 */
class DragDropManager {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('dragstart', this.handleDragStart.bind(this), { capture: true });
    document.addEventListener('dragenter', this.handleDragEnter.bind(this), { capture: true });
    document.addEventListener('dragover', this.handleDragOver.bind(this), { capture: true });
    document.addEventListener('drop', this.handleDrop.bind(this), { capture: true });
    document.addEventListener('dragend', this.handleDragEnd.bind(this), { capture: true });
  }

  handleDragStart(e) {
    const target = e.target;
    // Identificar qué estamos arrastrando basándonos en clases CSS genéricas
    // app.js usa 'draggable-die' (dataset.dieId), CombatManager usa 'die' o 'draggable' (id)
    if (target.classList && (target.classList.contains('draggable-die') || target.classList.contains('die'))) {
      e.dataTransfer.setData('text/plain', target.dataset.dieId || target.id);
      e.dataTransfer.setData('source', 'die');
      target.style.opacity = '0.5';
    // app.js usa 'draggable-equip', CombatManager usa 'mini-equip-icon' o 'equip-slot'
    } else if (target.classList && (target.classList.contains('draggable-equip') || target.classList.contains('mini-equip-icon') || target.classList.contains('equip-slot'))) {
      let eqId = target.dataset.equipId;
      if (!eqId) {
        // En CombatManager, a veces está en clases "mini-icon-equipId"
        const classMatch = Array.from(target.classList).find(c => c.startsWith('mini-icon-'));
        if (classMatch) eqId = classMatch.replace('mini-icon-', '');
        else if (target.dataset.eqId) eqId = target.dataset.eqId; // slot de equipo
      }
      if (eqId) {
        e.dataTransfer.setData('text/equipId', eqId);
        e.dataTransfer.setData('source', 'equip');
        target.style.opacity = '0.5';
      }
    } else if (target.classList && target.classList.contains('draggable-orb')) {
      e.dataTransfer.setData('text/plain', target.dataset.gobUid);
      e.dataTransfer.setData('source', 'orb');
      target.style.opacity = '0.5';
    }
  }

  handleDragEnter(e) {
    const dropzone = e.target.closest('.dropzone');
    if (dropzone) {
      e.preventDefault();
    }
  }

  handleDragOver(e) {
    // Si pasamos sobre un elemento marcado como dropzone, permitimos soltar
    const dropzone = e.target.closest('.dropzone');
    if (dropzone) {
      e.preventDefault();
      // Efecto visual opcional
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  handleDrop(e) {
    e.preventDefault();
    const dropzone = e.target.closest('.dropzone');
    if (!dropzone) return;
    const source = e.dataTransfer.getData('source');

    // Despachamos un evento personalizado según el origen y el destino
    if (source === 'die') {
      const dieId = e.dataTransfer.getData('text/plain');
      const dropType = dropzone.dataset.dropType;
      
      if (dropType === 'equip' || dropType === 'equipment') {
        let eqId = dropzone.dataset.equipId || dropzone.dataset.eqId;
        document.dispatchEvent(new CustomEvent('dd:die-on-equip', { detail: { dieId, targetId: eqId } }));
      } else if (dropType === 'role-fill') {
        document.dispatchEvent(new CustomEvent('dd:die-on-role-fill', { detail: { dieId } }));
      } else if (dropType === 'combat-role') {
        document.dispatchEvent(new CustomEvent('dd:die-on-combat-role', { detail: { dieId } }));
      } else if (dropType === 'die-fusion' || dropType === 'die') {
        document.dispatchEvent(new CustomEvent('dd:die-fusion', { detail: { dieId, targetId: dropzone.dataset.dieId || dropzone.dataset.targetId || dropzone.id } }));
      } else if (dropType === 'goblin') {
        document.dispatchEvent(new CustomEvent('dd:die-on-goblin', { detail: { dieId, targetId: dropzone.dataset.gobUid || dropzone.dataset.goblinUid } }));
      }
    } else if (source === 'equip') {
      const equipId = e.dataTransfer.getData('text/equipId');
      const dropType = dropzone.dataset.dropType;
      
      if (dropType === 'goblin') {
        document.dispatchEvent(new CustomEvent('dd:equip-on-goblin', { detail: { equipId, targetId: dropzone.dataset.gobUid || dropzone.dataset.goblinUid } }));
      } else if (dropType === 'combat-main') {
        document.dispatchEvent(new CustomEvent('dd:equip-unassign', { detail: { eqId: equipId } }));
      }
    } else if (source === 'orb') {
      const gobUid = e.dataTransfer.getData('text/plain');
      if (dropzone.dataset.dropType === 'retaliation-zone') {
        document.dispatchEvent(new CustomEvent('dd:orb-on-player', { detail: { gobUid, pIndex: dropzone.dataset.pIndex } }));
      }
    }
  }

  handleDragEnd(e) {
    if (e.target && e.target.style) {
      e.target.style.opacity = '1';
    }
  }
}

const dragDropManager = new DragDropManager();

