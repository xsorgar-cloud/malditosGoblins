const fs = require('fs');

const cssRules = `
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

fs.appendFileSync('css/style.css', "\n" + cssRules + "\n", 'utf8');
console.log('CSS appended successfully');
