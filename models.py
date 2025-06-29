
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin 
from sqlalchemy import Column, Integer, ForeignKey, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
db = SQLAlchemy()

# ➤ Table many-to-many entre utilisateurs et questionnaires
users_questionnaires = db.Table('users_questionnaires',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('questionnaire_id', db.Integer, db.ForeignKey('questionnaires.id'), primary_key=True)
)
produits_missions = db.Table('produits_missions',
    db.Column('produit_id', db.Integer, db.ForeignKey('produits.id'), primary_key=True),
    db.Column('mission_id', db.Integer, db.ForeignKey('missions.id'), primary_key=True)
)

# ➤ Missions
class Mission(db.Model):
    __tablename__ = 'missions'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False)
    date_debut = db.Column(db.Date, nullable=False)
    date_fin = db.Column(db.Date, nullable=False)
    statut = db.Column(db.String(50), default='Préparation')
    objectif = db.Column(db.Text)
    active = db.Column(db.Boolean, default=True)
    type = db.Column(db.String(50))

    utilisateurs = db.relationship('User', back_populates='mission', cascade="all, delete", lazy=True)
    questionnaires = db.relationship('Questionnaire', backref='mission', cascade="all, delete", lazy=True)
    magasins = db.relationship('Magasin', backref='mission', cascade="all, delete", lazy=True)

# ➤ Utilisateurs
class User(db.Model, UserMixin):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False)
    prenom = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, index=True, nullable=False)  # Login via email
    mot_de_passe = db.Column(db.String(256), nullable=False)

    fonction = db.Column(db.String(100))
    type_utilisateur = db.Column(db.String(50))

    zone = db.Column(db.String(100))  # Peut être retiré si remplacé par le secteur
    equipe = db.Column(db.String(100))

    secteur_id = db.Column(db.Integer, db.ForeignKey('secteurs.id'), nullable=True)
    secteur = db.relationship(
        'Secteur',
        backref=db.backref('utilisateurs', lazy=True),
        foreign_keys=[secteur_id]
    )

    contrat_type = db.Column(db.String(50))
    matricule = db.Column(db.String(50))
    vehicule = db.Column(db.String(100))
    adresse = db.Column(db.String(255))
    telephone_pro = db.Column(db.String(20))
    heures_mensuelles = db.Column(db.Integer)

    actif = db.Column(db.Boolean, default=True)
    statut_crm = db.Column(db.String(50), default="Normal")  # Ex : “Formation”, “Inactif temporaire”, etc.
    doit_renouveler_mdp = db.Column(db.Boolean, default=False)  # Forcer le changement de mot de passe
    derniere_connexion = db.Column(db.DateTime)

    photo_profil = db.Column(db.String(255))  # 📸 chemin vers la photo uploadée

    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'), nullable=True)
    mission = db.relationship("Mission", back_populates="utilisateurs")


    questionnaires = db.relationship(
        'Questionnaire',
        secondary='users_questionnaires',
        back_populates='utilisateurs'
    )

    # ➕ Méthodes Flask-Login
    @property
    def is_active(self):
        return self.actif

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return str(self.id)

    def role(self):
        return self.type_utilisateur


