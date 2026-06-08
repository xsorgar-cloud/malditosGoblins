# 📘 Reglas del proyecto – Malditos Goblins (Revisado)

---

## 🎯 Objetivo
Proveer una referencia **concisa y de alto nivel** para cualquier agente o desarrollador que trabaje en el proyecto *Malditos Goblins*. Todos los **datos estáticos** (equipamiento, goblins, roles, mascotas, etc.) están definidos en **`js/database.js`**. El **reglamento legible por humanos** se encuentra en **`reglas texto.txt`** y debe ser consultado para los detalles de jugabilidad que no forman parte del código fuente.

---

## 📁 Estructura del repositorio
```text
ClaudeCode/
├─ .git/                     # Metadatos del repositorio Git
├─ .gitignore                # Archivos ignorados
├─ assets/                   # Imágenes, íconos, etc.
├─ css/                      # Estilos globales (style.css)
├─ js/                       # Código fuente
│   ├─ BotManager.js        # Lógica de turnos, decisiones IA, acciones de mercado
│   ├─ CombatManager.js     # UI de combate, manejo de dados
│   ├─ GameState.js         # Modelo central (jugadores, mercado, campo de batalla)
│   ├─ UIManager.js         # Burbujas, logs y helpers UI genéricos
│   ├─ DragDropManager.js   # Drag‑and‑drop de dados y equipamiento
│   ├─ app.js               # Punto de entrada – inicializa el juego
│   └─ database.js          # **Todos los datos estáticos** (equipos, goblins, roles, mascotas, mejoras)
├─ index.html                # Página principal
├─ patch.js                  # Herramientas rápidas de parcheo y depuración
└─ "reglas texto.txt"      # **Reglamento legible** (documento externo principal)
```

---

## 🗂️ Dónde encontrar cada cosa
| Tema | Archivo fuente | Descripción |
|------|---------------|-------------|
| **Datos estáticos del juego** | `js/database.js` | Define todo el equipamiento, estadísticas de goblins, definiciones de roles, habilidades de mascotas y cartas de mejora. Es la única fuente de verdad para cualquier lógica que necesite valores numéricos.
| **Reglamento (legible por humanos)** | `reglas texto.txt` | Libro de reglas completo con narrativa, ejemplos y tablas. Úsalo cuando necesites explicar mecánicas a un jugador o verificar la consistencia de las reglas.
| **UI y interacción** | `js/UIManager.js`, `js/DragDropManager.js` | Funciones para mostrar burbujas, logs y manejar arrastres.
| **Flujo de turnos y combate** | `js/BotManager.js`, `js/CombatManager.js` | Máquina de estados que llama a `GameState` y a `database.js` para tomar decisiones.

---

## 📊 Modelo de datos (en `database.js`)
A continuación se muestra un **resumen** de las estructuras que encontrarás. Para los valores exactos abre `js/database.js`.

### Equipamiento
```js
export const EQUIPMENT = {
  weapons: [
    { id: "dagger", name: "Daga", cost: 6, block: 1, max: 4, effect: "Daño dado +1", reusable: 3 },
    // … más armas
  ],
  shields: [
    { id: "shield", name: "Escudo", cost: 0, block: 1, max: 4, effect: "Escudo dado" },
    // … más escudos
  ],
  potions: [
    { id: "healCrystal", name: "Cristal de Curación", cost: 4, block: 1, effect: "Cura dado MAX 4" },
    // … más consumibles
  ]
};
```
### Goblins (por nivel de ola)
```js
export const GOBLINS = [
  { level: 1, pv: 5, mo: 2, pex: 1, dice: "1d4" },
  { level: 2, pv: 10, mo: 3, pex: 2, dice: "1d6+1" },
  // … hasta nivel 5
];
```
### Roles
```js
export const ROLES = {
  guerrero: { energy: 1, effect: "1 Daño" },
  mago: { energy: 1, effect: "1 Daño (no letal)" },
  protector: { self: 1, other: 2, effect: "Escudo" },
  sanador: { self: 1, other: 2, effect: "PV" },
  ladrón: { energy: 1, effect: "1 mo" },
  curandero: { self: 1, other: 2, effect: "Quitar Debilitar" }
};
```
### Mascotas
```js
export const MASCOTS = [
  { name: "Urraca Ladrona", ability: "≥2 energías ⇒ +1 mo" },
  { name: "Escarabajo de Carga", ability: "Cada energía +1 energía" },
  // … resto de mascotas
];
```
### Mejoras (upgrades)
```js
export const UPGRADES = [
  { name: "Remache", cost: 3, effect: "+1 daño carta equipada" },
  { name: "Remache Escudo", cost: 3, effect: "+1 defensa carta equipada" }
];
```

