/* =====================================================================
   SNOW JUMP – kommentierte & aufgeräumte Version
   Aufbau:
     1. Grundlagen   (Hilfsfunktionen, Speicherstand, Waffen, Sound)
     2. Spielzustand (Variablen, reset, Hilfsfunktionen für Aktionen)
     3. update()     (Spiellogik pro Frame)
     4. Zeichnen     (Hintergrund, Objekte, HUD)
     5. Eingaben, Menüs, Hauptschleife
     6. Roulette
     7. Plinko
     8. Shop
   ===================================================================== */


/* =====================================================================
   1. GRUNDLAGEN
   ===================================================================== */

const $ = id => document.getElementById(id);   // Kurzform für getElementById
const canvas = $("c");                         // Haupt-Canvas des Spiels
const ctx = canvas.getContext("2d");           // Zeichenkontext fürs Spiel

const W = 600;           // Breite der Spielfläche (Pixel)
const H = 900;           // Höhe der Spielfläche (Pixel)
const GY = 780;          // Y-Position des Bodens/der Straße
const FLOOR = GY - 8;    // Tiefster Punkt, an dem der Vogel landen kann
const BIRD_R = 16;       // Kollisionsradius des Vogels
const FULL = Math.PI * 2; // Voller Kreis (für ctx.arc / ellipse)

// Zufallszahl zwischen min und max
const rnd = (min, max) => min + Math.random() * (max - min);
// Begrenzt einen Wert auf den Bereich min..max
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// --- Speicherstand (localStorage) -------------------------------------

// Liest eine Zahl aus dem localStorage, sonst den Standardwert (stürzt nicht ab, wenn gesperrt)
const load = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : +value;
  } catch {
    return fallback;
  }
};

// Schreibt einen Wert in den localStorage (Fehler werden ignoriert)
const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Spiel läuft auch ohne Speicher weiter
  }
};

let coins = load("fc_coins", 0); // Gesamtmünzen (Startwert 100)
let best = load("fc_best", 0);
const set = { master: load("fc_vm", 1), music: load("fc_vmu", .7), sfx: load("fc_vsfx", 1), gfx: load("fc_gfx", 1) }; // Einstellungen
let muted = load("fc_mute", 0) === 1;   // Stumm-Schalter
let musicFlag = false; // true, solange ein Musikton gespielt wird     // Highscore

// Inventar: Besitz, Munition, aktive Waffe, Anzahl Eisbonbon (Slow-Mo)n
let inv;
try {
  inv = JSON.parse(localStorage.getItem("fc_s")); // gespeichertes Inventar laden
} catch {
  inv = null;
}
inv = inv || {
  own: {}, ammo: {}, cur: "",   // Start: keine Waffen, keine Munition
  bottles: 0          // Eisbonbon (Slow-Mo)n im Besitz
};

inv.fish = inv.fish || 0;   // Fische (Währung für Saisonwaffen)
const saveInv = () => save("fc_s", JSON.stringify(inv)); // Inventar speichern

// --- Waffen -----------------------------------------------------------
// cooldown = Sekunden zwischen Schüssen, damage = Schaden (wird aktuell nicht ausgewertet),
// bulletSpeed = Kugeltempo, length = Lauflänge (Optik), price = Kaufpreis,
// packSize/packPrice = Munitionspaket (Menge/Preis), pierce = durchschlägt Gegner
const WEAPONS = {
  ak:   { name: "AK-47",   icon: "🔫", cooldown: .13,  damage: 1, bulletSpeed: 700,  length: 30, price: 0,    packSize: 30,  packPrice: 30 },
  mp:   { name: "MP5",     icon: "🔫", cooldown: .07,  damage: 1, bulletSpeed: 760,  length: 22, price: 300,  packSize: 60,  packPrice: 45 },
  snip: { name: "Sniper",  icon: "🎯", cooldown: .9,   damage: 3, bulletSpeed: 1400, length: 42, price: 700,  packSize: 5,   packPrice: 40, pierce: 1 },
  mini: { name: "Minigun", icon: "⚙️", cooldown: .035, damage: 1, bulletSpeed: 800,  length: 36, price: 1500, packSize: 200, packPrice: 120 }
};

Object.assign(WEAPONS.ak,{damage:2,mag:30}); Object.assign(WEAPONS.mp,{damage:1,mag:30});
Object.assign(WEAPONS.snip,{damage:6,mag:5}); Object.assign(WEAPONS.mini,{damage:1,mag:100});
// Saisonale Waffen
WEAPONS.ice={name:"Eis-MG",icon:"❄️",cooldown:.09,damage:2,bulletSpeed:850,length:28,price:900,packSize:120,packPrice:70,mag:40};
WEAPONS.lava={name:"Lava-Werfer",icon:"🌋",cooldown:.35,damage:5,bulletSpeed:600,length:34,price:1800,packSize:30,packPrice:90,mag:10};
// Balancing: kleine Magazine, teure Munition in kleinen Paketen, höhere Waffenpreise
Object.assign(WEAPONS.ak,   { mag: 20, packSize: 15, packPrice: 45 });
Object.assign(WEAPONS.mp,   { mag: 20, price: 1500, packSize: 20, packPrice: 60 });
Object.assign(WEAPONS.snip, { mag: 4, price: 3500, packSize: 4, packPrice: 60 });
Object.assign(WEAPONS.mini, { mag: 20, price: 6000, packSize: 30, packPrice: 150 });
Object.assign(WEAPONS.ice,  { mag: 20, price: 4000, packSize: 20, packPrice: 90 });
Object.assign(WEAPONS.lava, { mag: 8, price: 8000, packSize: 8, packPrice: 120 });
// rocket = Raketenwerfer (Flächenschaden), life = Reichweite in Sekunden
WEAPONS.rpg = { name: "RPG", icon: "🚀", cooldown: 1.2, damage: 8, bulletSpeed: 520, length: 40, price: 7000, packSize: 2, packPrice: 150, mag: 1, rocket: 1 };
WEAPONS.flame = { name: "Flammenwerfer", icon: "🔥", cooldown: .06, damage: 1, bulletSpeed: 420, length: 30, price: 9000, packSize: 15, packPrice: 130, mag: 20, pierce: 1, life: .4 };
WEAPONS.ice.fish = 8; WEAPONS.lava.fish = 14; WEAPONS.flame.fish = 18;   // Preise in Fischen (Kampagne)
WEAPONS.ice.freeze = 1; WEAPONS.lava.burn = 1; WEAPONS.flame.burn = 1;   // Eis friert ein, Feuer brennt
// Arsenal-Reihenfolge und Freischalt-Level (Level = 1 + Rekord / 4)
const ORDERW = ["ak", "mp", "ice", "snip", "flame", "rpg", "lava", "mini"];
WEAPONS.ak.name = "Pistole";
ORDERW.forEach((k, i) => { WEAPONS[k].level = 1 + 2 * i; });
let xp = load("fc_xp", 0);   // gesammelte Erfahrung
// Level aus XP: Level 1 braucht 30 XP, jedes weitere Level 15 XP mehr
function lvlInfo() {
  let l = 1, r = xp, n = 30;
  while (r >= n) { r -= n; l++; n = 30 + 15 * (l - 1) + 6 * (l - 1) * (l - 1); }   // später wird es immer zäher
  return { l, r, n };
}
const playerLevel = () => lvlInfo().l;
// Aktualisiert Level-Balken im Hauptmenü
function lvlUI() {
  const i = lvlInfo();
  $("lvlFill").style.width = (100 * i.r / i.n) + "%";
  $("lvlNum").textContent = "LVL " + i.l;
  $("lvlTxt").textContent = i.r + " / " + i.n;
}
// XP vergeben (Level-Up-Jingle)
function xpGain(n) {
  if (gameMode === "Rangliste") return;   // Rangliste: keine XP
  const before = playerLevel();
  xp += n; save("fc_xp", xp); lvlUI();
  if (playerLevel() > before) {   // Level-Up-Fanfare
    lvlPop = 2.2;
    payLevels();
    [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => beep(f, .25, "square", .05, f * 1.01), i * 70));
    setTimeout(() => { [523, 659, 784, 1047].forEach(f => beep(f, .9, "triangle", .07)); noise(.5, 7000, .12); }, 560);
  }
}
// "Tagesangebot": aus dem Datum wird eine Zahl gebildet, die täglich eine andere Waffe wählt
const today = new Date();
const seed = today.getFullYear() * 372 + today.getMonth() * 31 + today.getDate();
const DAILY_WEAPON = ["mp", "snip", "mini"][seed % 3];

let shopTab = "A";   // aktiver Shop-Reiter: "A" = Arsenal, "D" = Heute
let audioCtx;        // Web-Audio-Kontext (wird beim ersten Ton erstellt)

// Speichert die Münzen und aktualisiert alle Münz-/Rekordanzeigen im HTML
function wallet() {
  if (coins < 0) coins = 0;
  save("fc_coins", coins);
  $("mCoins").textContent = coins;
  $("cCoins").textContent = coins;
  $("sCoins").textContent = coins;
  $("mBest").textContent = best;
}

// --- Sound (Web Audio API, keine Audiodateien nötig) -------------------

// Spielt einen Ton: Frequenz, Dauer, Wellenform, Lautstärke, optional gleitend zu endFreq
function beep(freq, duration = .1, type = "square", volume = .05, endFreq = 0) {
  try {
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();            // beim ersten Aufruf erstellen
    const osc = audioCtx.createOscillator();              // Tongenerator
    const gain = audioCtx.createGain();                   // Lautstärkeregler
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (endFreq) {                                        // Tonhöhe gleitet zum Zielwert
      osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume * (musicFlag ? set.music : set.sfx) * set.master * (muted ? 0 : 1), audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); // ausblenden
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // Sound ist optional
  }
}

// Erzeugt ein Rauschen (für Schüsse/Effekte): Dauer, Filter-Frequenz, Lautstärke
function noise(duration, freq, volume) {
  try {
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const length = audioCtx.sampleRate * duration | 0;    // Anzahl Samples
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length); // Zufallswerte, die leiser werden
    }
    const source = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();         // Tiefpass macht den Klang dumpfer
    const gain = audioCtx.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = freq;
    gain.gain.value = volume * set.sfx * set.master * (muted ? 0 : 1);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
  } catch {
    // Sound ist optional
  }
}

// Schussgeräusch passend zur Waffe (Rauschen + tiefer Ton)
function gunSound(key) {
  if (key === "snip") {
    noise(.5, 900, .5);
    beep(70, .4, "sawtooth", .12, 30);
  } else if (key === "mini") {
    noise(.05, 3000, .2);
    beep(150, .04, "square", .05, 90);
  } else if (key === "mp") {
    noise(.07, 2800, .25);
    beep(190, .06, "sawtooth", .06, 90);
  } else {                                                // AK-47
    noise(.12, 2000, .35);
    beep(130, .1, "sawtooth", .09, 50);
  }
}

// Wasser-Plop beim Auftauchen von Schneemobil/Fisch
function plop() { beep(300, .12, "sine", .08, 750); noise(.08, 1500, .1); }
// Slow-Mo-Start: Whoosh nach unten
function slowSound() { noise(.6, 600, .3); beep(500, .7, "sine", .08, 60); }

// Musik: 4 Takte à 8 Achtel. lead = Melodie (MIDI-Noten, 0 = Pause), roots = Basstöne je Takt
const mf = m => 440 * Math.pow(2, (m - 69) / 12);   // MIDI-Note → Frequenz
const TUNES = {
  lobby:  { bpm: 84,  w: "sine",     v: .05, roots: [48, 41, 45, 43],
            lead: [72,0,76,79,0,76,74,0, 72,0,77,81,0,77,76,0, 76,0,81,79,0,76,72,0, 74,0,79,83,0,79,74,0] },
  game:   { bpm: 150, w: "triangle", v: .05, roots: [45, 41, 48, 43],
            lead: [69,72,76,72,81,76,72,76, 69,72,77,72,81,77,72,77, 72,76,79,76,84,79,76,79, 71,74,79,74,83,79,74,79] },
  slow:   { bpm: 60,  w: "sine",     v: .06, roots: [38, 34, 41, 36],
            lead: [62,0,0,65,0,0,69,0, 62,0,0,65,0,0,70,0, 65,0,0,69,0,0,72,0, 64,0,0,67,0,0,72,0] },
  casino: { bpm: 120, w: "triangle", v: .04, roots: [38, 43, 36, 45],
            lead: [69,0,72,74,0,72,69,0, 71,0,74,77,0,74,71,0, 72,0,76,79,0,76,72,0, 73,0,76,79,0,76,73,0] }
};
let tune = "", tuneI = 0, tuneTimer = 0;
// Startet ein Stück ("" = Stille)
function setMusic(kind) {
  if (kind === tune) return;
  tune = kind; tuneI = 0; clearInterval(tuneTimer);
  const m = TUNES[kind];
  if (!m) return;
  const step = 30 / m.bpm;                                       // Länge einer Achtel in Sekunden
  tuneTimer = setInterval(() => {
    const i = tuneI++ % 32, note = m.lead[i], root = m.roots[i >> 3];
    musicFlag = true;
    if (note) beep(mf(note), step * 1.7, m.w, m.v);              // Melodie
    if (i % 4 === 0) beep(mf(root - 12 + (i % 8 === 4 ? 7 : 0)), step * 3, "sine", m.v * 1.6); // Bass
    musicFlag = false;
  }, step * 1000);
}

// Prüft, ob ein Klick/Touch im Bereich des Flaschen-Icons liegt (oben rechts: 22 % Breite, 9 % Höhe)
const isBottleIcon = event => {
  const rect = canvas.getBoundingClientRect();
  return event.clientX - rect.left > rect.width * .78 &&
         event.clientY - rect.top < rect.height * .09;
};

// Trinkt eine Eisbonbon (Slow-Mo): 6 Sekunden Zeitlupe (nur im Spiel, nur wenn nicht schon aktiv)
function drink() {
  if (mode === "play" && inv.bottles > 0 && slowTimer <= 0 && drinkCd <= 0) {
    inv.bottles--;
    drinkCd = 10;   // 10 s Abklingzeit gegen Spam
    saveInv();
    slowTimer = 6;
    slowSound();
    beep(300, .5, "sine", .1, 80);
  }
}


/* =====================================================================
   2. SPIELZUSTAND
   ===================================================================== */

let mode = "menu";   // "menu" | "ready" (wartet auf Start) | "play" | "dead"
let scrollX = 0;     // wie weit die Welt gescrollt ist (für Parallax-Hintergrund)
let speed = 80;      // Scroll-Geschwindigkeit (wird in reset()/update() gesetzt)

let bird;            // Spielerfigur {x, y, vy, rot, flap, kick}
let pipes;           // Röhren-Hindernisse
let cars;            // Autos auf der Straße
let flyingCars;      // silberne Flugautos
let drones;          // rote Drohnen
let coinItems;       // Münzen in der Welt
let bullets;         // Kugeln
let particles;       // Partikel (Funken, Explosionen)
let score;           // Punkte der aktuellen Runde (passierte Röhren)
let runCoins;        // Münzen, die in dieser Runde gesammelt wurden
let shootCooldown;   // Restzeit bis zum nächsten Schuss
let shootHeld;       // true, solange die Schießen-Taste gehalten wird
let deadTime;        // Zeit seit dem Tod (verzögert den Game-Over-Screen)
let shake;           // Restzeit des Bildschirmwackelns
let carTimer;        // Countdown bis zum nächsten Auto
let droneTimer;      // Countdown bis zur nächsten Drohne
let flyTimer;        // Countdown bis zum nächsten Flugauto
let time = 0;        // laufende Zeit für Animationen
let bottlePickups = []; // grüne Flaschen in der Welt (geben Slow-Mo)
let pipeCount = 0;   // Anzahl erzeugter Röhren (jede 4. bringt eine Flasche)
let slowTimer = 0;   // Restzeit der Slow-Motion
let drinkCd = 0;     // Bonbon-Abklingzeit (10 s)
let aim = { x: 420, y: 300 }, aimAng = 0;
let runDmg = 0;   // Schaden in dieser Runde (Rangliste)
let storyLevel = 0, story = { seen1: load("fc_s1", 0), seen2: load("fc_s2", 0), lvl: load("fc_slvl", 1) };   // Story-Stand
let pbShown = false, falling = [], fishItems = [], fallT = 8, aimTouch = null, curTab = "R";   // Pause-Knopf, fallende Zapfen, Fische, Touch-ID, Casino-Tab   // Fadenkreuz-Position und geglätteter Zielwinkel
let wPick = null, popup = null, xpShown = 0, lvlPop = 0, realDt = .016;   // Waffen-Pickup, Pop-up, XP-Balken-Animation
let clip = 0;        // Schuss im Magazin
let reloadTimer = 0; // Nachladezeit
let scorePop = 0;    // Animation des Punktezählers

// 6 Wolken mit zufälliger Höhe und Größe
const clouds = Array.from({ length: 6 }, (_, i) => ({
  x: i * 110,
  y: rnd(40, 260),
  scale: rnd(.7, 1.4)
}));

// 16 Häuser im Hintergrund, nebeneinander aufgereiht
let buildingX = 0;
const buildings = Array.from({ length: 16 }, () => {
  const building = {
    x: buildingX,
    w: rnd(44, 80),
    h: rnd(90, 230),
    color: ["#9fd3f0", "#b8e2f7", "#86c1e6"][Math.floor(rnd(0, 3))]
  };
  buildingX += building.w + rnd(0, 10);   // nächstes Haus mit kleinem Abstand
  return building;
});
const buildingPeriod = buildingX;         // Gesamtbreite → Hintergrund wiederholt sich nahtlos

// Setzt alles für eine neue Runde zurück und wartet auf den ersten Klick ("ready")
function reset() {
  bird = { x: 110, y: 300, vy: 0, rot: 0, flap: 0, kick: 0 };
  pipes = [];
  bottlePickups = [];
  pipeCount = 0;
  slowTimer = 0;
  cars = [];
  flyingCars = [];
  drones = [];
  coinItems = [];
  bullets = [];
  particles = [];
  score = 0;
  runCoins = 0;
  shootCooldown = 0;
  shootHeld = false;
  deadTime = 0;
  shake = 0;
  carTimer = 3;
  droneTimer = 6;
  flyTimer = 4;
  speed = 170;
  clip = WEAPONS[inv.cur] ? Math.min(WEAPONS[inv.cur].mag, inv.ammo[inv.cur] || 0) : 0;
  wPick = null; popup = null; runDmg = 0; falling = []; fishItems = []; fallT = rnd(6, 10);
  reloadTimer = 0;
  scorePop = 0;
  mode = "ready";
}

// Nachladen (Taste R): füllt das Magazin aus der Reserve, dauert 1,2 s
function reload() {
  if (mode === "play" && reloadTimer <= 0 && WEAPONS[inv.cur] && clip < WEAPONS[inv.cur].mag && inv.ammo[inv.cur] > clip) {
    reloadTimer = 1.2;
    beep(200, .2, "square", .05, 400);
  }
}

reset();          // Startzustand anlegen
mode = "menu";    // aber beim Laden zuerst das Menü zeigen
wallet();         // Anzeigen füllen

// Erzeugt Partikel an Position (x, y): Farbe, Anzahl, maximale Geschwindigkeit
function boom(x, y, color, count = 14, maxSpeed = 260) {
  count = set.gfx ? count : Math.ceil(count / 3);   // niedrige Grafik: weniger Partikel
  for (let i = 0; i < count; i++) {
    const angle = rnd(0, FULL);          // zufällige Richtung
    const velocity = rnd(40, maxSpeed);
    particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: rnd(.3, .7),                 // verbleibende Lebenszeit
      maxLife: .7,                       // für das Ausblenden
      color,
      size: rnd(2, 5)
    });
  }
}

// Vogel springt (und startet die Runde beim ersten Klick)
function jump() {
  if (mode === "ready") mode = "play";
  if (mode !== "play") return;
  bird.vy = -440;
  stat("jumps");                         // Schub nach oben
  bird.flap = .25;                        // Flügelanimation
  beep(380, .16, "sine", .09, 900);
  noise(.06, 4000, .08);
}

// Schießt die ausgerüstete Waffe (wenn Cooldown vorbei und Munition da)
function shoot() {
  if (mode === "ready") mode = "play";
  if (mode !== "play" || shootCooldown > 0) return;

  const weapon = WEAPONS[inv.cur];
  if (!weapon) return;   // keine Waffe ausgerüstet

  if (reloadTimer > 0) return;
  if (clip <= 0) {
    reload();               // keine Munition → Klick-Geräusch
    shootCooldown = .3;
    beep(90, .05, "square", .04);
    return;
  }

  inv.ammo[inv.cur]--;
  clip--;
  stat("shots");
  saveInv();
  shootCooldown = weapon.cooldown;
  const mx = bird.x + 10 + Math.cos(aimAng) * (weapon.length * 2 + 8), my = bird.y + 10 + Math.sin(aimAng) * (weapon.length * 2 + 8);   // Mündung

  bullets.push({
    x: mx, y: my,
    vx: Math.cos(aimAng) * weapon.bulletSpeed, vy: Math.sin(aimAng) * weapon.bulletSpeed,   // Flug Richtung Fadenkreuz
    damage: weapon.damage,
    speed: weapon.bulletSpeed,
    pierce: weapon.pierce, rocket: weapon.rocket, life: weapon.life, freeze: weapon.freeze, burn: weapon.burn                 // nur Sniper: durchschlägt Ziele
  });

  bird.kick = .12;                        // Rückstoß-Animation
  boom(mx, my, "#ffd54a", 5, 160); // Mündungsfeuer
  gunSound(inv.cur);
}

