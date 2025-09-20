// ES module imports
import pool from '../DataBase_config/DB_config.js'; // include .js
import express from 'express';
import cors from 'cors';
//import ur routes
import authRoutes from './routes/Authroute.js'; // include .js

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Use routes
app.use("/auth", authRoutes);

export default app;
