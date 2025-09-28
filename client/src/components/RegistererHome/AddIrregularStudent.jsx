import { useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// UserID بدل التوكن
function getUserHeaders() {
  const userId = localStorage.getItem("userId"); // احفظيها مرة وقت التشغيل
  return userId ? { headers: { "X-User-Id": userId } } : {};
}

export default function AddIrregularStudent() {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [coursesText, setCoursesText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // GET /irregular/students/:id (بدون /api)
  const lookupName = async () => {
    setOkMsg(""); setErrMsg(""); setStudentName("");
    const idNum = Number(studentId);
    if (!idNum) return setErrMsg("Please enter a valid numeric StudentID.");

    setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE}/irregular/students/${idNum}`,
        getUserHeaders()
      );

      const data = res.data || {};
      const full =
        data.fullName ||
        data?.user?.Full_name ||
        [data?.user?.First_name, data?.user?.Last_name].filter(Boolean).join(" ");

      if (!full) throw new Error("User record not found for this StudentID.");
      setStudentName(full);
    } catch (e) {
      setErrMsg(e.response?.data?.error || e.message || "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  // POST /irregular  (نمرّر studentId + courses) + نرسل X-User-Id تلقائيًا
  const handleSave = async (e) => {
    e.preventDefault();
    setOkMsg(""); setErrMsg("");

    const idNum = Number(studentId);
    if (!idNum) return setErrMsg("Please enter a valid numeric StudentID.");

    const coursesArr = coursesText.split(",").map(s => s.trim()).filter(Boolean);

    setSaving(true);
    try {
      await axios.post(
        `${API_BASE}/irregular`,
        { studentId: idNum, courses: coursesArr },
        getUserHeaders()
      );
      setOkMsg("Saved successfully ✅");
    } catch (e) {
      setErrMsg(e.response?.data?.error || e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStudentId("");
    setStudentName("");
    setCoursesText("");
    setOkMsg("");
    setErrMsg("");
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Add Irregular Student</h2>

      <form className="card shadow-sm" onSubmit={handleSave}>
        <div className="card-body">
          {/* StudentID + Lookup */}
          <div className="mb-3">
            <label className="form-label">StudentID</label>
            <div className="input-group">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="form-control"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                maxLength={10}
                required
              />
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={lookupName}
                disabled={loading || !studentId}
              >
                {loading ? "Looking..." : "Lookup"}
              </button>
            </div>
          </div>

          {/* Student Name (read-only) */}
          <div className="mb-3">
            <label className="form-label">Student Name</label>
            <input type="text" className="form-control" value={studentName} readOnly />
          </div>

          {/* Previous Level Courses */}
          <div className="mb-3">
            <label className="form-label">Previous Level Courses</label>
            <input
              type="text"
              className="form-control"
              placeholder="PHY201, MATH202, RAD203"
              value={coursesText}
              onChange={(e) => setCoursesText(e.target.value)}
            />
          </div>

          {/* Alerts */}
          {okMsg && <div className="alert alert-success">{okMsg}</div>}
          {errMsg && <div className="alert alert-danger">{errMsg}</div>}

          {/* Actions */}
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-success" disabled={saving || loading}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
