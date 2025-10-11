import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { Container, Button, Spinner, Alert } from "react-bootstrap";

const STORAGE_KEY = "sc.activeScheduleId";
const EVENT_NAME = "sc-schedule-changed";

export default function ShareSchedule() {
  const [scheduleId, setScheduleId] = useState(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isNaN(parsed) ? null : parsed;
  });
  const [msg, setMsg] = useState(null);
  const [busyFor, setBusyFor] = useState(null);

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
    async function ensureSchedule() {
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
    ensureSchedule();
  }, [api, scheduleId]);

  const share = async () => {
    if (!scheduleId) return;
    setBusyFor("tlc");
    try {
      await api.post(`/share/${scheduleId}`);
      setMsg("✅ Schedule shared with TLC");
      setTimeout(() => setMsg(null), 2500);
    } finally {
      setBusyFor(null);
    }
  };

  if (!scheduleId)
    return (
      <Container className="p-5 text-center">
        <Spinner animation="border" /> Selecting schedule...
      </Container>
    );

  return (
    <Container className="py-5 d-flex justify-content-center">
      <div className="sc-share-panel text-center">
        <style>{`
          .sc-share-panel { background: #fff; border: 1px solid #e2e8f5; border-radius: 20px; padding: 36px 40px; max-width: 520px; box-shadow: 0 16px 34px rgba(12, 33, 68, 0.08); }
          .sc-share-title { font-size: 1.4rem; font-weight: 700; color: #112f4f; margin-bottom: 24px; }
          .sc-share-actions { display: flex; flex-direction: column; gap: 14px; }
          @media (min-width: 480px) {
            .sc-share-actions { flex-direction: row; justify-content: center; }
          }
          .sc-share-actions .btn { min-width: 200px; border-radius: 999px; font-weight: 600; padding: 12px 22px; }
        `}</style>

        <div className="sc-share-title">Ready to share your schedule?</div>
        {msg && <Alert variant="info" className="mb-3 text-start">{msg}</Alert>}
        <div className="sc-share-actions">
          <Button
            variant="primary"
            onClick={share}
            disabled={busyFor !== null}
          >
            {busyFor === "tlc" ? "Sharing..." : "Share with the TLC"}
          </Button>
        </div>
      </div>
    </Container>
  );
}