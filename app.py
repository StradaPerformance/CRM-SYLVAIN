# ────────────────
# 📦 IMPORTS STANDARD
# ────────────────
import os
import secrets
import requests
import csv
from io import StringIO
from flask import send_file
import smtplib
from datetime import datetime
from models import EnseigneMission
from email.mime.text import MIMEText
from time import time

from dotenv import load_dotenv
from io import BytesIO

# ────────────────
# 📚 LIBS TIERCES
# ────────────────
import pandas as pd
import psycopg2
import psycopg2.extensions
from flask import (
    Flask, render_template, request, redirect, url_for, flash,
    send_file, jsonify, abort
)
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import (
    LoginManager, login_user, logout_user, current_user, UserMixin
)
from flask_wtf import CSRFProtect
from flask_wtf.csrf import generate_csrf, validate_csrf, CSRFError
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import text, func, or_
from sqlalchemy.orm import joinedload

# ────────────────
# 📁 MODULES LOCAUX
# ────────────────
from config import Config
from decorators import role_required
from utils import get_lat_lon, generate_enseigne_centrale_map, get_coordinates_google
from models import (
    db, User, Magasin, Mission, Questionnaire, Secteur, AgendaVisite,
    QuestionnaireEnseigne, ReleveVisite, Centrale, Produit, ProduitCentraleStrate,
    EnseigneCentrale, EnseigneAlias, ReponseReleveVisite, TunnelReleveConfig,
    BlocPreparationConfig, Assortiment, Enseigne, ProduitCentrale, produits_missions,
    Question, Reponse, Condition, EnseigneMission
)
from forms import AssocierMissionsForm  # si utilisé

# ────────────────
# 🚀 INIT APP
# ────────────────
app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = "abc123456789def"  # ⚠️ À changer en prod

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

# ────────────────
# 🌍 CHEMINS FICHIERS & UPLOADS
# ────────────────
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.static_folder = os.path.join(BASE_DIR, 'static')
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'static', 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ────────────────
# 🔐 CSRF
# ────────────────
csrf = CSRFProtect(app)

@app.context_processor
def inject_csrf_token():
    try:
        return dict(csrf_token=generate_csrf())
    except:
        return dict(csrf_token=None)

@app.context_processor
def inject_user():
    return dict(current_user=current_user)

# ────────────────
# 🧪 ENV & DB
# ────────────────
load_dotenv()
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

if not app.config['SQLALCHEMY_DATABASE_URI']:
    raise ValueError("❌ La variable DATABASE_URL est manquante.")

# PostgreSQL encoding
psycopg2.extensions.register_type(psycopg2.extensions.UNICODE)
psycopg2.extensions.register_type(psycopg2.extensions.UNICODEARRAY)

# Google Maps API
app.config['GOOGLE_MAPS_API_KEY'] = os.getenv("GOOGLE_MAPS_API_KEY")
print("✅ Clé Google Maps chargée :", app.config.get("GOOGLE_MAPS_API_KEY"))

# ────────────────
# 🔑 LOGIN MANAGER
# ────────────────
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ────────────────
# 🔗 BDD & MIGRATIONS
# ────────────────
db.init_app(app)
migrate = Migrate(app, db)

# ────────────────
# 🧭 RELEVÉ VISITE : TUNNEL
# ────────────────
def get_next_step_url(releve, current_step):
    tunnel = TunnelReleveConfig.query.filter_by(mission_id=releve.mission_id).first()

    if not tunnel:
        return url_for("fiche_magasin", magasin_id=releve.magasin_id)

    etapes = []
    if tunnel.questionnaire:
        etapes.append("questionnaire")
    if tunnel.produits:
        etapes.append("produits")
    if tunnel.concurrence:
        etapes.append("concurrence")
    etapes.append("final")

    try:
        current_index = etapes.index(current_step)
        prochaine_etape = etapes[current_index + 1]
    except (ValueError, IndexError):
        return url_for("fiche_magasin", magasin_id=releve.magasin_id)

    if prochaine_etape == "questionnaire":
        return url_for("repondre_question_releve", releve_id=releve.id, index=0)
    elif prochaine_etape == "produits":
        return url_for("releve_produits", releve_id=releve.id)
    elif prochaine_etape == "concurrence":
        return url_for("releve_concurrence", releve_id=releve.id)
    elif prochaine_etape == "final":
        return url_for("releve_final", releve_id=releve.id)

    return url_for("fiche_magasin", magasin_id=releve.magasin_id)

# ────────────────
# 🌐 GÉOCODAGE (Google Maps ou fallback OpenStreetMap)
# ────────────────
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

def get_lat_lon(adresse):
    url = "https://nominatim.openstreetmap.org/search"
    params = {'q': adresse, 'format': 'json', 'limit': 1}
    headers = {'User-Agent': 'strada/1.0'}
    try:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        if response.ok:
            data = response.json()
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"Erreur géocodage : {e}")
    return None, None

# ────────────────
# 📧 MAIL (texte brut)
# ────────────────
def send_email(destinataire, sujet, corps):
    msg = MIMEText(corps)
    msg['Subject'] = sujet
    msg['From'] = "lokia.strada@gmail.com"
    msg['To'] = destinataire

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login("lokia.strada@gmail.com", "hiri xdme mbje vdop")  # ⚠️ Sécuriser ça dans .env
            server.send_message(msg)
        print("✅ Mail envoyé avec succès")
    except Exception as e:
        print(f"❌ Erreur lors de l'envoi du mail : {e}")

@app.route('/admin/utilisateurs/<int:user_id>/reset-password')
@role_required('admin', 'superadmin')
def admin_reset_password(user_id):
    user = User.query.get_or_404(user_id)

    # Génération d'un mot de passe temporaire de 8 caractères alphanumériques
    import random, string
    temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))

    # Hash du mot de passe et sauvegarde
    user.password = generate_password_hash(temp_password)
    db.session.commit()

    # Envoi du mail
    corps_mail = f"Bonjour {user.prenom},\n\nVoici votre nouveau mot de passe temporaire : {temp_password}\n\nMerci de vous connecter rapidement et de le modifier depuis votre profil.\n\nL'équipe Strada."
    send_email(user.email, "🔐 Nouveau mot de passe temporaire", corps_mail)

    flash(f"✉️ Nouveau mot de passe envoyé à {user.email}.", "success")
    return redirect(url_for('afficher_utilisateurs'))
        
@app.before_request
def mettre_a_jour_derniere_connexion():
    if current_user.is_authenticated:
        current_user.derniere_connexion = datetime.utcnow()
        db.session.commit()



@csrf.exempt
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]
        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.mot_de_passe, password):
            login_user(user)
            return redirect(url_for("index"))
        else:
            flash("Email ou mot de passe incorrect.")
            return redirect(url_for("login"))
    
    return render_template("login.html")






@app.route("/logout")
def logout():
    logout_user()
    flash("🔒 Déconnecté", "info")
    return redirect(url_for("login"))


@app.route("/")
def index():
    first_questionnaire = Questionnaire.query.first()
    return render_template("index.html", first_questionnaire=first_questionnaire)


@app.route("/get_strates/<string:enseigne>", methods=["GET"])
def get_strates(enseigne):
    from config_strates import get_strates_for_enseigne
    strates = get_strates_for_enseigne(enseigne)
    return jsonify(strates)




@app.route("/admin/questions")
@role_required('admin', 'superadmin')
def admin_questions():
    questionnaire_id = request.args.get("questionnaire_id", type=int)

    questions = []
    if questionnaire_id:
        questions = Question.query.filter_by(questionnaire_id=questionnaire_id).order_by(Question.ordre).all()

    questionnaires = (
        db.session.query(Questionnaire, Mission)
        .join(Mission, Questionnaire.mission_id == Mission.id)
        .filter(Mission.statut.ilike("active"))
        .order_by(Mission.nom, Questionnaire.nom)
        .all()
    )

    return render_template(
        "admin_questions.html",
        questionnaires=questionnaires,
        questions=questions,
        selected_questionnaire_id=questionnaire_id
    )
@app.route("/admin/questions/reorder", methods=["POST"])
@role_required('admin', 'superadmin')
def reorder_questions():
    try:
        data = request.get_json()
        if not data or "ordre" not in data:
            return {"error": "Données manquantes"}, 400

        for item in data["ordre"]:
            question = Question.query.get(item["id"])
            if question:
                question.ordre = item["new_ordre"]

        db.session.commit()
        return {"status": "ok"}, 200

    except Exception as e:
        db.session.rollback()
        print(f"Erreur lors du reorder des questions : {e}")
        return {"error": "Une erreur est survenue"}, 500



@app.route("/admin/questions/create", methods=["GET", "POST"])
@role_required('admin', 'superadmin')
def create_question():
    questionnaire_id = request.args.get("questionnaire_id", type=int)
    questionnaires = Questionnaire.query.all()

    if request.method == "POST":
        try:
            validate_csrf(request.form.get("csrf_token"))
        except:
            flash("Le token CSRF est invalide ou manquant.", "danger")
            return redirect(url_for("admin_questions"))

        try:
            questionnaire_id = int(request.form.get("questionnaire_id", 0))
        except ValueError:
            return "Questionnaire invalide", 400

        if questionnaire_id == 0:
            flash("Aucun questionnaire sélectionné.", "warning")
            return redirect(url_for("admin_questions"))

        contenu = request.form.get("question_texte")
        ordre = request.form.get("ordre", type=int)
        type_question = request.form.get("type_question")
        options = request.form.get("options_reponse")
        nb_min = request.form.get("min_reponses", type=int) or 0
        nb_max = request.form.get("max_reponses", type=int) or 0
        autre_reponse = request.form.get("ajouter_libre") == "on"
        conditionnelle = request.form.get("conditionnelle") == "1"
        condition_question_id = request.form.get("condition_question_id")
        condition_valeur = request.form.get("condition_valeur")

        q = Question(
            questionnaire_id=questionnaire_id,
            contenu=contenu,
            ordre=ordre,
            type_reponse=type_question,
            nb_min=nb_min,
            nb_max=nb_max,
            autre_reponse=autre_reponse
        )
        db.session.add(q)
        db.session.commit()

        if conditionnelle and condition_question_id and condition_valeur:
            condition = Condition(
                question_id=q.id,
                question_parent_id=condition_question_id,
                reponse_parent=condition_valeur
            )
            db.session.add(condition)

        if options:
            for val in options.split(";"):
                if val.strip():
                    db.session.add(Reponse(contenu=val.strip(), question_id=q.id))

        db.session.commit()
        flash("✅ Question créée avec succès", "success")
        return redirect(url_for("admin_questions", questionnaire_id=questionnaire_id))

    return render_template(
        "formulaire_creation_question.html",
        questionnaire_id=questionnaire_id,
        questionnaires=questionnaires
    )


@role_required('terrain', 'responsable', 'admin', 'superadmin')
@app.route("/simulation")
def simulation_selection():
    mission_id = request.args.get("mission_id", type=int)
    
    # ✅ Toutes les missions actives
    missions = Mission.query.filter_by(statut='active').order_by(Mission.nom).all()

    # ✅ Si une mission est sélectionnée, on filtre les questionnaires de cette mission uniquement
    questionnaires = []
    if mission_id:
        questionnaires = Questionnaire.query.filter_by(mission_id=mission_id).order_by(Questionnaire.nom).all()

    return render_template(
        "simulation_selection.html",
        missions=missions,
        questionnaires=questionnaires,
        selected_mission_id=mission_id
    )



@role_required('admin', 'superadmin')
@app.route("/admin/questions/delete/<int:question_id>", methods=["POST"])
def delete_question(question_id):
    question = Question.query.get_or_404(question_id)
    questionnaire_id = question.questionnaire_id
    db.session.delete(question)
    db.session.commit()
    return redirect(url_for("admin_questions", questionnaire_id=questionnaire_id))

@role_required('admin', 'superadmin')
@app.route("/admin/questions/edit/<int:question_id>", methods=["GET", "POST"])
def edit_question(question_id):
    question = Question.query.get_or_404(question_id)
    questionnaires = Questionnaire.query.all()
    if request.method == "POST":
        question.contenu = request.form.get("question_texte")
        question.ordre = request.form.get("ordre", type=int)
        question.type_reponse = request.form.get("type_question")
        question.nb_min = request.form.get("min_reponses", type=int)
        question.nb_max = request.form.get("max_reponses", type=int)
        question.autre_reponse = request.form.get("conditionnelle") == "1"
        db.session.commit()
        return redirect(url_for("admin_questions", questionnaire_id=question.questionnaire_id))
    return render_template("edit_question.html", question=question, questionnaires=questionnaires)


@role_required('terrain', 'responsable', 'admin', 'superadmin')
@app.route("/analyse")
def analyse():
    return "<h2>Analyse à venir</h2>"

@role_required('admin', 'superadmin')
@app.route('/admin/simulation-questionnaire')
def simuler_questionnaire_depuis_admin():
    questionnaire = Questionnaire.query \
        .join(Mission) \
        .filter(Mission.statut == 'active') \
        .order_by(Questionnaire.nom.asc()) \
        .first()

    question = questionnaire.questions[0] if questionnaire and questionnaire.questions else None

    return render_template(
        "simulation_questionnaire.html",
        questionnaire=questionnaire,
        question=question,
        index=0  # 👈 Obligatoire pour le template
    )


@role_required('terrain', 'responsable', 'admin', 'superadmin')
@app.route("/simulation/lancer")
def lancer_simulation():
    questionnaire_id = request.args.get("questionnaire_id", type=int)
    if questionnaire_id:
        return redirect(url_for("simulation_question", questionnaire_id=questionnaire_id, index=0))
    return "<h3>Veuillez sélectionner un questionnaire</h3>", 400

