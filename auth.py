from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_user, logout_user, login_required
from werkzeug.security import check_password_hash
from models import User
from app import db
from flask_login import LoginManager

login_manager = LoginManager()
login_manager.login_view = "auth.login"

auth = Blueprint("auth", __name__)

@auth.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash("Connexion réussie ✅", "success")
            if user.role == "terrain":
                return redirect(url_for("agenda_utilisateur", user_id=user.id))
            elif user.role == "responsable":
                return redirect(url_for("agenda_global"))
            elif user.role == "admin":
                return redirect(url_for("admin_missions"))
            else:
                return redirect(url_for("afficher_utilisateurs"))
        flash("Email ou mot de passe invalide", "danger")
    return render_template("login.html")

@auth.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Déconnexion réussie", "info")
    return redirect(url_for("auth.login"))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))