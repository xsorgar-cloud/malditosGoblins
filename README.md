# 📚 Visión General del Proyecto *Malditos Goblins*

---

## 📂 Estructura del proyecto
```
ClaudeCode/
├─ .git/                     # Repositorio Git
├─ .gitignore                # Archivos a ignorar por Git
├─ assets/                   # Recursos estáticos (imágenes, íconos, etc.)
├─ css/
│   └─ style.css            # Estilos globales de la UI
├─ js/
│   ├─ BotManager.js        # Lógica de los bots (turnos, decisiones, compras)
│   ├─ CombatManager.js     # Renderizado y gestión del combate (dados, goblins)
│   ├─ GameState.js         # Modelo del estado del juego (jugadores, mercado, etc.)
│   ├─ UIManager.js         # Manipulación genérica de la interfaz (burbujas, logs)
│   ├─ DragDropManager.js   # Soporte para arrastrar y soltar dados/equipos
│   ├─ app.js               # Entrada principal, inicializa el juego y UI
│   └─ database.js          # Mock de datos estáticos (DB, equipamientos, pociones)
├─ index.html                # Página principal del juego
├─ patch.js                  # Scripts de parcheado rápido (debugging)
├─ pnds.txt                  # Texto de ayuda / notas de desarrollo
├─ "Malditos Goblins - detalles.xlsx.txt"   # Exportación de hoja de cálculo
├─ "reglas Malditos goblins.pdf.txt"        # Reglas del juego (texto extraído)
└─ "reglas texto.txt"      # Versión simplificada de las reglas
```

---

## 🧩 Principales módulos y su responsabilidad
### `js/BotManager.js`
- **Gestiona el flujo de turno** (`handleGameState`, `performMainTurn`, `performMarketTurn`, `performCombatTurn`).
- **Decide la acción del bot** mediante `evaluateSurvivalOverride` y puntuación de combate.
- **Interactúa con `GameState`** para ejecutar acciones (`triggerAction`).
- **Muestra burbujas informativas** y registra logs en la UI.

### `js/CombatManager.js`
- **Renderiza la superposición de combate** (`renderCombatOverlay`).
- **Maneja eventos de dados**: asignación a equipamiento, a goblins, fusiones, rol de combate.
- **Calcula proyección de daño y curación** y actualiza la UI con colores dinámicos.
- **Controla la resolución del combate** y muestra resúmenes al final.

### `js/GameState.js`
- Modelo central que contiene jugadores, mercado, campo de batalla y goblins.
- Provee utilidades para comprar, vender, lanzar dados y aplicar efectos.

### `js/UIManager.js`
- Funciones auxiliares para burbujas (`showBubble`), logs (`addLog`) y actualizaciones genéricas.

### `js/DragDropManager.js`
- Lógica de arrastre y soltado para dados y equipamiento dentro del UI.

---

## 🔄 Flujo de ejecución (diagrama simplificado)
```mermaid
flowchart TD
    A[Inicio (index.html)] --> B[app.js: initGame]
    B --> C[GameState inicializado]
    C --> D[BotManager.handleGameState]
    D -->|Fase de Mercado| E[BotManager.performMarketTurn]
    D -->|Fase de Combate| F[BotManager.performCombatTurn]
    E --> G[Bot decide compra / exploración]
    F --> H[CombatManager.renderCombatOverlay]
    H --> I[Eventos de dados (click, drag, fuse)]
    I --> J[Actualiza GameState y UI]
    J --> K[Fin de turno → BotManager.handleGameState]
    K -->|Juego continuado| D
    K -->|Game Over| L[Fin]
```

---

## 🛠️ ¿Cómo añadir una nueva funcionalidad?
1. **Identificar el módulo** donde pertenece la lógica (por ejemplo, compras en `BotManager.performMarketTurn`).
2. **Crear/renombrar funciones** siguiendo la convención actual (camelCase).  
3. **Actualizar UI** usando `showBubble` o `addLog` para feedback visual.
4. **Añadir tests manuales**: cargar el juego, simular la situación y observar la UI.
5. **Commit** y ejecutar `npm run dev` para validar en el navegador.

---

## 📦 Dependencias externas
- El juego depende de un **mock `DB`** que contiene equipamiento y pociones (definido en `js/database.js`).
- La UI usa **SVGs y estilos CSS** definidos en `css/style.css`.
- No hay dependencias npm externas; todo el código es puro JavaScript del lado del cliente.

---

## 📄 Notas de estilo y convenciones
- **Variables internas** usar nombres en español.
- **Texto UI** está en español (burbujas, logs).  
- Se sigue una arquitectura **MVC ligera**: `GameState` (modelo), `BotManager`/`CombatManager` (controladores), HTML+CSS (vista).

---

*Este documento está pensado para que cualquier colaborador (humano o modelo) entienda rápidamente la arquitectura y dónde intervenir.*
