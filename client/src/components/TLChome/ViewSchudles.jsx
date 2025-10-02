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

  return (
    <div className="container my-4">
      <style>{`
        .table-fixed { table-layout:fixed; width:100%; border-collapse:separate; border-spacing:5px; }
        th, td { text-align:center; vertical-align:middle; height:70px; border:1px solid #dee2e6; border-radius:10px; padding:0; overflow:hidden; }
        .subject-box { width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:600; font-size:.9rem; }
        .room { font-size:.75rem; color:#333; }
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
    </div>
  );
}