// Vogel stirbt: Rekord speichern, Effekte starten
function die() {
  if (mode !== "play") return;
  mode = "dead";
  slowTimer = 0;
  deadTime = 0;
  shake = .4;
  bird.vy = -260;                         // kleiner Hüpfer beim Tod
  best = Math.max(best, score);
  stat("runs");
  submitScores();
  boom(bird.x, bird.y, "#ffd23a", 30, 320);
  [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, .35, "triangle", .09, f * .9), i * 220)); // Verlierer-Jingle
  wallet();
}

// Vergibt Münzen für einen Abschuss und spielt Explosion + Sound
function bonus(x, y, amount) {
  coins += amount;
  xpGain(1);   // 1 XP pro getötetem Gegner
  stat("kills");
  runDmg++;   // Rangliste "Waffe": +1 pro getötetem Gegner
  runCoins += amount;
  boom(x, y, "#ff5722", 22, 300);
  boom(x, y, "#ffd54a", 10, 200);
  beep(300, .3, "sawtooth", .07, 60);
  wallet();
}

// Explosion (RPG): Schaden in 110 px Umkreis
function blast(x, y, dmg) {
  boom(x, y, "#ff6d00", 40, 360); shake = .25; noise(.5, 500, .5);
  cars.forEach(c => { if (Math.hypot(c.x + c.w / 2 - x, GY - y) < 110 && c.hp > 0 && (c.hp -= dmg) <= 0) { c.x = -999; bonus(x, GY - 10, 3); } });
  flyingCars.forEach(c => { if (Math.hypot(c.x - x, c.y - y) < 110 && c.hp > 0 && (c.hp -= dmg) <= 0) { c.paid = 1; bonus(c.x, c.y, 8); } });
  drones.forEach(d => { if (Math.hypot(d.x - x, d.y - y) < 110) { d.x = -999; bonus(x, y, 5); } });
}

// Registriert einen Kugeltreffer auf ein Ziel.
// Normale Kugeln verschwinden (dead = 1); die Sniper-Kugel (pierce) lebt weiter
// und merkt sich getroffene Ziele, damit sie diese nicht mehrfach trifft.
function registerHit(bullet, target) {
  bullet.dead = bullet.pierce ? 0 : 1; stat("hits");
  if (bullet.pierce) (bullet.hits = bullet.hits || []).push(target);
}


/* =====================================================================
   3. UPDATE – Spiellogik für einen Frame (dt = Sekunden seit letztem Frame)
   ===================================================================== */

function update(dt) {
  time += dt;
  const ta = Math.atan2(aim.y - (bird.y + 10), aim.x - (bird.x + 10));   // Winkel Waffe → Fadenkreuz
  let da = ta - aimAng; da = Math.atan2(Math.sin(da), Math.cos(da));
  aimAng += da * Math.min(1, dt * 16 + .0001);                            // Waffe dreht weich mit
  // Welt scrollt: im Menü langsam (70), im Tod gar nicht, sonst mit Spielgeschwindigkeit
  scrollX += (mode === "menu" ? 70 : mode === "dead" ? 0 : speed) * dt;

  // Partikel bewegen, fallen lassen (Schwerkraft 500) und alte entfernen
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 500 * dt;
    p.life -= dt;
  });
  particles = particles.filter(p => p.life > 0);

  shake = Math.max(0, shake - dt);
  scorePop = Math.max(0, scorePop - dt);        // Wackeln klingt ab

  // --- Modus "ready": Vogel schwebt sanft auf und ab ---
  if (mode === "ready") {
    bird.y = 300 + Math.sin(time * 5) * 8;
    bird.flap = Math.max(0, bird.flap - dt);
    return;
  }

  // --- Modus "dead": Vogel fällt, nach 0,9 s erscheint der Game-Over-Screen ---
  if (mode === "dead") {
    bird.vy += 1500 * dt;
    bird.y = Math.min(bird.y + bird.vy * dt, FLOOR - BIRD_R);
    bird.rot = clamp(bird.vy / 400, -.5, 1.5);
    deadTime += dt;
    if (deadTime > 1 && !bird.gone) {   // verschwindet in einer Rauchwolke
      bird.gone = true;
      const n0 = particles.length;
      boom(bird.x, bird.y, "#cfd8dc", 50, 150); boom(bird.x, bird.y, "#90a4ae", 30, 110); boom(bird.x, bird.y, "#ffffff", 20, 90);
      particles.slice(n0).forEach(p => { p.vy = -Math.abs(p.vy) * .5; p.life += .6; p.maxLife = 1.3; p.size += 9; });
    }

    if (deadTime > .9 && $("over").classList.contains("hid")) {
      $("oScore").textContent = score;
      $("oCoins").textContent = runCoins;
      $("oBest").textContent = best;
      $("over").classList.remove("hid");
    }
    return;
  }

  if (mode !== "play") return;            // Menü: nichts weiter zu tun

  // --- Vogel-Physik ---
  speed = 170 + Math.min(score * 3, 130) + storyLevel * 8;   // Story: pro Level schneller // wird mit dem Score schneller (max. 300)
  bird.vy += 1150 * dt;                   // Schwerkraft
  bird.y += bird.vy * dt;
  bird.rot = clamp(bird.vy / 600, -.5, 1.2); // Neigung je nach Fallgeschwindigkeit
  bird.flap = Math.max(0, bird.flap - dt);
  bird.kick = Math.max(0, bird.kick - dt);

  if (bird.y < BIRD_R) {                  // Decke: nicht höher als Bildrand
    bird.y = BIRD_R;
    bird.vy = 0;
  }
  if (bird.y > FLOOR - BIRD_R) {          // Boden: nicht tiefer als Boden
    bird.y = FLOOR - BIRD_R;
    bird.vy = 0;
  }

  shootCooldown -= dt;
  if (reloadTimer > 0 && (reloadTimer -= realDt) <= 0) clip = Math.min(WEAPONS[inv.cur].mag, inv.ammo[inv.cur]);
  if (shootHeld) shoot();                 // Dauerfeuer bei gehaltener Taste

  // --- Neue Röhre (plus Münzen/Flasche) erzeugen, wenn die letzte weit genug links ist ---
  const lastPipe = pipes[pipes.length - 1];
  if (!lastPipe || lastPipe.x < W - 360) {
    const gapY = rnd(190, GY - 190);                         // Mitte der Lücke
    const pipe = { x: W + 40, w: Math.round(rnd(60, 110)), gapY, gap: 240, passed: false, shade: Math.floor(rnd(0, 3)) }   // verschieden breit & gefärbt;
    pipes.push(pipe);
    if (pipeCount % 5 === 4 && gameMode === "Kampagne") fishItems.push({ x: pipe.x + pipe.w + 70, y: rnd(150, GY - 150) });   // alle ~5 Punkte ein Fisch

    if (++pipeCount % 4 === 0) {                             // jede 4. Röhre: Eisbonbon (Slow-Mo)
      bottlePickups.push({ x: pipe.x + 170, y: rnd(150, GY - 150) });
    }
    if (Math.random() < .75) {                               // 75 %: Münze in der Lücke
      coinItems.push({ x: pipe.x + pipe.w / 2, y: gapY, phase: rnd(0, 6) });
    }
    if (Math.random() < .5) {                                // 50 %: Dreier-Reihe Münzen hinter der Röhre
      const y = rnd(140, GY - 140);
      for (let i = 0; i < 3; i++) {
        coinItems.push({
          x: pipe.x + pipe.w + 35 + i * 26,
          y: y + (i === 1 ? -14 : 0),                        // mittlere Münze etwas höher (Bogen)
          phase: rnd(0, 6)
        });
      }
    }
  }

  // --- Röhren bewegen, Kollision prüfen, Punkte zählen ---
  pipes.forEach(pipe => {
    pipe.x -= speed * dt;

    const dx = Math.abs(bird.x - (pipe.x + pipe.w / 2));
    const aTop = pipe.gapY - pipe.gap / 2 - (bird.y - BIRD_R * .6);   // Vogel ragt über die obere Spitze
    const aBot = (bird.y + BIRD_R * .6) - (pipe.gapY + pipe.gap / 2); // … bzw. unter die untere Spitze
    const halfW = a => pipe.w / 2 * clamp(a / 70, 0, 1) + BIRD_R * .6; // Zapfen werden zur Spitze schmaler
    if ((aTop > 0 && dx < halfW(aTop)) || (aBot > 0 && dx < halfW(aBot))) die();

    if (!pipe.passed && pipe.x + pipe.w < bird.x) { // Röhre komplett passiert
      pipe.passed = true;
      score++;
      if (storyLevel && score >= goalFor(storyLevel)) levelDone();
      coins++; runCoins++; wallet();   // 1 Münze pro Eiszapfen
      stat("coins"); stat("pipes");
      xpGain(score > best ? 5 : 1);
      if (score === 1 && !Object.keys(inv.own).length) wPick = { x: W + 30, y: GY / 2 - 40 };   // erste Waffe erscheint   // 1 XP pro Zapfen, 5 XP wenn der Rekord geknackt wird
      scorePop = .35;
      beep(660 + Math.min(score, 20) * 30, .1, "triangle", .07, 1320);
      setTimeout(() => beep(1320, .12, "sine", .05), 90);
      if (score % 10 === 0) setTimeout(() => beep(1760, .3, "triangle", .08), 200);
    }
  });
  pipes = pipes.filter(pipe => pipe.x > -90);       // aus dem Bild → löschen

  // --- Eisbonbon (Slow-Mo)n: bewegen, einsammeln → 6 s Zeitlupe ---
  bottlePickups.forEach(bottle => {
    bottle.x -= speed * dt;
    if (Math.hypot(bird.x - bottle.x, bird.y - bottle.y) < BIRD_R + 16) {
      bottle.taken = true;
      slowTimer = 6;
    slowSound();
      boom(bottle.x, bottle.y, "#39ff6a", 24, 260);
      beep(260, .6, "sine", .1, 60);
    }
  });
  bottlePickups = bottlePickups.filter(b => !b.taken && b.x > -40);

  if (wPick) {   // erste Waffe einsammeln
    wPick.x -= speed * dt;
    if (Math.abs(bird.x - wPick.x) < 90 && Math.abs(bird.y - wPick.y) < 150) {   // riesige Trefferzone
      inv.own.ak = 1; inv.ammo.ak = 45; inv.cur = "ak";
      clip = Math.min(WEAPONS.ak.mag, 45); saveInv();
      popup = { t: 999 }; pauseState = 3; wPick = null; achievement();   // Spiel pausiert bis zum Tastendruck
    } else if (wPick.x < -40) wPick = null;
  }

  if (score >= 2 && !storyLevel && (fallT -= dt) <= 0) {   // herabfallende Eiszapfen (einzeln oder Gruppe) mit Warn-Knacken
    fallT = rnd(7, 12);
    const n = Math.random() < .4 ? 3 : 1, x0 = rnd(bird.x + 140, W - 60);
    for (let i = 0; i < n; i++) falling.push({ x: x0 + i * 46, y: 0, vy: 0, warn: .9 });
    noise(.15, 6000, .15); beep(1400, .1, "triangle", .05, 900);
  }
  falling.forEach(f => {
    f.x -= speed * dt;
    if (f.warn > 0) { f.warn -= dt; return; }                    // zittert erst an der Decke
    f.vy = Math.min(f.vy + 120 * dt, 150); f.y += f.vy * dt;   // sehr langsames Fallen
    if (Math.abs(bird.x - f.x) < 16 + BIRD_R * .6 && f.y + 22 > bird.y - BIRD_R * .6 && f.y - 22 < bird.y + BIRD_R * .6) die();
    if (f.y > GY - 10) { f.gone = true; boom(f.x, GY - 10, "#bfefff", 10, 160); beep(900, .1, "triangle", .05, 400); }
  });
  falling = falling.filter(f => !f.gone && f.x > -40);
  fishItems.forEach(f => {                                       // Fische einsammeln (Währung für Saisonwaffen)
    f.x -= speed * dt;
    if (Math.hypot(bird.x - f.x, bird.y - f.y) < BIRD_R + 24) {
      f.got = true; inv.fish++; saveInv(); stat("fish");
      boom(f.x, f.y, "#4fc3f7", 10, 160); beep(900, .12, "triangle", .07, 1500);
    }
  });
  fishItems = fishItems.filter(f => !f.got && f.x > -40);

  // --- Autos auf der Straße ---
  carTimer -= dt;
  if (carTimer <= 0) {
    carTimer = rnd(2.2, 4);
    plop();
    cars.push({
      x: W + 90, w: 78, h: 34, hp: 4,
      color: ["#e53935", "#1e88e5", "#fdd835", "#8e24aa", "#fb8c00"][Math.floor(rnd(0, 5))]
    });
  }
  cars.forEach(car => {
    car.x -= (speed + 110) * tick(car, dt) * dt;   // eingefroren = steht still
    if (car.hp <= 0 && car.x > -900) { bonus(car.x + 30, GY - 10, 3); car.x = -999; }   // an Brand gestorben          // Autos fahren schneller als die Welt scrollt
    if (bird.x + BIRD_R > car.x + 4 &&
        bird.x - BIRD_R < car.x + car.w - 4 &&
        bird.y + BIRD_R > GY - 14) {
      die();                              // Vogel berührt Auto
    }
  });
  cars = cars.filter(car => car.x > -100);

  // --- Flugautos (ab Score 3) ---
  if (score >= 3) {
    flyTimer -= dt;
    if (flyTimer <= 0) {
      flyTimer = rnd(3, 5);
      const baseY = rnd(150, GY - 180);
      flyingCars.push({ x: W + 50, y: baseY, baseY, t: 0, hp: 4 });
    }
  }
  flyingCars.forEach(car => {
    const f = tick(car, dt);
    car.x -= (speed + 50) * f * dt;
    car.t += dt * f;
    if (car.hp <= 0 && !car.paid) { car.paid = 1; bonus(car.x, car.y, 8); }
    car.y = car.baseY + Math.sin(car.t * 3) * 12;   // leichtes Auf-und-Ab
    if (Math.abs(bird.x - car.x) < BIRD_R + 30 &&
        Math.abs(bird.y - car.y) < BIRD_R + 15) {
      die();
    }
  });
  flyingCars = flyingCars.filter(car => car.x > -100 && car.hp > 0);

  // --- Drohnen (ab Score 3) ---
  if (score >= 3) {
    droneTimer -= dt;
    if (droneTimer <= 0) {
      droneTimer = rnd(4, 7);
      plop();
      drones.push({ x: W + 30, y0: rnd(130, GY - 190), y: GY, t: 0, hp: 1, kind: Math.floor(rnd(0, 4)), rot: 0 });
    }
  }
  drones.forEach(drone => {
    const k = drone.kind, t = drone.t += dt;
    // 0 Salto-Fisch: springt aus dem Wasser und dreht Saltos | 1 Pendler: hoch & runter | 2 Sprinter: wechselt Tempo | 3 Delfin-Bogen: springt immer wieder
    drone.x -= speed * (k === 2 ? .6 + 1.1 * (1 + Math.sin(t * 2)) : k === 0 ? .8 : 1.1) * dt;
    drone.rot = k === 0 ? t * 9 : 0;
    drone.y = clamp(k === 1 ? drone.y0 + Math.sin(t * 2.2) * 130
      : k === 3 ? GY - Math.abs(Math.sin(t * 2.5)) * (GY - drone.y0)
      : drone.y0 + Math.max(0, 1 - t) * (GY - drone.y0) + (k === 2 ? Math.sin(t * 3) * 20 : 0), 40, GY - 30);
    if (Math.hypot(bird.x - drone.x, bird.y - drone.y) < BIRD_R + 22) die();
  });
  drones = drones.filter(drone => drone.x > -40);

  // --- Münzen einsammeln ---
  coinItems.forEach(coin => {
    coin.x -= speed * dt;
    if (Math.hypot(bird.x - coin.x, bird.y - coin.y) < BIRD_R + 13) {
      coin.taken = true;
      stat("coins");
      coins++;
      runCoins++;
      boom(coin.x, coin.y, "#ffd54a", 8, 150);
      beep(1200, .12, "triangle", .05, 1800);
      wallet();
    }
  });
  coinItems = coinItems.filter(coin => !coin.taken && coin.x > -30);

  // --- Kugeln bewegen und Treffer prüfen ---
  bullets.forEach(bullet => {
    bullet.x += (bullet.vx ?? (bullet.speed || 640)) * dt;
    bullet.y += (bullet.vy || 0) * dt;
    if (bullet.life !== undefined) bullet.life -= dt;

    // Treffer auf Autos (2 Treffer nötig → 3 Münzen)
    cars.forEach(car => {
      if (!bullet.dead &&
          !(bullet.hits && bullet.hits.includes(car)) &&   // Sniper trifft jedes Auto nur einmal
          bullet.x > car.x - 14 && bullet.x < car.x + car.w + 14 &&
          bullet.y > GY - 60) {
        registerHit(bullet, car);
        car.hp -= bullet.damage;
        status(car, bullet);
        boom(bullet.x, bullet.y, "#ff9800", 6, 200);
        if (car.hp <= 0) {
          car.x = -999;                                    // Auto "entfernen" (wird danach gefiltert)
          boom(car.x, GY, "#ff5722", 1);                   // (wirkungslos, da x schon -999 ist)
          bonus(bullet.x, GY - 10, 3);
        }
      }
    });

    // Treffer auf Drohnen (1 Treffer → 5 Münzen)
    drones.forEach(drone => {
      if (!bullet.dead && Math.hypot(bullet.x - drone.x, bullet.y - drone.y) < 46) {
        bullet.dead = bullet.pierce ? 0 : 1; stat("hits");
        drone.x = -999;                                    // Drohne "entfernen"
        bonus(bullet.x, bullet.y, 5);
      }
    });

    // Fallende Eiszapfen lassen sich abschießen (+1 Kill)
    falling.forEach(f => {
      if (!bullet.dead && Math.hypot(bullet.x - f.x, bullet.y - f.y) < 36) {
        bullet.dead = bullet.pierce ? 0 : 1; stat("hits"); f.gone = true;
        boom(f.x, f.y, "#bfefff", 14, 200); bonus(f.x, f.y, 1); beep(1100, .12, "triangle", .06, 500);
      }
    });

    // Treffer auf Flugautos (3 Treffer nötig → 8 Münzen)
    flyingCars.forEach(car => {
      const alreadyHit = bullet.hits && bullet.hits.includes(car);
      const hit = bullet.x > car.x - 45 && bullet.x < car.x + 45 &&
                  bullet.y > car.y - 32 && bullet.y < car.y + 32;
      if (!bullet.dead && !alreadyHit && hit) {
        registerHit(bullet, car);
        car.hp -= bullet.damage;
        status(car, bullet);
        boom(bullet.x, bullet.y, "#d9e2ec", 8, 180);
        if (car.hp <= 0) {
          boom(car.x, car.y, "#cbd5e1", 24, 260);
          car.paid = 1;
          bonus(car.x, car.y, 8);
        }
      }
    });

    // Röhren blockieren Kugeln (nur wenn sie nicht durch die Lücke fliegen)
    pipes.forEach(pipe => {
      if (!bullet.dead &&
          bullet.x > pipe.x && bullet.x < pipe.x + pipe.w &&
          (bullet.y < pipe.gapY - pipe.gap / 2 || bullet.y > pipe.gapY + pipe.gap / 2)) {
        bullet.dead = 1;
        boom(bullet.x, bullet.y, "#9ccc65", 5, 140);
      }
    });
  });

  // Raketen explodieren beim Aufprall und beschädigen alles im Umkreis
  bullets.forEach(b => { if (b.rocket && b.dead && !b.blasted) { b.blasted = 1; blast(b.x, b.y, b.damage); } });

  // Verbrauchte oder aus dem Bild geflogene Kugeln entfernen
  bullets = bullets.filter(bullet => !bullet.dead && bullet.x < W + 20 && bullet.x > -30 && bullet.y > -30 && bullet.y < H + 30 && !(bullet.life <= 0));
}


/* =====================================================================
   4. ZEICHNEN
   ===================================================================== */

