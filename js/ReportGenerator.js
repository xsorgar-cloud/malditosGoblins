class ReportGenerator {
    static imageCache = {};

    static async getBase64Image(url) {
        if (this.imageCache[url]) return this.imageCache[url];
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    this.imageCache[url] = reader.result;
                    resolve(reader.result);
                };
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("Could not load image: " + url);
            return "";
        }
    }

    static async generate(exportData) {
        let imageUrlsToFetch = new Set();
        
        if (exportData.combatHistory) {
            exportData.combatHistory.forEach(ch => {
                if (ch.goblins) {
                    ch.goblins.forEach(g => {
                        if (g.isBoss && g.bossStats && g.bossStats.image) {
                            imageUrlsToFetch.add(g.bossStats.image);
                        } else if (g.level) {
                            imageUrlsToFetch.add(`assets/Monstruos/t${g.level}.webp`);
                        }
                    });
                }
            });
        }

        if (exportData.structuredActions) {
            exportData.structuredActions.forEach(sa => {
                if (sa.type === 'buy_equipment') {
                    if (window.DB) {
                        let found = null;
                        ['armas', 'escudos', 'curacion', 'pociones'].forEach(cat => {
                            if (window.DB.equipo[cat]) {
                                const eq = window.DB.equipo[cat].find(e => e.name === sa.item);
                                if (eq && eq.image) found = eq.image;
                            }
                        });
                        if (found) imageUrlsToFetch.add(found);
                    }
                }
            });
        }

        for (let url of Array.from(imageUrlsToFetch)) {
            await this.getBase64Image(url);
        }

        let html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte de Partida - Malditos Goblins</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #ff4444; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0 0 10px 0; color: #ff4444; }
        .game-info { display: flex; justify-content: center; gap: 20px; font-size: 1.1rem; }
        .wave-block { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; margin-bottom: 25px; padding: 20px; }
        .wave-title { color: #ff8c00; margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 10px; }
        .action-block { margin-top: 15px; padding: 15px; background: #252525; border-radius: 6px; border-left: 4px solid #007acc; }
        .action-title { font-weight: bold; color: #007acc; margin-bottom: 10px; }
        .goblins-container { display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 15px; }
        .goblin-card { text-align: center; background: #333; padding: 10px; border-radius: 6px; border: 1px solid #444; width: 100px; }
        .goblin-img { height: 80px; object-fit: contain; margin-bottom: 5px; }
        .hp-bar-container { width: 100%; background: #222; height: 10px; border-radius: 5px; overflow: hidden; margin-top: 5px; }
        .hp-bar { height: 100%; background: #ff4444; }
        .player-status { display: flex; gap: 20px; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333; }
        .status-item { font-size: 0.95rem; }
        .event-log { padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 4px solid #ffaa00; margin-bottom: 15px; }
        .event-log.buy { border-left-color: #44ff44; display: flex; align-items: center; gap: 10px; }
        .eq-img { height: 40px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Crónica de la Partida</h1>
            <div class="game-info">
                <div><strong>Resultado:</strong> ${exportData.gameInfo.isGameWon ? '<span style="color:#44ff44">Victoria</span>' : '<span style="color:#ff4444">Derrota</span>'}</div>
                <div><strong>Senda:</strong> ${exportData.gameInfo.activeSenda}</div>
                <div><strong>Hito Final:</strong> ${exportData.gameInfo.currentHito}</div>
            </div>
        </div>
        `;

        let currentWave = 0;
        let combatIndex = 0;

        exportData.structuredActions.forEach(action => {
            if (action.rawLog && action.rawLog.includes("O L E A D A")) {
                let match = action.rawLog.match(/O L E A D A\s+(\d+)/);
                if (match) currentWave = match[1];
                html += `<!-- END_WAVE --><div class="wave-block"><h2 class="wave-title">Oleada ${currentWave}</h2>`;
            } else if (action.type === 'deploy_hito') {
                html += `<div class="event-log">⚔️ <strong>HITO DESPLEGADO:</strong> ${action.hitoName}</div>`;
            } else if (action.type === 'buy_equipment') {
                let eqImgSrc = "";
                if (window.DB) {
                    ['armas', 'escudos', 'curacion', 'pociones'].forEach(cat => {
                        if (window.DB.equipo[cat]) {
                            const eq = window.DB.equipo[cat].find(e => e.name === action.item);
                            if (eq && eq.image) eqImgSrc = this.imageCache[eq.image] || "";
                        }
                    });
                }
                html += `<div class="event-log buy">
                    ${eqImgSrc ? \`<img src="\${eqImgSrc}" class="eq-img">\` : '🛒'} 
                    <span><strong>${action.player}</strong> compró <strong>${action.item}</strong> por ${action.cost} mo.</span>
                </div>`;
            } else if (action.type === 'group_level_up') {
                html += `<div class="event-log">⬆️ <strong>¡El grupo ha subido al nivel ${action.level}!</strong></div>`;
            } else if (action.rawLog && action.rawLog.includes("Turno de combate - Acción")) {
                let match = action.rawLog.match(/Acción (\d+)/);
                let actionNum = match ? match[1] : '?';
                let ch = exportData.combatHistory && exportData.combatHistory.length > combatIndex ? exportData.combatHistory[combatIndex] : null;
                
                html += `<div class="action-block">
                    <div class="action-title">Acción ${actionNum}</div>`;
                
                if (ch) {
                    html += `<div class="goblins-container">`;
                    ch.goblins.forEach(g => {
                        let imgUrl = g.isBoss && g.bossStats && g.bossStats.image ? g.bossStats.image : \`assets/Monstruos/t\${g.level}.webp\`;
                        let b64 = this.imageCache[imgUrl] || "";
                        let hpPercent = Math.max(0, Math.min(100, (g.currentHp / g.maxHp) * 100));
                        html += `
                        <div class="goblin-card">
                            ${b64 ? \`<img src="\${b64}" class="goblin-img">\` : ''}
                            <div style="font-size: 0.85rem; font-weight: bold;">${g.name || 'Goblin Nv.'+g.level}</div>
                            <div style="font-size: 0.8rem; color: #ffaa00;">HP: ${g.currentHp}/${g.maxHp}</div>
                            <div class="hp-bar-container"><div class="hp-bar" style="width: ${hpPercent}%"></div></div>
                        </div>`;
                    });
                    if (ch.goblins.length === 0) {
                        html += `<div style="color: #888;">No hay enemigos en la mesa.</div>`;
                    }
                    html += `</div>`;
                    
                    html += `<div class="player-status">
                        <div class="status-item">❤️ HP: ${ch.player.hp}/${ch.player.maxHp || '?'}</div>
                        <div class="status-item">🛡️ Escudo: ${ch.player.shield}</div>
                        <div class="status-item">⚡ Energía: ${ch.player.energy}</div>
                        <div class="status-item">💰 Oro: ${ch.player.mo}</div>
                    </div>`;
                    
                    combatIndex++;
                }
                
                html += `</div>`;
            }
        });

        // Clean up unclosed wave blocks
        html = html.replace('<!-- END_WAVE -->', ''); // first one doesn't need closing
        html = html.replace(/<!-- END_WAVE -->/g, '</div>'); // remaining ones
        html += `</div></div></body></html>`;

        return html;
    }
}

window.ReportGenerator = ReportGenerator;
