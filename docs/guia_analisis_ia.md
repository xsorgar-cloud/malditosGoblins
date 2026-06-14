# Guía de Análisis de Partidas y Comportamiento de IA
Este documento proporciona a cualquier modelo de IA el contexto de reglas, mecánicas y la especificación del esquema JSON de "Malditos Goblins" para analizar de forma óptima el rendimiento de los bots y sugerir mejoras en `BotManager.js`.

---

## 1. Contexto General del Juego: Malditos Goblins
"Malditos Goblins" es un juego cooperativo de supervivencia y combate táctico contra oleadas de goblins.

### 1.1 Héroes, Dados y Roles
* **Pool de Dados:** Los jugadores lanzan dados en cada combate:
  * **Dados Rojos (d6):** Utilizados para el ataque físico y para activar habilidades de Rol.
  * **Dados Negros (d6):** Utilizados para activar cartas de equipamiento equipadas.
  * **Dados Plateados (d3):** Dados de apoyo comodín (se obtienen mediante efectos o al subir de nivel) que se fusionan para aumentar el valor de otro dado.
* **Roles Disponibles:**
  * **Guerrero:** Su dado de rol genera energía de combate. Puede rematar goblins activos usando energía acumulada (1 de daño directo por cada energía).
  * **Mago:** Su dado de rol genera energía para lanzar hechizos de daño directo a distancia a cualquier goblin.
  * **Sanador:** Su dado de rol genera energía para curar puntos de vida (PV) a sí mismo o a aliados.
  * **Ladrón:** Su dado de rol genera energía que puede transformar en monedas de oro (mo) durante su fase principal.

### 1.2 Mecánicas y Reglas Clave
* **Efectos de Estado Alterados:**
  * **Escozor:** Al final del turno, el jugador sufre 1 de daño por cada punto de escozor acumulado.
  * **Calambre:** En combate, el jugador sufre 1 de daño por cada calambre antes de resolver sus dados. Se puede limpiar gastando energía de rol.
  * **Tembleque:** Impide relanzar dados negros.
  * **EliminaRojo:** Resta un dado rojo del pool de dados del combate.
* **El Mercado:** En cada fase principal, el mercado muestra tres cartas superiores disponibles: una de Ataque/Especial, una de Escudo y una de Curación. Comprar una carta cuesta monedas de oro (mo) e inmediatamente entra al equipo del jugador (si hay espacio físico) o a su mochila.
* **Mochila y Equipamiento:** 
  * Un héroe tiene un número limitado de ranuras para cartas equipadas (activas) en base a su nivel.
  * Las cartas inactivas van a la mochila. 
  * Solo las cartas equipadas (`isActive: true`) pueden recibir dados y usarse en combate.
* **Progresión de Oleada e Hitos:**
  * La partida transcurre a lo largo de **Oleadas** (fases donde aparecen nuevos goblins).
  * Para limpiar las oleadas y progresar, los jugadores despliegan **Hitos** (jefes y goblins de hito especiales). 
  * Si derrotan al jefe del Hito 5, la partida finaliza en **Victoria**. Si todos los jugadores caen a 0 PV, finaliza en **Derrota**.

### 1.3 Reglas Oficiales de Rotura y Reparación
* **Rotura de Equipo:** Los goblins pueden infligir efectos de "Rotura" mediante sus dados verdes. Esto rompe una carta equipada (pasa a `isBroken: true`). Una carta rota no puede usarse en combate.
* **Reparación con Oro (Regla del Manual):**
  * Un equipo roto **solo** se puede reparar pagando 1 mo al finalizar un combate si cumple una doble condición estricta:
    1. Estaba roto **antes** de comenzar el combate actual (`eq.brokenInCombatId !== currentCombatId`).
    2. Ha sido usado y ha recibido dados **durante** el combate actual (`eq.usedInCombatId === currentCombatId`).
  * No se puede reparar un equipo que se rompió en el propio combate que acaba de terminar.

---

## 2. Especificación del Esquema JSON de Exportación
El archivo JSON exportado representa una instantánea completa del final de la partida, junto con el historial de eventos del juego.