// Hintergrund: Polarhimmel, Eisberge, Meer, Iglu, Schneestraße
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, GY);
  const SK = storyLevel ? CITIES[storyLevel - 1].c : ["#0b1b4a", "#2b6a8f", "#bfe8ff"];   // Story: Himmel je Stadt
  sky.addColorStop(0, SK[0]); sky.addColorStop(.6, SK[1]); sky.addColorStop(1, SK[2]);   // Polar-Dämmerung
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  if (storyLevel) { cityBG(); return; }   // Story: komplette Stadt-Kulisse statt Eiswelt
  if (set.gfx) for (let a = 0; a < 3; a++) {                    // Polarlicht
    ctx.fillStyle = ["#3dffb040", "#7a5cff35", "#3dd6ff30"][a];
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 110 + a * 45 + Math.sin(x / 70 + time * (.6 + a * .2) + a) * 32);
    ctx.lineTo(W, 0); ctx.fill();
  }
  ctx.fillStyle = "#fff";                                        // Sterne
  for (let i = 0; set.gfx && i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % 300, 2, 2);
  ctx.fillStyle = "#fffde7"; ctx.beginPath(); ctx.arc(390, 110, 36, 0, FULL); ctx.fill();   // blasse Sonne
  clouds.forEach(cloud => {
    const x = (((cloud.x - scrollX * .12) % (W + 240)) + (W + 240)) % (W + 240) - 120;
    ctx.fillStyle = "#ffffffcc";
    [[0, 0, 30], [28, -8, 26], [56, 0, 28]].forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(x + dx * cloud.scale, cloud.y + dy * cloud.scale, r * cloud.scale, 0, FULL); ctx.fill();
    });
  });
  const offset = scrollX * .3 % buildingPeriod;                  // Eisberge (Dreiecke) mit hellem Schatten
  for (let rep = 0; rep < 2; rep++) {
    buildings.forEach(b => {
      const x = b.x - offset + rep * buildingPeriod, base = GY - 40;
      if (x > W || x + b.w < 0) return;
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + b.w * .45, base - b.h); ctx.lineTo(x + b.w, base); ctx.fill();
      ctx.fillStyle = "#ffffff99"; ctx.beginPath(); ctx.moveTo(x + b.w * .45, base - b.h); ctx.lineTo(x + b.w * .45, base); ctx.lineTo(x + b.w, base); ctx.fill();
    });
  }
  for (let i = 0; set.gfx && i < 3; i++) {                       // kleine Iglus mit Licht
    const x = ((i * 190 - scrollX * .35) % 570 + 570) % 570 - 40, y = GY - 40;
    ctx.fillStyle = "#e8f6ff"; ctx.beginPath(); ctx.arc(x, y, 16, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#ffd54a"; ctx.beginPath(); ctx.arc(x, y, 6, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#ffd54a33"; ctx.beginPath(); ctx.arc(x, y - 2, 20, 0, FULL); ctx.fill();
  }
  ctx.fillStyle = "#2a7fc4"; ctx.fillRect(0, GY - 40, W, 22);   // Meer
  ctx.fillStyle = "#ffffff55";
  for (let x = -(scrollX * .5 % 60); x < W; x += 60) ctx.fillRect(x, GY - 32, 28, 3);
  const ix = 520 - (scrollX * .6 % 1000);                        // Iglu mit Inuit
  ctx.fillStyle = "#f4fbff"; ctx.strokeStyle = "#9fd3f0"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ix, GY - 18, 34, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#2b3a4a"; ctx.beginPath(); ctx.arc(ix, GY - 18, 11, Math.PI, 0); ctx.fill();
  ctx.fillStyle = "#8d5a2b"; ctx.beginPath(); ctx.arc(ix + 48, GY - 34, 6, 0, FULL); ctx.fill();
  ctx.fillStyle = "#c0392b"; ctx.fillRect(ix + 42, GY - 28, 12, 10);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, GY - 20, W, 12);       // Schneekante
  ctx.fillStyle = "#8fa3b5"; ctx.fillRect(0, GY - 8, W, H);      // Schneestraße
  ctx.fillStyle = "#dfeaf3"; ctx.fillRect(0, GY - 8, W, 5);
  ctx.fillStyle = "#ffffffcc";
  for (let x = -(scrollX % 80); x < W; x += 80) ctx.fillRect(x, GY + 60, 44, 6);
  ctx.fillStyle = "#1f5f9a"; ctx.fillRect(0, GY + 100, W, H);
  ctx.fillStyle = "#ffffffcc";                                   // fliegende Schneebälle
  for (let i = 0; set.gfx && i < 24; i++) {
    const x = ((i * 67 - scrollX * (.5 + i % 3 * .2)) % (W + 20) + W + 20) % (W + 20) - 10;
    ctx.beginPath(); ctx.arc(x, (i * 97 + time * (20 + i % 4 * 10) + Math.sin(time + i) * 10 + GY) % GY, 1.5 + i % 3, 0, FULL); ctx.fill();
  }   // Meer unten
}

// Eiszapfen: breit, spitz zulaufend (Spitze zeigt zur Lücke)
function drawPipe(p) {
  const top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2, m = p.x + p.w / 2;
  if (storyLevel) { drawPipeStory(p, top, bot); return; }
  const gr = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  const P = ICE[p.shade || 0]; gr.addColorStop(0, P[0]); gr.addColorStop(.5, P[1]); gr.addColorStop(1, P[2]);
  ctx.fillStyle = gr; ctx.strokeStyle = "#3f8fc0"; ctx.lineWidth = 3; ctx.lineJoin = "round";
  [[-5, top - 70, top], [GY - 8, bot + 70, bot]].forEach(([e, s, tip]) => {
    ctx.beginPath();
    ctx.moveTo(p.x, e); ctx.lineTo(p.x, s); ctx.lineTo(m, tip); ctx.lineTo(p.x + p.w, s); ctx.lineTo(p.x + p.w, e);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#ffffffaa"; ctx.beginPath(); ctx.moveTo(p.x + 14, e); ctx.lineTo(p.x + 14, s); ctx.lineTo(m - 4, tip - (tip - s) * .15); ctx.stroke();
    ctx.strokeStyle = "#3f8fc0";
  });
}

// Münze: dreht sich, indem ihre Breite mit dem Kosinus schwankt
function drawCoin(c) {
  const width = Math.abs(Math.cos(time * 4 + c.phase)) * 11 + 2;

  ctx.fillStyle = "#b8860b";                         // dunkler Rand
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, width + 2, 13, 0, 0, FULL);
  ctx.fill();

  const gradient = ctx.createLinearGradient(c.x - width, c.y - 12, c.x + width, c.y + 12);
  gradient.addColorStop(0, "#fff59d");
  gradient.addColorStop(1, "#ffb300");
  ctx.fillStyle = gradient;                          // goldene Fläche
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, width, 11, 0, 0, FULL);
  ctx.fill();

  ctx.strokeStyle = "#d98e00";                       // innerer Ring
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, width * .55, 6, 0, 0, FULL);
  ctx.stroke();
}

// Eisbonbon (Slow-Mo-Pickup): blaues Bonbon in Papier
function drawBottle(b) {
  if (storyLevel) {   // Story: Spezialität der Stadt auf einem Teller (gibt Slow-Mo)
    ctx.save(); ctx.translate(b.x, b.y + Math.sin(time * 3 + b.x / 40) * 5);
    ctx.fillStyle = "#ffd54a44"; ctx.beginPath(); ctx.arc(0, 0, 26, 0, FULL); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 17, 0, FULL); ctx.fill();
    ctx.fillStyle = FOOD[storyLevel - 1]; ctx.beginPath(); ctx.ellipse(0, -2, 12, 7, 0, 0, FULL); ctx.fill();
    ctx.fillStyle = "#fff9"; ctx.fillRect(-3, -14, 2, 8); ctx.fillRect(3, -16, 2, 9);
    ctx.restore(); return;
  }
  const y = b.y + Math.sin(time * 3 + b.x / 40) * 5;
  ctx.save(); ctx.translate(b.x, y);
  ctx.fillStyle = "#7fe8ff44"; ctx.beginPath(); ctx.arc(0, 0, 26, 0, FULL); ctx.fill();
  ctx.fillStyle = "#bfefff";                                    // Papier-Enden
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-22, -9); ctx.lineTo(-22, 9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(22, -9); ctx.lineTo(22, 9); ctx.fill();
  ctx.fillStyle = "#2a9df4"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, FULL); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-4, -4, 3, 0, FULL); ctx.fill();
  ctx.restore();
}

// Schneemobil (fährt auf der Straße)
function drawCar(c) {
  if (storyLevel) {   // Story: normales Auto statt Schneemobil
    const x = c.x, y = GY - 14;
    ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(x, y + 6, c.w, 22, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 14, y + 8); ctx.lineTo(x + 24, y - 6); ctx.lineTo(x + 54, y - 6); ctx.lineTo(x + 64, y + 8); ctx.fill();
    ctx.fillStyle = "#bfe6ff"; ctx.fillRect(x + 26, y - 3, 26, 9); ctx.fillStyle = "#111";
    [16, c.w - 16].forEach(w => { ctx.beginPath(); ctx.arc(x + w, y + 30, 9, 0, FULL); ctx.fill(); });
    return;
  }
  const x = c.x, y = GY - 14;
  ctx.fillStyle = "#0003"; ctx.fillRect(x + 2, y + 32, c.w, 5);
  ctx.fillStyle = "#333"; ctx.beginPath(); ctx.roundRect(x + 6, y + 24, c.w - 12, 10, 5); ctx.fill(); // Raupe
  ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(x, y + 6, c.w, 20, 8); ctx.fill();        // Rumpf
  ctx.fillStyle = "#bfe6ff"; ctx.beginPath(); ctx.moveTo(x + 10, y + 8); ctx.lineTo(x + 20, y - 6); ctx.lineTo(x + 30, y + 8); ctx.fill(); // Scheibe
  ctx.fillStyle = "#222"; ctx.fillRect(x + 40, y - 2, 22, 10);                                      // Sitz
  ctx.fillStyle = "#999"; ctx.fillRect(x - 6, y + 30, 30, 4);                                       // Ski
  ctx.fillStyle = "#fff7a8"; ctx.fillRect(x - 1, y + 12, 6, 6);
  if (c.hp < 3) { ctx.fillStyle = "#222a"; ctx.fillRect(x + 30, y + 10, 10, 8); }
}

// Flugauto im Tesla-Roadster-Stil: flacher Keil, Glaskuppel, Düsen mit weißen Luftwolken
function drawFlyingCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  for (let i = 0; i < 6; i++) {                                  // weiße Luft-/Rauchwolken unter den Düsen
    const p = (time * 2 + i / 6) % 1;
    ctx.fillStyle = "rgba(255,255,255," + (.75 * (1 - p)) + ")";
    [-18, 18].forEach(dx => { ctx.beginPath(); ctx.arc(dx + p * 10, 14 + p * 28, 4 + p * 9, 0, FULL); ctx.fill(); });
  }
  const body = ctx.createLinearGradient(0, -14, 0, 12);
  body.addColorStop(0, "#f5f7fa"); body.addColorStop(.5, "#c3ccd6"); body.addColorStop(1, "#6b7785");
  ctx.fillStyle = body; ctx.strokeStyle = "#3d4752"; ctx.lineWidth = 2;
  ctx.beginPath();                                               // flacher Keil (Front links)
  ctx.moveTo(-36, 5); ctx.lineTo(-28, -3); ctx.lineTo(-8, -8); ctx.lineTo(10, -8); ctx.lineTo(30, -2); ctx.lineTo(36, 5); ctx.lineTo(32, 11); ctx.lineTo(-30, 11);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1c2b3a";                                     // Glaskuppel
  ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(-2, -16); ctx.lineTo(12, -16); ctx.lineTo(20, -7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#9ee7ff66"; ctx.fillRect(0, -14, 10, 3);
  ctx.fillStyle = "#fff59d"; ctx.fillRect(-36, 2, 5, 3);         // Scheinwerfer
  ctx.fillStyle = "#e53935"; ctx.fillRect(32, 1, 4, 3);          // Rücklicht
  [-20, 20].forEach(x => {                                       // Räder + leuchtende Düsen
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x, 11, 6, 0, FULL); ctx.fill();
    ctx.fillStyle = "#7fe8ff"; ctx.fillRect(x - 4, 14, 8, 3);
  });
  ctx.fillStyle = "#263238"; ctx.fillRect(-20, -28, 40, 5);      // Lebensbalken
  ctx.fillStyle = "#4caf50"; ctx.fillRect(-20, -28, 40 * Math.max(0, car.hp / 4), 5);
  ctx.restore();
}

// Fisch (4 Varianten mit eigener Farbe/Form)
function drawDrone(d) {
  if (storyLevel) { text("🚁", d.x, d.y + 12, 40); return; }   // Story: Hubschrauber statt Fische
  const col = ["#ff8a3d", "#3da5ff", "#ff4d6d", "#4dd98a"][d.kind], rx = d.kind === 1 ? 22 : 16;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.rot);
  ctx.scale(1.5, 1.5);   // größere Fische
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, 10, 0, 0, FULL); ctx.fill();            // Körper
  ctx.beginPath(); ctx.moveTo(rx - 2, 0); ctx.lineTo(rx + 12, -9 + Math.sin(time * 20) * 3); ctx.lineTo(rx + 12, 9); ctx.fill(); // Schwanz
  ctx.fillStyle = "#ffffff88"; ctx.beginPath(); ctx.ellipse(-2, 4, rx * .6, 4, 0, 0, FULL); ctx.fill(); // Bauch
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-rx * .5, -2, 4, 0, FULL); ctx.fill();
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-rx * .5 - 1, -2, 2, 0, FULL); ctx.fill();
  ctx.restore();
}

// Vogel inklusive Flügel, Auge, Schnabel und Waffe
function drawBird() {
  const b = bird;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  if (mode === "dead") { ctx.scale(1 + deadTime * .7, 1 + deadTime * .7); ctx.globalAlpha = clamp(1 - deadTime, 0, 1); ctx.filter = "sepia(1) saturate(7) hue-rotate(-40deg)"; }   // rot + verblassen

  ctx.fillStyle = "#222"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 18, 0, 0, FULL); ctx.fill(); ctx.stroke();       // Körper
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(4, 4, 11, 13, 0, 0, FULL); ctx.fill(); // Bauch
  const sw = b.flap / .25 * 1.4 + b.kick / .12 * .8;   // Armschwung bei Sprung/Schuss
  ctx.fillStyle = "#222";
  [[-8, 3, .3 - sw], [8, 5, .1 - sw * .8]].forEach(([ax, ay, ang]) => {   // zwei Arme
    ctx.beginPath(); ctx.ellipse(ax, ay, 5, 11, ang, 0, FULL); ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(8, -8, 6, 0, FULL); ctx.fill();         // Auge
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(10, -8, 2.5, 0, FULL); ctx.fill();
  ctx.fillStyle = "#ff9800";
  ctx.beginPath(); ctx.moveTo(13, -4); ctx.lineTo(25, -1); ctx.lineTo(13, 2); ctx.fill();  // Schnabel
  ctx.fillRect(2, 16, 12, 4);                                                              // Füße
  ctx.translate(-b.kick * 40, 0);                    // Waffe rutscht beim Schuss zurück (Rückstoß)
  const gw = WEAPONS[inv.cur] ? WEAPONS[inv.cur].length * 2 : 0;   // ohne Waffe: nichts zeichnen
  if (gw) {   // Waffe dreht sich zum Fadenkreuz
    ctx.translate(10, 10); ctx.rotate(aimAng - b.rot);
    if (Math.cos(aimAng) < 0) ctx.scale(1, -1);
    const gi = gunImg(inv.cur); if (gi.complete) ctx.drawImage(gi, -2, -gw * .17, gw, gw * .42);
  }

  ctx.restore();
}

// Text mit dunkler Kontur (Standard: weiß, zentriert)
function text(value, x, y, size, color = "#fff", align = "center") {
  ctx.font = size + "px Bungee, Impact, sans-serif";
  ctx.textAlign = align;
  ctx.lineWidth = size / 5;
  ctx.strokeStyle = "#000b";
  ctx.strokeText(value, x, y);                       // erst Kontur …
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);                         // … dann Füllung
}

// Zeichnet ein komplettes Bild: Welt, Objekte, Partikel, HUD, Texte
function draw() {
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-5, 5), rnd(-5, 5)); // Bildschirmwackeln

  drawBackground();
  pipes.forEach(drawPipe);
  coinItems.forEach(drawCoin);
  bottlePickups.forEach(drawBottle);
  fishItems.forEach(drawFishItem);
  if (wPick) drawWPick();
  cars.forEach(c => { drawCar(c); mark(c, c.x + 39, GY - 20); });
  flyingCars.forEach(c => { drawFlyingCar(c); mark(c, c.x, c.y); });
  drones.forEach(drawDrone);
  falling.forEach(drawFallIce);

  // Kugeln: heller Schweif + weißer Kern
  bullets.forEach(bullet => {
    ctx.fillStyle = "#ffeb3b88";
    ctx.fillRect(bullet.x - 26, bullet.y - 4, 26, 8);
    ctx.fillStyle = bullet.freeze ? "#bff3ff" : bullet.burn ? "#ff9800" : "#fff";
    ctx.beginPath();
    ctx.ellipse(bullet.x, bullet.y, 12, 6, 0, 0, FULL);
    ctx.fill();
  });

  if (mode !== "menu" && !bird.gone) drawBird();
  if (storyLevel && mode === "play") text("LEVEL " + storyLevel + " · " + CITIES[storyLevel - 1].n + "  " + score + "/" + goalFor(storyLevel), W / 2, 150, 18, "#fff");
  drawAim();
  drawPopup();
  if (mode === "play" && WEAPONS[inv.cur] && clip <= 0 && !(inv.ammo[inv.cur] > 0) && reloadTimer <= 0) text("✖", bird.x + 36, bird.y - 56, 36, "#ff3b3b");   // keine Munition mehr: rotes X statt Nachlade-Symbol
  if (mode === "play" && WEAPONS[inv.cur] && (reloadTimer > 0 || (clip <= 0 && inv.ammo[inv.cur] > 0))) {   // Nachlade-Anzeige: drehende Mini-Waffe + Pfeil über dem Pinguin
    ctx.save(); ctx.translate(bird.x + 36, bird.y - 50); ctx.rotate(time * 7);
    const im = gunImg(inv.cur);
    if (im.complete) ctx.drawImage(im, -20, -8, 40, 17);
    ctx.restore();
    text("⟳", bird.x + 36, bird.y - 70, 26, "#ffd54a");
  }                   // im Menü ist kein Vogel sichtbar

  // Partikel (werden mit ihrer Restlebensdauer transparenter)
  particles.forEach(p => {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  ctx.globalAlpha = 1;

  ctx.restore();                                     // ab hier ohne Wackeln (HUD bleibt ruhig)

  // --- HUD (nur während der Runde) ---
  if (mode === "play" || mode === "ready" || mode === "dead") {
    if (slowTimer > 0) {                             // Slow-Mo: blauer Schleier + wandernde Linien
      ctx.fillStyle = "rgba(20, 90, 255, .3)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(120, 200, 255, .25)";
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(0, (i * 160 + time * 40) % H, W, 3);
      }
    }

    if (gameMode !== "Rangliste") {   // XP-Anzeige nur in der Kampagne
    const li = lvlInfo(), frac = li.r / li.n;                         // XP-Balken oben (füllt sich weich, ohne Ton)
    if (frac < xpShown - .3) xpShown = 0;
    xpShown += (frac - xpShown) * .08;
    ctx.fillStyle = "#0009"; ctx.beginPath(); ctx.roundRect(W / 2 - 90, 14, 180, 20, 10); ctx.fill();
    ctx.fillStyle = "#ffd54a"; ctx.beginPath(); ctx.roundRect(W / 2 - 90, 14, Math.max(10, 180 * xpShown), 20, 10); ctx.fill();
    text("LVL " + li.l, W / 2, 30, 14);
    if (lvlPop > 0) { text("LEVEL UP!", W / 2, 170, 38 + Math.sin(lvlPop * 8) * 4, "#7fe8ff"); lvlPop -= .016; }
    }
    text(score, W / 2, 90, 56 + scorePop * 60, scorePop > 0 ? "#ffd54a" : "#fff");                      // großer Punktestand

    ctx.fillStyle = "#0008";                         // Münz-Anzeige links oben
    ctx.beginPath();
    ctx.font = "28px Bungee, Impact, sans-serif";
    ctx.roundRect(12, 12, Math.max(130, ctx.measureText(String(coins)).width + 90), 56, 28);   // Breite je nach Zahl
    ctx.fill();

    drawCoin({ x: 40, y: 40, phase: 0 });
    text(coins, 74, 51, 28, "#ffd54a", "left");   // nur die aktuelle Balance                           // Runde / Gesamt
    if (gameMode === "Kampagne") text("🐟 " + inv.fish, 14, 136, 26, "#9fe8ff", "left");
    if (WEAPONS[inv.cur]) text(WEAPONS[inv.cur].name + "  " + clip + " / " + Math.max(0, inv.ammo[inv.cur] - clip), 14, 102, 26, "#fff", "left"); // Waffe + Munition
    text((storyLevel ? "🍽️ " : "🍬 ") + inv.bottles + (drinkCd > 0 ? " " + Math.ceil(drinkCd) + "s" : ""), W - 14, 52, 32, "#7fe8ff", "right");                      // Flaschen

    if (slowTimer > 0) {
      text("SLOW-MO " + slowTimer.toFixed(1), W / 2, 130, 16, "#7fe8ff");
    }
  }

  if (mode === "ready") {                            // Startbildschirm-Hinweise
    text("BEREIT?", W / 2, 230, 34, "#ffd54a");
    text("Linksklick = hüpfen", W / 2, 430, 16);
    text("Rechtsklick = schießen", W / 2, 456, 16, "#ffe082");
  }
}


/* =====================================================================
   5. HAUPTSCHLEIFE, EINGABEN, MENÜS
   ===================================================================== */

let lastTime = performance.now();   // Zeitpunkt des letzten Frames
let lastFilter = "";                // zuletzt gesetzter CSS-Filter (spart unnötige Updates)

