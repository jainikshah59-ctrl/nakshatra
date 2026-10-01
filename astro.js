/* Nakshatra astro engine — deterministic Vedic calculations.
   Sidereal (Lahiri ayanamsa, approximated). No AI, no backend. */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const norm360 = x => ((x % 360) + 360) % 360;

/* ---------------- Julian day ---------------- */
function julianDay(y, m, d, hourUTC) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + hourUTC / 24;
}
/* IST -> UTC for birth times entered in IST */
const jdFromIST = (y, m, d, hh, mm) => julianDay(y, m, d, hh + mm / 60 - 5.5);

/* ---------------- Ayanamsa (Lahiri, approximated) ---------------- */
function ayanamsa(jd) {
  // ~23.856 deg at J2000, precession ~50.29"/yr
  return 23.856 + (jd - 2451545.0) / 365.25 * 0.013969;
}
const sidereal = (tropicalLon, jd) => norm360(tropicalLon - ayanamsa(jd));

/* ---------------- Sun (tropical) ---------------- */
function sunLong(jd) {
  const n = jd - 2451545.0;
  const L = norm360(280.460 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n) * D2R;
  return norm360(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
}

/* ---------------- Moon (tropical, major perturbations) ---------------- */
function moonLong(jd) {
  const n = jd - 2451545.0;
  const L0 = norm360(218.316 + 13.176396 * n);
  const Mm = norm360(134.963 + 13.064993 * n) * D2R;
  const Ms = norm360(357.529 + 0.98560028 * n) * D2R;
  const D = norm360(297.850 + 12.190749 * n) * D2R;
  const F = norm360(93.272 + 13.229350 * n) * D2R;
  return norm360(L0
    + 6.289 * Math.sin(Mm)
    - 1.274 * Math.sin(Mm - 2 * D)
    + 0.658 * Math.sin(2 * D)
    - 0.186 * Math.sin(Ms)
    - 0.114 * Math.sin(2 * F));
}

/* ---------------- Planets (JPL approximate Keplerian elements) ---------------- */
const ELEMENTS = {
  mercury: { a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.25032350, lp: 77.45779628, om: 48.33076593, da: 0.00000037, de: 0.00001906, di: -0.00594749, dL: 149472.67411175, dlp: 0.16047689, dom: -0.12534081 },
  venus:   { a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.97909950, lp: 131.60246718, om: 76.67984255, da: 0.00000390, de: -0.00004107, di: -0.00078890, dL: 58517.81538729, dlp: 0.00268329, dom: -0.27769418 },
  earth:   { a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, lp: 102.93768193, om: 0.0, da: 0.00000562, de: -0.00004392, di: -0.01294668, dL: 35999.37244981, dlp: 0.32327364, dom: 0.0 },
  mars:    { a: 1.52371034, e: 0.09339410, i: 1.84969142, L: -4.55343205, lp: -23.94362959, om: 49.55953891, da: 0.00001847, de: 0.00007882, di: -0.00813131, dL: 19140.30268499, dlp: 0.44441088, dom: -0.29257343 },
  jupiter: { a: 5.20288700, e: 0.04838624, i: 1.30439695, L: 34.39644051, lp: 14.72847983, om: 100.47390909, da: -0.00011607, de: -0.00013253, di: -0.00183714, dL: 3034.74612775, dlp: 0.21252668, dom: 0.20469106 },
  saturn:  { a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, lp: 92.59887831, om: 113.66242448, da: -0.00125060, de: -0.00050991, di: 0.00193609, dL: 1222.49362201, dlp: -0.41897216, dom: -0.28867794 },
};
function helio(el, T) {
  const a = el.a + el.da * T, e = el.e + el.de * T;
  const L = norm360(el.L + el.dL * T), lp = norm360(el.lp + el.dlp * T), om = norm360(el.om + el.dom * T);
  const w = (lp - om) * D2R, M = norm360(L - lp) * D2R, inc = (el.i + el.di * T) * D2R, Om = om * D2R;
  let E = M;
  for (let k = 0; k < 10; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(inc), si = Math.sin(inc);
  return {
    x: (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    y: (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    z: (sw * si) * xp + (cw * si) * yp,
  };
}
function planetGeoLong(jd, name) {
  const T = (jd - 2451545.0) / 36525;
  const e = helio(ELEMENTS.earth, T), p = helio(ELEMENTS[name], T);
  return norm360(Math.atan2(p.y - e.y, p.x - e.x) * R2D);
}
/* Rahu = mean lunar ascending node (tropical) */
function rahuLong(jd) {
  const T = (jd - 2451545.0) / 36525;
  return norm360(125.04452 - 1934.136261 * T);
}

/* ---------------- Full sidereal chart ---------------- */
function computeChart(jd) {
  const ay = ayanamsa(jd);
  const sid = t => norm360(t - ay);
  const sun = sid(sunLong(jd)), moon = sid(moonLong(jd));
  const out = { sun, moon, ayanamsa: ay };
  for (const p of ["mercury", "venus", "mars", "jupiter", "saturn"])
    out[p] = sid(planetGeoLong(jd, p));
  const rahu = sid(rahuLong(jd));
  out.rahu = rahu; out.ketu = norm360(rahu + 180);
  return out;
}

/* ---------------- Tables ---------------- */
const RASHIS = [
  { en: "Aries", hi: "Mesh", lord: "Mangal", glyph: "♈" },
  { en: "Taurus", hi: "Vrishabh", lord: "Shukra", glyph: "♉" },
  { en: "Gemini", hi: "Mithun", lord: "Budha", glyph: "♊" },
  { en: "Cancer", hi: "Kark", lord: "Chandra", glyph: "♋" },
  { en: "Leo", hi: "Simha", lord: "Surya", glyph: "♌" },
  { en: "Virgo", hi: "Kanya", lord: "Budha", glyph: "♍" },
  { en: "Libra", hi: "Tula", lord: "Shukra", glyph: "♎" },
  { en: "Scorpio", hi: "Vrishchik", lord: "Mangal", glyph: "♏" },
  { en: "Sagittarius", hi: "Dhanu", lord: "Guru", glyph: "♐" },
  { en: "Capricorn", hi: "Makar", lord: "Shani", glyph: "♑" },
  { en: "Aquarius", hi: "Kumbh", lord: "Shani", glyph: "♒" },
  { en: "Pisces", hi: "Meen", lord: "Guru", glyph: "♓" },
];
const NAKSHATRAS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
const TITHIS = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima"];
const YOGAS = ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"];
const KARANAS = ["Kimstughna", "Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
const KARANA_FIXED = ["Shakuni", "Chatushpada", "Naga"];
const VAARAS = ["Ravivaar", "Somvaar", "Mangalvaar", "Budhvaar", "Guruvaar", "Shukravaar", "Shanivaar"];
const GRAHAS = {
  Surya: { glyph: "☉", en: "Sun" }, Chandra: { glyph: "☽", en: "Moon" },
  Mangal: { glyph: "♂", en: "Mars" }, Budha: { glyph: "☿", en: "Mercury" },
  Guru: { glyph: "♃", en: "Jupiter" }, Shukra: { glyph: "♀", en: "Venus" },
  Shani: { glyph: "♄", en: "Saturn" }, Rahu: { glyph: "☊", en: "Rahu" }, Ketu: { glyph: "☋", en: "Ketu" },
};
const RASHI_LORDS = ["Mangal", "Shukra", "Budha", "Chandra", "Surya", "Budha", "Shukra", "Mangal", "Guru", "Shani", "Shani", "Guru"];

/* Vimshottari: nakshatra index % 9 -> lord, years */
const DASHA_LORDS = ["Ketu", "Shukra", "Surya", "Chandra", "Mangal", "Rahu", "Guru", "Shani", "Budha"];
const DASHA_YEARS = { Ketu: 7, Shukra: 20, Surya: 6, Chandra: 10, Mangal: 7, Rahu: 18, Guru: 16, Shani: 19, Budha: 17 };

/* Nakshatra attributes (verified against classical tables) */
const NAK_GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0]; // 0 deva 1 manushya 2 rakshasa
const NAK_NADI = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2]; // 0 adi 1 madhya 2 antya
const NAK_YONI = [0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1];
const YONI_ANIMALS = ["Horse", "Elephant", "Goat", "Serpent", "Dog", "Cat", "Rat", "Cow", "Buffalo", "Tiger", "Deer", "Monkey", "Mongoose", "Lion"];
const GANA_NAMES = ["Deva", "Manushya", "Rakshasa"], NADI_NAMES = ["Adi", "Madhya", "Antya"];

/* ---------------- Derived placements ---------------- */
function rashiOf(lon) { return Math.floor(norm360(lon) / 30) % 12; }
function nakOf(lon) {
  const s = norm360(lon), span = 360 / 27;
  const idx = Math.floor(s / span) % 27;
  return { idx, pada: Math.floor((s % span) / (span / 4)) + 1, frac: (s % span) / span };
}
function tithiOf(sun, moon) {
  const elong = norm360(moon - sun);
  const n = Math.floor(elong / 12); // 0..29
  if (n === 29) return { n: 30, name: "Amavasya", paksha: "Krishna", full: "Amavasya" };
  const paksha = n < 15 ? "Shukla" : "Krishna";
  const name = TITHIS[n % 15];
  return { n: n + 1, name, paksha, full: n === 14 ? "Purnima" : paksha + " " + name };
}
function yogaOf(sun, moon) { return YOGAS[Math.floor(norm360(sun + moon) / (360 / 27)) % 27]; }
function karanaOf(sun, moon) {
  const half = Math.floor(norm360(moon - sun) / 6); // 0..59
  if (half === 0) return KARANAS[0];
  if (half >= 57) return KARANA_FIXED[half - 57];
  return KARANAS[1 + ((half - 1) % 7)];
}
/* Rahu kaal segments (approx, sunrise 6:00 IST) by weekday 0=Sun */
const RAHU_KAAL = ["16:30 – 18:00", "07:30 – 09:00", "15:00 – 16:30", "12:00 – 13:30", "13:30 – 15:00", "10:30 – 12:00", "09:00 – 10:30"];
const ABHIJIT = "11:48 – 12:32";

function panchang(date) {
  // date: JS Date (local). Use noon IST for the day's values.
  const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate(), 6.5); // ~noon IST in UTC
  const sun = sidereal(sunLong(jd), jd), moon = sidereal(moonLong(jd), jd);
  const nk = nakOf(moon), ti = tithiOf(sun, moon);
  return {
    date: date.toDateString(),
    vaara: VAARAS[date.getDay()],
    tithi: ti.full,
    nakshatra: NAKSHATRAS[nk.idx],
    yoga: yogaOf(sun, moon),
    karana: karanaOf(sun, moon),
    rahuKaal: RAHU_KAAL[date.getDay()],
    abhijit: ABHIJIT,
    moonRashi: RASHIS[rashiOf(moon)].en,
  };
}

/* ---------------- Vimshottari Dasha ---------------- */
function vimshottari(birthJD, moonSidereal) {
  const nk = nakOf(moonSidereal);
  const startIdx = nk.idx % 9;
  const firstLord = DASHA_LORDS[startIdx];
  const balance = (1 - nk.frac) * DASHA_YEARS[firstLord]; // years remaining at birth
  const seq = [];
  let cursor = birthJD;
  // first (partial) mahadasha
  seq.push({ lord: firstLord, years: balance, start: cursor });
  cursor += balance * 365.25;
  for (let k = 1; k < 12; k++) {
    const lord = DASHA_LORDS[(startIdx + k) % 9];
    seq.push({ lord, years: DASHA_YEARS[lord], start: cursor });
    cursor += DASHA_YEARS[lord] * 365.25;
  }
  const now = julianDay(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate(), 6.5);
  let current = seq[0];
  for (const s of seq) if (now >= s.start) current = s;
  // antardashas within current mahadasha
  const mdYears = current.years;
  const ci = DASHA_LORDS.indexOf(current.lord);
  const antars = [];
  let ac = current.start;
  for (let k = 0; k < 9; k++) {
    const l = DASHA_LORDS[(ci + k) % 9];
    const yrs = mdYears * DASHA_YEARS[l] / 120;
    antars.push({ lord: l, years: yrs, start: ac, end: ac + yrs * 365.25 });
    ac += yrs * 365.25;
  }
  const curAntar = antars.find(a => now >= a.start && now < a.end) || antars[antars.length - 1];
  const jdToDate = jd => {
    const d = new Date((jd - 2440587.5) * 86400000);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  return {
    birthLord: firstLord,
    mahadashas: seq.map(s => ({ lord: s.lord, years: +s.years.toFixed(2), from: jdToDate(s.start), to: jdToDate(s.start + s.years * 365.25) })),
    current: { mahadasha: current.lord, antardasha: curAntar.lord, antarFrom: jdToDate(curAntar.start), antarTo: jdToDate(curAntar.end) },
  };
}

/* ---------------- Sade Sati ---------------- */
function sadeSati(moonRashiIdx) {
  const now = new Date();
  const jd = julianDay(now.getFullYear(), now.getMonth() + 1, now.getDate(), 6.5);
  const sat = rashiOf(sidereal(planetGeoLong(jd, "saturn"), jd));
  const diff = (sat - moonRashiIdx + 12) % 12;
  if (diff === 11) return { phase: "Rising", active: true, detail: "Saturn has entered the sign before your Moon — the first phase of Sade Sati." };
  if (diff === 0) return { phase: "Peak", active: true, detail: "Saturn transits your Moon sign — the peak phase of Sade Sati." };
  if (diff === 1) return { phase: "Setting", active: true, detail: "Saturn has moved past your Moon sign — the final phase of Sade Sati." };
  if (diff === 3 || diff === 7) return { phase: "Dhaiya", active: true, detail: "Saturn's small panoti (dhaiya) influences your Moon sign." };
  return { phase: "None", active: false, detail: "No Sade Sati on your Moon sign right now." };
}

/* ---------------- Gemstone (by Moon rashi lord) ---------------- */
const GEMSTONES = {
  Surya: { stone: "Manik (Ruby)", day: "Sunday", finger: "Ring finger", metal: "Gold" },
  Chandra: { stone: "Moti (Pearl)", day: "Monday", finger: "Little finger", metal: "Silver" },
  Mangal: { stone: "Moonga (Red Coral)", day: "Tuesday", finger: "Ring finger", metal: "Gold / Copper" },
  Budha: { stone: "Panna (Emerald)", day: "Wednesday", finger: "Little finger", metal: "Gold" },
  Guru: { stone: "Pukhraj (Yellow Sapphire)", day: "Thursday", finger: "Index finger", metal: "Gold" },
  Shukra: { stone: "Heera (Diamond) / Opal", day: "Friday", finger: "Middle finger", metal: "Platinum / Silver" },
  Shani: { stone: "Neelam (Blue Sapphire)", day: "Saturday", finger: "Middle finger", metal: "Panchdhatu / Silver" },
};
function gemstone(moonRashiIdx) { return { lord: RASHI_LORDS[moonRashiIdx], ...GEMSTONES[RASHI_LORDS[moonRashiIdx]] }; }

/* ---------------- Festivals (verified 2026 dates) ---------------- */
const FESTIVALS = [
  ["2026-01-14", "Makar Sankranti / Pongal"], ["2026-01-23", "Vasant Panchami"],
  ["2026-02-15", "Maha Shivratri"], ["2026-03-04", "Holi"],
  ["2026-03-19", "Chaitra Navratri begins"], ["2026-03-26", "Ram Navami"],
  ["2026-04-14", "Vaisakhi / Puthandu"], ["2026-04-20", "Akshaya Tritiya"],
  ["2026-07-16", "Rath Yatra"], ["2026-07-29", "Guru Purnima"],
  ["2026-08-28", "Raksha Bandhan"], ["2026-09-04", "Janmashtami"],
  ["2026-09-14", "Ganesh Chaturthi"], ["2026-10-11", "Navratri begins"],
  ["2026-10-20", "Dussehra"], ["2026-11-06", "Dhanteras"],
  ["2026-11-08", "Diwali"], ["2026-11-11", "Bhai Dooj"],
  ["2026-11-15", "Chhath Puja"], ["2026-11-24", "Guru Nanak Jayanti"],
];
function upcomingFestivals(n = 6) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return FESTIVALS
    .map(([d, name]) => ({ d: new Date(d + "T00:00:00"), name }))
    .filter(f => f.d >= today)
    .slice(0, n)
    .map(f => ({ name: f.name, date: f.d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), weekday: f.d.toLocaleDateString("en-IN", { weekday: "long" }) }));
}

/* ---------------- Guna Milan (Ashtakoota, 36 gunas — classical tables) ---------------- */
const VASHYA_WHOLE = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 3, 5: 1, 6: 1, 7: 4, 10: 1, 11: 2 }; // rashi -> class; 8,9 split
const VASHYA_NAMES = ["Chatushpada", "Manava", "Jalachara", "Vanachara", "Keeta"];
function vashyaClass(rashi, degInSign) {
  if (rashi === 8) return degInSign < 15 ? 1 : 0;   // Dhanu: first half Manava
  if (rashi === 9) return degInSign < 15 ? 0 : 2;   // Makar: second half Jalachara
  return VASHYA_WHOLE[rashi];
}
const VASHYA_MATRIX = [
  [2, 1, 1, 0, 1], [1, 2, 0.5, 0, 1], [1, 0.5, 2, 0, 1], [0, 0, 0, 2, 0], [1, 1, 1, 0, 2],
];
const VARNA_OF_RASHI = [1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0]; // 0 Brahmin 1 Kshatriya 2 Vaishya 3 Shudra (by element)
const VARNA_NAMES = ["Brahmin", "Kshatriya", "Vaishya", "Shudra"];
const YONI_MATRIX = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1], [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1], [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1], [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2], [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1], [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 3, 2, 1], [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 3, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2], [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];
const GANA_MATRIX = { "0,0": 6, "0,1": 6, "0,2": 0, "1,0": 5, "1,1": 6, "1,2": 0, "2,0": 1, "2,1": 0, "2,2": 6 };
const FRIENDS = { Surya: ["Chandra", "Mangal", "Guru"], Chandra: ["Surya", "Budha"], Mangal: ["Surya", "Chandra", "Guru"], Budha: ["Surya", "Shukra"], Guru: ["Surya", "Chandra", "Mangal"], Shukra: ["Budha", "Shani"], Shani: ["Budha", "Shukra"] };
const ENEMIES = { Surya: ["Shukra", "Shani"], Chandra: [], Mangal: ["Budha"], Budha: ["Chandra"], Guru: ["Budha", "Shukra"], Shukra: ["Surya", "Chandra"], Shani: ["Surya", "Chandra", "Mangal"] };
const relRank = (a, b) => a === b ? 0 : FRIENDS[a].includes(b) ? 0 : ENEMIES[a].includes(b) ? 2 : 1;
const MAITRI_POINTS = { "0,0": 5, "0,1": 4, "1,1": 3, "0,2": 1, "1,2": 0.5, "2,2": 0 };
const TARA_NAMES = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyari", "Sadhaka", "Vadha", "Maitra", "Ati-Maitra"];
const KOOTA_INFO = {
  varna: ["Varna", 1, "Spiritual compatibility and mutual respect."],
  vashya: ["Vashya", 2, "Mutual attraction and influence between partners."],
  tara: ["Tara", 3, "Health, fortune and longevity of the union."],
  yoni: ["Yoni", 4, "Physical and intimate compatibility."],
  maitri: ["Graha Maitri", 5, "Mental friendship between the two Moon-sign lords."],
  gana: ["Gana", 6, "Temperament match — Deva, Manushya or Rakshasa nature."],
  bhakoot: ["Bhakoot", 7, "Family welfare, prosperity and emotional rhythm."],
  nadi: ["Nadi", 8, "The most vital koota — health of the union and progeny."],
};

