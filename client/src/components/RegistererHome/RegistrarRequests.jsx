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

export default function RegistrarRequests() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const qparams = useMemo(() => (statusFilter ? { status: statusFilter } : {}), [statusFilter]);

  const reloadList = () =>
    API
      .get(`/registrarRequests/requests`, { params: qparams })
      .then((r) => setList(r.data || []));

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
    <div className="container py-4">
      <h2 className="mb-3">Registrar Requests</h2>

      <div className="card mb-3">
        <div className="card-body d-flex gap-3">
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
        </div>
      </div>

      {err && (
        <div className="alert alert-danger">
          <div className="fw-semibold mb-1">Server error</div>
          <pre className="mb-0 small text-break">{err}</pre>
        </div>
      )}

      <div className="card">
        <div className="card-header bg-light">Requests</div>
        <div className="card-body p-0">
          {loading ? (
            <div className="p-3">Loading…</div>
          ) : list.length === 0 ? (
            <div className="p-3 text-muted">No requests.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Level</th>
                    <th>Needed Fields</th>
                    <th>CreatedAt</th>
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

      {loadingDetail && <div className="mt-3">Loading details…</div>}
    </div>
  );
}

/* ---------- detail & respond (Irregular only) ---------- */
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
        <div className="d-flex gap-2">
          
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
            <thead>
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
                  <td colSpan={4} className="text-muted">
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

/* ---------- Irregular-only respond row ---------- */
function StudentRow({ i, s, reqId, onUpdated }) {
  const [show, setShow] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("fulfilled");

  // Irregular-only form state
  const [irr, setIrr] = useState({
    PreviousLevelCourses: "",
    Level: "",
    Note: "",
    Replace: false,
  });

  const submit = async () => {
    setSending(true);
    try {
      // Normalize irregular payload exactly like before
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
            {/* Keep a locked dropdown for consistent layout */}
            <div className="mb-2">
              <label className="form-label">Response Type</label>
              <select className="form-select" value="irregular" disabled>
                <option value="irregular">Add Irregular Student</option>
              </select>
            </div>

            {/* Irregular fields */}
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

            {/* Line status remains the same */}
            <div className="mb-2">
              <label className="form-label">Line Status</label>
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
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