// Wird jeden Frame aufgerufen: aktualisiert und zeichnet alles
function loop(now) {
  const rawDt = Math.min(.033, (now - lastTime) / 1000); // Frame-Zeit in s (max. 33 ms)
  lastTime = now;
  const showP = mode === "play" || pauseState === 1 || pauseState === 2;   // Pause-Knopf unten links
  if (showP !== pbShown) { pbShown = showP; $("pbtn").classList.toggle("hid", !showP); }
  const ic = pauseState ? "▶" : "⏸";
  if ($("pbtn").textContent !== ic) { $("pbtn").textContent = ic; $("pbtn").classList.remove("pop"); void $("pbtn").offsetWidth; $("pbtn").classList.add("pop"); }
  if (pauseState === 2) {                                        // 3-Sekunden-Countdown nach der Pause
    countT -= rawDt;
    const n = Math.max(1, Math.ceil(countT / .5));   // 3-2-1 in 1,5 s
    if ($("count").textContent != n) { $("count").textContent = n; beep(520, .08, "triangle", .06); }
    if (countT <= 0) { pauseState = 0; $("count").classList.add("hid"); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, .14, "triangle", .08), i * 60)); }
  }
  if (pauseState) { draw(); setMusic(""); requestAnimationFrame(loop); return; }   // Spiel steht still
  if (drinkCd > 0) drinkCd -= rawDt;

  let dt = rawDt;
  if (slowTimer > 0) {                // Slow-Mo: Spiel läuft mit halber Zeit,
    if ((slowTimer -= rawDt) <= 0) beep(150, .4, "sine", .08, 500); // Slow-Mo-Ende               // der Timer selbst aber in Echtzeit
    dt = rawDt * .5;
  }

  realDt = rawDt;
  update(dt);
  draw();

  // Slow-Mo-Look (Unschärfe/Farbton) nur setzen, wenn er sich ändert
  const filter = slowTimer > 0 ? "blur(1.3px) hue-rotate(-12deg) saturate(1.3)" : "";
  if (filter !== lastFilter) {
    canvas.style.filter = filter;
    lastFilter = filter;
  }

  const want = !$("casino").classList.contains("hid") ? "casino"
    : cutOn || mode === "dead" ? "" : mode === "menu" ? "lobby" : slowTimer > 0 ? "slow" : "game";
  setMusic(musicOn ? want : "");

  plinkoStep(rawDt);                  // Plinko-Physik läuft immer in Echtzeit
  if (!$("casino").classList.contains("hid") && plinkoActive) plinkoDraw();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Rechtsklick-Menü im Spiel verhindern (Rechtsklick = schießen)
$("app").addEventListener("contextmenu", event => event.preventDefault());

// Maus: Flaschen-Icon = trinken, Linksklick = hüpfen, Rechtsklick = schießen (halten = Dauerfeuer)
canvas.addEventListener("mousedown", event => {
  event.preventDefault();
  setAim(event);
  if (isBottleIcon(event)) { drink(); return; }

  if (event.button === 0) jump();
  else if (event.button === 2) {
    shootHeld = true;
    shoot();
  }
});

// Rechte Maustaste losgelassen → Dauerfeuer aus
addEventListener("mouseup", event => {
  if (event.button === 2) shootHeld = false;
});

// Touch: rechte Bildschirmhälfte = schießen, linke = hüpfen
// Touch: linke Hälfte = nur springen, rechte Hälfte = zielen & schießen (beides gleichzeitig mit zwei Fingern möglich)
canvas.addEventListener("touchstart", event => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (const t of event.changedTouches) {
    if (isBottleIcon(t)) { drink(); continue; }
    if (t.clientX - rect.left > rect.width / 2) {
      if (aimTouch === null) { aimTouch = t.identifier; setAim(t); shootHeld = true; shoot(); }
    } else jump();
  }
}, { passive: false });
const touchEnd = e => { for (const t of e.changedTouches) if (t.identifier === aimTouch) { aimTouch = null; shootHeld = false; } };
canvas.addEventListener("touchend", touchEnd);
canvas.addEventListener("touchcancel", touchEnd);

// Tastatur: Enter = Casino-Aktion, Leertaste/Pfeil hoch = hüpfen, X = schießen, E = trinken
addEventListener("keydown", event => {
  if (event.target.tagName === "INPUT" && event.code !== "Escape") return;   // Eingabefelder nicht stören
  if (event.code === "Enter" && !$("casino").classList.contains("hid")) {
    event.preventDefault();
    if (!event.repeat && (curTab === "R" || curTab === "P")) (plinkoActive ? $("drop") : $("spin")).click();
    return;
  }

  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    if (!event.repeat) jump();
  }
  if (event.code === "KeyX") {
    shootHeld = true;
    shoot();
  }
  if (event.code === "KeyE") drink();
  if (event.code === "KeyR") reload();
  if (event.code === "Escape") togglePause();
});

addEventListener("keyup", event => {
  if (event.code === "KeyX") shootHeld = false;
});

// Zeigt genau einen Bildschirm (menu / over / casino / shop) und versteckt die anderen
const showScreen = id => {
  ["menu", "over", "casino", "shop", "settings", "modes", "map", "cut"].forEach(screen => {
    $(screen).classList.toggle("hid", screen !== id);
  });
  $("menu").classList.remove("dive");
  $(id).classList.remove("in"); void $(id).offsetWidth; $(id).classList.add("in"); // Einblend-Animation
};

// Zurück ins Hauptmenü (mindestens 10 Münzen, damit man immer etwas setzen kann)
function toMenu() {
  reset();
  mode = "menu";
  wallet();
  showScreen("menu");
}

// Neue Runde starten: Menü und Game-Over-Screen ausblenden
function start() {
  reset();
  $("menu").classList.add("hid");
  $("over").classList.add("hid");
}

// Menü-Buttons
$("bPlay").onclick = () => playClick();
$("bRetry").onclick = start;
$("bMenu").onclick = toMenu;

// Höhleneingang: Menü zoomt heran, dann öffnet sich die Höhle
const enter = fn => { $("menu").classList.add("dive"); beep(300, .45, "sine", .08, 900); setTimeout(fn, 300); };

$("bCasino").onclick = () => enter(() => { showScreen("casino"); casinoHub(); });
$("bArsenal").onclick = () => enter(() => { shopTab = "A"; armSec = SEAS.includes(inv.cur) ? "X" : "S"; armIdx = Math.max(0, curList().indexOf(inv.cur)); renderShop(); showScreen("shop"); });
$("bShop").onclick = () => enter(() => { shopTab = "D"; renderShop(); showScreen("shop"); });

// Shop-Buttons
$("sBack").onclick = toMenu;

// Casino verlassen ist beim Drehen gesperrt
$("cBack").onclick = () => {
  if (spinning) return;
  if ($("game").classList.contains("hid")) toMenu(); else casinoHub();   // im Spiel → zurück zu den Ständen
};


/* =====================================================================
   6. ROULETTE
   ===================================================================== */

// Reihenfolge der Zahlen auf dem Rad (europäisches Roulette)
const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
const REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]; // rote Zahlen
const SEG = FULL / 37;                       // Winkel eines Fachs
const wheelCtx = $("wheel").getContext("2d");

let chipValue = 10;      // gewählter Einsatz
let betType = "red";     // gewählte Wette
let spinning = false;    // true, solange das Rad dreht
let wheelRot = 0;        // aktuelle Drehung des Rads

// Farbe einer Zahl: "green" (0), "red" oder "black"
const numberColor = n => n === 0 ? "green" : REDS.includes(n) ? "red" : "black";

// Zeichnet das Rad mit Drehwinkel und optional der Kugel {a: Winkel, r: Abstand zur Mitte}
function drawWheel(rotation, ball) {
  const w = wheelCtx;                        // Kurzname für den Roulette-Kontext
  w.clearRect(0, 0, 300, 300);
  w.save();
  w.translate(150, 150);                     // Ursprung in die Mitte des Rads

  // Brauner Außenring mit goldenem Rand
  let gradient = w.createRadialGradient(0, 0, 100, 0, 0, 150);
  gradient.addColorStop(0, "#8a5a2b");
  gradient.addColorStop(1, "#3d2209");
  w.fillStyle = gradient;
  w.beginPath();
  w.arc(0, 0, 148, 0, FULL);
  w.fill();
  w.strokeStyle = "#ffd54a";
  w.lineWidth = 3;
  w.stroke();

  // 37 Fächer mit Zahl
  for (let i = 0; i < 37; i++) {
    const number = ORDER[i];
    const angle = rotation + i * SEG;
    const startAngle = angle - SEG / 2;
    const endAngle = angle + SEG / 2;

    w.fillStyle = number === 0 ? "#0a8a3c" : REDS.includes(number) ? "#c62828" : "#141414";
    w.beginPath();
    w.arc(0, 0, 135, startAngle, endAngle);        // Außenkante
    w.arc(0, 0, 100, endAngle, startAngle, true);  // Innenkante (rückwärts)
    w.closePath();
    w.fill();
    w.strokeStyle = "#d4af37";
    w.lineWidth = 1;
    w.stroke();

    w.save();                                      // Zahl am Fach platzieren
    w.rotate(angle + Math.PI / 2);
    w.fillStyle = "#fff";
    w.font = "bold 11px Nunito, sans-serif";
    w.textAlign = "center";
    w.fillText(number, 0, -117);
    w.restore();
  }

  // Goldene Mitte
  gradient = w.createRadialGradient(0, 0, 5, 0, 0, 98);
  gradient.addColorStop(0, "#ffe27a");
  gradient.addColorStop(1, "#6b4a10");
  w.fillStyle = gradient;
  w.beginPath();
  w.arc(0, 0, 98, 0, FULL);
  w.fill();

  // 4 Speichen mit Knöpfen (drehen mit dem Rad)
  w.strokeStyle = "#ffd54a";
  w.lineWidth = 5;
  for (let i = 0; i < 4; i++) {
    const angle = rotation + i * Math.PI / 2;
    w.beginPath();
    w.moveTo(0, 0);
    w.lineTo(Math.cos(angle) * 80, Math.sin(angle) * 80);
    w.stroke();

    w.fillStyle = "#ffd54a";
    w.beginPath();
    w.arc(Math.cos(angle) * 80, Math.sin(angle) * 80, 6, 0, FULL);
    w.fill();
  }

  // Nabe in der Mitte
  w.fillStyle = "#fff3b0";
  w.beginPath();
  w.arc(0, 0, 10, 0, FULL);
  w.fill();

  // Kugel (weiß mit Schatten)
  if (ball) {
    w.shadowColor = "#000";
    w.shadowBlur = 6;
    w.fillStyle = "#fff";
    w.beginPath();
    w.arc(Math.cos(ball.a) * ball.r, Math.sin(ball.a) * ball.r, 6, 0, FULL);
    w.fill();
    w.shadowBlur = 0;
  }

  // Goldener Zeiger oben (zeigt auf das Gewinnfach)
  w.fillStyle = "#ffd54a";
  w.strokeStyle = "#5a3d00";
  w.lineWidth = 2;
  w.beginPath();
  w.moveTo(-9, -150);
  w.lineTo(9, -150);
  w.lineTo(0, -134);
  w.closePath();
  w.fill();
  w.stroke();

  w.restore();
}

// Chip (Einsatz) auswählen
$("chips").onclick = event => {
  const button = event.target.closest(".chip");
  if (!button || spinning) return;
  chipValue = +button.dataset.v;
  document.querySelectorAll(".chip").forEach(item => {
    item.classList.toggle("on", item === button);
  });
};

// Wette auswählen (Rot, Schwarz, Zahl …)
$("bets").onclick = event => {
  const button = event.target.closest(".bet");
  if (!button || spinning) return;
  betType = button.dataset.t;
  document.querySelectorAll(".bet").forEach(item => {
    item.classList.toggle("on", item === button);
  });
};

// Drehen: Einsatz abziehen, Ergebnis vorab auslosen, Rad 5 s lang animiert auf das Ergebnis drehen
$("spin").onclick = () => {
  if (spinning) return;
  const result = $("res");

  if (coins < chipValue) {
    result.textContent = "Zu wenig Münzen für diesen Einsatz!";
    return;
  }

  const pickedNumber = clamp(parseInt($("num").value) || 0, 0, 36); // gewählte Zahl (Wette "ZAHL")
  coins -= chipValue;
  wallet();
  spinning = true;

  // Gewinnzahl zufällig bestimmen
  const index = Math.floor(Math.random() * 37);
  const number = ORDER[index];

  // Zielwinkel: Das Gewinnfach muss am Ende oben (beim Zeiger) stehen
  const target = ((-Math.PI / 2 - index * SEG) % FULL + FULL) % FULL;
  const startRotation = wheelRot;
  // Strecke bis zum Ziel + 6 volle Umdrehungen
  const delta = ((target - startRotation) % FULL + FULL) % FULL + FULL * 6;

  const duration = 5000;                         // Dauer in ms
  const startTime = performance.now();
  result.textContent = "Viel Glück!";

  let tick = 0;                                  // für das Klack-Geräusch

  function animate(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3); // "ease-out": am Anfang schnell, am Ende langsam

    wheelRot = startRotation + delta * eased;

    // 40 Klack-Töne über die gesamte Drehung
    if (Math.floor(progress * 40) !== tick) {
      tick = Math.floor(progress * 40);
      beep(700 + tick * 5, .03, "square", .02);
    }

    // Kugel kreist gegen die Drehrichtung und spiralt nach innen
    drawWheel(wheelRot, {
      a: -Math.PI / 2 - (1 - eased) * Math.PI * 10,
      r: 142 - 24 * eased
    });

    $("spin").style.transform = "rotate(" + wheelRot + "rad)"; // Dreh-Knopf dreht mit
    knobRot = wheelRot;

    if (progress < 1) {                          // noch nicht fertig → nächster Frame
      requestAnimationFrame(animate);
      return;
    }

    // --- Auswertung ---
    let winnings = 0;
    const color = numberColor(number);

    // Einfache Chancen zahlen ×2
    if ((betType === "red" && color === "red") ||
        (betType === "black" && color === "black") ||
        (betType === "even" && number > 0 && number % 2 === 0) ||
        (betType === "odd" && number % 2 === 1)) {
      winnings = chipValue * 2;
    }
    // Grün (0) und Einzelzahl zahlen ×36
    if ((betType === "green" && number === 0) ||
        (betType === "num" && number === pickedNumber)) {
      winnings = chipValue * 36;
    }

    coins += winnings;
    if (winnings > chipValue) stat("won", winnings - chipValue);
    stat("spins");
    wallet();
    spinning = false;

    const colorName = { red: "Rot", black: "Schwarz", green: "Grün" }[color];
    const displayColor = color === "red" ? "#ff6b6b" : color === "green" ? "#4be07c" : "#fff";

    $("res").innerHTML =
      'Die Kugel fällt auf <b style="color:' + displayColor + '">' +
      number + " (" + colorName + ")</b> – " +
      (winnings
        ? "🎉 Gewinn +" + (winnings - chipValue) + " 🪙"
        : "verloren −" + chipValue + " 🪙");

    if (winnings) winFx(winnings >= chipValue * 10); else beep(180, .4, "sawtooth", .07, 80);
  }

  requestAnimationFrame(animate);
};


/* =====================================================================
   7. PLINKO
   ===================================================================== */

let knobRot = 0;          // Drehung des runden Dreh-Knopfes (Roulette)
let plinkoActive = false; // true, wenn der Plinko-Reiter offen ist
let plinkoBalls = [];     // aktuell fallende Kugeln

const plinkoCtx = $("pl").getContext("2d");
const PAYOUTS = [5, 2, 1, .4, .2, .4, 1, 2, 5];  // Multiplikatoren der 9 Fächer unten
const pegs = [];                                       // Stifte (Hindernisse)

// Stifte als Dreieck anordnen: 8 Reihen mit 3, 4, 5 … 10 Stiften
for (let row = 0; row < 8; row++) {
  const count = row + 3;
  for (let j = 0; j < count; j++) {
    pegs.push({
      x: 150 + (j - (count - 1) / 2) * 33,   // zentriert, 33 px Abstand
      y: 50 + row * 34
    });
  }
}

// Plinko-Physik: bewegt Kugeln, prüft Kollisionen mit Wand/Stiften, zahlt unten aus
function plinkoStep(dt) {
  const steps = 3;                           // 3 kleine Teilschritte pro Frame → genauere Kollisionen
  const stepTime = Math.min(dt, .033) / steps;

  plinkoBalls.forEach(ball => {
    for (let step = 0; step < steps; step++) {
      ball.vy += 700 * stepTime;             // Schwerkraft
      ball.x += ball.vx * stepTime;
      ball.y += ball.vy * stepTime;

      if (ball.x < 6) {                      // linke Wand: abprallen (gedämpft)
        ball.x = 6;
        ball.vx = Math.abs(ball.vx) * .5;
      }
      if (ball.x > 294) {                    // rechte Wand
        ball.x = 294;
        ball.vx = -Math.abs(ball.vx) * .5;
      }

      // Kollision mit jedem Stift
      pegs.forEach(peg => {
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const distance = Math.hypot(dx, dy);
        const minDistance = 10;              // Kugelradius + Stiftradius

        if (distance < minDistance && distance > 0) {
          const nx = dx / distance;          // Richtung weg vom Stift (normiert)
          const ny = dy / distance;
          const velocity = ball.vx * nx + ball.vy * ny; // Geschwindigkeit in Richtung Stift

          if (velocity < 0) {                // Kugel fliegt auf den Stift zu → reflektieren
            ball.vx -= 1.6 * velocity * nx;
            ball.vy -= 1.6 * velocity * ny;
            ball.vx += rnd(-12, 12);         // kleiner Zufall, damit es nicht vorhersehbar ist
          }
          ball.x = peg.x + nx * minDistance; // aus dem Stift herausschieben
          ball.y = peg.y + ny * minDistance;
        }
      });
    }

    // Kugel unten angekommen → Fach bestimmen und auszahlen
    if (ball.y > 335 && !ball.done) {
      ball.done = true;
      const slot = clamp(Math.floor(ball.x / (300 / 9)), 0, 8);
      const winnings = Math.round(ball.bet * PAYOUTS[slot]);

      coins += winnings;
      wallet();

      $("res").textContent =
        "Plinko ×" + PAYOUTS[slot] + " → " +
        (winnings >= ball.bet ? "+" : "") +
        (winnings - ball.bet) + " 🪙";

      if (winnings > ball.bet) stat("won", winnings - ball.bet);
      if (winnings > ball.bet) winFx(winnings >= ball.bet * 4); else beep(winnings >= ball.bet ? 880 : 200, .2, "triangle", .06);
    }
  });

  plinkoBalls = plinkoBalls.filter(ball => !ball.done); // fertige Kugeln entfernen
}

// Zeichnet Stifte, Gewinnfächer und fallende Kugeln
function plinkoDraw() {
  const p = plinkoCtx;
  p.clearRect(0, 0, 300, 360);

  p.fillStyle = "#fff";                      // Stifte
  pegs.forEach(peg => {
    p.beginPath();
    p.arc(peg.x, peg.y, 4, 0, FULL);
    p.fill();
  });

  // Fächer unten: rot (≥×3), orange (≥×1), blau (Verlust)
  PAYOUTS.forEach((multiplier, index) => {
    p.fillStyle = multiplier >= 3 ? "#e53935" : multiplier >= 1 ? "#ff9800" : "#1e88e5";
    p.fillRect(index * 33.3 + 1, 338, 31, 20);

    p.fillStyle = "#fff";
    p.font = "bold 12px Nunito, sans-serif";
    p.textAlign = "center";
    p.fillText("×" + multiplier, index * 33.3 + 16.6, 353);
  });

  plinkoBalls.forEach(ball => {              // Kugeln (gold)
    p.fillStyle = "#ffd54a";
    p.beginPath();
    p.arc(ball.x, ball.y, 6, 0, FULL);
    p.fill();
  });
}

// Wechselt zwischen Roulette ("R") und Plinko ("P"):
// Elemente mit Klasse .rv gehören zu Roulette, .pv zu Plinko
// Wechselt das Casino-Spiel: R = Roulette, P = Plinko, B = Blackjack, C = Hütchenspiel
function setCasinoTab(tab) {
  curTab = tab; plinkoActive = tab === "P";
  [["rv", "R"], ["pv", "P"], ["bv", "B"], ["cv", "C"]].forEach(([cls, t]) => document.querySelectorAll("." + cls).forEach(el => el.classList.toggle("hid", tab !== t)));
  $("res").textContent = "Viel Glück!";
  if (plinkoActive) plinkoDraw();
  if (tab === "B") bjReset();
  if (tab === "C") cupsReset();
}


// Ball fallen lassen: Einsatz abziehen und neue Kugel oben in der Mitte erzeugen
$("drop").onclick = () => {
  if (coins < chipValue) {
    $("res").textContent = "Zu wenig Münzen!";
    return;
  }
  coins -= chipValue;
  wallet();

  plinkoBalls.push({
    x: 150 + rnd(-6, 6),   // leicht zufällige Startposition
    y: 12,
    vx: rnd(-10, 10),
    vy: 0,
    bet: chipValue         // Einsatz merken für die Auszahlung
  });

  beep(500, .05, "triangle", .04);
};

