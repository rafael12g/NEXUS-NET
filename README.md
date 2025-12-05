# 🌐 Nexus NET - Universal Network Architect

**Nexus NET** est un outil de cartographie réseau "Single-File" (fichier unique) conçu pour les administrateurs systèmes, les architectes réseaux et les étudiants. Il offre une interface moderne, sombre ("Cyberpunk/Dark Mode") et fluide pour concevoir des topologies complexes directement dans le navigateur.

> **Aucune installation requise.** Tout fonctionne dans un seul fichier HTML.

---

## ✨ Fonctionnalités Principales

### 🎨 Design & Ergonomie
- **Interface Dark Mode :** Design professionnel optimisé pour réduire la fatigue oculaire.
- **Moteur Physique :** Les nœuds s'organisent automatiquement (physique des particules) avec possibilité de figer la vue.
- **Grille Magnétique :** Alignement automatique des équipements pour des schémas ultra-propres.
- **Outils d'Alignement :** Boutons pour aligner verticalement ou horizontalement une sélection d'appareils.

### 🛠️ Création & Édition
- **Bibliothèque Complète :** Serveurs, Routeurs, Switchs, Firewalls, Cloud, PC, Imprimantes, etc.
- **Images Personnalisées :** Importez vos propres logos ou images (encodés directement dans le fichier de sauvegarde).
- **Zones & Notes :** Créez des zones de couleur avec **transparence (Opacité)** pour définir des VLANs ou des salles (DMZ, Prod, etc.).
- **Câblage Avancé :** - Câbles RJ45 (Solide)
  - Fibre Optique (Coloré)
  - Wifi / Virtuel (Pointillés)
  - Édition des liens *après* création (changement de couleur/épaisseur).

### 💾 Sauvegarde & Exports
- **Auto-Save :** Vos modifications sont sauvegardées automatiquement dans le navigateur (LocalStorage).
- **Export JSON :** Sauvegarde complète du projet (incluant les images perso) pour le transférer sur un autre PC.
- **Export Draw.io (XML) :** Génère un fichier compatible nativement avec [diagrams.net](https://app.diagrams.net/) (Draw.io).
- **Export PDF & PNG :** Génération de rapports haute définition.

---

## 🚀 Installation

1. **Télécharger :** Récupérez le fichier `nexus_v16.html`.
2. **Lancer :** Double-cliquez simplement sur le fichier pour l'ouvrir dans votre navigateur web favori (Chrome, Firefox, Edge, Brave).
3. **Prérequis :** Une connexion internet est requise lors de l'ouverture pour charger les librairies graphiques (Vis.js, FontAwesome).

---

## 📖 Guide d'Utilisation Rapide

### 1. Ajouter des Appareils
Utilisez le panneau de gauche. Entrez un **Nom**, une **IP** (optionnel), choisissez un **Type** et cliquez sur `AJOUTER`.

### 2. Connecter des Appareils (2 Méthodes)
* **Méthode Rapide (Éclair) :** Maintenez la touche `Ctrl` et cliquez sur deux appareils pour les sélectionner. Cliquez ensuite sur le bouton ⚡ (Éclair) dans la barre latérale.
* **Méthode Manuelle :** Sélectionnez la source et la destination dans les listes déroulantes et cliquez sur `CONNECTER`.

### 3. Modifier les Propriétés
Cliquez sur n'importe quel objet (Serveur, PC ou Câble). Le panneau **Inspecteur** s'ouvre à droite.
* Changez l'IP, la couleur, la taille.
* Réglez l'opacité pour créer des zones d'arrière-plan.
* Changez le style des câbles (Solide vs Pointillés).

### 4. Gérer les Fichiers
* **Glisser-Déposer :** Prenez un fichier `.json` sauvegardé et lâchez-le n'importe où sur la page pour l'ouvrir.
* **Draw.io :** Cliquez sur le bouton orange `Export vers Draw.io`. Ouvrez ensuite Diagrams.net et faites `Fichier > Ouvrir` et choisissez le fichier `.xml` généré.

---

## ⌨️ Raccourcis Clavier & Souris

| Action | Raccourci / Geste |
| :--- | :--- |
| **Sélection Multiple** | `Ctrl` + `Clic Gauche` (ou tirer un cadre avec la souris) |
| **Supprimer** | Touche `Suppr` (Delete) |
| **Fermer Menu/Inspecteur** | Touche `Echap` (Esc) |
| **Menu Contextuel** | `Clic Droit` sur un appareil |
| **Zoomer / Dézoomer** | Molette de la souris |
| **Se déplacer** | Clic gauche maintenu dans le vide + Glisser |

---

## 🛠️ Technologies Utilisées

Ce projet est construit en **HTML5 / CSS3 / JavaScript (Vanilla)**.
Il utilise les librairies CDN suivantes :
* **Vis-Network :** Moteur de rendu graphique et physique.
* **jsPDF :** Génération de fichiers PDF.
* **FontAwesome 6 :** Icônes vectorielles.
* **Google Fonts :** Typographies (Inter & JetBrains Mono).

---

## 📝 Crédits

Créé avec ❤️ pour simplifier la vie des admins réseaux.
*Version : 16.0 (Universal Edition)*
