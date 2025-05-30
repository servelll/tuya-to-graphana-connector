# Use the official lightweight Node.js 12 image.
# https://hub.docker.com/_/node
FROM node:24

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY package*.json ./

# Install production dependencies.
RUN npm install --only=production

# Copy local code to the container image.
COPY . ./

# Filleing recreated .env template
RUN npm install -y envsub
RUN npx envsub -e accessKeyTemplate="$accessKey" 
    -e secretKeyTemplate="$secretKey" 
    -e deviceIdTemplate="$deviceId" ./.env.template ./.env

# Run the web service on container startup.
CMD [ "npm", "start" ]