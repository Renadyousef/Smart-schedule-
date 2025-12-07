import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";

import API from "../../API_continer";

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
  tutorial: "#ffe0b2",
  lab: "#e1bee7",
  elective: "#fff9c4",
  default: "#f8f9fa",
};

function normalizeType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "tutorial") return "tutorial";
  if (t === "lab" || t === "laboratory") return "lab";
  if (t === "elective" || t === "optional") return "elective";
  return "core";
}

function colorOf(type) {
  return PALETTE[normalizeType(type)] || PALETTE.default;
}

export default function ViewSchedules() {
  const [levelFilter, setLevelFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [groupsData, setGroupsData] = useState([]);
  const [courses, setCourses] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [approving, setApproving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    API
      .get("/Schudles/cources")
      .then((res) => setCourses(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error fetching courses:", err);
        setCourses([]);
      });
  }, []);

  useEffect(() => {
    if (courseFilter) setLevelFilter("");
  }, [courseFilter]);

  useEffect(() => {
    if (levelFilter) setCourseFilter("");
  }, [levelFilter]);

  useEffect(() => {
    if (!levelFilter && !courseFilter) {
      setGroupsData([]);
      setActiveGroup(null);
      return;
    }

    let url = "";
    if (courseFilter) {
      url = `/Schudles/course?courseId=${courseFilter}`;
    } else if (levelFilter) {
      url = `/Schudles/level?level=${levelFilter}`;
    }

    API
      .get(url)
      .then((res) => {
        const groups = Array.isArray(res.data.groups) ? res.data.groups : [];
        setGroupsData(groups);
        setActiveGroup(groups[0]?.meta?.groupNo || null);
      })
      .catch((err) => {
        console.error("Error fetching schedule:", err);
        setGroupsData([]);
        setActiveGroup(null);
      });
  }, [levelFilter, courseFilter]);

  const approveSchedule = async () => {
    if (!groupsData.length || !activeGroup) return;

    const group = groupsData.find((g) => (g.meta?.groupNo || 1) === activeGroup);
    if (!group) return;

    const scheduleId = group.scheduleId;
    setApproving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await API.patch(
        `/Schudles/approve/${scheduleId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message);
      if (levelFilter) setLevelFilter(levelFilter);
      else if (courseFilter) setCourseFilter(courseFilter);
    } catch (err) {
      console.error("Error approving schedule:", err);
      alert("Failed to approve schedule");
    } finally {
      setApproving(false);
    }
  };

  const submitFeedback = async () => {
    if (!comment.trim() || !groupsData.length || !activeGroup) return;
    setSubmitting(true);

    const group = groupsData.find((g) => (g.meta?.groupNo || 1) === activeGroup);
    if (!group) {
      alert("No active schedule selected");
      setSubmitting(false);
      return;
    }

    const scheduleId = group.scheduleId;
    try {
      const token = localStorage.getItem("token");
      const res = await API.post(
        "/Schudles/feedback",
        { comment, scheduleId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message || "Feedback submitted successfully!");
      setShowModal(false);
      setComment("");
    } catch (err) {
      console.error("Error submitting feedback:", err);
      alert("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <div className="container my-4 flex-grow-1">
        <style>{`
          .table-fixed { table-layout:fixed; width:100%; border-collapse:separate; border-spacing:5px; margin-bottom:40px;}
          th, td { text-align:center; vertical-align:middle; height:70px; border:1px solid #dee2e6; border-radius:10px; padding:0; overflow:hidden;  /* Ensure the td acts like a flex container for its content */  display: flex; align-items: stretch;  /* stretch children vertically */ justify-content: stretch; /* stretch children horizontally */ }
       .subject-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;

  /* Make it fully fill the table cell */
  width: 100%;
  height: 100%;
  min-width: 0; /* crucial for flex inside table cells */

  white-space: normal;
  word-break: break-word;
  text-align: center;
  padding: 4px;
}

          .room { font-size:.75rem; color:#333; }
          .btn-feedback { background-color:#e9f2ff; border:none; border-radius:30px; padding:14px 40px; font-weight:700; font-size:1.05rem; color:#0b3a67; }
          .btn-feedback:hover { background-color:#cce5ff; }
          .tabs { display:flex; gap:10px; margin-bottom:15px; flex-wrap: wrap; }
          .tab-btn { padding:6px 16px; border:none; border-radius:8px; cursor:pointer; background:#f1f3f5; font-weight:600; }
          .tab-btn.active { background:#cce5ff; color:#0b3a67; }
          .legend-box { display:inline-flex; align-items:center; gap:8px; margin:0 10px; font-size:.9rem; font-weight:600; color:#333; }
          .legend-color { width:20px; height:20px; border-radius:6px; border:1px solid #bbb; }
        `}</style>

        {/* Filters */}
        <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
          <div>
            <label className="fw-bold mb-0">Level:</label>
            <select
              className="form-select"
              style={{ maxWidth: "150px" }}
              value={levelFilter}
              onChange={(e) => setLevelFilter(Number(e.target.value) || "")}
            >
              <option value="">Select Level</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="fw-bold mb-0">Course:</label>
            <select
              className="form-select"
              style={{ maxWidth: "200px" }}
              value={courseFilter}
              onChange={(e) => setCourseFilter(Number(e.target.value) || "")}
            >
              <option value="">Select Course</option>
              {courses.map((c) => (
                <option key={c.CourseID || c.id} value={c.CourseID || c.id}>
                  {c.CourseName || c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="align-self-end">
            <button
              className="btn btn-success"
              onClick={approveSchedule}
              disabled={approving || !levelFilter }
            >
              {approving ? "Approving..." : "Approve Schedule"}
            </button>
          </div>
        </div>

        {/* Conditional messages */}
        {!levelFilter && !courseFilter && (
          <div className="alert alert-info text-center fw-semibold">
            Please select a filter to view schedules.
          </div>
        )}
        {courseFilter && (
          <div className="alert alert-warning text-center fw-semibold">
            Approvals are based on levels, not individual courses.
          </div>
        )}
        {(levelFilter || courseFilter) && groupsData.length === 0 && (
          <div className="alert alert-secondary text-center fw-semibold">
            Please wait for the Scheduling Committee to share the schedule.
          </div>
        )}

        {/* Group Tabs */}
        {groupsData.length > 0 && (
          <div className="tabs">
            {groupsData.map((g) => (
              <button
                key={g.meta?.groupNo || 1}
                className={`tab-btn ${
                  activeGroup === (g.meta?.groupNo || 1) ? "active" : ""
                }`}
                onClick={() => setActiveGroup(g.meta?.groupNo || 1)}
              >
                Group {g.meta?.groupNo || 1}
              </button>
            ))}
          </div>
        )}

        {/* Schedule Table */}
        {groupsData
          .filter((g) => (g.meta?.groupNo || 1) === activeGroup)
          .map((group) => {
            const skip = {};
            const grid = {};
            group.slots.forEach((s) => {
              const day = s.day || "Monday";
              const time = `${s.start || "08:00"} - ${s.end || "08:50"}`;
              if (!grid[day]) grid[day] = {};
              grid[day][time] = {
                subject: s.course_name,
                room: s.room || "N/A",
                type: s.course_type || "core",
                duration: 1,
                is_external: s.is_external,
                section_number: s.section_number,
              };
            });

            return (
  <div className="table-responsive" key={group.meta?.groupNo || 1}>
    <table className="table table-bordered" style={{ minWidth: "900px" }}>
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
              const slot = grid?.[day]?.[time];
              if (!slot) return <td key={day}></td>;

              // ======= Applied external course coloring logic =======
              let displayType = slot.type;
              if (slot.is_external) {
                const baseSection = Math.min(
                  ...group.slots
                    .filter(s => s.course_name === slot.subject && s.is_external)
                    .map(s => s.section_number || 1)
                );
                const diff = (slot.section_number || 1) - baseSection;
                if (diff === 0) displayType = "core";
                else if (diff === 1) displayType = "tutorial";
                else displayType = "lab";
              }
              const bg = colorOf(displayType);
              // ========================================================

              const rowSpan = Math.max(1, slot.duration || 1);
              for (let k = 1; k < rowSpan; k++) skip[`${day}#${ti + k}`] = true;

              return (
                <td key={day} rowSpan={rowSpan}>
                  <div className="subject-box text-wrap" style={{ backgroundColor: bg }}>
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
  </div>
);

          })}

        {/* Legend & Feedback */}
        {groupsData.length > 0 && (
          <>
            <div className="d-flex justify-content-center align-items-center mt-4 flex-wrap gap-3">
              <div className="legend-box">
                <div className="legend-color" style={{ backgroundColor: PALETTE.core }}></div>
                <span>Lecture</span>
              </div>
              <div className="legend-box">
                <div className="legend-color" style={{ backgroundColor: PALETTE.tutorial }}></div>
                <span>Tutorial</span>
              </div>
              <div className="legend-box">
                <div className="legend-color" style={{ backgroundColor: PALETTE.lab }}></div>
                <span>Lab</span>
              </div>
            </div>

            <div className="text-center mt-3">
              <button className="btn-feedback" onClick={() => setShowModal(true)}>
                Give Feedback
              </button>
            </div>

            {showModal && (
              <div
                className="modal fade show"
                style={{ display: "block", background: "rgba(0,0,0,.35)" }}
              >
                <div className="modal-dialog modal-dialog-centered">
                  <div className="modal-content" style={{ borderRadius: "20px" }}>
                    <div
                      className="modal-header"
                      style={{
                        background: "#e9f2ff",
                        color: "#0b3a67",
                        borderTopLeftRadius: "20px",
                        borderTopRightRadius: "20px",
                      }}
                    >
                      <h5 className="modal-title">Feedback</h5>
                      <button
                        type="button"
                        className="btn-close"
                        onClick={() => setShowModal(false)}
                      ></button>
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
                        style={{
                          borderRadius: "12px",
                          padding: "8px 18px",
                          fontWeight: "600",
                        }}
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
                          opacity: submitting || !comment.trim() ? 0.7 : 1,
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
          </>
        )}
      </div>
      
    </div>
  );
}
