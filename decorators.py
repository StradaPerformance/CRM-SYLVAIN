from flask import redirect, url_for, flash
from flask_login import current_user
from functools import wraps

def role_required(*roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                flash("Veuillez vous connecter.", "warning")
                return redirect(url_for("login"))  # ✅ PAS "auth.login"
            if current_user.type_utilisateur not in roles:
                flash("⛔ Accès non autorisé pour ce rôle.", "danger")
                return redirect(url_for("admin_magasins"))
            return view_func(*args, **kwargs)
        return wrapper
    return decorator
