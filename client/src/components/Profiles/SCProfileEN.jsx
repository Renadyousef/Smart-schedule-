// src/components/Profiles/SCProfileEN.jsx
import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import axios from "axios";
import API from "../../API_continer";

/**
 * SC Profile (EN) — بدون هيدر/فوتر
 * - Avatar fallback ثابت "SC"
 * - يجلب/يحدث بيانات المستخدم من الـ backend
 */

// Axios instance مع Authorization تلقائي
const api = axios.create({ baseURL: "http://localhost:5000" });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// نفضّل الـ API المشترك إن وُجد (بدون حذف الشيفرة القديمة)
const http = API || api;

export default function SCProfileEN() {
  const [user, setUser] = React.useState({
    name: "SC Member",
    email: "sc@example.com",
    role: "Student",
    department: "SWE",
  });

  const [isEditing, setIsEditing] = React.useState(false);
  const [form, setForm] = React.useState({
    name: user.name,
    email: user.email,
    level: "", // NEW
  });
  const [errors, setErrors] = React.useState({ name: "", email: "" });
  const [notice, setNotice] = React.useState("");

  // جلب بيانات البروفايل عند التحميل
  React.useEffect(() => {
    async function fetchProfile() {
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "null");
        if (!stored?.id) throw new Error("No user in localStorage");

        const { data } = await http.get(`/api/profile/${stored.id}`);
        const fullName =
          [data.firstName, data.lastName].filter(Boolean).join(" ").trim() ||
          data.name ||
          "SC Member";

        setUser({
          name: fullName,
          email: data.email,
          role: data.role || "Student",
          department: data?.department?.name || "SWE",
        });

        setForm({
          name: fullName,
          email: data.email,
          level: data.level ?? "", // NEW: null -> ""
        });

        // ✅ ADD: مزامنة localStorage.user لتتضمن level
        try {
          const ls = JSON.parse(localStorage.getItem("user") || "{}");
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...ls,
              id: data.id ?? ls.id,
              name: fullName,
              email: data.email ?? ls.email,
              role: data.role ?? ls.role,
              departmentId: data.departmentId ?? ls.departmentId ?? null,
              department:
                data?.department?.name ||
                data?.department ||
                ls.department ||
                null,
              level: data.level ?? ls.level ?? null,
            })
          );
        } catch {}
      } catch (err) {
        console.error("Fetch profile failed:", err?.response?.data || err);
        setNotice(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            "Failed to load profile."
        );
        setTimeout(() => setNotice(""), 3000);
      }
    }
    fetchProfile();
  }, []);

  // مزامنة الاسم والإيميل لو تغيروا
  React.useEffect(() => {
    setForm((f) => ({ ...f, name: user.name, email: user.email }));
  }, [user.name, user.email]);

  const initials = "SU"; // ثابتة

  function validate() {
    const e = { name: "", email: "" };
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = "Name must be at least 2 characters.";
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    if (!emailRe.test(form.email.trim()))
      e.email = "Enter a valid email address.";
    setErrors(e);
    return !e.name && !e.email;
  }

  function onEdit() {
    setNotice("");
    setIsEditing(true);
  }

  function onCancel() {
    setForm((f) => ({
      name: user.name,
      email: user.email,
      level: f.level, // نخليها كما هي آخر قيمة محملة
    }));
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

      const [firstName, ...rest] = form.name.trim().split(/\s+/);
      const lastName = rest.join(" ") || "-";

      const { data } = await http.put(`/api/profile/${stored.id}`, {
        firstName,
        lastName,
        email: form.email.trim(),
        // نرسل المستوى إذا تم اختياره—الباك إند سيعمل upsert بجدول Students
        level: form.level === "" ? null : Number(form.level),
      });

      const updated = {
        ...user,
        name: form.name.trim(),
        email: form.email.trim(),
      };
      setUser(updated);

      // تحديث بسيط لـ localStorage
      try {
        const ls = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...ls,
            name: updated.name,
            email: updated.email,
          })
        );
      } catch {}

      // ✅ ADD: تأكيد حفظ level في localStorage.user + مزامنة من السيرفر
      try {
        const ls2 = JSON.parse(localStorage.getItem("user") || "{}");
        const nextLevel =
          form.level === "" ||
          form.level === null ||
          form.level === undefined
            ? ls2.level ?? null
            : Number(form.level);
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...ls2,
            level: nextLevel,
          })
        );
      } catch {}

      // (اختياري آمن) جلب سريع لتأكيد المستوى من السيرفر
      http
        .get(`/api/profile/${stored.id}`)
        .then(({ data }) => {
          try {
            const ls3 = JSON.parse(localStorage.getItem("user") || "{}");
            localStorage.setItem(
              "user",
              JSON.stringify({
                ...ls3,
                level: data?.level ?? ls3.level ?? null,
              })
            );
          } catch {}
        })
        .catch(() => {});

      setIsEditing(false);
      setNotice("Changes saved.");
      setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      console.error("Update profile failed:", err?.response?.data || err);
      setNotice(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to save changes."
      );
      setTimeout(() => setNotice(""), 3000);
    }
  }

  return (
    <div className="sc-profile" dir="ltr">
      {/* Hero */}
      <section className="hero area-constrained hero-top-pad">
        <div className="hero-inner">
          <div className="avatar-wrap">
            <div className="avatar-fallback">
              <span>{initials}</span>
            </div>
            <span className="avatar-ring" aria-hidden />
          </div>

          <div className="identity">
            <h1 className="name">{user.name}</h1>
            <p className="email">{user.email}</p>

            <div className="chips">
              <span className="chip chip-role" title="Role">
                {user.role}
              </span>
              <span className="chip chip-dept" title="Department">
                {user.department}
              </span>
            </div>
          </div>
        </div>

        {/* wave */}
        <svg
          className="wave"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="scGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c7d2fe" />
              <stop offset="55%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <path
            d="M0,64 C240,100 480,40 720,64 C960,88 1200,76 1440,60 L1440,160 L0,160 Z"
            fill="url(#scGrad)"
          />
        </svg>
      </section>

      {/* Card */}
      <main className="area-constrained main-pad">
        {notice && (
          <div className="alert alert-primary shadow-sm soft-alert">{notice}</div>
        )}

        <div className="glass-card">
          <h2 className="card-title">Profile details</h2>
          <form className="row g-3" onSubmit={onSave}>
            <div className="col-12 col-md-6">
              <label className="form-label">Name</label>
              <input
                className={`form-control form-elev ${
                  errors.name ? "is-invalid" : ""
                }`}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                disabled={!isEditing}
                readOnly={!isEditing}
                placeholder="Your full name"
              />
              {errors.name && (
                <div className="invalid-feedback d-block">{errors.name}</div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Email</label>
              <input
                className={`form-control form-elev ${
                  errors.email ? "is-invalid" : ""
                }`}
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                disabled={!isEditing}
                readOnly={!isEditing}
                placeholder="name@example.com"
                inputMode="email"
              />
              {errors.email && (
                <div className="invalid-feedback d-block">{errors.email}</div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Role</label>
              <input
                className="form-control form-readonly"
                value={user.role}
                disabled
                readOnly
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Department</label>
              <input
                className="form-control form-readonly"
                value={user.department}
                disabled
                readOnly
              />
            </div>

            {/* NEW: Level (1–8) للطالب */}
            {user.role?.toLowerCase() === "student" && (
              <div className="col-12 col-md-6">
                <label className="form-label">Set your Level</label>
                <select
                  className="form-select form-elev"
                  value={form.level}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, level: e.target.value }))
                  }
                  disabled={!isEditing}
                >
                  <option value="">-- Select Level --</option>
                  {[...Array(8)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-12 d-flex flex-wrap justify-content-end gap-2 mt-2">
              {!isEditing ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg px-4"
                  onClick={onEdit}
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-lg"
                    onClick={onCancel}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-lg px-4">
                    Save
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </main>

      {/* ===== Styles ===== */}
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
        .hero{ position:relative; padding-top:clamp(40px,7vh,64px); }
        .hero-inner{ display:flex; align-items:center; gap:clamp(16px,3vw,28px); padding-block:clamp(22px,3.5vh,34px); }
        .avatar-wrap{ position:relative; width:clamp(84px,14vw,120px); height:clamp(84px,14vw,120px); }
        .avatar-fallback{
          width:100%; height:100%; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          background: radial-gradient(120% 120% at 30% 20%, #60a5fa 0%, #3b82f6 45%, #2563eb 100%);
          color:#fff; font-weight:800; letter-spacing:.5px; font-size:clamp(18px,2vw,22px);
          box-shadow: var(--shadow-lg);
        }
        .avatar-ring{
          content:""; position:absolute; inset:-6px; border-radius:50%;
          background: conic-gradient(from 0deg, #93c5fd, #3b82f6, #93c5fd);
          mask: radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 5px));
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 5px));
          filter: blur(.3px); opacity:.9;
        }
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
        .form-elev{ border-radius:12px; border-color:#e2e8f0; background:#fff; box-shadow:var(--shadow-sm); transition: box-shadow .2s, border-color .2s, transform .06s; }
        .form-elev:focus{ border-color:var(--ring); box-shadow:0 0 0 4px rgba(96,165,250,.2); }
        .form-readonly{ background:#f8fafc; border-color:#e2e8f0; border-radius:12px; }
        .btn.btn-primary{ --bs-btn-bg:var(--blue); --bs-btn-border-color:var(--blue); --bs-btn-hover-bg:#2563eb; --bs-btn-hover-border-color:#2563eb; --bs-btn-focus-shadow-rgb:96,165,250; border-radius:12px; font-weight:700; }
        .btn-outline-secondary{ border-radius:12px; font-weight:700; }
      `}</style>
    </div>
  );
}
