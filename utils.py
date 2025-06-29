import requests
from flask import url_for
from models import Centrale, TunnelReleveConfig, ProduitCentraleStrate, Produit
from config_strates import ENSEIGNE_STRATES

# ✅ Génère un mapping { 'ENSEIGNE': ['Centrale 1', 'Centrale 2'] }
def generate_enseigne_centrale_map(db):
    centrales = Centrale.query.all()
    enseigne_map = {}
    for c in centrales:
        nom_enseigne = str(c.enseigne)
        if nom_enseigne not in enseigne_map:
            enseigne_map[nom_enseigne] = []
        enseigne_map[nom_enseigne].append(c.nom)
    return enseigne_map

# ✅ URL de la prochaine étape du tunnel
def get_next_step_url(releve, current_step, db):
    config = TunnelReleveConfig.query.filter_by(mission_id=releve.mission_id).first()
    steps = []

    if config:
        if config.questionnaire:
            steps.append("questionnaire")
        if config.produits:
            steps.append("produits")

    picking_exists = (
        db.session.query(ProduitCentraleStrate)
        .join(Produit)
        .filter(Produit.missions.any(id=releve.mission_id))
        .filter(ProduitCentraleStrate.strate == "Picking")
        .first() is not None
    )
    if picking_exists:
        steps.append("picking")

    if config and config.concurrence:
        steps.append("concurrence")

    steps.append("final")

    try:
        index = steps.index(current_step)
        next_step = steps[index + 1]
    except (ValueError, IndexError):
        next_step = None

    if not next_step:
        return url_for("fiche_magasin", magasin_id=releve.magasin_id)

    return url_for(f"releve_{next_step}", releve_id=releve.id)

# ✅ Liste des produits à relever selon mission / centrale / strate
def get_produits_visite(mission_id, centrale_id, enseigne_id, strate_magasin, db):
    if not all([mission_id, centrale_id, enseigne_id, strate_magasin]):
        return []

    affectations = db.session.query(Produit).join(ProduitCentraleStrate).filter(
        ProduitCentraleStrate.mission_id == mission_id,
        ProduitCentraleStrate.centrale_id == centrale_id,
        ProduitCentraleStrate.strate == strate_magasin
    ).all()

    return affectations

# ✅ Géolocalisation via OpenStreetMap (fallback gratuit)
def get_lat_lon(adresse):
    url = "https://nominatim.openstreetmap.org/search"
    params = {'q': adresse, 'format': 'json', 'limit': 1}
    headers = {'User-Agent': 'strada-crm/1.0'}
    try:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        if response.ok:
            data = response.json()
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"Erreur géocodage OSM : {e}")
    return None, None

# ✅ Géolocalisation via Google Maps API
def get_coordinates_google(address, api_key):
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {'address': address, 'key': api_key}
    try:
        response = requests.get(url, params=params, timeout=5)
        if response.ok:
            results = response.json().get('results')
            if results:
                location = results[0]['geometry']['location']
                return location['lat'], location['lng']
    except Exception as e:
        print(f"[Google API] Erreur géocodage : {e}")
    return None, None


def get_strates_by_enseigne(enseigne: str):
    if not enseigne:
        return []
    return ENSEIGNE_STRATES.get(enseigne.upper().strip(), ["Picking", "Présence"])

