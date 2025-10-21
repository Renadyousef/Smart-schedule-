#docker file on client 
# 1. Build a node base Image 
FROM node:22 AS build

# 2 the run starts from for the next command
WORKDIR /app

# 3.Copy package.json and package-lock.json for the client
COPY package*.json ./

# 4.Install dependencies needed for react
RUN npm install

# 5.Copy all React code
COPY . .

#connecting to backend locally: for cont devolpment later
ENV VITE_API_URL=http://localhost:5000

# 6. Build the app THE RUN COMMAND:Runs the build script from package.json
RUN npm run build

# 7. Production stage using Nginx:server [our server]
#Starts a new lightweight image based on Nginx.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
#expose port to connnect to
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
