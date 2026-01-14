# 1. Image Node complète (Debian)
FROM node:20

# 2. Installation des outils de compilation (Filet de sécurité indispensable)
RUN apt-get update && apt-get install -y python3 make g++ build-essential

WORKDIR /app

# 3. On copie le package.json (ET RIEN D'AUTRE POUR L'INSTANT)
COPY package.json ./

# 4. LA SOLUTION RADICALE
# On supprime tout fichier lock qui aurait pu être copié par erreur
# On supprime le dossier node_modules s'il existe
# On lance l'installation pure
RUN rm -f package-lock.json yarn.lock && \
    rm -rf node_modules && \
    npm install

# 5. On copie le reste du projet
COPY . .

# 6. Configuration finale
EXPOSE 3000
CMD ["node", "server.js"]
