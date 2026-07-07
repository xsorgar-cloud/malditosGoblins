const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
    console.error('Por favor, proporciona una versión. Ejemplo: node bump_version.js 3.122');
    process.exit(1);
}

const indexPath = path.join(__dirname, '../index.html');
let indexContent = fs.readFileSync(indexPath, 'utf-8');

// Replace standard badges (e.g., <div id="version">v.3.121</div>)
indexContent = indexContent.replace(/<div id="version">v\.\d+\.\d+<\/div>/g, `<div id="version">v.${newVersion}</div>`);

// Replace the game version badge which has whitespace and newlines
indexContent = indexContent.replace(/(<div id="game-version-badge"[^>]*>)\s*v\.\d+\.\d+\s*(<\/div>)/g, `$1\n                    v.${newVersion}\n                $2`);

// Replace CSS version
indexContent = indexContent.replace(/href="css\/style\.css\?v=\d+\.\d+"/g, `href="css/style.css?v=${newVersion}"`);

// Replace all script versions (this unifies cache busting for ALL JS files)
indexContent = indexContent.replace(/src="(js\/[^"]+)\?v=\d+\.\d+"/g, `src="$1?v=${newVersion}"`);

fs.writeFileSync(indexPath, indexContent, 'utf-8');

console.log(`¡Versión actualizada a ${newVersion} en index.html!`);
