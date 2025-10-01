// ES module imports
import express from 'express';
import cors from 'cors';

// routes
import authRoutes from './routes/Authroute.js';
import wlcomeRoute from './routes/welcomeRoute.js';
import FetchDepartments from './routes/FetchDepartments.js';
import ManageRulesRoutes from './routes/ManageRulesRoute.js';
import ProfileRoutes from './routes/ProfileRoute.js'; // 👈 جديد
import coursesRouter from "./routes/courses.js";
import studentsRouter from "./routes/students.js";
import sectionsRoutes from "./routes/sections.routes.js";


const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Use routes
app.use('/api', FetchDepartments);
app.use('/auth', authRoutes);
app.use('/try', wlcomeRoute);
app.use('/rules', ManageRulesRoutes);
app.use('/api', ProfileRoutes); // 👈 يضيف /api/profile/:id (GET/PUT)
app.use("/courses", coursesRouter);
app.use("/students", studentsRouter);
app.use("/api/sections", sectionsRoutes);

export default app;
