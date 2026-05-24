FROM node:20-alpine

WORKDIR /app

# Install backend
COPY backend/package*.json ./
RUN npm install --legacy-peer-deps

COPY backend/ .
RUN npx nest build

# Copy dashboard static files
COPY dashboard/dist/public ./public

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/main.js"]
