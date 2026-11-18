# CRM Terrain — application native iPhone / Android

Prototype **React Native / Expo SDK 58**. Les écrans (journée, agenda, parc, objectifs, relevé) sont écrits en composants natifs React Native. Ce n'est pas un emballage WebView du CRM.

## Connexion

Le CRM Hatchable garde les comptes, autorisations, sessions et données. Une *WebView limitée à la connexion et aux appels API* reste invisible une fois l'utilisateur connecté. Elle charge `https://crm-sylvain-v2.hatchable.site/native-bridge.html` (page publiée dans le projet CRM, v210), ou la page de login s'il n'est pas connecté. Les écrans métiers ne sont jamais rendus en WebView.

La passerelle utilise **uniquement les API existantes**, avec les cookies de connexion du CRM, et une liste blanche de chemins et méthodes. **Aucun mot de passe, jeton CRM ou clé API n'est présent dans l'application.** Les permissions restent décidées côté serveur. Révoquer le compte terrain dans le CRM le rend également inutilisable sur mobile lors du prochain appel.

## Démarrer le projet

1. Installer Node.js 22.13 ou plus récent et npm.
2. Dans ce dossier : `npm install` puis `npx expo install --fix` pour aligner les dépendances sur le SDK 58.
3. `npx expo start` pour ouvrir dans Expo Go (premier test des écrans natifs), ou fabriquer un développement build.

## Créer les applications installables

- Android : `npm install -g eas-cli`, `eas login`, `eas build --platform android --profile preview` => **APK installable**.
- iPhone : `eas login`, `eas build --platform ios --profile preview` => **application iOS ad hoc** ; requiert un compte Apple Developer et l'enregistrement de l'iPhone dans le profil de distribution. Une version TestFlight pourra être créée avec `eas build --platform ios --profile production` et `eas submit --platform ios`.
- Alternative Android locale : `npx expo prebuild --platform android`, puis `cd android && ./gradlew assembleRelease` si un SDK Android est configuré.

**Important** : Ce ZIP est du code source prêt à compiler, pas un APK/IPA. La compilation cloud exige les identifiants Expo (et Apple pour l'iPhone), à connecter côté propriétaire. Le code a été vérifié statiquement, mais pas exécuté sur appareil physique dans cet environnement.

## Parcours de test conseillé

- Compte collaborateur invité : se connecter par e-mail/code sur la page CRM intégrée.
- Ma journée : vérifier les créneaux réels du compte, la fiche magasin et les statuts.
- Agenda : naviguer entre plusieurs dates.
- Mon parc : vérifier uniquement le périmètre du collaborateur et ouvrir un itinéraire.
- Objectifs : vérifier les objectifs accessibles à sa mission.
- Relevé : démarrer/reprendre une visite, modifier une réponse et la terminer (test sur mission dédiée pour ne pas polluer les données de production).
- Désactiver le compte dans CRM : vérifier l'impossibilité d'utiliser l'app à la prochaine requête.

## Limites V0.1

- Pas de synchronisation hors ligne (les réponses sont sauvegardées sur l'API en ligne seulement).
- Les questionnaires sont rendus sous forme Oui/Non, choix ou saisie simple ; les règles conditionnelles et tous les types avancés nécessiteront une V0.2.
- Les listes d'actions et indicateurs sont lus depuis le CRM, sans copie des données.
- La passerelle de connexion doit être conservée dans le CRM.

Le projet CRM web n'est pas remplacé. Les nouvelles APIs de la précédente V209 et toutes les vues manager restent intactes.
