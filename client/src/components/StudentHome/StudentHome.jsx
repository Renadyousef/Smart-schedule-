import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./Header";


export default function StudentHome() {
  return (
    <Router>
      <Header />
      <Routes>
        {/* Home route (default when you log in) */}
        <Route path="/" element={<h1>Welcome to the Home Page</h1>} />

        {/* Manage scheduling rules page */}
       

        {/* You can add other routes later like schedules */}
        {/* <Route path="/schedules" element={<Schedules />} /> */}
      </Routes>
    </Router>
  );
}
