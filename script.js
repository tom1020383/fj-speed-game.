/* ==========================================================================
   FJ SPEED — script.js
   Moteur du jeu : 3 modes (F/J, Mots, Souris), 5 difficultés, 8 skins,
   7 maps, particules canvas, sons WebAudio, i18n 5 langues, sauvegarde
   LocalStorage. 100% vanilla, aucun réseau requis.

   Sommaire :
     1. Helpers
     2. Données (modes, difficultés, skins, maps, particules, mots, i18n)
     3. Sauvegarde (LocalStorage)
     4. Audio (WebAudio, sons générés — aucun fichier)
     5. Particules (canvas : ambiance par map + explosions)
     6. Interface (navigation, i18n, écrans de sélection, paramètres, stats)
     7. Moteur de jeu (chrono, HUD, progression, popups)
     8. Modes : FJ / Words / Aim
     9. Résultats & enregistrement des stats
    10. Entrées globales & initialisation
   ========================================================================== */
"use strict";

/* ============================== 1. HELPERS ============================== */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
/* Supprime les accents pour comparer les frappes (é→e, ñ→n, ü→u…) */
const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* ============================== 2. DONNÉES ============================== */

const MODE_IDS = ["fj", "words", "aim"];
const MODE_ICONS = { fj: "⌨️", words: "📝", aim: "🎯" };

/* Paramètres de chaque difficulté, par mode :
   - fj    : time (s), goal (touches / niveau), mult (multiplicateur), penalty (points perdus par erreur)
   - words : time (s), len [min,max] (longueur des mots), mult, penalty
   - aim   : time (s), size (px départ), min (px mini), life (ms de vie), minLife, conc (cibles simultanées), mult */
const DIFFS = {
  facile:     { fj: { time: 30, goal: 30, mult: 1,   penalty: 0  }, words: { time: 60, len: [2, 5],  mult: 1,   penalty: 0  }, aim: { time: 30, size: 130, min: 88, life: 2400, minLife: 1400, conc: 1, mult: 1 } },
  normal:     { fj: { time: 30, goal: 40, mult: 1.5, penalty: 0  }, words: { time: 60, len: [3, 7],  mult: 1.5, penalty: 0  }, aim: { time: 30, size: 112, min: 70, life: 1850, minLife: 1050, conc: 2, mult: 1.5 } },
  difficile:  { fj: { time: 30, goal: 50, mult: 2,   penalty: 5  }, words: { time: 60, len: [5, 9],  mult: 2,   penalty: 5  }, aim: { time: 30, size: 94,  min: 54, life: 1500, minLife: 820,  conc: 2, mult: 2 } },
  extreme:    { fj: { time: 30, goal: 62, mult: 3,   penalty: 10 }, words: { time: 60, len: [6, 12], mult: 3,   penalty: 10 }, aim: { time: 30, size: 78,  min: 42, life: 1150, minLife: 640,  conc: 3, mult: 3 } },
  impossible: { fj: { time: 30, goal: 78, mult: 5,   penalty: 20 }, words: { time: 60, len: [8, 99], mult: 5,   penalty: 20 }, aim: { time: 30, size: 60,  min: 30, life: 880,  minLife: 460,  conc: 3, mult: 5 } },
};
const DIFF_IDS = Object.keys(DIFFS);
const DIFF_FLAMES = { facile: "🔥", normal: "🔥🔥", difficile: "🔥🔥🔥", extreme: "🔥🔥🔥🔥", impossible: "💀" };

/* Skins : identifiant, nom affiché, 3 couleurs d'aperçu */
const SKINS = [
  { id: "neon",   name: "Neon",   c: ["#00f0ff", "#ff00e0", "#0b0d22"] },
  { id: "cyber",  name: "Cyber",  c: ["#ffe600", "#00ffd0", "#1a0b2e"] },
  { id: "space",  name: "Space",  c: ["#8f8fff", "#c98fff", "#0d0d26"] },
  { id: "fire",   name: "Fire",   c: ["#ff9500", "#ff3d00", "#2b0c05"] },
  { id: "ice",    name: "Ice",    c: ["#8fe8ff", "#e0f7ff", "#0a2238"] },
  { id: "matrix", name: "Matrix", c: ["#00ff66", "#00cc44", "#02140a"] },
  { id: "gold",   name: "Gold",   c: ["#ffd700", "#ffb300", "#241a08"] },
  { id: "pixel",  name: "Pixel",  c: ["#ff004d", "#29adff", "#1d2b53"] },
];

const MAPS = [
  { id: "city",    emoji: "🌆" }, { id: "forest", emoji: "🌲" }, { id: "desert", emoji: "🏜️" },
  { id: "ocean",   emoji: "🌊" }, { id: "volcano", emoji: "🌋" }, { id: "temple", emoji: "🏛️" },
  { id: "space",   emoji: "🌌" },
];

/* Particules d'ambiance associées à chaque map
   mode : rise (monte), fall (tombe), drift (dérive latérale), float (flotte), twinkle (scintille) */
const AMBIENT = {
  city:    { n: 36, colors: ["#00e6ff", "#ff00e0", "#ffffff"], mode: "rise",    size: [1, 3],   speed: [12, 40] },
  forest:  { n: 26, colors: ["#7ddf8a", "#3fae5a", "#d9ff8a"], mode: "fall",    size: [2, 4],   speed: [14, 32] },
  desert:  { n: 30, colors: ["#ffd9a0", "#e8b06a", "#fff2cc"], mode: "drift",   size: [1, 2.5], speed: [26, 60] },
  ocean:   { n: 28, colors: ["#aee9ff", "#ffffff", "#7fd4ff"], mode: "rise",    size: [2, 5],   speed: [10, 26] },
  volcano: { n: 34, colors: ["#ff9440", "#ff5722", "#ffd54f"], mode: "rise",    size: [1.5, 3.5], speed: [18, 50] },
  temple:  { n: 22, colors: ["#ffe9a0", "#ffd700", "#fff6d0"], mode: "float",   size: [1.5, 3], speed: [6, 14] },
  space:   { n: 55, colors: ["#ffffff", "#a0c8ff", "#e0d0ff"], mode: "twinkle", size: [.8, 2.2], speed: [0, 0] },
};

/* Listes de mots par langue (~110-160 mots chacune, toutes longueurs ;
   le japonais fournit kana + romaji à taper) */
