FROM node:20-alpine

# Install FFmpeg (required for audio conversion in WhatsApp bots)
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

# Expose the API port
EXPOSE 3001

# Start the Node server
CMD ["npm", "start"]
