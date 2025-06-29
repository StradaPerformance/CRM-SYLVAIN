@echo off
REM --- Définir ton mot de passe PostgreSQL ici ---
set PGPASSWORD=Ericetramzy02

REM --- Générer la date au format AAAAMMJJ (ex : 20250514) ---
set TODAY=%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%

REM --- Exécuter pg_dump pour sauvegarder la base crm_strada ---
"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -F c -f "C:\Users\DOUAY\Desktop\start_crm_dossier\BACKUPS\backup_crm_strada_%TODAY%.backup" crm_strada
