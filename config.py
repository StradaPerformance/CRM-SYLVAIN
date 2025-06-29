import os
from dotenv import load_dotenv  # ✅ Il manquait cette ligne !

# Charge les variables d'environnement depuis le fichier .env
load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///app.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "static", "uploads")
    WTF_CSRF_ENABLED = True
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")