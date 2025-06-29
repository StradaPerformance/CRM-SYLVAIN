# reset_db.py
from app import db
from sqlalchemy import text
from models import (
    User, Mission, Magasin, Centrale, ProduitCentrale, Produit,
    Questionnaire, QuestionnaireEnseigne, Question, ReleveVisite, Reponse
)

def purge_association_tables():
    print("🧹 Suppression des tables d’association…")
    db.session.execute(text("DELETE FROM produits_missions"))
    db.session.execute(text("DELETE FROM users_questionnaires"))

def purge_main_tables():
    print("🗑️ Suppression des modèles principaux dans l’ordre logique…")
    db.session.query(ReleveVisite).delete()
    db.session.query(Reponse).delete()
    db.session.query(QuestionnaireEnseigne).delete()
    db.session.query(Question).delete()
    db.session.query(Questionnaire).delete()
    db.session.query(Magasin).delete()
    db.session.query(ProduitCentrale).delete()
    db.session.query(Produit).delete()
    db.session.query(Centrale).delete()
    db.session.query(User).delete()
    db.session.query(Mission).delete()

def reset_sequences():
    print("🔄 Réinitialisation des séquences PostgreSQL…")
    sequence_names = [
        "users_id_seq", "missions_id_seq", "magasins_id_seq",
        "produits_id_seq", "centrales_id_seq", "reponses_id_seq",
        "questions_id_seq", "questionnaires_id_seq",
        "produits_centrales_id_seq", "releves_visite_id_seq"
    ]
    for seq in sequence_names:
        db.session.execute(text(f"ALTER SEQUENCE {seq} RESTART WITH 1"))

def main():
    print("🚨 Début de la purge complète de la base…")
    purge_association_tables()
    purge_main_tables()
    reset_sequences()
    db.session.commit()
    print("✅ Base de données entièrement purgée et séquences réinitialisées.")

if __name__ == "__main__":
    main()
