/* Nakshatra app UI — 5 tabs, UPI premium, localStorage profiles. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- profiles ---------- */
const store = {
  get all() { try { return JSON.parse(localStorage.getItem("nk_profiles") || "[]"); } catch { return []; } },
  set all(v) { localStorage.setItem("nk_profiles", JSON.stringify(v.slice(0, 3))); },
  get active() { try { return JSON.parse(localStorage.getItem("nk_active") || "null"); } catch { return null; } },
  set active(v) { localStorage.setItem("nk_active", JSON.stringify(v)); },
};

function birthJD(p) {
  const [y, m, d] = p.dob.split("-").map(Number);
  if (p.unknownTime) return { jd: julianDay(y, m, d, 6.5), approx: true }; // noon IST
  const [hh, mm] = (p.tob || "12:00").split(":").map(Number);
  return { jd: jdFromIST(y, m, d, hh, mm), approx: false };
}
function moonData(jd) {
  const c = computeChart(jd);
  const nk = nakOf(c.moon), r = rashiOf(c.moon);
  return { chart: c, nakIdx: nk.idx, pada: nk.pada, rashi: r, degInSign: norm360(c.moon) % 30, moon: c.moon };
}

/* ---------- North Indian kundli SVG (Chandra kundli: house 1 = Moon rashi) ---------- */
const HOUSE_POLY = {
  1: "150,0 225,75 150,150 75,75", 2: "0,0 150,0 75,75", 3: "0,0 0,150 75,75",
  4: "0,150 75,75 150,150 75,225", 5: "0,150 0,300 75,225", 6: "0,300 150,300 75,225",
  7: "150,300 225,225 150,150 75,225", 8: "300,300 150,300 225,225", 9: "300,300 300,150 225,225",
  10: "300,150 225,225 150,150 225,75", 11: "300,150 300,0 225,75", 12: "300,0 150,0 225,75",
};
const HOUSE_C = { 1: [150, 82], 2: [72, 28], 3: [28, 72], 4: [72, 150], 5: [28, 228], 6: [72, 272], 7: [150, 218], 8: [228, 272], 9: [272, 228], 10: [228, 150], 11: [272, 72], 12: [228, 28] };
const GRAHA_SHORT = { Surya: "Su", Chandra: "Mo", Mangal: "Ma", Budha: "Me", Guru: "Ju", Shukra: "Ve", Shani: "Sa", Rahu: "Ra", Ketu: "Ke" };
const CHART_ORDER = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
const CHART_GRAHA = { sun: "Surya", moon: "Chandra", mars: "Mangal", mercury: "Budha", jupiter: "Guru", venus: "Shukra", saturn: "Shani", rahu: "Rahu", ketu: "Ketu" };

function kundliSVG(chart, moonRashi) {
  const houses = {};
  for (const k of CHART_ORDER) {
    const r = rashiOf(chart[k]);
    const h = ((r - moonRashi + 12) % 12) + 1;
    (houses[h] = houses[h] || []).push(GRAHA_SHORT[CHART_GRAHA[k]]);
  }
  let s = `<svg viewBox="0 0 300 300" class="kundli" role="img" aria-label="Chandra kundli chart">`;
  s += `<rect x="1" y="1" width="298" height="298" class="k-box"/>`;
  s += `<line x1="0" y1="0" x2="300" y2="300" class="k-line"/><line x1="300" y1="0" x2="0" y2="300" class="k-line"/>`;
  s += `<polygon points="150,0 300,150 150,300 0,150" class="k-line k-fill"/>`;
  for (let h = 1; h <= 12; h++) {
    const sign = (moonRashi + h - 1) % 12;
    const [cx, cy] = HOUSE_C[h];
    const pls = (houses[h] || []).join(" ");
    s += `<text x="${cx}" y="${cy - 8}" class="k-sign" text-anchor="middle">${sign + 1}</text>`;
    if (pls) s += `<text x="${cx}" y="${cy + 10}" class="k-graha" text-anchor="middle">${pls}</text>`;
  }
  return s + "</svg>";
}

