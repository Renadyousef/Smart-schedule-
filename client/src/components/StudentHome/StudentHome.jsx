import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./Header";

export default function StudentHome({ onLogout }) {
  return (
    <Router>
      <Header onLogout={onLogout} />
      <Routes>
        <Route path="/" element={<h1>Welcome to the Home Page st </h1>} />
        {/* لاحقًا: <Route path="/schedules" element={<Schedules />} /> */}
        {/* لاحقًا: <Route path="/personalized" element={<Personalized />} /> */}
      </Routes>
    </Router>
  );
}