@role_required('terrain', 'responsable', 'admin', 'superadmin')
@app.route("/simulation/<int:questionnaire_id>/question/<int:index>", methods=["GET", "POST"])
def simulation_question(questionnaire_id, index):
    # Récupération du questionnaire
    questionnaire = Questionnaire.query.get_or_404(questionnaire_id)
    questions = questionnaire.questions

    # Cas sans question
    if not questions:
        return "<h2>Ce questionnaire ne contient aucune question.</h2>", 404

    # Cas d'index hors limites
    if index < 0 or index >= len(questions):
        return "<h2>Index hors limites</h2>", 404

    # Récupération de la question en cours
    question = questions[index]
    reponse_utilisateur = None  # Placeholder si tu veux stocker la réponse

    # Si formulaire soumis
    if request.method == "POST":
        reponse = request.form.get("reponse")
        print(f"Réponse à la question {question.id} : {reponse}")

        # Enregistrer la réponse ici si tu veux (dans une table de réponses)

        # Rediriger vers la question suivante
        if index + 1 < len(questions):
            return redirect(url_for("simulation_question", questionnaire_id=questionnaire_id, index=index + 1))
        else:
            return "<h3>Merci, vous avez terminé le questionnaire ✅</h3>"

    # Affichage de la question
    return render_template(
        "simulation_question.html",
        questionnaire=questionnaire,
        index=index,
        question=question,
        reponse_utilisateur=reponse_utilisateur,
        total=len(questions)
    )



@app.route("/admin/questionnaires", methods=["GET", "POST"])
@role_required('admin', 'superadmin')
def admin_questionnaires():
    missions = Mission.query.filter_by(statut='active').order_by(Mission.nom.asc()).all()
    utilisateurs = User.query.filter_by(actif=True).all()
    enseignes = Enseigne.query.order_by(Enseigne.nom).all()

    if request.method == "POST":
        nom = request.form.get("nom")
        mission_id = request.form.get("mission_id")
        enseigne_nom = request.form.get("enseignes", "").strip().upper()


        questionnaire = Questionnaire(nom=nom, mission_id=mission_id)
        db.session.add(questionnaire)
        db.session.commit()

        # Ajout de l’enseigne liée
        if enseigne_nom:
            lien = QuestionnaireEnseigne(
                questionnaire_id=questionnaire.id,
                enseigne=enseigne_nom.upper()
            )
            db.session.add(lien)

        # Ajout des utilisateurs liés
        for user_id in request.form.getlist("utilisateurs"):
            user = User.query.get(int(user_id))
            questionnaire.utilisateurs.append(user)

        db.session.commit()
        flash("✅ Questionnaire créé avec succès", "success")
        return redirect(url_for("admin_questionnaires"))

    # 🔁 Une seule requête bien chargée
    questionnaires = Questionnaire.query \
        .options(joinedload(Questionnaire.mission)) \
        .order_by(Questionnaire.date_creation.desc()) \
        .all()

    return render_template(
        "admin_questionnaires.html",
        missions=missions,
        utilisateurs=utilisateurs,
        questionnaires=questionnaires,
        enseignes=enseignes
    )

@app.route("/admin/questionnaires/graph")
@role_required("admin", "superadmin")
def questionnaire_graph():
    missions = Mission.query.filter_by(statut="active").all()
    return render_template("questionnaire_graph.html", missions=missions)


@app.route("/api/graph_questionnaires")
@role_required("admin", "superadmin")
def api_graph_questionnaires():
    elements = []
    questionnaires = Questionnaire.query.all()

    for q in questionnaires:
        # 🎯 Ajout du questionnaire
        elements.append({
            "group": "nodes",
            "data": {
                "id": f"q{q.id}",
                "label": q.nom,
                "type": "questionnaire",
                "mission": q.mission.nom if q.mission else "Non défini"
            }
        })

        # 🛒 Ajout des enseignes associées
        for assoc in q.enseignes_associees:
            eid = f"e_{assoc.enseigne.replace(' ', '_')}"
            if not any(e["data"]["id"] == eid for e in elements):
                elements.append({
                    "group": "nodes",
                    "data": {
                        "id": eid,
                        "label": assoc.enseigne,
                        "type": "enseigne"
                    }
                })
            elements.append({
                "group": "edges",
                "data": {
                    "id": f"qe_{q.id}_{eid}",
                    "source": f"q{q.id}",
                    "target": eid
                }
            })

        # 👤 Ajout des utilisateurs
        for user in q.utilisateurs:
            uid = f"u{user.id}"
            if not any(e["data"]["id"] == uid for e in elements):
                elements.append({
                    "group": "nodes",
                    "data": {
                        "id": uid,
                        "label": user.nom,
                        "type": "user",
                        "mission": q.mission.nom if q.mission else "Non défini"
                    }
                })
            elements.append({
                "group": "edges",
                "data": {
                    "id": f"qu_{q.id}_{uid}",
                    "source": f"q{q.id}",
                    "target": uid
                }
            })

    return jsonify({"elements": elements})



@app.route("/admin/questionnaires/associer-enseignes", methods=["POST"])
@role_required('admin', 'superadmin')
def associer_enseignes_questionnaire():
    q_id = int(request.form.get("questionnaire_id"))
    raw = request.form.get("enseignes", "")
    enseignes = [e.strip() for e in raw.split(",") if e.strip()]

    for nom in enseignes:
        existe = QuestionnaireEnseigne.query.filter_by(questionnaire_id=q_id, enseigne=nom).first()
        if not existe:
            db.session.add(QuestionnaireEnseigne(questionnaire_id=q_id, enseigne=nom))
    db.session.commit()
    flash("✅ Enseignes associées au questionnaire", "success")
    return redirect(url_for("admin_questionnaires"))


@role_required("admin", "superadmin")
@app.route("/admin/questionnaires/delete/<int:questionnaire_id>", methods=["POST"])
def delete_questionnaire(questionnaire_id):
    try:
        questionnaire = Questionnaire.query.get_or_404(questionnaire_id)

        # Supprimer d'abord les liaisons (questionnaires_enseignes)
        QuestionnaireEnseigne.query.filter_by(questionnaire_id=questionnaire_id).delete()

        # Puis supprimer le questionnaire lui-même
        db.session.delete(questionnaire)
        db.session.commit()
        flash("🗑 Questionnaire supprimé avec succès", "success")

    except Exception as e:
        db.session.rollback()
        print(f"Erreur suppression questionnaire : {e}")
        flash("❌ Une erreur est survenue lors de la suppression.", "danger")

    return redirect(url_for("admin_questionnaires"))

@role_required('admin', 'superadmin')
@app.route("/admin/questionnaires/edit/<int:questionnaire_id>", methods=["GET", "POST"])
def edit_questionnaire(questionnaire_id):
    questionnaire = Questionnaire.query.options(joinedload(Questionnaire.enseignes_associees)).get_or_404(questionnaire_id)
    missions = Mission.query.filter_by(statut='active').all()
    utilisateurs = User.query.filter(User.mission_id.in_([m.id for m in missions])).all()

    if request.method == "POST":
        questionnaire.nom = request.form.get("nom")
        questionnaire.mission_id = int(request.form.get("mission_id"))

        user_ids = request.form.getlist("utilisateurs")
        questionnaire.utilisateurs = [User.query.get(int(uid)) for uid in user_ids]

        raw_enseignes = request.form.get("enseignes", "")
        enseignes = [e.strip() for e in raw_enseignes.split(",") if e.strip()]

        QuestionnaireEnseigne.query.filter_by(questionnaire_id=questionnaire.id).delete()
        for enseigne in enseignes:
            db.session.add(QuestionnaireEnseigne(questionnaire_id=questionnaire.id, enseigne=enseigne))

        db.session.commit()
        flash("✅ Questionnaire mis à jour avec succès", "success")
        return redirect(url_for('admin_questionnaires'))
    enseignes = Enseigne.query.order_by(Enseigne.nom).all()

    return render_template(
    "formulaire_modification_questionnaire.html",
    questionnaire=questionnaire,
    missions=missions,
    utilisateurs=utilisateurs,
    toutes_enseignes=enseignes,
    csrf_token=generate_csrf()
)

@app.route('/api/secteurs_par_mission/<int:mission_id>')
def api_secteurs_par_mission(mission_id):
    print(f"📡 Appel API pour mission {mission_id}")
    secteurs = Secteur.query.filter_by(mission_id=mission_id).order_by(Secteur.nom.asc()).all()
    print(f"✅ {len(secteurs)} secteurs trouvés.")
    return jsonify([{"id": s.id, "nom": s.nom} for s in secteurs])


@role_required('admin', 'superadmin')
@app.route('/admin/utilisateurs')
def afficher_utilisateurs():
    page = request.args.get('page', 1, type=int)
    mission_id = request.args.get('mission_id')
    zone = request.args.get('zone')
    fonction = request.args.get('fonction')

    query = User.query

    if mission_id:
        query = query.filter_by(mission_id=mission_id)
    if zone:
        query = query.filter_by(zone=zone)
    if fonction:
        query = query.filter_by(fonction=fonction)

    utilisateurs = query.order_by(User.nom.asc()).paginate(page=page, per_page=30)

    missions = Mission.query.all()
    zones = [z[0] for z in db.session.query(User.zone).distinct() if z[0]]
    fonctions = [f[0] for f in db.session.query(User.fonction).distinct() if f[0]]

    return render_template(
        'admin_users.html',
        utilisateurs=utilisateurs,
        missions=missions,
        zones=zones,
        fonctions=fonctions
    )



@role_required('admin', 'superadmin')
@app.route('/admin/utilisateurs/create', methods=['GET', 'POST'])
def create_user():
    missions = Mission.query.filter_by(statut='active').all()
    secteurs = Secteur.query.all()

    if request.method == 'POST':
        try:
            validate_csrf(request.form.get('csrf_token'))
        except Exception as e:
            flash("Token CSRF invalide ou manquant", "danger")
            return redirect(url_for('create_user'))

        nom = request.form.get('nom')
        prenom = request.form.get('prenom')
        email = request.form.get('email')
        mot_de_passe = request.form.get('mot_de_passe')
        fonction = request.form.get('fonction')
        zone = request.form.get('zone')
        type_utilisateur = request.form.get('type_utilisateur')
        mission_id = request.form.get('mission_id', type=int)
        secteur_id = request.form.get('secteur_id', type=int)
        actif = request.form.get('actif') == 'on'

        user = User(
            nom=nom,
            prenom=prenom,
            email=email,
            mot_de_passe=generate_password_hash(mot_de_passe),
            fonction=fonction,
            zone=zone,
            type_utilisateur=type_utilisateur,
            mission_id=mission_id,
            secteur_id=secteur_id,
            actif=actif
        )

        db.session.add(user)
        db.session.flush()  # ⬅️ pour récupérer user.id sans commit total

        # 🔁 Lier le secteur à ce user comme chef de secteur
        if secteur_id:
            secteur = Secteur.query.get(secteur_id)
            if secteur:
                secteur.user_id = user.id

        db.session.commit()
        flash("✅ Utilisateur créé avec succès", "success")
        return redirect(url_for('afficher_utilisateurs'))

    return render_template(
        'admin_utilisateur_create.html',
        missions=missions,
        secteurs=secteurs,
        csrf_token=generate_csrf()
    )

@app.route('/admin/utilisateurs/delete/<int:user_id>')
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    flash("Utilisateur supprimé")
    return redirect(url_for('afficher_utilisateurs'))

@app.route('/admin/utilisateurs/toggle/<int:user_id>')
def toggle_user_status(user_id):
    user = User.query.get_or_404(user_id)
    user.actif = not user.actif
    db.session.commit()
    flash("Statut mis à jour")
    return redirect(url_for('afficher_utilisateurs'))

@role_required('admin', 'superadmin')
@app.route('/admin/utilisateurs/export')
def export_utilisateurs():
    mission_id = request.args.get("mission_id", type=int)

    if not mission_id:
        flash("❌ Aucune mission sélectionnée pour l’export.", "danger")
        return redirect(url_for("admin_utilisateurs"))

    # Récupérer les utilisateurs associés à cette mission via leur secteur
    utilisateurs = (
        User.query
        .join(Secteur)
        .filter(Secteur.mission_id == mission_id)
        .distinct()
        .all()
    )

    data = [{
        'Nom': u.nom,
        'Prénom': u.prenom,
        'Email': u.email,
        'Fonction': u.fonction,
        'Zone': u.zone,
        'Type': u.type_utilisateur,
        'Mission': u.mission.nom if u.mission else '',
        'Actif': 'Oui' if u.actif else 'Non'
    } for u in utilisateurs]

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Utilisateurs')

    output.seek(0)
    return send_file(output, download_name="utilisateurs_mission_{}.xlsx".format(mission_id), as_attachment=True)

@role_required('admin', 'superadmin')
@app.route('/admin/utilisateurs/<int:user_id>/edit', methods=['GET', 'POST'])
def edit_user(user_id):
    user = User.query.get_or_404(user_id)

    missions = Mission.query.filter_by(statut='active').order_by(Mission.nom.asc()).all()
    secteurs = Secteur.query.filter_by(mission_id=user.mission_id).order_by(Secteur.nom.asc()).all() if user.mission_id else []

    if request.method == 'POST':
        try:
            validate_csrf(request.form.get('csrf_token'))
        except Exception as e:
            flash("Token CSRF invalide ou manquant", "danger")
            return redirect(url_for('edit_user', user_id=user.id))

        user.nom = request.form.get('nom')
        user.prenom = request.form.get('prenom')
        user.email = request.form.get('email')
        user.fonction = request.form.get('fonction')
        user.zone = request.form.get('zone')
        user.vehicule = request.form.get('vehicule')
        user.matricule = request.form.get('matricule')
        user.contrat_type = request.form.get('contrat_type')
        heures_mensuelles_str = request.form.get('heures_mensuelles', '').strip()
        user.heures_mensuelles = int(heures_mensuelles_str) if heures_mensuelles_str else None
        user.zone = request.form.get('zone')
        user.actif = bool(int(request.form.get('actif', 1)))
        user.type_utilisateur = request.form.get('type_utilisateur')

        user.mission_id = int(request.form.get('mission_id')) if request.form.get('mission_id') else None
        user.secteur_id = int(request.form.get('secteur_id')) if request.form.get('secteur_id') else None

        # 🧠 Mise à jour du secteur pour y inscrire ce user comme chef de secteur
        if user.secteur_id:
            secteur = Secteur.query.get(user.secteur_id)
            if secteur:
                secteur.user_id = user.id

        db.session.commit()
        flash("✅ Utilisateur modifié avec succès", "success")
        return redirect(url_for('afficher_utilisateurs'))

    return render_template(
        "edit_user.html",
        user=user,
        missions=missions,
        secteurs=secteurs,
        csrf_token=generate_csrf()
    )


