// src/pages/Requests/CreateRequest.jsx
import { useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import API from "../../API_continer";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ===== Helpers (unchanged) ===== */
function parseNeededFields(input) {
  const parts = String(input || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) if (!seen.has(p)) { seen.add(p); out.push(p); }
  return out;
}
function parseStudentNames(txt) {
  const parts = String(txt || "")
    .split(/\r?\n|,/g)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) if (!seen.has(p)) { seen.add(p); out.push(p); }
  return out;
}
function buildServerError(err) {
  const res = err?.response?.data;
  const parts = [];
  if (res?.error) parts.push(res.error);
  if (res?.message) parts.push(res.message);
  if (res?.detail) parts.push(res.detail);
  if (res?.code) parts.push(`code: ${res.code}`);
  return parts.filter(Boolean).join(" — ") || err?.message || "Submit failed.";
}

/* ===== Main Component ===== */
export default function CreateRequest() {
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [neededFieldsText, setNeededFieldsText] = useState("");
  const [studentNamesText, setStudentNamesText] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const fieldsArray = useMemo(() => parseNeededFields(neededFieldsText), [neededFieldsText]);
  const studentsArray = useMemo(() => parseStudentNames(studentNamesText), [studentNamesText]);
  const isValid = title.trim() && fieldsArray.length > 0 && studentsArray.length > 0;

  const payload = useMemo(() => ({
    title: title.trim(),
    type: "DataRequest",
    level: level ? Number(level) : null,
    neededFields: fieldsArray,
    studentNames: studentsArray,
    description: description.trim() || null,
  }), [title, level, fieldsArray, studentsArray, description]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setOkMsg(""); setErrMsg("");
    if (!isValid) return setErrMsg("Please fill required fields (Title, Needed Fields, Student Names).");
    try {
      setSending(true);
      await API.post(`/createRequests/requests`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      setOkMsg("Request created successfully ✅");
      setTimeout(() => setOkMsg(""), 2000);
      setTitle(""); setLevel(""); setNeededFieldsText(""); setStudentNamesText(""); setDescription("");
    } catch (e) {
      console.error("CreateRequest POST failed:", e?.response?.data || e);
      setErrMsg(buildServerError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <style>{`
        :root {
          --brand-500:#1766ff;
          --brand-600:#0d52d6;
          --brand-700:#0a3ea7;
          --brand-50:#ecf3ff;
        }
        .page-wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
        }
        .hero {
          background: radial-gradient(1200px 400px at 10% -20%, var(--brand-500) 0%, var(--brand-700) 55%, #072a77 100%);
          color: #fff;
          border-radius: 1rem;
          padding: 2.8rem 2.5rem;
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
        }
        .card {
          border: 0;
          border-radius: 1rem;
          box-shadow: 0 6px 18px rgba(13,82,214,.08);
        }
        .form-control:focus {
          border-color: var(--brand-500)!important;
          box-shadow: 0 0 0 .25rem rgba(23,102,255,.15)!important;
        }
        .btn-primary {
          background: linear-gradient(180deg,var(--brand-500),var(--brand-700));
          border: 0;
          box-shadow: 0 8px 24px rgba(23,102,255,.25);
          transition: transform .12s ease, filter .2s ease;
        }
        .btn-primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .alert-success { background:#e8f3ff; color:#0744a5; border:1px solid #bcd9ff; }
        .alert-danger { background:#fff2f2; border:1px solid #ffd5d5; }
      `}</style>

      <div className="page-wrap">
        <main className="page-main">
          <div className="container py-5">
            
            {/* 🌈 Hero Section */}
            <div className="hero mb-5">
              <h1 className="display-6 fw-bold mb-2">Create Data Request</h1>
              <p className="mb-0 fs-5" style={{ opacity: 0.95 }}>
                Fill in the request details and submit them for processing.
              </p>
            </div>

            {/* 🧾 Full-width form card */}
            <form className="card p-4" onSubmit={handleSubmit}>
              <div className="card-body">
                {okMsg && <div className="alert alert-success">{okMsg}</div>}
                {errMsg && <div className="alert alert-danger">{errMsg}</div>}

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Title *</label>
                    <input
                      className="form-control"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Level</label>
                    <input
                      type="number"
                      className="form-control"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      placeholder="e.g., 3"
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold">
                      Needed Fields * (comma-separated)
                    </label>
                    <input
                      className="form-control"
                      placeholder="Update previous Course, Something else"
                      value={neededFieldsText}
                      onChange={(e) => setNeededFieldsText(e.target.value)}
                      required
                    />
                    {fieldsArray.length > 0 && (
                      <small className="text-muted d-block mt-1">
                        [{fieldsArray.join(", ")}]
                      </small>
                    )}
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-semibold">
                      Student Names * (one per line or commas)
                    </label>
                    <textarea
                      className="form-control"
                      rows={5}
                      placeholder={`Noura Salem\nRaghad Ahmad\n...`}
                      value={studentNamesText}
                      onChange={(e) => setStudentNamesText(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12 mt-3">
                    <label className="form-label fw-semibold">Description (optional)</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end mt-4">
                  <button
                    type="submit"
                    className="btn btn-primary px-4"
                    disabled={sending || !isValid}
                  >
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </main>
      </div>
    </>
  );
}
