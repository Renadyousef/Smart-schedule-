import { useState, useEffect } from "react";
import axios from "axios";

export default function AssignedCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [feedbacks, setFeedbacks] = useState({});
  const [activeCourse, setActiveCourse] = useState(null);
  const [form, setForm] = useState({ preference: "", text: "" });

  // جلب الكورسات من الباك-إند
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        setErr("");

        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await axios.get(
          "http://localhost:5000/instructor/assigned-courses?scheduleId=4",
          { headers }
        );

        // نضيف id بسيط لكل كورس (ضروري للجدول + حفظ الفيدباك)
        const normalized = (res.data || []).map((r, i) => ({
          id: i + 1,
          ...r,
        }));

        setCourses(normalized);
      } catch (e) {
        console.error(e);
        setErr("Failed to load courses.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // تحديث النموذج عند فتح المودال
  useEffect(() => {
    if (!activeCourse) return;
    const existing = feedbacks[activeCourse.id] || { preference: "", text: "" };
    setForm(existing);
  }, [activeCourse]);

  const openFeedback = (course) => {
    setActiveCourse(course);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitFeedback = () => {
    if (!activeCourse) return;
    setFeedbacks((prev) => ({ ...prev, [activeCourse.id]: { ...form } }));

    // لاحقاً: نربطه بالباك-إند
    // await axios.post("/instructor/feedback", { courseId: activeCourse.id, ...form });

    const el = document.getElementById("feedbackModal");
    const modal = window.bootstrap?.Modal.getInstance(el) || new window.bootstrap.Modal(el);
    modal.hide();

    alert(`Feedback saved for ${activeCourse.code}.`);
  };

  return (
    <div className="container py-4 assigned-container">
      <h2 className="page-title mb-2">Courses Schedule</h2>
      <p className="page-subtitle mb-4">
        Review your assigned courses and provide feedback on your preliminary schedule
      </p>

      <div className="card courses-card shadow-sm">
        <div className="card-header bg-white d-flex justify-content-between align-items-center">
          <strong>Courses</strong>
          <span className="text-muted small">
            {loading ? "Loading…" : `Total: ${courses.length}`}
          </span>
        </div>

        <div className="table-responsive">
          <table className="table align-middle table-striped mb-0">
            <thead className="table-light">
              <tr>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Section</th>
                <th>Days</th>
                <th>Time</th>
                <th>Room</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-4">Loading courses…</td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={7} className="text-danger text-center py-4">{err}</td>
                </tr>
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4">No assigned courses.</td>
                </tr>
              ) : (
                courses.map((c) => {
                  const saved = feedbacks[c.id];
                  return (
                    <tr key={c.id}>
                      <td className="fw-semibold">{c.code}</td>
                      <td>{c.name}</td>
                      <td><span className="badge bg-primary">{c.section}</span></td>
                      <td>{c.days}</td>
                      <td className="ltr">{c.time}</td>
                      <td>{c.room}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-primary px-3"
                          type="button"
                          data-bs-toggle="modal"
                          data-bs-target="#feedbackModal"
                          onClick={() => openFeedback(c)}
                        >
                          {saved ? "Edit Feedback" : "Provide Feedback"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback Modal */}
      <div
        className="modal fade"
        id="feedbackModal"
        tabIndex="-1"
        aria-labelledby="feedbackModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="feedbackModalLabel">
                Provide Feedback
                {activeCourse && (
                  <span className="ms-2 text-muted small">
                    — {activeCourse.code} • {activeCourse.name} ({activeCourse.section})
                  </span>
                )}
              </h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>

            <div className="modal-body">
              {activeCourse && (
                <>
                  <div className="mb-2 small text-muted">
                    {activeCourse.days} • <span className="ltr">{activeCourse.time}</span> • Room {activeCourse.room}
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">Preference</label>
                      <select
                        className="form-select"
                        value={form.preference || ""}
                        onChange={(e) => handleChange("preference", e.target.value)}
                      >
                        <option value="">Select a preference…</option>
                        <option value="keep">Keep as is</option>
                        <option value="swap_time">Prefer different time</option>
                        <option value="swap_day">Prefer different day</option>
                        <option value="swap_section">Prefer different section</option>
                      </select>
                    </div>

                    <div className="col-md-8">
                      <label className="form-label fw-semibold">Your Feedback (optional)</label>
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder="Example: Prefer afternoon instead of morning on Sun/Tue."
                        value={form.text || ""}
                        onChange={(e) => handleChange("text", e.target.value)}
                      />
                      <div className="form-text">
                        You may suggest another time/day or explain a special case.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-primary" onClick={submitFeedback}>Submit</button>
            </div>
          </div>
        </div>
      </div>
      {/* /Modal */}
    </div>
  );
}

/* ===== CSS Inline ===== */
const style = document.createElement("style");
style.innerHTML = `
.assigned-container { max-width: 1080px; }
.page-title { line-height: 1.25; }
.page-subtitle { color: #6c757d; }
.sep { opacity: .6; }

.table th, .table td { vertical-align: middle; }
.ltr { direction: ltr; }

.courses-card { border-radius: 14px; overflow: hidden; }
.badge { font-size: .75rem; padding: .35em .6em; border-radius: .6rem; }

.modal-content { border-radius: 12px; }
.modal-title { font-weight: 600; }
.form-text { font-size: 0.85rem; color: #6c757d; }
`;
document.head.appendChild(style);
