const fs = require('fs');
const file = 'c:/Users/sorgar/ClaudeCode/js/BotManager.js';
let content = fs.readFileSync(file, 'utf8');
const startIdx = content.indexOf('shouldRerollBlackDie(die, bot, plannedAssignments = {}, plannedKills = 0) {');
const endIdx = content.indexOf('    getGoblinRewardCategory(g, bot) {');
if (startIdx !== -1 && endIdx !== -1) {
    const newFunc = "shouldRerollBlackDie(die, bot, plannedAssignments = {}, plannedKills = 0) {
        if (die.type !== 'black' || die.rerolled || die.isCramped) return false;
        
        const allGoblinsDead = plannedKills === (this.gameState.currentCombat && this.gameState.currentCombat.goblins ? this.gameState.currentCombat.goblins.length : 0);
        
        if (die.value <= 2) {
            let reasonToKeep = false;
            
            bot.equipped.forEach(eq => {
                if (!eq.isActive) return;
                
                const limit = (eq.isBroken && eq.broken ? eq.broken.limit : eq.limit) || '';
                const extraStr = ((eq.isBroken && eq.broken ? eq.broken.extra : eq.extra) || '').toLowerCase();
                
                if (eq.isBroken) {
                    if (limit === 'MAX 2' && die.value <= 2) reasonToKeep = true;
                    if (limit === 'MAX 3' && die.value <= 3) reasonToKeep = true;
                    if (limit === 'PAR' && die.value === 2) reasonToKeep = true;
                    if (limit === 'IMPAR' && die.value === 1) reasonToKeep = true;
                }
                
                if (extraStr.includes(\con un \:\)) {
                    reasonToKeep = true;
                }
                
                if (allGoblinsDead && limit.includes('MAX')) {
                    let maxVal = parseInt(limit.replace('MAX', '').trim());
                    if (!isNaN(maxVal) && maxVal <= 3 && die.value <= maxVal) {
                        reasonToKeep = true;
                    }
                }
            });
            
            return !reasonToKeep;
        }
        
        return false;
    }

";
    content = content.substring(0, startIdx) + newFunc + content.substring(endIdx);
    fs.writeFileSync(file, content);
    console.log('Success');
} else {
    console.log('Indices not found');
}
