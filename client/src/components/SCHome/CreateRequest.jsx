import { useMemo, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000"; // ← server root

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

export default function CreateRequest() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("DataRequest");
  const [level, setLevel] = useState("");
  const [neededFieldsText, setNeededFieldsText] = useState("");
  const [studentNamesText, setStudentNamesText] = useState("");
  const [description, setDescription] = useState("");

  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const fieldsArray = useMemo(() => parseNeededFields(neededFieldsText), [neededFieldsText]);
  const studentsArray = useMemo(() => parseStudentNames(studentNamesText), [studentNamesText]);

  const isValid = title.trim() && type && fieldsArray.length > 0 && studentsArray.length > 0;

  const payload = useMemo(() => ({
    title: title.trim(),
    type,
    level: level ? Number(level) : null,
    neededFields: fieldsArray,
    studentNames: studentsArray,
    description: description.trim() || null,
  }), [title, type, level, fieldsArray, studentsArray, description]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setOkMsg(""); setErrMsg("");

    if (!isValid) {
      setErrMsg("Please fill required fields (Title, Needed Fields, Student Names).");
      return;
    }

    try {
      setSending(true);
      // IMPORTANT: backend mounts at /createRequests (lowercase)
      const res = await axios.post(`${API_BASE}/createRequests/requests`, payload);
      setOkMsg(`Created successfully. #${res?.data?.id ?? ""}`);
      setTitle(""); setType("DataRequest"); setLevel("");
      setNeededFieldsText(""); setStudentNamesText(""); setDescription("");
    } catch (e) {
      setErrMsg(e?.response?.data?.error || e.message || "Submit failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Create Data Request (Schedule Committee)</h2>

      {okMsg ? <div className="alert alert-success">{okMsg}</div> : null}
      {errMsg ? <div className="alert alert-danger">{errMsg}</div> : null}

      <form className="card shadow-sm" onSubmit={handleSubmit}>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label">Title *</label>
              <input className="form-control" value={title} onChange={e=>setTitle(e.target.value)} required />
            </div>

            <div className="col-md-4">
              <label className="form-label">Type *</label>
              <select className="form-select" value={type} onChange={e=>setType(e.target.value)} required>
                <option value="DataRequest">DataRequest</option>
                <option value="Confirmation">Confirmation</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Level</label>
              <input type="number" className="form-control" value={level} onChange={e=>setLevel(e.target.value)} placeholder="e.g., 3" />
            </div>

            <div className="col-12">
              <label className="form-label">Needed Fields * (comma-separated)</label>
              <input
                className="form-control"
                placeholder="GPA, Advisor, CarriedCourses"
                value={neededFieldsText}
                onChange={(e) => setNeededFieldsText(e.target.value)}
                required
              />
              {fieldsArray.length > 0 && (
                <small className="text-muted d-block mt-1">[{fieldsArray.join(", ")}]</small>
              )}
            </div>

            <div className="col-12">
              <label className="form-label">Student Names * (one per line or commas)</label>
              <textarea
                className="form-control"
                rows={5}
                placeholder={`Noura Al-F.\nRaghad Ahmad\n...`}
                value={studentNamesText}
                onChange={(e) => setStudentNamesText(e.target.value)}
                required
              />
            </div>

            <div className="col-12">
              <label className="form-label">Description (optional)</label>
              <textarea
                className="form-control"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card-footer d-flex justify-content-end gap-2">
          <button type="submit" className="btn btn-primary" disabled={sending || !isValid}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>

     
    </div>
  );
}
