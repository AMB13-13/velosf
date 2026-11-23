"""API VéloSf — dates UTC, montants de démonstration en dinars tunisiens."""

import os, sqlite3, secrets, hashlib, time, re
from pathlib import Path
from functools import wraps
from datetime import date
from flask import Flask, request, jsonify, g, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

ROOT = Path(__file__).resolve().parent
WEB = ROOT.parent / "frontend"
app = Flask(__name__, static_folder=None)
app.config.update(
    DATABASE=os.environ.get("VELOSF_DB", str(ROOT.parent / "data" / "velosf.sqlite3")),
    MAX_CONTENT_LENGTH=16384,
)


def db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"], timeout=10, isolation_level=None)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


def q(sql, *args):
    return db().execute(sql, args)


def rows(sql, *args):
    return [dict(r) for r in q(sql, *args)]


def one(sql, *args):
    return q(sql, *args).fetchone()


def insert(sql, *args):
    return q(sql, *args).lastrowid


class Problem(Exception):
    def __init__(self, msg, code=400):
        self.msg, self.code = msg, code


def need(cond, msg, code=400):
    if not cond:
        raise Problem(msg, code)


@app.errorhandler(Problem)
def invalid(e):
    return jsonify(error=e.msg), e.code


@app.errorhandler(sqlite3.IntegrityError)
def conflict(e):
    return jsonify(
        error="Référence déjà utilisée ou opération incompatible avec les données."
    ), 409


@app.teardown_appcontext
def close(_):
    if "db" in g:
        g.db.close()


def initialize():
    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)
    with app.app_context():
        db().executescript((ROOT / "schema.sql").read_text())
        q("BEGIN IMMEDIATE")
        if not one("SELECT id FROM users LIMIT 1"):
            for l, p, r, n in [
                ("responsable", "Flotte2026!", "responsable", "Amel · Responsable"),
                ("technicien", "Atelier2026!", "technicien", "Sami · Technicien"),
                ("tech2", "Atelier2026!", "technicien", "Inès · Technicienne"),
                ("SF-1001", "1234", "abonne", "Abonné SF-1001"),
            ]:
                q(
                    "INSERT INTO users(login,secret,role,name) VALUES (?,?,?,?)",
                    l,
                    generate_password_hash(p),
                    r,
                    n,
                )
            for name, addr, cap in [
                ("Médina", "Place Bab Diwan", 8),
                ("Bab Bhar", "Avenue Habib Bourguiba", 6),
                ("Sfax El Jadida", "Avenue des Martyrs", 8),
                ("Route de Gremda", "Route de Gremda, km 2", 8),
                ("Cité El Habib", "Rue de la Liberté", 6),
                ("Sakiet Ezzit", "Avenue de la République", 8),
            ]:
                q(
                    "INSERT INTO stations(name,address,cap) VALUES(?,?,?)",
                    name,
                    addr,
                    cap,
                )
            q(
                "INSERT INTO suppliers(name,contact) VALUES('Cycles de Sfax','Atelier du centre-ville'),('Roues du Sud','Route de Tunis')"
            )
            for i, s in enumerate(
                [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 5, 5, 6, 6, 6]
            ):
                q(
                    "INSERT INTO bikes(serial,type,color,supplier,station,status) VALUES(?,?,?,?,?,?)",
                    f"SF-{i + 1:04}",
                    ("Ville", "VTT", "Électrique")[i % 3],
                    ("#e86958", "#1ba4b3", "#e4ad32", "#8e78cd", "#3ca583")[i % 5],
                    i % 2 + 1,
                    s,
                    "En panne" if i == 2 else "Disponible",
                )
            q(
                "INSERT INTO checks(bike,tech,diagnosis) VALUES(3,2,'Roue arrière voilée')"
            )
            q(
                "INSERT INTO claims(bike,inspection,diagnosis,status) VALUES(3,1,'Roue arrière voilée','À traiter')"
            )
            q("INSERT INTO trucks(name,capacity) VALUES('Camion 01',6),('Camion 02',4)")
        db().commit()


def body():
    d = request.get_json(silent=True)
    need(isinstance(d, dict), "Objet JSON attendu.")
    return d


def txt(d, k, limit=180):
    s = d.get(k)
    need(isinstance(s, str) and 0 < len(s.strip()) <= limit, "Champ invalide : " + k)
    return s.strip()


