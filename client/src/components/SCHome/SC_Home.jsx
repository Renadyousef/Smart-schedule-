import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./Header";
import ManageRules from "../ManageSchduling_rules/ManageRules";
import SCCommitteeProfile from "../Profiles/SCCommitteeProfile.jsx";
export default function SC_Home({ onLogout }) {
  return (
    <Router>
      <Header onLogout={onLogout} />
      <Routes>
        <Route path="/" element={<h1>Welcome to the SC Home Page</h1>} />
        <Route path="/manage" element={<ManageRules />} />
        <Route path="/core" element={<h2>Core Courses Page</h2>} />
        <Route path="/irregular" element={<h2>Irregular Students Page</h2>} />
        <Route path="/start" element={<h2>Start Scheduling Page</h2>} />
         <Route path="/account" element={<SCCommitteeProfile />} />
      </Routes>
    
    </Router>
  );
}
