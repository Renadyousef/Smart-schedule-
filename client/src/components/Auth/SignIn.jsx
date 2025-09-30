import { useState } from "react";
import { validateEmail, validatePassword } from "./validations";
import axios from "axios";

export default function SignIn({ onLogin }) {
  const [inputs, setInputs] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  // تحديث الحقول
  const handleChange = (e) => {
    const { id, value } = e.target;
    setInputs((prev) => ({ ...prev, [id]: value }));
  };

  // التحقق عند فقدان التركيز
  const handleBlur = (e) => {
    const { id, value } = e.target;
    let error = "";
    if (id === "email") error = validateEmail(value);
    if (id === "password") error = validatePassword(value);
    setErrors((prev) => ({ ...prev, [id]: error }));
  };

  // عند الضغط على زر تسجيل الدخول
  const handleSubmit = async (e) => {
    e.preventDefault();

    // التحقق من الأخطاء
    const allErrors = {
      email: validateEmail(inputs.email),
      password: validatePassword(inputs.password),
    };
    setErrors(allErrors);
    if (!Object.values(allErrors).every((x) => !x)) return;

    try {
      // 🔑 الاتصال المباشر بالسيرفر على localhost:5000
      const res = await axios.post("http://localhost:5000/auth/signin", inputs);

      // ✅ أضفنا تخزين بيانات المستخدم هنا
      const { token, user } = res.data || {};
      if (!token || !user) {
        alert("Unexpected server response.");
        return;
      }

      // ★ ADD: لو المستخدم طالب وما فيه level في رد تسجيل الدخول، جيبيه من البروفايل ثم خزّنه
      let finalUser = user;
      try {
        const isStudent = String(user.role || "").toLowerCase() === "student";
        const hasLevel =
          user.level !== undefined && user.level !== null && user.level !== "";
        if (isStudent && !hasLevel) {
          const prof = await axios.get(
            `http://localhost:5000/api/profile/${user.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          finalUser = { ...user, level: prof.data?.level ?? null };
        }
      } catch (e2) {
        // لو فشل الجلب الإضافي، كمّلي بدون level
        console.warn("Could not fetch level after signin:", e2?.message);
      }

      // ★ ADD: خزّني user كامل (بما فيه level إن توفر)
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: finalUser.id,
          name: finalUser.name ?? "",
          email: finalUser.email,
          role: finalUser.role,
          level:
            finalUser.level === undefined || finalUser.level === null || finalUser.level === ""
              ? null
              : Number(finalUser.level),
        })
      );

      const role = res?.data?.role || res?.data?.user?.role || "";
      if (role) localStorage.setItem("role", String(role).toLowerCase());

      alert(res.data.message || "Sign in successful!");
      if (typeof onLogin === "function") onLogin();
    } catch (err) {
      console.error("Signin error:", err);

      if (err?.code === "ERR_NETWORK") {
        alert("Network error: Could not connect to backend. تأكدي أن السيرفر شغال على http://localhost:5000");
        return;
      }

      if (err?.response) {
        alert(err.response.data?.message || `Server error (${err.response.status}).`);
      } else {
        alert(err?.message || "Unknown error.");
      }
    }
  };

  return (
    <form className="p-4" onSubmit={handleSubmit}>
      {/* Email */}
      <div className="mb-3">
        <label htmlFor="email" className="form-label">Email</label>
        <input
          type="email"
          id="email"
          className="form-control"
          placeholder="Email"
          value={inputs.email}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        {errors.email && <small className="text-danger">{errors.email}</small>}
      </div>

      {/* Password */}
      <div className="mb-3">
        <label htmlFor="password" className="form-label">Password</label>
        <input
          type="password"
          id="password"
          className="form-control"
          placeholder="Password"
          value={inputs.password}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        {errors.password && <small className="text-danger">{errors.password}</small>}
      </div>

      <button type="submit" className="btn btn-primary w-100">Sign In</button>
    </form>
  );
}
