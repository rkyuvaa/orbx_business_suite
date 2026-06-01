# Stage 1: Build React static assets
FROM node:18-alpine as build-stage

WORKDIR /app

COPY package.json /app/package.json
RUN npm install --silent

COPY . /app
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine

COPY --from=build-stage /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
