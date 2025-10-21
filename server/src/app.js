// server/src/app.js
import express from "express";
import cors from "cors";

// routes
import authRoutes from "./routes/Authroute.js";
import wlcomeRoute from "./routes/welcomeRoute.js";
import FetchDepartments from "./routes/FetchDepartments.js";
import ManageRulesRoutes from "./routes/ManageRulesRoute.js";
import ProfileRoutes from "./routes/ProfileRoute.js";
import coursesRouter from "./routes/courses.js";
import studentsRouter from "./routes/students.js";
import sectionsRoutes from "./routes/sections.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import addIrregularRoute from "./routes/AddIrregularRoute.js";
import CreateRequestsRoutes from "./routes/CreateRequestsRoutes.js";
import ScheduleRoutes from "./routes/ScheduleRoutes.js";
import OfferElective from "./routes/OfferElectivesRoutes.js";
import RegistrarRequestsRoutes from "./routes/RegistrarRequestsRoutes.js";
import FetchNotificationRoute from './routes/ScNotificationsRoute.js'
import TlcSchdules from './routes/TlcRoutes.js'
import Electives_on_sc from './routes/ElectivesOffersRoute.js'
import notificationsRouter from "./routes/notificationsRoutes.js";
import notificationsRoutes from "./routes/notifications.routes.js";

import stNotificationsRouter from "./routes/stNotifications.routes.js";
import notifactionRouterSC from "./routes/notifactionRouterSC.js";
const app = express();

// If you serve frontend from Vite on 5173:
// ✅ اسمحي لأصل Vite (5175) + رؤوس وأوبشنز وبكوكيز إذا احتجتِ
// app.use(cors({
//   origin: ["http://localhost:5175", "http://127.0.0.1:5175"],//chabged ports
//   methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
//   credentials: true, // خليها true فقط إذا بتستخدمين كوكيز/معرّف جلسة
// }));
//app.use(cors());//!for dev accept all port in deployment we have to spesfiy
//for deployment 
const allowedOrigins = [
  "https://smart-schedule-phi.vercel.app", // frontend
  "http://localhost:3000", // local
];

app.use((req, res, next) => {
  // Handle weird redirects or double slashes BEFORE CORS
  if (req.originalUrl.includes("//")) {
    const cleanUrl = req.originalUrl.replace(/\/{2,}/g, "/");
    return res.redirect(308, cleanUrl);
  }
  next();
});

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Id", "Cache-Control"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// 👇 very important: respond to preflight requests before any routes
//app.options("*", cors());


app.use(express.json());

// Mount routes
app.use("/api", FetchDepartments);
app.use("/auth", authRoutes);
app.use("/try", wlcomeRoute);
app.use("/rules", ManageRulesRoutes);
app.use("/api", ProfileRoutes);
app.use("/courses", coursesRouter);
app.use("/students", studentsRouter);
app.use("/api/sections", sectionsRoutes);
app.use("/irregular", addIrregularRoute);
app.use("/api/feedback", feedbackRoutes);
app.use("/registrarRequests", RegistrarRequestsRoutes);
// ...
app.use("/api/notifications", notificationsRouter);

app.use("/createRequests", CreateRequestsRoutes);
app.use("/api/st-notifications", stNotificationsRouter);
app.use("/offer", OfferElective);
app.use("/schedule", ScheduleRoutes);
app.use('/Notifications',FetchNotificationRoute)//for SC page
app.use('/Schudles',TlcSchdules)
app.use('/Electives',Electives_on_sc)
app.use("/Notifications", notificationsRouter);

app.use("/api/notifications", notificationsRoutes);
app.use("/NotificationsSC", notifactionRouterSC);

export default app;