def num(d, k, lo=1, hi=1000000):
    s = str(d.get(k, ""))
    need(
        bool(re.fullmatch(r"[0-9]{1,8}", s)) and lo <= int(s) <= hi,
        "Valeur invalide : " + k,
    )
    return int(s)


def digest(t):
    return hashlib.sha256(t.encode()).hexdigest()


def me():
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    return one(
        "SELECT u.id,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.digest=? AND expires>?",
        digest(token),
        int(time.time()),
    )


def token(uid):
    t = secrets.token_urlsafe(32)
    q("DELETE FROM sessions WHERE expires<=?", int(time.time()))
    q("INSERT INTO sessions VALUES(?,?,?)", digest(t), uid, int(time.time()) + 86400)
    return t


def action(*roles):
    def deco(fn):
        @wraps(fn)
        def wrapped(**kw):
            q("BEGIN IMMEDIATE")
            g.actor = me()
            if roles:
                need(g.actor, "Connexion nécessaire.", 401)
                need(
                    g.actor["role"] in roles, "Action réservée à un autre acteur.", 403
                )
            result = fn(body(), **kw)
            db().commit()
            return jsonify(result or {"ok": True})

        return wrapped

    return deco


def station(s):
    row = one(
        "SELECT *, (SELECT count(*) FROM bikes WHERE station=stations.id) AS occupied FROM stations WHERE id=?",
        s,
    )
    need(row, "Station introuvable.", 404)
    return row


def room(s, qty=1):
    st = station(s)
    need(
        st["occupied"] + qty <= st["cap"],
        "Pas assez de places libres à cette station.",
        409,
    )


def bike(b):
    r = one("SELECT * FROM bikes WHERE id=?", b)
    need(r, "Vélo introuvable.", 404)
    return r


@app.post("/api/login")
@action()
def login(d):
    r = one("SELECT * FROM users WHERE login=?", txt(d, "login"))
    p = txt(d, "secret")
    need(
        r and r["secret"] and check_password_hash(r["secret"], p),
        "Carte, identifiant ou code incorrect.",
        401,
    )
    return {"token": token(r["id"])}


@app.post("/api/logout")
@action()
def logout(d):
    q(
        "DELETE FROM sessions WHERE digest=?",
        digest(request.headers.get("Authorization", "").removeprefix("Bearer ")),
    )


@app.get("/api/state")
def state():
    q("BEGIN")
    u = me()
    role = u["role"] if u else ""
    a = {
        "actor": dict(u) if u else None,
        "stations": rows(
            "SELECT s.*,count(b.id) AS count, sum(CASE WHEN b.status='Disponible' THEN 1 ELSE 0 END) available FROM stations s LEFT JOIN bikes b ON b.station=s.id GROUP BY s.id ORDER BY s.id"
        ),
    }
    if not u:
        return jsonify(a)
    staff = role in ("responsable", "technicien")
    a["bikes"] = (
        rows("SELECT * FROM bikes ORDER BY id")
        if staff
        else rows(
            "SELECT id,serial,type,color,station,status FROM bikes WHERE status='Disponible' OR id IN (SELECT bike FROM rentals WHERE owner=? AND ended IS NULL) ORDER BY id",
            u["id"],
        )
    )
    if staff:
        a["checks"] = rows(
            "SELECT c.*,u.name tech_name FROM checks c JOIN users u ON u.id=c.tech ORDER BY c.id DESC LIMIT 100"
        )
        a["claims"] = rows(
            "SELECT c.*,coalesce(u.name,'Signalement au retour') author FROM claims c LEFT JOIN checks k ON k.id=c.inspection LEFT JOIN users u ON u.id=k.tech ORDER BY c.id DESC"
        )
        a["plans"] = rows("SELECT * FROM repair_plans")
        a["trucks"] = rows("SELECT * FROM trucks")
        a["missions"] = rows(
            "SELECT m.*,u.name technician,t.name vehicle FROM missions m JOIN users u ON u.id=m.tech JOIN trucks t ON t.id=m.truck "
            + ("WHERE m.tech=? " if role == "technicien" else "")
            + "ORDER BY m.id DESC",
            *([u["id"]] if role == "technicien" else []),
        )
    if role == "responsable":
        a["suppliers"] = rows("SELECT * FROM suppliers")
        a["technicians"] = rows("SELECT id,name FROM users WHERE role='technicien'")
        a["movements"] = rows(
            "SELECT s.id,s.name,(SELECT count(*) FROM rentals r WHERE r.origin=s.id) departures,(SELECT count(*) FROM rentals r WHERE r.dest=s.id AND r.ended IS NOT NULL) returns FROM stations s ORDER BY s.id"
        )
    if not staff:
        a["rentals"] = rows(
            "SELECT r.*,b.serial FROM rentals r JOIN bikes b ON b.id=r.bike WHERE r.owner=? ORDER BY r.id DESC",
            u["id"],
        )
        a["cards"] = rows("SELECT * FROM cards WHERE owner=? ORDER BY id DESC", u["id"])
    return jsonify(a)


