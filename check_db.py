from app import app

print("Base utilisée actuellement :")
print(app.config['SQLALCHEMY_DATABASE_URI'])
