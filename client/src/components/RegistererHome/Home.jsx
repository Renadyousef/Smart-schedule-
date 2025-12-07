// src/components/RegistrarHome/Home.jsx
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "./Header";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import AddIrregularStudent from "./AddIrregularStudent";
import RegistrarProfile from "../Profiles/RegistrarProfile.jsx";
import OfferElective from "../OfferElective/ViewElectiveRequests.jsx";
import RegistrarRequests from "./RegistrarRequests.jsx";
import RegistrarNotifications from "./RegistrarNotifications.jsx";
import Footer from "../Footer/Footer.jsx";

// Small helper to read a friendly first name from storage
function readJSON(s) { try { return s ? JSON.parse(s) : null; } catch { return null; } }
function pickDisplayNameFromStorage() {
  const stores = [localStorage, sessionStorage];
  const keys = ["user", "profile", "account", "registrar"];
  for (const store of stores) {
    for (const k of keys) {
      const obj = readJSON(store.getItem(k));
      if (!obj) continue;
      const base = obj.user || obj.profile || obj.account || obj;
      const full = base?.name || [base?.firstName, base?.lastName].filter(Boolean).join(" ").trim();
      if (full && String(full).trim()) {
        return String(full).trim().split(/\s+/)[0];
      }
    }
  }
  return "Registrar";
}

/* ======================= Dashboard ======================= */
function Dashboard() {
  return (
    <div className="container py-4">
      <h1 className="mb-4"> </h1>

      {/* KPIs */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h6 className="text-muted">Irregular Students</h6>
              <h3>128</h3>
              <small className="text-muted">3 added today</small>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h6 className="text-muted">Pending Requests</h6>
              <h3>6</h3>
              <small className="text-muted">From Committee</small>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h6 className="text-muted">Electives Offered</h6>
              <h3>4</h3>
              <small className="text-muted">This Term</small>
            </div>
          </div>
           </div>
      </div>

      {/* Quick Actions */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h5 className="mb-3">Quick Actions</h5>
          <div className="d-flex flex-wrap gap-2">
            <Link to="/registrar/irregular/add" className="btn btn-primary">
              + Add Irregular Student
            </Link>

            <Link to="/registrar/requests" className="btn btn-outline-secondary">
              Respond to Requests
            </Link>

<Link to="/registrar/electives" className="btn btn-success">
  Offer New Elective
</Link>     
     </div>
        </div>
      </div>

      {/* Lists */}
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h5 className="mb-3">Pending Committee Requests</h5>
              <ul className="list-group list-group-flush">
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  Extra data for Level 3
                  <button className="btn btn-sm btn-outline-primary">View</button>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  Confirm carry-over courses
                  <button className="btn btn-sm btn-outline-primary">Respond</button>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <h5 className="mb-3">Recent Irregular Students</h5>
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>ID</th>
                    <th>Courses</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Noura Al-F.</td>
                    <td>441122</td>
                    <td>2</td>
                  </tr>
                  <tr>
                    <td>Sultan M.</td>
                    <td>441199</td>
                    <td>1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="alert alert-info mt-4">
        Elective offerings close on <strong>Dec 15</strong>. Please submit before the deadline.
      </div>
    </div>
  );
}

/* ======================= Placeholders ======================= */
function IrregularStudents() {
  return (
    <div className="container py-4">
      <h2>Irregular Students Page</h2>
    </div>
  );
}

function CommitteeRequests() {
  return (
    <div className="container py-4">
      <h2>Committee Requests Page</h2>
    </div>
  );
}

/* ======================= Home (Router) ======================= */
export default function Home() {
  const [displayName, setDisplayName] = useState("Registrar");

  useEffect(() => {
    const compute = () => setDisplayName(pickDisplayNameFromStorage());
    compute();
    const onStorage = (e) => {
      if (!e || ["user","profile","account","registrar"].includes(e.key)) compute();
    };
    const onFocus = () => compute();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    const id = setInterval(compute, 2500);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, []);

  return (
  <Router>
    <Header />

    <Routes>
      {/* ✅ Home page only (hero moved inside) */}
      <Route
        path="/"
        element={
          <>
            <section className="hero d-flex align-items-center text-center text-white">
              <div className="container">
                <h1 className="fw-bold mb-3">Welcome {displayName}</h1>
              </div>
            </section>
            <Dashboard /> {/* rest of dashboard content */}
          </>
        }
      />

      {/* باقي الصفحات */}
      <Route path="/registrar" element={<Navigate to="/" replace />} />
      <Route path="/registrar/irregular" element={<IrregularStudents />} />
      <Route path="/registrar/irregular/add" element={<AddIrregularStudent />} />
      <Route path="/registrar/requests" element={<RegistrarRequests />} />
      <Route path="/registrar/electives" element={<OfferElective />} />
      <Route path="/account" element={<RegistrarProfile />} />
      <Route path="/requests" element={<RegistrarRequests />} />
      <Route path="/registrar/notifications" element={<RegistrarNotifications />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>


 <Footer />
    <style>{`
      .hero {
        background: linear-gradient(135deg, #1766ff, #0a3ea7);
        padding: 80px 20px;
      }
      body {
        background: #f8fbff;
      }
        footer {
    margin-top: auto;
  }
    `}</style>
  </Router>
);


}
