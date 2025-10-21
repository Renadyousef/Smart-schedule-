# Smart Schedule

## Table of Contents
- [Project Overview](#project-overview)
- [Technologies Used](#technologies-used)
- [Development Setup (Docker)](#development-setup-docker)
- [Environment Variables](#environment-variables)
- [Demo Credentials](#demo-credentials)
- [License](#license)

---

## Project Overview

**Smart Schedule** is an AI-powered scheduling system for the **KSU Software Engineering Department**.  
It automatically generates course schedules based on predefined rules and committee inputs.

### Key Features
- **Role-based access:** Students, Registrar, Scheduling Committee (SC), and Teaching Load Committee (TLC) each have unique permissions.  
- **Students:** Submit elective preferences, view AI-generated schedules, give feedback, and receive notifications.  
- **Scheduling Committee (SC):** Generate AI-based preliminary schedules, manage rules, handle irregular cases, share drafts with TLC, and finalize.  
- **Teaching Load Committee (TLC):** Review shared schedules, check instructor load overlaps, suggest edits, or approve schedules.  
- **System:** Tracks version history (via “last edited” column), supports notifications, and ensures a responsive UI.  
- **Non-functional requirements:** Secure role-based authentication, responsive design, and clear audit history.

---

## Technologies Used
- **Frontend:** React, Vite, Bootstrap  
- **Backend:** Node.js, Express.js  
- **Database:** PostgreSQL (Supabase hosted)  
- **APIs:** OpenAI API (for AI schedule generation)  
- **Deployment:** Vercel, Docker 

---
## Environment Variables

JWT_SECRET=


OPENAI_API_KEY=


DATABASE_URL=

Any additional config
such as the local port on the server..

## Development Setup (Docker)

This project uses Docker for development and pre-deployment testing.  
All services run in containers, ensuring consistent behavior across environments.  
No need to manually install dependencies — just use Docker Compose.

Note: Production services only update when pushed to the main branch
local Docker setup is purely for development and testing.

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd <your-repo-folder>

# 2. Build and run containers
docker-compose up --build

# 3. To stop containers
docker-compose down