const WORDS = {
  fr: [
    "or", "vie", "roi", "feu", "mer", "sel", "cri", "lac", "riz", "rue", "sac", "ski", "dos", "eau", "fil", "gel", "bec", "art", "ami", "bol",
    "clé", "jeu", "vite", "main", "roue", "flux", "vent", "vert", "voix", "zone", "lune", "loup", "nuit", "pain", "parc", "pied", "pont", "port", "rêve", "tour",
    "arbre", "avion", "chant", "chien", "corde", "danse", "école", "fleur", "météo", "froid", "glace", "herbe", "hiver", "image", "livre", "magie", "pluie", "score", "pixel", "sport",
    "souris", "clavier", "rapide", "étoile", "éclair", "jardin", "jungle", "maison", "miroir", "moteur", "nuage", "océan", "oiseau", "ombre", "orage", "orange", "pierre", "plage", "plume", "pomme",
    "musique", "fenêtre", "vitesse", "fantôme", "horizon", "lumière", "énergie", "galaxie", "fusée", "dragon", "tempête", "mystère", "cristal", "tornade", "trésor", "sourire", "rivière", "soleil", "voyage", "violon",
    "montagne", "victoire", "papillon", "précision", "champion", "aventure", "ordinateur", "labyrinthe", "développeur", "électrique", "bibliothèque", "boulangerie", "brouillard", "chevalier", "chocolat", "citrouille", "dinosaure", "éléphant", "escalier", "grenouille",
    "hélicoptère", "incroyable", "magnifique", "merveilleux", "parapluie", "professeur", "programmation", "technologie", "télécommande", "université", "extraordinaire", "accélération", "fantastique", "formidable", "invincible", "dictionnaire", "montgolfière", "cascade", "turbo", "néon",
  ],
  en: [
    "ant", "arm", "bat", "bed", "bee", "box", "bug", "cat", "cup", "dog", "ear", "egg", "fox", "fun", "gem", "hat", "ice", "jam", "key", "map",
    "run", "fast", "jump", "moon", "net", "owl", "pen", "pig", "rain", "red", "sea", "sky", "star", "sun", "tea", "toy", "van", "wave", "web", "win",
    "mouse", "speed", "quick", "light", "storm", "blaze", "apple", "beach", "brain", "bread", "brick", "candy", "chair", "cloud", "dance", "dream", "eagle", "earth", "field", "flame",
    "fruit", "ghost", "glass", "grape", "green", "heart", "honey", "horse", "house", "juice", "lemon", "magic", "money", "music", "night", "ocean", "paint", "paper", "peace", "piano",
    "pizza", "plant", "power", "queen", "river", "robot", "smile", "snake", "sound", "space", "stone", "sugar", "table", "tiger", "train", "water", "whale", "world", "zebra", "planet",
    "rocket", "shadow", "energy", "galaxy", "mystery", "victory", "crystal", "phantom", "horizon", "thunder", "keyboard", "velocity", "champion", "mountain", "mushroom", "notebook", "rainbow", "sandwich", "treasure", "umbrella",
    "airplane", "birthday", "butterfly", "chocolate", "computer", "dinosaur", "elephant", "elevator", "fantastic", "firework", "incredible", "knowledge", "laboratory", "lightning", "adventure", "pineapple", "programmer", "strawberry", "sunflower", "technology",
    "telephone", "telescope", "tornado", "universe", "vacation", "waterfall", "wonderful", "spectacular", "acceleration", "extraordinary", "impossible", "particle", "combo", "score", "pixel", "turbo", "dragon", "snow", "wind", "gold",
  ],
  es: [
    "sol", "luz", "mar", "pan", "sal", "oro", "uva", "isla", "vaca", "lobo", "gato", "hoja", "miel", "mesa", "cama", "casa", "flor", "faro", "nube", "vida",
    "rojo", "mano", "aire", "agua", "alto", "azul", "cielo", "calle", "campo", "carta", "clase", "coche", "color", "dedo", "dulce", "globo", "hielo", "juego", "leche", "libro",
    "luna", "lluvia", "magia", "mundo", "noche", "nieve", "risa", "salto", "selva", "sueño", "tigre", "torre", "tren", "valle", "verde", "viaje", "playa", "plaza", "perro", "piedra",
    "amigo", "árbol", "arena", "baile", "barco", "bosque", "brazo", "camino", "ciudad", "comida", "cuento", "diente", "espada", "espejo", "fiesta", "fresa", "fruta", "gente", "helado", "jardín",
    "limón", "madera", "manzana", "mañana", "momento", "montaña", "música", "naranja", "país", "pájaro", "palabra", "papel", "planta", "pueblo", "puerta", "queso", "regalo", "reina", "reloj", "sombra",
    "sonrisa", "tiempo", "tierra", "ventana", "verano", "zapato", "ratón", "rápido", "teclado", "estrella", "velocidad", "relámpago", "ordenador", "campeón", "misterio", "aventura", "galaxia", "dragón", "tormenta", "cristal",
    "fantasma", "horizonte", "victoria", "energía", "biblioteca", "chocolate", "dinosaurio", "elefante", "escalera", "fantástico", "increíble", "mariposa", "maravilloso", "murciélago", "paraguas", "primavera", "tecnología", "teléfono", "terremoto", "universidad",
    "imposible", "extraordinario", "aceleración", "guitarra", "familia", "escuela", "trueno", "cometa", "fuego", "viento", "turbo", "neón", "píxel", "río", "oso", "año", "mono", "lago", "cera", "duna",
  ],
  de: [
    "rot", "eis", "zug", "see", "arm", "ohr", "tag", "tor", "hut", "mut", "wal", "reh", "gras", "gold", "hand", "maus", "wind", "held", "haus", "herz",
    "stern", "blitz", "sturm", "sieg", "licht", "feuer", "apfel", "auge", "auto", "ball", "baum", "berg", "bild", "blume", "boot", "brot", "buch", "burg", "dach", "dorf",
    "ente", "erde", "fisch", "fluss", "frosch", "fuchs", "geist", "himmel", "holz", "honig", "hund", "insel", "katze", "kette", "kind", "klang", "kopf", "kraft", "krone", "kuchen",
    "lampe", "land", "leben", "lied", "luft", "mond", "meer", "milch", "musik", "nacht", "nase", "nebel", "pferd", "pilz", "platz", "quelle", "regen", "reise", "ritter", "rose",
    "sand", "schiff", "schnee", "schule", "sommer", "sonne", "spiegel", "spiel", "stadt", "strand", "tanz", "tiger", "tisch", "traum", "turm", "vogel", "wald", "wasser", "welle", "welt",
    "wiese", "winter", "wolke", "wunder", "zauber", "zeit", "zahl", "korb", "garten", "morgen", "planet", "rakete", "drache", "schnell", "donner", "energie", "meister", "kristall", "schatten", "tastatur",
    "gebirge", "gewitter", "fahrrad", "zukunft", "abenteuer", "bibliothek", "computer", "dinosaurier", "elefant", "geheimnis", "regenbogen", "schlange", "schmetterling", "schokolade", "technologie", "telefon", "universum", "wasserfall", "wissenschaft", "unglaublich",
    "blitzschnell", "geschwindigkeit", "meisterschaft", "herausforderung", "turbo", "neon", "pixel", "galaxie", "komet", "strasse",
  ],
  ja: [
    { k: "ねこ", r: "neko" }, { k: "いぬ", r: "inu" }, { k: "そら", r: "sora" }, { k: "うみ", r: "umi" },
    { k: "やま", r: "yama" }, { k: "ほし", r: "hoshi" }, { k: "とり", r: "tori" }, { k: "はな", r: "hana" },
    { k: "みず", r: "mizu" }, { k: "ゆき", r: "yuki" }, { k: "かぜ", r: "kaze" }, { k: "あめ", r: "ame" },
    { k: "くも", r: "kumo" }, { k: "つき", r: "tsuki" }, { k: "もり", r: "mori" }, { k: "かわ", r: "kawa" },
    { k: "しま", r: "shima" }, { k: "ゆめ", r: "yume" }, { k: "しろ", r: "shiro" }, { k: "おちゃ", r: "ocha" },
    { k: "すし", r: "sushi" }, { k: "かたな", r: "katana" }, { k: "さかな", r: "sakana" }, { k: "やさい", r: "yasai" },
    { k: "ひかり", r: "hikari" }, { k: "こころ", r: "kokoro" }, { k: "ごはん", r: "gohan" }, { k: "はなび", r: "hanabi" },
    { k: "まつり", r: "matsuri" }, { k: "こおり", r: "koori" }, { k: "えいが", r: "eiga" }, { k: "みらい", r: "mirai" },
    { k: "かがく", r: "kagaku" }, { k: "れきし", r: "rekishi" }, { k: "おんせん", r: "onsen" }, { k: "おかし", r: "okashi" },
    { k: "かみなり", r: "kaminari" }, { k: "たつまき", r: "tatsumaki" }, { k: "でんき", r: "denki" }, { k: "はやい", r: "hayai" },
    { k: "つよい", r: "tsuyoi" }, { k: "さくら", r: "sakura" }, { k: "にんじゃ", r: "ninja" }, { k: "さむらい", r: "samurai" },
    { k: "かいぞく", r: "kaizoku" }, { k: "きつね", r: "kitsune" }, { k: "うさぎ", r: "usagi" }, { k: "たいよう", r: "taiyou" },
    { k: "おりがみ", r: "origami" }, { k: "からて", r: "karate" }, { k: "かぶき", r: "kabuki" }, { k: "やまびこ", r: "yamabiko" },
    { k: "ともだち", r: "tomodachi" }, { k: "がっこう", r: "gakkou" }, { k: "せんせい", r: "sensei" }, { k: "おんがく", r: "ongaku" },
    { k: "ひこうき", r: "hikouki" }, { k: "でんしゃ", r: "densha" }, { k: "じてんしゃ", r: "jitensha" }, { k: "としょかん", r: "toshokan" },
    { k: "ちきゅう", r: "chikyuu" }, { k: "うちゅう", r: "uchuu" }, { k: "たからもの", r: "takaramono" }, { k: "ドラゴン", r: "doragon" },
    { k: "ロケット", r: "roketto" }, { k: "エネルギー", r: "enerugii" }, { k: "チャンピオン", r: "chanpion" }, { k: "スピード", r: "supiido" },
    { k: "コンボ", r: "konbo" }, { k: "ぼうけん", r: "bouken" }, { k: "きせき", r: "kiseki" }, { k: "ゆうしょう", r: "yuushou" },
    { k: "まほう", r: "mahou" }, { k: "ふしぎ", r: "fushigi" }, { k: "すばらしい", r: "subarashii" }, { k: "ありがとう", r: "arigatou" },
    { k: "いなずま", r: "inazuma" }, { k: "おめでとう", r: "omedetou" }, { k: "がんばって", r: "ganbatte" }, { k: "いただきます", r: "itadakimasu" },
  ],
};

