const fs = require('fs');
const gameStateJson = JSON.parse(fs.readFileSync('historiales partidas/partida_goblins_1781993777572.json'));
const player = gameStateJson.gameInfo.players[0];

// Simplified getPlayerMaxPowerPerAction logic based on BotManager.js
function getDamageForDieInEquip(val, eq) {
    let effectStr = (eq.isBroken && eq.broken ? eq.broken.effect : eq.effect).toLowerCase();
    let dmg = 0;
    if (effectStr.includes('dao') || effectStr.includes('dao')) {
        if (effectStr.includes('dado')) {
            dmg = val;
            const modMatch = effectStr.match(/([+-]\s*\d+)/);
            if (modMatch) dmg += parseInt(modMatch[0].replace(/\s+/g, ''));
        } else {
            let match = effectStr.match(/dao\s+(\d+)/) || effectStr.match(/dao\s+(\d+)/);
            if (match) dmg = parseInt(match[1]);
        }
        if (effectStr.includes('max')) {
            let maxMatch = effectStr.match(/max\s+(\d+)/);
            if (maxMatch) dmg = Math.min(dmg, parseInt(maxMatch[1]));
        }
    }
    return dmg;
}

function isValidDieForEquipment(val, eq) {
    const limitStr = (eq.isBroken && eq.broken && eq.broken.limit) ? eq.broken.limit : (eq.limit || '-');
    if (!limitStr || limitStr === '-') return true;
    const upperLimit = limitStr.toUpperCase();
    if (upperLimit.startsWith('MAX ')) {
      const maxVal = parseInt(upperLimit.split(' ')[1].trim());
      return val <= maxVal;
    }
    return true;
}

const weapons = player.equipped.filter(eq => {
    let effectStr = (eq.isBroken && eq.broken ? eq.broken.effect : eq.effect).toLowerCase();
    let extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
    return effectStr.includes('dao') || extraStr.includes('dao') || effectStr.includes('dao') || extraStr.includes('dao');
});

let slots = [];
weapons.forEach(w => {
    let maxDmg = 0;
    for (let val = 6; val >= 1; val--) {
        if (isValidDieForEquipment(val, w)) {
            let dmg = getDamageForDieInEquip(val, w);
            if (dmg > maxDmg) maxDmg = dmg;
        }
    }
    let extra = ((w.isBroken && w.broken ? w.broken.extra : w.extra) || '').toLowerCase();
    let isReusable = extra.includes('reutilizable');
    let maxUses = extra.includes('x3') ? 3 : (isReusable ? 3 : 1);
    for (let i = 0; i < maxUses; i++) slots.push(maxDmg);
});

slots.sort((a, b) => b - a);

let numDice = player.dicePool ? player.dicePool.length : 2;
let maxPower = 0;
const limit = Math.min(numDice, slots.length);
for (let i = 0; i < limit; i++) {
    maxPower += slots[i];
}

console.log('Weapons:', weapons.map(w => w.name).join(', '));
console.log('Slots:', slots);
console.log('Max Power:', maxPower);
