#docker file on client 
# 1. Build a node base Image 

FROM node:22 AS build

# 2 the run starts from for the next command
WORKDIR /app


# 3.Copy package.json and package-lock.json for the client
COPY package*.json ./


# 4.Install dependencies neeeded for react
RUN npm install

# 5.Copy all React code
COPY . .

#test env is read
ENV VITE_API_URL=http://server:5000


# 6. Build the app THE RUN COMMAND:Runs the build script from package.json
RUN npm run build

# 7. Production stage using Nginx:server
#Starts a new lightweight image based on Nginx.
#Nginx (pronounced “engine-ex”) is a web server and reverse proxy. It’s one of the most popular servers in the world for hosting websites and web apps.
#Think of it like the doorway to your website: when someone visits your site, Nginx answers the request and serves the right files.
#Load balancing,Caching & compression,Can forward requests to another server (like your Node/Express backend),Serve static files
FROM nginx:alpine

# Copy the build output to Nginx html folder
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]