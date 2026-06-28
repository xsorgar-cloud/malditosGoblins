const fs = require('fs');
const path = require('path');

// Mock browser objects
global.window = {};
global.document = {
    getElementById: () => ({ addEventListener: () => {} }),
    querySelectorAll: () => []
};

// Load database.js and GameState.js
const dbCode = fs.readFileSync(path.join(__dirname, '../js/database.js'), 'utf8');
eval(dbCode);
global.DB = DB;

const gsCode = fs.readFileSync(path.join(__dirname, '../js/GameState.js'), 'utf8');
eval(gsCode);
global.GameState = GameState;

// Initialize a game state
const state = new GameState();
state.players = [
    {
        name: "Jugador 1",
        level: 1,
        hp: 10,
        maxHp: 10,
        mo: 2,
        pex: 0,
        energy: 0,
        dicePool: [{ type: 'red', faces: 6 }, { type: 'black', faces: 6 }],
        equipped: [],
        statusEffects: { escozor: 0, calambre: 0, tembleque: 0 }
    }
];
state.currentPlayerIndex = 0;

// Spawn a summoned goblin
const summonedGoblin = {
    ...DB.goblins[1],
    uid: "summoned_g1",
    currentHp: DB.goblins[1].hp,
    isInvocacion: true,
    mo: 0,
    image: 'assets/Monstruos/invocacion_01.webp'
};
state.battlefield.goblins = [summonedGoblin];

console.log("Initial state of player:", { mo: state.players[0].mo, pex: state.players[0].pex });
console.log("Summoned goblin properties:", { name: summonedGoblin.name, level: summonedGoblin.level, mo: summonedGoblin.mo, pex: summonedGoblin.pex, isInvocacion: summonedGoblin.isInvocacion });

// Start combat
state.currentCombat = {
    goblins: [summonedGoblin],
    playerDice: [{ id: "die-1", type: "red", value: 5, faces: 6 }],
    needsCrampResolution: false
};

// Force target HP to 0 (defeated)
summonedGoblin.currentHp = 0;

// Resolve combat
state.resolveCombat({ "equip-1": [{ dieId: "die-1", targetUid: "summoned_g1", value: 5 }] }, {});

console.log("Final state of player:", { mo: state.players[0].mo, pex: state.players[0].pex });