/* ---------- tabs ---------- */
const TABS = [
  ["kundli", "Kundli", "☉"], ["rashifal", "Rashifal", "☽"], ["milan", "Milan", "⚭"],
  ["panchang", "Panchang", "ॐ"], ["premium", "Premium", "♛"],
];
let curTab = "kundli";
function nav(tab) {
  curTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.tab === tab));
  document.querySelectorAll(".pane").forEach(p => p.hidden = p.id !== "pane-" + tab);
  window.scrollTo({ top: 0 });
  if (tab === "premium") renderPremium();
  if (tab === "panchang") renderPanchang();
}

/* ---------- Kundli pane ---------- */
function kundliFormHTML(p) {
  return `
  <form id="kform" class="card form-card">
    <div class="card-title">Birth details</div>
    <label>Name<input name="name" required maxlength="40" placeholder="Your name" value="${esc(p?.name || "")}"></label>
    <div class="row2">
      <label>Date of birth<input name="dob" type="date" required min="1920-01-01" max="2026-10-01" value="${esc(p?.dob || "")}"></label>
      <label>Time of birth<input name="tob" type="time" value="${esc(p?.tob || "")}" ${p?.unknownTime ? "disabled" : ""}></label>
    </div>
    <label class="check"><input type="checkbox" name="unknown" ${p?.unknownTime ? "checked" : ""}> I don't know my birth time <span class="hint">(Moon sign is still computed; marked approximate)</span></label>
    <button class="btn-gold btn-block" type="submit">Generate Kundli</button>
  </form>`;
}
function renderKundli() {
  const p = store.active;
  $("#kform-wrap").innerHTML = kundliFormHTML(p);
  const f = $("#kform");
  f.unknown.addEventListener("change", e => { f.tob.disabled = e.target.checked; });
  f.addEventListener("submit", e => {
    e.preventDefault();
    const prof = { name: f.name.value.trim(), dob: f.dob.value, tob: f.unknown.checked ? "" : (f.tob.value || "12:00"), unknownTime: f.unknown.checked };
    const all = store.all.filter(x => x.dob !== prof.dob || x.name !== prof.name);
    all.unshift(prof); store.all = all; store.active = prof;
    renderKundliResult(prof);
  });
  if (p) renderKundliResult(p); else $("#kresult").innerHTML = "";
}
function renderKundliResult(p) {
  const { jd, approx } = birthJD(p);
  const md = moonData(jd), c = md.chart;
  const r = RASHIS[md.rashi];
  const vd = vimshottari(jd, md.moon);
  const ti = tithiOf(c.sun, c.moon);
  const rows = CHART_ORDER.map(k => {
    const g = CHART_GRAHA[k], lon = norm360(c[k]);
    const rr = RASHIS[rashiOf(c[k])];
    return `<tr><td>${GRAHAS[g].glyph} ${g}</td><td>${rr.en} (${rr.hi})</td><td>${lon.toFixed(1)}°</td></tr>`;
  }).join("");
  $("#kresult").innerHTML = `
    <div class="card">
      <div class="card-title">${esc(p.name)}'s Kundli ${approx ? '<span class="badge">approx — time unknown</span>' : ""}</div>
      <div class="kundli-wrap">${kundliSVG(c, md.rashi)}</div>
      <p class="note">Chandra Kundli — houses counted from your Moon sign (${r.en}). Exact Lagna needs birth place; this Moon chart is the classical fallback.</p>
    </div>
    <div class="grid2">
      <div class="card stat"><div class="stat-l">Rashi</div><div class="stat-v">${r.glyph} ${r.en}</div><div class="stat-s">${r.hi} · Lord ${r.lord}</div></div>
      <div class="card stat"><div class="stat-l">Nakshatra</div><div class="stat-v">${NAKSHATRAS[md.nakIdx]}</div><div class="stat-s">Pada ${md.pada}</div></div>
      <div class="card stat"><div class="stat-l">Tithi</div><div class="stat-v">${ti.name}</div><div class="stat-s">${ti.paksha} paksha</div></div>
      <div class="card stat"><div class="stat-l">Dasha at birth</div><div class="stat-v">${vd.birthLord}</div><div class="stat-s">Vimshottari mahadasha</div></div>
    </div>
    <div class="card">
      <div class="card-title">Planet placements <span class="hint">(sidereal, Lahiri)</span></div>
      <table class="tbl"><tr><th>Graha</th><th>Rashi</th><th>Longitude</th></tr>${rows}</table>
    </div>
    <div class="upsell card" onclick="nav('premium')">
      <img src="assets/premium.png" alt="">
      <div><b>Unlock your Dasha timeline, gemstone &amp; Sade Sati</b><span>Nakshatra Premium · ₹199 one-time</span></div>
    </div>`;
}

