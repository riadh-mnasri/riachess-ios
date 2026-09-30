# RiaChess iOS

[English version](README.en.md)

Application iPhone et iPad d'échecs du club [RiaChess](https://riachess.fr). Version iOS de [RiaChess Android](https://github.com/riadh-mnasri/riachess-android), dont elle reprend le code (Expo / React Native). Objectif : réunir dans une seule appli le jeu (à deux, contre l'ordinateur, en ligne), les problèmes, l'analyse des parties et l'apprentissage des ouvertures et des finales, avec le suivi pédagogique du club.

## Aperçu

| Accueil | Partie à deux | Fin de partie |
| --- | --- | --- |
| <img src="docs/screenshots/home.png" alt="Accueil" width="240" /> | <img src="docs/screenshots/local-game.png" alt="Partie à deux, cases jouables affichées" width="240" /> | <img src="docs/screenshots/game-over.png" alt="Écran de fin de partie" width="240" /> |
| **Réglages contre l'ordinateur** | **Partie contre Stockfish** | **Problèmes** |
| <img src="docs/screenshots/bot-setup.png" alt="Choix du niveau et de la couleur" width="240" /> | <img src="docs/screenshots/bot-game.png" alt="Partie contre Stockfish" width="240" /> | <img src="docs/screenshots/puzzles.png" alt="Entraînement aux problèmes" width="240" /> |
| **Analyse en direct** | **Revue de la partie** | **Import PGN** |
| <img src="docs/screenshots/analysis.png" alt="Analyse avec flèche du meilleur coup" width="240" /> | <img src="docs/screenshots/review.png" alt="Revue : courbe et précision" width="240" /> | <img src="docs/screenshots/import.png" alt="Import d'une partie PGN" width="240" /> |

Analyse et revue : partie de l'Opéra, Morphy contre le duc de Brunswick et le comte Isouard (Paris, 1858).

## Sommaire

