# 🌐 Nexus NET - Universal Network Architect

**Nexus NET** est un outil de cartographie réseau et de gestion d'infrastructure pour admins systèmes, architectes réseaux et DevOps. L’interface est moderne, sombre et pensée pour concevoir des topologies complexes et piloter Docker depuis le navigateur.

---

## ✨ Fonctionnalités Principales

### 🐳 Gestion Docker
- **Nœuds Docker :** Ajoutez des containers Docker à vos schémas réseau (icône Docker)
- **Importer Sélectif :** Choisissez les containers à ajouter depuis une liste
- **Générer Schéma :** Ajoute tous les containers et crée un schéma automatique
- **Contrôle en Temps Réel :** Statut coloré :
  - 🟢 Running
  - 🔴 Stopped/Exited
  - 🟡 Paused/Restarting
  - ⚪ Non connecté
- **Actions Directes :** Start/Stop/Restart via l’inspecteur
- **Monitoring par container :** CPU/RAM affichés sur les nœuds Docker
- **API REST :** Docker Engine via `dockerode`

### 🗺️ Interface Améliorée (Style Draw.io)
- **Minimap :** Vue d'ensemble du réseau en bas à droite avec navigation rapide
- **Légende Dynamique :** Panneau rétractable affichant tous les types d'équipements présents
- **Statistiques en Direct :** 
  - Nombre total de nœuds
  - Nombre de connexions
  - État des containers Docker (Running/Stopped)
- **Navigation Améliorée :** 
  - Boutons de zoom +/- bien visibles
  - Bouton "Fit to Screen" pour tout afficher
  - Raccourci clavier `F` pour centrer la vue

### 🎨 Design & Ergonomie
- **Interface Dark Mode :** Design professionnel optimisé pour réduire la fatigue oculaire
- **Personnalisation :** Couleur d’accent modifiable dans Paramètres
- **Moteur Physique :** Les nœuds s'organisent automatiquement avec possibilité de figer la vue
- **Grille Magnétique :** Alignement automatique des équipements pour des schémas ultra-propres
- **Outils d'Alignement :** Boutons pour aligner verticalement ou horizontalement une sélection d'appareils

### 🛠️ Création & Édition
- **Bibliothèque Complète :** Serveurs, Routeurs, Switchs, Firewalls, Cloud, PC, Imprimantes, Docker Containers, etc.
- **Images Personnalisées :** Importez vos propres logos ou images
- **Zones & Notes :** Créez des zones de couleur avec **transparence (Opacité)** pour définir des VLANs ou des salles (DMZ, Prod, etc.)
- **Câblage Avancé :** 
  - Câbles RJ45 (Solide)
  - Fibre Optique (Coloré)
  - Wifi / Virtuel (Pointillés)
  - Édition des liens *après* création (changement de couleur/épaisseur)

