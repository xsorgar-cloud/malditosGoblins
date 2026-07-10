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

        const logs = exportData.logs || [];
        logs.forEach(log => {
            let logLine = typeof log === 'string' ? log : log.text;
            if (logLine && (logLine.includes("compró y EQUIPÓ") || logLine.includes("compró la poción"))) {
                let iMatch = logLine.match(/<em>(.*?)<\/em> por/);
                if (iMatch && window.DB) {
                    let item = iMatch[1];
                    let found = null;
                    ['armas', 'escudos', 'curacion', 'pociones'].forEach(cat => {
                        if (window.DB.equipo[cat]) {
                            const eq = window.DB.equipo[cat].find(e => e.name === item);
                            if (eq && eq.image) found = eq.image;
                        }
                    });
                    if (found) imageUrlsToFetch.add(found);
                }
            }
        });

        for (let url of Array.from(imageUrlsToFetch)) {
            await this.getBase64Image(url);
        }

        let html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Crónica de Partida - Malditos Goblins</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #0b0714; color: #e0e0e0; margin: 0; padding: 30px 20px; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #ff3366; padding-bottom: 20px; margin-bottom: 40px; }
        .header h1 { margin: 0 0 10px 0; color: #ff3366; font-family: 'Cinzel', serif; font-size: 2.5rem; text-shadow: 0 0 15px rgba(255, 51, 102, 0.4); }
        .game-info { display: flex; justify-content: center; gap: 30px; font-size: 1.1rem; color: #ccc; }
        .game-info strong { color: #fff; }
        
        .wave-block { background: rgba(30, 20, 45, 0.6); border: 1px solid rgba(255, 51, 102, 0.3); border-radius: 12px; margin-bottom: 40px; box-shadow: 0 8px 20px rgba(0,0,0,0.5); overflow: hidden; backdrop-filter: blur(5px); }
        .wave-title { background: linear-gradient(90deg, rgba(255, 51, 102, 0.15), rgba(0,0,0,0)); color: #ff3366; margin: 0; padding: 15px 20px; font-family: 'Cinzel', serif; font-size: 1.6rem; border-bottom: 1px solid rgba(255, 51, 102, 0.3); }
        .wave-content { padding: 25px; }
        
        .event-log { padding: 12px 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px; font-size: 1.05rem; border-left: 4px solid #fff; }
        .event-log.buy { border-left-color: #44ff44; background: rgba(68, 255, 68, 0.05); }
        .event-log.hito { border-left-color: #ffaa00; background: rgba(255, 170, 0, 0.1); color: #ffdd88; font-family: 'Cinzel', serif; }
        .eq-img { height: 45px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.5); }
        
        .action-block { margin-top: 25px; padding: 20px; background: rgba(0, 0, 0, 0.5); border-radius: 10px; border-left: 4px solid #007acc; border-top: 1px solid #222; border-right: 1px solid #222; border-bottom: 1px solid #222; }
        .action-title { font-weight: bold; color: #4cc9f0; margin-bottom: 15px; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
        
        .battle-flex { display: flex; gap: 30px; align-items: stretch; }
        
        .player-panel { background: rgba(255, 255, 255, 0.03); border: 1px solid #444; border-radius: 8px; padding: 15px; width: 220px; display: flex; flex-direction: column; justify-content: center; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); flex-shrink: 0; }
        .player-name { font-weight: bold; color: #fff; margin-bottom: 15px; font-size: 1.2rem; text-align: center; border-bottom: 1px solid #555; padding-bottom: 10px; }
        .player-stats { display: flex; flex-direction: column; gap: 10px; }
        .stat { display: flex; justify-content: space-between; font-weight: 600; font-size: 1rem; }
        .stat.hp { color: #ff4444; }
        .stat.sh { color: #88ccff; }
        .stat.en { color: #ffbb00; }
        .stat.mo { color: #f2e75e; }
        
        .goblins-container { flex-grow: 1; display: flex; gap: 15px; flex-wrap: wrap; background: rgba(255, 51, 102, 0.05); border-radius: 8px; padding: 15px; border: 1px dashed rgba(255, 51, 102, 0.2); justify-content: flex-start; align-items: center; }
        .goblin-card { background: rgba(0,0,0,0.6); padding: 12px; border-radius: 8px; border: 1px solid #ff3366; width: 110px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .goblin-img { height: 90px; width: 90px; object-fit: contain; margin-bottom: 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8)); }
        .gob-name { font-size: 0.85rem; font-weight: bold; color: #fff; text-align: center; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-family: 'Cinzel', serif; }
        .hp-text { font-size: 0.8rem; color: #ffaa00; margin-bottom: 3px; font-weight: bold; }
        .hp-bar-container { width: 100%; background: #222; height: 8px; border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.8); }
        .hp-bar { height: 100%; background: linear-gradient(90deg, #aa0000, #ff4444); transition: width 0.3s; }
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
        let waveOpen = false;

        const combatsByWave = {};
        if (exportData.combatHistory) {
            exportData.combatHistory.forEach(ch => {
                let w = ch.wave || 1;
                if (!combatsByWave[w]) combatsByWave[w] = [];
                combatsByWave[w].push(ch);
            });
        }

        const renderCombatsForWave = (waveNum) => {
            let chs = combatsByWave[waveNum];
            if (!chs || chs.length === 0) return "";
            let cHtml = "";
            chs.forEach((ch, idx) => {
                let actionNum = idx + 1;
                cHtml += `<div class="action-block">
                    <div class="action-title">▶️ Acción ${actionNum}</div>
                    <div class="battle-flex">
                        <div class="player-panel">
                            <div class="player-name">${ch.player.name}</div>
                            <div class="player-stats">
                                <span class="stat hp"><span>❤️ HP</span><span>${ch.player.hp}/${ch.player.maxHp || '?'}</span></span>
                                <span class="stat sh"><span>🛡️ Escudo</span><span>${ch.player.shield}</span></span>
                                <span class="stat en"><span>⚡ Energía</span><span>${ch.player.energy}</span></span>
                                <span class="stat mo"><span>💰 Oro</span><span>${ch.player.mo}</span></span>
                            </div>
                        </div>
                        <div class="goblins-container">`;
                        
                ch.goblins.forEach(g => {
                    let imgUrl = g.isBoss && g.bossStats && g.bossStats.image ? g.bossStats.image : `assets/Monstruos/t${g.level || 1}.webp`;
                    let b64 = this.imageCache[imgUrl] || imgUrl;
                    
                    let maxHp = g.maxHp !== undefined ? g.maxHp : (g.isBoss && g.bossStats ? g.bossStats.maxHp : (g.level ? g.level * 5 : 5));
                    let currentHp = g.currentHp !== undefined ? g.currentHp : (g.hpAfter !== undefined ? g.hpAfter : (g.hp !== undefined ? g.hp : maxHp));
                    let hpPercent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
                    
                    cHtml += `
                    <div class="goblin-card">
                        <img src="${b64}" class="goblin-img" alt="${g.name || 'Goblin'}">
                        <div class="gob-name">${g.name || 'Nv. ' + (g.level || 1)}</div>
                        <div class="hp-text">HP: ${currentHp}/${maxHp}</div>
                        <div class="hp-bar-container"><div class="hp-bar" style="width: ${hpPercent}%"></div></div>
                    </div>`;
                });
                
                if (ch.goblins.length === 0) {
                    cHtml += `<div style="color: #aaa; margin: auto; font-style: italic;">La mesa está limpia...</div>`;
                }
                
                cHtml += `</div></div></div>`;
            });
            return cHtml;
        };

        logs.forEach(log => {
            let logLine = typeof log === 'string' ? log : log.text;
            if(!logLine) return;

            let waveMatch = logLine.match(/RESOLVIENDO FASE DE OLEADA (\d+)/i) || logLine.match(/aventura comienza en la Oleada (\d+)/i);
            if (waveMatch) {
                if (waveOpen) {
                    html += renderCombatsForWave(currentWave);
                    html += `</div></div>`; // Close previous wave
                }
                currentWave = parseInt(waveMatch[1]);
                html += `<div class="wave-block">
                    <h2 class="wave-title">⚔️ OLEADA ${currentWave}</h2>
                    <div class="wave-content">`;
                waveOpen = true;
            }
            
            if (logLine.includes("compró y EQUIPÓ") || logLine.includes("compró la poción")) {
                let pMatch = logLine.match(/<strong>(.*?)<\/strong> compró/);
                let iMatch = logLine.match(/<em>(.*?)<\/em> por (\d+) mo/);
                if (pMatch && iMatch) {
                    let player = pMatch[1];
                    let item = iMatch[1];
                    let cost = iMatch[2];
                    
                    let eqImgSrc = "";
                    if (window.DB) {
                        ['armas', 'escudos', 'curacion', 'pociones'].forEach(cat => {
                            if (window.DB.equipo[cat]) {
                                const eq = window.DB.equipo[cat].find(e => e.name === item);
                                if (eq && eq.image) eqImgSrc = this.imageCache[eq.image] || eq.image;
                            }
                        });
                    }
                    
                    html += `<div class="event-log buy">
                        ${eqImgSrc ? `<img src="${eqImgSrc}" class="eq-img">` : '🛒'} 
                        <span><strong>${player}</strong> compró <strong>${item}</strong> por <span style="color:#f2e75e">${cost} mo</span>.</span>
                    </div>`;
                }
            }
            
            if (logLine.includes("HITO DESPLEGADO:")) {
                let hMatch = logLine.match(/HITO DESPLEGADO:\s*([^<]+)/);
                let hitoName = hMatch ? hMatch[1].replace(/|"/g, '').trim() : "Hito";
                html += `<div class="event-log hito">🔥 <strong>HITO REVELADO:</strong> ${hitoName}</div>`;
            }
        });

        if (waveOpen) {
            html += renderCombatsForWave(currentWave);
            html += `</div></div>`;
        }
        
        html += `</div></body></html>`;
        return html;
    }
}

window.ReportGenerator = ReportGenerator;
