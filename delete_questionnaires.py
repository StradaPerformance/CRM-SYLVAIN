from app import app, db
from models import Questionnaire

with app.app_context():
    db.session.query(Questionnaire).delete()
    db.session.commit()
    print("Tous les questionnaires ont été supprimés.")
