const fs = require('fs');

let css = fs.readFileSync('css/style.css', 'utf8');

css = css.replace(/#hito-actions \{ order: 1 !important; \}[\s\S]*?#btn-end-turn \{ order: 6 !important; \}/, 
`#hito-actions { order: 1 !important; }
  #btn-confirm-attack { order: 2 !important; }
  #btn-gold { order: 3 !important; }
  #btn-gold-dmg { order: 4 !important; }
  #btn-role { order: 5 !important; }
  #btn-end-turn { order: 6 !important; }`);

fs.writeFileSync('css/style.css', css, 'utf8');
console.log('Order updated in CSS with regex');
