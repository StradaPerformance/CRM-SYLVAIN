import os
import sys
import secrets
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, send_file
from flask_migrate import Migrate
from sqlalchemy import text, func
import pandas as pd
import io
from werkzeug.utils import secure_filename
from flask_login import current_user
from decorators import role_required
from auth import auth, login_manager
from flask_wtf import CSRFProtect
from flask_wtf.csrf import generate_csrf
from flask_wtf.csrf import validate_csrf, CSRFError


# ✅ Initialisation de l'app
app = Flask(__name__)
app.secret_key = "abc123456789def"  # ⚠️ À remplacer par une vraie clé en production

# ✅ Initialisation CSRF
csrf = CSRFProtect(app)

# ✅ Injection automatique du token CSRF dans tous les templates
@app.context_processor
def inject_csrf_token():
    try:
        return dict(csrf_token=generate_csrf())
    except:
        return dict(csrf_token=None)
    

@app.context_processor
def inject_user():
    return dict(current_user=current_user)


# ✅ Configuration des chemins
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.static_folder = os.path.join(BASE_DIR, 'static')
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'static', 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ✅ Configuration base de données
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///C:/Users/DOUAY/Desktop/start_crm_dossier/crm_structurée_v4.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ✅ Import local et extensions
sys.path.append(BASE_DIR)
from forms import AssocierMissionsForm
from models import db, Question, Reponse, Condition, Questionnaire, produits_missions, User, Mission, Magasin, Assortiment, Produit, Enseigne, Centrale, ProduitCentrale, EnseigneMission

db.init_app(app)
migrate = Migrate(app, db)
login_manager.init_app(app)
app.register_blueprint(auth)

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for("index"))
        flash("Email ou mot de passe incorrect", "danger")
    return render_template("login.html")

@app.route("/")
def index():
    first_questionnaire = Questionnaire.query.first()
    return render_template("index.html", first_questionnaire=first_questionnaire)

