import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Container, Spinner, Alert, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

/* ====== Constants ====== */
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
  core: "#cce5ff",       // light blue
  elective: "#fff9c4",   // light yellow
  lab: "#e1bee7",        // soft purple
  default: "#f8f9fa",
};

function colorOf(type) {
  if (type === "core") return PALETTE.core;
  if (type === "elective") return PALETTE.elective;
  if (type === "lab") return PALETTE.lab;
  return PALETTE.default;
}

export default function GeneratedSchedule() {
  const [scheduleData, setScheduleData] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [scheduleId, setScheduleId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const token = localStorage.getItem("token");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: "http://localhost:5000/schedule",
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  /* ---- Init ---- */
  useEffect(() => {
    async function init() {
      try {
        const { data } = await api.post("/init");
        setScheduleId(data.scheduleId);
      } catch (err) {
        console.error("Init schedule failed:", err);
      }
    }
    init();
  }, [api]);

  const loadGrid = async () => {
    const { data } = await api.get(`/grid/${scheduleId}`);

    // 🔄 Transform to table-friendly object: { Sunday: { "08:00 - 08:50": {subject,room,type} } }
    const tableData = {};
    for (const slot of data) {
      const day = slot.day;
      if (!tableData[day]) tableData[day] = {};
      const start = slot.start?.slice(0, 5);
      const end = slot.end?.slice(0, 5);
      const label = `${start} - ${end}`;
      tableData[day][label] = {
        subject: slot.course_code + " " + (slot.course_name || ""),
        room: slot.section_number ? `Sec ${slot.section_number}` : "",
        type: slot.is_external ? "core" : "lab", // 👉 adjust type mapping if you have a field
      };
    }
    setScheduleData(tableData);
  };

  const generate = async () => {
    setBusy(true);
    try {
      await api.post(`/generate/${scheduleId}`);
      await loadGrid();
      setMsg("✅ Schedule generated.");
      setTimeout(() => setMsg(null), 2000);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (scheduleId) loadGrid();
  }, [scheduleId]);

  if (!scheduleId)
    return (
      <Container className="p-5 text-center">
        <Spinner animation="border" /> Initializing schedule...
      </Container>
    );

  const skip = {}; // to merge 2h lab rows

  return (
    <Container className="my-4">
      <style>{`
        .table-fixed { table-layout: fixed; width: 100%; border-collapse: separate; border-spacing: 5px; }
        th, td { text-align: center; vertical-align: middle; height: 70px; border: 1px solid #dee2e6; border-radius: 10px; padding: 0; overflow: hidden; }
        .subject-box { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; }
        .room { font-size: 0.75rem; color: #333; }
        .legend-box { display: inline-flex; align-items: center; margin: 0 10px; }
        .legend-color { width: 18px; height: 18px; border-radius: 4px; margin-right: 6px; border: 1px solid #ccc; }
        .btn-feedback { background-color: #cce5ff; border: none; border-radius: 30px; padding: 14px 40px; font-weight: 600; font-size: 1.1rem; color: #000; }
        .btn-feedback:hover { background-color: #99ccff; }
      `}</style>

      <h2 className="text-center mb-2">Preliminary Schedule</h2>
      {msg && <Alert variant="info">{msg}</Alert>}
      <p className="text-center text-muted mb-4">
        This is a preliminary schedule. Please provide your feedback if you have any notes.
      </p>

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

                const slot = scheduleData[day]?.[time];
                if (!slot) return <td key={day}></td>;

                const isLab = slot.type === "lab";
                const bg = colorOf(slot.type);

                if (isLab) {
                  const nextIdx = ti + 1;
                  if (nextIdx < TIMES.length) skip[`${day}#${nextIdx}`] = true;
                }

                return (
                  <td key={day} rowSpan={isLab ? 2 : 1}>
                    <div className="subject-box" style={{ backgroundColor: bg }}>
                      {slot.subject}
                      {slot.room && <div className="room">{slot.room}</div>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-center mt-4">
        <Button className="btn-feedback" onClick={() => setShowModal(true)}>Give Feedback</Button>
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
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>Close</button>
                <button className="btn btn-feedback" onClick={() => setShowModal(false)}>Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="d-flex justify-content-center mt-3">
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.core }}></div> Core</div>
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.elective }}></div> Elective</div>
        <div className="legend-box"><div className="legend-color" style={{ backgroundColor: PALETTE.lab }}></div> Lab</div>
      </div>
    </Container>
  );
}