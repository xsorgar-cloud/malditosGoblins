const fs = require('fs');

// Load actual CombatManager and GameState files using regex to extract functions
const gsCode = fs.readFileSync('c:\\Users\\sorgar\\ClaudeCode\\js\\GameState.js', 'utf8');
const cmCode = fs.readFileSync('c:\\Users\\sorgar\\ClaudeCode\\js\\CombatManager.js', 'utf8');

console.log("Files loaded.");

// Let's do a pure JS simulation of the logic block.
let p = {
  mo: 1,
  equipped: [
    {
      id: 'daga',
      isBroken: true,
      brokenInCombatId: 4,
      usedInCombatId: 5,
      isActive: true
    }
  ]
};

let eq = p.equipped[0];
let gameState = { lastActionWasCombat: true, lastCombatId: 5 };
let currentCombatId = 5;

const justBroken = eq.isBroken && eq.brokenInCombatId === currentCombatId && !eq.brokenAnimationPlayed;

const canRepair = eq.isBroken &&
  p.mo >= 1 &&
  gameState.lastActionWasCombat &&
  currentCombatId > 0 &&
  eq.brokenInCombatId !== currentCombatId &&
  eq.usedInCombatId === currentCombatId;

console.log("canRepair:", canRepair);

// What if brokenInCombatId is missing?
eq.brokenInCombatId = undefined;
const canRepairMissing = eq.isBroken && p.mo >= 1 && gameState.lastActionWasCombat && currentCombatId > 0 && eq.brokenInCombatId !== currentCombatId && eq.usedInCombatId === currentCombatId;
console.log("canRepair (missing brokenInCombatId):", canRepairMissing);

// What if usedInCombatId is missing?
eq.usedInCombatId = undefined;
const canRepairMissingUsed = eq.isBroken && p.mo >= 1 && gameState.lastActionWasCombat && currentCombatId > 0 && eq.brokenInCombatId !== currentCombatId && eq.usedInCombatId === currentCombatId;
console.log("canRepair (missing usedInCombatId):", canRepairMissingUsed);