@app.route("/admin/missions")
def admin_missions():
    filter = request.args.get("statut")
    if filter == "active":
        missions = Mission.query.filter_by(statut="En cours").all()
    elif filter == "cloturee":
        missions = Mission.query.filter_by(statut="Clôturée").all()
    else:
        missions = Mission.query.all()

    # Pré-chargement des secteurs (convertit AppenderQuery → list)
    for mission in missions:
        mission.secteurs_list = mission.secteurs.all()

    return render_template("admin_missions.html", missions=missions, filter=filter)


@role_required('superadmin')
@app.route("/admin/missions/create", methods=["GET", "POST"])
def create_mission():
    if request.method == "POST":
        nom = request.form.get("nom")
        date_debut = request.form.get("date_debut")
        date_fin = request.form.get("date_fin")
        statut = request.form.get("statut")
        objectif = request.form.get("objectif")
        type_mission = request.form.get("type")

        if nom and date_debut and date_fin:
            mission = Mission(
                nom=nom,
                date_debut=datetime.strptime(date_debut, "%Y-%m-%d"),
                date_fin=datetime.strptime(date_fin, "%Y-%m-%d"),
                statut=statut,
                objectif=objectif,
                type=type_mission
            )
            db.session.add(mission)
            db.session.commit()

            # Création des secteurs associés à la mission
            noms_secteurs = request.form.getlist("secteurs[]")
            for nom_secteur in noms_secteurs:
                if nom_secteur.strip():
                    secteur = Secteur(nom=nom_secteur.strip(), mission=mission)
                    db.session.add(secteur)

            db.session.commit()

            flash("Mission et secteurs créés avec succès !", "success")
            return redirect(url_for("admin_missions"))

        flash("Erreur lors de la création de la mission", "danger")
        return redirect(url_for("create_mission"))

    return render_template("admin_mission_create.html")



@app.route('/admin/missions/<int:mission_id>/toggle-active', methods=['POST'])
def toggle_mission_active(mission_id):
    mission = Mission.query.get_or_404(mission_id)
    if request.form.get('active') == 'on':
        mission.statut = 'active'
    else:
        mission.statut = 'clôturée'
    db.session.commit()
    return redirect(url_for('admin_missions'))

@app.route('/admin/missions/<int:mission_id>')
def mission_detail(mission_id):
    mission = Mission.query.get_or_404(mission_id)
    utilisateurs = User.query.filter_by(mission_id=mission.id).all()
    questionnaires = Questionnaire.query.filter_by(mission_id=mission.id).all()
    secteurs = mission.secteurs.all()  # Pour afficher les secteurs liés

    return render_template(
        'admin_mission_detail.html',
        mission=mission,
        utilisateurs=utilisateurs,
        questionnaires=questionnaires,
        secteurs=secteurs
    )

@app.route('/admin/missions/<int:mission_id>/edit', methods=['GET', 'POST'])
def edit_mission(mission_id):
    mission = Mission.query.get_or_404(mission_id)

    if request.method == 'POST':
        mission.nom = request.form['nom']
        mission.date_debut = datetime.strptime(request.form['date_debut'], '%Y-%m-%d').date()
        mission.date_fin = datetime.strptime(request.form['date_fin'], '%Y-%m-%d').date()
        mission.statut = request.form['statut']
        mission.objectif = request.form['objectif']
        mission.type = request.form['type']

        # 🔄 Mise à jour des secteurs
        secteurs_noms = request.form.getlist('secteurs[]')

        # Supprimer les anciens secteurs liés à cette mission
        Secteur.query.filter_by(mission_id=mission.id).delete()

        # Ajouter les nouveaux
        for nom_secteur in secteurs_noms:
            if nom_secteur.strip():
                nouveau_secteur = Secteur(nom=nom_secteur.strip(), mission_id=mission.id)
                db.session.add(nouveau_secteur)

        db.session.commit()
        flash("Mission modifiée avec succès !", "success")
        return redirect(url_for('admin_missions'))

    # 👇 Ajout : liste des secteurs existants pour pré-remplir le formulaire
    secteurs = Secteur.query.filter_by(mission_id=mission.id).all()

    return render_template('admin_mission_edit.html', mission=mission, secteurs=secteurs)

@app.route('/admin/missions/<int:mission_id>/archive', methods=['POST'])
def archive_mission(mission_id):
    mission = Mission.query.get_or_404(mission_id)
    mission.statut = 'Clôturée'
    db.session.commit()
    flash("Mission archiviée avec succès !", "info")
    return redirect(url_for('admin_missions'))

@app.route('/admin/missions/<int:mission_id>/assign-users', methods=['GET', 'POST'])
def assign_users_to_mission(mission_id):
    mission = Mission.query.get_or_404(mission_id)

    if request.method == 'POST':
        utilisateurs_data = request.form.getlist('utilisateurs[]')
        for u_data in utilisateurs_data:
            nom, prenom, email, fonction, zone = u_data.split('|')
            existing_user = User.query.filter_by(email=email).first()
            if not existing_user:
                new_user = User(
                    nom=nom,
                    prenom=prenom,
                    email=email,
                    fonction=fonction,
                    zone=zone,
                    type_utilisateur="terrain",
                    mission_id=mission.id,
                    mot_de_passe=secrets.token_hex(8)
                )
                db.session.add(new_user)
        db.session.commit()
        flash("Utilisateurs assignés à la mission avec succès ✅", "success")
        return redirect(url_for('mission_detail', mission_id=mission.id))

    return render_template('admin_mission_assign_users.html', mission=mission)

@app.route('/admin/creation-rapide', methods=['GET', 'POST'])
def creation_rapide():
    if request.method == 'POST':
        nom = request.form.get('nom')
        date_debut = request.form.get('date_debut')
        date_fin = request.form.get('date_fin')
        statut = request.form.get('statut')
        objectif = request.form.get('objectif')
        type_mission = request.form.get('type')

        if nom:
            mission = Mission(
                nom=nom,
                date_debut=datetime.strptime(date_debut, '%Y-%m-%d') if date_debut else None,
                date_fin=datetime.strptime(date_fin, '%Y-%m-%d') if date_fin else None,
                statut=statut or "Préparation",
                objectif=objectif,
                type=type_mission
            )
            db.session.add(mission)
            db.session.commit()
            return redirect(url_for('assign_users_to_mission', mission_id=mission.id))
        else:
            flash("Merci de renseigner au moins le nom de la mission.", "warning")

    return render_template('admin_creation_rapide.html')

# ➕ Afficher les enseignes avec leur logo pour une mission
@app.route('/admin/missions/<int:mission_id>/enseignes', methods=['GET', 'POST'])
def admin_mission_enseignes(mission_id):
    mission = Mission.query.get_or_404(mission_id)
    toutes_enseignes = Enseigne.query.all()
    enseignes_activees = {em.enseigne_id for em in mission.enseignes_missions}
    return render_template(
        'admin_mission_enseignes.html',
        mission=mission,
        toutes_enseignes=toutes_enseignes,
        enseignes_activees=enseignes_activees
    )

# 🔁 Activer ou désactiver une enseigne pour une mission
@app.route('/admin/missions/<int:mission_id>/enseignes/<int:enseigne_id>/<action>')
def toggle_enseigne_mission(mission_id, enseigne_id, action):
    association = db.session.query(EnseigneMission).filter_by(
        mission_id=mission_id,
        enseigne_id=enseigne_id
    ).first()

    if action == 'activer' and not association:
        nouvelle_assoc = EnseigneMission(mission_id=mission_id, enseigne_id=enseigne_id)
        db.session.add(nouvelle_assoc)
        db.session.commit()
        flash("✅ Enseigne activée pour cette mission", "success")

    elif action == 'desactiver' and association:
        db.session.delete(association)
        db.session.commit()
        flash("⚠️ Enseigne désactivée pour cette mission", "warning")

    return redirect(url_for('admin_mission_enseignes', mission_id=mission_id))

# 👁️ Afficher les centrales d'une enseigne dans une mission
@app.route('/admin/missions/<int:mission_id>/enseignes/<int:enseigne_id>/centrales')
def mission_enseigne_centrales(mission_id, enseigne_id):
    mission = Mission.query.get_or_404(mission_id)
    enseigne = Enseigne.query.get_or_404(enseigne_id)
    centrales = Centrale.query.filter_by(enseigne_id=enseigne.id).all()

    return render_template(
        'admin_mission_enseigne_centrales.html',
        mission=mission,
        enseigne=enseigne,
        centrales=centrales
    )




# ➕ Ajouter une centrale à une enseigne pour une mission donnée
@role_required('admin', 'superadmin')
@app.route('/admin/missions/<int:mission_id>/enseignes/<int:enseigne_id>/centrales/create', methods=['GET', 'POST'])
def create_centrale_for_enseigne_v2(mission_id, enseigne_id):
    mission = Mission.query.get_or_404(mission_id)
    enseigne = Enseigne.query.get_or_404(enseigne_id)

    if request.method == 'POST':
        nom = request.form.get('nom')
        type_centrale = request.form.get('type_centrale')

        # 🔍 Vérifie si une centrale avec ce nom existe déjà
        if Centrale.query.filter_by(nom=nom).first():
            flash(f"❌ Une centrale avec le nom « {nom} » existe déjà. Choisis un autre nom.", "danger")
            return redirect(url_for('create_centrale_for_enseigne_v2', mission_id=mission.id, enseigne_id=enseigne.id))

        if nom:
            nouvelle_centrale = Centrale(
                nom=nom,
                type_centrale=type_centrale,
                enseigne_id=enseigne.id
            )
            db.session.add(nouvelle_centrale)
            db.session.commit()
            flash(f"✅ Centrale « {nom} » ajoutée avec succès à l'enseigne {enseigne.nom}", "success")
            return redirect(url_for('mission_enseigne_centrales', mission_id=mission.id, enseigne_id=enseigne.id))

    return render_template(
        'formulaire_creation_centrale.html',
        mission=mission,
        enseigne=enseigne,
        csrf_token=generate_csrf()
    )



# ➜ Liste des produits avec filtre mission
# admin_produits (corrigé)
@role_required('admin', 'superadmin')
@app.route('/admin/produits')
def admin_produits():
    mission_id = request.args.get('mission_id', type=int)

    # 🧠 Correction : utiliser statut='active' et pas active=True
    missions = Mission.query.filter_by(statut='active').all()

    if mission_id:
        produits = Produit.query.join(Produit.missions).filter(Mission.id == mission_id).all()
    else:
        produits = Produit.query.all()

    return render_template(
        'admin_produits.html',
        produits=produits,
        missions=missions,
        mission_id=mission_id
    )





# ➕ Créer un produit
@role_required('admin', 'superadmin')
@app.route('/admin/produits/create', methods=['GET', 'POST'])
def create_produit():
    missions = Mission.query.filter_by(statut='active').all()

    if request.method == 'POST':
        libelle = request.form.get('libelle')
        code_ean = request.form.get('code_ean')
        code_interne = request.form.get('code_interne')
        marque = request.form.get('marque')
        famille = request.form.get('famille')
        gamme = request.form.get('gamme')
        typologie = request.form.get('typologie')
        mission_ids = request.form.getlist('missions')

        missions_associees = Mission.query.filter(Mission.id.in_(mission_ids)).all()

        photo_file = request.files.get('photo')
        photo_filename = None
        if photo_file and photo_file.filename != '':
            photo_filename = secrets.token_hex(8) + "_" + photo_file.filename
            photo_file.save(os.path.join(app.config['UPLOAD_FOLDER'], photo_filename))

        produit = Produit(
            libelle=libelle,
            code_ean=code_ean,
            code_interne=code_interne,
            marque=marque,
            famille=famille,
            gamme=gamme,
            typologie=typologie,
            photo=photo_filename,
            missions=missions_associees
        )

        db.session.add(produit)
        db.session.commit()
        flash("✅ Produit créé avec succès", "success")
        return redirect(url_for('admin_produits'))

    return render_template('formulaire_creation_produit.html', missions=missions)

# 🔄 Modifier un produit
@role_required('admin', 'superadmin')
@app.route('/admin/produits/<int:produit_id>/edit', methods=['GET', 'POST'])
def edit_produit(produit_id):
    produit = Produit.query.get_or_404(produit_id)
    missions = Mission.query.filter_by(statut='active').all()

    if request.method == 'POST':
        produit.libelle = request.form.get('libelle')
        produit.code_ean = request.form.get('code_ean')
        produit.code_interne = request.form.get('code_interne')
        produit.marque = request.form.get('marque')
        produit.famille = request.form.get('famille')
        produit.gamme = request.form.get('gamme')
        produit.typologie = request.form.get('typologie')

        mission_ids = request.form.getlist('missions')
        missions_associees = Mission.query.filter(Mission.id.in_(mission_ids)).all()
        produit.missions = missions_associees

        photo_file = request.files.get('photo')
        if photo_file and photo_file.filename != '':
            photo_filename = secrets.token_hex(8) + "_" + photo_file.filename
            photo_file.save(os.path.join(app.config['UPLOAD_FOLDER'], photo_filename))
            produit.photo = photo_filename

        db.session.commit()
        flash("✅ Produit modifié avec succès", "success")
        return redirect(url_for('admin_produits'))

    return render_template('formulaire_modification_produit.html', produit=produit, missions=missions)

# 🗑️ Supprimer un produit
@role_required('admin', 'superadmin')
@app.route('/admin/produits/<int:produit_id>/delete', methods=['POST'])
def delete_produit(produit_id):
    produit = Produit.query.get_or_404(produit_id)
    db.session.delete(produit)
    db.session.commit()
    flash("🗑️ Produit supprimé avec succès", "warning")
    return redirect(url_for('admin_produits'))