@app.post("/api/stations")
@action("responsable")
def write_station(d):
    name, addr, cap = txt(d, "name"), txt(d, "address"), num(d, "cap", 1, 500)
    if d.get("id"):
        i = num(d, "id")
        need(station(i)["occupied"] <= cap, "Capacité inférieure au stock.")
        q("UPDATE stations SET name=?,address=?,cap=? WHERE id=?", name, addr, cap, i)
    else:
        q("INSERT INTO stations(name,address,cap) VALUES(?,?,?)", name, addr, cap)


@app.post("/api/suppliers")
@action("responsable")
def supplier(d):
    q(
        "INSERT INTO suppliers(name,contact) VALUES(?,?)",
        txt(d, "name"),
        txt(d, "contact"),
    )


@app.post("/api/bikes")
@action("responsable")
def add_bike(d):
    st = num(d, "station")
    room(st)
    col = txt(d, "color")
    need(re.fullmatch("#[0-9a-fA-F]{6}", col), "Couleur invalide.")
    q(
        "INSERT INTO bikes(serial,type,color,supplier,station,status) VALUES(?,?,?,?,?,?)",
        txt(d, "serial"),
        txt(d, "type"),
        col,
        num(d, "supplier"),
        st,
        "Disponible",
    )


@app.post("/api/bikes/<int:i>/retire")
@action("responsable")
def retire_bike(d, i):
    b = bike(i)
    need(
        b["status"] in ("Disponible", "En panne", "En réparation"),
        "Vélo en service ou déjà retiré.",
        409,
    )
    q(
        "INSERT INTO retirements(bike,reason,manager) VALUES(?,?,?)",
        i,
        txt(d, "reason"),
        g.actor["id"],
    )
    q("UPDATE bikes SET status='Hors service',station=NULL WHERE id=?", i)
    q(
        "UPDATE claims SET status='Retiré du parc' WHERE bike=? AND status IN ('À traiter','Réparation planifiée')",
        i,
    )


@app.post("/api/checks")
@action("technicien")
def check(d):
    b = bike(num(d, "bike"))
    need(
        b["station"] is not None and b["status"] in ("Disponible", "En panne"),
        "Impossible de contrôler ce vélo ici.",
        409,
    )
    diag = txt(d, "diagnosis", 500)
    bad = d.get("condition")
    need(bad in ("ok", "bad"), "État inconnu.")
    need(
        bad == "bad" or b["status"] == "Disponible",
        "Une panne ouverte nécessite une réparation.",
    )
    i = insert(
        "INSERT INTO checks(bike,tech,diagnosis) VALUES(?,?,?)",
        b["id"],
        g.actor["id"],
        diag,
    )
    if bad == "bad":
        c = one(
            "SELECT id,inspection FROM claims WHERE bike=? AND status='À traiter'",
            b["id"],
        )
        need(
            not c or not c["inspection"],
            "Une réclamation technique est déjà ouverte.",
            409,
        )
        if c:
            q("UPDATE claims SET inspection=?,diagnosis=? WHERE id=?", i, diag, c["id"])
        else:
            q(
                "INSERT INTO claims(bike,inspection,diagnosis,status) VALUES(?,?,?,'À traiter')",
                b["id"],
                i,
                diag,
            )
        q("UPDATE bikes SET status='En panne' WHERE id=?", b["id"])


