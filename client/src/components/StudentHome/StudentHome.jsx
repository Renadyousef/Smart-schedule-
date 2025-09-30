// src/components/StudentHome/StudentHome.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./Header";
import SCProfileEN from "../Profiles/SCProfileEN.jsx"; // بدون هيدر/فوتر
import ElectivePreferences from "./ElectivePreferences.jsx";
import HomeLanding from "./HomeLanding.jsx";
import Footer from "../Footer/Footer.jsx";

export default function StudentHome({ onLogout }) {
  return (
    <Router>
      <Header onLogout={onLogout} />

      <Routes>
        {/* الصفحة الرئيسية */}
           <Route path="/" element={<HomeLanding />} />


        {/* الجداول */}
        <Route path="/schedules" element={<h2>Schedules Page</h2>} />

        {/* الجدول المخصص */}
        <Route path="/personalized" element={<h2>Personalized Schedule Page</h2>} />

        {/* الحساب / البروفايل */}
        <Route path="/account" element={<SCProfileEN />} />

        {/* الاختيارات (يدعم small/capital) */}
        <Route path="/electives" element={<ElectivePreferences />} />
        <Route path="/Electives" element={<ElectivePreferences />} />
      </Routes>
         <Footer /> {/* ✨ الفوتر هنا يطلع بكل الصفحات */}
    </Router>
  );
}
