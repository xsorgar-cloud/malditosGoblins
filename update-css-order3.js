const fs = require('fs');

let css = fs.readFileSync('css/style.css', 'utf8');

const target = `
  #hito-actions { order: 1 !important; }
  #btn-gold { order: 2 !important; }
  #btn-gold-dmg { order: 3 !important; }
  #btn-role { order: 4 !important; }
  #btn-confirm-attack { order: 5 !important; }
  #btn-end-turn { order: 6 !important; }
`.trim();

const replacement = `
  #hito-actions { order: 1 !important; }
  #btn-confirm-attack { order: 2 !important; }
  #btn-gold { order: 3 !important; }
  #btn-gold-dmg { order: 4 !important; }
  #btn-role { order: 5 !important; }
  #btn-end-turn { order: 6 !important; }
`.trim();

css = css.replace(target, replacement);

fs.writeFileSync('css/style.css', css, 'utf8');
console.log('Order updated in CSS');