// Dreh-Knopf per Maus/Touch ziehen (nur optische Drehung, startet kein Spiel)
{
  const button = $("spin");
  let startAngle = null;   // Winkel beim Drücken
  let dragAngle = 0;       // seitdem gedrehter Winkel

  // Winkel des Zeigers relativ zur Mitte des Knopfes
  const pointerAngle = event => {
    const rect = button.getBoundingClientRect();
    return Math.atan2(
      event.clientY - rect.top - rect.height / 2,
      event.clientX - rect.left - rect.width / 2
    );
  };

  button.onpointerdown = event => {
    if (spinning) return;
    startAngle = pointerAngle(event);
    button.setPointerCapture(event.pointerId);   // Events auch außerhalb des Knopfes empfangen
  };

  button.onpointermove = event => {
    if (startAngle === null || spinning) return;
    dragAngle = pointerAngle(event) - startAngle;
    button.style.transform = "rotate(" + (knobRot + dragAngle) + "rad)";
  };

  button.onpointerup = () => {
    knobRot += dragAngle;  // Drehung übernehmen
    startAngle = null;
    dragAngle = 0;
  };
}


/* =====================================================================
   8. SHOP
   ===================================================================== */

const STD = ["ak", "mp", "snip", "mini", "rpg"], SEAS = ["ice", "lava", "flame"];   // Standard- und Saisonwaffen
let armSec = "S", armIdx = 0, shopIdx = 0, swapDir = 0;   // swapDir = Richtung der Wechsel-Animation
const dots = (n, on) => `<div class="dots">${Array.from({ length: n }, (_, i) => `<i class="${i === on ? "on" : ""}"></i>`).join("")}</div>`;   // Abschnitt, Waffe im Arsenal, Artikel im Shop
const curList = () => armSec === "S" ? STD : SEAS;

// Baut Arsenal (eine Waffe auf Drehteller, Standard/Saisonal) bzw. Shop (ein Artikel im Regal) – ◀ ▶ blättern an den Seiten
function renderShop() {
  $("sCoins").textContent = coins;
  const arsenal = shopTab === "A";
  $("shopTitle").textContent = arsenal ? "ARSENAL · LEVEL " + playerLevel() : "SHOP";
  $("vendor").innerHTML = arsenal ? "" : vendorSVG("🐻", "🧢");
  $("shop").classList.toggle("garageBg", arsenal);
  const btn = (a, label, style = "") => `<button class="btn small ${style}" data-a="${a}">${label}</button>`;
  const arrows = `<button class="arrow l" data-a="n:-1">◀</button><button class="arrow r" data-a="n:1">▶</button>`;
  let html = "";

  if (arsenal) {
    const key = curList()[armIdx % curList().length], w = WEAPONS[key];
    const locked = gameMode !== "Rangliste" && playerLevel() < w.level, own = inv.own[key];
    const action = locked ? "" : own
      ? btn("e:" + key, inv.cur === key ? "✔ Aktiv" : "Ausrüsten", inv.cur === key ? "green" : "") +
        btn("a:" + key + ":" + w.packPrice + ":" + w.packSize, "+" + w.packSize + " 🪙" + w.packPrice, "blue")
      : (SEAS.includes(key) && gameMode === "Kampagne" ? btn("w:" + key + ":" + w.fish + ":f", "Kaufen 🐟" + w.fish) : btn("w:" + key + ":" + w.price, "Kaufen 🪙" + w.price));
    html = `<div class="row tabs">${btn("t:S", "Standard", armSec === "S" ? "green" : "blue")}${btn("t:X", "❄️🔥 Saisonal", armSec === "X" ? "green" : "blue")}</div>
      <div class="garage">${arrows}<div class="spinner ${locked ? "locked" : ""} ${swapDir ? "sw" : ""}" style="--d:${swapDir * 30}cqw">${svgGun(key, 200)}${locked ? '<div class="lockov">⛓️🔒⛓️</div>' : ""}</div>
      <div class="plate"></div><h3>${locked ? "???" : w.name}</h3>
      <small>${locked ? "Freischaltung ab Level " + w.level : "Schaden " + w.damage + " · Magazin " + w.mag + " · Munition " + (inv.ammo[key] || 0)}</small>
      <div class="row">${action}</div>${dots(curList().length, armIdx)}</div>`;
  } else {
    const k = inv.cur || "ak", w = WEAPONS[k], cap = k === "snip" ? 30 : 240;
    const items = [
      [candySVG(), "Eisbonbon (Slow-Mo)", "Besitz " + inv.bottles + " / 5", (playerLevel() < 10 ? '<span class="lockn">Ab Level 10</span>' : btn("b:300:1", "🪙300"))],
      [ammoSVG(), w.name + " Munition", "Besitz " + (inv.ammo[k] || 0) + " / " + cap, btn("a:" + k + ":" + w.packPrice + ":" + w.packSize, "+" + w.packSize + " 🪙" + w.packPrice, "blue")],
      [ammoSVG(), "⭐ Munition ×3 −50%", "nur heute", btn("a:" + k + ":" + Math.round(w.packPrice * 1.5) + ":" + w.packSize * 3, "🪙" + Math.round(w.packPrice * 1.5), "blue")]
    ];
    const it = items[shopIdx % 3], lk = shopIdx % 3 === 0 && playerLevel() < 10;
    html = `<div class="garage shelf">${arrows}<div class="spinner ${lk ? "locked" : ""} ${swapDir ? "sw" : ""}" style="--d:${swapDir * 30}cqw">${it[0]}</div>${lk ? `<div class="lockov3">${lockSVG(64)}</div>` : ""}<div class="plate"></div><h3>${it[1]}</h3><small>${it[2]}</small><div class="row">${it[3]}</div>${dots(3, shopIdx % 3)}</div>`;
  }
  $("list").innerHTML = html;
  swapDir = 0;
}

// Klick auf einen Shop-Button: Aktion auslesen, Preis prüfen, kaufen/ausrüsten
$("list").onclick = event => {
  const clicked = event.target.closest("button");
  if (!clicked) return;

  const parts = clicked.dataset.a.split(":");   // z. B. ["w", "snip", "350"]
  const action = parts[0];
  if (action === "n") {   // weiterblättern (Arsenal: Waffe, Shop: Artikel)
    const len = shopTab === "A" ? curList().length : 3, d = +parts[1];
    if (shopTab === "A") armIdx = (armIdx + d + len) % len; else shopIdx = (shopIdx + d + len) % len;
    swapDir = d; renderShop(); beep(600, .05, "triangle", .05);
    return;
  }
  if (action === "t") { armSec = parts[1]; armIdx = 0; renderShop(); return; }   // Standard/Saisonal
  // Preis: "e" kostet nichts; bei "b" steht er an Stelle 1, sonst an Stelle 2
  const fishBuy = action === "w" && parts[3] === "f";   // Saisonwaffen kosten Fische
  const price = fishBuy || action === "e" ? 0 : +(action === "b" ? parts[1] : parts[2]);
  const fishCost = fishBuy ? +parts[2] : 0;

  const cap = parts[1] === "snip" ? 30 : 240;   // Munitionslimit (Sniper 30, sonst 240)
  if (action === "a" && (inv.ammo[parts[1]] || 0) + +parts[3] > cap) { clicked.textContent = "Voll!"; return; }
  if (action === "b" && inv.bottles >= 5) { clicked.textContent = "Max 5!"; return; }
  if (fishCost > inv.fish) { clicked.textContent = "Zu wenig 🐟"; return; }
  inv.fish -= fishCost;
  if (price > coins) {
    clicked.textContent = "Zu wenig!";
    return;
  }
  coins -= price;

  if (action === "w") {                          // Waffe kaufen: besitzen, erstes Munitionspaket, ausrüsten
    inv.own[parts[1]] = 1;
    inv.ammo[parts[1]] = (inv.ammo[parts[1]] || 0) + WEAPONS[parts[1]].packSize;
    inv.cur = parts[1];
  } else if (action === "a") {                   // Munition kaufen
    inv.ammo[parts[1]] = (inv.ammo[parts[1]] || 0) + +parts[3];
  } else if (action === "b") {                   // Flaschen kaufen
    inv.bottles += +parts[2];
  } else {                                       // "e": Waffe ausrüsten
    inv.cur = parts[1];
  }

  if (price > 0) buyFx(clicked, price, action === "w" ? 1 : action === "a" ? +parts[3] : +parts[2], action === "w" ? WEAPONS[parts[1]].icon : action === "a" ? "🔸" : "🍬");
  saveInv();
  wallet();
  renderShop();                                  // Liste neu aufbauen (Preise/Status aktualisieren)
  beep(900, .1, "triangle", .05, 1400);
};


/* =====================================================================
   9. GRAFIKEN (Produkte, Händler) & Casino-Klicksounds
   ===================================================================== */
const svgW = inner => `<svg width="56" height="30" viewBox="0 0 56 30" style="vertical-align:middle">${inner}</svg>`;
const WCOL = { ak: "#8d6e4a", mp: "#607d8b", snip: "#455a64", mini: "#9e9e9e", ice: "#4fc3f7", lava: "#ff6d00" };

// Waffendesigns (viewBox 120x50, Mündung rechts) – dienen im Shop UND im Spiel
const GUN = {
  ak: '<rect x="18" y="12" width="84" height="14" rx="3" fill="#9aa0a8" stroke="#333" stroke-width="2"/><path d="M26 26 L40 26 L34 46 L20 46Z" fill="#4a3426" stroke="#222" stroke-width="2"/><rect x="98" y="15" width="12" height="7" fill="#555"/><rect x="44" y="24" width="14" height="4" fill="#333"/>',
  mp: '<rect x="12" y="14" width="78" height="14" rx="3" fill="#607d8b" stroke="#222" stroke-width="2"/><rect x="88" y="17" width="26" height="6" fill="#455a64"/><path d="M44 28 H56 V48 H44Z" fill="#37474f" stroke="#222" stroke-width="2"/><path d="M8 14 L22 14 L22 34 L8 30Z" fill="#37474f"/><rect x="26" y="26" width="10" height="16" fill="#222"/>',
  snip: '<rect x="4" y="16" width="30" height="14" rx="3" fill="#6d4c41" stroke="#222" stroke-width="2"/><rect x="30" y="19" width="88" height="7" fill="#37474f" stroke="#222" stroke-width="2"/><rect x="44" y="8" width="30" height="8" rx="3" fill="#111"/><rect x="60" y="26" width="3" height="14" fill="#222"/><circle cx="46" cy="12" r="5" fill="#4fc3f7"/>',
  mini: '<rect x="8" y="14" width="30" height="24" rx="6" fill="#757575" stroke="#222" stroke-width="2"/><rect x="38" y="10" width="76" height="6" fill="#bdbdbd" stroke="#222"/><rect x="38" y="20" width="76" height="6" fill="#9e9e9e" stroke="#222"/><rect x="38" y="30" width="76" height="6" fill="#bdbdbd" stroke="#222"/><rect x="60" y="8" width="5" height="30" fill="#424242"/><circle cx="23" cy="26" r="6" fill="#ff5252"/>',
  ice: '<path d="M6 20 L40 10 L108 18 L116 25 L108 32 L40 36 L6 30Z" fill="#8fe3ff" stroke="#e8fbff" stroke-width="2"/><path d="M50 10 L56 0 L62 12Z M72 12 L80 2 L84 14Z" fill="#d6f6ff"/><path d="M30 34 L40 48 L52 36Z" fill="#4fc3f7"/><circle cx="26" cy="22" r="5" fill="#fff"/>',
  lava: '<path d="M6 18 L96 14 L114 22 L96 32 L6 34Z" fill="#2b2b2b" stroke="#111" stroke-width="2"/><path d="M20 20 L40 20 L36 28 L18 28Z M52 18 L78 18 L74 26 L50 26Z" fill="#ff6d00"/><circle cx="104" cy="22" r="6" fill="#ffab00"/><path d="M30 34 L40 34 L36 48 L26 48Z" fill="#5a1a00"/>',
  rpg: '<rect x="10" y="16" width="76" height="14" rx="4" fill="#556b2f" stroke="#222" stroke-width="2"/><path d="M86 12 L116 23 L86 34Z" fill="#c62828" stroke="#222" stroke-width="2"/><rect x="2" y="14" width="12" height="18" fill="#37474f"/><path d="M40 30 L50 30 L46 46 L36 46Z" fill="#3e2723"/><rect x="58" y="8" width="14" height="8" fill="#222"/>',
  flame: '<rect x="6" y="14" width="40" height="22" rx="8" fill="#ef6c00" stroke="#222" stroke-width="2"/><rect x="46" y="20" width="52" height="8" fill="#616161" stroke="#222" stroke-width="2"/><path d="M98 24 C104 12 112 14 116 6 C118 18 112 30 98 24Z" fill="#ffca28" stroke="#e65100"/><path d="M30 36 L38 36 L34 48 L26 48Z" fill="#333"/>'
};
const svgGun = (k, w) => `<svg viewBox="0 0 120 50" width="${w}" height="${w * .42}" style="vertical-align:middle">${GUN[k]}</svg>`;
const weaponSVG = k => svgGun(k, 56);
const gunImgs = {};
// Bild der Waffe fürs Canvas (wird einmal erzeugt und gespeichert)
function gunImg(k) {
  if (!gunImgs[k]) {
    const im = new Image();
    im.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 50">' + GUN[k] + "</svg>");
    gunImgs[k] = im;
  }
  return gunImgs[k];
}
const ammoSVG = () => svgW([10, 24, 38].map(x => `<rect x="${x}" y="6" width="8" height="20" rx="2" fill="#ffc107"/>`).join(""));
const candySVG = () => svgW('<path d="M14 15 L2 8 V22Z M42 15 L54 8 V22Z" fill="#bfefff"/><circle cx="28" cy="15" r="11" fill="#2a9df4" stroke="#fff" stroke-width="2"/>');

// Tier-Händler: Tier-Gesicht (Emoji) frei sichtbar, Hut sitzt OBEN auf dem Kopf, Eistisch davor
const vendorSVG = (animal, hat) => `<svg viewBox="0 0 100 80" width="150" height="120"><text x="50" y="58" font-size="44" text-anchor="middle" style="font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${animal}</text><text x="50" y="22" font-size="26" text-anchor="middle" style="font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${hat}</text><rect x="8" y="58" width="84" height="18" rx="4" fill="#bfe8ff" stroke="#5aa6d6" stroke-width="2"/></svg>`;


// Klick-Sound für alle Casino-Buttons
$("casino").addEventListener("click", e => { if (e.target.closest("button")) beep(700, .05, "triangle", .05, 1000); });

WCOL.rpg = "#556b2f"; WCOL.flame = "#ff9800";

// Casino-Hub: zwei Eisstände mit Händlern; Klick öffnet das jeweilige Spiel
$("stands").innerHTML =
  `<div class="stand" data-g="R">${vendorSVG("🦊", "🎩")}<b>♠ ROULETTE</b></div>` +
  `<div class="stand" data-g="P">${vendorSVG("🐰", "👑")}<b>⚪ PLINKO</b></div>` +
  `<div class="stand" data-g="B">${vendorSVG("🐺", "🃏")}<b>🃏 BLACKJACK</b></div>` +
  `<div class="stand" data-g="C">${vendorSVG("🦉", "🪄")}<b>🥤 HÜTCHEN</b></div>`;
$("stands").onclick = e => {
  const stand = e.target.closest(".stand");
  if (!stand) return;
  setCasinoTab(stand.dataset.g);
  $("stands").classList.add("hid");
  $("game").classList.remove("hid");
  drawWheel(wheelRot, null);
};
function casinoHub() {
  $("stands").classList.remove("hid");
  $("game").classList.add("hid");
}

// Einstellungen: Regler schreiben direkt in "set" und speichern
[["vMaster", "master", "fc_vm"], ["vMusic", "music", "fc_vmu"], ["vSfx", "sfx", "fc_vsfx"], ["vGfx", "gfx", "fc_gfx"]].forEach(([id, k, key]) => {
  $(id).value = set[k];
  $(id).oninput = () => { set[k] = +$(id).value; save(key, set[k]); beep(660, .08, "triangle", .06); };
});
$("bSet").onclick = () => showScreen("settings");
$("setBack").onclick = () => showScreen("menu");

// Tägliche Belohnung: einmal pro Tag, Betrag steigt mit der Serie (Tag 1–7), jeder 3. Tag + Eisbonbon
const dayKey = new Date().toDateString();
const lastDaily = () => { try { return localStorage.getItem("fc_daily"); } catch { return null; } };
function chestUI() {
  const done = lastDaily() === dayKey;
  $("bChest").classList.toggle("ready", !done);
  $("bChest").classList.toggle("done", done);
  $("chestTxt").textContent = done ? "Morgen wieder!" : "TÄGLICHE BELOHNUNG!";
}
$("bChest").onclick = () => {
  if (lastDaily() === dayKey) { beep(150, .2, "square", .05); return; }
  const streak = (load("fc_streak", 0) % 7) + 1;
  const reward = 50 * streak;
  coins += reward;
  if (streak % 3 === 0) inv.bottles = Math.min(5, inv.bottles + 1);
  save("fc_streak", streak);
  try { localStorage.setItem("fc_daily", dayKey); } catch {}
  saveInv(); wallet(); chestUI();
  $("chestTxt").textContent = "+" + reward + " 🪙" + (streak % 3 === 0 ? " +🍬" : "") + " (Tag " + streak + ")";
  [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => beep(f, .15, "triangle", .07), i * 90));
};
chestUI();


/* =====================================================================
   10. STATUS-EFFEKTE (Eis/Feuer) & CASINO-EFFEKTE
   ===================================================================== */
// Eis-Treffer: 1,6 s eingefroren; Feuer-Treffer: 2,2 s Brand
function status(e, b) {
  if (b.freeze) e.frozen = 1.6;
  if (b.burn) e.burn = 2.2;
}
// Pro Frame: Brandschaden alle 0,5 s; liefert 0 (steht still) wenn eingefroren, sonst 1
function tick(e, dt) {
  if (e.burn > 0) {
    e.burn -= dt;
    e.bt = (e.bt || 0) + dt;
    if (e.bt > .5) { e.bt = 0; e.hp -= 1; boom(e.x + 20, e.y || GY - 20, "#ff6d00", 3, 80); }
  }
  if (e.frozen > 0) { e.frozen -= dt; return 0; }
  return 1;
}
// Anzeige: blauer Eisblock bzw. 🔥 über dem Gegner
function mark(e, x, y) {
  if (e.frozen > 0) { ctx.fillStyle = "#9fe8ffaa"; ctx.fillRect(x - 42, y - 30, 84, 54); }
  if (e.burn > 0) text("🔥", x, y - 10, 26);
}

// Gewinn-Effekt im Casino: goldener Rahmen, Münzregen, Gewinn-Jingle
function winFx(big) {
  const box = $("casino");
  box.classList.add("win");
  setTimeout(() => box.classList.remove("win"), 900);
  for (let i = 0; i < (big ? 30 : 14); i++) {
    const s = document.createElement("span");
    s.className = "coinfx";
    s.textContent = "🪙";
    s.style.left = rnd(4, 92) + "%";
    s.style.animationDelay = rnd(0, .6) + "s";
    box.appendChild(s);
    setTimeout(() => s.remove(), 2400);
  }
  [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => beep(f, .22, "triangle", .09, f * 1.02), i * 90));
  setTimeout(() => { beep(1568, .7, "sine", .08); noise(.4, 6000, .15); if (big) beep(2093, .8, "triangle", .07); }, 600);
}

// Hebel: Knopf nach unten ziehen (mind. 70 %) oder antippen → dreht das Rad
{
  const knob = $("knob"), lever = $("lever");
  let startY = null, dy = 0, maxDy = 1;
  knob.onpointerdown = e => {
    if (spinning) return;
    startY = e.clientY; dy = 0;
    maxDy = lever.clientHeight - knob.offsetHeight - 12;
    knob.setPointerCapture(e.pointerId);
  };
  knob.onpointermove = e => {
    if (startY === null) return;
    dy = clamp(e.clientY - startY, 0, maxDy);
    knob.style.top = (6 + dy) + "px";
  };
  knob.onpointerup = () => {
    if (startY === null) return;
    const trigger = dy > maxDy * .7 || dy < 6;   // weit gezogen oder getippt
    startY = null; dy = 0;
    knob.style.transition = "top .3s";
    knob.style.top = "";
    setTimeout(() => { knob.style.transition = ""; }, 300);
    beep(250, .12, "square", .06, 120);
    if (trigger) $("spin").click();
  };
}


// Musik startet erst nach dem ersten Klick auf einen Button
let musicOn = false;
document.addEventListener("click", e => { if (e.target.closest("button")) musicOn = true; });

// Hilfe-Buch öffnen/schließen
$("help").onclick = () => $("book").classList.remove("hid");
$("bookClose").onclick = () => $("book").classList.add("hid");
$("book").onclick = e => { if (e.target.id === "book") $("book").classList.add("hid"); };

lvlUI();   // Level-Balken beim Start füllen


/* =====================================================================
   11. PAUSE, MUTE, MODI, RESET, EISZAPFEN-FARBEN
   ===================================================================== */
const ICE = [["#e3f6ff", "#9fdcff", "#5db8ec"], ["#d6e8ff", "#8fb4ff", "#5a7de0"], ["#e0fff8", "#8fe6dc", "#4fb3b3"]];   // Eis-Farbvarianten