/* moon = {nakIdx, rashi, degInSign, pada} ; p1 treated as groom per classical convention */
function gunaMilan(m1, m2) {
  const rows = [];
  // Varna
  const vr = VARNA_OF_RASHI[m1.rashi] <= VARNA_OF_RASHI[m2.rashi] ? 0 : 0; // rank: lower number = higher varna
  const varnaPts = VARNA_OF_RASHI[m1.rashi] <= VARNA_OF_RASHI[m2.rashi] ? 1 : 0;
  rows.push({ k: "varna", got: varnaPts, note: `${VARNA_NAMES[VARNA_OF_RASHI[m1.rashi]]} × ${VARNA_NAMES[VARNA_OF_RASHI[m2.rashi]]}` });
  // Vashya
  const vc1 = vashyaClass(m1.rashi, m1.degInSign), vc2 = vashyaClass(m2.rashi, m2.degInSign);
  rows.push({ k: "vashya", got: VASHYA_MATRIX[vc1][vc2], note: `${VASHYA_NAMES[vc1]} × ${VASHYA_NAMES[vc2]}` });
  // Tara (both directions)
  const taraLeg = (f, t) => { const c = ((t - f) % 27 + 27) % 27 + 1; const r = c % 9 || 9; return { name: TARA_NAMES[r - 1], bad: [3, 5, 7].includes(r) }; };
  const t1 = taraLeg(m1.nakIdx, m2.nakIdx), t2 = taraLeg(m2.nakIdx, m1.nakIdx);
  rows.push({ k: "tara", got: (t1.bad ? 0 : 1.5) + (t2.bad ? 0 : 1.5), note: `${t1.name} / ${t2.name}` });
  // Yoni
  const y1 = NAK_YONI[m1.nakIdx], y2 = NAK_YONI[m2.nakIdx];
  rows.push({ k: "yoni", got: YONI_MATRIX[y1][y2], note: `${YONI_ANIMALS[y1]} × ${YONI_ANIMALS[y2]}` });
  // Graha Maitri
  const l1 = RASHI_LORDS[m1.rashi], l2 = RASHI_LORDS[m2.rashi];
  const rr = [relRank(l1, l2), relRank(l2, l1)].sort();
  rows.push({ k: "maitri", got: MAITRI_POINTS[rr.join(",")], note: `${l1} × ${l2}` });
  // Gana
  const g1 = NAK_GANA[m1.nakIdx], g2 = NAK_GANA[m2.nakIdx];
  rows.push({ k: "gana", got: GANA_MATRIX[[g1, g2].join(",")], note: `${GANA_NAMES[g1]} × ${GANA_NAMES[g2]}` });
  // Bhakoot
  const c1 = ((m1.rashi - m2.rashi) % 12 + 12) % 12 + 1, c2 = ((m2.rashi - m1.rashi) % 12 + 12) % 12 + 1;
  const pair = [Math.min(c1, c2), Math.max(c1, c2)].join("/");
  const dosha = ["2/12", "5/9", "6/8"].includes(pair);
  let cancelled = false;
  if (dosha) {
    if (l1 === l2) cancelled = true;
    else { const a = relRank(l1, l2), b = relRank(l2, l1); if (a === 0 && b === 0) cancelled = true; }
  }
  rows.push({ k: "bhakoot", got: dosha ? 0 : 7, note: pair + (dosha ? (cancelled ? " dosha — cancelled" : " dosha") : " — clear") });
  // Nadi
  const n1 = NAK_NADI[m1.nakIdx], n2 = NAK_NADI[m2.nakIdx];
  const nadiDosha = n1 === n2;
  let nadiCancel = false;
  if (nadiDosha) {
    if (m1.nakIdx === m2.nakIdx && m1.pada !== m2.pada) nadiCancel = true;
    else if (m1.rashi === m2.rashi && m1.nakIdx !== m2.nakIdx) nadiCancel = true;
    else if (m1.nakIdx === m2.nakIdx && m1.rashi !== m2.rashi) nadiCancel = true;
  }
  rows.push({ k: "nadi", got: nadiDosha ? 0 : 8, note: `${NADI_NAMES[n1]} × ${NADI_NAMES[n2]}` + (nadiDosha ? (nadiCancel ? " dosha — cancelled" : " dosha") : " — clear") });

  const total = rows.reduce((s, r) => s + r.got, 0);
  const band = total < 18 ? "Not recommended" : total < 25 ? "Average" : total < 33 ? "Good" : "Excellent";
  return { rows, total, band, doshas: { bhakoot: dosha && !cancelled, nadi: nadiDosha && !nadiCancel } };
}

