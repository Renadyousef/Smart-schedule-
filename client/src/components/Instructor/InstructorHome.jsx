// src/components/InstructorHome/InstructorHome.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Instructor_Header from "./Instructor_Header";
import AssignedCourses from "./AssignedCourses";

export default function InstructorHome({ onLogout }) {
  return (
    <Router>
      <Instructor_Header onLogout={onLogout} />

      <Routes>
        {/* الصفحة الرئيسية للمدرّس */}
        <Route path="/" element={<h1 className="m-4">Welcome Instructor!</h1>} />

        {/* لما يضغط من الهيدر → يفتح صفحة الجداول */}
        <Route path="/assigned-courses" element={<AssignedCourses />} />
      </Routes>
    </Router>
  );
}