// Pause: 0 = läuft, 1 = pausiert, 2 = 3-s-Countdown
let pauseState = 0, countT = 0;
function togglePause() {
  if (mode === "play" && pauseState === 0) {
    pauseState = 1; shootHeld = false;
    beep(500, .12, "triangle", .07, 300);
    $("pause").classList.remove("hid");
  } else if (pauseState === 1) resume();
}
function resume() {
  beep(300, .12, "triangle", .07, 600);
  $("pause").classList.add("hid");
  pauseState = 2; countT = 1.5;
  $("count").classList.remove("hid");
}
$("pResume").onclick = resume;
$("pMenu").onclick = () => { pauseState = 0; $("pause").classList.add("hid"); toMenu(); };

// Stumm-Schalter (Lautsprecher) oben rechts im Menü
function muteUI() {
  $("mute").classList.toggle("off", muted);
  $("muteIc").textContent = muted ? "🔈" : "🔊";
}
$("mute").onclick = () => { muted = !muted; save("fc_mute", muted ? 1 : 0); muteUI(); };
muteUI();

// Modus-Auswahl (Kampagne/Rangliste – beide führen vorerst ins normale Menü)
let gameMode = "Kampagne";
const modeUI = () => {
  $("bMode").textContent = "⇄ " + gameMode.toUpperCase();
  $("menu").classList.toggle("rank", gameMode === "Rangliste");
  $("bPlay").textContent = gameMode === "Rangliste" ? "▶ SPIELEN" : story.seen1 ? "▶ FORTSETZEN" : "▶ START";   // anderes Menü (weißer Saal, roter Teppich)
};
$("bCamp").onclick = () => { gameMode = "Kampagne"; modeUI(); showScreen("menu"); };
$("bRank").onclick = () => { gameMode = "Rangliste"; modeUI(); showScreen("menu"); };
$("bMode").onclick = () => showScreen("modes");
modeUI();

// Alles zurücksetzen (zweifach bestätigen): XP, Münzen, Munition, Bonbons, Stats
$("bReset").onclick = () => {
  if (!confirm("Wirklich alles zurücksetzen?")) return;
  if (!confirm("Wirklich KOMPLETT sicher? XP, Münzen, Munition, Bonbons und Stats gehen verloren!")) return;
  coins = 0; best = 0; xp = 0;
  inv = { own: {}, ammo: {}, cur: "", bottles: 0, fish: 0 };
  ["fc_streak", "fc_daily"].forEach(k => { try { localStorage.removeItem(k); } catch {} });
  save("fc_best", 0); save("fc_xp", 0);
  saveInv(); wallet(); lvlUI(); chestUI(); reset(); mode = "menu"; stats = {}; save("fc_stats", "{}"); showScreen("modes");
  beep(200, .4, "sawtooth", .08, 60);
};


/* =====================================================================
   12. ERSTE WAFFE, POP-UP, KAUF-ANIMATION, ZEITSTRAHL
   ===================================================================== */
// Erfolgs-Sound
function achievement() { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => beep(f, .3, "triangle", .09, f * 1.02), i * 110)); setTimeout(() => noise(.4, 8000, .12), 450); }

// Drehende Pistole als Pickup mit Schein
function drawWPick() {
  ctx.save(); ctx.translate(wPick.x, wPick.y + Math.sin(time * 4) * 6);
  ctx.fillStyle = "#ffd54a44"; ctx.beginPath(); ctx.arc(0, 0, 90, 0, FULL); ctx.fill();
  ctx.scale(Math.cos(time * 3), 1);
  const im = gunImg("ak"); if (im.complete) ctx.drawImage(im, -72, -31, 144, 60);
  ctx.restore();
}
// Pop-up "Erste Waffe erhalten" mit drehender Waffe
function drawPopup() {
  if (!popup) return;
  if (pauseState === 0) popup.t -= .016;
  if (popup.t <= 0) { popup = null; return; }
  ctx.save(); ctx.globalAlpha = clamp(popup.t, 0, 1);
  ctx.fillStyle = "#0a2236ee"; ctx.strokeStyle = "#ffd54a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(W / 2 - 170, 200, 340, 150, 18); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.translate(W / 2, 270); ctx.scale(Math.cos(time * 3), 1);
  const im = gunImg("ak"); if (im.complete) ctx.drawImage(im, -50, -21, 100, 42);
  ctx.restore();
  text("🏆 ERFOLG!", W / 2, 232, 22, "#ffd54a");
  text("Erste Waffe erhalten!", W / 2, 326, 18);
  text("Beliebige Taste = weiter", W / 2, 343, 12, "#ffd54a");
  ctx.restore();
}

// Kauf-Animation über dem Button: −Preis (rot) 🪙 → +Menge (grün) Item
function buyFx(btn, price, plus, icon) {
  const app = $("app").getBoundingClientRect(), r = btn.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "buyfx";
  el.style.left = (r.left - app.left + r.width / 2) + "px";
  el.style.top = (r.top - app.top) + "px";
  el.innerHTML = `<span class="r">−${price}</span> 🪙 <span class="g">+${plus}</span> ${icon}`;
  $("app").appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// Level-Zeitstrahl: seitlich wischen/ziehen, 3 Stufen sichtbar, XP-Balken verbindet die Stufen
const lockSVG = w => `<svg viewBox="0 0 40 50" width="${w}"><rect x="6" y="20" width="28" height="26" rx="4" fill="#cfd8dc" stroke="#455a64" stroke-width="3"/><path d="M12 20 V13 a8 8 0 0 1 16 0 V20" fill="none" stroke="#cfd8dc" stroke-width="5"/><circle cx="20" cy="32" r="4" fill="#455a64"/></svg>`;
$("lvlBox").onclick = () => {
  const cur = lvlInfo(), rw = {};
  ORDERW.forEach(k => { rw[WEAPONS[k].level] = k; });
  rw[10] = "candy";
  let html = "";
  for (let l = 1; l <= 16; l++) {
    const r = rw[l], reached = l <= cur.l;
    const pct = l < cur.l ? 100 : l === cur.l ? 100 * cur.r / cur.n : 0;   // Füllstand des XP-Balkens
    const icon = r === "candy" ? candySVG() : r ? svgGun(r, 80) : "🪙";
    html += `<div class="tile"><div class="seg"><i style="width:${pct}%"></i></div><b>LVL ${l}</b><div class="rw ${reached ? "" : "lk"}">${icon}</div>${!reached && r ? `<span class="lockv">${lockSVG(30)}</span>` : ""}<small>${r === "candy" ? "Eisbonbon-Shop" : r ? WEAPONS[r].name : l > 1 ? "+" + rewardCoins(l) + " Münzen" : "Start"}</small></div>`;
  }
  $("rmList").innerHTML = html;
  $("roadmap").classList.remove("hid");
  const t = $("rmList").children[0];
  $("rmList").scrollLeft = Math.max(0, cur.l - 2) * (t.offsetWidth + 6);
  rmBar();
};
$("rmClose").onclick = () => $("roadmap").classList.add("hid");
{   // Maus-Wischen (Touch scrollt nativ)
  const el = $("rmList"); let sx = null, sl = 0;
  el.onpointerdown = e => { if (e.pointerType === "mouse") { sx = e.clientX; sl = el.scrollLeft; el.style.scrollSnapType = "none"; } };
  addEventListener("pointermove", e => { if (sx !== null) el.scrollLeft = sl - (e.clientX - sx); });
  addEventListener("pointerup", () => { if (sx !== null) { sx = null; el.style.scrollSnapType = ""; } });
}


/* =====================================================================
   13. ZIELEN, STATISTIKEN
   ===================================================================== */
// Maus/Touch → Zielposition in Canvas-Koordinaten
function setAim(e) {
  const r = canvas.getBoundingClientRect();
  aim.x = (e.clientX - r.left) * W / r.width;
  aim.y = (e.clientY - r.top) * H / r.height;
}
canvas.addEventListener("mousemove", setAim);
canvas.addEventListener("touchmove", e => { for (const t of e.touches) if (t.identifier === aimTouch) setAim(t); }, { passive: true });
// Beliebige Eingabe beendet das Pop-up (Spiel läuft direkt weiter)
["keydown", "mousedown", "touchstart"].forEach(t => addEventListener(t, () => { if (pauseState === 3) { pauseState = 0; popup = null; } }, true));

// Gestrichelte Ziellinie + Fadenkreuz (Minecraft-Stil)
function drawAim() {
  if (mode !== "play" && mode !== "ready") return;
  const w = WEAPONS[inv.cur];
  if (w && mode === "play") {
    const mx = bird.x + 10 + Math.cos(aimAng) * (w.length * 2 + 8), my = bird.y + 10 + Math.sin(aimAng) * (w.length * 2 + 8);
    ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = "#ffffffaa"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(aim.x, aim.y); ctx.stroke(); ctx.restore();
  }
}

// Statistiken (gespeichert, verzögert)
let stats = {};
try { stats = JSON.parse(localStorage.getItem("fc_stats")) || {}; } catch {}
let statT = 0;
function stat(k, n = 1) {
  stats[k] = (stats[k] || 0) + n;
  clearTimeout(statT);
  statT = setTimeout(() => save("fc_stats", JSON.stringify(stats)), 800);
}
$("bTrophy").onclick = () => {
  const rows = [["Sprünge", "jumps"], ["Schüsse abgefeuert", "shots"], ["Treffer", "hits"], ["Getötete Mobs", "kills"], ["Münzen gesammelt", "coins"], ["Im Casino gewonnen", "won"], ["Roulette-Drehungen", "spins"], ["Eiszapfen passiert", "pipes"], ["Runden", "runs"]];
  $("statList").innerHTML = rows.map(([n, k]) => `<p><span>${n}</span><b>${stats[k] || 0}</b></p>`).join("") + `<p><span>Rekord</span><b>${best}</b></p><p><span>Level</span><b>${playerLevel()}</b></p>`;
  $("stats").classList.remove("hid");
};
$("statClose").onclick = () => $("stats").classList.add("hid");


/* =====================================================================
   14. LEVEL-MÜNZEN, EIGENE SCROLLLEISTE
   ===================================================================== */
// Levels ohne Waffe/Bonbon geben Münzen, die etwas schneller als linear steigen
const rewardCoins = l => Math.round(15 * l * (1 + l / 10));
const hasUnlock = l => l === 10 || ORDERW.some(k => WEAPONS[k].level === l);
let lvlPaid = load("fc_paid", -1);
if (lvlPaid < 0) lvlPaid = lvlInfo().l;   // bestehende Spielstände bekommen nichts rückwirkend
function payLevels() {
  const L = playerLevel();
  while (lvlPaid < L) { lvlPaid++; if (lvlPaid > 1 && !hasUnlock(lvlPaid)) coins += rewardCoins(lvlPaid); }
  save("fc_paid", lvlPaid); wallet();
}
// Eigene Scrollleiste für den Zeitstrahl (Standard-Scrollbar ist ausgeblendet)
const rmBar = () => {
  const l = $("rmList");
  $("rmThumb").style.width = (100 * l.clientWidth / l.scrollWidth) + "%";
  $("rmThumb").style.left = (100 * l.scrollLeft / l.scrollWidth) + "%";
};
$("rmList").addEventListener("scroll", rmBar);
{
  const tr = $("rmTrack"); let drag = false;
  const move = e => { const r = tr.getBoundingClientRect(), l = $("rmList"); l.scrollLeft = (e.clientX - r.left) / r.width * l.scrollWidth - l.clientWidth / 2; };
  tr.onpointerdown = e => { drag = true; tr.setPointerCapture(e.pointerId); move(e); };
  tr.onpointermove = e => { if (drag) move(e); };
  tr.onpointerup = () => { drag = false; };
}

/* =====================================================================
   15. KONTEN mit Supabase (geräteübergreifend)
   - Passwörter verwaltet Supabase (gehasht), sie stehen nie im Code oder im Browser-Speicher
   - SB_KEY ist der ÖFFENTLICHE anon-Key; geschützt sind die Daten durch Row Level Security
     (jede Person kann nur ihre eigene Zeile in "saves" lesen/schreiben)
   - NIEMALS den service_role-Key hier eintragen oder ins Repository legen
   ===================================================================== */
const SB_URL = "https://fsfbjfwlnnwhpvjqsizt.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZmJqZndsbm53aHB2anFzaXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NTExMDksImV4cCI6MjEwODQyNzEwOX0.K5BIrXcen_9ZXiSOX1IVFBb78P3pw4mpK2JNqecsofw";
const sb = globalThis.supabase ? globalThis.supabase.createClient(SB_URL, SB_KEY) : null;
const gameKeys = () => Object.keys(localStorage).filter(k => k.startsWith("fc_"));   // alle Spielstand-Werte
const mail = name => name.toLowerCase() + "@users.snowjump.app";                      // Benutzername → interne Login-Adresse
let user = null, uid = null, lastPushed = "";
try { user = localStorage.getItem("sj_user"); } catch {}                              // nur der Anzeigename

// Spielstand in die Cloud schreiben (nur wenn er sich geändert hat)
async function push() {
  if (!sb || !uid) return;
  const d = {};
  gameKeys().forEach(k => { d[k] = localStorage.getItem(k); });
  const s = JSON.stringify(d);
  if (s === lastPushed) return;
  lastPushed = s;
  const t = new Date().toISOString();
  const r = await sb.from("saves").upsert({ user_id: uid, data: d, updated_at: t });
  if (r.error) lastPushed = ""; else localStorage.setItem("sj_pushed", String(Date.parse(t)));
}
setInterval(push, 5000);
addEventListener("beforeunload", push);
addEventListener("pagehide", push);
// Cloud-Stand lokal übernehmen
function applyCloud(row) {
  gameKeys().forEach(k => localStorage.removeItem(k));
  Object.entries(row.data || {}).forEach(([k, v]) => { if (k.startsWith("fc_")) localStorage.setItem(k, v); });
  localStorage.setItem("sj_pushed", String(Date.parse(row.updated_at)));
}

let fails = 0, lockUntil = 0;
const msg = (t, ok) => { $("authInfo").textContent = t; $("authInfo").style.color = ok ? "#4be07c" : "#ff8a80"; };
function authUI() {
  const a = !!user;
  checkAdmin();
  $("authTitle").textContent = a ? "KONTO" : "ANMELDEN / REGISTRIEREN";
  ["auUser", "auPass", "auLogin", "auReg"].forEach(id => $(id).classList.toggle("hid", a));
  $("auOut").classList.toggle("hid", !a);
  if (a) msg("Angemeldet als " + user + " – Fortschritt wird online gespeichert.", true); else msg("");
}
async function auth(register) {
  if (!sb) return msg("Server nicht erreichbar (Verbindung/Bibliothek).");
  const name = $("auUser").value.trim(), pw = $("auPass").value;
  if (Date.now() < lockUntil) return msg("Zu viele Versuche – bitte kurz warten.");
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return msg("Benutzername: 3–16 Zeichen (A–Z, 0–9, _).");
  if (pw.length < 6) return msg("Passwort: mindestens 6 Zeichen.");
  const creds = { email: mail(name), password: pw };
  const { data, error } = register ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
  if (error || !data.session) {
    if (!register && ++fails >= 3) lockUntil = Date.now() + 5000 * fails;   // Bremse gegen Raten
    return msg(register ? "Registrierung fehlgeschlagen: " + (error ? error.message : "Bestätigung nötig") : "Name oder Passwort falsch.");
  }
  fails = 0; uid = data.user.id; user = name.toLowerCase();
  localStorage.setItem("sj_user", user);
  if (register) {                                  // neues Konto: aktueller Fortschritt wird hochgeladen
    await push(); authUI(); msg("Konto erstellt!", true);
  } else {                                         // Anmeldung: Cloud-Stand laden, falls vorhanden
    const { data: row } = await sb.from("saves").select("data,updated_at").eq("user_id", uid).maybeSingle();
    if (row) { applyCloud(row); sessionStorage.setItem("sj_auth", "1"); location.reload(); } else { await push(); authUI(); }
  }
  $("auPass").value = "";
}
$("acct").onclick = () => { authUI(); $("auth").classList.remove("hid"); };
$("auClose").onclick = () => $("auth").classList.add("hid");
$("auLogin").onclick = () => auth(false);
$("auReg").onclick = () => auth(true);
$("auPass").onkeydown = e => { if (e.key === "Enter") auth(false); };
$("auOut").onclick = async () => {
  await push();
  if (sb) await sb.auth.signOut();
  gameKeys().forEach(k => localStorage.removeItem(k));
  ["sj_user", "sj_pushed"].forEach(k => localStorage.removeItem(k));
  sessionStorage.setItem("sj_auth", "1");
  location.reload();
};
// Beim Start: bestehende Sitzung wiederherstellen und ggf. neueren Cloud-Stand laden
(async () => {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  if (!data.session) { user = null; localStorage.removeItem("sj_user"); return; }
  uid = data.session.user.id;
  user = data.session.user.email.split("@")[0];
  localStorage.setItem("sj_user", user);
  checkAdmin();
  const { data: row } = await sb.from("saves").select("data,updated_at").eq("user_id", uid).maybeSingle();
  if (row && Date.parse(row.updated_at) > +(localStorage.getItem("sj_pushed") || 0)) { applyCloud(row); location.reload(); }
  else push();
})();

// Nach An-/Abmelden: direkt wieder das Konto-Fenster zeigen statt der Moduswahl
try {
  if (sessionStorage.getItem("sj_auth")) {
    sessionStorage.removeItem("sj_auth");
    showScreen("menu"); authUI(); $("auth").classList.remove("hid");
  }
} catch {}


/* =====================================================================
   16. RANGLISTE (Supabase-Tabelle "scores")
   ===================================================================== */
// Rundenergebnis hochladen: Punkte, Schaden, Münzen (nur Rangliste-Modus + angemeldet)
async function submitScores() {
  if (!sb || !uid || gameMode !== "Rangliste") return;
  const rows = [["points", score], ["damage", runDmg], ["coins", runCoins]]
    .filter(r => r[1] > 0).map(([category, value]) => ({ user_id: uid, username: user, category, value }));
  if (rows.length) await sb.from("scores").insert(rows);
}
let bPeriod = "all", bCat = "points";
// Lädt die Top 10 (bester Wert je Spieler) für Zeitraum + Kategorie
async function loadBoard() {
  const list = $("boardList");
  list.textContent = "Lade …";
  document.querySelectorAll("#bPer button").forEach(b => { b.classList.toggle("green", b.dataset.p === bPeriod); b.classList.toggle("blue", b.dataset.p !== bPeriod); });
  document.querySelectorAll("#bCat button").forEach(b => { b.classList.toggle("green", b.dataset.c === bCat); b.classList.toggle("blue", b.dataset.c !== bCat); });
  if (!sb) { list.textContent = "Server nicht erreichbar."; return; }
  let q = sb.from("scores").select("username,value").eq("category", bCat).order("value", { ascending: false }).limit(100);
  if (bPeriod !== "all") q = q.gte("created_at", periodStart(bPeriod).toISOString());   // täglich ab 0 Uhr, wöchentlich ab Montag 0 Uhr
  const { data, error } = await q;
  if (error) { list.textContent = "Fehler: " + error.message; return; }
  const best = new Map();
  (data || []).forEach(r => { if (!best.has(r.username)) best.set(r.username, r.value); });   // Daten sind absteigend sortiert
  list.textContent = "";
  [...best].slice(0, 10).forEach(([name, value], i) => {                     // Namen nur als Text einfügen (kein HTML)
    const p = document.createElement("p");
    [["#" + (i + 1), "b"], [name, "span"], [String(value), "i"]].forEach(([t, tag]) => { const e = document.createElement(tag); e.textContent = t; p.appendChild(e); });
    list.appendChild(p);
  });
  if (!best.size) list.textContent = "Noch keine Einträge.";
}
$("bBoard").onclick = () => { $("board").classList.remove("hid"); loadBoard(); };
$("boardClose").onclick = () => $("board").classList.add("hid");
$("bPer").onclick = e => { const b = e.target.closest("button"); if (b) { bPeriod = b.dataset.p; loadBoard(); } };
$("bCat").onclick = e => { const b = e.target.closest("button"); if (b) { bCat = b.dataset.c; loadBoard(); } };
modeUI();


/* =====================================================================
   17. BLACKJACK, HÜTCHENSPIEL, GRAFIKEN
   ===================================================================== */
const SUITS = ["♠", "♥", "♦", "♣"], RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const cardVal = r => r === "A" ? 11 : "10JQK".includes(r) ? 10 : +r;
function handVal(h) { let v = h.reduce((s, c) => s + cardVal(c.r), 0), a = h.filter(c => c.r === "A").length; while (v > 21 && a-- > 0) v -= 10; return v; }
let bj = null;
// Karten als Elemente zeichnen (die zweite Dealer-Karte bleibt verdeckt)
function bjShow(reveal) {
  [["bjD", bj.d, !reveal], ["bjP", bj.p, false]].forEach(([id, hand, hide]) => {
    const box = $(id); box.textContent = "";
    hand.forEach((c, i) => {
      const d = document.createElement("div"), cover = hide && i === 1;
      d.className = "card" + (cover ? " back" : /[♥♦]/.test(c.s) ? " red" : "");
      if (!cover) d.textContent = c.r + c.s;
      d.style.animationDelay = i * .08 + "s"; box.appendChild(d);
    });
  });
  $("bjInfo").textContent = "Du: " + handVal(bj.p) + (reveal ? " · Dealer: " + handVal(bj.d) : "");
}
function bjReset() { bj = null; $("bjD").textContent = ""; $("bjP").textContent = ""; $("bjInfo").textContent = "Einsatz wählen & austeilen"; }
function bjDeal() {
  if (bj && bj.on) return;
  if (coins < chipValue) { $("res").textContent = "Zu wenig Münzen!"; return; }
  coins -= chipValue; wallet();
  const deck = []; SUITS.forEach(s => RANKS.forEach(r => deck.push({ s, r })));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  bj = { deck, p: [deck.pop(), deck.pop()], d: [deck.pop(), deck.pop()], bet: chipValue, on: true };
  beep(600, .08, "triangle", .06); $("res").textContent = "Viel Glück!";
  if (handVal(bj.p) === 21) bjEnd(); else bjShow(false);
}
function bjHit() { if (!bj || !bj.on) return; bj.p.push(bj.deck.pop()); beep(700, .06, "triangle", .06); if (handVal(bj.p) > 21) bjEnd(); else bjShow(false); }
function bjStand() { if (!bj || !bj.on) return; while (handVal(bj.d) < 17) bj.d.push(bj.deck.pop()); bjEnd(); }
function bjEnd() {
  bj.on = false;
  const p = handVal(bj.p), d = handVal(bj.d), nat = p === 21 && bj.p.length === 2;
  let w = 0;
  if (p <= 21) { if (d > 21 || p > d) w = nat ? Math.floor(bj.bet * 2.2) : bj.bet * 2; else if (p === d) w = bj.bet; }   // Blackjack zahlt nur 6:5
  coins += w; wallet(); bjShow(true);
  $("res").textContent = p > 21 ? "Überkauft − " + bj.bet : w > bj.bet ? "🎉 Gewinn +" + (w - bj.bet) : w === bj.bet ? "Unentschieden" : "Dealer gewinnt − " + bj.bet;
  if (w > bj.bet) { stat("won", w - bj.bet); winFx(nat); } else beep(180, .3, "sawtooth", .06, 90);
}
$("bjDeal").onclick = bjDeal; $("bjHit").onclick = bjHit; $("bjStand").onclick = bjStand;

// Hütchenspiel: Ball zeigen, 9× mischen, raten – zahlt ×2,7 statt ×3
let cups = null;
const cupSlots = [8, 40, 72];
function cupsDraw() { document.querySelectorAll(".cup").forEach((c, i) => { c.style.left = cupSlots[cups.pos[i]] + "%"; c.classList.remove("up"); }); }
function cupsReset() { cups = { pos: [0, 1, 2], ball: 0, state: "idle" }; cupsDraw(); $("ball").classList.add("hid"); $("cupGo").disabled = false; }
async function cupsGo() {
  if (!cups || cups.state !== "idle") return;
  if (coins < chipValue) { $("res").textContent = "Zu wenig Münzen!"; return; }
  coins -= chipValue; wallet(); cups.bet = chipValue; cups.state = "shuffle"; $("cupGo").disabled = true;
  cups.ball = Math.floor(Math.random() * 3);
  const sleep = ms => new Promise(r => setTimeout(r, ms)), cs = document.querySelectorAll(".cup"), ball = $("ball");
  ball.style.left = (cupSlots[cups.pos[cups.ball]] + 5.5) + "%"; ball.classList.remove("hid");
  cs[cups.ball].classList.add("up"); await sleep(900); cs[cups.ball].classList.remove("up"); await sleep(300); ball.classList.add("hid");
  $("res").textContent = "Folge dem Ball …";
  for (let n = 0; n < 9; n++) {
    const a = Math.floor(Math.random() * 3), b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
    [cups.pos[a], cups.pos[b]] = [cups.pos[b], cups.pos[a]]; cupsDraw(); beep(300 + n * 40, .08, "triangle", .05);
    await sleep(Math.max(230, 420 - n * 25));
  }
  cups.state = "pick"; $("res").textContent = "Wo ist der Ball?";
}
function cupsPick(i) {
  if (!cups || cups.state !== "pick") return;
  cups.state = "done";
  const cs = document.querySelectorAll(".cup"), ball = $("ball");
  cs[cups.ball].classList.add("up"); ball.style.left = (cupSlots[cups.pos[cups.ball]] + 5.5) + "%"; ball.classList.remove("hid");
  if (i === cups.ball) { const w = Math.floor(cups.bet * 2.7); coins += w; wallet(); stat("won", w - cups.bet); $("res").textContent = "🎉 Treffer! +" + (w - cups.bet); winFx(false); }
  else { $("res").textContent = "Daneben − " + cups.bet; beep(180, .3, "sawtooth", .06, 90); }
  setTimeout(() => { if (cups) { cups.state = "idle"; $("cupGo").disabled = false; } }, 1500);
}
$("cupGo").onclick = cupsGo;
$("cups").onclick = e => { const c = e.target.closest(".cup"); if (c) cupsPick([...document.querySelectorAll(".cup")].indexOf(c)); };

// Fallender Eiszapfen (zittert in der Warnphase an der Decke)
function drawFallIce(f) {
  if (storyLevel) {   // Story: fallender Blumentopf
    ctx.save(); ctx.translate(f.x, f.y); ctx.fillStyle = "#b5651d"; ctx.fillRect(-12, -14, 24, 28);
    ctx.fillStyle = "#3a7d2c"; ctx.beginPath(); ctx.arc(0, -18, 12, 0, FULL); ctx.fill(); ctx.restore(); return;
  }
  const sh = f.warn > 0 ? Math.sin(time * 70) * 2 : 0;
  ctx.save(); ctx.translate(f.x + sh, f.y);
  ctx.fillStyle = "#bfefff"; ctx.strokeStyle = "#3f8fc0"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-14, -26); ctx.lineTo(14, -26); ctx.lineTo(0, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffffaa"; ctx.fillRect(-6, -22, 4, 24);
  ctx.restore();
}
// Fisch zum Einsammeln
function drawFishItem(f) {
  ctx.save(); ctx.translate(f.x, f.y + Math.sin(time * 4 + f.x / 30) * 6);
  ctx.fillStyle = "#4fc3f733"; ctx.beginPath(); ctx.arc(0, 0, 26, 0, FULL); ctx.fill();
  ctx.fillStyle = "#4fc3f7"; ctx.beginPath(); ctx.ellipse(0, 0, 16, 9, 0, 0, FULL); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(26, -8); ctx.lineTo(26, 8); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-8, -2, 3, 0, FULL); ctx.fill();
  ctx.restore();
}
$("pbtn").onclick = () => { togglePause(); $("pbtn").blur(); };


