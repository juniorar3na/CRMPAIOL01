FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

# Build the app
RUN npm run build

# Expose port
EXPOSE 8080

# Start preview server
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "8080"]
