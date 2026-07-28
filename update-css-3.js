const fs = require('fs');

let css = fs.readFileSync('css/style.css', 'utf8');

// The old appended string was:
const oldRules = `
/* Estilos para los iconos de botones en móvil */
.mobile-btn-icon {
    display: none;
    width: 24px;
    height: 24px;
    vertical-align: middle;
}

@media (max-width: 768px) {
    #btn-deploy-hito .btn-text,
    #btn-gold .txt-largo, #btn-gold .txt-corto,
    #btn-gold-dmg .txt-largo, #btn-gold-dmg .txt-corto,
    #btn-role .btn-text {
        display: none !important;
    }
    
    #action-buttons .mobile-btn-icon {
        display: inline-block !important;
        width: 40px !important;
        height: 40px !important;
    }
    
    /* Quitar padding excesivo en móvil para los botones con solo icono */
    #action-buttons #btn-deploy-hito, 
    #action-buttons #btn-gold, 
    #action-buttons #btn-gold-dmg, 
    #action-buttons #btn-role {
        padding: 0 !important;
        min-width: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
    }
}
`;

const newRules = `
/* Estilos para los iconos de botones en móvil */
.mobile-btn-icon {
    display: none;
    width: 24px;
    height: 24px;
    vertical-align: middle;
}

@media (max-width: 768px) {
    #btn-deploy-hito .btn-text,
    #btn-gold .txt-largo, #btn-gold .txt-corto,
    #btn-gold-dmg .txt-largo, #btn-gold-dmg .txt-corto,
    #btn-confirm-attack .txt-largo, #btn-confirm-attack .txt-corto,
    #btn-role .btn-text {
        display: none !important;
    }
    
    #action-buttons .mobile-btn-icon {
        display: inline-block !important;
        width: 40px !important;
        height: 40px !important;
    }
    
    /* Quitar padding excesivo en móvil para los botones con solo icono */
    #action-buttons #btn-deploy-hito, 
    #action-buttons #btn-gold, 
    #action-buttons #btn-gold-dmg, 
    #action-buttons #btn-confirm-attack,
    #action-buttons #btn-role {
        padding: 0 !important;
        min-width: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
    }
}
`;

css = css.replace(oldRules.trim(), newRules.trim());

// Also remove `#btn-confirm-attack { order: 5 !important; }`
css = css.replace('#btn-confirm-attack { order: 5 !important; }', '/* removed order 5 for btn-confirm-attack */');

fs.writeFileSync('css/style.css', css, 'utf8');
console.log('CSS updated successfully');
