import pandas as pd
from sqlalchemy import create_engine

# Connexion à SQLite
sqlite_path = "sqlite:///C:/Users/DOUAY/Desktop/start_crm_dossier/crm_structurée_v4.db"
sqlite_engine = create_engine(sqlite_path)

# Connexion à PostgreSQL
postgresql_url = "postgresql://postgres:Ericetramzy02@localhost:5432/crm_strada"
postgres_engine = create_engine(postgresql_url)

# Liste des tables à transférer
tables = [
    "users", "missions", "questionnaires", "questions", "reponses", "conditions",
    "magasins", "enseignes", "centrales", "produits", "assortiments",
    "produits_centrales", "produits_centrales_strates", "enseignes_missions",
    "produits_missions", "assortiment_produits", "agenda_visites", "users_questionnaires",
    "photos", "promotions", "objectifs", "strates", "documents"
]

for table in tables:
    print(f"📥 Migration de la table : {table}")
    try:
        df = pd.read_sql_table(table, sqlite_engine)
        df.to_sql(table, postgres_engine, if_exists='append', index=False)
        print(f"✅ {table} migrée ({len(df)} lignes)")
    except Exception as e:
        print(f"❌ Erreur sur {table} : {e}")