### 2.1 Estructura Raíz
* **`gameInfo`:** Datos generales y estado final de los jugadores.
  * `activeSenda`: La senda de juego activa (ej. `"iniciacion"`, `"la_madre"`, `"piromante"`).
  * `currentHito`: Hito actual en el que se encuentra la partida (1 a 5).
  * `isGameOver` / `isGameWon`: Booleans que marcan el desenlace.
  * `players`: Array de objetos de jugador con sus estadísticas finales, efectos de estado, cartas equipadas y mochila.
* **`marketState`:** Información de la carta superior de cada mazo del mercado (Ataque, Escudos, Curación) en el momento del fin de la partida.
* **`battlefieldState`:** Goblins activos restantes en el tablero, nivel de la oleada y número de acciones gastadas en ella.
* **`combatHistory`:** Array secuencial con todos los combates disputados. Cada elemento representa un combate completo:
  * `player`: Estado del héroe **al inicio** de ese combate (vida, oro, nivel, cartas equipadas indicando con `isActive` cuáles estaban equipadas y cuáles en la mochila).
  * `goblins`: Goblins participantes con su vida antes y después del combate.
  * `playerDice` / `goblinDice`: Resultados exactos de los dados lanzados por ambos bandos.
  * `assignments`: Mapeo de qué dados asignó el jugador a cada una de sus cartas y a qué UID de goblin apuntaron.
  * `interceptions`: Qué dados del jugador se utilizaron para interceptar dados verdes específicos de los goblins.
  * `resolvedDetails`: Desglose del impacto matemático exacto de cada dado (daño, curación, escudos) y efectos aplicados.
  * `finalPlayerOutcome`: Balance de vida, daños mitigados y daño neto recibido.
* **`structuredActions`:** Lista de objetos que representan todas las acciones del turno principal fuera de combate (compras de mercado, uso de pociones, subidas de nivel, fases de oleadas, reparaciones, exploraciones de mercado). Cada acción contiene su tipo (`type`), marcas de tiempo (`timestamp`), parámetros de la decisión y el log narrativo original (`rawLog`).
* **`logs`:** La lista secuencial de mensajes de texto tal como se mostraron en la consola del juego.

---

## 3. Directrices para el Análisis (Objetivos de la IA)
Al estudiar un archivo JSON de partida utilizando esta guía, debes evaluar los siguientes comportamientos estratégicos del bot para sugerir mejoras de código en `BotManager.js` o `CombatManager.js`:

### 3.1 Decisiones Económicas y de Compra (Fase Principal)
* Analiza en `structuredActions` de tipo `buy_equipment` si el bot malgasta el oro. 
* ¿Compra equipos duplicados que se van a la mochila por falta de espacio?
* ¿Tiene oro acumulado y se niega a comprar equipo mejor cuando está desarmado o sin defensas?
* ¿Compra curación cuando su vida está al máximo o ignora la curación en estado crítico?

### 3.2 Decisiones de Combate (Fase de Asignación y Selección)
* Analiza en `combatHistory` si el bot selecciona objetivos suicidas. Compara el daño esperado que calcula en los logs (`DEBUG canClearTableAfterDeployingHito: ...`) con el desenlace real del combate.
* Evalúa la asignación de dados: ¿Prioriza eliminar goblins o asigna dados de alto valor de manera ineficiente?
* Revisa las intercepciones: ¿Intercepta ataques menores ignorando ataques letales?

### 3.3 Gestión de Inventario (Mochila y Equipamiento)
* Compara el campo `equipped` en `combatHistory[i].player`. ¿El bot entró a combatir con cartas en la mochila (`isActive: false`) teniendo ranuras de equipo activas vacías?
* ¿Sube de nivel y no optimiza su equipamiento para la mochila en los siguientes combates?

### 3.4 Comportamiento de Reparación
* Revisa si el bot realiza reparaciones inteligentes según las prioridades establecidas:
  * Armas y Curación (incluso espada inicial): Reparar si `mo >= 1`.
  * Escudos comprados: Reparar si `mo >= 1`.
  * Escudo inicial (Escudo Madera): Reparar solo si `mo >= 3`.
* ¿Sufrió derrotas por falta de equipo funcional tras no reparar en la fase de resolución?

### 3.5 Elecciones de Subida de Nivel
* Analiza si las elecciones de dados en `level_up_die` están balanceadas para su rol (ej: los guerreros priorizan dados rojos para activar su rol ofensivo; los magos y sanadores buscan un pool mixto para balancear ataque y defensa).
