# Smart Schedule

## Table of Contents
- [Project Overview](#project-overview)
- [Technologies Used](#technologies-used)
- [Prerequisites](#prerequisites)
- [License](#license)
- [Demo Credentials](#demo-credentials)
- [Installation and Setup](#installation-and-setup)




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

## Prerequisites
Please download the compatible versions for your device:  
- Node.js (v18 or higher recommended)  
- npm (comes with Node.js)  

---

## License

This project is licensed under the **MIT License** — see below for details.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell   
copies of the Software, and to permit persons to whom the Software is       
furnished to do so, subject to the following conditions:                    

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.                              

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR    
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,      
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE   
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER        
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE 
SOFTWARE.

## Demo Credentials

For convenience, you can use the following accounts to explore the system:

### Teaching Load Committee (TLC)
- **Email:** renad1@ksu.edu.sa
- **Password:** Ela@911911

### Scheduling Committee (SC)
- **Email:** R3@ksu.edu.sa
- **Password:** Rruba1234@

### Student
- **Email:** R@student.ksu.edu.sa  
- **Password:** Theoriginals1@

 ### Registrar
- **Email:** renad2@ksu.edu.sa
-  **Password:** Ela@911911


> Alternatively, you can sign up for a new account via the registration page.  
> Note: Demo accounts have full access to their respective role features.

## Installation and Setup

Follow these steps to get the project running on your local machine:

```bash
# 1. Clone the repository
git clone <repo-url>
cd <your-repo-folder>
code . to open it in VS Code

# 2. Install dependencies for client
cd client
npm install

# 3. Install dependencies for the server
cd ../
npm install

# 4. Create a .env file in the root of the project
# paste the following keys
# Note: JWT_SECRET will be changed at deployment for security purposes
JWT_SECRET=your_super_secret_key_here
OPENAI_API_KEY= ** we can't commit this to GitHub, OpenAI disables committed keys for their security purposes, this only affects the generate schedule feature in your run, however, you can simply generate your own open api key or skip the generate schedule feature for now**

# 5. Run the server
# Note: By default, the server runs on port 5000. 
# If port 5000 is already in use, you may need to free it or change the port in the server configuration and calls.
cd server
npm run dev

# 6. Run the client
cd ../client
npm run dev