- [Aperçu](#aperçu)
- [Fonctionnalités](#fonctionnalités)
- [Tester sur un iPhone](#tester-sur-un-iphone)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Moteur d'échecs](#moteur-déchecs)
- [Démarrer en local](#démarrer-en-local)
- [Scripts npm](#scripts-npm)
- [Tests](#tests)
- [Builds et publication](#builds-et-publication)
- [Feuille de route](#feuille-de-route)
- [Contribuer](#contribuer)
- [Licence et crédits](#licence-et-crédits)

## Fonctionnalités

### Disponibles

**Échiquier**
- Coups au toucher (pièce puis case) ou au glisser-déposer.
- Cases jouables affichées, captures signalées par un anneau.
- Surlignage du dernier coup et du roi en échec.
- Coordonnées sur le bord du plateau, plateau retournable.
- Choix de la pièce lors d'une promotion.
- Pièces vectorielles nettes à toutes les tailles d'écran.

**Partie à deux** : deux joueurs sur le même appareil.

**Contre l'ordinateur** : Stockfish 19, 8 niveaux, choix des Blancs, des Noirs ou au hasard. L'ordinateur réfléchit sans bloquer l'interface. « Reprendre » annule votre coup et celui de l'ordinateur.

**Analyse**
- Analyse en continu de la position par Stockfish à pleine force : barre d'évaluation, meilleure suite en notation algébrique, profondeur de calcul.
- Flèche du meilleur coup sur l'échiquier ; moteur activable ou non.
- Revue de la partie : chaque position est évaluée, les imprécisions (?!), erreurs (?) et gaffes (??) sont signalées avec les seuils de Lichess.
- Précision de chaque joueur en %, courbe d'évaluation cliquable pour aller à un coup.
- Navigation coup par coup ; jouer un autre coup ouvre une nouvelle suite.
- Import d'une partie PGN (Lichess, chess.com...), échiquier libre, bouton « Analyser la partie » en fin de partie.

**Problèmes**
- 2 464 puzzles de la base Lichess, hors ligne, de 400 à 2 800 de classement.
- Puzzle choisi au plus près du classement du joueur, jamais deux fois le même.
- Filtres par thème : mats, fourchettes, clouages, enfilades, sacrifices, finales.
- Réponses automatiques de l'adversaire ; tout coup qui donne mat est accepté.
- Classement de type Elo, série en cours et nombre de réussites, gardés sur l'appareil.
- Réessayer ou voir la solution après une erreur.

**Pendant la partie**
- Détection de l'échec, du mat et des nulles : pat, triple répétition, règle des 50 coups, matériel insuffisant.
- Pièces prises et avantage matériel affichés pour chaque camp.
- Liste des coups en notation algébrique.
- Copie de la partie au format PGN, avec la date et les noms des joueurs.
- Retour haptique à chaque coup sur téléphone.

**Général** : interface en français et en anglais (langue de l'appareil par défaut, bascule depuis l'accueil), thème bleu nuit et or du club, mention de copyright en bas de chaque écran.

### À venir

Jeu en ligne via Lichess, section Apprendre, compte RiaChess : voir la [feuille de route](#feuille-de-route).

## Tester sur un iPhone

**Avec Expo Go (sans compte Apple).**
1. Installer [Expo Go](https://apps.apple.com/app/expo-go/id982107779) depuis l'App Store.
2. Lancer `npm start` sur l'ordinateur, l'iPhone étant sur le même Wi-Fi.
3. Scanner le QR code affiché dans le terminal avec l'appareil photo.

**Avec TestFlight (appli installée).** Nécessite un compte [Apple Developer](https://developer.apple.com/programs/) (99 $ par an). L'appli est construite avec le profil `production`, envoyée sur App Store Connect, puis installée depuis l'appli TestFlight.

**Dans le simulateur iOS (Mac avec Xcode).** Le profil `simulator` produit une appli pour le simulateur, sans compte Apple.

## Stack technique

| Domaine | Choix |
| --- | --- |
| Framework | [Expo](https://expo.dev) SDK 57, React Native 0.86, TypeScript strict |
| Navigation | Expo Router (écrans dans `src/app/`) |
| Règles du jeu | [chess.js](https://github.com/jhlywa/chess.js) |
| Échiquier | Composant maison : react-native-gesture-handler, react-native-svg |
| Moteur | [Stockfish.js](https://github.com/nmrugg/stockfish.js) 19 (WASM), Web Worker ou WebView |
| Tests | Jest (`jest-expo`) |
| Builds | EAS Build (iOS dans le cloud) |

## Architecture

Le code sépare les règles du jeu de l'affichage, pour que la logique reste testable sans téléphone :

```
src/
  app/                    écrans Expo Router
    index.tsx             accueil
    play/local.tsx        partie à deux
    play/bot.tsx          partie contre l'ordinateur
    analysis.tsx          analyse et revue de partie
    puzzles.tsx           problèmes
  domain/                 logique pure, sans React ni React Native
    game.ts               état de partie, coups, statut, matériel, PGN
    bot.ts                niveaux de l'ordinateur, choix du coup
    analysis.ts           chances de gain, classement des coups, précision
    puzzle.ts             déroulé d'un puzzle, classement, choix du puzzle
  data/
    puzzles.json          sélection de la base de puzzles Lichess
  infrastructure/
    storage/              progression sur les problèmes (AsyncStorage)
    engine/               adaptateurs vers Stockfish
      uci.ts              protocole UCI, file d'attente des demandes
      EngineHost.tsx      iPhone et iPad : WebView invisible
      EngineHost.web.tsx  web : Web Worker
      bootstrap.ts        démarrage du worker Stockfish
  ui/
    board/                échiquier, géométrie, pièces SVG
    game/GameView.tsx     écran de partie commun aux modes de jeu
    analysis/             barre d'évaluation, courbe de la revue
    theme.ts              couleurs du club
  i18n/                   textes FR/EN
scripts/
  build-engine.mjs        embarque Stockfish au moment de l'installation
  build-puzzles.mjs       extrait les puzzles de la base Lichess
```

**Principes**
- `domain/` ne dépend d'aucun framework. Un état de partie est immuable : chaque coup produit un nouvel état.
- L'accès au moteur passe par une interface UCI (`UciTransport`). Remplacer la WebView par un module natif ne touchera pas au reste de l'appli.
- Metro choisit l'adaptateur selon la plateforme grâce aux suffixes `.web.tsx` et `.tsx`.

## Moteur d'échecs

L'appli embarque **Stockfish 19 « lite », version single-thread** : 1,8 Mo de WASM, avec un réseau de neurones allégé. À l'installation des dépendances, `scripts/build-engine.mjs` le convertit en module TypeScript (`src/infrastructure/engine/generated/`, non versionné). Le moteur fonctionne donc **hors ligne**.

- **Web** : le moteur tourne dans un Web Worker créé à partir du script embarqué.
- **iPhone et iPad** : le même worker tourne dans une WebView invisible. Ça fonctionne dans Expo Go, sans module natif. Un module natif C++, plus rapide, est prévu avec l'analyse.

**Niveaux**

| Niveau | Nom | Skill Level | Profondeur | Temps max | Coups au hasard |
| --- | --- | --- | --- | --- | --- |
| 1 | Découverte | 0 | 1 | 50 ms | 45 % |
| 2 | Débutant | 0 | 2 | 100 ms | 25 % |
| 3 | Débutant + | 2 | 3 | 150 ms | 12 % |
| 4 | Club | 5 | 5 | 200 ms | 5 % |
| 5 | Club + | 8 | 6 | 300 ms | 0 % |
| 6 | Confirmé | 11 | 8 | 400 ms | 0 % |
| 7 | Fort | 15 | 12 | 600 ms | 0 % |
| 8 | Maximum | 20 | 18 | 1 s | 0 % |

Même réglé au plus faible, Stockfish reste trop fort pour un débutant. Les premiers niveaux jouent donc une partie de leurs coups au hasard. Ces réglages sont dans `src/domain/bot.ts`.

**Analyse** : le moteur joue à pleine force (Skill Level 20). L'analyse en continu va jusqu'à la profondeur 18. La revue évalue chaque position à la profondeur 12, avec au plus 400 ms par position. Les coups sont classés selon la perte de chances de gain (courbe de Lichess) : 0,1 pour une imprécision, 0,2 pour une erreur, 0,3 pour une gaffe.

## Problèmes

Les puzzles viennent de la [base ouverte de Lichess](https://database.lichess.org/#puzzles) (licence CC0, environ 6 millions de puzzles). `scripts/build-puzzles.mjs` en garde une sélection :
- puzzles populaires (popularité ≥ 85), joués au moins 2 000 fois, au classement fiable (écart ≤ 80) ;
- 125 puzzles au plus par tranche de 100 points, de 400 à 2 800, tirés au hasard de façon reproductible.

Pour régénérer la sélection (outil `zstd` requis) :

```bash
curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
node scripts/build-puzzles.mjs lichess_db_puzzle.csv.zst
```

## Démarrer en local

**Prérequis** : Node.js 20 ou plus récent, npm.

```bash
git clone https://github.com/riadh-mnasri/riachess-ios.git
cd riachess-ios
npm install        # installe les dépendances et embarque Stockfish
npm run web        # ouvre l'appli dans le navigateur : http://localhost:8191
npm start          # serveur Metro sur le port 8191, pour Expo Go ou un build de développement
```

Le port de développement est **8191** (8190 pour la version Android, pour pouvoir lancer les deux en même temps). Aucune variable d'environnement n'est nécessaire pour l'instant.

## Scripts npm

| Commande | Rôle |
| --- | --- |
| `npm start` | Serveur Metro (port 8191) |
| `npm run web` | Version web dans le navigateur |
| `npm run ios` | Ouvre l'appli dans le simulateur iOS |
| `npm test` | Tests Jest |
| `npm run typecheck` | Vérification TypeScript |
| `postinstall` | Régénère le module Stockfish embarqué (automatique) |

## Tests

```bash
npm test
npm run typecheck
```

Les tests couvrent :
- **le domaine** : coups légaux, mat, pat, promotion, reprise, matériel, import et export PGN, niveaux et choix du coup de l'ordinateur, chances de gain, classement des coups, précision, déroulé d'un puzzle, classement Elo, choix du puzzle ;
- **la géométrie du plateau** : case touchée selon l'orientation, lecture du FEN ;
- **l'adaptateur UCI**, avec un faux moteur : initialisation, meilleur coup, analyse, lecture des lignes `info`, demandes traitées l'une après l'autre.

Les tests suivent la structure `Given / When / Then`.

## Builds et publication

Les builds passent par [EAS](https://docs.expo.dev/eas/), sans Xcode en local. Profils définis dans `eas.json` :

| Profil | Sortie | Compte Apple | Usage |
| --- | --- | --- | --- |
| `simulator` | Appli pour le simulateur iOS | Non | Tester sur un Mac |
| `preview` | IPA pour des iPhone enregistrés | Oui | Tests sur des appareils précis |
| `development` | Build de développement | Oui | Déboguer du code natif |
| `production` | IPA pour l'App Store | Oui | TestFlight puis publication |

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios   # envoi vers App Store Connect / TestFlight
```

Publier sur l'App Store demande un compte Apple Developer (99 $ par an) et passe par la relecture d'Apple, en général 1 à 3 jours.

## Feuille de route

| Phase | Contenu | État |
| --- | --- | --- |
| 1. Fondations | Échiquier, partie à deux, PGN, FR/EN | Fait |
| 2. Contre l'ordinateur | Stockfish, 8 niveaux | Fait |
| 3. Analyse | Barre d'évaluation, meilleurs coups, revue, précision, import PGN | Fait |
| 4. Problèmes | Puzzles Lichess (CC0) hors ligne, classement, thèmes | Fait |
| 5. Apprendre | Répertoires d'ouvertures en répétition espacée, leçons de finales | À venir |
| 6. Jeu en ligne | Parties sur Lichess via l'API officielle | À venir |
| 7. Comptes | Connexion avec le compte riachess.fr, statut premium | À venir |
| 8. Espace club | Devoirs donnés par le coach, suivi des élèves | Après le MVP |

## Contribuer

- Messages de commit au format Angular : `type(scope): sujet` (ex. `feat(board): add premoves`).
- Avant de proposer un changement : `npm test` et `npm run typecheck` doivent passer.
- Toute logique de jeu va dans `src/domain/`, avec ses tests.

## Licence et crédits

- Code sous licence [GPL-3.0-or-later](LICENSE), compatible avec Stockfish.
- [Stockfish](https://stockfishchess.org) (GPLv3), dans son portage WASM [Stockfish.js](https://github.com/nmrugg/stockfish.js) de Nathan Rugg.
- Pièces « cburnett » de Colin M.L. Burnett (GPLv2+), le jeu de pièces par défaut de [Lichess](https://lichess.org).
- [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause).
- Puzzles : [base de données Lichess](https://database.lichess.org/#puzzles) (CC0).

© 2026 Riadh MNASRI