/* =====================================================================
   18. STORY-MODUS: Städte, Levelkarte, Cutscenes
   ===================================================================== */
const CITIES = [
  { n: "Berlin", c: ["#6fb7e8", "#dff3ff", "#f4fbff"], lm: "🗼" }, { n: "Prag", c: ["#e8a87c", "#f6d9b8", "#fff1e0"], lm: "🏰" },
  { n: "Wien", c: ["#8fb3e8", "#d8e4f6", "#fbf3e6"], lm: "🎻" }, { n: "Budapest", c: ["#7aa0d8", "#e7c9a6", "#fff0d8"], lm: "🏛️" },
  { n: "Belgrad", c: ["#d99a6c", "#f2cf9f", "#fff0cf"], lm: "🏯" }, { n: "Sofia", c: ["#7fc0a8", "#cdeadb", "#f2fbf4"], lm: "⛪" },
  { n: "Istanbul", c: ["#c9786a", "#f0b98f", "#ffe5c4"], lm: "🕌" }, { n: "Ankara", c: ["#c8a46a", "#ecd29a", "#fff0c8"], lm: "🏛️" },
  { n: "Bagdad", c: ["#d2884a", "#f0c27a", "#ffe7ae"], lm: "🕌" }, { n: "Dubai", c: ["#ff9a5a", "#ffd08a", "#fff0c0"], lm: "🏙️" }
];
const goalFor = n => 10 + 5 * (n - 1);   // Level 1 = 10 Punkte, danach immer mehr
function playClick() {
  if (gameMode === "Rangliste") { storyLevel = 0; start(); return; }
  if (!story.seen1) playCut(C1, () => { story.seen1 = 1; save("fc_s1", 1); modeUI(); openMap(); }); else openMap();
}
function startStory(n) { storyLevel = n; $("map").classList.add("hid"); start(); }
function levelDone() {
  const n = storyLevel; pauseState = 4; achievement();
  if (story.lvl <= n) { story.lvl = Math.min(10, n + 1); save("fc_slvl", story.lvl); }
  $("lwT").textContent = n < 10 ? "LEVEL " + n + " GESCHAFFT!" : "DUBAI ERREICHT!";
  $("lwS").textContent = n < 10 ? "Nächstes Ziel: " + CITIES[n].n : "Chico ist gefunden!";
  $("lvlwin").classList.remove("hid");
}
$("lwNext").onclick = () => {
  $("lvlwin").classList.add("hid"); pauseState = 0;
  const n = storyLevel; toMenu(); storyLevel = 0;
  if (n === 4 && !story.seen2) playCut(C2, () => { story.seen2 = 1; save("fc_s2", 1); openMap(); }); else openMap();
};
// Weltkarte Europa → Orient: echte Längen-/Breitengrade, Meere, Flüsse, Gebirge
const GEO = [[13.4, 52.5], [14.4, 50.1], [16.4, 48.2], [19, 47.5], [20.5, 44.8], [23.3, 42.7], [29, 41], [32.9, 39.9], [44.4, 33.3], [55.3, 25.2]];
const proj = ([lo, la]) => [(lo - 5) * 10.5 + 20, (57 - la) * 24];
const NODES = GEO.map(proj);
const WATER = [
  [[5, 57], [9, 57], [8, 54], [5, 52]], [[10, 57], [14, 54.3], [20, 54.6], [23, 57]], [[5, 47], [7, 44], [5, 43]],
  [[5, 43], [9, 44], [12, 44], [14, 42], [16, 40], [18, 40.5], [19, 42], [20, 40], [22, 37], [24, 38], [26, 36.5], [30, 36.2], [35, 36], [36, 34], [34.5, 31], [32, 31], [25, 31.5], [20, 32.5], [15, 32.5], [10, 34], [5, 36.5]],
  [[12.5, 45.5], [14, 44.5], [16, 43], [18.5, 41.5], [19.5, 42], [18.5, 43.5], [15.5, 45.5]],
  [[28.5, 41.5], [28, 43.5], [29.5, 45], [31, 46.5], [34, 46], [36, 45.2], [38.5, 47], [41.5, 42], [38, 41], [34, 41.8], [31, 41.2]],
  [[47, 45], [50, 46.5], [53, 45], [54, 41], [53, 37], [50.5, 37], [49, 38.5], [48.5, 41], [47, 43]],
  [[48.2, 30], [50, 30.4], [51.5, 28.8], [53.5, 27.2], [56.3, 27.1], [56.6, 26.3], [56.1, 25.6], [55.2, 25.4], [53.5, 24.2], [51.5, 24.5], [51.4, 26], [50.2, 26.8], [49.6, 28], [48.2, 29.2]],
  [[32.6, 30], [34.2, 28], [35.5, 26], [37.5, 23.5], [39.5, 20], [37.5, 20], [36, 23], [34.5, 25.5], [32.8, 28]]
];
const poly = (g, pts, fill, stroke) => { g.beginPath(); pts.map(proj).forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); } };
const polyline = (g, pts, col, w) => { g.beginPath(); pts.map(proj).forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
function openMap() { showScreen("map"); drawMap(); }
function drawMap() {
  const g = $("mc").getContext("2d");
  g.fillStyle = "#8fcf7a"; g.fillRect(0, 0, 600, 900);
  poly(g, [[34, 36], [42, 37], [46, 36], [48, 31], [56, 27], [60, 27], [60, 20], [34, 20]], "#e6c98a");          // Wüste (Arabien, Irak)
  poly(g, [[35, 41], [48, 41], [60, 40], [60, 30], [48, 33], [42, 37], [36, 37]], "#c9c88a");                      // Hochland (Anatolien, Iran)
  WATER.forEach(w => poly(g, w, "#4a90c8", "#2b6aa0"));
  polyline(g, [[10, 48.5], [14, 48.3], [17, 48.1], [19, 47.5], [20, 45], [22, 44.5], [25, 43.8], [28, 44], [29.5, 45]], "#4a90c8", 4);   // Donau
  polyline(g, [[38, 37], [40, 35], [44, 33.3], [47, 31], [48, 30]], "#4a90c8", 3);                                 // Euphrat
  polyline(g, [[40, 37.2], [42, 34.5], [44, 32], [47, 30.5]], "#4a90c8", 3);                                       // Tigris
  g.fillStyle = "#7a6a52";
  [[10, 46.7], [12, 46.6], [14, 46.9], [22, 47], [25, 46], [43, 42.5], [41, 42.8], [34, 37], [38, 38], [47, 34], [50, 32]].forEach(m => { const [x, y] = proj(m); g.beginPath(); g.moveTo(x - 12, y + 8); g.lineTo(x, y - 12); g.lineTo(x + 12, y + 8); g.fill(); });   // Gebirge
  g.fillStyle = "#0004"; g.font = "900 20px Nunito, sans-serif"; g.textAlign = "center";
  [["DEUTSCHLAND", 10, 51], ["POLEN", 19, 52], ["UNGARN", 20, 47.2], ["RUMÄNIEN", 25, 46], ["TÜRKEI", 34, 38.5], ["SYRIEN", 38.5, 35], ["IRAK", 44, 35.5], ["IRAN", 52, 33], ["SAUDI-ARABIEN", 44, 25], ["VAE", 54, 23], ["SCHWARZES MEER", 34, 43.4], ["MITTELMEER", 20, 35.5], ["PERS. GOLF", 52, 28.2]].forEach(([t, lo, la]) => { const [x, y] = proj([lo, la]); g.fillText(t, x, y); });
  g.setLineDash([10, 8]); g.strokeStyle = "#fff"; g.lineWidth = 4; g.beginPath(); NODES.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.stroke(); g.setLineDash([]);
  NODES.forEach(([x, y], i) => {
    const open = i + 1 <= story.lvl, done = i + 1 < story.lvl;
    g.fillStyle = done ? "#ffd54a" : open ? "#fff" : "#789"; g.strokeStyle = "#222"; g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, 20, 0, FULL); g.fill(); g.stroke();
    g.fillStyle = "#222"; g.font = "900 18px Nunito, sans-serif"; g.textAlign = "center"; g.fillText(i + 1, x, y + 6);
    g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 4; g.font = "900 15px Nunito, sans-serif"; g.strokeText(CITIES[i].n, x + 4, y + 38); g.fillText(CITIES[i].n, x + 4, y + 38);
    if (i + 1 === story.lvl) em(g, "🐧", x - 30, y - 20, 28);
  });
  g.fillStyle = "#fff"; g.strokeStyle = "#222"; g.lineWidth = 2; g.beginPath(); g.moveTo(540, 60); g.lineTo(548, 90); g.lineTo(540, 84); g.lineTo(532, 90); g.closePath(); g.fill(); g.stroke();   // Kompass
  g.fillStyle = "#222"; g.font = "900 16px Nunito, sans-serif"; g.fillText("N", 540, 50);
}
$("mc").onclick = e => {
  const r = $("mc").getBoundingClientRect(), x = (e.clientX - r.left) * 600 / r.width, y = (e.clientY - r.top) * 900 / r.height;
  NODES.forEach((p, i) => { if (Math.hypot(x - p[0], y - p[1]) < 30 && i + 1 <= story.lvl) startStory(i + 1); });
};
$("mapBack").onclick = () => showScreen("menu");

