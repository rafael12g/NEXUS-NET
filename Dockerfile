FROM node:20

RUN apt-get update && apt-get install -y python3 make g++ build-essential

WORKDIR /app

COPY package.json ./

RUN rm -f package-lock.json yarn.lock && \
    rm -rf node_modules && \
    npm install

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
