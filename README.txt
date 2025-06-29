
=== CRM TERRAIN - DEMARRAGE AVEC PAGE ADMIN ===

1. EXTRAIRE le dossier sur le Bureau

2. OUVRIR CMD (pas PowerShell) en tant qu’administrateur

3. NAVIGUER dans le dossier :
   > cd %USERPROFILE%\Desktop\crm_project_admin

4. CREER un environnement virtuel :
   > python -m venv venv

5. ACTIVER l’environnement :
   > venv\Scripts\activate.bat

6. INSTALLER Flask :
   > pip install flask

7. LANCER l'application :
   > python app.py

8. OUVRIR dans le navigateur :
   > Questionnaire : http://127.0.0.1:5000
   > Admin : http://127.0.0.1:5000/admin
