// src/components/Schedule/FixedSchedule.jsx
import React, { useEffect, useMemo, useState } from "react";
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

function normalizeType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "mandatory" || t === "core") return "core";
  if (t === "elective" || t === "optional") return "elective";
  if (t === "lab" || t === "laboratory") return "lab";
  return "core";
}
function colorOf(type) {
  const nt = normalizeType(type);
  if (nt === "core") return PALETTE.core;
  if (nt === "elective") return PALETTE.elective;
  if (nt === "lab") return PALETTE.lab;
  return PALETTE.default;
}
function titleCaseDay(dbDay) {
  if (!dbDay) return "";
  return dbDay.charAt(0).toUpperCase() + dbDay.slice(1).toLowerCase();
}
function hmToMin(hm) {
  const [h, m] = String(hm).split(":").map(Number);
  return h * 60 + m;
}

const SLOT_PARTS = TIMES.map((t) => {
  const [s, e] = t.split(" - ");
  return { s, e, sMin: hmToMin(s), eMin: hmToMin(e) };
});
const SLOT_STARTS = SLOT_PARTS.map((p) => p.s);

function rowsToSchedule(rows) {
  const out = {};
  for (const r of rows || []) {
    const day = titleCaseDay(r.DayOfWeek);
    if (!DAYS.includes(day)) continue;
    if (!r.StartTime || !r.EndTime) continue;

    const startHM = String(r.StartTime).slice(0, 5);
    const endHM = String(r.EndTime).slice(0, 5);
    if (startHM.startsWith("12:")) continue;

    const startIdx = SLOT_STARTS.indexOf(startHM);
    if (startIdx === -1) continue;

    const sameEnd = SLOT_PARTS[startIdx].e;
    const nextEnd = SLOT_PARTS[startIdx + 1]?.e;

    let duration = 1;
    if (endHM === sameEnd) duration = 1;
    else if (nextEnd && endHM === nextEnd) duration = 2;
    else continue;

    const type = normalizeType(r.course_type);
    const subject = r.course_code
      ? `${r.course_code} — ${r.course_name}`
      : r.course_name || "Course";
    const room = r.room || "TBD";

    const label = TIMES[startIdx];
    out[day] ||= {};
    out[day][label] = { subject, room, type, duration };
  }
  return out;
}

export default function FixedSchedule({ apiBase = "http://localhost:5000" }) {
  const [showModal, setShowModal] = useState(false);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function run() {
      setLoading(true);
      setErr("");
      try {
        const userRaw = localStorage.getItem("user");
        if (!userRaw) throw new Error("No user in localStorage");
        let user;
        try { user = JSON.parse(userRaw); } catch { throw new Error("Corrupted user in localStorage"); }

        const level = user?.Level ?? user?.level;
        if (!level && level !== 0) throw new Error("No level found in localStorage");

        const url = new URL("/api/sections/courses-by-level", apiBase);
        url.searchParams.set("level", String(level));
        url.searchParams.set("status", "draft");     
        url.searchParams.set("includeSlots", "1");

        const token = localStorage.getItem("token");
        const res = await fetch(url.toString(), {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setSchedule(rowsToSchedule(data.rows));
      } catch (e) {
        setErr(e.message || "Failed to load schedule");
        setSchedule({});
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [apiBase]);

  const skip = useMemo(() => ({}), []);

  return (
    <div className="container my-4">
 <style>{`
  .table-fixed { 
    table-layout: fixed; width: 100%; 
    border-collapse: separate; border-spacing: 5px; 
  }
  th, td { 
    text-align: center; vertical-align: middle; 
    height: 70px; border: 1px solid #dee2e6; 
    border-radius: 10px; padding: 0; overflow: hidden; 
  }
  .subject-box { 
    width: 100%; height: 100%; display: flex; 
    flex-direction: column; align-items: center; 
    justify-content: center; font-weight: 600; 
    font-size: 0.9rem; 
  }
  .room { font-size: 0.75rem; color: #333; }
  .legend-box { display: inline-flex; align-items: center; margin: 0 10px; }
  .legend-color { width: 18px; height: 18px; border-radius: 4px; margin-right: 6px; border: 1px solid #ccc; }
  .btn-feedback { background-color: #cce5ff; border: none; border-radius: 30px; padding: 14px 40px; font-weight: 600; font-size: 1.1rem; color: #000; }
  .btn-feedback:hover { background-color: #99ccff; }
`}</style>


      <h2 className="text-center mb-2">Preliminary Schedule</h2>
      <p className="text-center text-muted mb-3">
        This is a preliminary schedule. Please provide your feedback if you have any notes.
      </p>

      {loading && <div className="alert alert-info text-center">Loading…</div>}
      {err && !loading && <div className="alert alert-danger text-center">{err}</div>}

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

                const slot = schedule?.[day]?.[time];
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

      <div className="text-center mt-3">
        <button className="btn btn-feedback" onClick={() => setShowModal(true)}>Give Feedback</button>
      </div>

      {showModal && (
        <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,.35)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: "20px" }}>
              <div className="modal-header" style={{ background: "#cce5ff", color: "black", borderTopLeftRadius: "20px", borderTopRightRadius: "20px" }}>
                <h5 className="modal-title">Feedback</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <textarea className="form-control" rows={4} placeholder="Your feedback…" />
              </div>
              <div className="modal-footer d-flex gap-2">
                {/* زر Cancel */}
                <button 
                  className="btn btn-outline-secondary" 
                  style={{ borderRadius: "12px", padding: "8px 18px", fontWeight: "600" }}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                
                {/* زر Submit */}
                <button 
                  className="btn" 
                  style={{ 
                    backgroundColor: "#cce5ff", 
                    color: "#0b3a67", 
                    borderRadius: "12px", 
                    padding: "8px 18px", 
                    fontWeight: "600", 
                    border: "none" 
                  }}
                  onClick={() => setShowModal(false)}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-center mt-3">
        <div className="legend-box">
          <div className="legend-color" style={{ backgroundColor: PALETTE.core }}></div>
          Core / Mandatory
        </div>
        <div className="legend-box">
          <div className="legend-color" style={{ backgroundColor: PALETTE.elective }}></div>
          Elective
        </div>
        <div className="legend-box">
          <div className="legend-color" style={{ backgroundColor: PALETTE.lab }}></div>
          Lab
        </div>
      </div>
    </div>
  );
}
