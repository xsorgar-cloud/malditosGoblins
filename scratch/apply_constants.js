const fs = require('fs');
let code = fs.readFileSync('js/HordeLordAI.js', 'utf8');

// Replace bossCosts object
code = code.replace(/const bossCosts = \{[\s\S]*?\};/, 'const bossCosts = window.GAME_CONFIG.BOSS_COSTS;');

// Replace saving AI weights (we can use the constants here)
const aiSavingRegex = /let saveWeight = 25 \+ \(budget \* 2\) \+ \(prSpentThisTurn \* 15\);[\s\S]*?else if \(boardGoblins\.length === 1\) saveWeight \-= 20;/;
const newSavingCode = `let saveWeight = window.GAME_CONFIG.HORDE_AI_WEIGHTS.SAVE_BASE + (budget * window.GAME_CONFIG.HORDE_AI_WEIGHTS.SAVE_PER_PR) + (prSpentThisTurn * window.GAME_CONFIG.HORDE_AI_WEIGHTS.SAVE_PER_SPENT_PR);
    
    // Reducimos las ganas de ahorrar si hay pocos goblins para defenderle (emergencia)
    if (boardGoblins.length === 0) saveWeight += window.GAME_CONFIG.HORDE_AI_WEIGHTS.EMERGENCY_NO_GOBLINS;
    else if (boardGoblins.length === 1) saveWeight += window.GAME_CONFIG.HORDE_AI_WEIGHTS.EMERGENCY_ONE_GOBLIN;`;

code = code.replace(aiSavingRegex, newSavingCode);

// Replace random jitter
code = code.replace(/a\.score = a\.weight \+ Math\.floor\(Math\.random\(\) \* 35\);/, 'a.score = a.weight + Math.floor(Math.random() * window.GAME_CONFIG.HORDE_AI_WEIGHTS.RANDOM_JITTER_MAX);');

fs.writeFileSync('js/HordeLordAI.js', code);
