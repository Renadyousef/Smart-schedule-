// client/src/components/RegistererHome/RegistrarRequests.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import API from "../../API_continer";
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ---------- tiny helper to show REAL server errors ---------- */
function formatServerError(e) {
  const res = e?.response;
  const data = res?.data || {};
  const parts = [];
  if (res?.status) parts.push(`HTTP ${res.status}`);
  if (data.error && data.error !== data.message) parts.push(String(data.error));
  if (data.message) parts.push(String(data.message));
  if (data.detail) parts.push(`detail: ${String(data.detail)}`);
  if (data.hint) parts.push(`hint: ${String(data.hint)}`);
  if (data.where) parts.push(`where: ${String(data.where)}`);
  if (data.code) parts.push(`code: ${String(data.code)}`);
  return parts.join(" — ") || e?.message || "Server error";
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

/* ===== Theme Styles ===== */
const PAGE_CSS = `
:root {
  --brand-500:#1766ff;
  --brand-600:#0d52d6;
  --brand-700:#0a3ea7;
  --brand-50:#ecf3ff;
}
.page-bg {
  background: linear-gradient(180deg,#f8fbff 0%,#eef4ff 100%);
  min-height: 100vh;
  padding-top: 2rem;
}
.card {
  border: 0;
  border-radius: 1rem;
  box-shadow: 0 6px 18px rgba(13,82,214,0.08);
}
.hero {
  background: radial-gradient(1200px 400px at 10% -20%, var(--brand-500) 0%, var(--brand-700) 55%, #072a77 100%);
  color: #fff;
  border-radius: 1rem;
  padding: 2.5rem;
  margin-bottom: 2rem;
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(23,102,255,.25);
}
.hero::after {
  content: "";
  position: absolute; inset: 0;
  background: url('data:image/svg+xml;utf8,<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="white" stop-opacity="0.08"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/></svg>') no-repeat center/cover;
  opacity: .35;
  mix-blend-mode: screen;
  border-radius: 1rem;
}
`;

export default function RegistrarRequests() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const qparams = useMemo(() => (statusFilter ? { status: statusFilter } : {}), [statusFilter]);

  const reloadList = () =>
    API.get(`/registrarRequests/requests`, { params: qparams }).then((r) => setList(r.data || []));

  useEffect(() => {
    setErr("");
    setLoading(true);
    reloadList()
      .catch((e) => setErr(formatServerError(e)))
      .finally(() => setLoading(false));
  }, [qparams]);

  const openRequest = async (id) => {
    setErr("");
    setLoadingDetail(true);
    try {
      const { data } = await API.get(`/registrarRequests/requests/${id}`);
      setActive(data);
    } catch (e) {
      setErr(formatServerError(e));
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div className="page-bg">
        <div className="container">

          {/* 🌟 Hero Header */}
          <div className="hero text-center mb-4">
            <h1 className="fw-bold mb-2 display-6">Registrar Requests</h1>
            <p className="fs-5 mb-0" style={{ opacity: 0.95 }}>
              Review, manage, and respond to committee and irregular student requests.
            </p>
          </div>

          {/* Filters */}
          <div className="card mb-4">
            <div className="card-body d-flex flex-wrap gap-3 align-items-end">
              <div>
                <label className="form-label mb-1">Status</label>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">(any)</option>
                  <option value="pending">pending</option>
                  <option value="fulfilled">fulfilled</option>
                  <option value="rejected">rejected</option>
                  <option value="failed">failed</option>
                </select>
              </div>
              {loading && <div className="text-primary fw-semibold ms-2">Loading...</div>}
            </div>
          </div>

          {/* Error Display */}
          {err && (
            <div className="alert alert-danger">
              <div className="fw-semibold mb-1">Server error</div>
              <pre className="mb-0 small text-break">{err}</pre>
            </div>
          )}

          {/* Table */}
          <div className="card mb-4">
            <div className="card-header bg-white fw-semibold text-primary">Requests</div>
            <div className="card-body p-0">
              {loading ? (
                <div className="p-3">Loading…</div>
              ) : list.length === 0 ? (
                <div className="p-3 text-muted">No requests found.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Level</th>
                        <th>Needed Fields</th>
                        <th>Created At</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={r.id}>
                          <td>{r.title}</td>
                          <td>{r.type}</td>
                          <td>
                            <span
                              className={`badge ${
                                r.status === "pending"
                                  ? "text-bg-warning"
                                  : r.status === "fulfilled"
                                  ? "text-bg-success"
                                  : r.status === "failed"
                                  ? "text-bg-danger"
                                  : "text-bg-secondary"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td>{r.level ?? "-"}</td>
                          <td>{asArray(r.neededFields).join(", ")}</td>
                          <td>{new Date(r.createdAt).toLocaleString()}</td>
                          <td>
                            <button className="btn btn-sm btn-primary" onClick={() => openRequest(r.id)}>
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Active Detail */}
          {active && (
            <RequestDetail
              data={active}
              onClose={() => setActive(null)}
              onUpdated={async () => {
                const { data } = await API.get(`/registrarRequests/requests/${active.id}`);
                setActive(data);
                await reloadList();
              }}
            />
          )}

          {loadingDetail && <div className="mt-3 text-muted">Loading details…</div>}
        </div>
      </div>
    </>
  );
}

/* ---------- Detail & Respond ---------- */
function RequestDetail({ data, onClose, onUpdated }) {
  const fields = asArray(data.neededFields);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const setStatus = async (status) => {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await API.post(`/registrarRequests/requests/${data.id}/status`, { status });
      setMsg(`Status updated to ${status}.`);
      await onUpdated();
    } catch (e) {
      setErr(formatServerError(e));
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(""), 2000);
    }
  };

  return (
    <div className="card mt-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <div className="fw-semibold">{data.title}</div>
          <small className="text-muted">
            Type: {data.type} · Status: {data.status} · Level: {data.level ?? "-"}
          </small>
        </div>
      </div>

      {msg && <div className="alert alert-success m-3 py-2">{msg}</div>}
      {err && (
        <div className="alert alert-danger m-3 py-2">
          <div className="fw-semibold mb-1">Server error</div>
          <pre className="mb-0 small text-break">{err}</pre>
        </div>
      )}

      <div className="card-body">
        <div className="mb-3">
          <div className="fw-semibold">Needed Fields</div>
          <div>{fields.length ? fields.join(", ") : <span className="text-muted">(none)</span>}</div>
        </div>

        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Student Name</th>
                <th>Status</th>
                <th>Respond</th>
              </tr>
            </thead>
            <tbody>
              {data.students?.map((s, i) => (
                <StudentRow key={s.crStudentId} i={i} s={s} reqId={data.id} onUpdated={onUpdated} />
              ))}
              {(!data.students || data.students.length === 0) && (
                <tr>
                  <td colSpan={4} className="text-muted text-center py-3">
                    No students.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- Irregular-only Respond Row ---------- */
function StudentRow({ i, s, reqId, onUpdated }) {
  const [show, setShow] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("fulfilled");
  const [irr, setIrr] = useState({
    PreviousLevelCourses: "",
    Level: "",
    Note: "",
    Replace: false,
  });

  const submit = async () => {
    setSending(true);
    try {
      const courses = String(irr.PreviousLevelCourses || "")
        .split(/[, \n]+/g)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const levelRaw = String(irr.Level || "").trim();
      const levelNum = levelRaw === "" ? undefined : Number(levelRaw);

      const data = {
        category: "irregular",
        PreviousLevelCourses: courses,
        ...(levelNum !== undefined && !Number.isNaN(levelNum) ? { Level: levelNum } : {}),
        replace: !!irr.Replace,
        ...(irr.Note ? { Note: irr.Note } : {}),
      };

      await API.post(
        `/registrarRequests/requests/${reqId}/students/${s.crStudentId}/respond`,
        { data, status }
      );

      setShow(false);
      onUpdated?.();
    } catch (e) {
      alert(formatServerError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <tr>
      <td>{i + 1}</td>
      <td>
        {s.studentName}
        {s.studentId ? <small className="text-muted ms-2">ID: {s.studentId}</small> : null}
      </td>
      <td>
        <span
          className={`badge ${
            s.status === "pending"
              ? "text-bg-warning"
              : s.status === "fulfilled"
              ? "text-bg-success"
              : s.status === "failed"
              ? "text-bg-danger"
              : "text-bg-secondary"
          }`}
        >
          {s.status}
        </span>
      </td>
      <td>
        <button className="btn btn-sm btn-outline-primary" onClick={() => setShow((v) => !v)}>
          {show ? "Cancel" : "Respond"}
        </button>

        {show && (
          <div className="border rounded p-3 mt-2" style={{ maxWidth: 560 }}>
            <div className="mb-2">
              <label className="form-label">Response Type</label>
              <select className="form-select" value="irregular" disabled>
                <option value="irregular">Add Irregular Student</option>
              </select>
            </div>

            <div className="mb-2">
              <label className="form-label">Previous Level Courses</label>
              <input
                className="form-control"
                placeholder="PHY201, MATH202, RAD203"
                value={irr.PreviousLevelCourses}
                onChange={(e) => setIrr((p) => ({ ...p, PreviousLevelCourses: e.target.value }))}
              />
              <small className="text-muted">comma/space separated</small>
            </div>

            <div className="mb-2">
              <label className="form-label">Level</label>
              <input
                type="number"
                className="form-control"
                value={irr.Level}
                onChange={(e) =>
                  setIrr((p) => ({ ...p, Level: e.target.value.replace(/[^\d]/g, "") }))
                }
                placeholder="1..8"
              />
            </div>

            <div className="form-check mb-2">
              <input
                id={`rep-${s.crStudentId}`}
                className="form-check-input"
                type="checkbox"
                checked={irr.Replace}
                onChange={(e) => setIrr((p) => ({ ...p, Replace: e.target.checked }))}
              />
              <label htmlFor={`rep-${s.crStudentId}`} className="form-check-label">
                Replace existing courses (instead of merge)
              </label>
            </div>

            <div className="mb-2">
              <label className="form-label">Note</label>
              <input
                className="form-control"
                value={irr.Note}
                onChange={(e) => setIrr((p) => ({ ...p, Note: e.target.value }))}
              />
            </div>

            <div className="mb-2">
              <label className="form-label">Line Status</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="fulfilled">fulfilled</option>
                <option value="pending">pending</option>
                <option value="rejected">rejected</option>
                <option value="failed">failed</option>
              </select>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-success" disabled={sending} onClick={submit}>
                {sending ? "Saving…" : "Save"}
              </button>
              <button className="btn btn-light" onClick={() => setShow(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
