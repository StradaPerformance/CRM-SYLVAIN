
@app.route("/admin/magasins/import", methods=["GET", "POST"])
def import_magasins():
    missions = Mission.query.filter_by(statut='active').all()

    if request.method == "POST":
        mission_id = request.form.get("mission_id")
        fichier = request.files.get("fichier")

        if not fichier or not mission_id:
            flash("Veuillez fournir un fichier et sélectionner une mission.", "danger")
            return redirect(request.url)

        df = pd.read_excel(fichier)

        for _, row in df.iterrows():
            nom = row.get("Nom usage")
            enseigne = row.get("nom_enseigne")
            adresse = row.get("adresse_magasin")
            ville = row.get("ville_magasin")
            code_postal = str(row.get("codepostal_magasin"))
            téléphone = row.get("tel_magasin")
            fax = row.get("fax_magasin")
            surface = row.get("surface_magasin")
            typologie = row.get("type_magasin")
            centrale = row.get("nom_centrale")
            statut = str(row.get("statut_magasin")).strip().lower() == "actif"
            vip = str(row.get("vip_magasin")).strip().lower() == "oui"
            rythme = row.get("rythme_magasin")
            code_tdlink = row.get("Code TTDlinks")

            nom_cdr = row.get("nomCDR")
            tel_cdr = row.get("telCDR")
            email_cdr = row.get("emailCDR")

            cs_email = row.get("login CS") or row.get("email")
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
                mission_id=mission_id,
                chef_secteur_id=cs_user.id if cs_user else None
            )

            db.session.add(magasin)

        db.session.commit()
        flash("✅ Magasins importés avec succès", "success")
        return redirect(url_for("admin_missions"))

    return render_template("admin_magasins_import.html", missions=missions)
