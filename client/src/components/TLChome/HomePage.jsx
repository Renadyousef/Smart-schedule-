import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./Header";
import ManageRules from "../ManageSchduling_rules/ManageRules";
import TLCProfile from "../Profiles/TLCProfile"; // ✅ استيراد البروفايل

import FixedSchedule from './ViewSchudles'
import Landing from "./Landing";
import Footer from "../Footer/Footer";


export default function HomePage({ onLogout }) {
  return (
    <Router>
      {/* الهيدر ثابت */}
      <Header onLogout={onLogout} />

      <Routes>
        {/* الصفحة الرئيسية */}
        <Route path="/" element={<Landing />} />

        {/* صفحة القواعد */}
        <Route path="/Schudles" element={<FixedSchedule />} />

        {/* صفحة البروفايل */}
        <Route path="/account" element={<TLCProfile />} />
      </Routes>
       <Footer />
    </Router>
  );
}
