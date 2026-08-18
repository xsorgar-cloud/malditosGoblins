const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf8');

// Hay varios @media (max-width: 768px), podemos insertarlo en el principal
css = css.replace('@media (max-width: 768px) {', '@media (max-width: 768px) {\n    #btn-horda-pr { border: none !important; background: transparent !important; box-shadow: none !important; }\n');

fs.writeFileSync('css/style.css', css);
