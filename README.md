# VéloSf — application web de CycloSfaxcity

Application pédagogique pour l’étude de cas VéloSf (ISET de Sfax). Le frontend reprend le design des maquettes. Les données métier sont partagées entre les acteurs et conservées par le backend, même après redémarrage. Aucun service externe ni clé API n’est nécessaire.

## Démarrage

Installer **Python 3.10 ou supérieur**. Décompresser l’archive, se placer dans le dossier `velosf`, puis exécuter :

```sh
python -m venv .venv
# macOS / Linux :
source .venv/bin/activate
# Sous Windows PowerShell, utiliser à la place : .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python backend/app.py
```

Ouvrir **http://localhost:8080**. Ne pas ouvrir `frontend/index.html` directement : les écrans appellent l’API. Le serveur sert le site et l’API sur la même origine. La base `data/velosf.sqlite3` est créée au premier lancement avec six stations, vingt vélos, deux fournisseurs, deux camions et une réclamation initiale.

Variables facultatives : `PORT` (8080 par défaut), `VELOSF_DB` (chemin de la base). Pour réinitialiser la démonstration, **arrêter le serveur**, sauvegarder puis supprimer le fichier SQLite et relancer. Cette opération efface toutes les données de l’instance.

## Comptes d’essai

| Acteur | Identifiant / carte | Mot de passe / code |
|---|---|---|
| Responsable | `responsable` | `Flotte2026!` |
| Technicien Sami | `technicien` | `Atelier2026!` |
| Technicienne Inès | `tech2` | `Atelier2026!` |
| Abonné | Carte `SF-1001` (bouton de lecture) | `1234` |
| Occasionnel | Pas de compte préalable : saisir une identité fictive | Conserver le code de la carte courte durée |

Choisir un espace depuis l’accueil. Pour changer d’acteur, utiliser **Déconnexion**. On peut aussi ouvrir deux navigateurs ou deux fenêtres indépendantes : l’un pour le responsable, l’autre pour le technicien. Revenir dans une rubrique pour recharger les dernières données.

## Parcours tirés de l’étude de cas

**1. Contrôle et réparation**
- Le technicien sélectionne un vélo en station, indique son état et saisit un diagnostic. Un contrôle sans panne est historisé sans créer de réclamation.
- En cas de panne, le serveur enregistre la réclamation avec le vélo, le diagnostic, l’identité de session du technicien et l’horodatage. Le vélo ne peut plus être loué.
- Le responsable consulte la réclamation, programme une date et des travaux, puis enregistre la remise en service ou le retrait. Pour remplacer un vélo, il enregistre le fournisseur si nécessaire, puis une acquisition avec numéro de série unique, couleur, type et station.

**2. Location abonné**
- Simuler la lecture de la carte, saisir le code, choisir la station de départ puis un vélo disponible.
- Rendre le vélo à une station ayant une place libre. Pour un retour en panne, saisir un diagnostic : le vélo reste indisponible et le signalement apparaît chez le responsable. Une restitution immédiate à la station d’origine est possible.

**3. Location occasionnelle**
- Fournir une identité fictive, une destination et une durée. Confirmer le paiement simulé (tarifs d’exemple : **2 DT/h + 30 DT de garantie**).
- L’émission de la carte et la sélection du vélo sont deux étapes distinctes. Conserver le code de carte pour reprendre une location après déconnexion.
- À destination, remettre le vélo et la carte. Le serveur clôt la location et marque la garantie comme restituée dans la simulation. Si la destination est pleine, une autre station disposant d’une place peut accepter le retour.

**4. Répartition entre stations**
- Responsable → **Missions** : consulter les sorties/retours réels des locations et l’occupation, puis préparer un ordre de mission (départ, destination, quantité, technicien, camion et consignes).
- Par exemple : **Bab Bhar → Route de Gremda**, deux vélos, Sami, camion 01. Le responsable peut éditer les consignes avant démarrage.
- Sami → **Tournée de répartition** : prendre le camion, charger les vélos, les déposer, sélectionner éventuellement les vélos en panne à collecter puis rentrer à l’entrepôt. Les changements de stock sont appliqués au chargement et au déchargement, pas seulement à l’affichage. Seul le technicien affecté peut avancer la mission.