/* Traductions de l'interface (5 langues) */
const I18N = {
  fr: {
    subtitle: "Vitesse · Précision · Réflexes",
    play: "Jouer", modes: "Modes", difficulty: "Difficulté", skins: "Skins", maps: "Maps",
    stats: "Statistiques", settings: "Paramètres", back: "Retour",
    mode_fj: "Mode F / J", mode_fj_d: "Appuie sur la touche qui s'allume — F ou J !",
    mode_words: "Mode Mots", mode_words_d: "Tape les mots qui apparaissent.",
    mode_aim: "Mode Souris", mode_aim_d: "Clique les cibles avant qu'elles disparaissent.",
    word_lang: "Langue des mots :",
    d_facile: "Facile", d_normal: "Normal", d_difficile: "Difficile", d_extreme: "Extrême", d_impossible: "Impossible",
    dd_facile: "Pour s'échauffer", dd_normal: "L'équilibre parfait", dd_difficile: "Ça devient sérieux",
    dd_extreme: "Réflexes de pro requis", dd_impossible: "Bonne chance…",
    map_city: "Ville futuriste", map_forest: "Forêt", map_desert: "Désert", map_ocean: "Océan",
    map_volcano: "Volcan", map_temple: "Temple", map_space: "Espace",
    st_best: "Meilleur score", st_time: "Temps joué", st_games: "Parties jouées", st_acc: "Précision moyenne",
    st_cps: "CPS max", st_wpm: "WPM max", st_records: "Records par mode et difficulté",
    st_reset: "Réinitialiser les statistiques", st_reset_confirm: "Effacer toutes les statistiques et records ?",
    set_volume: "Volume", set_lang: "Langue", set_fs: "Plein écran", set_fx: "Effets visuels", set_size: "Taille du texte",
    hud_score: "Score", hud_time: "Temps", hud_combo: "Combo", hud_acc: "Précision", hud_record: "Record", hud_react: "Réaction",
    sp_tps: "Touches/s", sp_wpm: "WPM", sp_cps: "CPS",
    r_title: "Résultats", r_new: "Nouveau record !", r_replay: "Rejouer", r_menu: "Menu",
    r_score: "Score final", r_maxcombo: "Combo max", r_hits: "Réussites", r_errors: "Erreurs",
    r_acc: "Précision", r_words: "Mots tapés", r_react: "Réaction moy.", r_record: "Record",
    h_fj: "Appuie sur la touche allumée (F ou J) le plus vite possible !",
    h_words: "Tape le mot affiché — les accents sont facultatifs.",
    h_aim: "Clique sur les cibles avant qu'elles ne rétrécissent !",
    go: "GO !", lvl_up: "NIVEAU",
  },
  en: {
    subtitle: "Speed · Accuracy · Reflexes",
    play: "Play", modes: "Modes", difficulty: "Difficulty", skins: "Skins", maps: "Maps",
    stats: "Statistics", settings: "Settings", back: "Back",
    mode_fj: "F / J Mode", mode_fj_d: "Press whichever key lights up — F or J!",
    mode_words: "Words Mode", mode_words_d: "Type the words that appear.",
    mode_aim: "Mouse Mode", mode_aim_d: "Click the targets before they vanish.",
    word_lang: "Word language:",
    d_facile: "Easy", d_normal: "Normal", d_difficile: "Hard", d_extreme: "Extreme", d_impossible: "Impossible",
    dd_facile: "Warm-up pace", dd_normal: "The perfect balance", dd_difficile: "Getting serious",
    dd_extreme: "Pro reflexes required", dd_impossible: "Good luck…",
    map_city: "Futuristic city", map_forest: "Forest", map_desert: "Desert", map_ocean: "Ocean",
    map_volcano: "Volcano", map_temple: "Temple", map_space: "Space",
    st_best: "Best score", st_time: "Time played", st_games: "Games played", st_acc: "Average accuracy",
    st_cps: "Max CPS", st_wpm: "Max WPM", st_records: "Records by mode and difficulty",
    st_reset: "Reset statistics", st_reset_confirm: "Erase all statistics and records?",
    set_volume: "Volume", set_lang: "Language", set_fs: "Fullscreen", set_fx: "Visual effects", set_size: "Text size",
    hud_score: "Score", hud_time: "Time", hud_combo: "Combo", hud_acc: "Accuracy", hud_record: "Best", hud_react: "Reaction",
    sp_tps: "Keys/s", sp_wpm: "WPM", sp_cps: "CPS",
    r_title: "Results", r_new: "New record!", r_replay: "Replay", r_menu: "Menu",
    r_score: "Final score", r_maxcombo: "Max combo", r_hits: "Hits", r_errors: "Errors",
    r_acc: "Accuracy", r_words: "Words typed", r_react: "Avg reaction", r_record: "Best",
    h_fj: "Press the highlighted key (F or J) as fast as you can!",
    h_words: "Type the displayed word — accents are optional.",
    h_aim: "Click the targets before they shrink away!",
    go: "GO!", lvl_up: "LEVEL",
  },
  es: {
    subtitle: "Velocidad · Precisión · Reflejos",
    play: "Jugar", modes: "Modos", difficulty: "Dificultad", skins: "Skins", maps: "Mapas",
    stats: "Estadísticas", settings: "Ajustes", back: "Volver",
    mode_fj: "Modo F / J", mode_fj_d: "¡Pulsa la tecla que se ilumina — F o J!",
    mode_words: "Modo Palabras", mode_words_d: "Escribe las palabras que aparecen.",
    mode_aim: "Modo Ratón", mode_aim_d: "Haz clic en los objetivos antes de que desaparezcan.",
    word_lang: "Idioma de las palabras:",
    d_facile: "Fácil", d_normal: "Normal", d_difficile: "Difícil", d_extreme: "Extremo", d_impossible: "Imposible",
    dd_facile: "Para calentar", dd_normal: "El equilibrio perfecto", dd_difficile: "Se pone serio",
    dd_extreme: "Reflejos de pro", dd_impossible: "Buena suerte…",
    map_city: "Ciudad futurista", map_forest: "Bosque", map_desert: "Desierto", map_ocean: "Océano",
    map_volcano: "Volcán", map_temple: "Templo", map_space: "Espacio",
    st_best: "Mejor puntuación", st_time: "Tiempo jugado", st_games: "Partidas", st_acc: "Precisión media",
    st_cps: "CPS máx", st_wpm: "WPM máx", st_records: "Récords por modo y dificultad",
    st_reset: "Restablecer estadísticas", st_reset_confirm: "¿Borrar todas las estadísticas y récords?",
    set_volume: "Volumen", set_lang: "Idioma", set_fs: "Pantalla completa", set_fx: "Efectos visuales", set_size: "Tamaño del texto",
    hud_score: "Puntos", hud_time: "Tiempo", hud_combo: "Combo", hud_acc: "Precisión", hud_record: "Récord", hud_react: "Reacción",
    sp_tps: "Teclas/s", sp_wpm: "WPM", sp_cps: "CPS",
    r_title: "Resultados", r_new: "¡Nuevo récord!", r_replay: "Repetir", r_menu: "Menú",
    r_score: "Puntuación final", r_maxcombo: "Combo máx", r_hits: "Aciertos", r_errors: "Errores",
    r_acc: "Precisión", r_words: "Palabras", r_react: "Reacción media", r_record: "Récord",
    h_fj: "¡Pulsa la tecla iluminada (F o J) lo más rápido posible!",
    h_words: "Escribe la palabra mostrada — los acentos son opcionales.",
    h_aim: "¡Haz clic en los objetivos antes de que se encojan!",
    go: "¡YA!", lvl_up: "NIVEL",
  },
  de: {
    subtitle: "Tempo · Präzision · Reflexe",
    play: "Spielen", modes: "Modi", difficulty: "Schwierigkeit", skins: "Skins", maps: "Karten",
    stats: "Statistiken", settings: "Einstellungen", back: "Zurück",
    mode_fj: "F / J Modus", mode_fj_d: "Drücke die Taste, die aufleuchtet — F oder J!",
    mode_words: "Wörter-Modus", mode_words_d: "Tippe die erscheinenden Wörter.",
    mode_aim: "Maus-Modus", mode_aim_d: "Klicke die Ziele, bevor sie verschwinden.",
    word_lang: "Wortsprache:",
    d_facile: "Leicht", d_normal: "Normal", d_difficile: "Schwer", d_extreme: "Extrem", d_impossible: "Unmöglich",
    dd_facile: "Zum Aufwärmen", dd_normal: "Die perfekte Balance", dd_difficile: "Jetzt wird's ernst",
    dd_extreme: "Profi-Reflexe nötig", dd_impossible: "Viel Glück…",
    map_city: "Futuristische Stadt", map_forest: "Wald", map_desert: "Wüste", map_ocean: "Ozean",
    map_volcano: "Vulkan", map_temple: "Tempel", map_space: "Weltraum",
    st_best: "Bester Score", st_time: "Spielzeit", st_games: "Gespielte Runden", st_acc: "Ø Genauigkeit",
    st_cps: "Max. CPS", st_wpm: "Max. WPM", st_records: "Rekorde nach Modus und Schwierigkeit",
    st_reset: "Statistiken zurücksetzen", st_reset_confirm: "Alle Statistiken und Rekorde löschen?",
    set_volume: "Lautstärke", set_lang: "Sprache", set_fs: "Vollbild", set_fx: "Visuelle Effekte", set_size: "Textgröße",
    hud_score: "Punkte", hud_time: "Zeit", hud_combo: "Combo", hud_acc: "Genauigkeit", hud_record: "Rekord", hud_react: "Reaktion",
    sp_tps: "Tasten/s", sp_wpm: "WPM", sp_cps: "CPS",
    r_title: "Ergebnisse", r_new: "Neuer Rekord!", r_replay: "Nochmal", r_menu: "Menü",
    r_score: "Endpunktzahl", r_maxcombo: "Max. Combo", r_hits: "Treffer", r_errors: "Fehler",
    r_acc: "Genauigkeit", r_words: "Wörter", r_react: "Ø Reaktion", r_record: "Rekord",
    h_fj: "Drücke die leuchtende Taste (F oder J), so schnell du kannst!",
    h_words: "Tippe das angezeigte Wort — Umlaute sind optional.",
    h_aim: "Klicke die Ziele, bevor sie schrumpfen!",
    go: "LOS!", lvl_up: "LEVEL",
  },
  ja: {
    subtitle: "スピード · 精度 · 反射神経",
    play: "プレイ", modes: "モード", difficulty: "難易度", skins: "スキン", maps: "マップ",
    stats: "統計", settings: "設定", back: "戻る",
    mode_fj: "F / J モード", mode_fj_d: "光ったキー（FかJ）を押そう！",
    mode_words: "ワードモード", mode_words_d: "表示される単語を入力しよう。",
    mode_aim: "マウスモード", mode_aim_d: "消える前にターゲットをクリック！",
    word_lang: "単語の言語：",
    d_facile: "イージー", d_normal: "ノーマル", d_difficile: "ハード", d_extreme: "エクストリーム", d_impossible: "インポッシブル",
    dd_facile: "ウォームアップ", dd_normal: "ちょうどいいバランス", dd_difficile: "本気モード",
    dd_extreme: "プロの反射神経が必要", dd_impossible: "健闘を祈る…",
    map_city: "未来都市", map_forest: "森", map_desert: "砂漠", map_ocean: "海",
    map_volcano: "火山", map_temple: "神殿", map_space: "宇宙",
    st_best: "ベストスコア", st_time: "プレイ時間", st_games: "プレイ回数", st_acc: "平均精度",
    st_cps: "最大CPS", st_wpm: "最大WPM", st_records: "モード・難易度別レコード",
    st_reset: "統計をリセット", st_reset_confirm: "すべての統計とレコードを消去しますか？",
    set_volume: "音量", set_lang: "言語", set_fs: "フルスクリーン", set_fx: "視覚効果", set_size: "文字サイズ",
    hud_score: "スコア", hud_time: "時間", hud_combo: "コンボ", hud_acc: "精度", hud_record: "記録", hud_react: "反応",
    sp_tps: "キー/秒", sp_wpm: "WPM", sp_cps: "CPS",
    r_title: "リザルト", r_new: "新記録！", r_replay: "もう一度", r_menu: "メニュー",
    r_score: "最終スコア", r_maxcombo: "最大コンボ", r_hits: "成功", r_errors: "ミス",
    r_acc: "精度", r_words: "入力した単語", r_react: "平均反応", r_record: "記録",
    h_fj: "光っているキー（FかJ）をできるだけ速く押そう！",
    h_words: "表示された単語をローマ字で入力しよう。",
    h_aim: "小さくなる前にターゲットをクリック！",
    go: "GO！", lvl_up: "レベル",
  },
};
const t = (key) => (I18N[save.set.lang] && I18N[save.set.lang][key]) || I18N.fr[key] || key;