class Questionnaire(db.Model):
    __tablename__ = 'questionnaires'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(255), nullable=False)
    date_creation = db.Column(db.DateTime, default=datetime.utcnow)
    date_modification = db.Column(db.DateTime, onupdate=datetime.utcnow)

    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'))

    # ⛔ Supprimé car redondant avec QuestionnaireEnseigne
    # enseigne = db.Column(db.String(100))
    # centrale = db.Column(db.String(100))

    utilisateurs = db.relationship('User', secondary='users_questionnaires', back_populates='questionnaires')
    questions = db.relationship('Question', backref='questionnaire', cascade="all, delete", lazy=True)

    # ✅ Nouvelle relation vers les enseignes liées
    enseignes_associees = db.relationship("QuestionnaireEnseigne", back_populates="questionnaire", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Questionnaire id={self.id} nom={self.nom}>"

class QuestionnaireEnseigne(db.Model):
    __tablename__ = "questionnaires_enseignes"

    id = db.Column(db.Integer, primary_key=True)
    questionnaire_id = db.Column(db.Integer, db.ForeignKey("questionnaires.id"), nullable=False)
    enseigne = db.Column(db.String(120), nullable=False)
    centrale = db.Column(db.String(120), nullable=True)
    strate = db.Column(db.String(50), nullable=True)
    mission_id = db.Column(db.Integer, db.ForeignKey("missions.id"), nullable=True)

    questionnaire = db.relationship("Questionnaire", back_populates="enseignes_associees")

    def __repr__(self):
        return f"<QuestionnaireEnseigne qid={self.questionnaire_id} enseigne={self.enseigne} centrale={self.centrale}>"

# ➤ Questions / Réponses / Conditions
class Question(db.Model):
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    contenu = db.Column(db.String(255), nullable=False)
    type_reponse = db.Column(db.String(50), nullable=False)
    nb_min = db.Column(db.Integer)
    nb_max = db.Column(db.Integer)
    ordre = db.Column(db.Integer)
    autre_reponse = db.Column(db.Boolean, default=False)

    questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaires.id'), nullable=False)
    reponses = db.relationship('Reponse', backref='question', cascade="all, delete", lazy=True)
    conditions = db.relationship('Condition', backref='question_cond', cascade="all, delete", lazy=True)

class Reponse(db.Model):
    __tablename__ = 'reponses'
    id = db.Column(db.Integer, primary_key=True)
    contenu = db.Column(db.String(255), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)

class Condition(db.Model):
    __tablename__ = 'conditions'
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    question_parent_id = db.Column(db.Integer, nullable=False)
    reponse_parent = db.Column(db.String(255), nullable=False)

# ➤ Magasins
class Magasin(db.Model):
    __tablename__ = 'magasins'

    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(255), nullable=False)
    enseigne = db.Column(db.String(100))
    centrale = db.Column(db.String(100))
    strate = db.Column(db.String(100))
    categorie = db.Column(db.String(100))
    typologie = db.Column(db.String(100))
    strate_magasin = db.Column(db.String(20))
    actif = db.Column(db.Boolean, default=True)
    statut_special = db.Column(db.String(100))
    code_uga = db.Column(db.String(50))
    code_tdlink = db.Column(db.String(50))
    reference = db.Column(db.String(50))  # 🆕 Référence magasin
    code_cip = db.Column(db.String(50))
    adresse = db.Column(db.String(255))
    adresse2 = db.Column(db.String(255))  # 🆕 Adresse complémentaire
    code_postal = db.Column(db.String(20))
    ville = db.Column(db.String(100))
    region = db.Column(db.String(100))
    pays = db.Column(db.String(100))  # 🆕 Pays du magasin
    telephone = db.Column(db.String(20))    
    tel2 = db.Column(db.String(20))  # 🆕 Deuxième téléphone
    fax = db.Column(db.String(20))
    surface = db.Column(db.String(50))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    potentiel = db.Column(db.String(50))  # 🆕 Potentiel en valeur
    circuit = db.Column(db.String(50))  # 🆕 Type de circuit (Drive, Proximité...)
    nom_contact = db.Column(db.String(255))
    civilite = db.Column(db.String(10))  # 🆕 M. ou Mme
    role_contact = db.Column(db.String(100))  # 🆕 Fonction du contact
    tel_contact = db.Column(db.String(50))
    email_contact = db.Column(db.String(100))
    univers = db.Column(db.String(100))  # 🆕 Univers (surgelé, frais...)
    vip = db.Column(db.Boolean, default=False)
    questionnaire_id = db.Column(db.Integer, db.ForeignKey('questionnaires.id'))
    questionnaire = db.relationship("Questionnaire", backref="magasins")
    chef_secteur_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    chef_secteur = db.relationship("User", foreign_keys=[chef_secteur_id])
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'))
    strate_system = db.Column(db.String(20))
    strate_user = db.Column(db.String(20))
    rythme_magasin = db.Column(db.String(50))


 # ➤ Lien vers le Chef de Secteur

    # ➤ Liens vers utilisateurs
    secteur_id = db.Column(db.Integer, db.ForeignKey('secteurs.id'))

