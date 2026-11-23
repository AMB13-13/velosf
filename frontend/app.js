function toast(t) {
  $("#msg").innerHTML = `<div class="toast">${esc(t)}</div>`;
  clearTimeout(window.tm);
  window.tm = setTimeout(() => ($("#msg").innerHTML = ""), 3000);
}
function go(p) {
  closeDlg();
  location.hash = p;
  if (page === p) render();
}
function closeDlg() {
  $("#modal").innerHTML = "";
}
function dlg(title, html) {
  $("#modal").innerHTML =
    `<div class="overlay" onclick="if(event.target===this)closeDlg()"><section class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="spread"><h2>${title}</h2><button class="tiny" onclick="closeDlg()" aria-label="Fermer">✕</button></div>${html}</section></div>`;
  $("#modal input, #modal button")?.focus();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDlg();
    document.body.classList.remove("navopen");
  }
});
function act(text, fn, kind = "btn") {
  return `<button class="${kind}" onclick="${fn}">${text}</button>`;
}
function href(t, p, cl = "btn") {
  return `<a class="${cl}" href="#${p}">${t}</a>`;
}
function field(t, n, v = "", type = "text", more = "") {
  return `<label class="field">${t}<input name="${n}" type="${type}" value="${esc(v)}" required ${more}></label>`;
}
function select(t, n, opts, idx = 0) {
  return `<label class="field">${t}<select name="${n}">${opts.map((s, i) => `<option value="${i}" ${idx == i ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>`;
}
function form(fn, body, t) {
  return `<form onsubmit="event.preventDefault();${fn}(new FormData(this))">${body}<button class="btn" type="submit">${t} ${ic("arrow")}</button></form>`;
}
let navrow = (n) =>
  `<a class="navbtn ${page === n[0] ? "active" : ""}" href="#${n[0]}">${ic(n[2])}${n[1]}</a>`;
function hsection(t, sub = "", right = "") {
  return `<div class="sectionhead"><div><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${right}</div>`;
}
function banner(i, t) {
  let r = roles[i];
  return `<section class="banner" style="${theme(r)}"><span class="roleicon">${ic(r[3])}</span><div><span class="overline">Espace ${r[0]}</span><h1>${t}</h1></div></section>`;
}
function home() {
  return `<section class="hero">${scene()}<div class="hcopy"><span class="overline"><i class="dot" style="--col:#35957d"></i> Cyclosfaxcity · Sfax</span><h1>Pédale dans<br><em>Sfax.</em></h1><p>Prends un vélo à la station VéloSf la plus proche, rends-le près de ta destination.</p><div class="actions">${href(ic("bike") + " Louer un vélo", "louer")}${href("Voir les stations", "reseau", "btn light")}</div></div><span class="scenelabel">01 / MÉDINA DE SFAX</span></section>${hsection("Choisis ton espace", "Un accès adapté à chaque façon de rouler.", '<span class="counter">04 espaces</span>')}<div class="roles">${roles.map((r, i) => `<a class="role" href="#${r[5]}" style="${theme(r)}"><span class="roleicon">${ic(r[3])}</span><span class="rolenum">0${i + 1} /</span><h3>${r[0]}</h3><p>${r[4]}</p><span class="enter">Entrer dans l’espace <i>${ic("arrow")}</i></span></a>`).join("")}</div>${hsection("Stations à proximité", "Un aperçu des disponibilités du réseau.", href("Toutes les stations " + ic("arrow"), "reseau", "link"))}<div class="grid">${D.stations
    .slice(0, 3)
    .map((s, i) => station(s, i, false))
    .join("")}</div>`;
}
function art(b) {
  return `<div class="bikeart" style="--bg:color-mix(in srgb,${esc(b.color)} 19%,white)">${bicycle(esc(b.color))}</div>`;
}
function routeMap() {
  return `<svg viewBox="0 0 420 220" class="minimap" aria-label="Schéma de l’itinéraire"><rect width="420" height="220" fill="#e8ebd5"/><path d="M0 150q75-20 110 70H0" fill="#8dcbd4"/><g stroke="#fff" stroke-width="10"><path d="m0 35 420 90M0 123l420 73M63 0l-26 220M164 0l-45 220M284 0l-46 220M396 0l-52 220"/></g><path d="m51 166 85-54 81 22 61-72 65 19" fill="none" stroke="#b87533" stroke-width="3" stroke-dasharray="6 4"/>${[
    [51, 166],
    [136, 112],
    [217, 134],
    [278, 62],
    [343, 81],
  ]
    .map(
      ([x, y], i) =>
        `<circle cx="${x}" cy="${y}" r="11" fill="#244856"/><text x="${x}" y="${y + 4}" fill="white" text-anchor="middle" font-size="11">${i + 1}</text>`,
    )
    .join("")}</svg>`;
}
function louer() {
  return (
    banner(2, "Louer un vélo") +
    `<div class="split"><div class="panel"><h2>Avec abonnement</h2><p>Utilise ta carte VéloSf et ton code secret.</p>${href("Espace abonné", "auth")}</div><div class="panel"><h2>Sans abonnement</h2><p>Obtiens une carte courte durée pour ton trajet.</p>${href("Location courte durée", "occasion")}</div></div>`
  );
}
let D = { stations: [] },
  page = "accueil",
  filter = "Tous",
  selectedStation = 0,
  checkId = 0,
  cardScanned = false,
  loading = true,
  busy = false,
  err = "",
  mode = "";
let session;
try {
  session = sessionStorage.getItem("velosf-session") || "";
} catch {
  session = "";
}
const staff = (r) => D.actor?.role === r,
  st = (id) => D.stations.find((x) => x.id == id),
  sn = (id) => st(id)?.name || "Hors station",
  bn = (id) => D.bikes?.find((b) => b.id == id)?.serial || "Vélo " + id;
const fields = (f) => Object.fromEntries(f),
  options = (label, n, list, sel) =>
    `<label class="field">${label}<select name="${n}" required>${list.map(([id, t]) => `<option value="${esc(id)}" ${String(sel) == String(id) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`,
  stationsOpt = (label, n, sel) =>
    options(
      label,
      n,
      D.stations.map((s) => [s.id, s.name]),
      sel,
    ),
  btn = (text, fn) => act(text, fn, "tiny"),
  none = (t) => `<div class="empty">${esc(t)}</div>`,
  timeFmt = (t) =>
    t
      ? new Date(t.replace(" ", "T") + "Z").toLocaleString("fr-TN", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "–",
  table = (heads, rs) =>
    `<div class="scroll"><table class="ledger"><thead><tr>${heads.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rs.map((row) => `<tr>${row.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
  measure = (n) => `<b>${n}</b>`;
function keep(t) {
  session = t;
  try {
    t
      ? sessionStorage.setItem("velosf-session", t)
      : sessionStorage.removeItem("velosf-session");
  } catch {}
}
async function api(path, data) {
  let res = await fetch("/api/" + path, {
    method: data ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session,
    },
    body: data ? JSON.stringify(data) : undefined,
    cache: "no-store",
  });
  let j = await res.json();
  if (!res.ok) throw Error(j.error || "Requête refusée.");
  return j;
}
async function refresh() {
  D = await api("state");
  if (!D.actor && session) keep("");
  loading = false;
  render();
}
async function send(path, data, message, dest) {
  if (busy) return;
  busy = true;
  try {
    let r = await api(path, data);
    if (r.token) keep(r.token);
    if (path === "logout") {
      keep("");
      cardScanned = false;
    }
    err = "";
    closeDlg();
    await refresh();
    if (dest) go(dest);
    if (message) toast(message);
  } catch (e) {
    toast(e.message);
    try {
      await refresh();
    } catch {}
  } finally {
    busy = false;
  }
}
const destRole = {
  stations: "responsable",
  parc: "responsable",
  achat: "responsable",
  fournisseurs: "responsable",
  reclamations: "responsable",
  missions: "responsable",
  itineraires: "responsable",
  controle: "technicien",
  tournee: "technicien",
  auth: "abonne",
  choisir: "abonne",
  occasion: "occasionnel",
};
function gate(role) {
  let ri = ["responsable", "technicien", "abonne", "occasionnel"].indexOf(role);
  if (D.actor)
    return (
      banner(ri, "Changer d’espace") +
      `<div class="panel narrow"><h2>Une autre session est ouverte</h2><p>Tu es connecté en tant que <b>${esc(D.actor.name)}</b>. Déconnecte-toi pour accéder à l’espace ${roles[ri][0]}.</p>${act("Se déconnecter", "send('logout',{},'Session fermée')")}</div>`
    );
  if (role === "occasionnel") return guest();
  if (role === "abonne")
    return (
      banner(2, "S’authentifier") +
      `<div class="panel narrow"><h2>Carte d’adhésion</h2><p class="muted">Présente ta carte au lecteur optique, puis compose ton code secret.</p>${act(ic("card") + (cardScanned ? " Carte SF-1001 lue ✓" : " Simuler la lecture optique"), "cardScanned=true;render()", "btn light")}${form("authMember", field("Code secret", "secret", "", "password", 'inputmode="numeric" maxlength="4" autocomplete="off"'), "Valider la carte")}<p class="soft">Lecteur simulé · carte de démonstration SF-1001 · code <b>1234</b>.</p></div>`
    );
  return (
    banner(ri, "Connexion " + roles[ri][0]) +
    `<div class="panel narrow"><h2>Accès professionnel</h2><p class="muted">Le serveur vérifie ton compte et les droits associés à ton rôle.</p>${form("staffLogin", field("Identifiant", "login", role) + field("Mot de passe", "secret", "", "password", 'autocomplete="current-password"'), "Se connecter")}<p class="soft">Compte de démonstration : <b>${role}</b><br>Mot de passe : <b>${ri ? "Atelier2026!" : "Flotte2026!"}</b></p></div>`
  );
}
function staffLogin(f) {
  send("login", fields(f), "Connexion réussie");
}
function authMember(f) {
  if (!cardScanned) return toast("Présente ta carte au lecteur simulé.");
  send(
    "login",
    { login: "SF-1001", secret: f.get("secret") },
    "Carte validée",
    "choisir",
  );
}
function station(s, i, edit) {
  let r = s.count / s.cap,
    c = r >= 0.85 ? "#ba7631" : r <= 0.25 ? "#ba5452" : "#23876e";
  return `<article class="station"><div class="stationtop"><i>${ic("pin")}</i><div><small class="overline">Station ${String(s.id).padStart(2, "0")}</small><br><strong>${esc(s.name)}</strong></div></div><p class="muted" style="margin:12px 0">${esc(s.address)}</p><div class="bar"><span style="width:${100 * r}%;background:${c}"></span></div><div class="spread" style="margin:12px 0"><small>${s.available} vélo(s) disponible(s)</small><span class="status" style="color:${c}">${s.count}/${s.cap} places</span></div>${edit ? btn("Modifier", `stationDlg(${s.id})`) : ""}</article>`;
}
function stations(publicOnly = false) {
  return (
    banner(
      0,
      publicOnly ? "Le réseau de stations" : "Stations de la région de Sfax",
    ) +
    hsection(
      "Le réseau",
      D.stations.length + " stations · comptage calculé à partir du parc.",
      publicOnly ? "" : act("+ Ajouter une station", "stationDlg(0)"),
    ) +
    `<div class="grid">${D.stations.map((s) => station(s, 0, !publicOnly)).join("")}</div>`
  );
}
let editId = 0;
function stationDlg(id) {
  editId = id;
  let s = st(id) || {};
  dlg(
    id ? "Modifier la station" : "Nouvelle station",
    form(
      "saveStation",
      field("Nom", "name", s.name) +
        field("Adresse", "address", s.address) +
        field("Capacité", "cap", s.cap || 10, "number", 'min="1" max="500"'),
      "Enregistrer",
    ),
  );
}
function saveStation(f) {
  send("stations", { ...fields(f), id: editId }, "Station enregistrée");
}
function parc() {
  let bs = D.bikes.filter((b) => filter === "Tous" || b.status === filter);
  return (
    banner(0, "Parc de vélos") +
    `<div class="spread wraprow" style="flex-wrap:wrap"><div class="toolbar">${["Tous", ...new Set(D.bikes.map((b) => b.status))].map((t) => act(t, `filter='${t}';render()`, "chip " + (filter === t ? "sel" : ""))).join("")}</div>${href("+ Ajouter un vélo", "achat")}</div><div class="grid">${bs.map((b) => `<button class="panel" style="text-align:left" onclick="bikeInfo(${b.id})">${art(b)}<h3>${esc(b.serial)}</h3><span class="status">${esc(b.status)}</span><p class="meta">${esc(sn(b.station))} · ${esc(b.type)}</p></button>`).join("")}</div>`
  );
}
function bikeInfo(id) {
  let b = D.bikes.find((i) => i.id === id);
  dlg(
    esc(b.serial),
    `<br>${art(b)}<p>${esc(b.type)} · ${esc(b.status)}</p><div class="line">Station<b>${esc(sn(b.station))}</b></div><div class="line">Fournisseur<b>${esc(D.suppliers.find((i) => i.id === b.supplier)?.name)}</b></div>${["Disponible", "En panne", "En réparation"].includes(b.status) ? `<br>${btn("Retirer du parc", `retireBike(${id})`)}` : ""}`,
  );
}
function retireBike(id) {
  editId = id;
  dlg(
    "Retirer le vélo du parc",
    form(
      "saveRetire",
      field("Motif : amortissement, accident…", "reason"),
      "Confirmer le retrait",
    ),
  );
}
function saveRetire(f) {
  send(`bikes/${editId}/retire`, fields(f), "Vélo retiré du parc");
}
function achat() {
  return (
    banner(0, "Acheter un vélo") +
    `<div class="split"><div class="panel"><h2>Acquisition</h2>${form(
      "saveBike",
      field("Numéro de série unique", "serial") +
        options(
          "Type",
          "type",
          ["Ville", "VTT", "Électrique", "Pliant"].map((s) => [s, s]),
        ) +
        field(
          "Couleur",
          "color",
          "#e86958",
          "color",
          "oninput=\"document.querySelector('#sample').innerHTML=art({color:this.value})\"",
        ) +
        options(
          "Fournisseur",
          "supplier",
          D.suppliers.map((s) => [s.id, s.name]),
        ) +
        stationsOpt("Station d’affectation", "station"),
      "Enregistrer le vélo",
    )}</div><div class="panel"><h2>Aperçu</h2><div id="sample">${art({ color: "#e86958" })}</div><p>${href("Enregistrer un nouveau fournisseur →", "fournisseurs", "link")}</p></div></div>`
  );
}
function saveBike(f) {
  filter = "Tous";
  send("bikes", fields(f), "Vélo acquis et affecté", "parc");
}
function fournisseurs() {
  return (
    banner(0, "Fournisseurs") +
    `<div class="split"><div class="panel"><h2>Mes fournisseurs</h2>${D.suppliers.map((s) => `<div class="line"><b>${esc(s.name)}</b>${esc(s.contact)}</div>`).join("")}</div><div class="panel"><h2>Nouveau fournisseur</h2>${form("saveSupplier", field("Nom", "name") + field("Contact ou adresse", "contact"), "Enregistrer")}</div></div>`
  );
}
function saveSupplier(f) {
  send("suppliers", fields(f), "Fournisseur enregistré");
}
function controle() {
  let bs = D.bikes.filter(
    (b) => b.station && ["Disponible", "En panne"].includes(b.status),
  );
  return (
    banner(1, "Contrôle journalier") +
    `<div class="split"><div class="panel"><h2>Enregistrer un contrôle</h2>${form(
      "saveCheck",
      options(
        "Vélo à contrôler",
        "bike",
        bs.map((b) => [b.id, b.serial + " · " + sn(b.station)]),
      ) +
        options("Résultat", "condition", [
          ["ok", "Bon état"],
          ["bad", "En panne · déclencher une réclamation"],
        ]) +
        field("Diagnostic", "diagnosis", "", "text", 'maxlength="500"'),
      "Valider le contrôle",
    )}</div><div class="panel"><h2>Derniers contrôles</h2>${
      D.checks
        .slice(0, 12)
        .map(
          (c) =>
            `<div class="line"><div><b>${esc(bn(c.bike))}</b> · ${esc(c.diagnosis)}<div class="meta">${esc(c.tech_name)} · ${timeFmt(c.created)}</div></div></div>`,
        )
        .join("") || none("Aucun contrôle enregistré.")
    }</div></div>`
  );
}
function saveCheck(f) {
  send("checks", fields(f), "Contrôle enregistré");
}
function claims() {
  return (
    banner(0, "Réclamations et réparations") +
    `<div class="panel"><h2>Suivi des signalements</h2>${D.claims.map((c) => `<div class="line"><div><b>${esc(bn(c.bike))}</b> · ${esc(c.diagnosis)}<div class="meta">${esc(c.author)} · ${timeFmt(c.created)}</div><span class="status">${esc(c.status)}</span>${planInfo(c.id)}</div><div class="controls">${c.status === "À traiter" ? btn("Planifier la réparation", `planRepair(${c.id})`) : ""}${c.status === "Réparation planifiée" ? btn("Terminer la réparation", `repair(${c.id})`) : ""}${["À traiter", "Réparation planifiée"].includes(c.status) ? btn("Retirer du parc", `retire(${c.id})`) : ""}</div></div>`).join("") || none("Aucune réclamation.")}</div>`
  );
}
function decision(i, k, f = {}) {
  send("claims/" + i, { decision: k, ...f }, "Réclamation mise à jour");
}
function retire(i) {
  dlg(
    "Retirer ce vélo ?",
    `<p>Le vélo ne pourra plus être loué. Sa fiche restera dans le parc.</p>${act("Confirmer le retrait", `decision(${i},'retire')`)}`,
  );
}
function planInfo(i) {
  let p = D.plans.find((x) => x.claim === i);
  return p
    ? `<div class="meta">Intervention : ${esc(p.scheduled)} · ${esc(p.work)}</div>`
    : "";
}
function planRepair(i) {
  editId = i;
  dlg(
    "Planifier la réparation",
    form(
      "savePlan",
      field(
        "Date prévue",
        "scheduled",
        new Date().toLocaleDateString("sv-SE"),
        "date",
      ) + field("Travaux à effectuer", "work"),
      "Enregistrer le planning",
    ),
  );
}
function savePlan(f) {
  decision(editId, "plan", fields(f));
}
function repair(i) {
  editId = i;
  dlg(
    "Terminer la réparation",
    form(
      "doneRepair",
      `<p>Si le vélo est à l’entrepôt, choisis sa station de remise en service. Sinon il reste à sa station.</p>${stationsOpt("Station (vélo à l’entrepôt)", "station")}`,
      "Remettre en service",
    ),
  );
}
function doneRepair(f) {
  decision(editId, "fixed", fields(f));
}
const labels = [
  "Retirer le camion à l’entrepôt",
  "Charger les vélos à la station de départ",
  "Déposer les vélos à destination",
  "Collecter les vélos en panne",
  "Rentrer à l’entrepôt",
];
function missionCards(tech) {
  return (
    D.missions
      .map(
        (m) =>
          `<div class="panel mission"><div class="spread"><h2>Mission ${String(m.id).padStart(3, "0")}</h2><span class="tag">${m.step === 5 ? "Terminée" : m.step ? "En cours" : "À démarrer"}</span></div><p><b>${esc(sn(m.origin))} → ${esc(sn(m.dest))}</b> · ${m.qty} vélo(s)</p><p class="meta">${esc(m.technician)} · ${esc(m.vehicle)} · ${timeFmt(m.created)}</p><div class="soft">${esc(m.instructions)}</div>${tech ? `<div style="margin:14px 0">${labels.map((l, i) => `<div class="stop"><b>${m.step > i ? "✓" : i + 1}</b> ${l}</div>`).join("")}</div>${m.step < 5 ? act(labels[m.step], `nextStep(${m.id})`) : ""}` : m.step === 0 ? `<div class="controls">${btn("Éditer l’itinéraire", `editRoute(${m.id})`)}</div>` : ""}</div>`,
      )
      .join("") ||
    none(
      tech
        ? "Aucune mission attribuée à ton compte. Le responsable doit préparer un ordre de mission."
        : "Aucun itinéraire préparé. Crée un ordre de mission dans « Missions ».",
    )
  );
}
function missions() {
  let sorted = [...D.stations].sort(
    (a, b) => b.count / b.cap - a.count / a.cap,
  );
  return (
    banner(0, "Missions de répartition") +
    `<div class="split"><div class="panel"><h2>Mouvements de location</h2><p class="muted">Départs et retours enregistrés depuis l’ouverture du réseau.</p>${table(
      ["Station", "Départs", "Retours", "Places occupées"],
      D.movements.map((m) => [
        esc(m.name),
        m.departures,
        m.returns,
        `${st(m.id).count}/${st(m.id).cap}`,
      ]),
    )}</div><div class="panel"><h2>Ordre de mission</h2>${form(
      "assign",
      stationsOpt("Station de départ", "origin", sorted[0].id) +
        stationsOpt("Station de destination", "dest", sorted.at(-1).id) +
        field("Nombre de vélos", "qty", 1, "number", 'min="1"') +
        options(
          "Technicien",
          "tech",
          D.technicians.map((a) => [a.id, a.name]),
        ) +
        options(
          "Camion",
          "truck",
          D.trucks.map((a) => [a.id, `${a.name} · ${a.capacity} vélos`]),
        ) +
        field(
          "Itinéraire et consignes",
          "instructions",
          "Entrepôt → départ → destination → entrepôt",
        ),
      "Attribuer la mission",
    )}</div></div>` +
    hsection("Ordres de mission") +
    missionCards(false)
  );
}
function assign(f) {
  send("missions", fields(f), "Mission attribuée au technicien");
}
function itinerary(tech) {
  return (
    banner(
      tech ? 1 : 0,
      tech ? "Ma tournée de répartition" : "Camions et itinéraires",
    ) +
    `<div class="split"><div>${missionCards(tech)}</div><div><div class="panel"><h2>Schéma de tournée</h2>${routeMap()}<p class="meta">Schéma indicatif · les consignes de chaque mission précisent le parcours à suivre.</p></div></div></div>`
  );
}
function editRoute(id) {
  editId = id;
  dlg(
    "Éditer l’itinéraire",
    form(
      "saveRoute",
      field(
        "Parcours et consignes",
        "instructions",
        D.missions.find((m) => m.id === id).instructions,
      ),
      "Enregistrer",
    ),
  );
}
function saveRoute(f) {
  send(`missions/${editId}/route`, fields(f), "Itinéraire enregistré");
}
function nextStep(id) {
  let m = D.missions.find((x) => x.id === id);
  if (m.step !== 3)
    return send(`missions/${id}/advance`, { step: m.step }, "Étape validée");
  editId = id;
  let bs = D.bikes.filter(
    (b) =>
      [m.origin, m.dest].includes(b.station) &&
      ["En panne", "En réparation"].includes(b.status),
  );
  dlg(
    "Collecte des vélos en panne",
    form(
      "collect",
      `<p class="muted">Coche les vélos à ramener à l’entrepôt.</p><div class="picklist">${bs.map((b) => `<label><input type="checkbox" value="${b.id}" name="collect"> ${esc(b.serial)} · ${esc(sn(b.station))}</label>`).join("") || none("Aucun vélo en panne sur le parcours.")}</div>`,
      "Valider la collecte",
    ),
  );
}
function collect(f) {
  send(
    `missions/${editId}/advance`,
    { step: 3, collect: f.getAll("collect") },
    "Collecte validée",
  );
}
function guest() {
  let card = D.cards?.[0];
  if (staff("occasionnel") && card && card.status !== "Restituée")
    return rentalSpace(true);
  let last = staff("occasionnel") && card?.status === "Restituée";
  return (
    banner(3, last ? "Retour confirmé" : "Louer sans abonnement") +
    `<div class="split"><div class="panel"><h2>Carte courte durée</h2>${last ? `<p class="notice">Vélo et carte ${esc(card.code)} restitués. Garantie de ${card.deposit} DT remboursée (simulation).</p>` : ""}<p class="muted">Utilise une identité fictive pour cette démonstration. Aucun paiement bancaire n’est effectué.</p>${form("issue", field("Identité", "identity", D.actor?.name || "") + stationsOpt("Station de destination", "dest", 4) + field("Durée en heures", "hours", 1, "number", 'min="1" max="24" oninput="document.getElementById(\'fee\').textContent=this.value*2"') + '<div class="line">Frais d’exploitation (2 DT / h)<b><span id="fee">2</span> DT</b></div><div class="line">Garantie remboursable<b>30 DT</b></div><br>', "Simuler le paiement et obtenir la carte")}</div><div class="panel"><h2>Déjà une carte ?</h2><p class="muted">Retrouve ta location après une déconnexion avec le code de ta carte.</p>${form("resumeCard", field("Code de carte courte durée", "code") + field("Identité utilisée à l’émission", "identity"), "Retrouver ma location")}</div></div>`
  );
}
function issue(f) {
  send(
    "cards",
    { ...fields(f), payment: "simulation" },
    "Carte émise. Choisis maintenant ton vélo.",
  );
}
function resumeCard(f) {
  send("cards/resume", fields(f), "Carte retrouvée");
}
function rentalSpace(guest = false) {
  let idx = guest ? 3 : 2,
    active = D.rentals.find((r) => !r.ended),
    card = guest ? D.cards[0] : null,
    title = active ? "Restituer le vélo" : "Choisir un vélo";
  let cardInfo = guest
    ? `<div class="soft" style="margin-bottom:16px"><b>Carte courte durée · ${esc(card.code)}</b><br>${card.hours} h · destination : ${esc(sn(card.dest))} · frais : ${card.fee} DT · garantie : ${card.deposit} DT. Conserve le code pour retrouver ta location.</div>`
    : "";
  if (active) {
    let b = D.bikes.find((i) => i.id === active.bike);
    return (
      banner(idx, title) +
      `<div class="panel narrow">${cardInfo}<h2>${esc(b.serial)}</h2>${art(b)}<p class="meta">Départ : ${esc(sn(active.origin))} · ${timeFmt(active.started)}</p>${form(
        "giveBack",
        stationsOpt(
          "Station de retour",
          "station",
          card?.dest || active.origin,
        ) +
          options("État du vélo", "condition", [
            ["ok", "Bon état"],
            ["bad", "En panne"],
          ]) +
          `<label class="field">Diagnostic si en panne<input name="diagnosis" maxlength="500" placeholder="Ex. : frein arrière défectueux"></label>` +
          (guest
            ? `<label class="field"><input style="display:inline;width:auto" type="checkbox" required name="returned"> Je remets aussi ma carte courte durée.</label>`
            : " (le vélo en panne peut être rendu dès le départ).<br><br>"),
        "Confirmer la restitution",
      )}</div>`
    );
  }
  if (!st(selectedStation)) selectedStation = D.stations[0].id;
  let bs = D.bikes.filter(
    (b) => b.status === "Disponible" && b.station == selectedStation,
  );
  return (
    banner(idx, title) +
    cardInfo +
    `<div class="panel"><h2>Station de départ</h2>${stationsOpt("Choisis la station où tu te trouves", "origin", selectedStation).replace("<select", '<select onchange="selectedStation=+this.value;render()"')}</div>` +
    hsection("Vélos disponibles", esc(sn(selectedStation))) +
    (bs.length
      ? `<div class="grid">${bs.map((b) => `<div class="panel">${art(b)}<h3>${esc(b.serial)}</h3><p class="muted">${esc(b.type)}</p>${act("Choisir ce vélo", `send('rentals',{bike:${b.id}},'Location démarrée')`)}</div>`).join("")}</div>`
      : none("Aucun vélo disponible ici. Choisis une autre station.")) +
    (D.rentals.length
      ? hsection("Mes trajets") +
        `<div class="panel">${table(
          ["Vélo", "Départ", "Arrivée", "Retour"],
          D.rentals.map((r) => [
            esc(r.serial),
            esc(sn(r.origin)),
            esc(sn(r.dest)),
            timeFmt(r.ended),
          ]),
        )}</div>`
      : "")
  );
}
function giveBack(f) {
  send(
    "returns",
    { ...fields(f), card: staff("occasionnel") ? D.cards[0].code : null },
    "Restitution enregistrée",
  );
}
const pages = {
  accueil: home,
  stations,
  reseau: () => stations(true),
  parc,
  achat,
  fournisseurs,
  reclamations: claims,
  missions,
  itineraires: () => itinerary(false),
  controle,
  tournee: () => itinerary(true),
  auth: () => rentalSpace(false),
  choisir: () => rentalSpace(false),
  occasion: guest,
  louer,
};
function render() {
  page = location.hash.slice(1) || "accueil";
  if (!Object.hasOwn(pages, page)) page = "accueil";
  let sub =
    nav.flat().find((n) => n[0] === page)?.[1] ||
    { reseau: "Stations", louer: "Louer un vélo" }[page] ||
    "Accueil";
  $("#side").innerHTML =
    `<a class="brand" href="#accueil">${logo}<span>Vélo<b>Sf</b></span></a><nav class="sidetop">${navrow(["accueil", "Accueil", "home"])}${nav.map((group, i) => `<div class="group" style="${theme(roles[i])}"><i class="dot"></i>${roles[i][0]}</div>${group.map(navrow).join("")}`).join("")}</nav><div class="base"><i class="online"></i><div>Réseau VéloSf<small>Mobilité partagée à Sfax</small></div></div>`;
  $("#head").innerHTML =
    `<div class="crumb"><button class="mobile" aria-label="Menu" onclick="document.body.classList.toggle('navopen')">${ic("menu")}</button>${ic("grid")} Plateforme › <b>${sub}</b></div><div class="session">${D.actor ? `<b>${esc(D.actor.name)}</b>${btn("Déconnexion", "send('logout',{},'Session fermée','accueil')")}` : ""}<span class="place">${ic("pin")} Sfax, Tunisie <span class="flag">☪</span></span></div>`;
  let role = destRole[page];
  $("#app").innerHTML =
    (loading
      ? none(err || "Connexion au serveur VéloSf…")
      : role && !staff(role)
        ? gate(role)
        : pages[page]()) +
    `<footer class="footer spread"><span>VéloSf · Cyclosfaxcity</span><span>Projet d’étude · Sfax</span></footer>`;
  document.title = sub + " · VéloSf";
}
window.addEventListener("hashchange", () => {
  document.body.classList.remove("navopen");
  closeDlg();
  render();
  scrollTo(0, 0);
  refresh().catch((e) => toast(e.message));
});
document.addEventListener("click", (e) => {
  if (e.target.closest(".navbtn,.brand"))
    document.body.classList.remove("navopen");
});
window.addEventListener("focus", () => {
  if (!busy && !$("#modal").innerHTML && !document.querySelector("form"))
    refresh().catch(() => {});
});
render();
refresh().catch(() => {
  err =
    "Impossible de joindre l’API. Démarre le serveur VéloSf, puis recharge la page.";
  render();
});