@role_required('admin', 'superadmin')
@app.route('/admin/questions')
def admin_questions():
    questionnaire_id = request.args.get('questionnaire_id', type=int)
    questionnaires = Questionnaire.query.all()
    questions = (
        Question.query.filter_by(questionnaire_id=questionnaire_id).all()
        if questionnaire_id else Question.query.all()
    )
    return render_template(
        "admin_questions.html",
        questions=questions,
        questionnaires=questionnaires,
        selected_qid=questionnaire_id,
        first_questionnaire=Questionnaire.query.first()
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

@role_required('admin', 'superadmin')
@app.route("/admin/questions/create", methods=["POST"])
def create_question():
    try:
        questionnaire_id = int(request.form.get("questionnaire_id", 0))
    except ValueError:
        return "Questionnaire invalide", 400
    if questionnaire_id == 0:
        return "Aucun questionnaire sélectionné", 400

    contenu = request.form.get("question_texte")
    ordre = request.form.get("ordre", type=int)
    type_question = request.form.get("type_question")
    options = request.form.get("options_reponse")
    nb_min = request.form.get("min_reponses", type=int) or 0
    nb_max = request.form.get("max_reponses", type=int) or 0
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
        autre_reponse=conditionnelle
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
            db.session.add(Reponse(contenu=val.strip(), question_id=q.id))

    db.session.commit()
    return redirect(url_for("admin_questions", questionnaire_id=questionnaire_id))

@role_required('terrain', 'responsable', 'admin', 'superadmin')
@app.route("/analyse")
def analyse():
    return "<h2>Analyse à venir</h2>"

@role_required('terrain', 'responsable', 'admin', 'superadmin')
@app.route("/simulation")
def simulation_selection():
    questionnaires = Questionnaire.query.all()
    return render_template("simulation_selection.html", questionnaires=questionnaires)

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
    questionnaire = Questionnaire.query.get_or_404(questionnaire_id)
    questions = questionnaire.questions
    if not questions:
        return "<h2>Ce questionnaire ne contient aucune question.</h2>", 404
    if index < 0 or index >= len(questions):
        return "<h2>Index hors limites</h2>", 404

    question = questions[index]
    if request.method == "POST":
        reponse = request.form.get("reponse")
        print(f"Réponse à la question {question.id} : {reponse}")
        if index + 1 < len(questions):
            return redirect(url_for("simulation_question", questionnaire_id=questionnaire_id, index=index+1))
        else:
            return "<h3>Merci, vous avez terminé le questionnaire ✅</h3>"

    return render_template(
        "simulation_questionnaire.html",
        questionnaire=questionnaire,
        question=question,
        index=index,
        total=len(questions)
    )

@app.route("/admin/questionnaires", methods=["GET", "POST"])
def admin_questionnaires():
    questionnaires = Questionnaire.query.all()
    missions = Mission.query.all()
    utilisateurs = User.query.all()

    if request.method == "POST":
        nom = request.form.get("nom")
        mission_id = int(request.form.get("mission_id"))
        user_ids = request.form.getlist("utilisateurs")

        questionnaire = Questionnaire(nom=nom, mission_id=mission_id)
        questionnaire.utilisateurs = [User.query.get(int(i)) for i in user_ids]
        db.session.add(questionnaire)
        db.session.commit()

        flash("Questionnaire créé avec succès ✅", "success")
        return redirect(url_for("admin_questionnaires"))

    return render_template(
        "admin_questionnaires.html",
        questionnaires=questionnaires,
        missions=missions,
        utilisateurs=utilisateurs
    )

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
    missions = Mission.query.all()

    if request.method == 'POST':
        email = request.form.get('email')

        if User.query.filter_by(email=email).first():
            flash("❌ Cet email est déjà utilisé. Veuillez en choisir un autre.", "danger")
            return redirect(url_for('create_user'))

        mission_id = request.form.get('mission_id')

        user = User(
            nom=request.form.get('nom'),
            prenom=request.form.get('prenom'),
            type_utilisateur=request.form.get('type_utilisateur'),
            email=email,
            mot_de_passe=request.form.get('mot_de_passe'),
            fonction=request.form.get('fonction'),
            zone=request.form.get('zone'),
            vehicule=request.form.get('vehicule'),
            matricule=request.form.get('matricule'),
            contrat_type=request.form.get('contrat_type'),
            heures_mensuelles=request.form.get('heures_mensuelles'),
            actif=True,
            mission_id=int(mission_id) if mission_id else None
        )

        db.session.add(user)
        db.session.commit()
        flash("✅ Utilisateur créé avec succès", "success")
        return redirect(url_for('afficher_utilisateurs'))

    return render_template('form_user.html', missions=missions, csrf_token=generate_csrf())


@role_required('admin', 'superadmin')
@app.route('/admin/utilisateurs/edit/<int:user_id>', methods=['GET', 'POST'])
def edit_user(user_id):
    user = User.query.get_or_404(user_id)
    missions = Mission.query.all()

    if request.method == 'POST':
        user.nom = request.form.get('nom')
        user.prenom = request.form.get('prenom')
        user.email = request.form.get('email')
        user.mot_de_passe = request.form.get('mot_de_passe')
        user.fonction = request.form.get('fonction')
        user.zone = request.form.get('zone')
        user.vehicule = request.form.get('vehicule')
        user.matricule = request.form.get('matricule')
        user.contrat_type = request.form.get('contrat_type')
        user.heures_mensuelles = request.form.get('heures_mensuelles')
        user.type_utilisateur = request.form.get('type_utilisateur')
        user.mission_id = int(request.form.get('mission_id')) if request.form.get('mission_id') else None

        db.session.commit()
        flash("✅ Utilisateur modifié avec succès", "success")
        return redirect(url_for('afficher_utilisateurs'))

    return render_template('form_user.html', user=user, missions=missions, csrf_token=generate_csrf())

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
    utilisateurs = User.query.all()
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
    return send_file(output, download_name="utilisateurs.xlsx", as_attachment=True)

@app.route('/admin/missions')
def admin_missions():
    statut = request.args.get('statut')
    filter = statut  # utilisé par le template pour activer les bons boutons

    if statut == 'active':
        missions = Mission.query.filter_by(statut='active').order_by(Mission.date_debut.desc()).all()
    elif statut == 'cloturee':
        missions = Mission.query.filter_by(statut='clôturée').order_by(Mission.date_debut.desc()).all()
    else:
        missions = Mission.query.order_by(Mission.date_debut.desc()).all()

    return render_template('admin_missions.html', missions=missions, filter=filter)


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
            flash("Mission créée avec succès !", "success")
            return redirect(url_for("admin_missions"))

        flash("Erreur lors de la création de la mission", "danger")
        return redirect(url_for("create_mission"))

    # Méthode GET ici
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
    return render_template('admin_mission_detail.html', mission=mission, utilisateurs=utilisateurs, questionnaires=questionnaires)

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
        db.session.commit()
        flash("Mission modifiée avec succès !", "success")
        return redirect(url_for('admin_missions'))
    return render_template('admin_mission_edit.html', mission=mission)

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

@role_required('superadmin')
@app.route('/admin/assortiments')
def admin_assortiments_super_admin():
    toutes_les_enseignes = Enseigne.query.all()

    # 🔥 CORRECTION IMPORTANTE : filtrer uniquement les missions actives
    toutes_les_missions = Mission.query.filter_by(statut='active').all()

    # Préparation des missions activement associées à chaque enseigne
    for enseigne in toutes_les_enseignes:
        missions_actives = [
            em.mission_id for em in enseigne.missions_associees
            if em.mission and em.mission.active
        ]
        enseigne.missions_ids = missions_actives

    return render_template(
        'admin_assortiments.html',
        enseignes=toutes_les_enseignes,
        toutes_les_enseignes=toutes_les_enseignes,
        toutes_les_missions=toutes_les_missions,
        csrf_token=generate_csrf()
    )

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
        flash("Aucun fichier reçu", "danger")
        return redirect(url_for('admin_assortiments_super_admin'))

    try:
        df = pd.read_excel(fichier)
        df.columns = [c.strip().lower() for c in df.columns]
        print("Colonnes après nettoyage :", df.columns.tolist())
    except Exception as e:
        flash("Erreur de lecture du fichier Excel : " + str(e), "danger")
        return redirect(url_for('admin_assortiments_super_admin'))

    if 'enseigne' not in df.columns or 'centrale' not in df.columns:
        flash("Le fichier doit contenir les colonnes 'enseigne' et 'centrale'", "danger")
        return redirect(url_for('admin_assortiments_super_admin'))

    ajout_enseigne = 0
    ajout_centrale = 0
    ajout_lien = 0
    deja_vu = set()

    for _, row in df.iterrows():
        nom_enseigne = str(row['enseigne']).strip().title()
        nom_centrale = str(row['centrale']).strip().title()

        if not nom_enseigne or not nom_centrale:
            continue

        # Créer enseigne si inexistante (insensible à la casse)
        enseigne = Enseigne.query.filter(func.lower(Enseigne.nom) == nom_enseigne.lower()).first()
        if not enseigne:
            enseigne = Enseigne(nom=nom_enseigne)
            db.session.add(enseigne)
            db.session.flush()
            ajout_enseigne += 1

        # Créer centrale si inexistante (insensible à la casse)
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

        # Éviter les doublons exacts
        cle = (enseigne.id, centrale.id)
        if cle in deja_vu:
            continue
        deja_vu.add(cle)

        # Vérifier si lien déjà existant
        if centrale not in enseigne.centrales:
            enseigne.centrales.append(centrale)
            ajout_lien += 1

    db.session.commit()
    flash(f"✅ {ajout_lien} associations créées · {ajout_enseigne} enseignes créées · {ajout_centrale} centrales créées · {len(df) - ajout_lien} doublons ignorés", "success")
    return redirect(url_for('admin_assortiments_super_admin'))


@role_required('superadmin')
@app.route('/admin/assortiments/<int:mission_id>')
def admin_assortiments_par_mission(mission_id):
    mission = Mission.query.get_or_404(mission_id)
    enseignes = [em.enseigne for em in mission.enseignes_associees]
    toutes_les_enseignes = Enseigne.query.all()
    return render_template('admin_assortiments.html',
        mission=mission,
        mission_id=mission_id,
        enseignes=enseignes,
        toutes_les_enseignes=toutes_les_enseignes
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
    enseigne = Enseigne.query.get_or_404(enseigne_id)
    db.session.delete(enseigne)
    db.session.commit()
    flash("L’enseigne a été supprimée définitivement 🧨", "danger")
    return redirect(request.referrer or url_for('admin_assortiments'))


@role_required('superadmin')
@app.route('/admin/assortiments/enseignes/<int:enseigne_id>/centrales')
def assortiment_centrales_par_enseigne(enseigne_id):
    enseigne = Enseigne.query.get_or_404(enseigne_id)
    centrales = Centrale.query.filter_by(enseigne_id=enseigne.id).all()
    return render_template('assortiment_centrales_par_enseigne.html', enseigne=enseigne, centrales=centrales)

@role_required('admin', 'superadmin')
@app.route('/admin/enseignes')
def admin_enseignes():
    enseignes = Enseigne.query.all()
    return render_template('admin_enseignes.html', enseignes=enseignes)


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
        return redirect(url_for('admin_assortiments_super_admin'))

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

        # Gestion du logo si nouveau fichier uploadé
        logo_fichier = request.files.get('logo')
        if logo_fichier and logo_fichier.filename != '':
            filename = secure_filename(logo_fichier.filename)
            logo_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            logo_fichier.save(logo_path)
            enseigne.logo = filename

        db.session.commit()
        flash("Enseigne modifiée avec succès ✅", "success")
        return redirect(url_for('admin_assortiments_super_admin'))


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
    return redirect(url_for('admin_assortiments_super_admin'))


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
    return redirect(url_for('admin_assortiments_super_admin'))

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
    return redirect(url_for('admin_assortiments_super_admin'))

@role_required('admin', 'superadmin')
@app.route("/admin/magasins/import", methods=["GET", "POST"])
def import_magasins():
    missions = Mission.query.filter_by(statut='active').all()

    if request.method == "POST":
        try:
            token_recu = request.form.get("csrf_token")
            print(f"[DEBUG] Token CSRF reçu : {token_recu}")
            validate_csrf(token_recu)
        except CSRFError as e:
            print(f"[CSRF ERROR] {e}")
            flash("Token CSRF invalide ou manquant", "danger")
            return redirect(request.url)

        mission_id = request.form.get("mission_id")
        fichier = request.files.get("fichier")

        if not fichier or not mission_id:
            flash("Veuillez fournir un fichier et sélectionner une mission.", "danger")
            return redirect(request.url)

        try:
            df = pd.read_excel(fichier)
            print("📊 Colonnes Excel originales :", df.columns.tolist())

            df.rename(columns={
                'Nom usage (obligatoire si renseigné)': 'Nom usage',
                'nom_enseigne (obligatoire)': 'nom_enseigne',
                'adresse_magasin (obligatoire)': 'adresse_magasin',
                'ville_magasin (obligatoire)': 'ville_magasin',
                'codepostal_magasin (obligatoire)': 'codepostal_magasin',
                'tel_magasin (facultatif)': 'tel_magasin',
                'fax_magasin (facultatif)': 'fax_magasin',
                'surface_magasin (facultatif)': 'surface_magasin',
                'type_magasin (obligatoire)': 'type_magasin',
                'nom_centrale (facultatif)': 'nom_centrale',
                'statut_magasin (obligatoire - Actif/Inactif)': 'statut_magasin',
                'vip_magasin (facultatif - Oui/Non)': 'vip_magasin',
                'rythme_magasin (facultatif)': 'rythme_magasin',
                'Code TTDlinks (facultatif)': 'Code TTDlinks',
                'nomCDR (facultatif)': 'nomCDR',
                'telCDR (facultatif)': 'telCDR',
                'emailCDR (facultatif)': 'emailCDR',
                'login CS (facultatif mais conseillé)': 'login CS'
            }, inplace=True)

            lignes_ignorées = 0
            for _, row in df.iterrows():
                nom = row.get("Nom usage")
                enseigne = row.get("nom_enseigne")
                adresse = str(row.get("adresse_magasin") or "").strip()

                if not nom or str(nom).strip() == "":
                    if enseigne and adresse:
                        nom = f"{enseigne.strip()} - {adresse}"
                    else:
                        lignes_ignorées += 1
                        continue

                ville = str(row.get("ville_magasin") or "").strip()
                code_postal = str(row.get("codepostal_magasin") or "").strip()
                téléphone = row.get("tel_magasin")
                fax = row.get("fax_magasin")
                surface = row.get("surface_magasin")
                typologie = str(row.get("type_magasin") or "").strip()
                centrale = row.get("nom_centrale")
                statut = str(row.get("statut_magasin")).strip().lower() == "actif"
                vip = str(row.get("vip_magasin")).strip().lower() == "oui"
                rythme = row.get("rythme_magasin")
                code_tdlink = row.get("Code TTDlinks")

                nom_cdr = row.get("nomCDR")
                tel_cdr = row.get("telCDR")
                email_cdr = row.get("emailCDR")

                cs_email = row.get("login CS")
                cs_user = User.query.filter_by(email=cs_email).first() if cs_email else None

                magasin = Magasin(
                    nom=nom,
                    enseigne=enseigne,
                    adresse=adresse,
                    ville=ville,
                    code_postal=code_postal,
                    téléphone=téléphone,
                    fax=fax,
                    surface=surface,
                    typologie=typologie,
                    centrale=centrale,
                    actif=statut,
                    vip=vip,
                    statut_special=rythme,
                    code_tdlink=code_tdlink,
                    nom_contact=nom_cdr,
                    tel_contact=tel_cdr,
                    email_contact=email_cdr,
                    mission_id=int(mission_id),
                    chef_secteur_id=cs_user.id if cs_user else None
                )
                db.session.add(magasin)

            db.session.commit()
            msg = "✅ Magasins importés avec succès."
            if lignes_ignorées:
                msg += f" ({lignes_ignorées} ligne(s) ignorée(s) sans nom)"
            flash(msg, "success")
            return redirect(url_for("admin_magasins", mission_id=mission_id))

        except Exception as e:
            flash(f"Erreur lors de l'import : {str(e)}", "danger")
            return redirect(request.url)

    return render_template("admin_magasins_import.html", missions=missions)


@role_required('admin', 'superadmin')
@app.route('/admin/magasins/template')
def download_template_magasins():
    return send_file("static/templates/template_import_magasins.xlsx", as_attachment=True)


@role_required('admin', 'superadmin')
@app.route("/admin/magasins")
def admin_magasins():
    mission_id = request.args.get("mission_id")
    missions = Mission.query.filter_by(statut='active').all()


    if mission_id:
        try:
            mission_id_int = int(mission_id)
        except ValueError:
            flash("Mission ID invalide", "danger")
            return redirect(url_for('admin_magasins'))
        magasins = Magasin.query.filter_by(mission_id=mission_id_int).all()
    else:
        magasins = Magasin.query.all()

    # 🆕 Données pour filtres
    enseignes = sorted(set([m.enseigne for m in magasins if m.enseigne]))
    chefs_secteur_ids = list(set([m.chef_secteur_id for m in magasins if m.chef_secteur_id]))
    chefs_secteur = User.query.filter(User.id.in_(chefs_secteur_ids)).all()

    return render_template(
        "admin_magasins.html",
        magasins=magasins,
        missions=missions,
        mission_id=mission_id,
        enseignes=enseignes,
        chefs_secteur=chefs_secteur
    )



@role_required('admin', 'superadmin')
@app.route("/admin/magasins/create", methods=["GET", "POST"])
def create_magasin():
    ...

@role_required('admin', 'superadmin')
@app.route("/admin/magasins/<int:magasin_id>/toggle", methods=["POST"])
def toggle_magasin(magasin_id):
    magasin = Magasin.query.get_or_404(magasin_id)
    magasin.actif = not magasin.actif
    db.session.commit()
    flash(f"✅ Statut du magasin '{magasin.nom}' mis à jour.", "success")
    return redirect(request.referrer or url_for("admin_magasins"))

@role_required('admin', 'superadmin')
@app.route("/admin/magasins/<int:magasin_id>/edit", methods=["GET", "POST"])
def edit_magasin(magasin_id):
    magasin = Magasin.query.get_or_404(magasin_id)
    utilisateurs = User.query.all()  # pour choix du CS

    if request.method == "POST":
        magasin.nom = request.form.get("nom")
        magasin.adresse = request.form.get("adresse")
        magasin.ville = request.form.get("ville")
        magasin.code_postal = request.form.get("code_postal")
        magasin.enseigne = request.form.get("enseigne")
        magasin.typologie = request.form.get("typologie")
        magasin.centrale = request.form.get("centrale")
        magasin.telephone = request.form.get("telephone")
        magasin.fax = request.form.get("fax")
        magasin.surface = request.form.get("surface")
        magasin.statut_special = request.form.get("statut_special")
        magasin.code_tdlink = request.form.get("code_tdlink")
        magasin.nom_contact = request.form.get("nom_contact")
        magasin.tel_contact = request.form.get("tel_contact")
        magasin.email_contact = request.form.get("email_contact")
        magasin.vip = True if request.form.get("vip") == "on" else False
        magasin.actif = True if request.form.get("actif") == "on" else False

        # Chef de secteur
        cs_id = request.form.get("chef_secteur_id")
        magasin.chef_secteur_id = int(cs_id) if cs_id else None

        db.session.commit()
        flash("✅ Magasin mis à jour avec succès.", "success")
        return redirect(url_for("admin_magasins", mission_id=magasin.mission_id))

    return render_template(
        "formulaire_creation_magasin.html",
        magasin=magasin,
        utilisateurs=utilisateurs,
        mode="edit"
    )


@role_required('responsable', 'admin', 'superadmin')
@app.route("/admin/agenda/<int:user_id>")
def afficher_agenda_utilisateur(user_id):
    utilisateur = User.query.get_or_404(user_id)
    visites = (
        AgendaVisite.query
        .filter_by(user_id=user_id)
        .order_by(AgendaVisite.date_visite.asc(), AgendaVisite.heure_visite.asc())
        .all()
    )
    return render_template("admin_agenda.html", utilisateur=utilisateur, visites=visites)

@app.route("/api/magasins/search")
def api_search_magasin():
    q = request.args.get("q", "").lower()
    magasins = Magasin.query.filter(func.lower(Magasin.nom).like(f"%{q}%")).limit(10).all()
    return jsonify([{"id": m.id, "nom": m.nom} for m in magasins])

@role_required('responsable', 'admin', 'superadmin')
@app.route("/admin/agenda-global")
def agenda_global_admin():
    user_id = request.args.get("user_id", type=int)
    utilisateurs = User.query.order_by(User.nom.asc()).all()
    return render_template(
        "admin_agenda_global.html",
        utilisateurs=utilisateurs,
        selected_user_id=user_id
    )


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