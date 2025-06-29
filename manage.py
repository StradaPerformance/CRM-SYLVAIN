from flask import Flask, render_template  # ← ajoute render_template ici !
from flask_migrate import Migrate
import sys, os

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from models import db  # et tout ce que tu veux importer

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///crm_structurée_v4.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

@app.route("/")
def index():
    return render_template("index.html")

db.init_app(app)
migrate = Migrate(app, db)
