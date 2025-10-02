// src/pages/Requests/CreateRequest.jsx
import { useMemo, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ---------------- helpers ---------------- */
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
const padHash = (id, w = 6) => (id == null ? "" : `#${String(id).padStart(w, "0")}`);

// Build a readable error from axios/server payload
function buildServerError(err) {
  const res = err?.response?.data;
  const parts = [];
  if (res?.error) parts.push(res.error);
  if (res?.message) parts.push(res.message);
  if (res?.detail) parts.push(res.detail);
  if (res?.code) parts.push(`code: ${res.code}`);
  const msg = parts.filter(Boolean).join(" — ");
  return msg || err?.message || "Submit failed.";
}

export default function CreateRequest() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("DataRequest"); // "DataRequest" | "NewElective"
  const [level, setLevel] = useState("");
  const [neededFieldsText, setNeededFieldsText] = useState("");
  const [studentNamesText, setStudentNamesText] = useState("");
  const [description, setDescription] = useState("");

  // elective fields (single-elective form; you can expand later if needed)
  const [el, setEl] = useState({
    CourseID: "",
    name: "",
    seatCount: "",

    lectureSection: "",
    lectureDays: "Sun, Tue",
    lectureStart: "",
    lectureEnd: "",

    tutorialSection: "",
    tutorialDays: "Sun, Tue",
    tutorialStart: "",
    tutorialEnd: "",

    includeLab: false,
    labSection: "",
    labDays: "",
    labStart: "",
    labEnd: "",
  });

  const [sending, setSending] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  const fieldsArray = useMemo(() => parseNeededFields(neededFieldsText), [neededFieldsText]);
  const studentsArray = useMemo(() => parseStudentNames(studentNamesText), [studentNamesText]);

  const isElective = type === "NewElective";
  const isValid =
    title.trim() &&
    type &&
    (isElective
      ? el.CourseID.trim() && el.lectureSection // minimal required for elective
      : fieldsArray.length > 0 && studentsArray.length > 0);

  const payload = useMemo(() => {
    if (isElective) {
      const elective = {
        CourseID: el.CourseID.trim(),
        name: el.name.trim() || null,
        SeatCount: el.seatCount ? Number(el.seatCount) : null,

        lectureSection: el.lectureSection ? Number(el.lectureSection) : null,
        lectureDays: el.lectureDays || null,
        lectureStart: el.lectureStart || null,
        lectureEnd: el.lectureEnd || null,

        tutorialSection: el.tutorialSection ? Number(el.tutorialSection) : null,
        tutorialDays: el.tutorialDays || null,
        tutorialStart: el.tutorialStart || null,
        tutorialEnd: el.tutorialEnd || null,

        labSection: el.includeLab && el.labSection ? Number(el.labSection) : null,
        labDays: el.includeLab ? el.labDays || null : null,
        labStart: el.includeLab ? (el.labStart || null) : null,
        labEnd: el.includeLab ? (el.labEnd || null) : null,
      };

      return {
        title: title.trim(),
        type: "NewElective",
        level: level ? Number(level) : null,
        description: description.trim() || null,
        neededFields: [],      // ignored on server for electives
        studentNames: [],      // ignored on server for electives
        electives: [elective], // important
      };
    }

    return {
      title: title.trim(),
      type: "DataRequest",
      level: level ? Number(level) : null,
      neededFields: fieldsArray,
      studentNames: studentsArray,
      description: description.trim() || null,
    };
  }, [isElective, title, level, fieldsArray, studentsArray, description, el]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setOkMsg(""); setErrMsg("");

    if (!isValid) {
      setErrMsg(
        isElective
          ? "Please fill at least Course ID and Lecture Section."
          : "Please fill required fields (Title, Needed Fields, Student Names)."
      );
      return;
    }

    try {
      setSending(true);
      const { data } = await axios.post(`${API_BASE}/createRequests/requests`, payload, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });

      setOkMsg(`Created successfully ${padHash(data?.id)}`);
      setTimeout(() => setOkMsg(""), 2000);

      // reset
      setTitle(""); setType("DataRequest"); setLevel("");
      setNeededFieldsText(""); setStudentNamesText(""); setDescription("");
      setEl({
        CourseID: "", name: "", seatCount: "",
        lectureSection: "", lectureDays: "Sun, Tue", lectureStart: "", lectureEnd: "",
        tutorialSection: "", tutorialDays: "Sun, Tue", tutorialStart: "", tutorialEnd: "",
        includeLab: false, labSection: "", labDays: "", labStart: "", labEnd: "",
      });
    } catch (e) {
      console.error("CreateRequest POST failed:", e?.response?.data || e);
      setErrMsg(buildServerError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Create Data Request</h2>

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
                <option value="NewElective">Offer Elective</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Level</label>
              <input
                type="number"
                className="form-control"
                value={level}
                onChange={e=>setLevel(e.target.value)}
                placeholder="e.g., 3"
              />
            </div>

            {!isElective && (
              <>
                <div className="col-12">
                  <label className="form-label">Needed Fields * (comma-separated)</label>
                  <input
                    className="form-control"
                    placeholder="Update previous Course "
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
                    placeholder={`Noura salm.\nRaghad Ahmad\n...`}
                    value={studentNamesText}
                    onChange={(e) => setStudentNamesText(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {isElective && (
              <>
                <hr className="mt-2" />
                <div className="col-12"><h5 className="mb-2">Elective Details</h5></div>

                <div className="col-md-3">
                  <label className="form-label">Course ID *</label>
                  <input
                    className="form-control"
                    value={el.CourseID}
                    onChange={(e)=>setEl(p=>({...p, CourseID:e.target.value}))}
                    required
                  />
                </div>

                <div className="col-md-5">
                  <label className="form-label">Course Name</label>
                  <input
                    className="form-control"
                    value={el.name}
                    onChange={(e)=>setEl(p=>({...p, name:e.target.value}))}
                  />
                </div>

                <div className="col-md-2">
                  <label className="form-label">Seat Count</label>
                  <input
                    className="form-control"
                    inputMode="numeric"
                    value={el.seatCount}
                    onChange={(e)=>setEl(p=>({...p, seatCount:e.target.value.replace(/[^\d]/g,"")}))}
                  />
                </div>

                <div className="col-12 mt-2"><h6>Lecture</h6></div>
                <div className="col-md-3">
                  <label className="form-label">Section *</label>
                  <input
                    className="form-control"
                    value={el.lectureSection}
                    onChange={(e)=>setEl(p=>({...p, lectureSection:e.target.value.replace(/[^\d]/g,"")}))}
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label">Days</label>
                  <input
                    className="form-control"
                    value={el.lectureDays}
                    onChange={(e)=>setEl(p=>({...p, lectureDays:e.target.value}))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Start</label>
                  <input
                    type="time"
                    className="form-control"
                    value={el.lectureStart}
                    onChange={(e)=>setEl(p=>({...p, lectureStart:e.target.value}))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">End</label>
                  <input
                    type="time"
                    className="form-control"
                    value={el.lectureEnd}
                    onChange={(e)=>setEl(p=>({...p, lectureEnd:e.target.value}))}
                  />
                </div>

                <div className="col-12 mt-3"><h6>Tutorial</h6></div>
                <div className="col-md-3">
                  <label className="form-label">Section</label>
                  <input
                    className="form-control"
                    value={el.tutorialSection}
                    onChange={(e)=>setEl(p=>({...p, tutorialSection:e.target.value.replace(/[^\d]/g,"")}))}
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label">Days</label>
                  <input
                    className="form-control"
                    value={el.tutorialDays}
                    onChange={(e)=>setEl(p=>({...p, tutorialDays:e.target.value}))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Start</label>
                  <input
                    type="time"
                    className="form-control"
                    value={el.tutorialStart}
                    onChange={(e)=>setEl(p=>({...p, tutorialStart:e.target.value}))}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">End</label>
                  <input
                    type="time"
                    className="form-control"
                    value={el.tutorialEnd}
                    onChange={(e)=>setEl(p=>({...p, tutorialEnd:e.target.value}))}
                  />
                </div>

                <div className="col-12 mt-3 d-flex align-items-center gap-2">
                  <input
                    id="inclab"
                    type="checkbox"
                    className="form-check-input"
                    checked={el.includeLab}
                    onChange={(e)=>setEl(p=>({...p, includeLab:e.target.checked}))}
                  />
                  <label htmlFor="inclab" className="form-check-label">Include Lab</label>
                </div>

                {el.includeLab && (
                  <>
                    <div className="col-md-3">
                      <label className="form-label">Lab Section</label>
                      <input
                        className="form-control"
                        value={el.labSection}
                        onChange={(e)=>setEl(p=>({...p, labSection:e.target.value.replace(/[^\d]/g,"")}))}
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label">Days</label>
                      <input
                        className="form-control"
                        value={el.labDays}
                        onChange={(e)=>setEl(p=>({...p, labDays:e.target.value}))}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Start</label>
                      <input
                        type="time"
                        className="form-control"
                        value={el.labStart}
                        onChange={(e)=>setEl(p=>({...p, labStart:e.target.value}))}
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">End</label>
                      <input
                        type="time"
                        className="form-control"
                        value={el.labEnd}
                        onChange={(e)=>setEl(p=>({...p, labEnd:e.target.value}))}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="col-12 mt-3">
              <label className="form-label">Description (optional)</label>
              <textarea
                className="form-control"
                rows={3}
                value={description}
                onChange={(e)=>setDescription(e.target.value)}
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
