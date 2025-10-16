# 1. Use an official Node image *[recipe of the continer:before run]
# *gives you a fresh Linux system with Node.js 18 preinstalled
From node:18 


# 2. Set the working directory inside the container:where the app starts the run with
WORKDIR /app

# 3. Copy package.json and package-lock.json * we have on root level+added a start script to packages.json

COPY package*.json ./

# 4 Install OS build tools + dependencies
RUN apt-get update && apt-get install -y python3 make g++ \
    && npm install --production

# 5. Copy all server files into the container
COPY . .

# 6. Expose the port your server runs on:Tells Docker that the app listens on port 5000.
EXPOSE 5000

# 7. *Command to start your server:this RUNS the code:This runs whatever you defined as "start" in your server/package.json
CMD ["npm", "start"]