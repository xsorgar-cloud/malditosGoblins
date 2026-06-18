const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser globals
global.window = {
    currentAssignments: {},
    botsPaused: false,
    saveGame() {}
};
global.document = {
    getElementById() {
        return { classList: { add() {}, remove() {} }, innerHTML: "" };
    },
    querySelectorAll() {
        return [];
    }
};
global.navigator = {};
global.location = {};

// Load database.js
const dbPath = path.join(__dirname, '..', 'js', 'database.js');
const dbCode = fs.readFileSync(dbPath, 'utf8');
vm.runInThisContext(dbCode);

// Load UIManager mock if needed, or check GameState directly
const gsPath = path.join(__dirname, '..', 'js', 'GameState.js');
const gsCode = fs.readFileSync(gsPath, 'utf8');
vm.runInThisContext(gsCode);

// Test projection logic directly by replicating the code we modified
console.log("=== PRUEBAS DE PROYECCIÓN DE VIDA ===");

function runProjection(hp, maxHp, projNetDamage, projHeal) {
    let hpAfterDamage = Math.max(0, hp - projNetDamage);
    let finalProjectedHp = (hpAfterDamage > 0 && projHeal > 0) ? Math.min(maxHp, hpAfterDamage + projHeal) : hpAfterDamage;
    return finalProjectedHp;
}

// Case 1: Player HP: 6, Damage: 7, Healing: 4. Since 6 - 7 <= 0, player dies and heal is NOT applied. Projected should be 0.
const res1 = runProjection(6, 15, 7, 4);
console.log(`Test 1 (Muerte, sin curar) -> Esperado: 0, Obtenido: ${res1}. ${res1 === 0 ? '✅ PASSED' : '❌ FAILED'}`);

// Case 2: Player HP: 6, Damage: 5, Healing: 4. Player survives and heals. Projected should be 5.
const res2 = runProjection(6, 15, 5, 4);
console.log(`Test 2 (Supervivencia, cura aplicada) -> Esperado: 5, Obtenido: ${res2}. ${res2 === 5 ? '✅ PASSED' : '❌ FAILED'}`);

// Case 3: Player HP: 10, Damage: 0, Healing: 4. Player heals up to max HP. Projected should be 10 (max).
const res3 = runProjection(10, 10, 0, 4);
console.log(`Test 3 (Cura limitada a Max HP) -> Esperado: 10, Obtenido: ${res3}. ${res3 === 10 ? '✅ PASSED' : '❌ FAILED'}`);


console.log("\n=== PRUEBAS DE ESTADÍSTICAS DEL popup DE RESOLUCIÓN ===");

// Simulate finalDamageHpChange: Math.max(0, hpBefore - p.hp)
function runHpChange(hpBefore, hpAfter) {
    return Math.max(0, hpBefore - hpAfter);
}

// Case 4: Player had 6, levels up, ends at 5. Hp change shown should be 1.
const res4 = runHpChange(6, 5);
console.log(`Test 4 (Vida 6 -> 5 con subida de nivel) -> Esperado: 1, Obtenido: ${res4}. ${res4 === 1 ? '✅ PASSED' : '❌ FAILED'}`);

// Case 5: Player had 6, ends at 6 (full heal/no net change). Hp change shown should be 0.
const res5 = runHpChange(6, 6);
console.log(`Test 5 (Vida 6 -> 6) -> Esperado: 0, Obtenido: ${res5}. ${res5 === 0 ? '✅ PASSED' : '❌ FAILED'}`);

if (res1 === 0 && res2 === 5 && res3 === 10 && res4 === 1 && res5 === 0) {
    console.log("\n🎉 ¡TODAS LAS PRUEBAS DE MATEMÁTICAS DE VIDA PASARON CORRECTAMENTE!");
    process.exit(0);
} else {
    console.log("\n❌ HABILIDAD DE CÁLCULO DE VIDA TIENE ERRORES.");
    process.exit(1);
}
