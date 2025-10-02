// client/src/components/RegistererHome/RegistrarRequests.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export default function RegistrarRequests() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [registrarId, setRegistrarId] = useState("");
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const qparams = useMemo(() => {
    const p = {};
    if (statusFilter) p.status = statusFilter;
    if (registrarId) p.registrarId = registrarId;
    return p;
  }, [statusFilter, registrarId]);

  useEffect(() => {
    setErr("");
    setLoading(true);
    axios
      .get(`${API_BASE}/registrarRequests/requests`, { params: qparams })
      .then((r) => setList(r.data || []))
      .catch((e) => setErr(e.response?.data?.error || e.message || "Load failed."))
      .finally(() => setLoading(false));
  }, [qparams]);

  const openRequest = async (id) => {
    setErr("");
    setLoadingDetail(true);
    try {
      const { data } = await axios.get(`${API_BASE}/registrarRequests/requests/${id}`);
      setActive(data);
    } catch (e) {
      setErr(e.response?.data?.error || e.message || "Open failed.");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Registrar Requests List </h2>

      <div className="card mb-3">
        <div className="card-body d-flex gap-3 flex-wrap">
          <div>
            <label className="form-label mb-1">Status</label>
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">(any)</option>
              <option value="pending">pending</option>
              <option value="fulfilled">fulfilled</option>
              <option value="rejected">rejected</option>
              <option value="failed">failed</option>
            </select>
          </div>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}

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
          onUpdated={() => {
            axios.get(`${API_BASE}/registrarRequests/requests/${active.id}`).then((r) => setActive(r.data));
            axios.get(`${API_BASE}/registrarRequests/requests`, { params: qparams }).then((r) => setList(r.data || []));
          }}
        />
      )}

      {loadingDetail && <div className="mt-3">Loading details…</div>}
    </div>
  );
}

/* ---------- detail & respond ---------- */

