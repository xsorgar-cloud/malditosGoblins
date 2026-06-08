# 📖 Visión Funcional de la Aplicación *Malditos Goblins*

---

## 1. Resumen
*Malditos Goblins* es un juego de cartas y dados que se ejecuta totalmente en el navegador. Está desarrollado con **HTML, CSS y JavaScript puro** (ES6). No necesita servidor backend ni compilación; todos los archivos están bajo la carpeta `ClaudeCode` y se cargan directamente desde `index.html`.

---

## 2. Estructura de carpetas
```
ClaudeCode/
├─ index.html                # Punto de entrada HTML
├─ css/style.css             # Estilos globales (tema oscuro, tipografía)
├─ js/                       # Código fuente
│   ├─ app.js               # Inicializa la partida y el bucle principal
│   ├─ GameState.js         # Modelo de datos del juego (jugadores, mercado, campo de batalla)
│   ├─ BotManager.js        # Lógica de turnos y decisiones de la IA
│   ├─ CombatManager.js     # Renderizado y gestión de la fase de combate
│   ├─ UIManager.js         # Funciones de UI: burbujas, logs, mensajes
│   ├─ DragDropManager.js   # Soporte de arrastrar y soltar dados y equipamiento
│   └─ database.js          # **Datos estáticos** (equipamiento, goblins, roles, mascotas, mejoras)
├─ assets/                   # Imágenes y recursos gráficos
├─ "reglas texto.txt"      # Reglamento legible por humanos (documento externo)
└─ README.md                # Instrucciones para ejecutar la aplicación
```

---

## 3. Flujo de ejecución
1. **Carga inicial** – `index.html` incluye `js/app.js`.
2. `app.js` ejecuta `initGame()` que:
   - Crea una instancia de `GameState`, cargando los datos de `database.js`.
   - Configura la interfaz mediante `UIManager`.
   - Inicia el primer turno llamando a `BotManager.handleGameState()`.
3. **BotManager** decide la fase actual del juego:
   - **Fase de mercado** → `performMarketTurn()` (compras, exploración).
   - **Fase de combate** → `performCombatTurn()` (batalla contra goblins).
   - **Fase principal** → `performMainTurn()` (acciones generales).
4. Cada fase actualiza `GameState` y utiliza los datos definidos en `database.js` (precios, estadísticas, habilidades).
5. En la fase de combate, `CombatManager.renderCombatOverlay()` dibuja la superposición con los dados, las cartas y los goblins. Los eventos de arrastrar y soltar (`drag‑and‑drop`) son gestionados por `DragDropManager` y actualizan el estado del combate.
6. Al terminar el turno, `BotManager.handleGameState()` verifica si el juego ha concluido (victoria o derrota). Si no, vuelve al paso 3 para el siguiente turno.

---

## 4. Componentes principales
| Componente | Responsabilidad | Funciones relevantes |
|------------|----------------|----------------------|
| **app.js** | Bootstrap y bucle principal | `initGame()`, `startTurn()` |
| **GameState.js** | Modelo de dominio del juego | `addPlayer()`, `triggerAction()`, `resolveCombat()` |
| **BotManager.js** | IA y flujo de turnos | `handleGameState()`, `performMarketTurn()`, `performCombatTurn()` |
| **CombatManager.js** | Lógica visual del combate | `renderCombatOverlay()`, `combatDieOnEquipHandler()` |
| **UIManager.js** | Ayudas de interfaz | `showBubble()`, `addLog()`, `updatePanel()` |
| **DragDropManager.js** | Drag‑and‑drop de dados | `initDrag()`, `onDrop()` |
| **database.js** | Fuente única de datos estáticos | Exporta `EQUIPMENT`, `GOBLINS`, `ROLES`, `MASCOTS`, `UPGRADES` |

---

## 5. Ciclo de vida de una partida (diagrama Mermaid)
```mermaid
flowchart TD
    A[Inicio (index.html)] --> B[app.js: initGame]
    B --> C[GameState creado]
    C --> D[BotManager.handleGameState]
    D -->|Fase de mercado| E[BotManager.performMarketTurn]
    D -->|Fase de combate| F[BotManager.performCombatTurn]
    E --> G[Decisiones de compra usando datos de database.js]
    F --> H[CombatManager.renderCombatOverlay]
    H --> I[Eventos de dados (drag, drop, fuse)]
    I --> J[Actualiza GameState]
    J --> D
    D -->|Fin de partida| K[Fin]
```

---

## 6. Gestión de datos
- **Datos estáticos** (`database.js`) están escritos como objetos ES6 y son importados donde se necesiten.
- **Estado dinámico** (`GameState`) mantiene colecciones mutables: jugadores, mercado, campo de batalla, asignaciones de dados, etc.
- No hay persistencia entre recargas de página; el estado se pierde al refrescar (se puede añadir `localStorage` fácilmente).

---

## 7. Interacción del usuario
1. **Panel de mercado** – los botones “Comprar” llaman a `GameState.triggerAction('buy', itemId)`.
2. **Zona de combate** – los dados aparecen como SVG; el usuario los arrastra a cartas o goblins. Los eventos `dd:die-on-equip` y `dd:die-on-combat-role` activan la lógica de asignación.
3. **Burbujas y logs** – cualquier acción importante (compra, daño, curación) muestra una burbuja mediante `UIManager.showBubble` y escribe un mensaje en el registro de la partida.

---

## 8. Extensiones habituales
- **Nuevo equipamiento o mascota** → añadir objetos a `EQUIPMENT` o `MASCOTS` en `database.js` y actualizar la UI correspondiente.
- **Nuevo rol** → añadirlo a `ROLES` y adaptar la lógica de energía en `BotManager`.
- **Persistencia** → almacenar `GameState` en `localStorage` o `IndexedDB` para que la partida continúe tras recargar.
- **Mejoras visuales** → modificar `css/style.css` o añadir animaciones en `CombatManager`.

---

## 9. Cómo ejecutar la aplicación
```bash
# Desde la carpeta del proyecto
python -m http.server 8000   # o cualquier servidor estático
# Luego abre http://localhost:8000 en el navegador
```
No se requiere `npm` ni compilación.

---

## 10. Documentación relacionada
- **`PROJECT_RULES.md`** – arquitectura general y dónde se encuentran los datos y el reglamento.
- **`README.md`** – guía rápida de instalación y ejecución.
- **`reglas texto.txt`** – reglamento completo para jugadores.

---

*Este documento ofrece una visión clara y con la tipografía correcta sobre el funcionamiento actual de la aplicación.*