/* ============================ 3. SAUVEGARDE ============================= */
const SAVE_KEY = "fjspeed_save_v1";

const defaultSave = () => ({
  set: { vol: 70, lang: "fr", fx: true, size: "m", skin: "neon", map: "city", mode: "fj", diff: "normal", wordLang: "fr" },
  stats: { time: 0, games: 0, accSum: 0, accN: 0, maxCps: 0, maxWpm: 0, best: { fj: 0, words: 0, aim: 0 } },
  records: { fj: {}, words: {}, aim: {} },   // records[mode][difficulté] = score
});

let save = loadSave();

function loadSave() {
  const base = defaultSave();
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (raw) {
      Object.assign(base.set, raw.set);
      Object.assign(base.stats, raw.stats);
      Object.assign(base.stats.best, (raw.stats && raw.stats.best) || {});
      for (const m of MODE_IDS) Object.assign(base.records[m], (raw.records && raw.records[m]) || {});
    }
  } catch (e) { /* sauvegarde corrompue → valeurs par défaut */ }
  return base;
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* stockage indisponible */ }
}

/* =============================== 4. AUDIO =============================== */
/* Tous les sons sont synthétisés avec WebAudio : aucun fichier, 100% hors-ligne. */
const AudioFX = {
  ctx: null, master: null,

  init() {                                   // appelé au premier geste utilisateur
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.setVolume(save.set.vol);
  },
  setVolume(v) { if (this.master) this.master.gain.value = (v / 100) * 0.55; },

  /* Générateur de bip : fréquence, durée, forme d'onde, volume, glissando optionnel */
  tone(freq, dur = 0.08, type = "sine", vol = 0.3, slideTo = 0) {
    if (!this.ctx || save.set.vol === 0) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + dur + 0.02);
  },

  ui()          { this.tone(700, 0.05, "triangle", 0.15); },
  hit(combo)    { this.tone(380 + Math.min(combo, 60) * 9, 0.07, "square", 0.22); },
  error()       { this.tone(150, 0.22, "sawtooth", 0.3, 70); },
  word()        { this.tone(600, 0.07, "triangle", 0.25); this.tone(900, 0.1, "triangle", 0.22); },
  target(combo) { this.tone(500 + Math.min(combo, 40) * 14, 0.06, "sine", 0.3, 900); },
  combo()       { this.tone(660, 0.09, "square", 0.25); setTimeout(() => this.tone(990, 0.12, "square", 0.22), 70); },
  level()       { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, "triangle", 0.25), i * 80)); },
  count()       { this.tone(440, 0.09, "sine", 0.3); },
  go()          { this.tone(880, 0.25, "sine", 0.35); },
  end()         { [784, 659, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, "triangle", 0.25), i * 110)); },
};

