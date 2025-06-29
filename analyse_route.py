from flask import Flask, render_template, request
import sqlite3

app = Flask(__name__)
DB = 'crm_structurée_v4.db'

@app.route("/analyse")
def analyse():
    mission_id = request.args.get("mission_id")
    typologie = request.args.get("typologie")

    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute("SELECT id, nom_mission FROM missions")
    missions = cur.fetchall()

    cur.execute("SELECT DISTINCT typologie_magasin FROM questionnaires_meta")
    typologies = [row[0] for row in cur.fetchall()]

    query = '''
        SELECT pv.nom_magasin, pv.ville, qm.typologie_magasin, q.question_texte, r.réponse, r.date_visite
        FROM reponses r
        JOIN points_vente pv ON r.point_vente_id = pv.id
        JOIN questionnaires q ON r.question_id = q.id
        JOIN questionnaires_meta qm ON r.questionnaire_id = qm.id
        WHERE 1=1
    '''
    params = []

    if mission_id:
        query += " AND r.mission_id = ?"
        params.append(mission_id)

    if typologie:
        query += " AND qm.typologie_magasin = ?"
        params.append(typologie)

    query += " ORDER BY r.date_visite DESC"

    cur.execute(query, params)
    rows = cur.fetchall()

    resultats = []
    for row in rows:
        resultats.append({
            "magasin": row[0],
            "ville": row[1],
            "typologie": row[2],
            "question": row[3],
            "reponse": row[4],
            "date": row[5]
        })

    conn.close()
    return render_template("analyse_questionnaire.html", resultats=resultats, missions=missions, typologies=typologies)

if __name__ == '__main__':
    app.run(debug=True)
