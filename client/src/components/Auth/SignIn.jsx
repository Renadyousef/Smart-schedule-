import { useState } from "react";
import { validateEmail, validatePassword } from "./validations";
import axios from "axios";


export default function SignIn() {
  const [inputs, setInputs] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { id, value } = e.target;
    setInputs((prev) => ({ ...prev, [id]: value }));
  };

  const handleBlur = (e) => {
    const { id, value } = e.target;
    let error = "";

    if (id === "email") error = validateEmail(value);
    if (id === "password") error = validatePassword(value);

    setErrors((prev) => ({ ...prev, [id]: error }));
  };

 const handleSubmit = async (e) => {
    e.preventDefault();

    const allErrors = {
      email: validateEmail(inputs.email),
      password: validatePassword(inputs.password),
    };
    setErrors(allErrors);

    if (!Object.values(allErrors).every((err) => !err)) return;

    try {
      const res = await axios.post("http://localhost:5000/auth/signin", inputs);
      alert(res.data.message || "Sign in successful!");
      // Optionally: store user info or redirect
      console.log("User info:", res.data.user);
    } catch (err) {
      if (err.response) alert(err.response.data.message || "Server error.");
      else alert("Could not connect to backend.");//**error occures here
    }
  };


  return (
    <form className="p-4" onSubmit={handleSubmit}>
      {/* Email */}
      <div className="mb-3">
        <label htmlFor="email" className="form-label">
          Email
        </label>
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
        <label htmlFor="password" className="form-label">
          Password
        </label>
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

      {/* Submit Button */}
      <button type="submit" className="btn btn-primary w-100">
        Sign In
      </button>
    </form>
  );
}