/* ============================ 5. PARTICULES ============================= */
const FX = {
  cv: null, ctx: null, W: 0, H: 0,
  ambient: [],     // particules d'ambiance (recyclées)
  bursts: [],      // particules d'explosion (éphémères)
  cfg: AMBIENT.city,
  last: 0,

  init() {
    this.cv = $("#fx-canvas");
    this.ctx = this.cv.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((ts) => this.loop(ts));
  },
  resize() {
    this.W = this.cv.width = window.innerWidth;
    this.H = this.cv.height = window.innerHeight;
  },

  /* Reconstruit l'ambiance quand la map change */
  setMap(mapId) {
    this.cfg = AMBIENT[mapId] || AMBIENT.city;
    this.ambient = [];
    for (let i = 0; i < this.cfg.n; i++) this.ambient.push(this.makeAmbient(true));
  },
  makeAmbient(anywhere) {
    const c = this.cfg;
    const p = {
      x: rand(0, this.W), y: rand(0, this.H),
      size: rand(c.size[0], c.size[1]),
      color: pick(c.colors),
      sway: rand(0, Math.PI * 2),
      speed: rand(c.speed[0], c.speed[1]),
      tw: rand(0.5, 2.5),                 // fréquence de scintillement
    };
    if (!anywhere) {                       // réapparition hors écran selon la direction
      if (c.mode === "rise") p.y = this.H + 10;
      else if (c.mode === "fall") p.y = -10;
      else if (c.mode === "drift") p.x = -10;
    }
    return p;
  },

  /* Explosion de particules (touche réussie, cible touchée, level up) */
  burst(x, y, color, n = 14, power = 1) {
    if (!save.set.fx) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 340) * power;
      this.bursts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        size: rand(1.5, 4), color, life: rand(0.45, 0.9), age: 0,
      });
    }
    if (this.bursts.length > 500) this.bursts.splice(0, this.bursts.length - 500);
  },

  loop(ts) {
    requestAnimationFrame((n) => this.loop(n));
    const dt = Math.min(0.05, (ts - this.last) / 1000 || 0.016);
    this.last = ts;
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    if (!save.set.fx) return;              // effets désactivés → canvas vide

    ctx.globalCompositeOperation = "lighter";
    const time = ts / 1000;

    /* — ambiance — */
    for (let i = 0; i < this.ambient.length; i++) {
      let p = this.ambient[i];
      const m = this.cfg.mode;
      if (m === "rise")       { p.y -= p.speed * dt; p.x += Math.sin(time + p.sway) * 12 * dt; }
      else if (m === "fall")  { p.y += p.speed * dt; p.x += Math.sin(time + p.sway) * 22 * dt; }
      else if (m === "drift") { p.x += p.speed * dt; p.y += Math.sin(time + p.sway) * 8 * dt; }
      else if (m === "float") { p.x += Math.sin(time * 0.7 + p.sway) * 10 * dt; p.y += Math.cos(time * 0.5 + p.sway) * 8 * dt - p.speed * dt * 0.3; }
      /* recyclage hors écran */
      if (p.y < -12 || p.y > H + 12 || p.x < -12 || p.x > W + 12) p = this.ambient[i] = this.makeAmbient(false);
      const alpha = m === "twinkle" ? 0.25 + 0.75 * Math.abs(Math.sin(time * p.tw + p.sway)) : 0.7;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    /* — explosions — */
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const p = this.bursts[i];
      p.age += dt;
      if (p.age >= p.life) { this.bursts.splice(i, 1); continue; }
      p.vy += 480 * dt;                    // gravité
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - p.age / p.life * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  },
};

/* Couleur d'accent actuelle (pour teinter les particules) */
function accentColors() {
  const cs = getComputedStyle(document.body);
  return [cs.getPropertyValue("--ac").trim(), cs.getPropertyValue("--ac2").trim()];
}

/* ============================ 6. INTERFACE ============================== */

function showScreen(name) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
  if (name === "stats") renderStats();
}
function currentScreen() {
  const s = $(".screen.active");
  return s ? s.id.replace("screen-", "") : "menu";
}

/* — flash plein écran (erreur / level-up) — */
function flash(cls) {
  if (!save.set.fx) return;
  const el = $("#flash");
  el.className = "";
  void el.offsetWidth;                     // relance l'animation CSS
  el.classList.add(cls);
}

/* — popup flottant dans la zone de jeu — */
function popup(text, x, y, big = false) {
  const layer = $("#popup-layer");
  const el = document.createElement("div");
  el.className = "popup" + (big ? " big" : "");
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  layer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

/* — application des préférences visuelles — */
function applySkin(id)  { document.body.dataset.skin = id; }
function applyMap(id)   { document.body.dataset.map = id; FX.setMap(id); }
function applyFx(on)    { document.body.classList.toggle("no-fx", !on); }
function applySize(sz)  { document.documentElement.dataset.size = sz; }

function applyLang() {
  document.documentElement.lang = save.set.lang;
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  buildModeCards(); buildDiffCards(); buildMapCards();  // libellés traduits
  renderChips();
  if (currentScreen() === "stats") renderStats();
}

/* — puces récapitulatives sous le menu — */
function renderChips() {
  const skin = SKINS.find((s) => s.id === save.set.skin);
  $("#menu-chips").innerHTML =
    `🎮 <b>${t("mode_" + save.set.mode)}</b> · 🔥 <b>${t("d_" + save.set.diff)}</b><br>` +
    `🎨 <b>${skin ? skin.name : ""}</b> · 🗺️ <b>${t("map_" + save.set.map)}</b>`;
}

/* — construction des écrans de sélection — */
function buildModeCards() {
  $("#modes-list").innerHTML = MODE_IDS.map((m) => `
    <div class="card ${save.set.mode === m ? "sel" : ""}" data-mode="${m}">
      <span class="card-ico">${MODE_ICONS[m]}</span>
      <span class="card-name">${t("mode_" + m)}</span>
      <span class="card-desc">${t("mode_" + m + "_d")}</span>
    </div>`).join("");
  $$("#modes-list .card").forEach((c) => c.addEventListener("click", () => {
    save.set.mode = c.dataset.mode; persist(); AudioFX.ui();
    buildModeCards(); renderChips();
  }));

  /* Chips de langue des mots */
  const langs = [["fr", "Français"], ["en", "English"], ["es", "Español"], ["de", "Deutsch"], ["ja", "日本語"]];
  $("#wordlang-chips").innerHTML = langs.map(([id, name]) =>
    `<button class="chip ${save.set.wordLang === id ? "sel" : ""}" data-wl="${id}">${name}</button>`).join("");
  $$("#wordlang-chips .chip").forEach((c) => c.addEventListener("click", () => {
    save.set.wordLang = c.dataset.wl; persist(); AudioFX.ui(); buildModeCards();
  }));
}

function buildDiffCards() {
  $("#diff-list").innerHTML = DIFF_IDS.map((d) => `
    <div class="card ${save.set.diff === d ? "sel" : ""}" data-diff="${d}">
      <span class="card-name">${t("d_" + d)}</span>
      <span class="diff-flames">${DIFF_FLAMES[d]}</span>
      <span class="card-desc">${t("dd_" + d)}</span>
    </div>`).join("");
  $$("#diff-list .card").forEach((c) => c.addEventListener("click", () => {
    save.set.diff = c.dataset.diff; persist(); AudioFX.ui();
    buildDiffCards(); renderChips();
  }));
}

function buildSkinCards() {
  $("#skins-list").innerHTML = SKINS.map((s) => `
    <div class="card ${save.set.skin === s.id ? "sel" : ""}" data-skin-id="${s.id}">
      <span class="card-name">${s.name}</span>
      <div class="skin-dots">${s.c.map((c) => `<i style="background:${c};color:${c}"></i>`).join("")}</div>
    </div>`).join("");
  $$("#skins-list .card").forEach((c) => c.addEventListener("click", () => {
    save.set.skin = c.dataset.skinId; persist(); AudioFX.ui();
    applySkin(save.set.skin); buildSkinCards(); renderChips();
  }));
}

function buildMapCards() {
  $("#maps-list").innerHTML = MAPS.map((m) => `
    <div class="card ${save.set.map === m.id ? "sel" : ""}" data-map-id="${m.id}">
      <span class="card-ico">${m.emoji}</span>
      <span class="card-name">${t("map_" + m.id)}</span>
      <div class="map-prev" data-m="${m.id}"></div>
    </div>`).join("");
  $$("#maps-list .card").forEach((c) => c.addEventListener("click", () => {
    save.set.map = c.dataset.mapId; persist(); AudioFX.ui();
    applyMap(save.set.map); buildMapCards(); renderChips();
  }));
}

/* — écran statistiques — */
function fmtTime(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + "h " : "") + (h || m ? m + "m " : "") + s + "s";
}
function renderStats() {
  const st = save.stats;
  const best = Math.max(st.best.fj || 0, st.best.words || 0, st.best.aim || 0);
  const avgAcc = st.accN ? (st.accSum / st.accN) : 0;
  const tiles = [
    ["🏆", best, t("st_best")],
    ["⏱️", fmtTime(st.time), t("st_time")],
    ["🎮", st.games, t("st_games")],
    ["🎯", avgAcc.toFixed(1) + "%", t("st_acc")],
    ["⚡", st.maxCps.toFixed(1), t("st_cps")],
    ["📝", Math.round(st.maxWpm), t("st_wpm")],
  ];
  $("#stats-tiles").innerHTML = tiles.map(([i, v, l]) =>
    `<div class="stat-tile"><span class="st-ico">${i}</span><span class="st-val">${v}</span><span class="st-lab">${l}</span></div>`).join("");

  /* tableau des records mode × difficulté */
  let html = "<tr><th></th>" + DIFF_IDS.map((d) => `<th>${t("d_" + d)}</th>`).join("") + "</tr>";
  for (const m of MODE_IDS) {
    html += `<tr><td>${MODE_ICONS[m]} ${t("mode_" + m)}</td>` +
      DIFF_IDS.map((d) => `<td class="rec-val">${save.records[m][d] || "—"}</td>`).join("") + "</tr>";
  }
  $("#records-table").innerHTML = html;
}

