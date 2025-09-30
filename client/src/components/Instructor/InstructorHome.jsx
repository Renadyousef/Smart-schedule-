// src/components/InstructorHome/InstructorHome.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Instructor_Header from "./Instructor_Header";
import AssignedCourses from "./AssignedCourses";
import InstructorProfile from "../Profiles/InstructorProfile.jsx"; // ✅ ضيفي الاستيراد هنا

export default function InstructorHome({ onLogout }) {
  return (
    <Router>
      <Instructor_Header onLogout={onLogout} />

      <Routes>
        {/* الصفحة الرئيسية للمدرّس */}
        <Route path="/" element={<h1 className="m-4">Welcome Instructor!</h1>} />

        {/* صفحة البروفايل */}
        <Route path="/account" element={<InstructorProfile />} />

        {/* صفحة الكورسات المسندة */}
        <Route path="/assigned-courses" element={<AssignedCourses />} />
      </Routes>
    </Router>
  );
}
