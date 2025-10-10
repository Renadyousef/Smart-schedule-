import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Header from "./Header";
import ManageRules from "../ManageSchduling_rules/ManageRules";
import SCCommitteeProfile from "../Profiles/SCCommitteeProfile.jsx";
import ExternalCourses from "./ExternalCourses.jsx";
import InternalCourses from "./InternalCourses.jsx";
import GeneratedSchedule from "./GeneratedSchedule.jsx";
import ShareSchedule from "./ShareSchedule.jsx";
import CreateRequest from "./CreateRequest.jsx";
import ManageElectives from "../ElectivesSc.jsx";


// ✅ استيراد صفحة الهوم (Landing)
import SCHomeLanding from "../SCHome/SCHomeLanding.jsx";

export default function SC_Home({ onLogout }) {
  return (
    <Router>
      <Header onLogout={onLogout} />

      <Routes>
        {/* الرئيسية */}
        <Route path="/" element={<SCHomeLanding />} />

        {/* باقي المسارات */}
        <Route path="/external-courses" element={<ExternalCourses />} />
        <Route path="/internal-courses" element={<InternalCourses />} />
        <Route path="/generated-schedule" element={<GeneratedSchedule />} />
        <Route path="/share-schedule" element={<ShareSchedule />} />
        <Route path="/requests/new" element={<CreateRequest />} />
        <Route path="/manage" element={<ManageRules />} />
        <Route path="/account" element={<SCCommitteeProfile />} />
        <Route path="/Electives/handel" element={<ManageElectives />} />
  
      </Routes>
    </Router>
  );
}
