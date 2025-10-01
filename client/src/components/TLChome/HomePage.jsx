import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./Header";
import ManageRules from "../ManageSchduling_rules/ManageRules";
import TLCProfile from "../Profiles/TLCProfile"; // ✅ استيراد البروفايل
import ViewSchudel from "../TlcViewSchudles/ViewSchudle";

export default function HomePage({ onLogout }) {
  return (
    <Router>
      {/* الهيدر ثابت */}
      <Header onLogout={onLogout} />

      <Routes>
        {/* الصفحة الرئيسية */}
        <Route path="/" element={<h1>Welcome to the Home Page TLC</h1>} />

        {/* صفحة القواعد */}
        <Route path="/Schudles" element={<ViewSchudel />} />

        {/* صفحة البروفايل */}
        <Route path="/account" element={<TLCProfile />} />
      </Routes>
    </Router>
  );
}
