const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

content = content.replace('Enfrentar Hito 1</button>', '<span class="btn-text">Enfrentar Hito 1</span><img src="assets/ico_hito.png" class="mobile-btn-icon" alt="Hito"></button>');
content = content.replace('Cobrar 1 mo</span><span class="txt-corto">+1 mo</span></button>', 'Cobrar 1 mo</span><span class="txt-corto">+1 mo</span><img src="assets/ico_gold.png" class="mobile-btn-icon" alt="Oro"></button>');
content = content.replace('Cobrar 2 mo + 1 Daño</span><span class="txt-corto">+2 mo + 1 Daño</span></button>', 'Cobrar 2 mo + 1 Daño</span><span class="txt-corto">+2 mo + 1 Daño</span><img src="assets/ico_gold-dmg.png" class="mobile-btn-icon" alt="Oro y Daño"></button>');
content = content.replace('Rellenar Rol</button>', '<span class="btn-text">Rellenar Rol</span><img src="assets/ico_role.png" class="mobile-btn-icon" alt="Rol"></button>');

fs.writeFileSync('index.html', content, 'utf8');
console.log('Replaced successfully');
