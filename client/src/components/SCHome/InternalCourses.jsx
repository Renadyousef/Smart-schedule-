import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Container, Button, Spinner, Alert } from "react-bootstrap";

export default function InternalCourses() {
  const [internalRows, setInternalRows] = useState([]);
  const [detectedLevel, setDetectedLevel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [scheduleId, setScheduleId] = useState(null);

  const token = localStorage.getItem("token");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: "http://localhost:5000/schedule",
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

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

  const loadInternalAuto = async () => {
    setBusy(true);
    try {
      const { data } = await api.get(`/internal-courses/auto/${scheduleId}`);
      setDetectedLevel(data.level ?? null);
      setInternalRows(data.items ?? []);
      if (typeof data.created === "number" && data.created > 0) {
        setMsg(`Prepared ${data.created} internal sections (level ${data.level ?? "?"}).`);
        setTimeout(() => setMsg(null), 3000);
      }
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      await api.post(`/generate/${scheduleId}`);
      await loadInternalAuto();
      setMsg("✅ Schedule generated.");
      setTimeout(() => setMsg(null), 2000);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (scheduleId) loadInternalAuto();
  }, [scheduleId]);

  if (!scheduleId)
    return (
      <Container className="p-5 text-center">
        <Spinner animation="border" /> Initializing schedule...
      </Container>
    );

  return (
    <Container className="p-4">
      <h4 className="mb-3 fw-bold">Pending Internal Courses</h4>
      {msg && <Alert variant="info">{msg}</Alert>}

      <div className="mb-2 text-muted">
        Detected Level: <b>{detectedLevel ?? "—"}</b>
      </div>

      <div className="mb-3">
        <Button variant="outline-secondary" size="sm" onClick={loadInternalAuto} disabled={busy}>
          Rescan
        </Button>{" "}
        <Button variant="secondary" onClick={generate} disabled={busy || internalRows.length === 0}>
          Auto-Generate Schedule
        </Button>
      </div>

      <ul className="list-group">
        {internalRows.map((r, i) => (
          <li key={i} className="list-group-item">
            <b>{r.course_code}</b> — {r.course_name} • Sec {r.section_number} • Cap {r.capacity}
          </li>
        ))}
        {internalRows.length === 0 && <li className="list-group-item text-muted">No internal courses found.</li>}
      </ul>
    </Container>
  );
}