# 🎯 Affectation produits ↔ centrales avec strate
@role_required('admin', 'superadmin')
@app.route('/admin/centrales/<int:centrale_id>/produits', methods=['GET', 'POST'])
def affecter_produits_centrale(centrale_id):
    centrale = Centrale.query.get_or_404(centrale_id)
    mission_id = request.args.get('mission_id', type=int)

    # ✅ Correction : Charger uniquement les missions actives
    missions = Mission.query.filter_by(statut='active').all()

    # Produits selon la mission sélectionnée
    if mission_id:
        produits = Produit.query.join(Produit.missions).filter(Mission.id == mission_id).all()
    else:
        produits = Produit.query.all()

    # Récupération de l'enseigne
    enseigne = centrale.enseigne
    enseigne_nom = enseigne.nom.lower() if enseigne else ""

    # Logique de strates dynamiques selon l’enseigne
    strates = []
    if any(x in enseigne_nom for x in ["carrefour"]):
        strates = [f"T{i}" for i in range(1, 8)]
    elif any(x in enseigne_nom for x in ["auchan"]):
        strates = [f"A{i}" for i in range(1, 10)]
    elif any(x in enseigne_nom for x in ["leclerc", "u-", "hyper u", "super u", "u express", "utile", "intermarché"]):
        strates = [f"ELTS{i}" for i in range(1, 10)]
    elif "franprix" in enseigne_nom:
        strates = [str(i) for i in range(1, 5)]
    elif "pharmacie" in enseigne_nom:
        strates = ["Présent"]
    else:
        strates = []

    # Ajout systématique
    strates += ["Picking", "Non attribué"]

    # 🔄 Enregistrement des affectations
    if request.method == 'POST':
        for produit in produits:
            strate = request.form.get(f"strate_{produit.id}")
            if strate:
                lien = ProduitCentrale.query.filter_by(produit_id=produit.id, centrale_id=centrale.id).first()
                if lien:
                    lien.strate = strate
                else:
                    new_lien = ProduitCentrale(
                        produit_id=produit.id,
                        centrale_id=centrale.id,
                        strate=strate
                    )
                    db.session.add(new_lien)
        db.session.commit()
        flash("✅ Affectation mise à jour avec succès", "success")
        return redirect(url_for('affecter_produits_centrale', centrale_id=centrale.id, mission_id=mission_id))

    affectations = ProduitCentrale.query.filter_by(centrale_id=centrale.id).all()
    affectation_dict = {a.produit_id: a.strate for a in affectations}

    return render_template(
        'admin_affecter_produits.html',
        centrale=centrale,
        produits=produits,
        affectation_dict=affectation_dict,
        missions=missions,
        mission_id=mission_id,
        strates=strates,
        csrf_token=(generate_csrf() if 'generate_csrf' in globals() else None)
    )


# ➕ Afficher toutes les associations Produit ↔ Centrale ↔ Strate
@role_required('admin', 'superadmin')
@app.route('/admin/associations')
def afficher_associations():
    associations = ProduitCentrale.query.all()
    return render_template('admin_associations.html', associations=associations)

# ➕ Créer une association manuelle
@role_required('admin', 'superadmin')
@app.route('/admin/associations/create', methods=['GET', 'POST'])
def creer_association():
    produits = Produit.query.all()
    centrales = Centrale.query.all()

    if request.method == 'POST':
        produit_id = request.form.get('produit_id')
        centrale_id = request.form.get('centrale_id')
        strate = request.form.get('strate')

        association = ProduitCentrale(
            produit_id=produit_id,
            centrale_id=centrale_id,
            strate=strate
        )
        db.session.add(association)
        db.session.commit()
        flash("✅ Association créée avec succès", "success")
        return redirect(url_for('afficher_associations'))

    return render_template('admin_association_form.html', produits=produits, centrales=centrales)

# ✏️ Modifier une association
@role_required('admin', 'superadmin')
@app.route('/admin/associations/edit/<int:association_id>', methods=['GET', 'POST'])
def modifier_association(association_id):
    association = ProduitCentrale.query.get_or_404(association_id)
    produits = Produit.query.all()
    centrales = Centrale.query.all()

    if request.method == 'POST':
        association.produit_id = request.form.get('produit_id')
        association.centrale_id = request.form.get('centrale_id')
        association.strate = request.form.get('strate')
        db.session.commit()
        flash("✏️ Association modifiée avec succès", "info")
        return redirect(url_for('afficher_associations'))

    return render_template('form_association.html', association=association, produits=produits, centrales=centrales)

# 🗑️ Supprimer une association
@role_required('admin', 'superadmin')
@app.route('/admin/associations/delete/<int:association_id>', methods=['GET'])
def supprimer_association(association_id):
    association = ProduitCentrale.query.get_or_404(association_id)
    db.session.delete(association)
    db.session.commit()
    flash("🗑️ Association supprimée", "warning")
    return redirect(url_for('afficher_associations'))

# 🔁 Injection du premier questionnaire (utile pour le menu haut)
@app.context_processor
def inject_first_questionnaire():
    return {"first_questionnaire": Questionnaire.query.first()}


@app.route("/template-association")
def telecharger_template_association():
    return send_file("static/template_import_enseigne_centrale.xlsx", as_attachment=True)


@app.route('/import_enseigne_centrale', methods=['POST'])
def import_enseigne_centrale():
    from werkzeug.utils import secure_filename
    from sqlalchemy import func
    import pandas as pd

    fichier = request.files.get('fichier_excel')
    if not fichier:
        flash("❌ Aucun fichier reçu.", "danger")
        return redirect(url_for('admin_assortiments_unifie'))

    try:
        df = pd.read_excel(fichier)
        df.columns = [c.strip().lower() for c in df.columns]
        print("🧾 Colonnes après nettoyage :", df.columns.tolist())
    except Exception as e:
        flash(f"❌ Erreur lors de la lecture du fichier Excel : {e}", "danger")
        return redirect(url_for('admin_assortiments_unifie'))

    # Vérification des colonnes obligatoires
    if 'enseigne' not in df.columns or 'centrale' not in df.columns:
        flash("❌ Le fichier doit contenir les colonnes 'enseigne' et 'centrale'", "danger")
        return redirect(url_for('admin_assortiments_unifie'))

    # Statistiques d'import
    ajout_enseigne = 0
    ajout_centrale = 0
    ajout_lien = 0
    deja_vu = set()

    for _, row in df.iterrows():
        nom_enseigne = str(row['enseigne']).strip().title()
        nom_centrale = str(row['centrale']).strip().title()

        if not nom_enseigne or not nom_centrale:
            continue

        # 🔍 Récupère ou crée l'enseigne
        enseigne = Enseigne.query.filter(func.lower(Enseigne.nom) == nom_enseigne.lower()).first()
        if not enseigne:
            enseigne = Enseigne(nom=nom_enseigne)
            db.session.add(enseigne)
            db.session.flush()
            ajout_enseigne += 1

        # 🔍 Récupère ou crée la centrale
        centrale = Centrale.query.filter(func.lower(Centrale.nom) == nom_centrale.lower()).first()
        if not centrale:
            centrale = Centrale(
                nom=nom_centrale,
                type_centrale="Régionale",
                enseigne_id=enseigne.id
            )
            db.session.add(centrale)
            db.session.flush()
            ajout_centrale += 1

        # ⚠️ Évite les doublons d'association
        cle = (enseigne.id, centrale.id)
        if cle in deja_vu:
            continue
        deja_vu.add(cle)

        if centrale not in enseigne.centrales:
            enseigne.centrales.append(centrale)
            ajout_lien += 1

    db.session.commit()
    flash(
        f"✅ {ajout_lien} associations créées · "
        f"{ajout_enseigne} enseignes créées · "
        f"{ajout_centrale} centrales créées · "
        f"{len(df) - ajout_lien} doublons ignorés",
        "success"
    )
    return redirect(url_for('admin_assortiments_unifie'))


@role_required('superadmin')
@app.route('/admin/assortiments')
@app.route('/admin/assortiments/<int:mission_id>')
def admin_assortiments_unifie(mission_id=None):
    toutes_les_enseignes = Enseigne.query.all()
    toutes_les_missions = Mission.query.filter_by(statut='active').all()
    filtrer = request.args.get('filtrer', 'oui') == 'oui'

    # Ajoute à chaque enseigne ses missions associées
    for enseigne in toutes_les_enseignes:
        missions_associees = [
            em.mission_id for em in enseigne.missions_associees
            if em.mission
        ]
        enseigne.missions_ids = missions_associees

    # 💡 Voici le point crucial :
    # on sépare bien la variable passée au template ("enseignes")
    enseignes = toutes_les_enseignes
    if filtrer and mission_id is None:
        enseignes = [e for e in toutes_les_enseignes if e.missions_ids]

    return render_template(
        'admin_assortiments.html',
        enseignes=enseignes,
        toutes_les_enseignes=toutes_les_enseignes,
        toutes_les_missions=toutes_les_missions,
        mission_id=mission_id,
        filtrer=filtrer,
        csrf_token=generate_csrf()
    )





@role_required('admin', 'superadmin')
@app.route('/admin/enseignes/<int:enseigne_id>/missions/<int:mission_id>/retirer', methods=['POST'])
def retirer_enseigne_mission(enseigne_id, mission_id):
    lien = EnseigneMission.query.filter_by(enseigne_id=enseigne_id, mission_id=mission_id).first()
    if lien:
        db.session.delete(lien)
        db.session.commit()
        flash("L’enseigne a été retirée de la mission ✅", "warning")
    return redirect(url_for('admin_assortiments_par_mission', mission_id=mission_id))

@role_required('admin', 'superadmin')
@app.route('/admin/enseignes/<int:enseigne_id>/supprimer', methods=['POST'])
def supprimer_enseigne_definitive(enseigne_id):
    from flask_wtf.csrf import validate_csrf
    try:
        validate_csrf(request.form.get("csrf_token"))
    except:
        flash("Erreur CSRF – veuillez recharger la page.", "danger")
        return redirect(request.referrer or url_for('admin_assortiments_super_admin'))

    enseigne = Enseigne.query.get_or_404(enseigne_id)

    with db.session.no_autoflush:
        for c in enseigne.centrales:
            if c.produits_lies:  # ✅ Relation fiable maintenant
                flash(f"❌ La centrale « {c.nom} » est utilisée par des produits. Suppression bloquée.", "danger")
                return redirect(request.referrer or url_for('admin_assortiments_super_admin'))

        for c in enseigne.centrales:
            db.session.delete(c)

        db.session.delete(enseigne)
        db.session.commit()

    flash("✅ Enseigne et centrales supprimées définitivement", "success")
    return redirect(url_for("admin_assortiments_super_admin"))

 

@role_required('superadmin')
@app.route('/admin/assortiments/enseignes/<int:enseigne_id>/centrales')
def assortiment_centrales_par_enseigne(enseigne_id):
    enseigne = Enseigne.query.get_or_404(enseigne_id)
    centrales = Centrale.query.filter_by(enseigne_id=enseigne.id).all()
    return render_template('assortiment_centrales_par_enseigne.html', enseigne=enseigne, centrales=centrales)

@role_required('admin', 'superadmin')
@role_required('admin', 'superadmin')
@app.route('/admin/enseignes')  # 🔐 sécurisé
def admin_enseignes():
    enseignes = Enseigne.query.all()
    return render_template('admin_enseignes.html', enseignes=enseignes)

@role_required('admin', 'superadmin')
@app.route("/admin/enseignes/<int:enseigne_id>/delete-confirm", methods=["GET"])
def formulaire_suppression_enseigne(enseigne_id):
    enseigne = Enseigne.query.get_or_404(enseigne_id)
    return render_template("formulaire_suppression_enseigne.html", enseigne=enseigne, csrf_token=generate_csrf())


@role_required('admin', 'superadmin')
@app.route('/admin/enseignes/create', methods=['GET', 'POST'])
def create_enseigne():
    missions = Mission.query.all()

    if request.method == 'POST':
        try:
            validate_csrf(request.form.get('csrf_token'))
        except CSRFError as e:
            flash("Le token CSRF est invalide ou manquant.", "danger")
            return redirect(url_for('create_enseigne'))

        nom = request.form['nom']
        categorie = request.form['categorie']
        centrale_principale = request.form.get('centrale')
        mission_id = request.form['mission_id']
        logo_fichier = request.files.get('logo')
        logo_url = request.form.get('logo_url')

        # 🛑 Vérifie si une enseigne du même nom existe déjà (insensible à la casse)
        existe = Enseigne.query.filter(db.func.lower(Enseigne.nom) == nom.lower()).first()
        if existe:
            flash(f"L'enseigne « {nom} » existe déjà. Choisis un autre nom.", "danger")
            return redirect(url_for('create_enseigne'))

        # Gestion du logo : soit uploadé, soit depuis une URL
        if logo_fichier and logo_fichier.filename != '':
            logo_filename = secure_filename(logo_fichier.filename)
            chemin = os.path.join(app.config['UPLOAD_FOLDER'], logo_filename)
            logo_fichier.save(chemin)
            logo_final = logo_filename
        elif logo_url:
            logo_final = logo_url
        else:
            logo_final = None

        # Création de l'enseigne
        nouvelle_enseigne = Enseigne(
            nom=nom,
            categorie=categorie,
            centrale_principale=centrale_principale,
            logo=logo_final
        )
        db.session.add(nouvelle_enseigne)
        db.session.commit()

        # Lien avec la mission
        association = EnseigneMission(
            enseigne_id=nouvelle_enseigne.id,
            mission_id=mission_id
        )
        db.session.add(association)
        db.session.commit()

        flash("Enseigne créée avec succès ✅", "success")
        return redirect(url_for('admin_assortiments_unifie'))


    return render_template('formulaire_creation_enseigne.html', missions=missions, csrf_token=generate_csrf())


@app.route('/api/recherche-logo')  # ✅ À GARDER
def recherche_logo():
    terme = request.args.get('terme', '')
    if not terme:
        return jsonify({'images': []})

    headers = {
        "User-Agent": "Mozilla/5.0"
    }
    url = f"https://www.google.com/search?tbm=isch&q=logo+{terme}"
    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        images = []
        for img in soup.find_all("img")[1:10]:
            src = img.get("src")
            if src:
                images.append(src)
        return jsonify({'images': images})
    except Exception as e:
        print(f"Erreur dans la recherche d'image : {e}")
        return jsonify({'images': []})



