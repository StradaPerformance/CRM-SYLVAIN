import pandas as pd
from sqlalchemy import create_engine

# Connexions
sqlite_engine = create_engine('sqlite:///C:/Users/DOUAY/Desktop/start_crm_dossier/crm_structurée_v4.db')
postgres_engine = create_engine('postgresql://postgres:Ericetramzy02@localhost:5432/crm_strada')  # remplace TonMotDePasse

# Réinjection dans le bon ordre
# 1. Users
df_users = pd.read_sql_table('users', sqlite_engine)
df_users.to_sql('users', postgres_engine, if_exists='append', index=False)
print("✅ users réinjectés")

# 2. Magasins
df_magasins = pd.read_sql_table('magasins', sqlite_engine)
df_magasins.to_sql('magasins', postgres_engine, if_exists='append', index=False)
print("✅ magasins réinjectés")

# 3. Users-questionnaires
df_uq = pd.read_sql_table('users_questionnaires', sqlite_engine)
df_uq.to_sql('users_questionnaires', postgres_engine, if_exists='append', index=False)
print("✅ users_questionnaires réinjectés")