# ➤ Produits, Assortiments et Relations
class Produit(db.Model):
    __tablename__ = 'produits'
    id = db.Column(db.Integer, primary_key=True)
    libelle = db.Column(db.String(255), nullable=False)
    code_ean = db.Column(db.String(50))
    code_interne = db.Column(db.String(50))
    marque = db.Column(db.String(100))
    famille = db.Column(db.String(100))
    gamme = db.Column(db.String(100))
    cuisson = db.Column(db.String(100))
    typologie = db.Column(db.String(100))
    photo = db.Column(db.String(255))
    actif = db.Column(db.Boolean, default=True)
    assortiments = db.relationship('AssortimentProduit', back_populates='produit')
    missions = db.relationship('Mission', secondary='produits_missions', backref='produits')

class Assortiment(db.Model):
    __tablename__ = 'assortiments'
    id = db.Column(db.Integer, primary_key=True)
    libelle = db.Column(db.String(255), nullable=False)
    code_ean = db.Column(db.String(50))
    code_interne = db.Column(db.String(50))
    pcb = db.Column(db.String(50))
    pcb2 = db.Column(db.String(50))
    marque = db.Column(db.String(100))
    famille = db.Column(db.String(100))
    gamme = db.Column(db.String(100))
    cuisson = db.Column(db.String(100))
    typologie = db.Column(db.String(100))
    strate = db.Column(db.String(100))
    centrale = db.Column(db.String(100))
    enseigne = db.Column(db.String(100))
    actif = db.Column(db.Boolean, default=True)

    produits = db.relationship('AssortimentProduit', back_populates='assortiment')

class AssortimentProduit(db.Model):
    __tablename__ = 'assortiment_produits'
    id = db.Column(db.Integer, primary_key=True)
    assortiment_id = db.Column(db.Integer, db.ForeignKey('assortiments.id'), nullable=False)
    produit_id = db.Column(db.Integer, db.ForeignKey('produits.id'), nullable=False)
    strate = db.Column(db.String(50))

    assortiment = db.relationship('Assortiment', back_populates='produits')
    produit = db.relationship('Produit', back_populates='assortiments')

# ➤ Enseignes, Centrales, Strates, Liens
class Enseigne(db.Model):
    __tablename__ = 'enseignes'
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False, unique=True)
    logo = db.Column(db.String(255))
    categorie = db.Column(db.String(100))
    centrale_principale = db.Column(db.String(255))

    centrales = db.relationship('Centrale', backref='enseigne', cascade="all, delete", lazy=True)
    strates = db.relationship('Strate', backref='enseigne', cascade="all, delete", lazy=True)

class Centrale(db.Model):
    __tablename__ = "centrales"
    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(120), nullable=False)
    type_centrale = db.Column(db.String(50))
    enseigne_id = db.Column(db.Integer, db.ForeignKey("enseignes.id"))

    # ✅ vers produits_centrales
    produits_lies = db.relationship(
        "ProduitCentrale",
        backref="centrale",
        cascade="all, delete-orphan"
    )

    # ✅ vers produits_centrales_strates (optionnel)
    produits_strates = db.relationship(
        "ProduitCentraleStrate",
        back_populates="centrale",
        cascade="all, delete-orphan",
        passive_deletes=True,
        overlaps="centrale"
)


    def __repr__(self):
        return f"<Centrale {self.nom}>"



class EnseigneCentrale(db.Model):
    __tablename__ = "enseignes_centrales"
    id = db.Column(db.Integer, primary_key=True)
    mission_id = db.Column(db.Integer, db.ForeignKey("missions.id"), nullable=False)
    enseigne = db.Column(db.String(120), nullable=False)
    centrale_id = db.Column(db.Integer, db.ForeignKey("centrales.id"), nullable=False)

    mission = db.relationship("Mission", backref="enseignes_centrales")
    centrale = db.relationship("Centrale", backref="enseignes_centrales")


class EnseigneAlias(db.Model):
    __tablename__ = "enseigne_alias"

    id = db.Column(db.Integer, primary_key=True)
    alias = db.Column(db.String(100), nullable=False, unique=True)  # ex: "Carrefour City"
    enseigne_normee = db.Column(db.String(100), nullable=False)     # ex: "Carrefour"

class Secteur(db.Model):
    __tablename__ = 'secteurs'

    id = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False, unique=True)  # ex : "IDF EST"

    # Responsable (optionnel)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    user = db.relationship(
    'User',
    backref=db.backref('secteurs_en_charge', lazy=True),
    foreign_keys=[user_id]
)


    # Lien obligatoire vers la mission
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'), nullable=False)
    mission = db.relationship('Mission', backref=db.backref('secteurs', lazy='dynamic'))

    # Lien avec les magasins (si déjà présent dans Magasin)
    magasins = db.relationship('Magasin', backref='secteur', lazy=True)