@role_required('admin', 'superadmin')
@app.route('/admin/enseignes/<int:enseigne_id>/modifier', methods=['GET', 'POST'])
def modifier_enseigne(enseigne_id):
    enseigne = Enseigne.query.get_or_404(enseigne_id)
    missions = Mission.query.all()

    if request.method == 'POST':
        enseigne.nom = request.form['nom']
        enseigne.categorie = request.form['categorie']
        enseigne.centrale_principale = request.form.get('centrale')

        logo_fichier = request.files.get('logo')
        logo_url = request.form.get('logo_url')

        ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

        def extension_autorisee(nom_fichier):
            return '.' in nom_fichier and nom_fichier.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

        # 🎯 1. Logo local uploadé
        if logo_fichier and logo_fichier.filename != '':
            if extension_autorisee(logo_fichier.filename):
                filename = secure_filename(logo_fichier.filename)
                logo_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                logo_fichier.save(logo_path)
                enseigne.logo = filename
            else:
                flash("❌ Format de fichier non autorisé (PNG, JPG, JPEG)", "danger")
                return redirect(url_for('modifier_enseigne', enseigne_id=enseigne.id))

        # 🎯 2. Logo distant depuis URL
        elif logo_url:
            try:
                import requests
                from urllib.parse import urlparse
                from PIL import Image
                from io import BytesIO
                from datetime import datetime

                response = requests.get(logo_url)
                if response.status_code == 200:
                    parsed_url = urlparse(logo_url)
                    extension = os.path.splitext(parsed_url.path)[1].lower().lstrip('.')
                    if extension in ALLOWED_EXTENSIONS:
                        filename = secure_filename(f"{enseigne.nom}_{int(datetime.utcnow().timestamp())}.{extension}")
                        logo_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                        image = Image.open(BytesIO(response.content))
                        image.save(logo_path)
                        enseigne.logo = filename
                    else:
                        flash("❌ Format d'image distant non pris en charge (PNG, JPG, JPEG)", "danger")
                        return redirect(url_for('modifier_enseigne', enseigne_id=enseigne.id))
                else:
                    flash("❌ Impossible de télécharger le logo distant.", "danger")
                    return redirect(url_for('modifier_enseigne', enseigne_id=enseigne.id))
            except Exception as e:
                flash(f"❌ Erreur lors du traitement du logo distant : {str(e)}", "danger")
                return redirect(url_for('modifier_enseigne', enseigne_id=enseigne.id))

        db.session.commit()
        flash("Enseigne modifiée avec succès ✅", "success")
        return redirect(url_for('admin_assortiments_unifie'))


    return render_template('formulaire_modification_enseigne.html', enseigne=enseigne, missions=missions, csrf_token=generate_csrf())


@role_required('admin', 'superadmin')
@app.route('/admin/enseignes/<int:enseigne_id>/delete')
def supprimer_enseigne(enseigne_id):
    enseigne = Enseigne.query.get_or_404(enseigne_id)

    # Supprime les éventuelles liaisons dans la table pivot (si elle existe)
    if hasattr(enseigne, "missions_associees"):
        for lien in enseigne.missions_associees:
            db.session.delete(lien)

    # Supprime le fichier logo si présent (optionnel)
    if enseigne.logo and os.path.isfile(os.path.join(app.config['UPLOAD_FOLDER'], enseigne.logo)):
        os.remove(os.path.join(app.config['UPLOAD_FOLDER'], enseigne.logo))

    # Supprime l’enseigne
    db.session.delete(enseigne)
    db.session.commit()

    flash(f"L'enseigne « {enseigne.nom} » a bien été supprimée ✅", "success")
    return redirect(url_for('admin_assortiments_unifie'))



@role_required('admin', 'superadmin')
@app.route('/admin/enseignes/associer', methods=['POST'])
def associer_enseigne_a_mission():
    enseigne_id = request.form.get("enseigne_id")
    mission_ids = request.form.getlist("missions")
    existants = EnseigneMission.query.filter_by(enseigne_id=enseigne_id).all()

    # Supprimer tous les liens existants
    for e in existants:
        db.session.delete(e)

    # Ajouter les nouveaux liens
    for mid in mission_ids:
        lien = EnseigneMission(enseigne_id=enseigne_id, mission_id=mid, active=True)
        db.session.add(lien)

    db.session.commit()
    flash("Missions associées à l’enseigne mises à jour", "success")
    return redirect(request.referrer or url_for('admin_assortiments'))


@role_required('admin', 'superadmin')
@app.route('/admin/enseignes/<int:enseigne_id>/associer-missions', methods=['POST'])
def associer_enseigne_a_missions_superadmin(enseigne_id):
    if request.method == "POST":
        # Sécurisation : récupérer l'enseigne depuis le paramètre d'URL
        enseigne = Enseigne.query.get_or_404(enseigne_id)

        # Récupérer uniquement les missions actives
        missions_actives_ids = [m.id for m in Mission.query.filter_by(active=True).all()]

        # Missions cochées dans le formulaire
        missions_ids_reçues = request.form.getlist("missions")

        # Ne conserver que celles qui sont encore actives
        missions_ids_valides = [int(m) for m in missions_ids_reçues if int(m) in missions_actives_ids]

        # Supprimer anciennes associations
        anciennes = EnseigneMission.query.filter_by(enseigne_id=enseigne.id).all()
        for assoc in anciennes:
            db.session.delete(assoc)

        # Ajouter les nouvelles associations
        for mission_id in missions_ids_valides:
            db.session.add(EnseigneMission(enseigne_id=enseigne.id, mission_id=mission_id, active=True))

        db.session.commit()
        flash("✅ Associations mises à jour.", "success")
        return redirect(request.referrer or url_for('admin_assortiments_super_admin'))

    flash("❌ Erreur lors de la soumission du formulaire", "danger")
    return redirect(url_for('admin_assortiments_unifie'))


@role_required('admin', 'superadmin')
@app.route('/admin/missions/<int:mission_id>/enseignes/<int:enseigne_id>/centrales/create', methods=['GET', 'POST'])
def create_centrale_for_enseigne(mission_id, enseigne_id):
    mission = Mission.query.get_or_404(mission_id)
    enseigne = Enseigne.query.get_or_404(enseigne_id)

    if request.method == 'POST':
        nom = request.form.get('nom')
        type_centrale = request.form.get('type_centrale')

        # Vérification d’unicité du nom
        if Centrale.query.filter_by(nom=nom).first():
            flash(f"❌ La centrale « {nom} » existe déjà. Choisis un autre nom.", "danger")
            return redirect(url_for('create_centrale_for_enseigne', mission_id=mission.id, enseigne_id=enseigne.id))

        nouvelle_centrale = Centrale(
            nom=nom,
            type_centrale=type_centrale,
            enseigne_id=enseigne.id
        )
        db.session.add(nouvelle_centrale)
        db.session.commit()
        flash(f"✅ Centrale « {nom} » ajoutée avec succès", "success")
        return redirect(url_for('mission_enseigne_centrales', mission_id=mission.id, enseigne_id=enseigne.id))

    return render_template(
        'admin_mission_centrale_create.html',
        mission=mission,
        enseigne=enseigne,
        csrf_token=csrf_token  # si ton template en a besoin
    )


@role_required('admin', 'superadmin')
@app.route('/admin/centrales/<int:centrale_id>/edit', methods=['GET', 'POST'])
def edit_centrale(centrale_id):
    centrale = Centrale.query.get_or_404(centrale_id)
    if request.method == 'POST':
        centrale.nom = request.form['nom']
        centrale.type_centrale = request.form['type_centrale']
        db.session.commit()
        flash("✅ Centrale modifiée avec succès", "success")
        return redirect(url_for('mission_enseigne_centrales', mission_id=centrale.enseigne.missions_associees[0].mission_id, enseigne_id=centrale.enseigne_id))

    return render_template('formulaire_modification_centrale.html', centrale=centrale)

@role_required('admin', 'superadmin')
@app.route('/admin/centrales/<int:centrale_id>/delete', methods=['POST'])
def delete_centrale(centrale_id):
    centrale = Centrale.query.get_or_404(centrale_id)

    # On récupère une mission associée à l'enseigne pour redirection
    mission_id = None
    if centrale.enseigne and centrale.enseigne.missions_associees:
        mission_id = centrale.enseigne.missions_associees[0].mission_id

    enseigne_id = centrale.enseigne_id
    db.session.delete(centrale)
    db.session.commit()
    flash("🗑️ Centrale supprimée avec succès", "success")

    if mission_id:
        return redirect(url_for('mission_enseigne_centrales', mission_id=mission_id, enseigne_id=enseigne_id))
    return redirect(url_for('admin_assortiments_unifie'))


# ✅ Ajout automatique du chef de secteur lors de l’import et la modification d’un magasin

from flask import flash, redirect, render_template, request, url_for
from werkzeug.utils import secure_filename
import pandas as pd
from sqlalchemy import func
from flask_wtf.csrf import validate_csrf, CSRFError
from flask_login import current_user
from app import app, db
from models import Magasin, Mission, Secteur, EnseigneCentrale
import os
import unicodedata
import requests
import time
from config_strates import get_strates_for_enseigne  # à placer tout en haut du fichier
from io import StringIO
import csv
from datetime import datetime

from io import StringIO, BytesIO
from flask import send_file

@app.route("/admin/magasins/import", methods=["GET", "POST"])
@role_required("admin", "superadmin")
def import_magasins():
    missions = Mission.query.filter_by(statut='active').all()
    mission_id = request.args.get("mission_id")

    def safe_str(val, max_len=None):
        if pd.isna(val) or val is None:
            return None
        val = str(val).strip()
        return val[:max_len] if max_len else val

    def normalize(val):
        if not val:
            return None
        val = str(val)
        val = unicodedata.normalize('NFKC', val)
        val = val.replace('\u00A0', ' ')
        return val.strip().lower()

    def geocode_adresse(adresse, api_key):
        try:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {"address": adresse, "key": api_key}
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                results = response.json().get("results")
                if results:
                    location = results[0]["geometry"]["location"]
                    return location["lat"], location["lng"]
        except Exception as e:
            print(f"Erreur géocodage : {e}")
        return None, None

    if request.method == "POST":
        try:
            validate_csrf(request.form.get("csrf_token"))
        except CSRFError:
            flash("Token CSRF invalide ou manquant", "danger")
            return redirect(request.url)

        mission_id = request.form.get("mission_id") or mission_id
        fichier = request.files.get("fichier")

        if not fichier or not mission_id:
            flash("Veuillez fournir un fichier et sélectionner une mission.", "danger")
            return redirect(request.url)

        try:
            df = pd.read_excel(fichier)
            df.rename(columns=lambda c: c.strip().lower(), inplace=True)

            column_mapping = {
                "nom usage (obligatoire si renseigné)": "nom",
                "nom_enseigne (obligatoire)": "nom_enseigne",
                "adresse_magasin (obligatoire)": "adresse",
                "ville_magasin (obligatoire)": "ville",
                "codepostal_magasin (obligatoire)": "code_postal",
                "statut_magasin (obligatoire - actif/inactif)": "statut_magasin",
                "vip_magasin (facultatif - oui/non)": "vip",
                "code ttdlinks (facultatif)": "code_tdlink",
                "nom_centrale (facultatif)": "centrale",
                "fax_magasin (facultatif)": "fax",
                "tel_magasin (facultatif)": "telephone",
                "telcdr (facultatif)": "tel_contact",
                "emailcdr (facultatif)": "email_contact",
                "nomcdr (facultatif)": "nom_contact",
                "secteur (obligatoire si fourni)": "secteur",
                "strate_magasin (facultatif)": "strate_magasin",
                "rythme_magasin": "rythme_magasin",
                "surface_magasin": "surface",
            }
            df.rename(columns=column_mapping, inplace=True)

            # Vérification colonnes obligatoires
            for col in ["nom_enseigne", "adresse", "ville", "code_postal", "statut_magasin"]:
                if col not in df.columns:
                    flash(f"Colonne obligatoire manquante : {col}", "danger")
                    return redirect(request.url)

            if "strate_magasin" not in df.columns:
                df["strate_magasin"] = None
            if "surface" not in df.columns:
                df["surface"] = None

            api_key = app.config.get("GOOGLE_MAPS_API_KEY")
            if not api_key:
                raise ValueError("❌ Clé API Google Maps manquante dans .env")

            erreurs, lignes_valides = [], []

            for i, row in df.iterrows():
                try:
                    nom_enseigne_norm = normalize(row.get("nom_enseigne"))
                    nom_centrale_norm = normalize(row.get("centrale"))
                    strate_magasin = safe_str(row.get("strate_magasin"))

                    if nom_centrale_norm:
                        enseigne_centrale = (
                            db.session.query(EnseigneCentrale)
                            .join(Centrale, Centrale.id == EnseigneCentrale.centrale_id)
                            .filter(func.lower(EnseigneCentrale.enseigne) == nom_enseigne_norm)
                            .filter(func.lower(Centrale.nom) == nom_centrale_norm)
                            .first()
                        )
                        if not enseigne_centrale:
                            # Ajout automatique de la liaison
                            centrale_obj = Centrale.query.filter(func.lower(Centrale.nom) == nom_centrale_norm).first()
                            if centrale_obj:
                                nouvelle_liaison = EnseigneCentrale(
                                    enseigne=nom_enseigne_norm.upper(),
                                    centrale_id=centrale_obj.id,
                                    mission_id=int(mission_id)
                                )
                                db.session.add(nouvelle_liaison)
                                db.session.flush()  # flush sans commit pour garder la transaction propre
                            else:
                                erreurs.append(f"Ligne {i+2} : Centrale '{row.get('centrale')}' inconnue")
                                continue

                    secteur_nom = normalize(row.get("secteur"))
                    secteur, chef_secteur_id = None, None
                    if secteur_nom:
                        secteur = Secteur.query.filter(
                            func.lower(func.replace(Secteur.nom, '\u00A0', ' ')).ilike(secteur_nom)
                        ).filter_by(mission_id=int(mission_id)).first()
                        if secteur:
                            chef_secteur_id = secteur.user_id

                    adresse_complete = f"{safe_str(row.get('adresse'))}, {safe_str(row.get('code_postal'))} {safe_str(row.get('ville'))}, France"
                    lat, lon = geocode_adresse(adresse_complete, api_key)

                    if lat is None or lon is None:
                        erreurs.append(f"Ligne {i+2} : Erreur de géolocalisation")
                        continue

                    magasin = Magasin(
                        nom=safe_str(row.get("nom")) or f"{safe_str(row.get('nom_enseigne'))} - {safe_str(row.get('adresse'))}",
                        enseigne=safe_str(row.get("nom_enseigne")).upper() if row.get("nom_enseigne") else None,
                        centrale=safe_str(row.get("centrale")).upper() if row.get("centrale") else None,
                        strate_magasin=strate_magasin,
                        adresse=safe_str(row.get("adresse")),
                        ville=safe_str(row.get("ville")),
                        code_postal=safe_str(row.get("code_postal")),
                        pays="France",
                        mission_id=int(mission_id),
                        secteur_id=secteur.id if secteur else None,
                        chef_secteur_id=chef_secteur_id,
                        latitude=lat,
                        longitude=lon,
                        actif=(safe_str(row.get("statut_magasin")).lower() == "actif"),
                        statut_special="VIP" if not pd.isna(row.get("vip")) and safe_str(row.get("vip")).lower() == "oui" else None,
                        code_tdlink=safe_str(row.get("code_tdlink")),
                        fax=safe_str(row.get("fax")),
                        telephone=safe_str(row.get("telephone")),
                        surface=safe_str(row.get("surface")),
                        tel_contact=safe_str(row.get("tel_contact")),
                        email_contact=safe_str(row.get("email_contact")),
                        nom_contact=safe_str(row.get("nom_contact")),
                        rythme_magasin=safe_str(row.get("rythme_magasin")),
                    )
                    lignes_valides.append(magasin)

                except Exception as e:
                    erreurs.append(f"Ligne {i+2} : Erreur interne : {e}")

            if erreurs:
                output = StringIO()
                writer = csv.writer(output)
                writer.writerow(["Ligne", "Erreur détectée"])
                for err in erreurs:
                    if " : " in err:
                        ligne, message = err.split(" : ", 1)
                    else:
                        ligne, message = "", err
                    writer.writerow([ligne.strip(), message.strip()])

                output.seek(0)
                csv_bytes = BytesIO(output.getvalue().encode('utf-8'))
                filename = f"erreurs_import_magasins_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

                flash(f"❌ {len(erreurs)} erreurs détectées. Aucun magasin importé.", "danger")
                return send_file(csv_bytes, mimetype="text/csv", as_attachment=True, download_name=filename)

            for m in lignes_valides:
                db.session.add(m)
            db.session.commit()

            flash(f"✅ {len(lignes_valides)} magasins importés avec succès.", "success")
            return redirect(url_for("admin_magasins", mission_id=mission_id))

        except Exception as e:
            flash(f"Erreur générale : {e}", "danger")
            return redirect(request.url)

    return render_template("import_magasins.html", missions=missions, csrf_token=generate_csrf())

