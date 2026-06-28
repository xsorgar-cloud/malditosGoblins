const fs = require('fs');
const path = require('path');

const dbCode = fs.readFileSync(path.join(__dirname, '../js/database.js'), 'utf8');
// Evaluate the DB variable
eval(dbCode);

function isWeapon(eq) {
    let effectStr = ((eq.isBroken && eq.broken ? eq.broken.effect : eq.effect) || '').toLowerCase();
    let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
    return effectStr.includes('daño') || extraStr.includes('daño');
}

const espada = DB.equipment.inicial[0];
console.log('Espada Inicial:', espada);
console.log('Is Weapon?:', isWeapon(espada));

const vendaje = DB.equipment.curacion.find(eq => eq.id === 'vendaje');
console.log('Vendaje:', vendaje);
console.log('Is Weapon?:', isWeapon(vendaje));

// Also let's test all starting equipment and market items
console.log('--- ALL WEAPONS DETECTED ---');
for (let key in DB.equipment) {
    DB.equipment[key].forEach(eq => {
        if (isWeapon(eq)) {
            console.log(`- [${key}] ${eq.name} (${eq.id}): ${eq.effect}`);
        }
    });
}
