import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./Header";
import ManageRules from "../ManageSchduling_rules/ManageRules";

export default function HomePage() {
  return (
    <Router>
      <Header />
      <Routes>
        {/* Home route (default when you log in) */}
        <Route path="/" element={<h1>Welcome to the Home Page</h1>} />

        {/* Manage scheduling rules page */}
        <Route path="/manage" element={<ManageRules />} />

        {/* You can add other routes later like schedules */}
        {/* <Route path="/schedules" element={<Schedules />} /> */}
      </Routes>
    </Router>
  );
}
