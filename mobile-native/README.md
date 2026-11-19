# CRM Terrain V0.2 — application native iOS et Android

**Projet React Native / Expo SDK 58**, avec des écrans natifs : Ma journée, Agenda, Mon parc, Objectifs, Visite, Paramètres. Le CRM web reste séparé et conserve les données et permissions.

## Ce qui est inclus

- Connexion au CRM Sylvain V2 via `https://crm-sylvain-v2.hatchable.site/native-bridge.html` ; la WebView est réservée à la connexion/session et aux appels API, les écrans métiers sont natifs.
- Mission unique affichée sans sélecteur ; choix de mission uniquement pour les utilisateurs qui en possèdent plusieurs.
- Matin, lorsque le réseau est disponible : récupération du parc autorisé, des objectifs, des huit jours de programme et des questionnaires publiés.
- Localement : SQLite garde les données de tournée, les visites/brouillons et les réponses ; les photographies sont compressées et copiées dans le dossier privé de l'application. Un ticket de connexion vérifiée est stocké dans SecureStore, valable 48 h au maximum pour travailler hors connexion.
- Une file d'envoi traite les visites puis les réponses, photos, actions et la clôture, avec identifiants d'opération pour éviter les doublons ; les données locales ne sont marquées « synchronisées » qu'après confirmation serveur.
- Paramètres : synchronisation manuelle, progression, nombre de visites/photos/actions en attente, erreurs et libération de photos **confirmées transmises uniquement**.

## Prérequis

Node.js 22+, npm, puis dans ce dossier :

```bash
npm install
npx expo install --fix
npx expo start
```

Expo Go permet une **prévisualisation en développement**, mais ne remplace pas un build signé pour les essais en mode avion (le serveur Expo local est alors inaccessible). La page d'essai mobile est `https://crm-sylvain-v2.hatchable.site/test-app-native.html`.

### Construire une véritable application

- Android APK : ouvrir la branche `feature/crm-terrain-native`, puis récupérer l'artefact de la workflow GitHub Actions `CRM Terrain Android APK` si le build est vert ; sinon `eas build --platform android --profile preview` après configuration d'Expo/EAS.
- iOS : nécessite signature Apple Developer, un build EAS iOS et, au choix, TestFlight ou un provisionnement ad hoc ; Expo Go seul ne produit pas de binaire iOS installable.

## Scénario de recette indispensable (mission de test)

1. Se connecter avec un compte commercial, vérifier les missions et son parc, lancer « Synchroniser maintenant ».
2. Vérifier que les questionnaires sont disponibles ; activer le mode avion, créer une visite, saisir réponses, prendre une photo et terminer la visite.
3. Fermer puis rouvrir l'application **sans connexion** et retrouver le relevé, les réponses, les photos et les envois en attente.
4. Réactiver le réseau, attendre ou forcer la synchronisation ; confirmer que le CRM affiche **une seule** visite, toutes ses réponses et photos.
5. Couper le réseau pendant un transfert, relancer ; confirmer l'absence de doublons et la préservation des données.
6. Tester une erreur serveur et une affectation/révocation changée, la reprise après fermeture, et la gestion des questionnaires modifiés.

## Limites avant un vrai déploiement à l'équipe

**V0.2 reste un prototype avancé non encore réceptionné sur de vrais appareils.** Aucune garantie d'envoi immédiat en arrière-plan sur iOS ; la synchronisation est relancée au retour dans l'application et au retour du réseau. L'application conserve les photos non envoyées et signale un conflit de questionnaire au lieu de les écraser. Les questionnaires conditionnels/complexes sont validés définitivement par le serveur ; les types avancés nécessitent encore des tests de compatibilité. Les données SQLite sont isolées par compte utilisateur, mais leur chiffrement au repos et l'effacement distant en cas de perte de téléphone restent des sujets à traiter avant un déploiement sensible.

Le CRM serveur V213 est publié ; la branche native doit encore réussir la compilation et la recette sur appareil. Ne pas fusionner la branche de développement dans la branche principale avant les tests.