function RequestDetail({ data, onClose, onUpdated }) {
  const fields = asArray(data.neededFields);
  return (
    <div className="card mt-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <div className="fw-semibold">{data.title}</div>
          <small className="text-muted">
            Type: {data.type} · Status: {data.status} · Level: {data.level ?? "-"}
          </small>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>
          Close
        </button>
      </div>
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
                <StudentRow
                  key={s.crStudentId}
                  i={i}
                  s={s}
                  fields={fields}
                  reqId={data.id}
                  onUpdated={onUpdated}
                />
              ))}
              {(!data.students || data.students.length === 0) && (
                <tr>
                  <td colSpan={4} className="text-muted">No students.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- flexible respond row ---------- */

function StudentRow({ i, s, fields, reqId, onUpdated }) {
  const [show, setShow] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("fulfilled"); // supports 'failed'
  const [mode, setMode] = useState("auto"); // auto | irregular | elective | custom

  // auto (NeededFields)
  const [autoValues, setAutoValues] = useState(() => Object.fromEntries(fields.map((k) => [k, ""])));

  // irregular
  const [irr, setIrr] = useState({ PreviousLevelCourses: "", Level: "", Note: "", Replace: false });

  // elective — full UI (lecture/tutorial/lab)
  const [elec, setElec] = useState({
    CourseCode: "",
    SeatCount: "",
    Note: "",
    lecture: { section: "", days: "", start: "", end: "" },
    tutorial: { days: "", start: "", end: "" }, // section auto = lecture+1
    labIncluded: false,
    lab: { days: "", start: "", end: "" }, // section auto = lecture+2
  });

  // custom kv (kept)
  const [kv, setKv] = useState([{ key: "", value: "" }]);

  const submit = async () => {
    setSending(true);
    try {
      let data;
      if (mode === "auto") {
        data = { category: "auto", ...autoValues };
      } else if (mode === "irregular") {
        const courses = String(irr.PreviousLevelCourses || "")
          .split(/[, \n]+/g)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean);
        const level = String(irr.Level || "").trim() === "" ? undefined : Number(irr.Level);
        data = {
          category: "irregular",
          PreviousLevelCourses: courses,
          ...(level !== undefined && !Number.isNaN(level) ? { Level: level } : {}),
          replace: !!irr.Replace,
          ...(irr.Note ? { Note: irr.Note } : {}),
        };
      } else if (mode === "elective") {
        // build Offer Elective payload for backend
        const lectureSection = Number(elec.lecture.section || 0);
        const offer = {
          courseCode: elec.CourseCode || undefined,
          seatCount: Number(elec.SeatCount || 0) || undefined,
          note: elec.Note || undefined,
          lecture: {
            section: lectureSection || undefined,
            days: String(elec.lecture.days || "")
              .split(/[, ]+/g)
              .map((x) => x.trim())
              .filter(Boolean),
            start: elec.lecture.start || undefined,
            end: elec.lecture.end || undefined,
          },
          tutorial: {
            section: lectureSection ? lectureSection + 1 : undefined,
            days: String(elec.tutorial.days || "")
              .split(/[, ]+/g)
              .map((x) => x.trim())
              .filter(Boolean),
            start: elec.tutorial.start || undefined,
            end: elec.tutorial.end || undefined,
          },
          labIncluded: !!elec.labIncluded,
          lab: elec.labIncluded
            ? {
                section: lectureSection ? lectureSection + 2 : undefined,
                days: String(elec.lab.days || "")
                  .split(/[, ]+/g)
                  .map((x) => x.trim())
                  .filter(Boolean),
                start: elec.lab.start || undefined,
                end: elec.lab.end || undefined,
              }
            : undefined,
        };

        data = {
          responseType: "Offer Elective",
          offer,
        };
      } else {
        const obj = {};
        for (const row of kv) {
          const k = String(row.key || "").trim();
          if (!k) continue;
          obj[k] = row.value ?? "";
        }
        data = { category: "custom", ...obj };
      }

      await axios.post(
        `${API_BASE}/registrarRequests/requests/${reqId}/students/${s.crStudentId}/respond`,
        { data, status }
      );

      setShow(false);
      onUpdated?.();
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Respond failed.");
    } finally {
      setSending(false);
    }
  };

  const onLectSectionChange = (val) => {
    const n = val.replace(/[^\d]/g, "");
    setElec((p) => ({
      ...p,
      lecture: { ...p.lecture, section: n },
      // tutorial/lab sections are derived on submit
    }));
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
            {/* response mode */}
            <div className="mb-2">
              <label className="form-label">Response Type</label>
              <select className="form-select" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="auto">Auto (NeededFields)</option>
                <option value="irregular">Add Irregular Student</option>
                <option value="elective">Offer Elective</option>
                <option value="custom">Custom JSON</option>
              </select>
            </div>

            {/* auto */}
            {mode === "auto" && (
              <>
                {fields.length === 0 && <div className="alert alert-warning py-2">No needed fields in this request.</div>}
                {fields.map((k) => (
                  <div className="mb-2" key={k}>
                    <label className="form-label">{k}</label>
                    <input
                      className="form-control"
                      value={autoValues[k] ?? ""}
                      onChange={(e) => setAutoValues((prev) => ({ ...prev, [k]: e.target.value }))}
                    />
                  </div>
                ))}
              </>
            )}

            {/* irregular */}
            {mode === "irregular" && (
              <>
                <div className="mb-2">
                  <label className="form-label">Previous Level Courses</label>
                  <input
                    className="form-control"
                    placeholder="PHY201, MATH202, RAD203"
                    value={irr.PreviousLevelCourses}
                    onChange={(e) => setIrr((p) => ({ ...p, PreviousLevelCourses: e.target.value }))}
                  />
                  <small className="text-muted">comma/space separated; saved as unique array (merged by default).</small>
                </div>
                <div className="mb-2">
                  <label className="form-label">Level (optional)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={irr.Level}
                    onChange={(e) => setIrr((p) => ({ ...p, Level: e.target.value.replace(/[^\d]/g, "") }))}
                    placeholder="1..12"
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
              </>
            )}

            {/* elective — full UI */}
            {mode === "elective" && (
              <>
                <div className="mb-2">
                  <label className="form-label">Course Code</label>
                  <input
                    className="form-control"
                    value={elec.CourseCode}
                    onChange={(e) => setElec((p) => ({ ...p, CourseCode: e.target.value }))}
                    placeholder="e.g., SWE485"
                  />
                </div>

                <div className="mb-2">
                  <label className="form-label">Seat Count</label>
                  <input
                    type="number"
                    className="form-control"
                    value={elec.SeatCount}
                    onChange={(e) => setElec((p) => ({ ...p, SeatCount: e.target.value.replace(/[^\d]/g, "") }))}
                    placeholder="e.g., 35"
                  />
                </div>

                <div className="mb-2">
                  <label className="form-label">Note</label>
                  <input
                    className="form-control"
                    value={elec.Note}
                    onChange={(e) => setElec((p) => ({ ...p, Note: e.target.value }))}
                    placeholder="Optional note"
                  />
                </div>

                <hr className="my-3" />
                <h6 className="mb-2">Lecture</h6>
                <div className="mb-2">
                  <label className="form-label">Section</label>
                  <input
                    type="number"
                    className="form-control"
                    value={elec.lecture.section}
                    onChange={(e) => onLectSectionChange(e.target.value)}
                    placeholder="e.g., 51"
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Days (comma-separated, full day names)</label>
                  <input
                    className="form-control"
                    value={elec.lecture.days}
                    onChange={(e) => setElec((p) => ({ ...p, lecture: { ...p.lecture, days: e.target.value } }))}
                    placeholder="Sun, Tue"
                  />
                </div>
                <div className="d-flex gap-2 mb-2">
                  <input
                    type="time"
                    className="form-control"
                    value={elec.lecture.start}
                    onChange={(e) => setElec((p) => ({ ...p, lecture: { ...p.lecture, start: e.target.value } }))}
                  />
                  <input
                    type="time"
                    className="form-control"
                    value={elec.lecture.end}
                    onChange={(e) => setElec((p) => ({ ...p, lecture: { ...p.lecture, end: e.target.value } }))}
                  />
                </div>

                <hr className="my-3" />
                <h6 className="mb-2">Tutorial</h6>
                <div className="mb-2">
                  <label className="form-label">Section (auto = lecture + 1)</label>
                  <input type="number" className="form-control" value={Number(elec.lecture.section || 0) + 1 || ""} readOnly />
                </div>
                <div className="mb-2">
                  <label className="form-label">Days</label>
                  <input
                    className="form-control"
                    value={elec.tutorial.days}
                    onChange={(e) => setElec((p) => ({ ...p, tutorial: { ...p.tutorial, days: e.target.value } }))}
                    placeholder="Sun, Tue"
                  />
                </div>
                <div className="d-flex gap-2 mb-2">
                  <input
                    type="time"
                    className="form-control"
                    value={elec.tutorial.start}
                    onChange={(e) => setElec((p) => ({ ...p, tutorial: { ...p.tutorial, start: e.target.value } }))}
                  />
                  <input
                    type="time"
                    className="form-control"
                    value={elec.tutorial.end}
                    onChange={(e) => setElec((p) => ({ ...p, tutorial: { ...p.tutorial, end: e.target.value } }))}
                  />
                </div>

                <hr className="my-3" />
                <div className="form-check mb-2">
                  <input
                    id={`labInc-${s.crStudentId}`}
                    type="checkbox"
                    className="form-check-input"
                    checked={elec.labIncluded}
                    onChange={(e) => setElec((p) => ({ ...p, labIncluded: e.target.checked }))}
                  />
                  <label htmlFor={`labInc-${s.crStudentId}`} className="form-check-label">
                    Include Lab
                  </label>
                </div>

                {elec.labIncluded && (
                  <>
                    <h6 className="mb-2">Lab</h6>
                    <div className="mb-2">
                      <label className="form-label">Section (auto = lecture + 2)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={Number(elec.lecture.section || 0) + 2 || ""}
                        readOnly
                      />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Days</label>
                      <input
                        className="form-control"
                        value={elec.lab.days}
                        onChange={(e) => setElec((p) => ({ ...p, lab: { ...p.lab, days: e.target.value } }))}
                        placeholder="Thu"
                      />
                    </div>
                    <div className="d-flex gap-2 mb-2">
                      <input
                        type="time"
                        className="form-control"
                        value={elec.lab.start}
                        onChange={(e) => setElec((p) => ({ ...p, lab: { ...p.lab, start: e.target.value } }))}
                      />
                      <input
                        type="time"
                        className="form-control"
                        value={elec.lab.end}
                        onChange={(e) => setElec((p) => ({ ...p, lab: { ...p.lab, end: e.target.value } }))}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* custom */}
            {mode === "custom" && <KeyValueEditor rows={kv} onChange={setKv} />}

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

/* ---------- helpers ---------- */

function KeyValueEditor({ rows, onChange }) {
  const addRow = () => onChange([...rows, { key: "", value: "" }]);
  const update = (i, patch) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="mb-2">
      <label className="form-label">Custom data</label>
      {rows.map((row, i) => (
        <div className="d-flex gap-2 mb-2" key={i}>
          <input
            className="form-control"
            placeholder="key"
            value={row.key}
            onChange={(e) => update(i, { key: e.target.value })}
          />
          <input
            className="form-control"
            placeholder="value"
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button type="button" className="btn btn-outline-danger" onClick={() => remove(i)}>
            –
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addRow}>
        + Add row
      </button>
    </div>
  );
}