@role_required('admin', 'superadmin')
@app.route("/admin/magasins/<int:magasin_id>/edit", methods=["GET", "POST"])
def edit_magasin(magasin_id):
    magasin = Magasin.query.get_or_404(magasin_id)

    # Récupérer missions actives triées alphabétiquement
    missions = Mission.query.filter_by(statut='active').order_by(Mission.nom.asc()).all()

    # Questionnaires liés à la mission du magasin
    questionnaires = Questionnaire.query.filter_by(mission_id=magasin.mission_id).all()

    # Utilisateurs liés à la mission (chefs de secteur)
    utilisateurs = User.query.filter(
        User.id.in_(
            db.session.query(Secteur.user_id).filter(Secteur.mission_id == magasin.mission_id)
        )
    ).all()

    secteurs = Secteur.query.filter_by(mission_id=magasin.mission_id).all()

    if request.method == "POST":
        # Mise à jour des champs du magasin
        magasin.nom = request.form.get("nom")
        magasin.adresse = request.form.get("adresse")
        magasin.adresse2 = request.form.get("adresse2")
        magasin.ville = request.form.get("ville")
        magasin.code_postal = request.form.get("code_postal")
        magasin.pays = request.form.get("pays") or "France"
        magasin.latitude, magasin.longitude = get_lat_lon(f"{magasin.adresse}, {magasin.code_postal} {magasin.ville}, {magasin.pays}")

        magasin.enseigne = request.form.get("enseigne", "").strip().upper() or None
        magasin.centrale = request.form.get("centrale", "").strip().upper() or None
        magasin.typologie = request.form.get("typologie")
        magasin.surface = request.form.get("surface")
        magasin.telephone = request.form.get("telephone")
        magasin.tel2 = request.form.get("tel2")
        magasin.fax = request.form.get("fax")
        magasin.statut_special = request.form.get("statut_special")
        magasin.code_tdlink = request.form.get("code_tdlink")
        magasin.nom_contact = request.form.get("nom_contact")
        magasin.tel_contact = request.form.get("tel_contact")
        magasin.email_contact = request.form.get("email_contact")
        magasin.vip = request.form.get("vip") == "on"
        magasin.actif = request.form.get("actif") == "on"
        magasin.strate_magasin = request.form.get("strate_magasin")
        magasin.reference = request.form.get("reference")
        magasin.circuit = request.form.get("circuit")
        magasin.civilite = request.form.get("civilite")
        magasin.role_contact = request.form.get("role_contact")
        magasin.categorie = request.form.get("categorie")
        magasin.univers = request.form.get("univers")
        magasin.potentiel = request.form.get("potentiel")
        magasin.mission_id = request.form.get("mission_id", type=int)
        magasin.secteur_id = request.form.get("secteur_id", type=int)
        magasin.questionnaire_id = request.form.get("questionnaire_id", type=int)
        magasin.rythme_magasin = request.form.get("rythme_magasin")

        secteur = Secteur.query.get(magasin.secteur_id)
        magasin.chef_secteur_id = secteur.user_id if secteur and secteur.user_id else None

        db.session.commit()
        flash("✅ Magasin mis à jour avec succès.", "success")
        return redirect(url_for("admin_magasins", mission_id=magasin.mission_id))

    # --- FILTRAGE DES ENSEIGNES SELON LA MISSION ---

    enseignes = []
    if magasin.mission_id:
        enseignes = (
            db.session.query(Enseigne.nom)
            .join(EnseigneMission, Enseigne.id == EnseigneMission.enseigne_id)
            .filter(
                EnseigneMission.mission_id == magasin.mission_id,
                EnseigneMission.active == True
            )
            .order_by(Enseigne.nom.asc())
            .all()
        )
        # Extraire liste simple de chaînes (noms)
        enseignes = [e[0] for e in enseignes]

    # Si pas d'enseigne liée à la mission, afficher toutes les enseignes distinctes existantes (optionnel)
    if not enseignes:
        enseignes = sorted(list(set([m.enseigne for m in Magasin.query.distinct(Magasin.enseigne) if m.enseigne])))

    # Centrales selon enseigne + mission
    centrales = []
    if magasin.enseigne and magasin.mission_id:
        centrales = (
            db.session.query(Centrale)
            .join(EnseigneCentrale, Centrale.id == EnseigneCentrale.centrale_id)
            .filter(EnseigneCentrale.enseigne == magasin.enseigne)
            .filter(EnseigneCentrale.mission_id == magasin.mission_id)
            .order_by(Centrale.nom.asc())
            .all()
        )

    # Strates selon enseigne
    strates = get_strates_for_enseigne(magasin.enseigne)

    # Debug (optionnel)
    print("Centrales disponibles :", [c.nom for c in centrales])
    print("Centrale du magasin :", magasin.centrale)
    print("Enseignes filtrées par mission :", enseignes)

    return render_template(
        "formulaire_modification_magasin.html",
        magasin=magasin,
        utilisateurs=utilisateurs,
        missions=missions,
        enseignes=enseignes,
        centrales=centrales,
        strates=strates,
        questionnaires=questionnaires,
        secteurs=secteurs,
        csrf_token=generate_csrf()
    )


@role_required('admin', 'superadmin')
@app.route('/admin/magasins/template')
def download_template_magasins():
    return send_file("static/templates/template_import_magasins.xlsx", as_attachment=True)


@role_required('admin', 'superadmin')
@app.route("/admin/magasins")
def admin_magasins():
    missions = Mission.query.filter_by(statut='active').order_by(Mission.nom.asc()).all()
    mission_id = request.args.get("mission_id", type=int)

    # On ne charge plus les magasins ici car on passe en AJAX
    return render_template(
        "admin_magasins.html",
        missions=missions,
        mission_id=mission_id
    )


from flask import send_file
import io

