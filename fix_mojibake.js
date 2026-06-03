const fs = require('fs');

function fixCorruptedFile(corruptedPath, cleanPath) {
  const corruptedLines = fs.readFileSync(corruptedPath, 'utf8').split('\n');
  const cleanLines = fs.readFileSync(cleanPath, 'utf8').split('\n');
  
  let fixedCount = 0;
  for (let i = 0; i < corruptedLines.length; i++) {
    if (corruptedLines[i].includes('\uFFFD')) {
      let parts = corruptedLines[i].split('\uFFFD').filter(p => p.trim().length > 2);
      let found = false;
      for (let j = 0; j < cleanLines.length; j++) {
        let matchAll = true;
        for(let p of parts) {
           if(!cleanLines[j].includes(p)) { matchAll = false; break; }
        }
        if(matchAll && parts.length > 0) {
           corruptedLines[i] = cleanLines[j];
           found = true;
           fixedCount++;
           break;
        }
      }
      if(!found) {
         console.log(`Could not fix line ${i} in ${corruptedPath}:`, corruptedLines[i]);
      }
    }
  }
  fs.writeFileSync(corruptedPath, corruptedLines.join('\n'));
  console.log(`Fixed ${fixedCount} lines in ${corruptedPath}`);
}

fixCorruptedFile('js/CombatManager.js', 'js/app_clean.js');
fixCorruptedFile('js/app.js', 'js/app_clean.js');