class Strate(db.Model):
    __tablename__ = 'strates'
    id = db.Column(db.Integer, primary_key=True)
    libelle = db.Column(db.String(50), nullable=False)
    enseigne_id = db.Column(db.Integer, db.ForeignKey('enseignes.id'), nullable=False)

class ProduitCentrale(db.Model):
    __tablename__ = 'produits_centrales'
    id = db.Column(db.Integer, primary_key=True)
    produit_id = db.Column(db.Integer, db.ForeignKey('produits.id'), nullable=False)
    centrale_id = db.Column(db.Integer, db.ForeignKey('centrales.id'), nullable=False)
    strate = db.Column(db.String(50))

    produit_associe = db.relationship("Produit", backref="liens_centrales", lazy=True)
    
class EnseigneMission(db.Model):
    __tablename__ = 'enseignes_missions'
    id = db.Column(db.Integer, primary_key=True)
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'), nullable=False)
    enseigne_id = db.Column(db.Integer, db.ForeignKey('enseignes.id'), nullable=False)
    active = db.Column(db.Boolean, default=True, nullable=False)
    logo = db.Column(db.String(255), nullable=True)

    mission = db.relationship(
        'Mission',
        backref=db.backref('enseignes_associees', cascade="all, delete-orphan", lazy='dynamic')
    )
    enseigne = db.relationship(
        'Enseigne',
        backref=db.backref('missions_associees', cascade="all, delete-orphan", lazy='dynamic')
    )

    def __repr__(self):
        return f"<EnseigneMission mission_id={self.mission_id} enseigne_id={self.enseigne_id} active={self.active}>"

class ProduitCentraleStrate(db.Model):
    __tablename__ = 'produits_centrales_strates'
    id = db.Column(db.Integer, primary_key=True)
    produit_id = db.Column(db.Integer, db.ForeignKey('produits.id'), nullable=False)
    centrale_id = db.Column(db.Integer, db.ForeignKey('centrales.id', ondelete='CASCADE'))
    strate = db.Column(db.String(10), nullable=False)

    produit = db.relationship('Produit', backref='centrales_strates')

    centrale = db.relationship(
        "Centrale",
        back_populates="produits_strates",
        overlaps="centrale_associee"  # pour éviter conflit avec backref
    )



# ➤ Modules Bonus
class Photo(db.Model):
    __tablename__ = 'photos'
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(255))
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'))

class Promotion(db.Model):
    __tablename__ = 'promotions'
    id = db.Column(db.Integer, primary_key=True)
    libelle = db.Column(db.String(255))
    produit_id = db.Column(db.Integer, db.ForeignKey('produits.id'))

class Objectif(db.Model):
    __tablename__ = 'objectifs'
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(100))
    valeur = db.Column(db.String(100))
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'))

class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    titre = db.Column(db.String(255))
    fichier = db.Column(db.String(255))
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'))


from datetime import datetime

class AgendaVisite(db.Model):
    __tablename__ = "agenda_visites"
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", backref="agenda_visites")

    magasin_id = db.Column(db.Integer, db.ForeignKey("magasins.id"), nullable=False)
    magasin = db.relationship("Magasin", backref="agenda_visites")

    mission_id = db.Column(db.Integer, db.ForeignKey("missions.id"))
    mission = db.relationship("Mission", backref="agenda_visites")

    date_visite = db.Column(db.Date, nullable=False)
    heure_visite = db.Column(db.Time, nullable=True)

    statut = db.Column(db.String(20), default="prévu")  # prévu, réalisé, annulé...
    commentaire = db.Column(db.String(300))

    formulaire_rempli = db.Column(db.Boolean, default=False)
    cree_le = db.Column(db.DateTime, default=datetime.utcnow)


