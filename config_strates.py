# config_strates.py

ENSEIGNE_STRATES = {
    # Auchan
    "AUCHAN SUPERMARCHE": ["S1", "S2", "S3", "S4"],
    "AUCHAN HYPERMARCHE": ["H1", "H2", "H3", "H4"],

    # Carrefour Groupe
    "CARREFOUR": ["T1", "T2", "T3", "T4", "T5", "T6", "T7"],
    "CARREFOUR MARKET": ["T1", "T2", "T3", "T4", "T5", "T6", "T7"],
    "CARREFOUR CITY": ["T1", "T2", "T3", "T4", "T5", "T6", "T7"],
    "CARREFOUR CONTACT": ["T1", "T2", "T3", "T4", "T5", "T6", "T7"],

    # Franprix
    "FRANPRIX": ["D0", "D1", "D2", "D3", "D4"],

    # Monoprix
    "MONOPRIX": ["M5", "M6", "M10", "M20", "M30", "M40", "M50"],

    # Match
    "MATCH": ["S", "P", "M", "G"],

    # Cora
    "CORA": ["S1", "S2", "REG"],

    # Leclerc Drive
    "LECLERC DRIVE": ["D1", "D2", "D3"],

    # Système U
    "SYSTEME U SM": ["SU1200", "SU1800", "SU2500", "SU3500"],
    "SYSTEME U HM": ["HU5000", "HU6500"],

    # E.Leclerc
    "E.LECLERC": ["SM-", "SM+", "HM-", "HM+"],

    # Intermarché
    "INTERMARCHE": ["XP400", "XP700", "CT450", "CT650", "SA1500", "SA2500", "SG2000", "SG3000", "HM4200", "HM5000"],
}

# Strates qu'on ajoute toujours
DEFAULT_STRATES = ["Présence", "Picking", "Non attribué"]

def get_strates_for_enseigne(enseigne):
    if not enseigne:
        return DEFAULT_STRATES

    enseigne = enseigne.strip().upper()

    # Matching direct
    if enseigne in ENSEIGNE_STRATES:
        return ENSEIGNE_STRATES[enseigne] + DEFAULT_STRATES

    # Matching souple (ex: "Carrefour Market Lyon" contient "CARREFOUR")
    for key in ENSEIGNE_STRATES:
        if key in enseigne:
            return ENSEIGNE_STRATES[key] + DEFAULT_STRATES

    # Si aucun match
    return DEFAULT_STRATES
