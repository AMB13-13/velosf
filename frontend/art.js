const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const paths = {
  home: "m3 10 9-7 9 7v10h-6v-6H9v6H3z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  bike: "M9 16a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm14 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 16l5-9 4 9H5l12-9m2 9-3-12h-3M7 7h5",
  bag: "M4 8h16l1 13H3L4 8Zm4 0V6a4 4 0 1 1 8 0v2",
  box: "m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5m-9 5v10M7 5l10 5",
  msg: "M3 4h18v13H9l-6 4V4Zm5 5h8m-8 4h5",
  clip: "M8 4H5v17h14V4h-3M8 2h8v5H8zM8 12l2 2 5-5",
  route:
    "M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9 5h7a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h7",
  tool: "M14 4a5 5 0 0 0-6 6l-6 7a3 3 0 0 0 5 4l7-8a6 6 0 0 0 7-7l-4 4-4-4 3-4z",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  ticket: "M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Zm12 1v2m0 2v2m0 2v2",
  card: "M2 5h20v14H2zM2 9h20M6 15h4",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  chev: "m9 6 6 6-6 6",
  menu: "M3 6h18M3 12h18M3 18h18",
  truck:
    "M2 5h12v12H2zM14 10h4l4 4v3h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  shield: "m12 2 8 4v6c0 5-5 9-8 10-3-1-8-5-8-10V6l8-4Zm-4 10 3 3 5-6",
  sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
};
function ic(k) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[k] || paths.grid}"/></svg>`;
}
const roles = [
  [
    "Responsable",
    "#3165aa",
    "#eaf1fb",
    "shield",
    "Gère les stations, les vélos et les missions du réseau.",
    "stations",
  ],
  [
    "Technicien",
    "#c57029",
    "#fff0df",
    "tool",
    "Contrôle les vélos et organise tes tournées terrain.",
    "controle",
  ],
  [
    "Abonné",
    "#23866e",
    "#e1f3ea",
    "card",
    "Choisis ton vélo et retrouve tes trajets au quotidien.",
    "auth",
  ],
  [
    "Occasionnel",
    "#8159b0",
    "#f0eafa",
    "ticket",
    "Loue un vélo librement avec ta carte courte durée.",
    "occasion",
  ],
];
const nav = [
  [
    ["stations", "Stations", "pin"],
    ["parc", "Parc de vélos", "bike"],
    ["achat", "Acheter un vélo", "bag"],
    ["fournisseurs", "Fournisseurs", "box"],
    ["reclamations", "Réclamations", "msg"],
    ["missions", "Missions", "clip"],
    ["itineraires", "Itinéraires", "route"],
  ],
  [
    ["controle", "Contrôle journalier", "tool"],
    ["tournee", "Tournée de répartition", "truck"],
  ],
  [
    ["auth", "S’authentifier", "user"],
    ["choisir", "Choisir / restituer", "bike"],
  ],
  [["occasion", "Location courte durée", "ticket"]],
];
const theme = (r) => `--col:${r[1]};--bg:${r[2]}`;
let logo = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="#edf6ef" stroke="#16a8a3" stroke-width="4"/>${["#ed6c48", "#f6bb42", "#e25342", "#eeb43c"].map((c, i) => `<path d="M20 4v32" stroke="${c}" stroke-width="3.5" transform="rotate(${i * 45} 20 20)"/>`).join("")}<circle cx="20" cy="20" r="4" fill="#1b344a"/></svg>`;
function bicycle(color = "#ee624e") {
  let wheel = (x) =>
    `<circle cx="${x}" cy="110" r="47" fill="none" stroke="#243744" stroke-width="8"/><circle cx="${x}" cy="110" r="42.5" fill="none" stroke="#f8ead2" stroke-width="2"/>${Array.from({ length: 10 }, (_, i) => `<path d="M${x} 68v84" transform="rotate(${i * 18} ${x} 110)" stroke="#49606a" stroke-width=".85"/>`).join("")}`;
  return `<svg viewBox="0 0 320 175" xmlns="http://www.w3.org/2000/svg"><ellipse cx="159" cy="162" rx="139" ry="5" fill="#19383a" opacity=".14"/>${wheel(63)}${wheel(254)}<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="m63 110 44-68 31 69-75-1 47-62 122-8-94 71 94-71 22 70-27-93" stroke="${color}" stroke-width="7"/><path d="m110 47-7-18m125-8-4-10 22-1" stroke="#354b51" stroke-width="5"/><path d="M90 28h31m118-18h12" stroke="#20313d" stroke-width="8"/><path d="M226 16q30 26 14 46" stroke="#304854" stroke-width="1.8"/><path d="m63 106 72-3q15 4 4 15l-77-5z" stroke="#516269" stroke-width="2"/><circle cx="138" cy="111" r="8" fill="#32474d"/><path d="m138 111 10 10h10m-20-10-7-9h-8" stroke="#1e3440" stroke-width="3.5"/></g></svg>`;
}
function scene() {
  let buildings = Array.from({ length: 17 }, (_, i) => {
    let x = 415 + i * 40,
      h = [21, 38, 29, 48, 18, 40][i % 6];
    return `<path d="M${x} 238v-${h}h34v${h}" fill="${["#b0cfd0", "#c2d8cf", "#e4ddc0"][i % 3]}"/>`;
  }).join("");
  return `<svg class="heroart" viewBox="0 0 1100 360" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="sky"><stop stop-color="#e0f0ef"/><stop offset=".63" stop-color="#b9e2eb"/><stop offset="1" stop-color="#9ed6e5"/></linearGradient><linearGradient id="veil"><stop stop-color="#dfefed"/><stop offset="1" stop-color="#dfefed" stop-opacity="0"/></linearGradient></defs><rect width="1100" height="360" fill="url(#sky)"/><circle cx="879" cy="74" r="47" fill="#ffdb7b"/><circle cx="879" cy="74" r="54" fill="none" stroke="#ffe7a3" opacity=".48"/><g fill="#fff" opacity=".78"><path d="M580 73q2-9 16-8 5-20 25-12 9-6 16 6 17-1 20 14zM957 101q3-11 15-10 10-20 26-8 14-3 19 10 16-1 19 8z"/></g><g fill="none" stroke="#507f87" stroke-width="1.8"><path d="M740 77q5-3 10 3 4-7 10-6m-38 15q4-2 8 2 2-5 7-4"/></g>${buildings}<g fill="#f6e4bc"><path d="M670 227v-59h50v59m-44-59 1-8h10v8h9v-8h11v8m38 59v-89h22v89m-25-89 4-9h18l5 9m-19-10v-12l5-11 6 11v12"/><path d="M565 238v-43h180v43m-180-42v-8h9v8h10v-8h9v8h10v-8h9v8h10v-8h9v8h10v-8h9v8h10v-8h9v8h10v-8h9v8h10v-8h9v8h10v-8h9v8"/></g><g fill="#bea475"><path d="M682 227v-24q11-18 22 0v24zM751 154v-7q4-7 8 0v7z"/>${[577, 606, 635, 672, 712].map((x) => `<rect x="${x}" y="204" width="4" height="10" rx="2"/>`).join("")}</g><path d="M0 232q198-21 304-4 146-28 267-2 131-10 268 2 140-15 261-12v39H0z" fill="#8eae89"/><path d="M0 243q220-16 422-3 161-11 330 0 162-18 348-11v16L0 278z" fill="#5d9382"/><path d="m0 255 1100-17v122H0z" fill="#e5cd96"/><path d="m0 331 1100-76v105H0z" fill="#465863"/><path d="m0 343 1100-79" stroke="#f3dfaf" stroke-width="2"/><path d="m470 360 630-65" stroke="#efc96e" stroke-width="3" stroke-dasharray="46 28"/><g transform="translate(995 228)"><path d="M0 0q5-49-6-95l7-1Q18-45 10 0" fill="#816d49"/><g fill="#426e62"><path d="M-4-93q-28-36-57-9 38-9 57 9m0 0q-30-17-48 20 22-22 48-20m0 0q14-48 46-34-30 6-46 34m0 0q32-27 58 5-31-13-58-5m0 0q35-4 36 31-14-23-36-31m0 0q-26-7-27 31 12-23 27-31m0 0q-21-43-43-34 24 15 43 34"/></g></g><rect width="560" height="360" fill="url(#veil)"/><svg x="579" y="130" width="421" height="216" viewBox="0 0 320 175">${bicycle().replace(/^<svg[^>]+>|<\/svg>$/g, "")}</svg></svg>`;
}
