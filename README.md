# Smart Schedule

## Table of Contents
- [Project Overview](#project-overview)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [Folder Structure](#folder-structure)
- [License](#license)

---

## Project Overview

This project is an AI-powered scheduling system for the KSU Software Engineering Department that automatically generates course schedules based on predefined rules and scheduling committee member input.

Key features include:

- **Role-based functionality:** Students, registrar, scheduling committee, and teaching load committee have tailored capabilities.  
- **Student features:** Submit elective preferences, view suggested and preliminary schedules, provide feedback, and receive notifications.  
- **Scheduling Committee (SC) features:** Generates preliminary schedules with AI, manages scheduling rules, handles irregular student schedules, shares with Teaching Load Committee (TLC), and finalizes schedules.  
- **Teaching Load Committee (TLC) features:** View schedules shared by the SC in this system, review instructors’ assignments from the external system, identify overlapping teaching slots, and send feedback back to the SC for adjustments. Approve the schedule if no edits are suggested, and then the schedule is shared with students.  
- **System features:** AI-generated initial schedules, history of schedule changes (tracked by the `last edited` column in DB for version API in next phases), and notifications.  
- **Non-functional requirements:** Role-based authentication, responsive UI.

---

## Technologies Used
- **Frontend:** React, Vite, Bootstrap  
- **Backend:** Node.js, Express.js  
- **Database:** PostgreSQL hosted on Supabase  
- **APIs/Services:** OpenAI API for AI schedule generation  

---

## Prerequisites before you clone
Please download the compatible versions for your device:  
- Node.js (v18 or higher recommended)  
- npm (comes with Node.js)  

---

## Installation and Setup

Follow these steps to get the project running on your local machine:

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd <your-repo-folder>

# 2. Install dependencies for client
cd client
npm install

# 3. Install dependencies for server
cd ../server
npm install

# 4. Create a .env file in the root of the project
# Add the following keys
# Note: JWT_SECRET will be changed at deployment for added security
echo "JWT_SECRET=your_super_secret_key_here" >> .env
echo "OPENAI_API_KEY=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" >> .env

# 5. Run the server
cd server
npm run dev

# 6. Run the client
cd ../client
npm run dev
