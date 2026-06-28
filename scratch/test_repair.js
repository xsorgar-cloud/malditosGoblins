const fs = require('fs');
const GameState = require('./GameState.js'); // Assuming GameState can be required or we can mock it.
// Actually, it's better to just write a standalone simulation.

let p = {
  mo: 1,
  equipped: [
    {
      id: 'daga',
      isBroken: true,
      brokenInCombatId: 4,
      usedInCombatId: 0,
      isActive: true
    }
  ]
};

let lastCombatId = 5;
let currentCombatId = 5;

// Simulate assigning a die
let assignments = {
  'daga': [ { dieId: 'd1', value: 4, assignedTo: 'daga', isRole: false } ]
};

// Simulate resolveCombat
for (let eqId in assignments) {
  let asgList = assignments[eqId];
  asgList.forEach(asg => {
    if (asg.isRole) return;
    let eq = p.equipped.find(e => e.id === eqId);
    if (!eq) return;
    eq.usedInCombatId = lastCombatId;
  });
}

// Simulate canRepair check
let eq = p.equipped[0];
let lastActionWasCombat = true;

const canRepair = eq.isBroken &&
  p.mo >= 1 &&
  lastActionWasCombat &&
  currentCombatId > 0 &&
  eq.brokenInCombatId !== currentCombatId &&
  eq.usedInCombatId === currentCombatId;

console.log("canRepair:", canRepair);
console.log("eq.usedInCombatId:", eq.usedInCombatId);
console.log("eq.brokenInCombatId:", eq.brokenInCombatId);
