import requests
from time import time

adresse = "9 rue des Lilas, 75019 Paris, France"
API_KEY = "AIzaSyDPMEnHfnliE7sKWpb0NVdCtpHaU_4X1Mk"  # Remplace par ta vraie clé

start = time()
response = requests.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    params={"address": adresse, "key": API_KEY},
    timeout=10
)
end = time()

print(f"Réponse en {round(end - start, 2)} secondes")
print("Status:", response.status_code)
print("Contenu JSON:", response.json())
