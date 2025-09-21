// ES module imports
import pool from '../DataBase_config/DB_config.js'; // include .js
import express from 'express';
import cors from 'cors';
//import ur routes
import authRoutes from './routes/Authroute.js'; // include .js
import wlcomeRoute from './routes/welcomeRoute.js'
import FetchDepartments from './routes/FetchDepartments.js';
/*
importnt note
userId: req.user.id, role: req.user.role after u use the middleware:verfiy token!!!!!!!
thats the token in local storage u take and send via axios in ur reqyest header 

*/

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Use routes
app.use('/api',FetchDepartments)
app.use("/auth", authRoutes);
app.use('/try',wlcomeRoute)


export default app;