/* — paramètres — */
function bindSettings() {
  const vol = $("#set-volume");
  vol.value = save.set.vol;
  $("#volume-val").textContent = save.set.vol + "%";
  vol.addEventListener("input", () => {
    save.set.vol = +vol.value; persist();
    $("#volume-val").textContent = save.set.vol + "%";
    AudioFX.setVolume(save.set.vol);
  });
  vol.addEventListener("change", () => AudioFX.ui());

  const lang = $("#set-lang");
  lang.value = save.set.lang;
  lang.addEventListener("change", () => { save.set.lang = lang.value; persist(); applyLang(); AudioFX.ui(); });

  /* plein écran (non persistant : nécessite un geste utilisateur) */
  const fs = $("#set-fs");
  fs.addEventListener("click", () => {
    AudioFX.ui();
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener("fullscreenchange", () => {
    const on = !!document.fullscreenElement;
    fs.classList.toggle("on", on);
    fs.setAttribute("aria-checked", on);
  });

  const fx = $("#set-fx");
  const syncFx = () => { fx.classList.toggle("on", save.set.fx); fx.setAttribute("aria-checked", save.set.fx); };
  syncFx();
  fx.addEventListener("click", () => { save.set.fx = !save.set.fx; persist(); applyFx(save.set.fx); syncFx(); AudioFX.ui(); });

  const sizeSeg = $("#set-size");
  const syncSize = () => $$("#set-size button").forEach((b) => b.classList.toggle("sel", b.dataset.size === save.set.size));
  syncSize();
  sizeSeg.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    save.set.size = b.dataset.size; persist(); applySize(save.set.size); syncSize(); AudioFX.ui();
  });

  $("#btn-reset-stats").addEventListener("click", () => {
    if (!confirm(t("st_reset_confirm"))) return;
    const fresh = defaultSave();
    save.stats = fresh.stats; save.records = fresh.records;
    persist(); renderStats(); AudioFX.ui();
  });
}

/* =========================== 7. MOTEUR DE JEU =========================== */
const Game = {
  mode: "fj", cfg: null,
  running: false, pending: false,          // pending = compte à rebours en cours
  t0: 0, dur: 30, elapsed: 0,
  score: 0, combo: 0, maxCombo: 0, hits: 0, errors: 0,
  level: 1, prog: 0, goal: 10,
  cdTimers: [],
  lastHud: 0,

  start(mode) {
    this.mode = mode;
    this.cfg = DIFFS[save.set.diff][mode];
    this.dur = this.cfg.time;
    this.running = false; this.pending = true;
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hits = 0; this.errors = 0;
    this.level = 1; this.prog = 0; this.elapsed = 0;

    /* affiche la bonne zone de jeu */
    $("#fj-area").classList.toggle("on", mode === "fj");
    $("#words-area").classList.toggle("on", mode === "words");
    $("#aim-area").classList.toggle("on", mode === "aim");
    if (mode === "aim") document.body.dataset.aim = "1"; else delete document.body.dataset.aim;

    /* libellés du HUD selon le mode */
    $("#hud-speed-label").textContent = t(mode === "fj" ? "sp_tps" : mode === "words" ? "sp_wpm" : "sp_cps");
    $("#game-hint").textContent = t("h_" + mode);
    $("#game-hint").style.opacity = 1;
    $("#hud-record").textContent = save.records[mode][save.set.diff] || 0;
    $("#hud-record").classList.remove("beat");
    $("#hud-react").textContent = "—";

    Modes[mode].setup();
    this.goal = Modes[mode].goal();
    this.updateHud(); this.updateProgress();
    showScreen("game");
    this.countdown(() => this.begin());
  },

  /* compte à rebours 3-2-1-GO (annulable) */
  countdown(cb) {
    const el = $("#countdown");
    el.classList.add("show");
    const steps = ["3", "2", "1", t("go")];
    steps.forEach((txt, i) => {
      this.cdTimers.push(setTimeout(() => {
        el.textContent = txt;
        el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
        if (i < 3) AudioFX.count(); else AudioFX.go();
      }, i * 650));
    });
    this.cdTimers.push(setTimeout(() => { el.classList.remove("show"); cb(); }, 3 * 650 + 550));
  },
  cancelCountdown() {
    this.cdTimers.forEach(clearTimeout);
    this.cdTimers = [];
    $("#countdown").classList.remove("show");
  },

  begin() {
    this.pending = false;
    this.running = true;
    this.t0 = performance.now();
    Modes[this.mode].begin();
    setTimeout(() => { $("#game-hint").style.opacity = 0; }, 2500);
    requestAnimationFrame((ts) => this.tick(ts));
  },

  tick(ts) {
    if (!this.running) return;
    this.elapsed = (ts - this.t0) / 1000;
    const left = this.dur - this.elapsed;
    if (left <= 0) { this.elapsed = this.dur; this.end(); return; }
    if (Modes[this.mode].update) Modes[this.mode].update(ts);
    if (ts - this.lastHud > 90) { this.lastHud = ts; this.updateHud(left); }
    requestAnimationFrame((n) => this.tick(n));
  },

  /* — réussite commune : points, combo, progression, effets — */
  good(points, x, y) {
    this.hits++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += Math.round(points * (1 + Math.min(this.combo, 100) * 0.02));
    /* jalons de combo */
    if ([10, 25, 50, 100, 200].includes(this.combo)) {
      popup(`COMBO ×${this.combo}`, x, y - 46, true);
      AudioFX.combo();
    }
    FX.burst(x + $("#game-area").getBoundingClientRect().left, y + $("#game-area").getBoundingClientRect().top, pick(accentColors()), 12);
    /* record battu en direct */
    const rec = save.records[this.mode][save.set.diff] || 0;
    if (rec && this.score > rec) $("#hud-record").classList.add("beat");
    this.addProg(1);
    this.updateHud();
  },

  /* — erreur commune : combo brisé, pénalité, effets — */
  bad() {
    this.errors++;
    this.combo = 0;
    this.score = Math.max(0, this.score - this.cfg.penalty);
    flash("err");
    const area = $("#game-area");
    area.classList.remove("shake"); void area.offsetWidth; area.classList.add("shake");
    AudioFX.error();
    this.updateHud();
  },

  addProg(n) {
    this.prog += n;
    if (this.prog >= this.goal) {
      this.prog = 0;
      this.level++;
      this.score += Math.round(50 * this.cfg.mult * this.level);
      flash("lvl");
      AudioFX.level();
      const r = $("#game-area").getBoundingClientRect();
      popup(`${t("lvl_up")} ${this.level} !`, r.width / 2, r.height / 2, true);
      FX.burst(r.left + r.width / 2, r.top + r.height / 2, accentColors()[0], 30, 1.4);
      if (Modes[this.mode].levelUp) Modes[this.mode].levelUp(this.level);
      this.goal = Modes[this.mode].goal();
    }
    this.updateProgress();
  },

  accuracy() {
    const total = this.hits + this.errors;
    return total ? (this.hits / total) * 100 : 100;
  },

  updateHud(left) {
    $("#hud-score").textContent = this.score;
    $("#hud-time").textContent = Math.max(0, left !== undefined ? left : this.dur - this.elapsed).toFixed(1);
    const combo = $("#hud-combo");
    combo.textContent = this.combo;
    combo.classList.toggle("hot", this.combo >= 10);
    $("#hud-acc").textContent = this.accuracy().toFixed(0) + "%";
    $("#hud-speed").textContent = Modes[this.mode].speed().toFixed(1);
  },
  updateProgress() {
    $("#progress-bar").style.width = clamp((this.prog / this.goal) * 100, 0, 100) + "%";
    $("#progress-level").textContent = "LVL " + this.level;
  },

  end() {
    this.running = false;
    Modes[this.mode].cleanup();
    AudioFX.end();
    finishGame();                          // stats + écran de résultats
  },

  quit() {                                 // abandon : ni stats ni record
    this.cancelCountdown();
    this.pending = false;
    if (this.running) { this.running = false; Modes[this.mode].cleanup(); }
    showScreen("menu");
  },
};