/* ---------- Rashifal pane ---------- */
let rashiSel = 0;
try {
  const ap = store.active;
  if (ap && ap.dob) {
    const [ay, am, ad] = ap.dob.split("-").map(Number);
    const ajd = jdFromIST(ay, am, ad, 12, 0);
    rashiSel = rashiOf(sidereal(moonLong(ajd), ajd));
  }
} catch { rashiSel = 0; }
function renderRashifal() {
  const today = new Date();
  const chips = RASHIS.map((r, i) => `<button class="chip${i === rashiSel ? " on" : ""}" data-i="${i}">${r.glyph}<span>${r.hi}</span></button>`).join("");
  const h = rashifal(rashiSel, today);
  const stars = "★".repeat(h.score) + "☆".repeat(5 - h.score);
  $("#pane-rashifal").innerHTML = `
    <div class="card">
      <div class="card-title">Today's Rashifal <span class="hint">${today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span></div>
      <div class="chips">${chips}</div>
    </div>
    <div class="card horo">
      <div class="horo-head"><span class="horo-glyph">${h.rashi.glyph}</span>
        <div><div class="horo-name">${h.rashi.en} <span class="hint">(${h.rashi.hi})</span></div>
        <div class="stars">${stars}</div></div></div>
      <p class="horo-over">${h.overview}</p>
      <div class="horo-sec"><b>Love</b><p>${h.love}</p></div>
      <div class="horo-sec"><b>Career</b><p>${h.career}</p></div>
      <div class="horo-sec"><b>Health</b><p>${h.health}</p></div>
      <div class="lucky"><div><span>Lucky number</span><b>${h.luckyNumber}</b></div><div><span>Lucky colour</span><b>${h.luckyColor}</b></div><div><span>Shubh time</span><b>${h.shubhTime}</b></div></div>
    </div>
    <div class="card"><div class="card-title">Explore the 12 Rashis</div>
      <div class="rashi-list">${RASHIS.map((r, i) => `<button class="rashi-row" data-i="${i}"><span class="horo-glyph sm">${r.glyph}</span><span><b>${r.en}</b> <span class="hint">${r.hi}</span></span><span class="hint">Lord ${r.lord}</span></button>`).join("")}</div>
    </div>`;
  document.querySelectorAll("#pane-rashifal .chip").forEach(b => b.onclick = () => { rashiSel = +b.dataset.i; renderRashifal(); });
  document.querySelectorAll("#pane-rashifal .rashi-row").forEach(b => b.onclick = () => { rashiSel = +b.dataset.i; renderRashifal(); window.scrollTo({ top: 0 }); });
}