### 💾 Sauvegarde & Exports
- **Auto-Save :** Vos modifications sont sauvegardées automatiquement sur le serveur
- **Export JSON :** Sauvegarde complète du projet pour le transférer
- **Export Draw.io (XML) :** Génère un fichier compatible nativement avec [diagrams.net](https://app.diagrams.net/)
- **Export PDF & PNG :** Génération de rapports haute définition

---

## 🚀 Installation

### Prérequis
- Node.js 18+
- npm
- Docker (optionnel, pour la gestion des containers)
- Base de données MySQL

### Installation
```bash
# Cloner le dépôt
git clone https://github.com/rafael12g/NEXUS-NET.git
cd NEXUS-NET

# Installer les dépendances
npm install

# Configurer l'environnement (Créer un fichier .env)
# Voir la section Configuration ci-dessous pour le contenu
```

### Configuration (.env)

Créez un fichier `.env` à la racine du projet avec vos paramètres de base de données :

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=nexus_net
PORT=3000
SESSION_SECRET=votre_secret_securise
```

### Base de Données

La base est initialisée automatiquement depuis `schema.sql` au premier démarrage. Si besoin, vous pouvez toujours importer manuellement ce fichier.

### Lancement

```bash
# Lancer le serveur
npm start
```

Ou sur Windows, double-cliquez simplement sur le fichier `start.bat`.

Le serveur démarre sur `http://localhost:3000`

### Configuration Docker (Optionnel)

Pour activer la gestion Docker, assurez-vous que Docker Engine est accessible :

**Linux/Mac :**
- Le socket Unix `/var/run/docker.sock` doit être accessible
- L'utilisateur exécutant Node.js doit avoir les permissions Docker

**Windows :**
- Docker Desktop doit être installé et en cours d'exécution
- L'application se connecte automatiquement via le named pipe `//./pipe/docker_engine` (sécurisé)

**Test de connexion :** vérifiez que Docker répond via `docker ps`.

### Docker Compose (recommandé)

Utilisez `docker-compose.yml` (DB auto-initialisée + app) :
- DB exposée en local sur `127.0.0.1:3306`
- limites CPU/RAM + rotation des logs
- variables d’env (DB_*, COOKIE_SECURE, TRUST_PROXY)

---

## 📖 Guide d'Utilisation Rapide

### 1. Ajouter des Appareils
Utilisez le panneau de gauche. Entrez un **Nom**, une **IP** (optionnel), choisissez un **Type** et cliquez sur le bouton correspondant.

### 2. Importer des Containers Docker
1. Cliquez sur **"Importer Sélectif"** dans la section Docker
2. Une fenêtre s'ouvre avec la liste des containers
3. Cliquez sur un container pour l'ajouter au schéma
4. L'état et les stats sont synchronisés

### 3. Gérer les Containers Docker
1. Cliquez sur un nœud Docker dans le schéma
2. L'inspecteur s'ouvre à droite avec les contrôles Docker
3. Utilisez les boutons Start/Stop/Restart pour contrôler le container
4. Cliquez sur "Rafraîchir" pour mettre à jour l'état

### 4. Connecter des Appareils (2 Méthodes)
* **Méthode Rapide (Éclair) :** Maintenez la touche `Ctrl` et cliquez sur deux appareils pour les sélectionner. Cliquez ensuite sur le bouton ⚡ (Éclair) dans la barre latérale
* **Méthode Manuelle :** Sélectionnez la source et la destination dans les listes déroulantes et cliquez sur `CONNECTER`

### 5. Modifier les Propriétés
Cliquez sur n'importe quel objet (Serveur, PC ou Câble). Le panneau **Inspecteur** s'ouvre à droite.
* Changez l'IP, la couleur, la taille
* Réglez l'opacité pour créer des zones d'arrière-plan
* Changez le style des câbles (Solide vs Pointillés)

### 6. Navigation dans les Grands Schémas
- **Minimap :** Utilisez la minimap en bas à droite pour naviguer rapidement
- **Zoom :** Utilisez les boutons +/- en haut à droite ou la molette de la souris
- **Fit to Screen :** Cliquez sur le bouton d'expansion pour voir tout le réseau
- **Touche F :** Appuyez sur `F` pour centrer automatiquement la vue

### 7. Gérer les Fichiers
* **Glisser-Déposer :** Prenez un fichier `.json` sauvegardé et lâchez-le n'importe où sur la page pour l'ouvrir
* **Draw.io :** Cliquez sur le bouton orange `Export vers Draw.io`. Ouvrez ensuite Diagrams.net et faites `Fichier > Ouvrir` et choisissez le fichier `.xml` généré

---

## ⌨️ Raccourcis Clavier & Souris

| Action | Raccourci / Geste |
| :--- | :--- |
| **Sélection Multiple** | `Ctrl` + `Clic Gauche` (ou tirer un cadre avec la souris) |
| **Supprimer** | Touche `Suppr` (Delete) |
| **Fermer Menu/Inspecteur** | Touche `Echap` (Esc) |
| **Centrer la Vue** | Touche `F` |
| **Menu Contextuel** | `Clic Droit` sur un appareil |
| **Zoomer / Dézoomer** | Molette de la souris ou boutons +/- |
| **Se déplacer** | Clic gauche maintenu dans le vide + Glisser |

---

## 🛠️ Technologies Utilisées

### Backend
- **Node.js** avec Express
- **MySQL** pour la persistance des données
- **Dockerode** pour l'intégration Docker
- **bcrypt** pour la sécurité des mots de passe
- **EJS** pour le rendu des templates

### Frontend
- **HTML5 / CSS3 / JavaScript (Vanilla)**
- **Vis-Network :** Moteur de rendu graphique et physique
- **jsPDF :** Génération de fichiers PDF
- **FontAwesome 6 :** Icônes vectorielles (incluant fa-docker)
- **Google Fonts :** Typographies (Inter & JetBrains Mono)

---

## 🔌 API Docker

L'application expose une API REST pour interagir avec Docker :

```
GET  /api/docker/containers           - Liste tous les containers
GET  /api/docker/containers/:id/status - État d'un container
GET  /api/docker/containers/:id/stats  - CPU/RAM d'un container
POST /api/docker/containers/:id/start  - Démarrer un container
POST /api/docker/containers/:id/stop   - Arrêter un container
POST /api/docker/containers/:id/restart - Redémarrer un container
GET  /api/docker/networks              - Liste les réseaux Docker
```

---

## 🔧 Dépannage

### Docker non disponible
Si vous voyez le message "Docker non disponible" :
1. Vérifiez que Docker est installé et en cours d'exécution : `docker ps`
2. Sur Linux/Mac, vérifiez les permissions du socket : `ls -l /var/run/docker.sock`
3. Sur Windows, vérifiez que Docker Desktop est démarré
4. Redémarrez le serveur NEXUS-NET après avoir résolu le problème

### Erreur de connexion à la base de données
1. Vérifiez vos paramètres dans le fichier `.env`
2. Assurez-vous que MySQL est en cours d'exécution
3. Vérifiez que la base de données a été créée avec le fichier `schema.sql`

---

## 📝 Crédits & Licence

Créé avec ❤️ pour simplifier la vie des admins réseaux et DevOps.

**Version : 2.0.0** - Docker Integration & Enhanced UI

---

## 🗺️ Roadmap

### Version 3.0.0 (À venir)
- Alertes et notifications
- Support Kubernetes
- Thèmes avancés (light/dark)
- Mode collaboration multi-utilisateurs

