const fs = require('fs');
const botManagerCode = fs.readFileSync('c:/Users/sorgar/ClaudeCode/js/BotManager.js', 'utf8');

// Mock environment
window = { interceptionAssignments: {} };
DB = {
    goblins: {
        1: { hp: 5, attacks: { 4: ['Rotura no esquivable'] } }
    }
};
document = { getElementById: () => null };

eval(botManagerCode);

const botManager = new BotManager();
botManager.gameState = {
    battlefield: { waveLevel: 1, actionCount: 1 },
    currentCombat: {
        needsCrampResolution: false,
        goblins: [
            { uid: 'gob1', name: 'Goblin C', level: 1, currentHp: 5, maxHp: 5 }
        ],
        dice: {
            green: { 'gob1': { details: [{ type: 'die', val: 4 }] } }
        },
        playerDice: [
            { type: 'red', faces: 6, id: 'die-0', value: 1, rerolled: false, assignedTo: null },
            { type: 'black', faces: 6, id: 'die-1', value: 4, rerolled: false, assignedTo: null },
            { type: 'red', faces: 6, id: 'die-2', value: 6, rerolled: false, assignedTo: null }
        ]
    },
    addLog: console.log,
    players: []
};

let bot = {
    name: "Bot Test",
    hp: 12, maxHp: 15,
    equipped: [
        { id: 'escudo_inicial', name: 'Escudo Madera', isBroken: true, isActive: true },
        { id: 'daga', name: 'Daga', isActive: true, isBroken: false }
    ],
    role: { id: 'guerrero', energyRates: [1,1,1,1,1,1] }
};

// Mock isWeapon and isShield manually to avoid UI dependencies
botManager.isWeapon = function(eq) { return eq.id === 'daga'; };
botManager.isShield = function(eq) { return eq.id === 'escudo_inicial'; };
botManager.isHeal = function(eq) { return false; };
botManager.getDamageForDie = function(die, eq, b) { 
    if (eq.id === 'daga') return die.value + 1; 
    return 0; 
};
botManager.getShieldForDie = function(die, eq, b) { 
    if (eq.id === 'escudo_inicial') return Math.min(die.value, 3); // max 3 because broken
    return 0; 
};
botManager.canAcceptDie = function(die, eq) { return true; };

// Simulate the first step of performCombatTurn (interception)
const availableDice = botManager.gameState.currentCombat.playerDice.filter(d => !d.assignedTo);
availableDice.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    if (a.type === 'red' && b.type !== 'red') return -1;
    if (a.type !== 'red' && b.type === 'red') return 1;
    return 0;
});

const planResult = botManager.planWeaponAssignments(availableDice, botManager.gameState.currentCombat.goblins, bot);
const plannedAssignments = planResult.assignments;
const plannedKills = planResult.goblinsKilled;

console.log("Planned assignments before interception:", plannedAssignments);

let intercepted = false;
for (let d of availableDice) {
    if (botManager.tryInterceptDangerousDie(d, bot, plannedAssignments, plannedKills)) {
        console.log("INTERCEPTED WITH DIE:", d.id, "Value:", d.value);
        intercepted = true;
        break;
    }
}

if (!intercepted) {
    console.log("NO INTERCEPTION HAPPENED");
}

// Second run after interception
const availableDice2 = botManager.gameState.currentCombat.playerDice.filter(d => !d.assignedTo);
const planResult2 = botManager.planWeaponAssignments(availableDice2, botManager.gameState.currentCombat.goblins, bot);
console.log("Planned assignments AFTER interception:", planResult2.assignments);
