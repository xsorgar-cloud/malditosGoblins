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
    #btn-role .btn-text {
        display: none !important;
    }
    
    #action-buttons .mobile-btn-icon {
        display: inline-block !important;
    }
    
    /* Quitar padding excesivo en móvil para los botones con solo icono */
    #btn-deploy-hito, #btn-gold, #btn-gold-dmg, #btn-role {
        padding: 5px !important;
        min-width: 40px;
    }
}
`;

fs.appendFileSync('css/style.css', cssRules, 'utf8');
console.log('CSS appended successfully');