/* =============================== 8. MODES =============================== */

/* ---------- Mode F / J ---------- */
const FJ = {
  expected: "f",
  runLen: 1,                               // répétitions consécutives de la même touche
  times: [],                               // horodatages des frappes (vitesse glissante)

  setup() {
    this.expected = Math.random() < 0.5 ? "f" : "j";   // première touche aléatoire
    this.runLen = 1;
    this.times = [];
    this.syncKeys();
  },
  begin() { this.syncKeys(); },

  /* Touche suivante : tirage aléatoire — la séquence varie (f j j f f f j…)
     au lieu d'une alternance stricte ; jamais plus de 4 fois la même touche */
  nextKey() {
    if (this.runLen >= 4 || Math.random() < 0.5) {
      this.expected = this.expected === "f" ? "j" : "f";
      this.runLen = 1;
    } else {
      this.runLen++;
    }
  },
  cleanup() { $$(".key").forEach((k) => k.classList.remove("expected", "pressed", "wrong")); },
  goal() { return Math.round(Game.cfg.goal * Math.pow(1.15, Game.level - 1)); },

  /* vitesse : frappes des 2 dernières secondes */
  speed() {
    const now = performance.now();
    this.times = this.times.filter((t0) => now - t0 < 2000);
    return this.times.length / 2;
  },

  syncKeys() {
    $("#key-f").classList.toggle("expected", this.expected === "f");
    $("#key-j").classList.toggle("expected", this.expected === "j");
    $("#fj-arrow").textContent = this.expected === "f" ? "◀" : "▶";
  },

  press(k) {
    if (!Game.running) return;
    /* une lettre autre que F/J compte comme une erreur, signalée sur la touche attendue */
    const el = $("#key-" + (k === "f" || k === "j" ? k : this.expected));
    const rArea = $("#game-area").getBoundingClientRect();
    const rKey = el.getBoundingClientRect();
    const x = rKey.left - rArea.left + rKey.width / 2;
    const y = rKey.top - rArea.top + rKey.height / 2;

    el.classList.remove("pressed", "wrong"); void el.offsetWidth;

    if (k === this.expected) {
      el.classList.add("pressed");
      setTimeout(() => el.classList.remove("pressed"), 90);
      this.times.push(performance.now());
      this.nextKey();
      this.syncKeys();
      AudioFX.hit(Game.combo);
      Game.good(10 * Game.cfg.mult, x, y);
    } else {
      el.classList.add("wrong");
      setTimeout(() => el.classList.remove("wrong"), 300);
      Game.bad();
    }
  },

  results() {
    const avgTps = Game.elapsed ? Game.hits / Game.elapsed : 0;
    return {
      speedStat: avgTps,                   // alimente le CPS max global
      rows: [
        [t("r_maxcombo"), Game.maxCombo],
        [t("r_hits"), Game.hits],
        [t("r_errors"), Game.errors],
        [t("r_acc"), Game.accuracy().toFixed(1) + "%"],
        [t("sp_tps"), avgTps.toFixed(2)],
      ],
    };
  },
};

/* ---------- Mode Mots ---------- */
const Words = {
  word: "", disp: "", pos: 0,
  correctChars: 0, wordsDone: 0, lastWord: "",

  setup() {
    this.pos = 0; this.correctChars = 0; this.wordsDone = 0; this.lastWord = "";
    this.bag = null;                       // re-mélange à chaque partie (langue/difficulté à jour)
    $("#word-kana").textContent = "";
    $("#word-letters").innerHTML = "";
  },
  begin() { this.next(); this.focus(); },
  cleanup() { $("#word-input").blur(); },
  goal() { return 8; },                    // 8 mots par niveau

  focus() { $("#word-input").focus({ preventScroll: true }); },

  /* WPM standard : (caractères corrects / 5) par minute */
  speed() {
    const min = Game.elapsed / 60;
    return min > 0.02 ? (this.correctChars / 5) / min : 0;
  },

  /* Remplit un « sac » mélangé (Fisher-Yates) avec tous les mots adaptés
     à la difficulté : aucun mot ne peut revenir avant que le sac soit vide */
  refillBag() {
    const [lo, hi] = Game.cfg.len;
    const list = WORDS[save.set.wordLang] || WORDS.fr;
    const norm = list.map((w) => (typeof w === "string" ? { k: "", r: w } : w));
    let pool = norm.filter((w) => fold(w.r).length >= lo && fold(w.r).length <= hi);
    if (!pool.length) pool = norm.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    /* le nouveau sac ne doit pas commencer par le mot qui vient d'être tapé */
    if (pool.length > 1 && pool[0].r === this.lastWord) [pool[0], pool[1]] = [pool[1], pool[0]];
    this.bag = pool;
  },

  /* pioche le mot suivant dans le sac */
  next() {
    if (!this.bag || !this.bag.length) this.refillBag();
    const w = this.bag.shift();
    this.lastWord = w.r;
    this.disp = w.k || w.r;                // kana pour le japonais, sinon le mot
    this.word = fold(w.r);                 // cible réellement tapée (sans accents)
    this.pos = 0;

    $("#word-kana").textContent = w.k;
    const letters = $("#word-letters");
    letters.innerHTML = "";
    /* le japonais affiche le romaji à taper sous le kana ; les autres langues
       affichent le mot original (accents inclus) — la frappe est comparée sans accents */
    for (const ch of w.r) {
      const s = document.createElement("span");
      s.textContent = ch;
      letters.appendChild(s);
    }
    letters.classList.remove("pop"); void letters.offsetWidth; letters.classList.add("pop");
    this.paint();
  },

  paint() {
    $$("#word-letters span").forEach((s, i) => {
      s.classList.toggle("done", i < this.pos);
      s.classList.toggle("cur", i === this.pos);
    });
  },

  char(ch) {
    if (!Game.running) return;
    ch = fold(ch);
    if (!/^[a-z0-9]$/.test(ch)) return;    // ignore espaces & ponctuation
    const spans = $$("#word-letters span");
    const rArea = $("#game-area").getBoundingClientRect();
    const cur = spans[this.pos];
    const rc = cur ? cur.getBoundingClientRect() : rArea;
    const x = rc.left - rArea.left + rc.width / 2;
    const y = rc.top - rArea.top;

    if (ch === this.word[this.pos]) {
      this.pos++;
      this.correctChars++;
      AudioFX.hit(Game.combo);
      this.paint();
      if (this.pos >= this.word.length) {  // mot terminé
        this.wordsDone++;
        AudioFX.word();
        Game.good(this.word.length * 12 * Game.cfg.mult, x, y);
        popup("+" + this.word.length * 12, x, y);
        this.next();
      } else {
        Game.hits++;                       // frappe correcte (précision)
        Game.updateHud();
      }
    } else {
      if (cur) { cur.classList.remove("bad"); void cur.offsetWidth; cur.classList.add("bad"); }
      Game.bad();
    }
  },

  results() {
    const wpm = this.speed();
    return {
      wpm,
      rows: [
        [t("sp_wpm"), wpm.toFixed(1)],
        [t("r_words"), this.wordsDone],
        [t("r_errors"), Game.errors],
        [t("r_acc"), Game.accuracy().toFixed(1) + "%"],
        [t("r_maxcombo"), Game.maxCombo],
      ],
    };
  },
};

