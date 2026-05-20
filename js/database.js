const DB = {
  // CONFIGURACIÓN DE NIVELES DEL JUGADOR
  playerLevels: [
    { level: 1, maxHp: 10, pexNeeded: 2, blocks: 6, extraDice: null },
    { level: 2, maxHp: 15, pexNeeded: 6, blocks: 8, extraDice: 'choice' }, // 6 * num_players
    { level: 3, maxHp: 20, pexNeeded: 12, blocks: 10, extraDice: 'choice' }, // 12 * num_players
    { level: 4, maxHp: 25, pexNeeded: 22, blocks: 12, extraDice: 'choice_and_d3' } // 22 * num_players
  ],

  // ROLES
  roles: [
    { id: 'guerrero', name: 'Guerrero', image: 'assets/Roles/rol_guerrero.jpg', icon: 'assets/Roles/ico_rol_guerrero.png', effect: 'Inflige Daño Directo a un Goblin en combate.', energyRates: [0, 0, 2, 3, 4, 4] },
    { id: 'mago', name: 'Mago', image: 'assets/Roles/rol_mago.jpg', icon: 'assets/Roles/ico_rol_mago.png', effect: 'Inflige Daño Directo No Letal a cualquier Goblin.', energyRates: [0, 1, 2, 2, 3, 3] },
    { id: 'protector', name: 'Protector', image: 'assets/Roles/rol_protector.jpg', icon: 'assets/Roles/ico_rol_protector.png', effect: 'Obtiene o proporciona Escudo a un compañero.', energyRates: [2, 2, 2, 3, 3, 4] },
    { id: 'sanador', name: 'Sanador', image: 'assets/Roles/rol_sanador.jpg', icon: 'assets/Roles/ico_rol_sanador.png', effect: 'Cura Puntos de Vida a tí mismo o a un compañero.', energyRates: [0, 2, 3, 3, 3, 1] },
    { id: 'ladron', name: 'Ladrón', image: 'assets/Roles/rol_ladron.jpg', icon: 'assets/Roles/ico_rol_ladron.png', effect: 'Obtiene Monedas de oro, o las proporciona a un compañero.', energyRates: [1, 1, 2, 2, 2, 3] },
    { id: 'curandero', name: 'Curandero', image: 'assets/Roles/rol_curandero.jpg', icon: 'assets/Roles/ico_rol_curandero.png', effect: 'Repara tu equipo roto o el de un compañero.', energyRates: [1, 2, 2, 3, 3, 0] }
  ],

  // CARTAS DE EQUIPO (MERCADO)
  equipment: {
    inicial: [
      { id: 'espada_inicial', type: 'inicial', name: 'Espada Inicial', cost: 0, blocks: 2, limit: '-', effect: 'Daño dado', extra: '', image: 'assets/Equipo/inicial/!1-Espada.jpg', broken: { limit: 'MAX 5', effect: 'Daño dado' } },
      { id: 'escudo_inicial', type: 'inicial', name: 'Escudo Madera', cost: 0, blocks: 1, limit: '-', effect: 'Escudo dado MAX 4', extra: '', image: 'assets/Equipo/inicial/!2-EscudoMadera.jpg', broken: { limit: '-', effect: 'Escudo dado MAX 3' } }
    ],
    ataque: [
      { id: 'daga', type: 'ataque', name: 'Daga', cost: 6, blocks: 1, limit: 'MAX 4', effect: 'Daño dado +1', extra: 'Reutilizable x3', image: 'assets/Equipo/ataque/a6-Daga.jpg', broken: { limit: 'MAX 2', effect: 'Daño dado +1', extra: 'Reutilizable' } },
      { id: 'afilado', type: 'ataque', name: 'Afilado', cost: 6, blocks: 2, limit: 'PAR', effect: 'Daño dado', extra: 'Con un 4: daño 6', image: 'assets/Equipo/ataque/a4-Afilado.jpg', broken: { limit: 'PAR', effect: 'Daño dado', extra: '' } },
      { id: 'anadir_pinchos', type: 'ataque', name: 'Añadir Pinchos', cost: 6, blocks: 2, limit: 'IMPAR', effect: 'Daño dado', extra: 'Con un 5: daño 6', image: 'assets/Equipo/ataque/a3-AnadirPinchos.jpg', broken: { limit: 'IMPAR', effect: 'Daño dado', extra: '' } },
      { id: 'cuchillo', type: 'ataque', name: 'Cuchillo', cost: 3, blocks: 1, limit: '-', effect: 'Daño 3', extra: '', image: 'assets/Equipo/ataque/a5-Cuchillo.jpg', broken: { limit: '-', effect: 'Daño 3', extra: '' } },
      { id: 'serrado', type: 'ataque', name: 'Serrado', cost: 6, blocks: 2, limit: '-', effect: 'Daño dado', extra: '', image: 'assets/Equipo/ataque/a2-Serrado.jpg', broken: { limit: 'MAX 4', effect: 'Daño dado', extra: '' } },
      { id: 'oxidado', type: 'ataque', name: 'Oxidado', cost: 3, blocks: 2, limit: '-', effect: 'Daño dado Max 4 +1', extra: '', image: 'assets/Equipo/ataque/a1-Oxidado.jpg', broken: { limit: 'MAX 4', effect: 'Daño dado', extra: '' } }
    ],
    curacion: [
      { id: 'cristal_curacion', type: 'curacion', name: 'Cristal de Curación', cost: 4, blocks: 1, limit: '-', effect: 'Cura dado Max 4', extra: '', image: 'assets/Equipo/curacion/c6-CristalDeCuracion.jpg', broken: { limit: '-', effect: 'Cura dado Max 3', extra: '' } },
      { id: 'gema_regeneracion', type: 'curacion', name: 'Gema Regeneración', cost: 4, blocks: 2, limit: 'MAX 4', effect: 'Daño dado', extra: 'Con un impar: cura 2', image: 'assets/Equipo/curacion/c5-GemaRegeneracion.jpg', broken: { limit: 'MAX 3', effect: 'Daño dado', extra: 'Con un impar: cura 1' } },
      { id: 'corazon_elastico', type: 'curacion', name: 'Corazón Elástico', cost: 4, blocks: 2, limit: 'MAX 4', effect: 'Varia entre daño y vida', extra: '', image: 'assets/Equipo/curacion/c4-CorazonElastico.jpg', broken: { limit: 'MAX 3', effect: 'Varia entre daño y vida', extra: '' } },
      { id: 'vendaje', type: 'curacion', name: 'Vendaje', cost: 4, blocks: 1, limit: '-', effect: 'Cura 2', extra: 'Reutilizable', image: 'assets/Equipo/curacion/c3-Vendaje.jpg', broken: { limit: '-', effect: 'Cura 1', extra: '' } },
      { id: 'drenar', type: 'curacion', name: 'Drenar', cost: 4, blocks: 2, limit: 'MAX 4', effect: 'Daño dado', extra: 'Cura Max 2', image: 'assets/Equipo/curacion/c2-Drenar.jpg', broken: { limit: 'MAX 3', effect: 'Daño dado', extra: 'Cura Max 2' } },
      { id: 'drenar_justo', type: 'curacion', name: 'Drenar Justo', cost: 4, blocks: 2, limit: 'MAX 4', effect: 'Daño 2', extra: 'Con un 3: cura 3', image: 'assets/Equipo/curacion/c1-DrenaJusto.jpg', broken: { limit: 'MAX 3', effect: 'Daño 1', extra: 'Con un 2: cura 2' } }
    ],
    escudos: [
      { id: 'reforzado_pinchos', type: 'escudos', name: 'Reforzado de Pinchos', cost: 6, blocks: 2, limit: 'MAX 5', effect: 'Par: daño dado', extra: 'Impar: Escudo dado', image: 'assets/Equipo/escudos/e6-ReforzadoDePinchos.jpg', broken: { limit: 'MAX 3', effect: 'Par: daño dado', extra: 'Impar: Escudo dado' } },
      { id: 'reforzado_hierro', type: 'escudos', name: 'Reforzado de Hierro', cost: 6, blocks: 2, limit: '-', effect: 'Escudo dado', extra: '', image: 'assets/Equipo/escudos/e5-ReforzadoDeHierro.jpg', broken: { limit: '-', effect: 'Escudo dado', extra: '' } },
      { id: 'rodela', type: 'escudos', name: 'Rodela', cost: 3, blocks: 1, limit: 'MAX 4', effect: 'Escudo dado +1', extra: 'Reutilizable x3', image: 'assets/Equipo/escudos/e4-Rodela.jpg', broken: { limit: 'MAX 3', effect: 'Escudo dado', extra: '' } },
      { id: 'doble_reforzado', type: 'escudos', name: 'Doble Reforzado', cost: 3, blocks: 2, limit: 'MAX 3', effect: 'Escudo dado x2', extra: '', image: 'assets/Equipo/escudos/e3-DobleReforzado.jpg', broken: { limit: 'MAX 2', effect: 'Escudo dado x2', extra: '' } },
      { id: 'reforzado_cuero', type: 'escudos', name: 'Reforzado de Cuero', cost: 6, blocks: 1, limit: '-', effect: 'Escudo dado -1', extra: '', image: 'assets/Equipo/escudos/e2-ReforzadoDeCuero.jpg', broken: { limit: 'MAX 4', effect: 'Escudo dado -1', extra: '' } },
      { id: 'reforzado_placas', type: 'escudos', name: 'Reforzado de Placas', cost: 3, blocks: 1, limit: '-', effect: 'Escudo dado MAX 4', extra: '', image: 'assets/Equipo/escudos/e1-ReforzadoDePlacas.jpg', broken: { limit: '-', effect: 'Escudo dado MAX 3', extra: '' } }
    ],
    pociones: [
      { id: 'pocion_vida_menor', name: 'Poción Menor', cost: 2, effect: 'Cura 1d4 PV', image: 'assets/Pociones/pocion_vida_menor.png' },
      { id: 'pocion_vida_mediana', name: 'Poción Mediana', cost: 4, effect: 'Cura 2 + 1d6 PV', image: 'assets/Pociones/pocion_vida_mediana.png' },
      { id: 'pocion_vida_mayor', name: 'Poción Mayor', cost: 6, effect: 'Cura 4 + 2d4 PV', image: 'assets/Pociones/pocion_vida_mayor.png' },
      { id: 'pocion_vida_suprema', name: 'Poción Suprema', cost: 8, effect: 'Cura 7 + 2d4 PV', image: 'assets/Pociones/pocion_vida_suprema.png' }
    ]
  },

  // GOBLINS
  goblins: {
    1: {
      level: 1, hp: 5, mo: 2, pex: 1, dice: ['1d4'], image: 'assets/Monstruos/01.jpg',
      attacks: { 1: ['Daño Directo'], 2: [], 3: [], 4: ['Rotura no esquivable'], 5: [], 6: [] }
    },
    2: {
      level: 2, hp: 10, mo: 3, pex: 2, dice: ['1d6', '+1'], image: 'assets/Monstruos/02.jpg',
      attacks: { 1: ['Daño Directo'], 2: ['1 calambre'], 3: [], 4: ['1 escozor'], 5: [], 6: ['Rotura no esquivable'] }
    },
    3: {
      level: 3, hp: 15, mo: 4, pex: 3, dice: ['1d4', '+1', '1d4', '+1'], image: 'assets/Monstruos/03.jpg',
      attacks: { 1: ['Rotura no esquivable', 'Daño Directo'], 2: ['1 tembleque'], 3: ['1 escozor'], 4: ['Rotura no esquivable', 'lanza +1d4'], 5: [], 6: [] }
    },
    4: {
      level: 4, hp: 20, mo: 6, pex: 5, dice: ['1d4', '+1', '1d6', '+1'], image: 'assets/Monstruos/04.jpg',
      attacks: { 1: ['Rotura no esquivable', 'Daño Directo'], 2: ['Rotura'], 3: ['Rotura'], 4: ['Rotura no esquivable', '1 escozor'], 5: ['Rotura no esquivable', '1 calambre'], 6: ['Rotura no esquivable', '1 tembleque'] }
    },
    5: {
      level: 5, hp: 25, mo: 8, pex: 8, dice: ['1d6', '+2', '1d6', '+2'], image: 'assets/Monstruos/05.jpg',
      attacks: { 1: ['Rotura no esquivable', 'Daño Directo', '1 tembleque'], 2: ['Rotura no esquivable', '1 calambre'], 3: ['Rotura no esquivable', '1 escozor'], 4: ['Rotura no esquivable', '1 escozor'], 5: ['Rotura no esquivable', '1 calambre'], 6: ['Rotura no esquivable', '1 tembleque'] }
    }
  },

  // SENDA INICIACIÓN HITOS
  hitos: {
    iniciacion: [
      { id: 1, name: "Bautismo de Hierro", goblins: [1, 1], isBoss: false },
      { id: 2, name: "Alerta de Mutación", goblins: [1, 1, 2], isBoss: false },
      { id: 3, name: "Acero y Desgaste", goblins: [3], isBoss: false },
      { id: 4, name: "El Despertar del Rol", goblins: [4], isBoss: false },
      { id: 5, name: "Desafío Final", goblins: [5], isBoss: true, bossStats: { hpMultiplier: 25, regen: 5, dice: ['1d6', '+2', '1d6', '+2'], image: 'assets/Monstruos/Jefes/Inicicion.jpg' } }
    ],
    guerrero: [
      { id: 1, name: "La Avanzadilla", goblins: [1, 1], isBoss: false, ruleDesc: "Despliégalos uno a uno. Al matar al primero, entra el segundo." },
      { id: 2, name: "La Emboscada", goblins: [1, 2], isBoss: false, ruleDesc: "El goblin de nivel 2 obtiene +1 en Ataque por cada goblin de nivel 1." },
      { id: 3, name: "El Capitán", goblins: [1, 3], isBoss: false, ruleDesc: "El Nivel 3 es inmune al daño mientras esté acompañado de niveles inferiores." },
      { id: 4, name: "La Horda", goblins: [2, 2, 3], isBoss: false, ruleDesc: "Mientras algún nivel 1 siga vivo, el nivel 2 y el nivel 3 son invulnerables." },
      { id: 5, name: "Zeñor de la Guerra", goblins: [5], isBoss: true, bossStats: { hpMultiplier: 35, regen: 5, dice: ['2d6', '+2'], image: 'assets/Monstruos/Jefes/Señor-de-la-Guerra.jpg', attacks: { 1: ['Daño Directo', 'Rotura no esquivable'], 2: ['1 calambre', '1 rotura'], 3: ['1 escozor', '1 rotura'], 4: ['1 tembleque'], 5: ['Rotura no esquivable', 'daño+2'], 6: ['Golpe Brutal'] }, ability: { id: 'golpe_certero', name: 'Golpe Certero', desc: 'Añade 1d4 al daño si el jefe logra dañar al jugador.' } }, ruleDesc: "Jefe Final. Golpe Brutal: Si el Jefe saca un '6' en cualquiera de sus dados d6, te rompe una pieza de armadura antes de asignar tus dados." }
    ],
    rey_brujo: [
      { id: 1, name: "La Patrulla", goblins: [1, 1], isBoss: false, ruleDesc: "Despliégalos uno a uno. Al matar al primero, entra el segundo." },
      { id: 2, name: "El Oficial", goblins: [1, 1], isBoss: false, ruleDesc: "Atacan al mismo tiempo." },
      { id: 3, name: "La Plaga", goblins: [1, 1, 1], isBoss: false, ruleDesc: "Si al iniciar una Oleada queda algún Goblin de este hito, invoca otra vez los Goblins eliminados del hito." },
      { id: 4, name: "El Asalto", goblins: [2, 2], isBoss: false, ruleDesc: "Debes superar el hito con un dado ROJO menos." },
      { id: 5, name: "Rey Brujo", goblins: [5], isBoss: true, bossStats: { hpMultiplier: 30, regen: 5, dice: ['2d6', '+1'], image: 'assets/Monstruos/Jefes/Rey-Brujo.jpg', attacks: { 1: ['Drena 4 PV Daño Directo'], 2: ['daño 3', '1 rotura'], 3: ['1 calambre', '1 escozor'], 4: ['Daño Directo', 'Elimina un d6 ROJO'], 5: ['Daño Directo', 'daño 4'], 6: ['1 Daño Directo', 'Invocación goblin Nivel 1'] }, ability: { id: 'campo_de_fuerza', name: 'Campo de Fuerza', desc: 'Cada vez que le ataques, el Jefe lanza 1d6 extra. Si saca un 5 o 6, tu ataque se anula completamente.' } }, ruleDesc: "Jefe Final. Campo de Fuerza: Cada vez que le ataques, el Jefe lanza 1d6 extra. Si saca un 5 o 6, tu ataque se anula completamente." }
    ]
  },

  sendaReglasGenerales: {
    iniciacion: [
      { name: "Sin reglas especiales", desc: "Esta senda no aplica ninguna regla de entorno adicional." }
    ],
    guerrero: [
      { name: "Hasta que el Cuerpo Aguante", desc: "Al inicio de tus acciones, si hay Goblins vivos, debes gastar acciones en luchar. Si la mesa está vacía, debes elegir entre sacar un Goblin de Nivel 1 o desplegar el siguiente Hito." }
    ],
    rey_brujo: [
      { name: "💨 Aire Viciado", desc: "Al inicio de tu acción, si tienes 2 o más cartas de equipo rotas, sufres automáticamente 1 punto de Daño Directo por cada equipo roto." },
      { name: "🧪 Corrosión", desc: "Cuando un Goblin te inflija daño (en combate o por represalia), debes elegir una carta de tu equipo equipado activo para romperla." }
    ]
  },

  // FRASES ALEATORIAS PARA EL GAMEOVER
  gameOverPhrases: [
    "Los goblins han reclamado el reino. Vuestras hazañas serán recordadas (o no).",
    "¿Eso es todo? Esperábamos algo más de resistencia... o al menos algo más de oro.",
    "Tus huesos servirán para decorar el trono del Rey Goblin. ¡Qué honor!",
    "Parece que vuestras 'tácticas' necesitaban un poco más de práctica... y menos morir.",
    "Vuestras armas han caído en la zona de rotura definitiva; el reino ahora pertenece a los Goblins.",
    "Ni acumulando toda la Esencia del mundo lograréis revivir como Fantasmas tras esta humillante paliza.",
    "El Zeñor de la Guerra usará vuestros escudos destrozados como platos para su banquete de victoria.",
    "El Rey Brujo os ha reclutado para su ejército de no-muertos, aunque vuestro equipo está demasiado roto para serle verdaderamente útil.",
    "El Gran Recaudador os ha dejado sin puntos de vida y se ha llevado en su saco hasta vuestra última moneda (mo).",
    "Caísteis de lleno en la emboscada; El Cazador adornará su guarida con vuestros trofeos llenos de toxinas.",
    "El nido ha prevalecido; La Madre alimentará a su interminable horda de crías de Nivel 1 con vuestros restos.",
    "El Piromante ha reducido a cenizas vuestras esperanzas, dejándoos solo con letales cargas de Escozor.",
    "El dado verde dictó sentencia, y un fatídico fondo multicolor fue lo último que visteis antes del fin.",
    "Entre el Tembleque, el Escozor y el Calambre, vuestra última batalla fue, como poco, ridículamente rítmica.",
    "El Mercado ha cerrado sus puertas permanentemente; los Goblins son los nuevos dueños de la tienda.",
    "Los Goblins de la oleada sufrieron una Mutación tan rápida hacia el Nivel 5 que no tuvisteis ni tiempo de gastar vuestras acciones.",
    "La Regla de Honor dictamina que vuestra actuación ha sido tan patética que ni siquiera otorgaríais Puntos de Experiencia.",
    "Ni gastando todas las Energías en el Rol de Sanador podríais revertir la masacre que habéis sufrido en el campo de batalla.",
    "Vuestras Mascotas han huido despavoridas al mazo de descartes, cansadas de ver cómo fracasabais en cada tirada.",
    "Habéis sucumbido ante el daño ineludible de la Represalia al final de la oleada; los goblins no tienen piedad de los que se quedan sin acciones.",
    "Vuestro nivel de incompetencia táctica superó con creces el límite máximo de vuestros bloques de equipo.",
    "Intentasteis relanzar el dado negro, pero el destino ya había decidido que seríais pasto de los Malditos Goblins.",
    "Vuestra aventura cooperativa acaba aquí: sin oro, con los PV a cero, y con todas las espadas hechas pedazos.",
    "Los goblins han reclamado el reino. Vuestras hazañas serán recordadas (o no).",
    "Habéis caído en la batalla y la oscuridad devora por fin vuestro hogar.",
    "Las hordas enemigas celebran la victoria sobre vuestros cuerpos caídos; la derrota es total.",
    "Vuestro sacrificio ha sido en vano, el reino pertenece ahora a los invasores.",
    "Las defensas cedieron y las armas se hicieron pedazos; nadie queda para contar vuestra historia.",
    "Un final trágico para unos valientes que prometían mucho y lograron muy poco.",
    "El polvo y la ruina son el único legado que dejáis tras esta humillante caída.",
    "Fueron demasiados, fuisteis muy pocos; la resistencia termina aquí y ahora.",
    "Las sombras se alzan triunfantes mientras vuestro grupo exhala su último aliento.",
    "Vuestra travesía concluye en desastre, dejando el mundo a merced del caos.",
    "Ni el coraje ni la camaradería fueron suficientes para evitar la masacre.",
    "El campamento ha sido arrasado y vuestros nombres pronto serán olvidados por el tiempo.",
    "Los tiranos celebran un gran banquete esta noche y vuestro fracaso es el trofeo principal.",
    "Caísteis en la trampa definitiva; la tierra silenciará vuestros lamentos para siempre.",
    "Sin fuerzas para manteneros en pie, solo os queda aceptar este amargo y oscuro destino.",
    "La luz de la esperanza se apaga al ver cómo el enemigo asalta vuestra última fortaleza.",
    "Vuestros juramentos de victoria se han transformado en ecos de una rendición absoluta.",
    "Habéis luchado con honor, pero el enemigo ya había sellado vuestra inevitable condena.",
    "La batalla está perdida, los muros han caído y los monstruos reclaman el trono vacío.",
    "Vuestra hazaña conjunta termina entre sangre, barro y un silencio sepulcral.",
    "El mal ha triunfado hoy de forma implacable; que el cielo se apiade de los que aún quedan vivos.",
    "Habéis caído heroicamente, o eso le diréis al bardo al que habéis sobornado antes de convertiros en abono orgánico para las crías del enemigo.",
    "Vuestra aventura termina aquí, dejándoos no solo en la ruina física, sino con una deuda financiera tan asombrosa que la heredarán vuestros nietos.",
    "Os enfrentasteis al fuego enemigo con valentía y habéis acabado siendo el equivalente heroico de una tostada olvidada en la sartén.",
    "¡Enhorabuena! Las fuerzas oscuras acaban de ganar a cuatro nuevos becarios no-muertos para trabajar toda la eternidad sin sueldo.",
    "Los tiranos celebrarán la victoria esta noche usando vuestras armaduras abolladas como cuencos para servir la sopa.",
    "Sobrevivisteis a mil peligros exóticos, solo para sucumbir ante la trampa más predecible y peor escondida de todo el bosque.",
    "Hasta los animalillos que os acompañaban han fingido no conoceros y se han ido corriendo a buscar a un grupo de aventureros más competente.",
    "Ese momento incómodo en el que todos os mirasteis esperando que otro salvara el día, y resulta que nadie tenía un plan.",
    "Vuestro último intento desesperado por curaros tuvo la misma eficacia que ponerle una triste tirita a un barco que se hunde.",
    "Resulta que la táctica de quedarse mirando cómo los enemigos más pequeños se amontonaban no fue la idea brillante del siglo.",
    "Vuestros espíritus claman venganza, pero sinceramente, dais mucha más pena que miedo en vuestra nueva forma transparente.",
    "Los mercaderes del pueblo ya están frotándose las manos y subiendo los precios ahora que nadie queda vivo para pedirles descuentos.",
    "Intentasteis esconderos al final del combate, pero el fracaso os alcanzó con la precisión matemática de un piano cayendo de un balcón.",
    "Ni toda la vocación mística, mágica o sanadora del grupo pudo compensar vuestra absoluta y terrible falta de puntería de hoy.",
    "El mal ha triunfado definitivamente. Mañana la taberna tendrá que colgar un cartel de: 'Se buscan héroes... preferiblemente con algo de sentido común'."
  ]
};
