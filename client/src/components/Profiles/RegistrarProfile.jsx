// client/src/components/Profiles/RegistrarProfile.jsx
import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import axios from "axios";
import API from "../../API_continer";

import SC_Header from "../SCHome/Header.jsx";
import Footer from "../Footer/Footer.jsx";


const api = axios.create({ baseURL: "http://localhost:5000" });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});


const http = API || api;

export default function RegistrarProfile({
  includeHeader = false,
  includeFooter = false,
}) {
  const [user, setUser] = React.useState({
    name: "Registrar User",
    email: "registrar@example.com",
    role: "Registrar",
    department: "Registrar Office",
  });

  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({ name: user.name, email: user.email });
  const [errors, setErrors] = React.useState({ name: "", email: "" });
  const [notice, setNotice] = React.useState("");

  // جلب البروفايل من الباك-إند عند التحميل
  React.useEffect(() => {
    async function fetchProfile() {
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "null");
        if (!stored?.id) throw new Error("No user in localStorage");


        const { data } = await http.get(`/api/profile/${stored.id}`);

        const fullName =
          [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ||
          data.name ||
          "Registrar User";

        const next = {
          name: fullName,
          email: data.email || "registrar@example.com",
          role: data.role || "Registrar",
          department: data?.department?.name || "Registrar Office",
        };
        setUser(next);
        setForm({ name: next.name, email: next.email });
      } catch (err) {
        console.error("Fetch profile failed:", err);
        setNotice("Failed to load profile.");
        setTimeout(() => setNotice(""), 3000);
      }
    }
    fetchProfile();
  }, []);

  React.useEffect(() => {
    setForm({ name: user.name, email: user.email });
  }, [user.name, user.email]);

  function validate() {
    const e = { name: "", email: "" };
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = "Name must be at least 2 characters.";
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    if (!emailRe.test(form.email.trim())) e.email = "Enter a valid email address.";
    setErrors(e);
    return !e.name && !e.email;
  }

  function onEdit() {
    setNotice("");
    setIsEditing(true);
  }
  function onCancel() {
    setForm({ name: user.name, email: user.email });
    setErrors({ name: "", email: "" });
    setNotice("");
    setIsEditing(false);
  }

  async function onSave(e) {
    e?.preventDefault?.();
    setNotice("");
    if (!validate()) return;

    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (!stored?.id) throw new Error("No user in localStorage");

      // نفصل الاسم لأول/أخير للباك-إند
      const [firstName, ...rest] = form.name.trim().split(/\s+/);
      const lastName = rest.join(" ") || "-";

      await http.put(`/api/profile/${stored.id}`, {
        firstName,
        lastName,
        email: form.email.trim(),
      });

      const updated = { ...user, name: form.name.trim(), email: form.email.trim() };
      setUser(updated);

      // تحديث الكاش المحلي (اختياري)
      try {
        const ls = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem(
          "user",
          JSON.stringify({ ...ls, name: updated.name, email: updated.email })
        );
      } catch {}

      setIsEditing(false);
      setNotice("Changes saved.");
      setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      console.error("Update profile failed:", err);
      setNotice("Failed to save changes.");
      setTimeout(() => setNotice(""), 3000);
    }
  }

  return (
    <div className="sc-profile" dir="ltr">
      {/* هيدر اختياري */}
      {includeHeader && (
        <div className="sticky-top backdrop-wrap">
          <SC_Header
            onLogout={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              location.reload();
            }}
            userName={user.name}
            email={user.email}
            avatarUrl=""
          />
        </div>
      )}

      {/* Hero */}
      <section className={`hero area-constrained ${includeHeader ? "" : "hero-top-pad"}`}>
        <div className="hero-inner">
          <div className="avatar-wrap">
            {/* ✅ Avatar ثابت: حرف R دائمًا */}
            <div className="avatar-fallback"><span>R</span></div>
            <span className="avatar-ring" aria-hidden />
          </div>

          <div className="identity">
            <h1 className="name">{user.name}</h1>
            <p className="email">{user.email}</p>

            <div className="chips">
              <span className="chip chip-role" title="Role">{user.role}</span>
              <span className="chip chip-dept" title="Department">{user.department}</span>
            </div>
          </div>
        </div>

        {/* wave */}
        <svg className="wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="regGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c7d2fe" />
              <stop offset="55%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <path d="M0,64 C240,100 480,40 720,64 C960,88 1200,76 1440,60 L1440,160 L0,160 Z" fill="url(#regGrad)"/>
        </svg>
      </section>

      {/* Card */}
      <main className="area-constrained main-pad">
        {notice && <div className="alert alert-primary shadow-sm soft-alert">{notice}</div>}

        <div className="glass-card">
          <h2 className="card-title">Profile details</h2>
          <form className="row g-3" onSubmit={onSave}>
            <div className="col-12 col-md-6">
              <label className="form-label">Name</label>
              <input
                className={`form-control form-elev ${errors.name ? "is-invalid" : ""}`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={!isEditing}
                readOnly={!isEditing}
                placeholder="Your full name"
              />
              {errors.name && <div className="invalid-feedback d-block">{errors.name}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Email</label>
              <input
                className={`form-control form-elev ${errors.email ? "is-invalid" : ""}`}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={!isEditing}
                readOnly={!isEditing}
                placeholder="name@example.com"
                inputMode="email"
              />
              {errors.email && <div className="invalid-feedback d-block">{errors.email}</div>}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Role</label>
              <input className="form-control form-readonly" value={user.role} disabled readOnly />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Department</label>
              <input className="form-control form-readonly" value={user.department} disabled readOnly />
            </div>

            <div className="col-12 d-flex flex-wrap justify-content-end gap-2 mt-2">
              {!isEditing ? (
                <button type="button" className="btn btn-primary btn-lg px-4" onClick={onEdit}>Edit</button>
              ) : (
                <>
                  <button type="button" className="btn btn-outline-secondary btn-lg" onClick={onCancel}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-lg px-4">Save</button>
                </>
              )}
            </div>
          </form>
        </div>
      </main>

      {/* فوتر اختياري */}
      {includeFooter && <Footer />}

      {/* نفس ستايل TLCProfile/SC */}
      <style>{`
        :root{
          --page-bg:#f3f5f8;
          --ink:#0f172a;
          --muted:#64748b;
          --blue:#3b82f6;
          --ring:#60a5fa;
          --card:#ffffffcc;
          --glass-blur:10px;
          --radius:18px;
          --shadow-lg:0 12px 30px rgba(15,23,42,.10);
          --shadow-sm:0 6px 16px rgba(15,23,42,.06);
          --maxw:980px;
        }
        body{ background:var(--page-bg); }
        .sc-profile{ color:var(--ink); min-height:100vh; display:flex; flex-direction:column; }
        .area-constrained{ width:min(var(--maxw),100%); margin-inline:auto; padding-inline:clamp(12px,2vw,24px); }
        .backdrop-wrap{ backdrop-filter:saturate(120%) blur(8px); background:rgba(255,255,255,.65); border-bottom:1px solid rgba(148,163,184,.2); z-index:1030; }
        .hero{ position:relative; padding-top:clamp(56px,7vh,72px); }
        .hero-top-pad{ padding-top:clamp(24px,5vh,40px); }
        .hero-inner{ display:flex; align-items:center; gap:clamp(16px,3vw,28px); padding-block:clamp(22px,3.5vh,34px); }
        .avatar-wrap{ position:relative; width:clamp(84px,14vw,120px); height:clamp(84px,14vw,120px); }
        .avatar-fallback{ width:100%; height:100%; border-radius:50%; display:flex; align-items:center; justify-content:center;
          background:radial-gradient(120% 120% at 30% 20%, #60a5fa 0%, #3b82f6 45%, #2563eb 100%); color:#fff; font-weight:800;
          letter-spacing:.5px; font-size:clamp(18px,2vw,22px); box-shadow:var(--shadow-lg); }
        .avatar-ring{ content:""; position:absolute; inset:-6px; border-radius:50%; background:conic-gradient(from 0deg,#93c5fd,#3b82f6,#93c5fd);
          mask:radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 5px)); -webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 5px));
          filter:blur(.3px); opacity:.9; }
        .identity{ display:flex; flex-direction:column; gap:6px; }
        .name{ font-size:clamp(20px,2.2vw,26px); font-weight:800; margin:0; }
        .email{ margin:0; color:var(--muted); font-size:clamp(12px,1.6vw,14px); }
        .chips{ display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
        .chip{ --bg:#eef2ff; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:600; border:1px solid rgba(99,102,241,.15); background:var(--bg); }
        .chip-role{ --bg:#eff6ff; border-color:rgba(59,130,246,.20); }
        .chip-dept{ --bg:#f0f9ff; border-color:rgba(14,165,233,.20); }
        .wave{ width:100%; height:clamp(64px,8vh,110px); }
        .main-pad{ padding-block:clamp(14px,2vh,22px) clamp(28px,6vh,44px); flex:1; }
        .soft-alert{ border-radius:12px; }
        .glass-card{ background:var(--card); border-radius:var(--radius); box-shadow:var(--shadow-lg); border:1px solid rgba(148,163,184,.22); backdrop-filter:blur(var(--glass-blur)); padding:clamp(16px,2vw,22px); }
        .card-title{ font-size:16px; font-weight:800; margin-bottom:8px; letter-spacing:.3px; }
        .form-label{ font-weight:700; color:var(--ink); }
        .form-elev{ border-radius:12px; border-color:#e2e8f0; background:#fff; box-shadow:var(--shadow-sm); transition: box-shadow .2s، border-color .2s، transform .06s; }
        .form-elev:focus{ border-color:var(--ring); box-shadow:0 0 0 4px rgba(96,165,250,.2); }
        .form-readonly{ background:#f8fafc; border-color:#e2e8f0; border-radius:12px; }
        .btn.btn-primary{ --bs-btn-bg:var(--blue); --bs-btn-border-color:var(--blue); --bs-btn-hover-bg:#2563eb; --bs-btn-hover-border-color:#2563eb; --bs-btn-focus-shadow-rgb:96,165,250; border-radius:12px; font-weight:700; }
        .btn-outline-secondary{ border-radius:12px; font-weight:700; }
        .dropdown-menu{ z-index:1080; }
      `}</style>
    </div>
  );
}