/* ---------- Mode Souris (Aim Trainer) ---------- */
const Aim = {
  targets: [], clicks: 0, targetHits: 0, expired: 0,
  reactSum: 0, size: 60, life: 1500,

  setup() {
    this.targets = []; this.clicks = 0; this.targetHits = 0;
    this.expired = 0; this.reactSum = 0;
    this.size = Game.cfg.size; this.life = Game.cfg.life;
    $("#aim-area").innerHTML = "";
  },
  begin() { for (let i = 0; i < Game.cfg.conc; i++) this.spawn(); },
  cleanup() { this.targets.forEach((tg) => tg.el.remove()); this.targets = []; },
  goal() { return 5; },                    // 5 cibles touchées par niveau

  speed() { return Game.elapsed > 0.2 ? this.clicks / Game.elapsed : 0; },

  /* chaque niveau : cibles plus petites et plus éphémères */
  levelUp() {
    const c = Game.cfg;
    this.size = Math.max(c.min, this.size - (c.size - c.min) / 7);
    this.life = Math.max(c.minLife, this.life - (c.life - c.minLife) / 7);
  },

  spawn() {
    const area = $("#aim-area");
    const rect = area.getBoundingClientRect();
    if (rect.width < 10) return;
    const r = this.size / 2;
    let x = 0, y = 0;
    /* évite de superposer les cibles existantes (5 essais max) */
    for (let tries = 0; tries < 5; tries++) {
      x = rand(r + 8, rect.width - r - 8);
      y = rand(r + 8, rect.height - r - 8);
      if (this.targets.every((tg) => Math.hypot(tg.x - x, tg.y - y) > r * 2.2)) break;
    }
    const el = document.createElement("div");
    el.className = "target";
    el.style.width = el.style.height = this.size + "px";
    el.style.left = x + "px";
    el.style.top = y + "px";
    area.appendChild(el);
    this.targets.push({ el, x, y, born: performance.now(), life: this.life });
  },

  /* rétrécissement progressif ; cible expirée = erreur */
  update(now) {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const tg = this.targets[i];
      const k = 1 - (now - tg.born) / tg.life;
      if (k <= 0) {
        tg.el.remove();
        this.targets.splice(i, 1);
        this.expired++;
        Game.bad();
        this.spawn();
      } else {
        tg.el.style.transform = `translate(-50%,-50%) scale(${0.5 + 0.5 * k})`;
      }
    }
  },

  click(e) {
    if (!Game.running) return;
    this.clicks++;
    const area = $("#aim-area").getBoundingClientRect();
    const el = e.target.closest(".target");
    if (el) {
      const i = this.targets.findIndex((tg) => tg.el === el);
      if (i === -1) return;
      const tg = this.targets.splice(i, 1)[0];
      const react = performance.now() - tg.born;
      this.reactSum += react;
      this.targetHits++;
      el.remove();
      AudioFX.target(Game.combo);
      Game.good(60 * Game.cfg.mult, tg.x, tg.y + 40);
      popup(Math.round(react) + " ms", tg.x, tg.y);
      $("#hud-react").textContent = Math.round(this.reactSum / this.targetHits) + " ms";
      this.spawn();
    } else {
      Game.bad();
    }
  },

  results() {
    const cps = this.speed();
    const avgReact = this.targetHits ? Math.round(this.reactSum / this.targetHits) : 0;
    return {
      speedStat: cps,
      rows: [
        [t("r_hits"), this.targetHits],
        [t("r_errors"), Game.errors],
        [t("r_react"), avgReact + " ms"],
        [t("r_acc"), Game.accuracy().toFixed(1) + "%"],
        [t("sp_cps"), cps.toFixed(2)],
        [t("r_maxcombo"), Game.maxCombo],
      ],
    };
  },
};

const Modes = { fj: FJ, words: Words, aim: Aim };

/* ==================== 9. RÉSULTATS & STATISTIQUES ======================= */
function finishGame() {
  const mode = Game.mode, diff = save.set.diff;
  const res = Modes[mode].results();
  const st = save.stats;

  /* — statistiques globales — */
  st.games++;
  st.time += Game.elapsed;
  st.accSum += Game.accuracy();
  st.accN++;
  if (res.speedStat) st.maxCps = Math.max(st.maxCps, res.speedStat);
  if (res.wpm) st.maxWpm = Math.max(st.maxWpm, res.wpm);
  st.best[mode] = Math.max(st.best[mode] || 0, Game.score);

  /* — record mode × difficulté — */
  const old = save.records[mode][diff] || 0;
  const isRecord = Game.score > old;
  if (isRecord) save.records[mode][diff] = Game.score;
  persist();

  /* — écran de résultats — */
  $("#new-record").classList.toggle("hidden", !isRecord);
  const rows = [
    `<div class="res-box main"><span class="res-val">${Game.score}</span><span class="res-lab">${t("r_score")}</span></div>`,
    ...res.rows.map(([l, v]) => `<div class="res-box"><span class="res-val">${v}</span><span class="res-lab">${l}</span></div>`),
    `<div class="res-box"><span class="res-val">${save.records[mode][diff] || 0}</span><span class="res-lab">${t("r_record")} · ${t("d_" + diff)}</span></div>`,
  ];
  $("#results-grid").innerHTML = rows.join("");
  showScreen("results");
  if (isRecord) {
    const r = $("#screen-results").getBoundingClientRect();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => FX.burst(rand(r.width * .2, r.width * .8), rand(r.height * .2, r.height * .5), pick(accentColors()), 24, 1.3), i * 180);
    }
  }
}

/* ================= 10. ENTRÉES GLOBALES & INITIALISATION ================ */
function bindInputs() {
  /* Navigation par boutons [data-nav] */
  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (!nav) return;
    AudioFX.ui();
    const dest = nav.dataset.nav;
    if (dest === "play") Game.start(save.set.mode);
    else showScreen(dest);
  });

  $("#btn-quit").addEventListener("click", () => { AudioFX.ui(); Game.quit(); });
  $("#btn-replay").addEventListener("click", () => { AudioFX.ui(); Game.start(Game.mode); });

  /* Touches F / J cliquables (mobile / tactile) */
  $$(".key").forEach((k) => k.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (Game.running && Game.mode === "fj") FJ.press(k.dataset.key);
  }));

  /* Zone aim : clics / touchers */
  $("#aim-area").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (Game.running && Game.mode === "aim") Aim.click(e);
  });
  $("#game-area").addEventListener("contextmenu", (e) => e.preventDefault());

  /* Saisie du mode Mots via champ caché (gère aussi les claviers mobiles) */
  const wi = $("#word-input");
  wi.addEventListener("input", (e) => {
    if (Game.running && Game.mode === "words" && e.inputType === "insertText" && e.data) {
      for (const ch of e.data) Words.char(ch);
    }
    wi.value = "";
  });
  /* si le champ perd le focus en cours de partie, on le reprend */
  wi.addEventListener("blur", () => {
    if (Game.running && Game.mode === "words") setTimeout(() => Words.focus(), 0);
  });

  /* Clavier global */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (Game.running || Game.pending) { Game.quit(); return; }
      if (currentScreen() !== "menu") { showScreen("menu"); return; }
    }
    if (e.repeat) return;

    /* Entrée sur l'écran de résultats = rejouer (sauf si un bouton a le focus : son clic natif suffit) */
    if (currentScreen() === "results" && e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      Game.start(Game.mode);
      return;
    }

    if (Game.mode === "fj" && (Game.running || Game.pending)) {
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k)) {
        e.preventDefault();
        if (Game.running) FJ.press(k);     // toute lettre ≠ attendue = erreur
      }
    } else if (Game.mode === "words" && Game.running) {
      /* secours si le champ caché n'a pas le focus (la frappe passerait sinon inaperçue) */
      if (document.activeElement !== wi && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        Words.char(e.key);
        Words.focus();
      }
      if (e.key === " ") e.preventDefault(); // pas de défilement
    }
  });

  /* Le son WebAudio doit être débloqué par un geste utilisateur */
  const unlock = () => { AudioFX.init(); };
  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("keydown", unlock, { once: true });
}

function init() {
  /* applique les préférences sauvegardées */
  applySkin(save.set.skin);
  applyMap(save.set.map);
  applyFx(save.set.fx);
  applySize(save.set.size);

  FX.init();
  FX.setMap(save.set.map);

  buildModeCards();
  buildDiffCards();
  buildSkinCards();
  buildMapCards();
  bindSettings();
  bindInputs();
  applyLang();
}

document.addEventListener("DOMContentLoaded", init);
