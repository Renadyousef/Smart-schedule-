import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { Container, Button, Spinner, Alert } from "react-bootstrap";

const STORAGE_KEY = "sc.activeScheduleId";
const EVENT_NAME = "sc-schedule-changed";

export default function InternalCourses() {
  const [internalRows, setInternalRows] = useState([]);
  const [detectedLevel, setDetectedLevel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [scheduleId, setScheduleId] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isNaN(parsed) ? null : parsed;
  });

  const token = localStorage.getItem("token");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: "http://localhost:5000/schedule",
        headers: { Authorization: `Bearer ${token}` },
      }),
    [token]
  );

  const syncSchedule = useCallback((value, broadcast = false) => {
    const numeric = value === null || value === undefined ? null : Number(value);
    const normalized = Number.isNaN(numeric) ? null : numeric;
    setScheduleId(normalized);
    if (typeof window !== "undefined") {
      if (normalized !== null) {
        window.localStorage.setItem(STORAGE_KEY, String(normalized));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      if (broadcast) {
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (evt) => {
      const nextId = evt.detail === null || evt.detail === undefined ? null : Number(evt.detail);
      const normalized = Number.isNaN(nextId) ? null : nextId;
      if (normalized === scheduleId) return;
      syncSchedule(normalized, false);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, [scheduleId, syncSchedule]);

  useEffect(() => {
    async function init() {
      if (scheduleId) return;
      try {
        const { data } = await api.post("/init");
        const nextId = data?.scheduleId ?? null;
        if (nextId) {
          syncSchedule(Number(nextId), true);
        }
      } catch (err) {
        console.error("Init schedule failed:", err);
      }
    }
    init();
  }, [api, scheduleId]);

  const loadInternalAuto = async (id) => {
    if (!id) {
      setInternalRows([]);
      setDetectedLevel(null);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.get(`/internal-courses/auto/${id}`);
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

  useEffect(() => {
    if (scheduleId) {
      loadInternalAuto(scheduleId).catch((err) =>
        console.error("Load internal courses failed:", err)
      );
    } else {
      setInternalRows([]);
      setDetectedLevel(null);
    }
  }, [scheduleId]);

  const generate = async () => {
    if (!scheduleId) return;
    setBusy(true);
    try {
      await api.post(`/generate/${scheduleId}`);
      await loadInternalAuto(scheduleId);
      setMsg("✅ Schedule generated.");
      setTimeout(() => setMsg(null), 2000);
    } finally {
      setBusy(false);
    }
  };

  if (!scheduleId)
    return (
      <Container className="p-5 text-center">
        <Spinner animation="border" /> Selecting schedule...
      </Container>
    );

  return (
    <Container className="py-4">
      <style>{`
        .sc-panel { background: #fff; border-radius: 20px; padding: 24px 28px; border: 1px solid #e2e8f5; box-shadow: 0 14px 32px rgba(12, 33, 68, 0.08); }
        .sc-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
        .sc-title h4 { margin: 0; font-weight: 700; color: #113355; }
        .sc-meta { font-size: 0.84rem; color: #4b5c7b; font-weight: 500; }
        .sc-toast { background: rgba(32, 201, 151, 0.12); border: 1px solid rgba(32, 201, 151, 0.35); color: #0f5a42; border-radius: 12px; padding: 10px 16px; font-weight: 600; font-size: 0.9rem; margin-bottom: 18px; }
        .sc-toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 18px; background: #f9fbff; border: 1px solid #e7edf8; border-radius: 16px; margin-bottom: 18px; }
        .sc-toolbar__info { font-size: 0.83rem; color: #536487; }
        .sc-toolbar__actions { display: flex; flex-wrap: wrap; gap: 10px; }
        .sc-toolbar .btn { border-radius: 10px; font-weight: 600; min-width: 140px; }
        .sc-card-list { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; padding: 0; margin: 0; }
        .sc-card { background: #fff; border-radius: 14px; padding: 16px 18px; border: 1px solid #e0e6f4; box-shadow: 0 8px 20px rgba(15, 30, 60, 0.05); display: flex; flex-direction: column; gap: 6px; }
        .sc-card__code { font-weight: 700; font-size: 0.95rem; color: #132c4e; }
        .sc-card__meta { font-size: 0.82rem; color: #4d5d7a; }
        .sc-empty { background: #f4f7ff; border: 1px dashed #c9d4ef; border-radius: 14px; padding: 26px; text-align: center; color: #65759b; font-weight: 500; }
      `}</style>

      <div className="sc-panel">
        <div className="sc-title">
          <h4>Pending Internal Courses</h4>
          <span className="sc-meta">Level {detectedLevel ?? "—"}</span>
        </div>

        {msg && <div className="sc-toast">{msg}</div>}

        <div className="sc-toolbar">
          <span className="sc-toolbar__info">Sync the queue before generating a schedule.</span>
          <div className="sc-toolbar__actions">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => loadInternalAuto(scheduleId)}
              disabled={busy}
            >
              {busy ? "Working..." : "Rescan"}
            </Button>
            <Button
              variant="primary"
              onClick={generate}
              disabled={busy || internalRows.length === 0}
            >
              Auto-Generate Schedule
            </Button>
          </div>
        </div>

        {internalRows.length ? (
          <ul className="sc-card-list">
            {internalRows.map((r, i) => (
              <li key={i} className="sc-card">
                <span className="sc-card__code">{r.course_code}</span>
                <span className="sc-card__meta">{r.course_name}</span>
                <span className="sc-card__meta">Section {r.section_number} • Capacity {r.capacity}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="sc-empty">No internal courses found</div>
        )}
      </div>
    </Container>
  );
}