import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Header from "./Header";
import ManageRules from "../ManageSchduling_rules/ManageRules";
import SCCommitteeProfile from "../Profiles/SCCommitteeProfile.jsx";
import ExternalCourses from "./ExternalCourses.jsx";
import InternalCourses from "./InternalCourses.jsx";
import GeneratedSchedule from "./GeneratedSchedule.jsx";
import ShareSchedule from "./ShareSchedule.jsx";
import CreateRequest from "./CreateRequest.jsx";

// صفحة بسيطة للواجهة الرئيسية (بدّليها بما تريدين)
function SCHomeLanding() {
  return <h1 className="m-4">Welcome to the SC Home Page</h1>;
}

export default function SC_Home({ onLogout }) {
  return (
    <Router>
      <Header onLogout={onLogout} />

      <Routes>
        {/* الرئيسية */}
        <Route path="/" element={<SCHomeLanding />} />

        {/* أسماء المسارات مطابقة لأسماء الملفات */}
        <Route path="/external-courses" element={<ExternalCourses />} />
        <Route path="/internal-courses" element={<InternalCourses />} />
        <Route path="/generated-schedule" element={<GeneratedSchedule />} />
        {/* <Route path="/share-schedule" element={<ShareSchedule />} /> */}
        <Route path="/requests/new" element={<CreateRequest />} />

        {/* صفحات أخرى */}
        <Route path="/manage" element={<ManageRules />} />
        <Route path="/account" element={<SCCommitteeProfile />} />
        <Route path="/requests/new" element={<h2>Create Request Page</h2>} />
        {/* مسارات قديمة (اختياري إعادة توجيه) */}
        {/* <Route path="/core" element={<Navigate to="/external-courses" replace />} />
        <Route path="/internal" element={<Navigate to="/internal-courses" replace />} />
        <Route path="/generated" element={<Navigate to="/generated-schedule" replace />} />
        <Route path="/share" element={<Navigate to="/share-schedule" replace />} />
        <Route path="/start" element={<Navigate to="/generated-schedule" replace />} /> */}
      </Routes>
    </Router>
  );
}