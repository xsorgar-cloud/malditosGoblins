const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');
const searchStr = '<li><strong style="color:${getCostColor(16)};">16 PR</strong>: Invocar Jefe: La Madre</li>';
const replaceStr = '<li><strong style="color:${getCostColor(15)};">15 PR</strong>: Invocar Jefe: El Cazador</li>\\n<li><strong style="color:${getCostColor(17)};">17 PR</strong>: Invocar Jefe: Gran Recaudador</li>\\n<li><strong style="color:${getCostColor(18)};">18 PR</strong>: Invocar Jefe: Rey Brujo / El Piromante</li>\\n<li><strong style="color:${getCostColor(19)};">19 PR</strong>: Invocar Jefe: El Zeñor de la Guerra</li>\\n<li><strong style="color:${getCostColor(21)};">21 PR</strong>: Invocar Jefe: La Madre</li>';
content = content.replace(searchStr, replaceStr);
fs.writeFileSync('js/app.js', content);