// --- Cutscene-Engine: Szenen {t: Sekunden, c: Untertitel, d: zeichne(g, Fortschritt 0..1, Zeit)} ---
let cutOn = false, cutDone = null;
function playCut(scenes, done) {
  showScreen("cut"); cutOn = true; cutDone = done;
  const g = $("cc").getContext("2d"); let i = 0, t0 = performance.now();
  scenes.forEach(x => { x.k = -1; });
  const frame = now => {
    if (!cutOn) return;
    const s = scenes[i], e = (now - t0) / 1000;
    s.d(g, Math.min(1, e / s.t), e); $("cutCap").textContent = s.c;
    const f = FX[s.fx];   // Soundeffekte der Szene (Schritte, Münzen, Motor, Rotor …)
    if (f) { const k = Math.floor(e / f[0]); if (k !== s.k) { s.k = k; f[1](); } }
    if (e >= s.t) { i++; t0 = now; if (i >= scenes.length) return endCut(); }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
function endCut() { if (!cutOn) return; cutOn = false; const d = cutDone; cutDone = null; if (d) d(); }
$("cutSkip").onclick = endCut;

const em = (g, s, x, y, z) => { g.font = z + "px 'Apple Color Emoji','Segoe UI Emoji',sans-serif"; g.textAlign = "center"; g.fillText(s, x, y); };
const bg = (g, a, b) => { const gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 600, 900); };
const fl = (g, c, y = 720) => { g.fillStyle = c; g.fillRect(0, y, 600, 900 - y); };
const box = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const say = (g, t, x, y) => { g.fillStyle = "#fff"; g.strokeStyle = "#222"; g.lineWidth = 3; g.beginPath(); g.roundRect(x - 150, y - 34, 300, 56, 16); g.fill(); g.stroke(); g.fillStyle = "#222"; g.font = "900 18px Nunito, sans-serif"; g.textAlign = "center"; g.fillText(t, x, y); };
function tower(g, x) { box(g, "#8f9eab", x - 5, 330, 10, 390); g.fillStyle = "#b8c4cf"; g.strokeStyle = "#667"; g.lineWidth = 3; g.beginPath(); g.arc(x, 330, 34, 0, FULL); g.fill(); g.stroke(); box(g, "#e53935", x - 2, 270, 4, 40); }
function chi(g, x, y, s = 1, flip = 1, shades = false) {
  g.save(); g.translate(x, y); g.scale(s * flip, s); g.fillStyle = "#d9a066";
  g.beginPath(); g.ellipse(0, 0, 50, 28, 0, 0, FULL); g.fill(); g.fillRect(-36, 14, 12, 30); g.fillRect(24, 14, 12, 30);
  g.beginPath(); g.arc(46, -26, 26, 0, FULL); g.fill();
  g.beginPath(); g.moveTo(34, -44); g.lineTo(40, -88); g.lineTo(54, -48); g.fill(); g.beginPath(); g.moveTo(52, -48); g.lineTo(70, -84); g.lineTo(68, -40); g.fill();
  g.beginPath(); g.moveTo(-48, -6); g.quadraticCurveTo(-76, -30, -64, -50); g.lineTo(-58, -46); g.quadraticCurveTo(-64, -26, -42, -2); g.fill();
  g.fillStyle = "#222"; g.beginPath(); g.arc(70, -22, 5, 0, FULL); g.fill();
  if (shades) g.fillRect(44, -36, 34, 10); else { g.fillStyle = "#fff"; g.beginPath(); g.arc(54, -32, 8, 0, FULL); g.fill(); g.fillStyle = "#111"; g.beginPath(); g.arc(56, -32, 4, 0, FULL); g.fill(); }
  g.restore();
}
function peng(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = "#222"; g.beginPath(); g.ellipse(0, 0, 40, 52, 0, 0, FULL); g.fill();
  g.fillStyle = "#fff"; g.beginPath(); g.ellipse(6, 8, 26, 38, 0, 0, FULL); g.fill(); g.beginPath(); g.arc(16, -30, 9, 0, FULL); g.fill();
  g.fillStyle = "#111"; g.beginPath(); g.arc(19, -30, 4, 0, FULL); g.fill(); g.fillStyle = "#ff9800";
  g.beginPath(); g.moveTo(24, -26); g.lineTo(52, -20); g.lineTo(24, -12); g.fill(); g.fillRect(-20, 50, 22, 8); g.fillRect(10, 50, 22, 8); g.restore();
}
const skyline = (g, c, y = 720) => { for (let i = 0; i < 12; i++) box(g, c, i * 52, y - 90 - (i * 37) % 120, 44, 90 + (i * 37) % 120); };
const burj = (g, x, y) => { g.fillStyle = "#cfd8dc"; g.beginPath(); g.moveTo(x - 26, y); g.lineTo(x - 8, y - 330); g.lineTo(x, y - 440); g.lineTo(x + 8, y - 330); g.lineTo(x + 26, y); g.fill(); };

// Cutscene 1 (~90 s): Chicos Aufstieg und Fall der Steuermoral
const C1 = [
  { t: 6, c: "Berlin. Ein ganz normaler Morgen. Chico, der Chihuahua, läuft am Fernsehturm vorbei.", d: (g, p, e) => { bg(g, "#8fd0ff", "#eaf7ff"); em(g, "☁️", 120 + e * 8, 200, 80); em(g, "☁️", 420 - e * 6, 300, 60); skyline(g, "#b9c7d6"); tower(g, 420); gate(g, 190, 720); fl(g, "#6b7280"); usign(g, 90, 600, "Alexanderplatz", true, 720); chi(g, -80 + p * 760, 740 + Math.sin(e * 9) * 4, 1.2); } },
  { t: 6, c: "Er arbeitet fleißig und verdient ehrliches Geld.", d: (g, p, e) => { bg(g, "#f5e6c8", "#e8d3a8"); box(g, "#8d5a2b", 80, 560, 440, 30); em(g, "💻", 300, 550, 90); chi(g, 200, 520, 1.1); for (let i = 0; i < 4; i++) em(g, "💶", 380 + i * 30, 500 - ((e * 60 + i * 50) % 200), 40); } },
  { t: 6, c: "Ein Freund lädt ihn ein: „Komm mit ins Casino am Kudamm!“", d: (g, p, e) => { bg(g, "#ffd7a8", "#ffeacc"); fl(g, "#9aa0a6"); chi(g, 160, 740, 1.2); em(g, "🐩", 440, 740, 130); say(g, "Casino am Kudamm? 🎰", 400, 560); } },
  { t: 6, c: "Abends am Kudamm: neon, Lichter – und das Casino.", d: (g, p, e) => { bg(g, "#12122e", "#2a1850"); box(g, "#3b2a5a", 90, 300, 420, 420); g.fillStyle = Math.sin(e * 6) > 0 ? "#ff4081" : "#ffd54a"; g.font = "900 70px Bungee, Impact"; g.textAlign = "center"; g.fillText("CASINO", 300, 400); for (let i = 0; i < 8; i++) em(g, "💡", 110 + i * 54, 280, 28); fl(g, "#2b2b3c"); usign(g, 540, 600, "Kurfürstendamm", true, 720); chi(g, -40 + p * 330, 760, 1.2); } },
  { t: 6, c: "Er gewinnt. Und gewinnt. Und gewinnt …", d: (g, p, e) => { bg(g, "#5a0f1a", "#2a0510"); em(g, "🎰", 300, 520, 260); chi(g, 150, 780, 1); for (let i = 0; i < 26; i++) em(g, "🪙", (i * 53) % 600, (e * 240 + i * 90) % 900, 40); } },
  { t: 6, c: "Steuern? Die zahlt Chico lieber nicht mehr …", d: (g, p, e) => { bg(g, "#cfd8dc", "#90a4ae"); em(g, "🏛️", 120, 520, 150); g.fillStyle = "#e53935"; g.font = "900 60px Bungee, Impact"; g.fillText("✖ STEUER", 300, 250); fl(g, "#78909c"); chi(g, 560 - p * 300, 780, 1.1, -1); em(g, "💰", 460 - p * 300, 700, 70); em(g, "💸", 200 + p * 100, 640, 60); } },
  { t: 6, c: "Bald fährt Chico in Dubai: 2 Lamborghini, 3 Porsche, 1 Ferrari, 1 McLaren.", d: (g, p, e) => { bg(g, "#ff9a5a", "#ffe0a8"); burj(g, 440, 700); burj(g, 120, 700); fl(g, "#4a4a55"); ["🏎️", "🏎️", "🚗", "🚗", "🚗", "🏎️", "🏎️"].forEach((s, i) => em(g, s, ((e * 90 + i * 130) % 900) - 150, 770, 70)); } },
  { t: 6, c: "Dubai: Burj Khalifa, Yacht, Sonnenbrille – und alles fleißig auf Instagram.", d: (g, p, e) => { bg(g, "#7fd0ff", "#fff0c8"); burj(g, 300, 600); em(g, "🌴", 90, 600, 90); em(g, "🌴", 520, 610, 90); fl(g, "#1e88e5", 620); em(g, "🛥️", 300 + Math.sin(e) * 20, 680, 150); chi(g, 280, 640, .6, 1, true); say(g, "❤️ 12.345 Likes #Luxus", 300, 150); } },
  { t: 6, c: "Berlin. Der Pinguin scrollt durch Chicos Posts … und stutzt: Wo sind seine Steuerbescheide?!", d: (g, p, e) => { bg(g, "#2b3a55", "#1a2438"); box(g, "#222", 150, 320, 300, 200); box(g, "#fff", 160, 330, 280, 180); box(g, "#e1306c", 160, 330, 280, 24); em(g, "🏎️", 230, 460, 70); em(g, "🏝️", 340, 460, 70); em(g, "🧾", 400, 420, 40 + p * 30); peng(g, 130, 640, 1.2); if (p > .6) say(g, "Steuern hinterzogen?!", 300, 220); } },
  { t: 6, c: "Er macht sich auf die Suche nach Chico – quer durch Europa bis nach Dubai!", d: (g, p, e) => { bg(g, "#4a90c8", "#bfe8ff"); fl(g, "#8fcf7a", 600); peng(g, 80 + p * 440, 640 + Math.sin(e * 10) * 6, 1.1); em(g, "🏙️", 520, 600, 90); em(g, "➡️", 300, 300, 80); } }
];
// Cutscene 2 (~75 s): Chico erfährt von der Fahndung und flieht im Hubschrauber
const C2 = [
  { t: 15, c: "Dubai. Chico sieht die Seite der Polizei Berlin: „Fahndung nach Chico – Steuerhinterziehung“.", d: (g, p, e) => { bg(g, "#1c2438", "#0e1424"); box(g, "#fff", 120, 160, 360, 320); box(g, "#1e3a8a", 120, 160, 360, 40); g.fillStyle = "#fff"; g.font = "900 20px Nunito"; g.textAlign = "center"; g.fillText("POLIZEI BERLIN · FAHNDUNG", 300, 188); chi(g, 280, 400, .8); g.fillStyle = "#c62828"; g.font = "900 34px Bungee, Impact"; g.fillText("GESUCHT", 300, 260); chi(g, 300 + Math.sin(e * 40) * 10 * p, 720, 1.3); if (p > .4) em(g, "💦", 380, 640, 50); if (p > .6) em(g, "❗", 200, 640, 80); } },
  { t: 15, c: "Panik! Chico rennt los zur Garage.", d: (g, p, e) => { bg(g, "#37474f", "#263238"); box(g, "#546e7a", 380, 300, 180, 420); em(g, "🚪", 470, 520, 160); fl(g, "#455a64"); chi(g, 40 + p * 360, 760 + Math.sin(e * 14) * 8, 1.2); } },
  { t: 15, c: "Er springt in seinen Lamborghini …", d: (g, p, e) => { bg(g, "#263238", "#101820"); fl(g, "#37474f", 700); em(g, "🏎️", 300, 700, 260 + p * 20); chi(g, 300, 560 - Math.sin(p * Math.PI) * 120, .6, 1, true); } },
  { t: 15, c: "… und rast durch die Wüste zum Hubschrauberlandeplatz.", d: (g, p, e) => { bg(g, "#ff9a5a", "#ffe0a8"); fl(g, "#d4a96a", 640); em(g, "🌵", 90, 650, 80); em(g, "🚁", 480, 600, 150); em(g, "🏎️", -80 + p * 460, 760, 150); for (let i = 0; i < 6; i++) em(g, "💨", -120 + p * 460 - i * 40, 770, 40); } },
  { t: 15, c: "Der Hubschrauber hebt ab. Chico entkommt – für’s Erste. Die Jagd geht weiter!", d: (g, p, e) => { bg(g, "#ffb27a", "#ffe6c0"); burj(g, 120, 720); burj(g, 480, 720); fl(g, "#c9a36a", 720); em(g, "🚁", 160 + p * 380, 640 - p * 420, 170); em(g, "☁️", 400 - p * 100, 200, 90); } }
];


/* =====================================================================
   19. STADT-KULISSE (Story), Wahrzeichen, Cutscene-Effekte
   ===================================================================== */
const FOOD = ["#c0392b", "#d4a05a", "#f0d9b0", "#e67e22", "#a0522d", "#e8d070", "#d9a441", "#c98c4a", "#8b5a2b", "#6f4e37"];   // Currywurst, Trdelník, Torte …
const STATIONS = [["Alexanderplatz", "Kurfürstendamm", "Friedrichstraße", "Zoologischer Garten"], ["Staroměstská", "Můstek"], ["Stephansplatz", "Karlsplatz"], ["Deák Ferenc tér", "Kossuth tér"], ["Slavija", "Terazije"], ["Serdika", "Vitosha"], ["Taksim", "Sultanahmet"], ["Kızılay", "Ulus"], ["Al-Rasheed", "Karrada"], ["Dubai Mall", "Business Bay"]];
// Schild an einem Mast (Berlin: blaues U-Bahn-Schild mit Stationsname)
function usign(g, x, y, name, blue, gy = GY) {
  g.fillStyle = "#555"; g.fillRect(x - 3, y, 6, gy - y);
  g.fillStyle = blue ? "#0a5fb4" : "#1b7a3a"; g.beginPath(); g.roundRect(x - 64, y - 38, 128, 42, 6); g.fill();
  g.fillStyle = "#fff"; g.font = "900 13px Nunito, sans-serif"; g.textAlign = "center"; g.fillText(name, x + (blue ? 12 : 0), y - 12);
  if (blue) { g.fillRect(x - 58, y - 34, 26, 34); g.fillStyle = "#0a5fb4"; g.font = "900 26px Nunito, sans-serif"; g.fillText("U", x - 45, y - 8); }
}
function gate(g, x, y) {   // Brandenburger Tor
  box(g, "#d9c9a0", x - 80, y - 120, 160, 18); for (let i = 0; i < 6; i++) box(g, "#e6d9b4", x - 72 + i * 28, y - 102, 14, 102);
  box(g, "#d9c9a0", x - 80, y - 142, 160, 22); g.fillStyle = "#8d7b4a"; g.beginPath(); g.moveTo(x - 18, y - 142); g.lineTo(x, y - 178); g.lineTo(x + 18, y - 142); g.fill();
}
// Wahrzeichen der 10 Städte, selbst gezeichnet (x = Mitte, y = Boden)
function landmark(n, x, y, c = ctx) {
  const R = (a, b, w, h, col) => { c.fillStyle = col; c.fillRect(x + a, y - b - h, w, h); };
  const dome = (a, b, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x + a, y - b, r, Math.PI, 0); c.fill(); };
  const spire = (a, b, w, h, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x + a - w / 2, y - b); c.lineTo(x + a, y - b - h); c.lineTo(x + a + w / 2, y - b); c.fill(); };
  if (n === 1) { R(-4, 0, 8, 230, "#9aa7b4"); c.fillStyle = "#c5d0da"; c.beginPath(); c.arc(x, y - 230, 28, 0, FULL); c.fill(); spire(0, 250, 6, 70, "#e53935"); }
  else if (n === 2) { R(-70, 0, 140, 70, "#b0a090"); [-60, -20, 25, 55].forEach(a => { R(a, 70, 16, 60, "#9a8a7a"); spire(a + 8, 130, 22, 60, "#7a2e2e"); }); }
  else if (n === 3) { R(-30, 0, 60, 110, "#c8bda8"); spire(0, 110, 40, 120, "#5a6a5a"); c.strokeStyle = "#555"; c.lineWidth = 4; c.beginPath(); c.arc(x + 90, y - 90, 70, 0, FULL); c.stroke(); }
  else if (n === 4) { R(-110, 0, 220, 60, "#d8cbb0"); dome(0, 60, 40, "#5a8a6a"); spire(0, 100, 12, 60, "#c9a23a"); [-90, -60, 60, 90].forEach(a => spire(a, 60, 22, 40, "#5a8a6a")); }
  else if (n === 5) { R(-60, 0, 120, 70, "#e8e0d0"); dome(0, 70, 60, "#8aa0b8"); spire(0, 130, 10, 40, "#c9a23a"); }
  else if (n === 6) { R(-70, 0, 140, 60, "#e8e0d0"); dome(-30, 60, 30, "#d9b43a"); dome(30, 60, 24, "#d9b43a"); dome(0, 60, 40, "#d9b43a"); spire(-60, 60, 14, 70, "#d9b43a"); }
  else if (n === 7) { R(-70, 0, 140, 60, "#e0cba8"); dome(0, 60, 70, "#c9b99a"); [-100, 100].forEach(a => { R(a - 5, 0, 10, 170, "#f0e6d0"); spire(a, 170, 14, 40, "#555"); }); }
  else if (n === 8) { R(-90, 0, 180, 40, "#d8c8a0"); for (let i = -4; i <= 4; i++) R(i * 20 - 4, 40, 8, 60, "#e8dcb8"); R(-100, 100, 200, 12, "#d8c8a0"); }
  else if (n === 9) { R(-50, 0, 100, 60, "#d9c08a"); dome(0, 60, 45, "#2e8bb8"); [-70, 70].forEach(a => { R(a - 5, 0, 10, 150, "#e8d8a8"); spire(a, 150, 14, 34, "#2e8bb8"); }); }
  else { burj(c, x, y); spire(130, 0, 70, 110, "#fff"); }   // Burj Khalifa + Burj Al Arab (Segel)
}
// Hochhaus-/Haus-Hindernis mit spitzem Dach (passt zur Kollisionsform), Fenster erleuchtet
function drawPipeStory(p, top, bot) {
  const hue = storyLevel * 36;
  [[-5, top - 70, top], [GY - 8, bot + 70, bot]].forEach(([e, s, tip]) => {
    ctx.save(); ctx.beginPath(); ctx.moveTo(p.x, e); ctx.lineTo(p.x, s); ctx.lineTo(p.x + p.w / 2, tip); ctx.lineTo(p.x + p.w, s); ctx.lineTo(p.x + p.w, e); ctx.closePath(); ctx.clip();
    ctx.fillStyle = "#c9ced4"; ctx.fillRect(p.x, Math.min(e, tip) - 5, p.w, Math.abs(e - tip) + 10);
    ctx.fillStyle = "#9aa2ab"; ctx.fillRect(p.x, Math.min(s, tip), p.w, Math.abs(tip - s));   // Dach
    ctx.fillStyle = "#9fd8f5";
    for (let y = Math.min(e, s) + 12; y < Math.max(e, s) - 14; y += 26) for (let x = p.x + 8; x < p.x + p.w - 10; x += 18) ctx.fillRect(x, y, 8, 12);
    ctx.restore();
  });
}
// Hintergrund der Story-Level: Wahrzeichen, Häuserreihe, Gehweg, Straße, Laternen, Stations-/Straßenschilder
function cityBG() {
  const lv = storyLevel, hue = lv * 36;
  landmark(lv, ((420 - scrollX * .12) % 900 + 900) % 900 - 100, GY - 40);
  for (let i = 0; i < 14; i++) {
    const x = ((i * 90 - scrollX * .3) % 1260 + 1260) % 1260 - 90, h = 110 + (i * 53) % 150;
    ctx.fillStyle = "hsl(210,8%," + (72 + (i % 3) * 5) + "%)"; ctx.fillRect(x, GY - 40 - h, 70, h + 40);
    ctx.fillStyle = "#9fd8f5"; for (let y = GY - 40 - h + 12; y < GY - 50; y += 24) for (let wx = x + 8; wx < x + 58; wx += 20) ctx.fillRect(wx, y, 9, 13);
  }
  ctx.fillStyle = "#c9ccd2"; ctx.fillRect(0, GY - 28, W, 20);
  ctx.fillStyle = "#3a3d46"; ctx.fillRect(0, GY - 8, W, H);
  ctx.fillStyle = "#fff"; for (let x = -(scrollX % 80); x < W; x += 80) ctx.fillRect(x, GY + 60, 44, 6);
  for (let i = 0; i < 6; i++) {
    const x = ((i * 300 - scrollX) % 1800 + 1800) % 1800 - 200;
    if (i % 2) usign(ctx, x, GY - 150, STATIONS[lv - 1][(i >> 1) % STATIONS[lv - 1].length], lv === 1, GY - 8);
    else {
      ctx.fillStyle = "#444"; ctx.fillRect(x - 3, GY - 170, 6, 162); ctx.fillRect(x - 3, GY - 170, 28, 5);
      ctx.fillStyle = "#ffe58a33"; ctx.beginPath(); ctx.arc(x + 26, GY - 160, 26, 0, FULL); ctx.fill();
      ctx.fillStyle = "#ffe58a"; ctx.beginPath(); ctx.arc(x + 26, GY - 160, 9, 0, FULL); ctx.fill();
    }
  }
}
// Soundeffekte der Cutscenes: [Intervall in s, Funktion]
const FX = {
  walk: [.35, () => noise(.05, 800, .12)], coin: [.15, () => beep(1200 + Math.random() * 600, .08, "triangle", .05)],
  car: [.2, () => { noise(.15, 500, .15); beep(80, .15, "sawtooth", .04); }], heli: [.12, () => noise(.1, 300, .25)],
  ping: [2, () => beep(900, .2, "sine", .06, 1400)], alarm: [.5, () => beep(700, .2, "square", .05, 500)]
};
["walk", "ping", "ping", "walk", "coin", "ping", "car", "ping", "ping", "walk"].forEach((f, i) => { C1[i].fx = f; });
["alarm", "walk", "car", "car", "heli"].forEach((f, i) => { C2[i].fx = f; });


/* =====================================================================
   20. CUTSCENE-WIEDERHOLUNG (Fernseher auf der Karte, nur bereits gesehene)
   ===================================================================== */
$("tvBtn").onclick = () => {
  noise(.3, 2500, .2); beep(200, .15, "square", .05, 800);
  [["tv1", story.seen1, "▶ Cutscene 1 – Chicos Aufstieg"], ["tv2", story.seen2, "▶ Cutscene 2 – Die Flucht"]].forEach(([id, seen, label]) => {
    $(id).disabled = !seen; $(id).textContent = seen ? label : "🔒 ???";   // Anti-Spoiler: ungesehene bleiben gesperrt
  });
  $("tvBox").classList.remove("hid");
};
$("tvClose").onclick = () => $("tvBox").classList.add("hid");
$("tv1").onclick = () => { $("tvBox").classList.add("hid"); playCut(C1, openMap); };
$("tv2").onclick = () => { $("tvBox").classList.add("hid"); playCut(C2, openMap); };


/* =====================================================================
   21. ADMIN-KONSOLE (nur eingeloggtes Konto "admin", Button in der Moduswahl)
   Hinweis: rein clientseitig – echte Sicherheit gibt es nur durch Konto "admin" selbst
   ===================================================================== */
let isAdm = false;   // vom Server bestätigt (Tabelle "admins")
const conUI = () => $("conBtn").classList.toggle("hid", !isAdm);
async function checkAdmin() {
  isAdm = false;
  if (sb && uid) { const { data } = await sb.rpc("is_admin"); isAdm = data === true; }
  conUI();
}
async function conRun(line) {
  const out = t => { $("conOut").textContent = t; };
  const [cmd, a] = line.trim().toLowerCase().split(/\s+/), n = Math.trunc(+a);
  if (!isAdm) return out("Kein Zugriff.");
  if ((cmd === "coins" || cmd === "xp") && n) {   // läuft auf dem Server (prüft is_admin) und ändert den Cloud-Stand
    out("Sende an Server …"); await push();
    const { error } = await sb.rpc("admin_grant", { kind: cmd, amount: n });
    if (error) return out("Server: " + error.message);
    const { data: row } = await sb.from("saves").select("data,updated_at").eq("user_id", uid).single();
    applyCloud(row); out("OK – lade neu …"); setTimeout(() => location.reload(), 600); return;
  }
  if (cmd === "fish" && n) { inv.fish += n; saveInv(); out("Fische: " + inv.fish); }
  else if (cmd === "bottles" && n) { inv.bottles = clamp(inv.bottles + n, 0, 5); saveInv(); out("Bonbons: " + inv.bottles); }
  else if (cmd === "ammo" && n && inv.cur) { inv.ammo[inv.cur] = (inv.ammo[inv.cur] || 0) + n; saveInv(); out("Munition: " + inv.ammo[inv.cur]); }
  else if (cmd === "level" && n) { story.lvl = clamp(n, 1, 10); save("fc_slvl", story.lvl); out("Story-Level freigeschaltet bis " + story.lvl); }
  else if (cmd === "weapon" && WEAPONS[a]) { inv.own[a] = 1; inv.ammo[a] = (inv.ammo[a] || 0) + WEAPONS[a].packSize; if (!inv.cur) inv.cur = a; saveInv(); out("Waffe erhalten: " + WEAPONS[a].name); }
  else if (cmd === "unlock") { ORDERW.forEach(k => { inv.own[k] = 1; inv.ammo[k] = (inv.ammo[k] || 0) + WEAPONS[k].packSize; }); inv.cur = inv.cur || "ak"; story.lvl = 10; save("fc_slvl", 10); saveInv(); out("Alles freigeschaltet."); }
  else out("Befehle (Server): coins N · xp N — (lokal): fish N · bottles N · ammo N · level N · weapon KEY · unlock");
  chestUI();
}
$("conBtn").onclick = () => { $("con").classList.remove("hid"); $("conIn").focus(); };
$("conClose").onclick = () => $("con").classList.add("hid");
$("conIn").onkeydown = e => { if (e.key === "Enter") { conRun($("conIn").value); $("conIn").value = ""; } };
conUI();


// Beginn des aktuellen Tages bzw. der aktuellen Woche (Montag 0 Uhr) in Berlin-Zeit
function periodStart(p) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date());
  const g = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const sinceMidnight = (+g.hour % 24) * 3600 + +g.minute * 60 + +g.second;
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(g.weekday);   // Montag = 0
  return new Date(Date.now() - (sinceMidnight + (p === "week" ? weekday : 0) * 86400) * 1000);
}