@app.post("/api/claims/<int:i>")
@action("responsable")
def claim(d, i):
    c = one("SELECT * FROM claims WHERE id=?", i)
    need(c, "Réclamation inconnue.", 404)
    op = txt(d, "decision")
    b = bike(c["bike"])
    need(b["status"] != "En collecte", "Vélo en transit.", 409)
    if op == "plan" and c["status"] == "À traiter":
        when = txt(d, "scheduled", 10)
        try:
            date.fromisoformat(when)
        except ValueError:
            raise Problem("Date de réparation invalide.")
        q("INSERT INTO repair_plans VALUES(?,?,?)", i, when, txt(d, "work", 500))
        cs, bs = "Réparation planifiée", "En réparation"
    elif op == "retire" and c["status"] in ("À traiter", "Réparation planifiée"):
        cs, bs = "Retiré du parc", "Hors service"
    elif op == "fixed" and c["status"] == "Réparation planifiée":
        cs, bs = "Réparé", "Disponible"
    else:
        raise Problem("Transition non autorisée.", 409)
    st = b["station"]
    if op == "fixed" and not st:
        st = num(d, "station")
        room(st)
    q(
        "UPDATE bikes SET status=?,station=? WHERE id=?",
        bs,
        None if op == "retire" else st,
        b["id"],
    )
    q("UPDATE claims SET status=? WHERE id=?", cs, i)


@app.post("/api/cards")
@action()
def issue_card(d):
    need(
        not g.actor or g.actor["role"] == "occasionnel",
        "Déconnectez-vous du compte actuel.",
        403,
    )
    identity = txt(d, "identity", 100)
    need(
        not g.actor or g.actor["name"] == identity,
        "Déconnectez-vous pour changer d’identité.",
    )
    s = num(d, "dest")
    station(s)
    hours = num(d, "hours", 1, 24)
    need(d.get("payment") == "simulation", "Confirmez le paiement simulé.")
    uid = (
        g.actor["id"]
        if g.actor
        else insert("INSERT INTO users(role,name) VALUES('occasionnel',?)", identity)
    )
    need(
        not one("SELECT id FROM cards WHERE owner=? AND status!='Restituée'", uid),
        "Carte déjà active.",
        409,
    )
    q(
        "INSERT INTO cards(code,owner,dest,hours,fee,deposit,status) VALUES(?,?,?,?,?,30,'Émise')",
        secrets.token_hex(12).upper(),
        uid,
        s,
        hours,
        hours * 2,
    )
    return {"token": token(uid)}


@app.post("/api/cards/resume")
@action()
def resume(d):
    c = one(
        "SELECT c.owner FROM cards c JOIN users u ON u.id=c.owner WHERE c.code=? AND u.name=? AND c.status!='Restituée'",
        txt(d, "code").upper(),
        txt(d, "identity"),
    )
    need(c, "Carte ou identité incorrecte.", 401)
    return {"token": token(c["owner"])}


@app.post("/api/rentals")
@action("abonne", "occasionnel")
def rent(d):
    uid = g.actor["id"]
    b = bike(num(d, "bike"))
    need(
        b["status"] == "Disponible" and b["station"],
        "Ce vélo n’est plus disponible.",
        409,
    )
    need(
        not one("SELECT id FROM rentals WHERE owner=? AND ended IS NULL", uid),
        "Une location est déjà en cours.",
        409,
    )
    card = None
    if g.actor["role"] == "occasionnel":
        c = one("SELECT * FROM cards WHERE owner=? AND status='Émise'", uid)
        need(c, "Carte courte durée requise.")
        card = c["id"]
        q("UPDATE cards SET status='En cours' WHERE id=?", card)
    q(
        "INSERT INTO rentals(owner,bike,card,origin) VALUES(?,?,?,?)",
        uid,
        b["id"],
        card,
        b["station"],
    )
    q("UPDATE bikes SET station=NULL,status='En location' WHERE id=?", b["id"])


@app.post("/api/returns")
@action("abonne", "occasionnel")
def give_back(d):
    r = one("SELECT * FROM rentals WHERE owner=? AND ended IS NULL", g.actor["id"])
    need(r, "Aucune location en cours.", 409)
    s = num(d, "station")
    room(s)
    cond = txt(d, "condition")
    need(cond in ("ok", "bad"), "État invalide.")
    bad = cond == "bad"
    if r["card"]:
        c = one("SELECT * FROM cards WHERE id=?", r["card"])
        need(d.get("card") == c["code"], "Présente la carte courte durée.")
        need(
            c["dest"] == s
            or station(c["dest"])["occupied"] >= station(c["dest"])["cap"],
            "Utilise la station de destination prévue.",
        )
        q("UPDATE cards SET status='Restituée' WHERE id=?", c["id"])
    q(
        "UPDATE rentals SET dest=?,ended=CURRENT_TIMESTAMP,damaged=? WHERE id=?",
        s,
        bad,
        r["id"],
    )
    q(
        "UPDATE bikes SET station=?,status=? WHERE id=?",
        s,
        "En panne" if bad else "Disponible",
        r["bike"],
    )
    if bad:
        q(
            "INSERT INTO claims(bike,rental,diagnosis,status) VALUES(?,?,?,'À traiter')",
            r["bike"],
            r["id"],
            txt(d, "diagnosis", 500),
        )