/* ---------- Milan pane ---------- */
function milanMiniForm(id, label) {
  return `<div class="card form-card"><div class="card-title">${label}</div>
    <div class="row2"><label>Date of birth<input type="date" id="${id}-dob" required min="1920-01-01" max="2026-10-01"></label>
    <label>Time of birth<input type="time" id="${id}-tob" value="12:00"></label></div></div>`;
}
function renderMilan() {
  $("#pane-milan").innerHTML = `
    <div class="card"><div class="card-title">Kundli Milan <span class="hint">Ashtakoota · 36 gunas</span></div>
    <p class="note">Enter both birth details. The classical 36-guna match is computed from the Moon's nakshatra and rashi.</p></div>
    ${milanMiniForm("m1", "Partner 1")}${milanMiniForm("m2", "Partner 2")}
    <button class="btn-gold btn-block" id="milan-go">Check Compatibility</button>
    <div id="milan-out"></div>`;
  $("#milan-go").onclick = () => {
    const get = id => {
      const d = $("#" + id + "-dob").value, t = $("#" + id + "-tob").value || "12:00";
      if (!d) return null;
      const [y, m, dd] = d.split("-").map(Number), [hh, mm] = t.split(":").map(Number);
      return moonData(jdFromIST(y, m, dd, hh, mm));
    };
    const a = get("m1"), b = get("m2");
    if (!a || !b) { $("#milan-out").innerHTML = `<p class="pay-err">Please enter both birth dates.</p>`; return; }
    const gm = gunaMilan(a, b);
    const prem = NKPay.hasPremium();
    const rows = prem ? gm.rows.map(r => {
      const [nm, max, desc] = KOOTA_INFO[r.k];
      return `<div class="koota"><div class="koota-h"><b>${nm}</b><span>${r.got} / ${max}</span></div>
        <div class="bar"><i style="width:${(r.got / max * 100).toFixed(0)}%"></i></div>
        <p class="hint">${esc(r.note)} — ${desc}</p></div>`;
    }).join("") : "";
    const doshaNote = (gm.doshas.bhakoot || gm.doshas.nadi)
      ? `<p class="warn">Dosha present: ${[gm.doshas.bhakoot && "Bhakoot", gm.doshas.nadi && "Nadi"].filter(Boolean).join(" + ")}. Classical texts advise consulting an experienced jyotishi before proceeding.</p>`
      : `<p class="ok">No Bhakoot or Nadi dosha.</p>`;
    $("#milan-out").innerHTML = `
      <div class="card score-card">
        <div class="score">${gm.total}<span> / 36</span></div>
        <div class="band">${gm.band}</div>
        <p class="hint">Below 18 — not recommended · 18–24 average · 25–32 good · 33–36 excellent</p>
      </div>
      ${prem ? `<div class="card"><div class="card-title">The 8 Kootas</div>${rows}${doshaNote}</div>`
            : `<div class="upsell card" onclick="nav('premium')"><div><b>Unlock the full 8-koota breakdown</b><span>See exactly where you match — Varna to Nadi, doshas included · Premium ₹199</span></div></div>`}`;
    $("#milan-out").scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

/* ---------- Panchang pane ---------- */
function renderPanchang() {
  const p = panchang(new Date());
  $("#pane-panchang").innerHTML = `
    <div class="card">
      <div class="card-title">Today's Panchang <span class="hint">${p.date}</span></div>
      <div class="pgrid">
        <div><span>Vaar</span><b>${p.vaara}</b></div>
        <div><span>Tithi</span><b>${p.tithi}</b></div>
        <div><span>Nakshatra</span><b>${p.nakshatra}</b></div>
        <div><span>Yoga</span><b>${p.yoga}</b></div>
        <div><span>Karana</span><b>${p.karana}</b></div>
        <div><span>Moon in</span><b>${p.moonRashi}</b></div>
      </div>
    </div>
    <div class="grid2">
      <div class="card stat"><div class="stat-l">Rahu Kaal</div><div class="stat-v small">${p.rahuKaal}</div><div class="stat-s">avoid new beginnings</div></div>
      <div class="card stat"><div class="stat-l">Abhijit Muhurat</div><div class="stat-v small">${p.abhijit}</div><div class="stat-s">most auspicious window</div></div>
    </div>
    <div class="card"><div class="card-title">Upcoming festivals</div>
      ${upcomingFestivals(8).map(f => `<div class="fest"><span><b>${f.name}</b><span class="hint">${f.weekday}</span></span><b class="gold">${f.date}</b></div>`).join("")}
      <p class="hint">Festival dates follow the commonly published 2026 calendar; local panchangs may differ by a day.</p>
    </div>`;
}

/* ---------- Premium pane ---------- */
function renderPremium() {
  const el = $("#pane-premium");
  if (NKPay.hasPremium()) {
    const p = store.active;
    let dashaHTML = `<p class="note">Generate your Kundli first to see your personalised dasha timeline.</p>`;
    let gemHTML = "", sadeHTML = "";
    if (p) {
      const { jd } = birthJD(p);
      const md = moonData(jd), vd = vimshottari(jd, md.moon);
      const g = gemstone(md.rashi), ss = sadeSati(md.rashi);
      dashaHTML = `
        <div class="cur-dasha">Now: <b>${vd.current.mahadasha} Mahadasha</b> · <b>${vd.current.antardasha} Antardasha</b><br>
        <span class="hint">${vd.current.antarFrom} → ${vd.current.antarTo}</span></div>
        <table class="tbl"><tr><th>Mahadasha</th><th>Years</th><th>Period</th></tr>
        ${vd.mahadashas.slice(0, 6).map(m => `<tr><td>${m.lord}</td><td>${m.years}</td><td>${m.from} → ${m.to}</td></tr>`).join("")}</table>`;
      gemHTML = `<div class="card"><div class="card-title">Your Gemstone</div>
        <div class="gem"><b>${g.stone}</b><p>Lord of your Moon sign (${RASHIS[md.rashi].en}) is ${g.lord}.</p>
        <p class="hint">Wear on ${g.day}, ${g.finger}, in ${g.metal}. Consult a jeweller-jyotishi for weight and energisation.</p></div></div>`;
      sadeHTML = `<div class="card"><div class="card-title">Sade Sati</div>
        <div class="cur-dasha">${ss.active ? `Active — <b>${ss.phase} phase</b>` : "<b>No Sade Sati</b> on your Moon sign"}</div>
        <p class="note">${ss.detail}</p></div>`;
    }
    el.innerHTML = `
      <div class="card premium-on"><div class="card-title">Premium active</div>
      <p class="note">All premium features are unlocked on this device.</p></div>
      <div class="card"><div class="card-title">Vimshottari Dasha timeline</div>${dashaHTML}</div>
      ${gemHTML}${sadeHTML}
      <div class="card"><div class="card-title">Varshphal 2026 — yearly horoscope</div>
        <div class="chips">${RASHIS.map((r, i) => `<button class="chip${i === rashiSel ? " on" : ""}" data-i="${i}">${r.glyph}<span>${r.hi}</span></button>`).join("")}</div>
        <p class="horo-over" id="varsh">${VARSHAPHAL_2026[rashiSel]}</p></div>
      <div class="card"><div class="card-title">Kundli Milan — full report</div>
        <p class="note">The complete 8-koota breakdown with dosha analysis is now unlocked in the Milan tab.</p>
        <button class="btn-gold" onclick="nav('milan')">Open Milan</button></div>`;
    el.querySelectorAll(".chip").forEach(b => b.onclick = () => { rashiSel = +b.dataset.i; renderPremium(); });
    return;
  }
  el.innerHTML = `
    <div class="prem-hero"><img src="assets/premium.png" alt="">
      <div><div class="card-title">Nakshatra Premium</div>
      <p>Go beyond the basics — the full depth of your kundli, decoded.</p></div></div>
    <div class="card"><div class="card-title">What you unlock</div>
      <ul class="feat">
        <li><b>Vimshottari Dasha timeline</b><span>Current mahadasha &amp; antardasha with exact periods, plus what's next</span></li>
        <li><b>Full Kundli Milan report</b><span>All 8 kootas scored, doshas flagged, classical cancellations checked</span></li>
        <li><b>Gemstone recommendation</b><span>Based on your Moon-sign lord — stone, day, finger, metal</span></li>
        <li><b>Sade Sati status</b><span>Live Saturn transit vs your Moon sign, phase by phase</span></li>
        <li><b>Varshphal 2026</b><span>Year-ahead reading for all 12 rashis</span></li>
      </ul></div>
    <div id="pay-wrap"></div>`;
  NKPay.render($("#pay-wrap"), () => renderPremium());
}

/* ---------- init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  $("#tabs").innerHTML = TABS.map(([id, label, glyph]) => `<button class="tab${id === "kundli" ? " on" : ""}" data-tab="${id}"><span class="tg">${glyph}</span>${label}</button>`).join("");
  document.querySelectorAll(".tab").forEach(t => t.onclick = () => nav(t.dataset.tab));
  renderKundli(); renderRashifal(); renderMilan(); renderPanchang(); renderPremium();
});
