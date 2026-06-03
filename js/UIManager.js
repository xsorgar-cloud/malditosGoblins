/**
 * UIManager - Gestor centralizado de Modales y Vistas de la aplicación
 * Se encarga de aislar la manipulación directa del DOM relacionada con abrir y cerrar ventanas,
 * evitando la repetición de add/remove('hidden') a lo largo de app.js.
 */
class UIManager {
  constructor() {
    this.activeModals = new Set();
  }

  // Métodos genéricos para mostrar y ocultar elementos
  show(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.remove('hidden');
    } else {
      console.warn(`UIManager: Elemento con id '${elementId}' no encontrado al intentar mostrar.`);
    }
  }

  hide(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.add('hidden');
    }
  }

  toggle(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.classList.toggle('hidden');
    }
  }

  // Gestión específica de Modales
  openModal(modalId) {
    this.show(modalId);
    this.activeModals.add(modalId);
  }

  closeModal(modalId) {
    this.hide(modalId);
    this.activeModals.delete(modalId);
  }

  closeAllModals() {
    this.activeModals.forEach(modalId => {
      this.hide(modalId);
    });
    this.activeModals.clear();
  }

  isOpen(elementId) {
    const el = document.getElementById(elementId);
    return el && !el.classList.contains('hidden');
  }
}

// Inicializar y exportar la instancia global
const uiManager = new UIManager();
