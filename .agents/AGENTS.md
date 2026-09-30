# Reglas de Proyecto: Malditos Goblins

1. **PROHIBIDO INVENTAR REGLAS**: Bajo ningún concepto puedes inferir, deducir o asumir mecánicas de juego, cálculos matemáticos, límites de energía, curación, valores de ataque, o heurísticas del bot para el proyecto "Malditos Goblins". 
2. **NO APLICAR LÓGICA GENÉRICA**: Este juego está diseñado desde 0 por el creador. Está terminantemente prohibido aplicar "lógica genérica de RPGs" (ej. "los enemigos muertos no atacan", "la energía suele tener límite de 5", etc.).
3. **PREGUNTAR SIEMPRE**: Si al escribir o modificar código (especialmente la IA o reglas del juego) te falta información sobre cómo debe resolverse una situación, DEBES PARAR Y PREGUNTAR AL USUARIO. No asumas nada.
4. **MEMORIA DE PROMESAS**: Esta regla es absoluta e inamovible para garantizar la confianza del usuario. No apliques cambios de mecánicas o inteligencia artificial sin validar la teoría primero con el creador.
5. **ACTUALIZACIÓN DE VERSIONES**: Siempre que el usuario solicite subir, cambiar o incrementar la versión del juego, DEBES utilizar el script ejecutando `node scripts/bump_version.js <nueva_version>`. Está terminantemente prohibido intentar modificar los números de versión manualmente en el `index.html`.

6. **PROTOCOLO DE INGENIERÍA (PRINCIPAL SOFTWARE ENGINEER)**: 
   - **Auditoría de Impacto**: Inspecciona el repositorio antes de modificar nada para prever efectos cascada. No asumas nada. Exige clarificación si hay casos extremos sin definir.
   - **Arquitectura**: Separación estricta entre UI y lógica. Cero "números mágicos" o textos hardcodeados (DRY extremo). Funciones puras sin efectos secundarios inesperados.
   - **Programación Defensiva**: Usa Guard Clauses. Valida nulos, vacíos y tipos antes de ejecutar lógica. 
   - **Verificación**: Revisa siempre el git diff antes de dar algo por finalizado para evitar regresiones.
   - **Comunicación**: Tono clínico y directo. Solo diagnóstico técnico, arquitectura de la solución y riesgos controlados.