---

## 📖 Libro de reglas (documento externo)
Todas las reglas narrativas, explicaciones para jugadores y ejemplos de partidas **están fuera del código** y se encuentran en:

- **`reglas texto.txt`** – el reglamento principal usado por humanos.
- **`reglas Malditos goblins.pdf.txt`** – versión PDF para referencia (requiere extracción si se desea texto).

**Al crear nuevas funcionalidades o depurar**, verifica siempre el comportamiento esperado contra lo descrito en `reglas texto.txt`. Si una regla contradice los valores en `database.js`, la fuente de verdad es **el código**; actualiza `database.js` y, si procede, refleja el cambio en el reglamento.

---

## 🧭 Diagrama de navegación (Mermaid)
```mermaid
flowchart TD
    A[Inicio – index.html] --> B[app.js: initGame]
    B --> C[GameState inicializado]
    C --> D[BotManager.handleGameState]
    D -->|Fase de Mercado| E[BotManager.performMarketTurn]
    D -->|Fase de Combate| F[BotManager.performCombatTurn]
    E --> G[Decisión: comprar equipamiento / pociones usando datos de database.js]
    F --> H[CombatManager.renderCombatOverlay]
    H --> I[Eventos de dados (drag‑drop, fusionar, asignar)]
    I --> J[Actualiza GameState con valores de database.js]
    J --> K[Volver a BotManager.handleGameState]
    K -->|Fin del juego| L[Fin]
```

---

## ✨ Estilo y directrices visuales
- Usa la fuente **Google Font ‘Inter’** (importada en `index.html`).
- Paleta de colores principal: fondo modo oscuro `#1a1a1a`, acento teal `#0ff`.
- Las burbujas y logs se generan con `UIManager.showBubble` y `UIManager.addLog`; conserva la redacción del reglamento (`reglas texto.txt`) para mantener la coherencia.
- Animaciones: `fade‑in` sutil para nuevas burbujas, `scale‑up` para resaltar tiradas de dados.

---

## 🛠️ Extender el proyecto
1. **Añadir nuevos datos estáticos** – modifica `js/database.js` y ejecuta el juego para ver los cambios.
2. **Actualizar reglas** – edita `reglas texto.txt` (o el PDF) para la documentación del jugador; no se requiere cambio de código salvo que la regla altere algún valor.
3. **Crear componentes UI** – agrega funciones en `js/UIManager.js` siguiendo las guías visuales anteriores.

---

## 📚 Lecturas complementarias
- **`README.md`** – descripción general del proyecto y cómo ejecutar la aplicación (`npm run dev` si se usa un servidor simple).
- **`js/database.js`** – detalle de los objetos de equipamiento, goblins, roles, mascotas y mejoras.
- **`reglas texto.txt`** – reglamento completo para la jugabilidad.
- **`js/BotManager.js`** – lógica de decisiones que consume los datos estáticos.
- **`js/CombatManager.js`** – superposición de combate y mecánicas de dados.

---

*Este archivo está pensado como **el punto único de referencia** para cualquier persona (humana o IA) que necesite entender la arquitectura general, dónde están los datos y dónde se sitúan las reglas legibles por humanos.*
