import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./Header";

export default function Home({ onLogout }) {
  return (
    <Router>
      {/* نمرر دالة تسجيل الخروج للـ Header */}
      <Header onLogout={onLogout} />

      <Routes>
        {/* الصفحة الرئيسية */}
        <Route path="/" element={<h1>Welcome to the Home Page rg</h1>} />

        {/* صفحة إدارة القواعد (مثال) */}
        <Route path="/rules" element={<h2>Manage Scheduling Rules</h2>} />

        {/* مثال: صفحة أخرى */}
        {/* <Route path="/schedules" element={<Schedules />} /> */}
      </Routes>
    </Router>
  );
}

