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

      const token = res?.data?.token;
      const role = res?.data?.role || res?.data?.user?.role || "";

      if (!token) {
        alert("Signin succeeded but no token returned.");
        return;
      }

      // تخزين البيانات في localStorage
      localStorage.setItem("token", token);
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
