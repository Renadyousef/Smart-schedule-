import { useState } from "react";
import { validateEmail, validatePassword } from "./validations";
import axios from "axios";
import API from "../../API_continer"; 


export default function SignIn({ onLogin }) {
  const [inputs, setInputs] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { id, value } = e.target;
    setInputs(prev => ({ ...prev, [id]: value }));

    // Live validation
    let error = "";
    if (id === "email") error = validateEmail(value);
    if (id === "password") error = validatePassword(value);
    setErrors(prev => ({ ...prev, [id]: error }));
  };

  const handleBlur = (e) => {
    const { id, value } = e.target;
    let error = "";
    if (id === "email") error = validateEmail(value);
    if (id === "password") error = validatePassword(value);
    setErrors(prev => ({ ...prev, [id]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const allErrors = {
      email: validateEmail(inputs.email),
      password: validatePassword(inputs.password),
    };
    setErrors(allErrors);
    if (!Object.values(allErrors).every(x => !x)) return;

    try {
      const res = await API.post("/auth/signin", inputs);
      const { token, user } = res.data || {};
      if (!token || !user) {
        alert("Unexpected server response.");
        return;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify({
        id: user.id,
        name: user.name ?? "",
        email: user.email,
        role: user.role,
        level: user.level ?? null,
      }));

      localStorage.setItem("role", String(user.role).toLowerCase());

      alert(res.data.message || "Sign in successful!");
      if (typeof onLogin === "function") onLogin();
    } catch (err) {
      console.error("Signin error:", err);
      if (err?.code === "ERR_NETWORK") {
        alert("Network error: Could not connect to backend.");
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
        <input type="email" id="email" className="form-control" value={inputs.email} onChange={handleChange} onBlur={handleBlur} placeholder="Email" />
        {errors.email && <small className="text-danger">{errors.email}</small>}
      </div>

      {/* Password */}
      <div className="mb-3">
        <label htmlFor="password" className="form-label">Password</label>
        <input type="password" id="password" className="form-control" value={inputs.password} onChange={handleChange} onBlur={handleBlur} placeholder="Password" />
        {errors.password && <small className="text-danger">{errors.password}</small>}
      </div>

      <button type="submit" className="btn btn-primary w-100">Sign In</button>
    </form>
  );
}
