class ReportGenerator {
    static imageCache = {};

    static async getBase64Image(url) {
        if (this.imageCache[url]) return this.imageCache[url];
        
        // Evitar el error rojo en consola provocado por CORS al usar fetch en file:///
        if (window.location && window.location.protocol === 'file:') {
            this.imageCache[url] = url;
            return url;
        }

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
            console.warn("Could not load image as base64, falling back to URL: " + url);
            this.imageCache[url] = url;
            return url;
        }
    }

    static async generate(exportData) {
        const gameDB = typeof window !== 'undefined' && window.DB ? window.DB : (typeof DB !== 'undefined' ? DB : null);
        let imageUrlsToFetch = new Set();
        
        if (exportData.combatHistory) {
            exportData.combatHistory.forEach((ch, idx) => {
                if (ch.id === undefined) ch.id = idx + 1;
                if (ch.goblins) {
                    ch.goblins.forEach(g => {
                        if (g.isBoss && g.bossStats && g.bossStats.image) {
                            imageUrlsToFetch.add(g.bossStats.image);
                        } else if (g.level) {
                            imageUrlsToFetch.add(`assets/Monstruos/0${g.level}.webp`);
                        }
                    });
                }
            });
        }
        }

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
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #ff3366; padding-bottom: 20px; margin-bottom: 40px; }
        .header h1 { margin: 0 0 10px 0; color: #ff3366; font-family: 'Cinzel', serif; font-size: 2.5rem; text-shadow: 0 0 15px rgba(255, 51, 102, 0.4); }
        .game-info { display: flex; justify-content: center; gap: 30px; font-size: 1.1rem; color: #ccc; }
        .game-info strong { color: #fff; }
        
        .wave-block { background: rgba(30, 20, 45, 0.6); border: 1px solid rgba(255, 51, 102, 0.3); border-radius: 12px; margin-bottom: 40px; box-shadow: 0 8px 20px rgba(0,0,0,0.5); overflow: hidden; backdrop-filter: blur(5px); }
        .wave-title { background: linear-gradient(90deg, rgba(255, 51, 102, 0.15), rgba(0,0,0,0)); color: #ff3366; margin: 0; padding: 15px 20px; font-family: 'Cinzel', serif; font-size: 1.6rem; border-bottom: 1px solid rgba(255, 51, 102, 0.3); }
        .wave-content { padding: 25px; }
        
        .event-log { padding: 12px 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px; font-size: 1.05rem; border-left: 4px solid #fff; }
        .event-log.buy { border-left-color: #44ff44; background: rgba(68, 255, 68, 0.33); }
        .event-log.potion { border-left-color: #ff44aa; background: rgba(255, 68, 170, 0.33); }
        .event-log.gold { border-left-color: #f2e75e; background: rgba(242, 255, 68, 0.33); }
        .event-log.hito { border-left-color: #ffaa00; background: rgba(255, 170, 0, 0.1); color: #ffdd88; font-family: 'Cinzel', serif; }
        .eq-img { height: 45px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.5); }
        
        .action-block { margin-top: 25px; padding: 20px; background: rgba(0, 0, 0, 0.5); border-radius: 10px; border-left: 4px solid #007acc; border-top: 1px solid #222; border-right: 1px solid #222; border-bottom: 1px solid #222; }
        .action-title { font-weight: bold; color: #4cc9f0; margin-bottom: 15px; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
        
        .battle-flex { display: flex; gap: 30px; align-items: stretch; }
        
        .player-panel { background: rgba(255, 255, 255, 0.03); border: 1px solid #444; border-radius: 8px; padding: 15px; width: 220px; display: flex; flex-direction: column; justify-content: center; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); flex-shrink: 0; }
        .player-name { font-weight: bold; color: #fff; margin-bottom: 15px; font-size: 0.95rem; text-align: center; border-bottom: 1px solid #555; padding-bottom: 10px; }
        .player-stats { display: flex; flex-direction: column; gap: 8px; }
        .stat { display: flex; justify-content: space-between; font-weight: 600; font-size: 0.95rem; }
        .stat.hp { color: #ff4444; }
        .stat.sh { color: #88ccff; }
        .stat.en { color: #ffbb00; }
        .stat.mo { color: #f2e75e; }
        .stat.lvl { color: #44ff44; }
        .stat.pex { color: #cc88ff; }
        
        .goblins-container { flex-grow: 1; display: flex; gap: 15px; flex-wrap: wrap; background: rgba(255, 51, 102, 0.05); border-radius: 8px; padding: 15px; border: 1px dashed rgba(255, 51, 102, 0.2); justify-content: center; align-items: center; }
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
            <div class="game-info" style="flex-wrap: wrap;">
                <div><strong>Resultado:</strong> ${exportData.gameInfo.isGameWon ? '<span style="color:#44ff44">Victoria</span>' : '<span style="color:#ff4444">Derrota</span>'}</div>
                <div><strong>Senda:</strong> ${exportData.gameInfo.activeSenda}</div>
                <div><strong>Hito Final:</strong> ${exportData.gameInfo.currentHito}</div>
                ${exportData.gameInfo.startTime ? `<div><strong>Inicio:</strong> ${new Date(exportData.gameInfo.startTime).toLocaleTimeString()}</div>` : ''}
                ${exportData.gameInfo.endTime ? `<div><strong>Fin:</strong> ${new Date(exportData.gameInfo.endTime).toLocaleTimeString()} (${Math.floor((new Date(exportData.gameInfo.endTime) - new Date(exportData.gameInfo.startTime)) / 60000)}m ${Math.floor(((new Date(exportData.gameInfo.endTime) - new Date(exportData.gameInfo.startTime)) % 60000) / 1000)}s)</div>` : ''}
            </div>
        </div>
        `;

        const combatsByWave = {};
        if (exportData.combatHistory) {
            exportData.combatHistory.forEach(ch => {
                let w = ch.wave || 1;
                if (!combatsByWave[w]) combatsByWave[w] = [];
                combatsByWave[w].push(ch);
            });
        }

        const renderCombatTable = (ch) => {
            if (!ch) return "";

            let hpAfter = ch.player.hp;
            if (ch.resolvedDetails && ch.resolvedDetails.finalPlayerOutcome) {
                hpAfter = ch.resolvedDetails.finalPlayerOutcome.hpAfter;
            }

            let energyGained = 0;
            if (ch.resolvedDetails && ch.resolvedDetails.playerDiceDetails) {
                ch.resolvedDetails.playerDiceDetails.forEach(d => {
                    if (d.energyGained) energyGained += d.energyGained;
                });
            }
            let energyAfter = ch.player.energy + energyGained;

            let moGained = 0;
            let pexGained = 0;
            ch.goblins.forEach(g => {
                if (g.hpAfter !== undefined && g.hpAfter <= 0) {
                    let isNormal = g.isHito || g.level >= ch.player.level;
                    if (isNormal && !g.isInvocacion) {
                        let baseMo = gameDB && gameDB.goblins[g.level] ? gameDB.goblins[g.level].mo : (g.level || 1);
                        let basePex = gameDB && gameDB.goblins[g.level] ? gameDB.goblins[g.level].pex : (g.level || 1);
                        moGained += baseMo;
                        pexGained += basePex;
                    }
                }
            });
            let moAfter = ch.player.mo + moGained;
            
            let pexAfter = ch.player.pex + pexGained;
            let lvlAfter = ch.player.level;
            if (ch.resolvedDetails && ch.resolvedDetails.finalPlayerOutcome) {
                lvlAfter = ch.resolvedDetails.finalPlayerOutcome.levelAfter || ch.player.level;
            }
            while (pexAfter >= lvlAfter * 10) {
                pexAfter -= lvlAfter * 10;
                // lvlAfter shouldn't normally exceed what the engine computed, but we cap it.
            }

            let pMaxHp = ch.player.maxHp || (ch.player.level ? 10 + (ch.player.level - 1) * 5 : '?');
            let hpStr = ch.player.hp === hpAfter ? `${ch.player.hp}/${pMaxHp}` : `${ch.player.hp} ➔ ${hpAfter}`;
            let enStr = ch.player.energy === energyAfter ? `${ch.player.energy}` : `${ch.player.energy} ➔ ${energyAfter}`;
            let moStr = ch.player.mo === moAfter ? `${ch.player.mo}` : `${ch.player.mo} ➔ ${moAfter}`;
            let pexStr = ch.player.pex === pexAfter ? `${ch.player.pex}` : `${ch.player.pex} ➔ ${pexAfter}`;
            let lvlStr = ch.player.level === lvlAfter ? `${ch.player.level}` : `${ch.player.level} ➔ ${lvlAfter}`;

            let cHtml = `<div class="battle-flex" style="margin-top: 15px;">
                <div class="player-panel">
                    <div class="player-name">${ch.player.name}</div>
                    <div class="player-stats">
                        <span class="stat hp"><span>❤️ HP</span><span>${hpStr}</span></span>
                        <span class="stat sh"><span>🛡️ Escudo</span><span>${ch.player.shield}</span></span>
                        <span class="stat en"><span>⚡ Energía</span><span>${enStr}</span></span>
                        <span class="stat mo"><span>💰 Oro</span><span>${moStr}</span></span>
                        <span class="stat pex"><span>✨ PEX</span><span>${pexStr}</span></span>
                        <span class="stat lvl"><span>🌟 Nivel</span><span>${lvlStr}</span></span>
                    </div>
                </div>
                <div class="goblins-container">`;
                
            ch.goblins.forEach(g => {
                  let imgUrl = g.isBoss && g.bossStats && g.bossStats.image ? g.bossStats.image : `assets/Monstruos/0${g.level || 1}.webp`;
                  let b64 = this.imageCache[imgUrl] || imgUrl;
                  
                  let maxHp = g.maxHp !== undefined ? g.maxHp : (g.isBoss && g.bossStats ? g.bossStats.maxHp : (g.level ? g.level * 5 : 5));
                  
                  let hpBefore = g.hp !== undefined ? g.hp : (g.currentHp !== undefined ? g.currentHp : maxHp);
                  let hpAfter = g.hpAfter !== undefined ? g.hpAfter : hpBefore;
                  
                  let isPostCombatKill = false;
                  if (hpAfter > 0) {
                      let nextCh = exportData.combatHistory.find(x => x.id === ch.id + 1);
                      if (nextCh && nextCh.wave === ch.wave) {
                          if (!nextCh.goblins.some(ng => ng.uid === g.uid)) {
                              isPostCombatKill = true;
                              hpAfter = 0;
                          }
                      }
                  }
                  
                  let hpText = hpBefore === hpAfter ? `HP: ${hpBefore}/${maxHp}` : `HP: ${hpBefore} ➔ ${hpAfter}`;
                  
                  let hpPercent = Math.max(0, Math.min(100, (hpAfter / maxHp) * 100));
                  
                  let hpBarBg = 'linear-gradient(90deg, #aa0000, #ff4444)';
                  if (hpPercent >= 100) {
                      hpBarBg = 'linear-gradient(90deg, #1b8a36, #28a745)';
                  } else if (hpPercent > 50) {
                      hpBarBg = 'linear-gradient(90deg, #c79500, #ffc107)';
                  }
                  
                  let cardStyle = g.isHito ? 'border: 2px solid #a545d1;' : '';
                  let isInCombat = g.inCombat || (ch.goblinDice && ch.goblinDice[g.uid]);
                  
                  if (isPostCombatKill) {
                      cardStyle += ' background: rgb(14, 36, 53);';
                  } else if (isInCombat) {
                      cardStyle += ' background: rgb(61, 22, 32);';
                  }
                  
                  cHtml += `
                  <div id="gob-card-${ch.id}-${g.uid}" class="goblin-card" style="${cardStyle}">
                      <img src="${b64}" class="goblin-img" alt="${g.name || 'Goblin'}">
                      <div class="gob-name">${g.name || 'Nv. ' + (g.level || 1)}</div>
                      <div class="hp-text">${hpText}</div>
                      <div class="hp-bar-container"><div class="hp-bar" style="width: ${hpPercent}%; background: ${hpBarBg};"></div></div>
                  </div>`;
              });
            
            if (ch.goblins.length === 0) {
                cHtml += `<div style="color: #aaa; margin: auto; font-style: italic;">La mesa está limpia...</div>`;
            }
            
            cHtml += `</div></div>`;
            return cHtml;
        };

        let currentWave = 0;
        let waveOpen = false;
        let inCombatPhase = false;
        let actionNum = 0;
        let inAction = false;
        let currentActionHtml = "";
        let hasCombat = false;
        let hasRestAction = false;
        let combatRendered = false;
        let combatPointer = 0;
        let hitoCounter = 1;

        logs.forEach(log => {
            let logLine = typeof log === 'string' ? log : log.text;
            if(!logLine) return;

            let waveMatch = logLine.match(/RESOLVIENDO FASE DE OLEADA (\d+)/i) || logLine.match(/Oleada (\d+).*Fase de Mercado/i);
            if (waveMatch) {
                let newWave = parseInt(waveMatch[1]);
                if (newWave !== currentWave) {
                    if (inAction) {
                        currentActionHtml += `</div>`;
                        html += currentActionHtml;
                        inAction = false;
                    }
                    if (waveOpen) {
                        html += `</div></div>`; // Close previous wave
                    }
                    currentWave = newWave;
                    html += `<div class="wave-block">
                        <h2 class="wave-title">⚔️ OLEADA ${currentWave}</h2>
                        <div class="wave-content">`;
                    waveOpen = true;
                    inCombatPhase = true;
                    actionNum = 0;
                    combatPointer = 0;
                }
            }
            
            if (logLine.match(/RESOLVIENDO FASE DE OLEADA (\d+)/i)) {
                inCombatPhase = true;
            }

            if (inCombatPhase && logLine.includes(">>> Turno de") && logLine.includes("Vida:")) {
                if (inAction) {
                    currentActionHtml += `</div>`;
                    html += currentActionHtml;
                }
                actionNum++;
                inAction = true;
                hasCombat = false;
                combatRendered = false;
                currentActionHtml = `<div class="action-block">
                    <div class="action-title">▶️ Acción ${actionNum}</div>`;
            }
            
            // Purchase logging (can happen in Market Phase OR in Action)
            if (logLine.includes("compró y EQUIPÓ") || logLine.includes("compró la poción") || logLine.includes("usó") && logLine.includes("Poción")) {
                let pMatch = logLine.match(/<strong>(.*?)<\/strong> compró/);
                let iMatch = logLine.match(/<em>(.*?)<\/em> por (\d+) mo/);
                let htmlToAppend = "";
                
                if (pMatch && iMatch) {
                    let player = pMatch[1];
                    let item = iMatch[1];
                    let cost = iMatch[2];
                    
                    let logClass = item.toLowerCase().includes("poci") ? "event-log potion" : "event-log buy";
                    
                    htmlToAppend = `<div class="${logClass}">
                        🛒 <span><strong>${player}</strong> compró <strong>${item}</strong> por <span style="color:#f2e75e">${cost} mo</span>.</span>
                    </div>`;
                } else if (logLine.includes("usó") && logLine.includes("Poción")) {
                    let pMatch = logLine.match(/<strong>(.*?)<\/strong> usó <em>(.*?)<\/em>(?: y recuperó (\d+) PV)?/);
                    if (pMatch) {
                        let healText = pMatch[3] ? ` (Recupera <span style="color:#ff41c3">+${pMatch[3]} PV</span>)` : '';
                        htmlToAppend = `<div class="event-log potion">
                            🧪 <span><strong>${pMatch[1]}</strong> usó <strong>${pMatch[2]}</strong>${healText}.</span>
                        </div>`;
                    }
                }
                
                if (htmlToAppend) {
                    if (inAction) currentActionHtml += htmlToAppend;
                    else html += htmlToAppend;
                }
            }
            
            if (inAction) {
                if (logLine.includes("HITO DESPLEGADO:")) {
                    let hMatch = logLine.match(/HITO DESPLEGADO:\s*([^<]+)/);
                    let hitoName = hMatch ? hMatch[1].replace(/|"/g, '').trim() : "Hito";
                    currentActionHtml += `<div class="event-log hito" style="margin-top: 15px;">🌟 <strong>HITO ${hitoCounter} REVELADO:</strong> ${hitoName}</div>`;
                    hitoCounter++;
                }
                
                if (logLine.includes("inició un combate") || logLine.includes("¡A por ellos!") || logLine.includes("¡Lucharé hasta el final!") || logLine.includes("¡Me llevaré por delante") || logLine.match(/asigna un .* a .* contra/i)) {
                    hasCombat = true;
                    if (!combatRendered && combatsByWave[currentWave] && combatPointer < combatsByWave[currentWave].length) {
                        currentActionHtml += renderCombatTable(combatsByWave[currentWave][combatPointer]);
                        combatPointer++;
                        combatRendered = true;
                    }
                }
                
                if (logLine.includes("cobró") && logLine.includes("mo.")) {
                    let gMatch = logLine.match(/<strong>(.*?)<\/strong> cobró (\d+) mo\./);
                    if (gMatch) {
                        currentActionHtml += `<div class="event-log gold" style="margin-top: 15px;">
                            💰 <span><strong>${gMatch[1]}</strong> descansó y cobró <strong>${gMatch[2]} mo</strong>.</span>
                        </div>`;
                        hasRestAction = true;
                    }
                }
            }
            
            if (inAction && logLine.includes("<<<") && logLine.includes("ha finalizado su turno")) {
                if (!combatRendered && hasCombat && combatsByWave[currentWave] && combatPointer < combatsByWave[currentWave].length) {
                    // Fallback just in case
                    currentActionHtml += renderCombatTable(combatsByWave[currentWave][combatPointer]);
                    combatPointer++;
                    combatRendered = true;
                } else if (!hasCombat && !hasRestAction) {
                    currentActionHtml += `<div style="color:#aaa; font-style:italic; margin-top: 15px;">El jugador descansó o evitó el combate en esta acción.</div>`;
                }
                currentActionHtml += `</div>`;
                html += currentActionHtml;
                inAction = false;
                hasCombat = false;
                hasRestAction = false;
                combatRendered = false;
            }
        });

        if (inAction) {
            currentActionHtml += `</div>`;
            html += currentActionHtml;
        }

        if (waveOpen) {
            html += `</div></div>`;
        }
        
        html += `
        </div>
        <script>
            function drawArrows() {
                const cards = Array.from(document.querySelectorAll('.goblin-card'));
                if (cards.length === 0) return;
                
                // Si aún no se han renderizado en pantalla (ej: display none temporal del iframe), reintentar
                if (cards[0].getBoundingClientRect().width === 0) {
                    setTimeout(drawArrows, 200);
                    return;
                }

                let svg = document.getElementById('arrows-svg');
                if (!svg) {
                    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.id = 'arrows-svg';
                    svg.style.position = 'absolute';
                    svg.style.top = '0';
                    svg.style.left = '0';
                    svg.style.width = '100%';
                    svg.style.pointerEvents = 'none';
                    svg.style.zIndex = '9999';
                    document.body.appendChild(svg);
                }
                svg.innerHTML = '';
                svg.style.height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) + 'px';

                let defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                defs.innerHTML = '<marker id="arrowhead" markerWidth="6" markerHeight="4.5" refX="5.5" refY="2.25" orient="auto"><polygon points="0 0, 6 2.25, 0 4.5" fill="#ff3366" opacity="0.8"/></marker>';
                svg.appendChild(defs);

                const groups = {};
                cards.forEach(c => {
                    if (c.id && c.id.startsWith('gob-card-')) {
                        const parts = c.id.split('-');
                        if (parts.length >= 4) {
                            const chId = parseInt(parts[2]);
                            const uid = parts.slice(3).join('-'); // Soporte por si uid tiene guiones
                            if (!isNaN(chId) && uid) {
                                if (!groups[uid]) groups[uid] = [];
                                groups[uid].push({ el: c, chId });
                            }
                        }
                    }
                });

                let arrowsDrawn = 0;
                for (let uid in groups) {
                    groups[uid].sort((a, b) => a.chId - b.chId);
                    for (let i = 0; i < groups[uid].length - 1; i++) {
                        const start = groups[uid][i].el;
                        const end = groups[uid][i+1].el;

                        const startRect = start.getBoundingClientRect();
                        const endRect = end.getBoundingClientRect();

                        const x1 = startRect.left + startRect.width / 2 + window.scrollX;
                        const y1 = startRect.bottom + window.scrollY;
                        const x2 = endRect.left + endRect.width / 2 + window.scrollX;
                        const y2 = endRect.top + window.scrollY - 5;

                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        const d = 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + 40) + ', ' + x2 + ' ' + (y2 - 40) + ', ' + x2 + ' ' + y2;
                        
                        path.setAttribute('d', d);
                        path.setAttribute('stroke', '#ff3366');
                        path.setAttribute('stroke-width', '3');
                        path.setAttribute('stroke-dasharray', '5,5');
                        path.setAttribute('fill', 'none');
                        path.setAttribute('opacity', '0.7');
                        path.setAttribute('marker-end', 'url(#arrowhead)');
                        
                        svg.appendChild(path);
                        arrowsDrawn++;
                    }
                }
                console.log("Arrows drawn:", arrowsDrawn);
            }

            window.addEventListener('load', drawArrows);
            window.addEventListener('resize', drawArrows);
            if (typeof ResizeObserver !== 'undefined') {
                new ResizeObserver(() => {
                    if (document.body.scrollHeight > 0) drawArrows();
                }).observe(document.body);
            }
            setTimeout(drawArrows, 100);
        </script>
        </body>
        </html>`;

        return html;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportGenerator;
} else if (typeof window !== 'undefined') {
    window.ReportGenerator = ReportGenerator;
}
