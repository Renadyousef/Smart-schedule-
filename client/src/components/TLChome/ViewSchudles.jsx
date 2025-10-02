// src/components/Schedule/FixedSchedule.jsx
import React, { useState, useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const TIMES = [
  "08:00 - 08:50",
  "09:00 - 09:50",
  "10:00 - 10:50",
  "11:00 - 11:50",
  "13:00 - 13:50",
  "14:00 - 14:50",
  "15:00 - 15:50",
];

const PALETTE = {
  core: "#cce5ff",
  elective: "#fff9c4",
  lab: "#e1bee7",
  default: "#f8f9fa",
};

function colorOf(type) {
  return PALETTE[type] || PALETTE.default;
}

// Example subjects
const subjects = ["Math", "Physics", "Chemistry", "Biology", "CS", "English"];

export default function FixedSchedule() {
  const [levelFilter, setLevelFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [approving, setApproving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [scheduleGrid, setScheduleGrid] = useState({}); // empty table initially

  const filteredScheduleGrid = useMemo(() => {
    if (!subjectFilter) return scheduleGrid;
    const out = {};
    for (const day of Object.keys(scheduleGrid)) {
      out[day] = {};
      for (const time of Object.keys(scheduleGrid[day])) {
        const slot = scheduleGrid[day][time];
        if (slot.subject === subjectFilter) {
          out[day][time] = slot;
        }
      }
    }
    return out;
  }, [scheduleGrid, subjectFilter]);

  const skip = useMemo(() => ({}), [filteredScheduleGrid]);

  const approveSchedule = () => {
    setApproving(true);
    setTimeout(() => {
      alert("Schedule approved!");
      setApproving(false);
    }, 500);
  };

  const submitFeedback = () => {
    setSubmitting(true);
    setTimeout(() => {
      alert(`Feedback submitted: ${comment}`);
      setSubmitting(false);
      setShowModal(false);
      setComment("");
    }, 500);
  };

  return (
    <div className="container my-4">
      <style>{`
        .table-fixed { table-layout:fixed; width:100%; border-collapse:separate; border-spacing:5px; }
        th, td { text-align:center; vertical-align:middle; height:70px; border:1px solid #dee2e6; border-radius:10px; padding:0; overflow:hidden; }
        .subject-box { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:600; font-size:.9rem; }
        .room { font-size:.75rem; color:#333; }
        .btn-feedback { background-color:#e9f2ff; border:none; border-radius:30px; padding:14px 40px; font-weight:700; font-size:1.05rem; color:#0b3a67; }
        .btn-feedback:hover { background-color:#cce5ff; }
      `}</style>

      {/* Filters + Approve */}
      <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
        <div>
          <label className="fw-bold mb-0">Level Filter:</label>
          <select
            className="form-select"
            style={{ maxWidth: "150px" }}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="">Select Level</option>
            {[1,2,3,4,5,6,7,8].map((lv) => (
              <option key={lv} value={lv}>{lv}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="fw-bold mb-0">Subject Filter:</label>
          <select
            className="form-select"
            style={{ maxWidth: "200px" }}
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="">All Subjects</option>
            {subjects.map((subj) => (
              <option key={subj} value={subj}>{subj}</option>
            ))}
          </select>
        </div>

        <div className="align-self-end">
          <button
            className="btn btn-success"
            onClick={approveSchedule}
            disabled={approving || !levelFilter}
          >
            {approving ? "Approving..." : "Approve Schedule"}
          </button>
        </div>
      </div>

      {/* Table */}
      <table className="table-fixed">
        <thead>
          <tr>
            <th style={{ width: "140px", backgroundColor: "#f1f3f5" }}>Time</th>
            {DAYS.map((d) => (
              <th key={d} style={{ backgroundColor: "#f1f3f5" }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIMES.map((time, ti) => (
            <tr key={time}>
              <td className="fw-bold" style={{ backgroundColor: "#f9fafb", fontSize: "0.9rem" }}>{time}</td>
              {DAYS.map((day) => {
                const key = `${day}#${ti}`;
                if (skip[key]) return null;

                const slot = filteredScheduleGrid?.[day]?.[time];
                if (!slot) return <td key={day}></td>;

                const bg = colorOf(slot.type);
                const rowSpan = Math.max(1, slot.duration || 1);

                if (rowSpan > 1) {
                  for (let k = 1; k < rowSpan; k++) {
                    const nextIdx = ti + k;
                    if (nextIdx < TIMES.length) skip[`${day}#${nextIdx}`] = true;
                  }
                }

                return (
                  <td key={day} rowSpan={rowSpan}>
                    <div className="subject-box" style={{ backgroundColor: bg }}>
                      {slot.subject}
                      <div className="room">Room {slot.room}</div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Feedback Modal Trigger */}
      <div className="text-center mt-3">
        <button className="btn-feedback" onClick={() => setShowModal(true)}>
          Give Feedback
        </button>
      </div>

      {/* Feedback Modal */}
      {showModal && (
        <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: "20px" }}>
              <div className="modal-header" style={{ background: "#e9f2ff", color: "#0b3a67", borderTopLeftRadius: "20px", borderTopRightRadius: "20px" }}>
                <h5 className="modal-title">Feedback</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Your feedback…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              <div className="modal-footer d-flex gap-2">
                <button
                  className="btn btn-outline-secondary"
                  style={{ borderRadius: "12px", padding: "8px 18px", fontWeight: "600" }}
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{
                    backgroundColor: "#e9f2ff",
                    color: "#0b3a67",
                    borderRadius: "12px",
                    padding: "8px 18px",
                    fontWeight: "600",
                    border: "none",
                    opacity: submitting || !comment.trim() ? 0.7 : 1
                  }}
                  onClick={submitFeedback}
                  disabled={submitting || !comment.trim()}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