## Architecture et données

```text
frontend/               HTML, CSS, JavaScript et illustrations SVG locales
  index.html            Point d’entrée
  art.js                Illustrations et identité visuelle
  app.js                Navigation, formulaires, appels fetch, rendu selon le rôle
backend/
  app.py                Serveur Flask, API JSON, authentification, règles métier
  schema.sql            Tables, clés étrangères et contraintes relationnelles
tests/test_workflows.py  Tests d’intégration, chacun sur une base temporaire
data/                   Créé au premier démarrage ; ne pas publier la base réelle
```

**Relations principales :** un fournisseur vend plusieurs vélos ; une station accueille plusieurs vélos ; chaque location associe un utilisateur à un vélo, un départ et un retour. Un contrôle est signé par un technicien et peut ouvrir une réclamation. Une réclamation peut aussi provenir d’un retour en panne, puis être complétée par un contrôle. Un plan de réparation précise les travaux et leur date. Une mission associe un technicien, un camion, deux stations et un manifeste des vélos transportés.

Les capacités et les disponibilités sont calculées à partir des vélos effectivement présents. Un vélo en panne occupe une place mais n’est pas louable. Les écritures sont transactionnelles ; des index uniques empêchent deux locations actives pour le même vélo ou pour le même utilisateur. Les droits sont vérifiés **côté serveur** : modifier le menu ou le JavaScript ne confère aucun droit. Les secrets des comptes sont hachés ; les jetons de session expirent après 24 h et sont révoqués à la déconnexion. Seul le jeton est conservé dans l’onglet du navigateur, pas la base métier.

### Principaux endpoints

| Méthode | Chemin `/api/…` | Accès et opération |
|---|---|---|
| GET | `state` | Vue filtrée selon le rôle ; seules les stations sont publiques |
| POST | `login`, `logout` | Ouvrir / révoquer une session |
| POST | `stations`, `suppliers`, `bikes`, `bikes/<id>/retire` | Responsable : référentiels et acquisitions/retraits |
| POST | `checks` | Technicien : contrôle et réclamation conditionnelle |
| POST | `claims/<id>` | Responsable : planification, clôture ou retrait |
| POST | `missions`, `missions/<id>/route` | Responsable : ordre de mission et consignes |
| POST | `missions/<id>/advance` | Technicien affecté : valider une étape |
| POST | `cards`, `cards/resume` | Occasionnel : émettre ou retrouver une carte |
| POST | `rentals`, `returns` | Abonné ou occasionnel : louer / rendre son propre vélo |

Le client transmet les écritures en JSON et le jeton dans `Authorization: Bearer …`. Les erreurs de validation, d’authentification, de droits et de conflit sont renvoyées avec leur statut HTTP. Les horaires sont stockés en UTC et affichés selon l’heure locale du navigateur.

## Vérifier le projet

```sh
python -m unittest discover -s tests -v
```

Les tests couvrent les droits, le stock, les numéros de série, le diagnostic et la réparation, la location et les mouvements, la restitution de carte et l’exécution d’une tournée avec collecte. Ils ne modifient pas la base de démonstration.

## Limites du prototype

Le lecteur optique est un **acteur matériel simulé**, pas un cinquième compte utilisateur. Les encaissements et remboursements sont simulés, sans prestataire bancaire. Les stations sont choisies dans une liste, sans GPS ; le schéma de tournée n’est pas une carte routière calculée. L’abonnement de démonstration est préchargé. Une mise en production nécessiterait notamment l’intégration des périphériques et du paiement, le remplacement des comptes publics, la limitation des tentatives de connexion, HTTPS, un serveur WSGI de production et des sauvegardes.