class ReleveVisite(db.Model):
    __tablename__ = "releves_visite"
    id = db.Column(db.Integer, primary_key=True)

    # Liens relationnels
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    magasin_id = db.Column(db.Integer, db.ForeignKey("magasins.id"), nullable=False)
    mission_id = db.Column(db.Integer, db.ForeignKey("missions.id"), nullable=False)
    agenda_id = db.Column(db.Integer, db.ForeignKey("agenda_visites.id"), nullable=True)
  # si généré depuis l’agenda

    # Données de visite
    date_visite = db.Column(db.Date, nullable=False)
    heure_visite = db.Column(db.Time, nullable=True)

    interlocuteur = db.Column(db.String(120), nullable=True)
    en_rdv = db.Column(db.Boolean, default=False)
    decisionnaire = db.Column(db.String(120), nullable=True)
    commande_effectuee = db.Column(db.Boolean, default=False)
    action_merch = db.Column(db.Boolean, default=False)

    photo_avant = db.Column(db.String(255), nullable=True)
    photo_apres = db.Column(db.String(255), nullable=True)

    strate_observee = db.Column(db.String(50), nullable=True)  # possibilité de modifier la strate magasin

    commentaire = db.Column(db.Text, nullable=True)
    formulaire_rempli = db.Column(db.Boolean, default=False)

    prochaine_visite = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    questionnaire_id = db.Column(db.Integer, db.ForeignKey("questionnaires.id"), nullable=True)
    questionnaire = db.relationship("Questionnaire", backref="releves_visites")
    releves_produits = db.relationship('ReleveProduit', back_populates='releve', cascade='all, delete-orphan')


    # relations pratiques
    user = db.relationship("User", backref="releves_visites", lazy=True)
    magasin = db.relationship("Magasin", backref="releves_visites", lazy=True)
    mission = db.relationship("Mission", backref="releves_visites", lazy=True)
    agenda = db.relationship("AgendaVisite", backref="releve", lazy=True, uselist=False)

    def __repr__(self):
        return f"<ReleveVisite {self.id} – {self.date_visite} – Magasin {self.magasin_id}>"

class ReponseReleveVisite(db.Model):
    __tablename__ = 'reponses_releve_visite'

    id = db.Column(db.Integer, primary_key=True)
    releve_id = db.Column(db.Integer, db.ForeignKey('releves_visite.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    reponse_text = db.Column(db.Text, nullable=True)
    reponse_option = db.Column(db.String(255), nullable=True)
    autre = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    releve = db.relationship("ReleveVisite", backref="reponses_questionnaire")
    question = db.relationship("Question", backref="reponses_donnees")

class TunnelReleveConfig(db.Model):
    __tablename__ = 'tunnel_releve_config'
    id = db.Column(db.Integer, primary_key=True)
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'))
    mission = db.relationship('Mission', backref=db.backref('tunnel_config', lazy=True))

    preparation = db.Column(db.Boolean, default=False)
    photos_avant = db.Column(db.Boolean, default=False)
    questionnaire = db.Column(db.Boolean, default=False)
    produits = db.Column(db.Boolean, default=False)
    concurrence = db.Column(db.Boolean, default=False)
    photos_apres = db.Column(db.Boolean, default=False)
    commentaire = db.Column(db.Boolean, default=False)
    ia_resume = db.Column(db.Boolean, default=False)

class BlocPreparationConfig(db.Model):
    __tablename__ = 'bloc_preparation_config'

    id = db.Column(db.Integer, primary_key=True)
    mission_id = db.Column(db.Integer, db.ForeignKey('missions.id'), nullable=False)
    objectif_principal = db.Column(db.String(255))
    objectif_secondaire = db.Column(db.String(255))
    note_objectif = db.Column(db.Integer)
    note_confiance = db.Column(db.Integer)

    mission = db.relationship('Mission', backref='bloc_preparation')
    
class ReleveProduit(db.Model):
    __tablename__ = 'releves_produits'  # ← important

    id = db.Column(db.Integer, primary_key=True)
    releve_id = db.Column(db.Integer, db.ForeignKey('releves_visite.id'))  # ← le nom correct de la table
    produit_id = db.Column(db.Integer, db.ForeignKey('produits.id'))       # ← le nom correct aussi
    presence = db.Column(db.Boolean, default=False)
    prix_constate = db.Column(db.Float, nullable=True)
    date_saisie = db.Column(db.DateTime, default=datetime.utcnow)

    produit = db.relationship('Produit')
    releve = db.relationship('ReleveVisite', back_populates='releves_produits')  # ← bon nom ici
