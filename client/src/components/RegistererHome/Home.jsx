import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import Header from "./Header";
import "bootstrap/dist/css/bootstrap.min.css";

// إذا عندك الملف في نفس المجلد (RegistererHome):
import AddIrregularStudent from "./AddIrregularStudent";

/* ======================= Dashboard ======================= */
function Dashboard() {
  return (
    <div className="container py-4">
      <h1 className="mb-4"> Dashboard</h1>

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
            {/* <<< التعديل هنا: صار Link يفتح صفحة الإضافة >>> */}
            <Link to="/registrar/irregular/add" className="btn btn-primary">
              + Add Irregular Student
            </Link>
            <button className="btn btn-outline-primary">Import Previous Courses</button>
            <button className="btn btn-outline-secondary">Respond to Requests</button>
            <button className="btn btn-success">Offer New Elective</button>
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
        Elective offerings close on <strong>Oct 10</strong>. Please submit before the deadline.
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

function OfferElectives() {
  return (
    <div className="container py-4">
      <h2>Offer Electives Page</h2>
    </div>
  );
}

/* ======================= Home (Router) ======================= */
export default function Home() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registrar/irregular" element={<IrregularStudents />} />
        <Route path="/registrar/requests" element={<CommitteeRequests />} />
        <Route path="/registrar/electives" element={<OfferElectives />} />

        {/* <<< روت صفحة الإضافة >>> */}
        <Route path="/registrar/irregular/add" element={<AddIrregularStudent />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
