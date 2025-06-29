from flask_wtf import FlaskForm
from wtforms import HiddenField, SelectMultipleField
from wtforms.validators import DataRequired

class AssocierMissionsForm(FlaskForm):
    enseigne_id = HiddenField(validators=[DataRequired()])
    missions = SelectMultipleField('Missions', coerce=int)
