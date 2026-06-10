# Nexus NET v3.0

Outil de cartographie réseau avec éditeur visuel (vis-network), intégration Docker et monitoring système. Refonte complète de la v2 : architecture modulaire, sécurité renforcée, bugs corrigés.

## Fonctionnalités

- **Éditeur de plans réseau** : nœuds typés (serveur, routeur, switch, PC, cloud…), liaisons, alignement, grille magnétique, minimap, règles, légende, exports JSON / PDF / Draw.io
- **Intégration Docker** : import des conteneurs en un clic, génération automatique de schéma, actions start/stop/restart, stats temps réel
- **Monitoring** : CPU, RAM, disque, réseau de la machine hôte
- **Multi-utilisateurs** : comptes avec sessions persistées en MySQL
- **Bug reports** : formulaire intégré, stockage en base

## Installation

### Prérequis
- Node.js ≥ 18
- MySQL ≥ 8 (ou MariaDB ≥ 10.6)
- Docker (optionnel, pour l'intégration conteneurs)

### En local

```bash
npm install
cp .env.example .env      # puis éditer les valeurs
npm start                 # ou: npm run dev (avec --watch)
```

Le schéma SQL (`schema.sql`) est appliqué automatiquement au démarrage. L'application écoute sur `http://localhost:3000` par défaut.

### Avec Docker Compose

```bash
cp .env.example .env      # définir DB_PASSWORD, DB_ROOT_PASSWORD, SESSION_SECRET
docker compose up -d --build
```

> ⚠️ Le `docker-compose.yml` monte `/var/run/docker.sock` pour permettre la gestion des conteneurs depuis l'app. Cela donne à l'application un contrôle total sur le démon Docker de l'hôte. Retirez ce volume et mettez `DOCKER_ENABLED=false` si vous n'en avez pas besoin.

## Configuration (`.env`)

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `NODE_ENV` | `development` | `production` active cookies sécurisés + secret obligatoire |
| `DB_HOST` / `DB_PORT` | `localhost` / `3306` | MySQL |
| `DB_USER` / `DB_PASSWORD` | — | Identifiants MySQL |
| `DB_NAME` | `nexus_net` | Base de données |
| `SESSION_SECRET` | — | **Obligatoire en production** (≥ 32 caractères aléatoires) |
| `DOCKER_ENABLED` | `true` | Active l'intégration Docker |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Socket du démon |
| `TRUST_PROXY` | `false` | Mettre `true` derrière un reverse proxy |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Architecture

```
src/
├── server.js          # Point d'entrée, store sessions, arrêt gracieux
├── app.js             # Assemblage Express, Helmet/CSP, sessions, CSRF
├── config/            # Lecture et validation de l'environnement
├── db/                # Pool mysql2/promise, application du schéma, retry
├── middleware/        # auth (requireLogin…), CSRF, validation d'entrées
├── routes/            # auth, pages, api/ (plans, docker, monitoring)
└── services/          # docker (dockerode + cache ping), monitoring
public/
├── css/               # style.css (global) + editor.css
└── js/                # ui.js (navbar/confirmations) + editor.js (éditeur complet)
views/                 # EJS (aucun JS inline — compatible CSP stricte)
```

## Principales différences v2 → v3

**Sécurité**
- Protection CSRF sur tous les formulaires et appels API (token de session)
- CSP stricte sans `unsafe-inline` pour les scripts : tout le JS a été externalisé
- `session.regenerate()` au login (anti-fixation), messages d'erreur génériques
- Validation des entrées côté serveur (longueurs, email, taille et structure des plans — max 5 Mo)
- Rate limiting sur l'authentification (10 essais / 15 min) et l'API (120 req/min)
- bcrypt à 12 rounds, secrets jamais commités, credentials docker-compose obligatoires (`${VAR:?}`)
- Conteneur non-root, image multi-stage

**Fiabilité**
- `mysql2/promise` + async/await (fin des callbacks imbriqués)
- Sessions persistées en MySQL (survivent au redémarrage)
- Retry de connexion BDD au démarrage, arrêt gracieux (SIGTERM/SIGINT)
- Bugs corrigés : variables EJS manquantes, changement de mot de passe forcé à l'inscription, staleness de session

**Fonctionnel**
- Suppression et renommage de plans depuis le dashboard
- Bug reports en base (plus de fichier log), suppression en cascade des données utilisateur
- Page d'erreur propre (404/500)