/* ---------------- Daily Rashifal (deterministic, date-seeded) ---------------- */
function seededRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const RASHI_TRAITS = [
  "Bold beginnings favour you today. Channel that fire into one decisive action.",
  "Steady wins. Protect your energy and let consistency do the talking.",
  "Your words carry weight today — say the important thing, kindly.",
  "Nurture what matters. Home and heart ask for a little extra attention.",
  "Step into the light. Recognition comes to those who show up fully.",
  "Details are your superpower today. Organise, refine, perfect.",
  "Balance returns. A pending decision finally feels clear.",
  "Depth over drama. Trust your instincts on money matters.",
  "Adventure calls. Say yes to the plan you've been postponing.",
  "Discipline pays. A long-term effort shows its first real result.",
  "Original thinking breaks the deadlock. Share the unusual idea.",
  "Intuition is loud today. Quiet the noise and listen within.",
];
const LOVE_LINES = ["An honest conversation deepens a bond.", "Someone notices the small things you do.", "Patience in love pays off beautifully.", "Express, don't assume — clarity wins hearts.", "Old warmth returns in a relationship.", "New connections feel promising; stay open."];
const CAREER_LINES = ["A pending task finally moves forward.", "Your effort gets noticed by the right person.", "Good day for planning, not rushing.", "Collaboration beats solo effort today.", "Financial decisions need a second look.", "A mentor's advice proves valuable."];
const HEALTH_LINES = ["Prioritise rest — your body is asking.", "Light exercise will lift your mood.", "Watch your meals; eat on time today.", "A short walk clears mental fog.", "Hydrate well and avoid late nights.", "Breathing exercises bring quick calm."];
const LUCKY_COLORS = ["Gold", "White", "Red", "Green", "Yellow", "Saffron", "Silver", "Maroon", "Sky Blue", "Orange", "Cream", "Emerald"];
function rashifal(rashiIdx, date) {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}:${rashiIdx}`;
  const rnd = seededRand(key);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const score = 3 + Math.floor(rnd() * 3); // 3..5
  const sh = 6 + Math.floor(rnd() * 5), sm = ["00", "30"][Math.floor(rnd() * 2)];
  const eh = sh + 2, ehh = eh > 12 ? eh - 12 : eh, ap = eh >= 12 ? "PM" : "AM";
  return {
    rashi: RASHIS[rashiIdx],
    score,
    overview: RASHI_TRAITS[rashiIdx],
    love: pick(LOVE_LINES), career: pick(CAREER_LINES), health: pick(HEALTH_LINES),
    luckyNumber: 1 + Math.floor(rnd() * 99),
    luckyColor: pick(LUCKY_COLORS),
    shubhTime: `${sh}:${sm} AM – ${ehh}:${sm} ${ap}`,
  };
}

/* ---------------- Varshphal 2026 (yearly overview per rashi) ---------------- */
const VARSHAPHAL_2026 = [
  "2026 brings momentum, Mesh. Jupiter's gaze sharpens your ambition till mid-year — a career leap is likely between April and August. Relationships need patience in October. Health stays strong if you respect rest.",
  "A year of consolidation, Vrishabh. Finances stabilise and a long-pending property or investment matter resolves favourably. Love deepens through honest talk. Watch throat and digestion in monsoon.",
  "Your sharpest year in a while, Mithun. Communication-led work, writing, media and trade shine. A mentor opens a door in the second half. Avoid overcommitting in March–April.",
  "Home, heart and emotional security take centre stage, Kark. Family bonds strengthen; a move or renovation is favoured after June. Career grows quietly but surely. Guard against mood swings.",
  "The spotlight finds you, Simha. Leadership roles and recognition peak mid-year. Finances improve through your own initiative. In love, generosity wins — but don't overgive. Mind the heart and BP.",
  "Systems beat stress this year, Kanya. Your methodical work gets noticed and rewarded, especially September–November. Health improves with routine. A sibling or close friend needs your counsel.",
  "Partnerships define 2026 for you, Tula. Business alliances and marriage prospects look bright. Creative pursuits flourish. Balance spending in the festive season. Skin and kidneys need care.",
  "Transformation year, Vrishchik. Old patterns break; new income channels open after May. Research and occult interests deepen. Keep documents clean — legal clarity matters. Drive carefully.",
  "Expansion and optimism, Dhanu. Travel, higher learning and teaching bring luck. A long-cherished goal materialises late in the year. Guide your energy — scattered efforts dilute results.",
  "Slow, steady, victorious — classic Makar 2026. Career foundations laid now pay for a decade. Elders' blessings prove practical. Love asks for vulnerability; give it. Knees and joints need attention.",
  "Innovation pays, Kumbh. Technology, networks and unconventional ideas bring gains, especially January–March and October–December. Friendships transform. Sleep discipline is non-negotiable.",
  "A deeply spiritual and creative year, Meen. Intuition guides big decisions correctly — trust it. Foreign connections and artistic work prosper. Guard against escapism; feet and immunity need care.",
];
