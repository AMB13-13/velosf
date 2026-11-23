"""Parcours d'intégration HTTP : chaque test utilise une base temporaire isolée."""

import sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app import app, initialize


class Workflows(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        app.config.update(TESTING=True, DATABASE=self.tmp.name + "/test.sqlite3")
        initialize()
        self.c = app.test_client()

    def post(self, url, d, t="", code=200):
        r = self.c.post("/api/" + url, json=d, headers={"Authorization": "Bearer " + t})
        self.assertEqual(r.status_code, code, r.get_data(as_text=True))
        return r.json

    def login(self, l, p):
        return self.post("login", {"login": l, "secret": p})["token"]

    def state(self, t=""):
        return self.c.get("/api/state", headers={"Authorization": "Bearer " + t}).json

    def manager(self):
        return self.login("responsable", "Flotte2026!")

    def tech(self):
        return self.login("technicien", "Atelier2026!")

    def member(self):
        return self.login("SF-1001", "1234")

    def test_authorization_and_session(self):
        self.post("stations", {}, code=401)
        self.post("login", {"login": "SF-1001", "secret": "1111"}, code=401)
        t = self.tech()
        self.post("stations", {}, t, 403)
        self.assertNotIn("claims", self.state())
        self.post("logout", {}, t)
        self.post("checks", {}, t, 401)

    def test_stations_purchases_suppliers(self):
        a = self.manager()
        self.post("suppliers", {"name": "F1", "contact": "Sfax"}, a)
        self.post("stations", {"name": "S7", "address": "Rue A", "cap": 1}, a)
        b = {
            "serial": "SN-42",
            "color": "#256655",
            "type": "Ville",
            "supplier": 3,
            "station": 7,
        }
        self.post("bikes", b, a)
        self.post("bikes", {**b, "serial": "SN-43"}, a, 409)
        self.post("bikes", {**b, "station": 1}, a, 409)
        self.assertEqual(self.state()["stations"][-1]["count"], 1)
        self.post("stations", {"id": 7, "cap": 2, "address": "Rue B", "name": "S7"}, a)

    def test_member_bad_return_and_repair(self):
        u = self.member()
        a = self.manager()
        t = self.tech()
        self.post("rentals", {"bike": 1}, u)
        self.post("rentals", {"bike": 2}, u, 409)
        self.post("returns", {"station": 2, "condition": "ok"}, u, 409)
        self.post(
            "returns", {"station": 1, "condition": "bad", "diagnosis": "Frein cassé"}, u
        )
        self.assertTrue(self.state(u)["rentals"][0]["ended"])
        self.post(
            "checks", {"bike": 1, "diagnosis": "Câble rompu", "condition": "bad"}, t
        )
        c = self.state(a)["claims"][0]
        self.assertEqual(c["author"], "Sami · Technicien")
        self.post(
            f"claims/{c['id']}",
            {
                "decision": "plan",
                "scheduled": "2026-12-01",
                "work": "Contrôle et réparation",
            },
            a,
        )
        self.post(f"claims/{c['id']}", {"decision": "fixed", "station": 1}, a)
        self.assertEqual(self.state(a)["bikes"][0]["status"], "Disponible")
        m = self.state(a)["movements"][0]
        self.assertEqual((m["departures"], m["returns"]), (1, 1))

    def test_short_card_and_ownership(self):
        t = self.post(
            "cards",
            {"dest": 4, "identity": "Essai", "hours": 2, "payment": "simulation"},
        )["token"]
        c = self.state(t)["cards"][0]
        self.assertEqual((c["fee"], c["deposit"]), (4, 30))
        self.post("rentals", {"bike": 1}, t)
        u = self.member()
        self.post("rentals", {"bike": 1}, u, 409)
        self.post(
            "returns", {"station": 4, "condition": "ok", "card": c["code"]}, u, 409
        )
        self.post(
            "returns", {"station": 4, "condition": "ok", "card": "incorrect"}, t, 400
        )
        self.post("logout", {}, t)
        t = self.post("cards/resume", {"code": c["code"], "identity": "Essai"})["token"]
        self.post("returns", {"station": 4, "condition": "ok", "card": c["code"]}, t)
        self.assertEqual(self.state(t)["cards"][0]["status"], "Restituée")
        self.post("rentals", {"bike": 2}, t, 400)

    def test_redistribution_and_collect(self):
        a = self.manager()
        t = self.tech()
        t2 = self.login("tech2", "Atelier2026!")
        d = {
            "tech": 2,
            "truck": 1,
            "origin": 1,
            "dest": 4,
            "qty": 2,
            "instructions": "Via Bab Diwan",
        }
        self.post("missions", d, a)
        self.post("missions", d, a, 409)
        self.assertFalse(self.state(t2)["missions"])
        self.post("missions/1/advance", {"step": 0}, t2, 403)
        self.post("missions/1/route", {"instructions": "Passer par Bab Bhar"}, a)
        for i in range(5):
            self.post("missions/1/advance", {"step": i, "collect": [3]}, t)
        s = self.state(a)
        self.assertEqual(s["missions"][0]["step"], 5)
        self.assertEqual(s["stations"][3]["count"], 3)
        self.assertEqual(s["stations"][0]["count"], 2)
        self.assertIsNone(s["bikes"][2]["station"])
        self.post(
            "claims/1",
            {
                "decision": "plan",
                "scheduled": "2026-12-01",
                "work": "Contrôle et réparation",
            },
            a,
        )
        self.post("claims/1", {"decision": "fixed", "station": 1}, a)
        self.assertEqual(self.state(a)["stations"][0]["count"], 3)


if __name__ == "__main__":
    unittest.main()