@app.post("/api/missions")
@action("responsable")
def assign(d):
    a, b, n, t, k = [num(d, f) for f in ("origin", "dest", "qty", "tech", "truck")]
    station(a)
    room(b, n)
    need(a != b, "Les stations doivent être différentes.")
    need(
        one("SELECT id FROM users WHERE id=? AND role='technicien'", t),
        "Technicien inconnu.",
    )
    v = one("SELECT * FROM trucks WHERE id=?", k)
    need(v and v["capacity"] >= n, "Capacité du camion insuffisante.")
    need(
        not one("SELECT id FROM missions WHERE step<5 AND (truck=? OR tech=?)", k, t),
        "Technicien ou camion déjà affecté.",
        409,
    )
    need(
        one("SELECT count(*) n FROM bikes WHERE station=? AND status='Disponible'", a)[
            "n"
        ]
        >= n,
        "Stock insuffisant.",
    )
    q(
        "INSERT INTO missions(tech,truck,origin,dest,qty,instructions) VALUES(?,?,?,?,?,?)",
        t,
        k,
        a,
        b,
        n,
        txt(d, "instructions", 500),
    )


@app.post("/api/missions/<int:i>/route")
@action("responsable")
def route(d, i):
    need(
        q(
            "UPDATE missions SET instructions=? WHERE id=? AND step=0",
            txt(d, "instructions", 500),
            i,
        ).rowcount,
        "Seule une tournée non démarrée est modifiable.",
        409,
    )


@app.post("/api/missions/<int:i>/advance")
@action("technicien")
def advance(d, i):
    m = one("SELECT * FROM missions WHERE id=? AND tech=?", i, g.actor["id"])
    need(m, "Mission non attribuée à ce compte.", 403)
    step = m["step"]
    need(step == num(d, "step", 0, 4), "Étape déjà validée.", 409)
    if step == 1:
        selected = rows(
            "SELECT id FROM bikes WHERE station=? AND status='Disponible' ORDER BY id LIMIT ?",
            m["origin"],
            m["qty"],
        )
        need(
            len(selected) == m["qty"],
            "Pas assez de vélos disponibles pour le chargement.",
            409,
        )
        for r in selected:
            q("INSERT INTO cargo VALUES(?,?,'Transfert')", i, r["id"])
            q("UPDATE bikes SET station=NULL,status='En mission' WHERE id=?", r["id"])
    if step == 2:
        room(m["dest"], m["qty"])
        q(
            "UPDATE bikes SET station=?,status='Disponible' WHERE id IN (SELECT bike FROM cargo WHERE mission=? AND kind='Transfert')",
            m["dest"],
            i,
        )
    if step == 3:
        ids = d.get("collect", [])
        need(
            isinstance(ids, list)
            and len(ids)
            <= one("SELECT capacity FROM trucks WHERE id=?", m["truck"])["capacity"],
            "Chargement invalide.",
        )
        for bi in ids:
            b = bike(num({"b": bi}, "b"))
            need(
                b["station"] in (m["origin"], m["dest"])
                and b["status"] in ("En panne", "En réparation"),
                "Vélo non collectable.",
            )
            q("INSERT INTO cargo VALUES(?,?,'Collecte')", i, b["id"])
            q("UPDATE bikes SET station=NULL,status='En collecte' WHERE id=?", b["id"])
    if step == 4:
        for r in rows("SELECT bike FROM cargo WHERE mission=? AND kind='Collecte'", i):
            planned = one(
                "SELECT id FROM claims WHERE bike=? AND status='Réparation planifiée'",
                r["bike"],
            )
            q(
                "UPDATE bikes SET status=? WHERE id=?",
                "En réparation" if planned else "En panne",
                r["bike"],
            )
    q("UPDATE missions SET step=step+1 WHERE id=?", i)


@app.get("/")
def index():
    return send_from_directory(WEB, "index.html")


@app.get("/<path:filename>")
def asset(filename):
    return send_from_directory(WEB, filename)


@app.after_request
def headers(res):
    if request.path.startswith("/api/"):
        res.headers["Cache-Control"] = "no-store"
    res.headers["X-Content-Type-Options"] = "nosniff"
    return res


if __name__ == "__main__":
    initialize()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), debug=False)