@role_required('admin', 'superadmin')
@app.route('/admin/magasins/export')
def export_magasins():
    from sqlalchemy.orm import joinedload
    from io import BytesIO

    mission_id = request.args.get('mission_id', type=int)

    query = db.session.query(Magasin).options(
        joinedload(Magasin.mission),
        joinedload(Magasin.secteur),
        joinedload(Magasin.chef_secteur)
    )

    if mission_id:
        query = query.filter(Magasin.mission_id == mission_id)

    magasins = query.all()

    data = []
    for m in magasins:
        data.append({
            'ID Magasin': m.id,
            'Nom magasin': m.nom,
            'Enseigne': m.enseigne,
            'Centrale': m.centrale,
            'Strate magasin': m.strate_magasin,
            'Typologie': m.typologie,
            'Catégorie': m.categorie,
            'Univers': m.univers,
            'Statut spécial': m.statut_special,
            'Code UGA': m.code_uga,
            'Code TDLink': m.code_tdlink,
            'Code CIP': m.code_cip,
            'Adresse': m.adresse,
            'Adresse 2': m.adresse2,
            'Code postal': m.code_postal,
            'Ville': m.ville,
            'Région': m.région,
            'Pays': m.pays,
            'Téléphone': m.téléphone,
            'Téléphone 2': m.tel2,
            'Fax': m.fax,
            'Potentiel': m.potentiel,
            'Surface': m.surface,
            'Latitude': m.latitude,
            'Longitude': m.longitude,
            'Secteur': m.secteur.nom if m.secteur else '',
            'Prénom CS': m.chef_secteur.prenom if m.chef_secteur else '',
            'Nom CS': m.chef_secteur.nom if m.chef_secteur else '',
            'Mission': m.mission.nom if m.mission else '',
            'Statut': 'Actif' if m.actif else 'Inactif',
        })

    df = pd.DataFrame(data)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Magasins')

    output.seek(0)
    return send_file(output,
                     as_attachment=True,
                     download_name='export_magasins.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


@app.route('/get_centrales/<string:enseigne>')
def get_centrales(enseigne):
    mission_id = request.args.get('mission_id', type=int)
    if not mission_id or not enseigne:
        return jsonify([])

    centrales_query = (
        db.session.query(Centrale.nom)
        .join(Enseigne, Centrale.enseigne_id == Enseigne.id)
        .join(EnseigneMission, Enseigne.id == EnseigneMission.enseigne_id)
        .filter(Enseigne.nom == enseigne)
        .filter(EnseigneMission.mission_id == mission_id)
        .distinct()
        .all()
    )
    centrales = [c.nom for c in centrales_query]
    return jsonify(centrales)

def get_enseignes_par_mission(mission_id):
    return (
        db.session.query(Enseigne)
        .join(EnseigneMission, Enseigne.id == EnseigneMission.enseigne_id)
        .filter(
            EnseigneMission.mission_id == mission_id,
            EnseigneMission.active == True
        )
        .order_by(Enseigne.nom.asc())
        .all()
    )


@app.route('/get_enseignes')
def get_enseignes():
    mission_id = request.args.get('mission_id', type=int)
    if not mission_id:
        return jsonify([])

    enseignes_query = (
        db.session.query(Enseigne.nom)
        .join(EnseigneMission, Enseigne.id == EnseigneMission.enseigne_id)
        .filter(EnseigneMission.mission_id == mission_id)
        .distinct()
        .all()
    )
    enseignes = [e.nom for e in enseignes_query]
    return jsonify(enseignes)

@app.route("/get_secteurs")
def get_secteurs():
    mission_id = request.args.get("mission_id", type=int)
    secteurs = Secteur.query.filter_by(mission_id=mission_id).all()

    # Préparer la réponse avec les infos sur le chef de secteur
    result = []
    for s in secteurs:
        chef = None
        if s.user_id:
            # On suppose que user_id dans Secteur est le chef de secteur
            chef_user = User.query.get(s.user_id)
            if chef_user:
                chef = {"prenom": chef_user.prenom, "nom": chef_user.nom}
        result.append({"id": s.id, "nom": s.nom, "chef": chef})
    return jsonify(result)


from collections import defaultdict
from sqlalchemy.orm import joinedload

from config_strates import get_strates_for_enseigne

@role_required('admin', 'superadmin')
@app.route('/admin/magasins/create', methods=['GET', 'POST'])
def create_magasin():
    missions = Mission.query.filter_by(statut='active').order_by(Mission.nom.asc()).all()
    mission_id = request.args.get('mission_id', type=int)

    magasin = Magasin()

    questionnaires = []
    utilisateurs = []
    secteurs = []
    centrales = []
    strates = []
    enseignes = []

    if mission_id:
        questionnaires = Questionnaire.query.filter_by(mission_id=mission_id).all()
        utilisateurs = User.query.filter(
            User.id.in_(
                db.session.query(Secteur.user_id).filter(Secteur.mission_id == mission_id)
            )
        ).all()
        secteurs = Secteur.query.filter_by(mission_id=mission_id).all()

        enseignes_query = (
            db.session.query(Enseigne.nom)
            .select_from(Enseigne)
            .join(EnseigneCentrale, Enseigne.nom == EnseigneCentrale.enseigne)
            .filter(EnseigneCentrale.mission_id == mission_id)
            .distinct()
            .all()
        )
        enseignes = [e.nom for e in enseignes_query]

    if request.method == 'POST':
        magasin.nom = request.form.get('nom')
        magasin.adresse = request.form.get('adresse')
        magasin.adresse2 = request.form.get('adresse2')
        magasin.ville = request.form.get('ville')
        magasin.code_postal = request.form.get('code_postal')
        magasin.pays = request.form.get('pays') or "France"
        magasin.latitude, magasin.longitude = get_lat_lon(f"{magasin.adresse}, {magasin.code_postal} {magasin.ville}, {magasin.pays}")

        magasin.enseigne = request.form.get('enseigne', '').strip().upper()
        magasin.centrale = request.form.get('centrale')
        magasin.typologie = request.form.get('typologie')
        magasin.surface = request.form.get('surface')
        magasin.telephone = request.form.get('telephone')
        magasin.tel2 = request.form.get('tel2')
        magasin.fax = request.form.get('fax')
        magasin.statut_special = request.form.get('statut_special')
        magasin.code_tdlink = request.form.get('code_tdlink')
        magasin.nom_contact = request.form.get('nom_contact')
        magasin.tel_contact = request.form.get('tel_contact')
        magasin.email_contact = request.form.get('email_contact')
        magasin.vip = request.form.get('vip') == 'on'
        magasin.actif = request.form.get('actif') == 'on'
        magasin.strate_magasin = request.form.get('strate_magasin')
        magasin.reference = request.form.get('reference')
        magasin.circuit = request.form.get('circuit')
        magasin.civilite = request.form.get('civilite')
        magasin.role_contact = request.form.get('role_contact')
        magasin.categorie = request.form.get('categorie')
        magasin.univers = request.form.get('univers')
        magasin.potentiel = request.form.get('potentiel')
        magasin.mission_id = request.form.get('mission_id', type=int)
        magasin.secteur_id = request.form.get('secteur_id', type=int)
        magasin.questionnaire_id = request.form.get('questionnaire_id', type=int)

        if magasin.secteur_id:
            secteur = Secteur.query.get(magasin.secteur_id)
            magasin.chef_secteur_id = secteur.user_id if secteur and secteur.user_id else None

        db.session.add(magasin)
        db.session.commit()
        flash("✅ Magasin créé avec succès.", "success")
        return redirect(url_for('admin_magasins', mission_id=magasin.mission_id))

    if magasin.enseigne and mission_id:
        centrales = (
            db.session.query(Centrale)
            .select_from(EnseigneCentrale)
            .join(Centrale, Centrale.id == EnseigneCentrale.centrale_id)
            .filter(EnseigneCentrale.enseigne == magasin.enseigne)
            .filter(EnseigneCentrale.mission_id == mission_id)
            .order_by(Centrale.nom.asc())
            .all()
        )
        strates = get_strates_for_enseigne(magasin.enseigne)

    return render_template(
        'formulaire_creation_magasin.html',
        magasin=magasin,
        utilisateurs=utilisateurs,
        missions=missions,
        mission_id=mission_id,
        enseignes=enseignes,
        centrales=centrales,
        secteurs=secteurs,
        questionnaires=questionnaires,
        strates=strates,
        csrf_token=generate_csrf()
    )


@role_required('admin', 'superadmin')
@app.route("/admin/magasins/<int:magasin_id>/toggle", methods=["POST"])
def toggle_magasin(magasin_id):
    magasin = Magasin.query.get_or_404(magasin_id)
    questionnaires = Questionnaire.query.filter_by(mission_id=magasin.mission_id).all()
    magasin.actif = not magasin.actif
    db.session.commit()
    flash(f"✅ Statut du magasin '{magasin.nom}' mis à jour.", "success")
    return redirect(request.referrer or url_for("admin_magasins"))




@app.route("/api/magasins/search")
def api_search_magasin():
    q = request.args.get("q", "").lower()
    magasins = Magasin.query.filter(func.lower(Magasin.nom).like(f"%{q}%")).limit(10).all()
    return jsonify([{"id": m.id, "nom": m.nom} for m in magasins])

@role_required('terrain', 'responsable', 'admin', 'superadmin')
@app.route("/admin/agenda/<int:user_id>")
def afficher_agenda_utilisateur(user_id):
    utilisateur = User.query.get_or_404(user_id)

    # 🔒 Un terrain ne peut voir que son propre agenda
    if current_user.id != user_id and current_user.type_utilisateur not in ['admin', 'superadmin', 'responsable']:
        abort(403)

    visites = (
        AgendaVisite.query
        .filter_by(user_id=user_id)
        .order_by(AgendaVisite.date_visite.asc(), AgendaVisite.heure_visite.asc())
        .all()
    )

    return render_template("admin_agenda.html", utilisateur=utilisateur, visites=visites)

@app.route("/api/agenda/<int:user_id>")
def api_agenda_utilisateur(user_id):
    visites = (
        AgendaVisite.query
        .filter_by(user_id=user_id)
        .order_by(AgendaVisite.date_visite.asc(), AgendaVisite.heure_visite.asc())
        .all()
    )

    events = []
    for visite in visites:
        start = f"{visite.date_visite}T{visite.heure_visite or '09:00'}"
        end = f"{visite.date_visite}T{visite.heure_fin or '10:00'}"
        events.append({
            "title": f"{visite.statut or 'Visite'} - {visite.commentaire or ''}",
            "start": start,
            "end": end,
        })

    return jsonify(events)


@app.route("/api/magasins/autocomplete")
def api_autocomplete_magasins():
    terme = request.args.get("q", "").lower()
    user_id = request.args.get("user_id", type=int)

    if not terme or not user_id:
        return jsonify([])

    # Filtrer uniquement les magasins de la mission de l'utilisateur si besoin
    resultats = Magasin.query \
        .filter(Magasin.nom.ilike(f"%{terme}%") | Magasin.ville.ilike(f"%{terme}%") | Magasin.enseigne.ilike(f"%{terme}%")) \
        .limit(10).all()

    suggestions = [{
        "id": m.id,
        "label": f"{m.nom} – {m.ville} ({m.enseigne})",
        "value": m.nom
    } for m in resultats]

    return jsonify(suggestions)

@role_required('responsable','terrain')
@app.route("/mes-magasins")
def mes_magasins():
    recherche = request.args.get("recherche", "").lower()
    enseigne_filtre = request.args.get("enseigne")
    vip_filtre = request.args.get("vip") == "1"

    magasins = Magasin.query.filter_by(chef_secteur_id=current_user.id)

    if recherche:
        magasins = magasins.filter(
            or_(
                Magasin.nom.ilike(f"%{recherche}%"),
                Magasin.ville.ilike(f"%{recherche}%"),
                Magasin.enseigne.ilike(f"%{recherche}%")
            )
        )
    if enseigne_filtre:
        magasins = magasins.filter_by(enseigne=enseigne_filtre)
    if vip_filtre:
        magasins = magasins.filter_by(vip=True)

    magasins = magasins.order_by(Magasin.nom).all()
    enseignes_uniques = list({m.enseigne for m in Magasin.query.with_entities(Magasin.enseigne).distinct()})

    return render_template("mes_magasins.html", magasins=magasins, enseignes_uniques=enseignes_uniques, now=datetime.utcnow())

# @role_required('admin', 'superadmin')  # TEMPORAIRE
@app.route('/admin/map')
def admin_map():

    mission_id = request.args.get("mission_id", type=int)
    user_id = request.args.get("user_id", type=int)

    missions = Mission.query.filter_by(statut='active').order_by(Mission.nom.asc()).all()


    utilisateurs = User.query.filter(User.mission_id == mission_id) if mission_id else User.query.all()

    magasins = Magasin.query.filter(Magasin.mission_id == mission_id) if mission_id else Magasin.query
    if user_id:
        magasins = magasins.filter_by(user_id=user_id)

    magasins = magasins.all()

    magasins_json = [{
        "id": m.id,
        "nom": m.nom,
        "ville": m.ville,
        "enseigne": m.enseigne,
        "lat": m.latitude,
        "lon": m.longitude
    } for m in magasins if m.latitude and m.longitude]

    return render_template("admin_map.html",
                           missions=missions,
                           utilisateurs=utilisateurs,
                           magasins_json=magasins_json,
                           selected_mission_id=mission_id,
                           selected_user_id=user_id)


@app.route("/admin/magasins/geocoder")
def geocoder_magasins():
    magasins = Magasin.query.filter((Magasin.latitude == None) | (Magasin.longitude == None)).all()
    compteur = 0

    for magasin in magasins:
        adresse_complete = f"{magasin.adresse}, {magasin.code_postal} {magasin.ville}, France"
        lat, lon = get_lat_lon(adresse_complete)
        if lat and lon:
            magasin.latitude = lat
            magasin.longitude = lon
            compteur += 1

    db.session.commit()
    return f"{compteur} magasins géocodés avec succès."


@app.route("/magasin/<int:magasin_id>")
@role_required('terrain', 'responsable', 'admin', 'superadmin')
def fiche_magasin(magasin_id):
    magasin = Magasin.query.get_or_404(magasin_id)

    visites = (
        AgendaVisite.query
        .filter_by(magasin_id=magasin.id)
        .order_by(AgendaVisite.date_visite.desc(), AgendaVisite.heure_visite.desc())
        .all()
    )

    nb_visites = len(visites)
    derniere_visite = visites[0].date_visite.strftime('%d/%m/%Y') if visites else "Aucune"

    questionnaires = []
    if magasin.mission_id:
        questionnaires = Questionnaire.query.filter_by(mission_id=magasin.mission_id).all()

    return render_template(
        "fiche_magasin.html",
        magasin=magasin,
        visites=visites,
        nb_visites=nb_visites,
        derniere_visite=derniere_visite,
        questionnaires=questionnaires
    )

from datetime import datetime
from models import EnseigneAlias, QuestionnaireEnseigne, Questionnaire  # assure-toi d'importer ces modèles si ce n’est pas déjà fait

from sqlalchemy import func

from datetime import datetime
from flask_login import current_user

@app.route("/magasin/<int:magasin_id>/visite/new", methods=["GET", "POST"])
def creation_releve_magasin(magasin_id):
    magasin = Magasin.query.get_or_404(magasin_id)
    mission = Mission.query.get(magasin.mission_id)

    if not mission:
        flash("❌ Aucune mission liée à ce magasin.", "danger")
        return redirect(url_for("fiche_magasin", magasin_id=magasin.id))

    # ✅ D'abord on tente avec le champ direct
    if magasin.questionnaire_id:
        questionnaire = Questionnaire.query.get(magasin.questionnaire_id)
    else:
        enseigne_normalisee = magasin.enseigne.strip().lower()
        questionnaire = Questionnaire.query \
            .join(QuestionnaireEnseigne, Questionnaire.id == QuestionnaireEnseigne.questionnaire_id) \
            .filter(func.lower(QuestionnaireEnseigne.enseigne) == enseigne_normalisee) \
            .filter(Questionnaire.mission_id == mission.id) \
            .first()

    if not questionnaire:
        print(f"[DEBUG] Aucun questionnaire trouvé pour magasin_id={magasin.id} (enseigne={magasin.enseigne}) dans mission_id={mission.id}")
        flash("⚠️ Aucun questionnaire trouvé pour cette enseigne.", "warning")
        return redirect(url_for("fiche_magasin", magasin_id=magasin.id))

    # ✅ Création du relevé
    releve = ReleveVisite(
        magasin_id=magasin.id,
        mission_id=mission.id,
        user_id=current_user.id,
        questionnaire_id=questionnaire.id,
        date_visite=datetime.utcnow()
    )
    db.session.add(releve)
    db.session.commit()

    # ✅ On redirige vers la première étape du tunnel
    return redirect(url_for('repondre_question_releve', releve_id=releve.id, index=0))


# ✅ Version propre et prête pour l’enregistrement progressif
@app.route("/releve/<int:releve_id>/question/<int:index>", methods=["GET", "POST"])
@role_required('terrain', 'responsable', 'admin', 'superadmin')
def repondre_question_releve(releve_id, index):
    releve = ReleveVisite.query.get_or_404(releve_id)
    questionnaire = releve.questionnaire
    questions = questionnaire.questions if questionnaire else []

    if index >= len(questions):
        return redirect(url_for("releve_produits", releve_id=releve.id))

    question = questions[index]

    if request.method == "POST":
        # 🔎 Lecture des réponses selon le type de la question
        reponse_text = request.form.get("reponse_text")
        reponse_option = request.form.get("reponse_option")
        autre = request.form.get("reponse_autre")

        # 🔁 Supprime ancienne réponse (si on revient en arrière)
        ancienne_reponse = ReponseReleveVisite.query.filter_by(releve_id=releve.id, question_id=question.id).first()
        if ancienne_reponse:
            db.session.delete(ancienne_reponse)

        # 💾 Nouvelle réponse
        nouvelle_reponse = ReponseReleveVisite(
            releve_id=releve.id,
            question_id=question.id,
            reponse_text=reponse_text,
            reponse_option=reponse_option,
            autre=autre,
            created_at=datetime.utcnow()
        )

        db.session.add(nouvelle_reponse)
        db.session.commit()

        # 👉 Passage à la question suivante
        return redirect(url_for("repondre_question_releve", releve_id=releve.id, index=index + 1))

    return render_template(
        "releve_bloc_questionnaire.html",
        releve=releve,
        question=question,
        index=index,
        total=len(questions),
        csrf_token=generate_csrf()
    )

@app.route("/releve/<int:releve_id>/produits", methods=["GET", "POST"])
@role_required('terrain', 'responsable', 'admin', 'superadmin')
def releve_produits(releve_id):
    releve = ReleveVisite.query.get_or_404(releve_id)
    magasin = releve.magasin
    mission = releve.mission
    strate_magasin = magasin.strate_magasin.strip()

    # 🔍 Étape 1 : Normalisation brute du nom enseigne (comme dans creation_releve_magasin)
    enseigne_normalisee = magasin.enseigne.strip().lower()

    # 🔍 Étape 2 : Recherche directe des centrales via comparaison insensible à la casse
    centrales = (
        db.session.query(Centrale)
        .join(EnseigneCentrale, Centrale.id == EnseigneCentrale.centrale_id)
        .filter(func.lower(EnseigneCentrale.enseigne) == enseigne_normalisee)
        .filter(EnseigneCentrale.mission_id == mission.id)
        .all()
    )

    if not centrales:
        return render_template(
            "releve_bloc_produits.html",
            magasin=magasin,
            releve=releve,
            produits=[],
            erreur=f"⚠️ Aucune centrale trouvée pour l’enseigne « {magasin.enseigne} » dans cette mission. Vérifie dans l’admin."
        )

    # 🔍 Étape 3 : Définition des strates autorisées
    strate_hierarchie = ["T1", "T2", "T3", "T4", "T5", "T6", "T7"]
    strates_autorisees = []

    if strate_magasin == "Présence":
        strates_autorisees = ["Présence"]
    elif strate_magasin in strate_hierarchie:
        index = strate_hierarchie.index(strate_magasin) + 1
        strates_autorisees = strate_hierarchie[:index]
    strates_autorisees.append("Picking")

    # 🔍 Étape 4 : Recherche des produits compatibles mission / centrale / strate
    produits = (
        db.session.query(Produit)
        .join(ProduitCentraleStrate, Produit.id == ProduitCentraleStrate.produit_id)
        .filter(ProduitCentraleStrate.centrale_id.in_([c.id for c in centrales]))
        .filter(ProduitCentraleStrate.strate.in_(strates_autorisees))
        .filter(Produit.missions.any(id=mission.id))
        .distinct()
        .all()
    )

    # ✅ Enregistrement du relevé produits
    if request.method == "POST" and produits:
        for produit in produits:
            prefix = f"produit_{produit.id}_"
            present = request.form.get(prefix + "present") == "on"
            prix = request.form.get(prefix + "prix")
            facings = request.form.get(prefix + "facings")

            rp = ReleveProduit(
                releve_id=releve.id,
                produit_id=produit.id,
                present=present,
                prix=float(prix) if prix else None,
                facings=int(facings) if facings else None,
            )
            db.session.add(rp)

        releve.commentaire = request.form.get("commentaire_final")
        releve.formulaire_rempli = True
        db.session.commit()

        flash("✅ Relevé produits enregistré", "success")
        return redirect(get_next_step_url(releve, current_step="produits"))

    # 🔄 Prochaine étape
    next_step_url = get_next_step_url(releve, current_step="produits")

    return render_template(
        "releve_bloc_produits.html",
        magasin=magasin,
        releve=releve,
        produits=produits,
        erreur=None if produits else f"⚠️ Aucun produit trouvé pour les strates autorisées ({', '.join(strates_autorisees)}) dans les centrales associées. Vérifie la configuration dans l’admin.",
        next_step_url=next_step_url
    )



@app.route("/releve/<int:releve_id>/picking", methods=["GET", "POST"])
@role_required('terrain', 'responsable', 'admin', 'superadmin')
def releve_picking(releve_id):
    releve = ReleveVisite.query.get_or_404(releve_id)
    magasin = releve.magasin
    mission = releve.mission

    # 🔍 Nom de l’enseigne
    enseigne_finale = magasin.enseigne.strip()

    # 🔍 Récupération de la centrale
    centrale = (
        db.session.query(Centrale)
        .join(EnseigneCentrale, Centrale.id == EnseigneCentrale.centrale_id)
        .filter(EnseigneCentrale.enseigne == enseigne_finale)
        .filter(EnseigneCentrale.mission_id == mission.id)
        .first()
    )

    if not centrale:
        return render_template(
            "releve_bloc_produits.html",
            magasin=magasin,
            releve=releve,
            produits=[],
            erreur=f"⚠️ Aucune centrale trouvée pour l’enseigne « {enseigne_finale} ». Vérifie le rattachement dans l’interface admin."
        )

    # 🔍 Produits en strate "Picking"
    produits = (
        db.session.query(Produit)
        .join(ProduitCentraleStrate, Produit.id == ProduitCentraleStrate.produit_id)
        .filter(ProduitCentraleStrate.centrale_id == centrale.id)
        .filter(ProduitCentraleStrate.strate == "Picking")
        .filter(Produit.missions.any(id=mission.id))
        .distinct()
        .all()
    )

    # ✅ Sauvegarde des réponses Picking
    if request.method == "POST" and produits:
        for produit in produits:
            prefix = f"produit_{produit.id}_"
            present = request.form.get(prefix + "present") == "on"
            prix = request.form.get(prefix + "prix")
            facings = request.form.get(prefix + "facings")

            rp = ReleveProduit(
                releve_id=releve.id,
                produit_id=produit.id,
                present=present,
                prix=float(prix) if prix else None,
                facings=int(facings) if facings else None,
            )
            db.session.add(rp)

        db.session.commit()
        flash("✅ Relevé Picking enregistré", "success")
        return redirect(url_for("fiche_magasin", magasin_id=magasin.id))

    return render_template(
        "releve_bloc_produits.html",
        magasin=magasin,
        releve=releve,
        produits=produits,
        erreur=None if produits else f"⚠️ Aucun produit Picking trouvé pour cette centrale. À vérifier dans l’admin."
    )


@app.route("/releve/<int:releve_id>/etape/<int:index>", methods=["GET", "POST"])
@role_required('terrain', 'responsable', 'admin', 'superadmin')
def tunnel_releve(releve_id, index):
    releve = ReleveVisite.query.get_or_404(releve_id)
    magasin = releve.magasin
    mission = releve.mission
    questionnaire = releve.questionnaire

    if index == 0:
        # Bloc 1 : Questionnaire
        question = (
            db.session.query(Question)
            .filter_by(questionnaire_id=questionnaire.id)
            .order_by(Question.ordre)
            .offset(0)
            .limit(1)
            .first()
        )
        return render_template("releve_bloc_questionnaire.html", question=question, releve=releve)

    elif index == 1:
        # Bloc 2 : Produits
        centrale = (
            db.session.query(Centrale)
            .join(EnseigneCentrale, Centrale.id == EnseigneCentrale.centrale_id)
            .filter(EnseigneCentrale.enseigne == magasin.enseigne)
            .filter(EnseigneCentrale.mission_id == mission.id)
            .first()
        )
        produits = (
            db.session.query(Produit)
            .join(ProduitCentraleStrate)
            .filter(ProduitCentraleStrate.mission_id == mission.id)
            .filter(ProduitCentraleStrate.centrale_id == centrale.id)
            .filter(ProduitCentraleStrate.strate == magasin.strate_magasin)
            .all()
        )
        return render_template("releve_bloc_produits.html", produits=produits, releve=releve)

    elif index == 2:
        # Bloc 3 : Concurrence (optionnel)
        return render_template("releve_bloc_concurrence.html", releve=releve)

    elif index == 3:
        # Bloc 4 : Finalisation
        return render_template("releve_bloc_final.html", releve=releve)

    else:
        flash("Étape invalide.", "warning")
        return redirect(url_for("fiche_magasin", magasin_id=magasin.id))
    
@app.route("/api/magasins")
@role_required('admin', 'superadmin')
def api_magasins():
    draw = int(request.args.get("draw", 1))
    start = int(request.args.get("start", 0))
    length = int(request.args.get("length", 10))
    mission_id = request.args.get("mission_id", type=int)
    search_value = request.args.get("search[value]", "").strip()
    order_column_index = request.args.get("order[0][column]", type=int, default=0)
    order_dir = request.args.get("order[0][dir]", default="asc")

    columns = ["nom", "enseigne", "ville", "secteur", "chef_secteur", "questionnaire", "actif", "action"]
    order_column = columns[order_column_index] if 0 <= order_column_index < len(columns) else "nom"

    query = Magasin.query

    if mission_id:
        query = query.filter_by(mission_id=mission_id)

    if search_value:
        query = query.filter(
            Magasin.nom.ilike(f"%{search_value}%") |
            Magasin.ville.ilike(f"%{search_value}%") |
            Magasin.enseigne.ilike(f"%{search_value}%")
        )

    if order_column in ["nom", "enseigne", "ville"]:
        order_attr = getattr(Magasin, order_column)
        order_attr = order_attr.desc() if order_dir == "desc" else order_attr.asc()
        query = query.order_by(order_attr)

    total_records = query.count()
    magasins = query.offset(start).limit(length).all()

    data = []
    for m in magasins:
        badge = (
            f'<span class="badge bg-success">#{m.questionnaire.id} - {m.questionnaire.nom}</span>'
            if m.questionnaire else
            '<span class="badge bg-secondary">🚫 Aucun</span>'
        )

        data.append({
            "id": m.id,  # Important : pour le lien dans DataTables
            "nom": m.nom or "-",
            "enseigne": m.enseigne or "-",
            "ville": m.ville or "-",
            "secteur": m.secteur.nom if m.secteur else "-",
            "chef_secteur": f"{m.chef_secteur.prenom} {m.chef_secteur.nom}" if m.chef_secteur else "-",
            "questionnaire_id": badge,
            "actif": m.actif,
            "action": f'<a href="/admin/magasins/{m.id}/edit" class="btn btn-sm btn-outline-primary">✏️</a>'
        })

    return jsonify({
        "draw": draw,
        "recordsTotal": total_records,
        "recordsFiltered": total_records,
        "data": data
    })

@app.route("/admin/audit_enseignes")
@role_required("admin", "superadmin")
def audit_enseignes():
    from sqlalchemy import func
    from collections import defaultdict

    missions = Mission.query.filter_by(statut='active').order_by(Mission.nom.asc()).all()
    enseignes_par_mission = defaultdict(set)

    for magasin in Magasin.query.all():
        if magasin.mission_id:
            enseignes_par_mission[magasin.mission_id].add(magasin.enseigne.strip().lower())

    associations_existantes = set()
    for ec in EnseigneCentrale.query.all():
        key = (ec.mission_id, ec.enseigne.strip().lower())
        associations_existantes.add(key)

    audits = []
    for mission in missions:
        mission_enseignes = enseignes_par_mission.get(mission.id, set())
        for enseigne in mission_enseignes:
            if (mission.id, enseigne) not in associations_existantes:
                audits.append({
                    "mission": mission.nom,
                    "mission_id": mission.id,
                    "enseigne": enseigne,
                    "centrale_manquante": True
                })

    centrales = Centrale.query.all()
    return render_template("admin_audit_enseignes.html", audits=audits, centrales=centrales)

@role_required("admin", "superadmin")
@app.route("/admin/associer_enseigne", methods=["POST"])
def associer_enseigne():
    try:
        validate_csrf(request.form.get("csrf_token"))
    except:
        flash("❌ Erreur CSRF – recharge la page", "danger")
        return redirect(request.referrer or url_for("admin_assortiments_super_admin"))

    mission_id = request.form.get("mission_id", type=int)
    enseigne = request.form.get("enseigne")
    centrale_id = request.form.get("centrale_id", type=int)

    if not all([mission_id, enseigne, centrale_id]):
        flash("❌ Données manquantes pour l'association", "danger")
        return redirect(request.referrer or url_for("admin_assortiments_super_admin"))

    # Vérifie s’il n’existe pas déjà
    existant = EnseigneCentrale.query.filter_by(
        mission_id=mission_id,
        enseigne=enseigne.strip(),
        centrale_id=centrale_id
    ).first()

    if existant:
        flash(f"ℹ️ L’enseigne « {enseigne} » est déjà liée à cette centrale pour cette mission.", "info")
    else:
        nouvelle = EnseigneCentrale(
            mission_id=mission_id,
            enseigne=enseigne.strip(),
            centrale_id=centrale_id
        )
        db.session.add(nouvelle)
        db.session.commit()
        flash(f"✅ L’enseigne « {enseigne} » a été associée à la centrale (ID: {centrale_id})", "success")

    return redirect(request.referrer or url_for("admin_assortiments_super_admin"))

@app.route("/admin/tunnel_releve", methods=["GET", "POST"])
@role_required("admin", "superadmin")
def admin_tunnel_releve():
    missions = Mission.query.filter_by(statut="active").order_by(Mission.nom).all()

    if request.method == "POST":
        for mission in missions:
            tunnel = TunnelReleveConfig.query.filter_by(mission_id=mission.id).first()
            if not tunnel:
                tunnel = TunnelReleveConfig(mission_id=mission.id)
                db.session.add(tunnel)

            tunnel.preparation = bool(request.form.get(f"{tunnel.id}_preparation"))
            tunnel.photos_avant = bool(request.form.get(f"{tunnel.id}_photos_avant"))
            tunnel.questionnaire = bool(request.form.get(f"{tunnel.id}_questionnaire"))
            tunnel.produits = bool(request.form.get(f"{tunnel.id}_produits"))
            tunnel.concurrence = bool(request.form.get(f"{tunnel.id}_concurrence"))
            tunnel.photos_apres = bool(request.form.get(f"{tunnel.id}_photos_apres"))
            tunnel.commentaire = bool(request.form.get(f"{tunnel.id}_commentaire"))
            tunnel.resume_ia = bool(request.form.get(f"{tunnel.id}_resume_ia"))

        db.session.commit()
        flash("✅ Configuration mise à jour avec succès pour toutes les missions.", "success")
        return redirect(url_for("admin_tunnel_releve"))

    tunnels = TunnelReleveConfig.query.join(Mission).filter(Mission.statut == "active").order_by(Mission.nom).all()
    return render_template("admin_tunnel_releve.html", missions=missions, tunnels=tunnels)

@app.route("/admin/config_bloc/<int:mission_id>/<string:bloc>", methods=["GET", "POST"])
@role_required("admin", "superadmin")
def admin_config_bloc(mission_id, bloc):
    mission = Mission.query.get_or_404(mission_id)
    if bloc == "preparation":
        config = BlocPreparationConfig.query.filter_by(mission_id=mission.id).first()
    if request.method == "POST":
        if not config:
            config = BlocPreparationConfig(mission_id=mission.id)
            db.session.add(config)
        config.objectifs = request.form.get("objectifs", "")
        config.obligatoire = bool(request.form.get("obligatoire"))
        db.session.commit()
        flash("✅ Bloc préparation mis à jour.", "success")
        return redirect(url_for("admin_config_bloc", mission_id=mission.id, bloc="preparation"))
    return render_template("admin_config_bloc.html", mission=mission, bloc=bloc, preparation_config=config)

@app.route('/admin/magasins/<int:magasin_id>/fiche')
def admin_magasin_fiche(magasin_id):
    magasin = db.session.get(Magasin, magasin_id)
    if not magasin:
        flash("Magasin introuvable.", "warning")
        return redirect(url_for('admin_magasins'))

    mission = db.session.get(Mission, magasin.mission_id)
    if not mission or mission.statut != 'active':
        flash("Mission inactive ou non trouvée.", "warning")
        return redirect(url_for('admin_magasins'))

    enseigne = db.session.get(Enseigne, magasin.enseigne_id)
    centrale = db.session.get(Centrale, magasin.centrale_id)
    produits_recommandés = get_produits_visite(mission.id, centrale.id if centrale else None, enseigne.id, magasin.strate_magasin)

    return render_template('admin_magasin_fiche.html',
                           magasin=magasin,
                           mission=mission,
                           enseigne=enseigne,
                           centrale=centrale,
                           produits_recommandés=produits_recommandés)
