// SignUp.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { validateEmail, validatePassword, validateName, validateDropdown, getRoleByEmail } from "./validations";
import emailjs from "@emailjs/browser";
import DepartmentDropdown from "./Departments";
import API from "../../API_continer";

const EMAILJS_PUBLIC_KEY  = "x5WDJxfErFk5PA4Pj";
const EMAILJS_SERVICE_ID  = "service_rnr7lbk";
const EMAILJS_TEMPLATE_ID = "template_1cnpeyg";
const APP_NAME = "SmartSchedule";

function genOTP() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}
function secsLeft(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function SignUp({ onSignedUp }) {
  const [inputs, setInputs] = useState({
    firstName: "",
    lastName: "",
    role: "",
    department: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [roleLocked, setRoleLocked] = useState(false);

  const [otpUI, setOtpUI] = useState({
    show: false,
    sending: false,
    verifying: false,
    otpGenerated: "",
    expiresAt: 0,
    resendAt: 0,
  });

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputsRef = useRef([]);

  // ticking clock for countdown UI
  const [now, setNow] = useState(Date.now());
  const remain = useMemo(() => secsLeft(otpUI.expiresAt - now), [otpUI.expiresAt, now]);
  const resendRemain = useMemo(() => secsLeft(otpUI.resendAt - now), [otpUI.resendAt, now]);

  useEffect(() => {
    if (!otpUI.show) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [otpUI.show]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setInputs((prev) => ({ ...prev, [id]: value }));

    let error = "";
    if (id === "firstName" || id === "lastName") error = validateName(value);
    if (id === "role" || id === "department") error = validateDropdown(value);
    if (id === "email") error = validateEmail(value);
    if (id === "password") error = validatePassword(value);
    setErrors((prev) => ({ ...prev, [id]: error }));

    if (id === "email") {
      const suggestedRole = getRoleByEmail(value);
      if (suggestedRole === "student") {
        setInputs((prev) => ({ ...prev, role: "student" }));
        setRoleLocked(true);
      } else {
        setRoleLocked(false);
        if (inputs.role === "student") setInputs((prev) => ({ ...prev, role: "" }));
      }
    }
  };

  const handleBlur = (e) => {
    const { id, value } = e.target;
    let error = "";
    if (id === "firstName" || id === "lastName") error = validateName(value);
    if (id === "role" || id === "department") error = validateDropdown(value);
    if (id === "email") error = validateEmail(value);
    if (id === "password") error = validatePassword(value);
    setErrors((prev) => ({ ...prev, [id]: error }));
  };

  async function sendOtpEmail(targetEmail) {
    const otp = genOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    const resendAt = Date.now() + 30 * 1000;      // 30 seconds

    // ⬇️ عرض الوقت بدون ثواني
    const expiryTimeText = new Date(expiresAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      // hour12: false, // فعّليه لو تبين 24 ساعة دائمًا
    });

    setOtpUI((p) => ({ ...p, sending: true }));
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { email: targetEmail, passcode: otp, time: expiryTimeText, app: APP_NAME },
        { publicKey: EMAILJS_PUBLIC_KEY }
      );

      setOtpDigits(["", "", "", "", "", ""]);
      setOtpUI({ show: true, sending: false, verifying: false, otpGenerated: otp, expiresAt, resendAt });
      setTimeout(() => inputsRef.current?.[0]?.focus(), 50);
      return true;
    } catch (err) {
      alert(`Failed to send the verification code.\n${err?.text || err?.message || "Check your EmailJS keys/settings."}`);
      setOtpUI((p) => ({ ...p, sending: false }));
      return false;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const allErrors = {
      firstName: validateName(inputs.firstName),
      lastName: validateName(inputs.lastName),
      role: validateDropdown(inputs.role),
      department: validateDropdown(inputs.department),
      email: validateEmail(inputs.email),
      password: validatePassword(inputs.password),
    };
    setErrors(allErrors);
    if (!Object.values(allErrors).every((err) => !err)) {
      alert("Please fix the highlighted errors before submitting.");
      return;
    }
    await sendOtpEmail(inputs.email);
  };

  const otpCombined = otpDigits.join("");

  const verifyOtpThenSignup = async () => {
    if (!otpUI.otpGenerated) return alert("No code has been sent.");
    if (otpCombined.length !== 6) return alert("Enter a 6-digit code.");
    if (Date.now() > otpUI.expiresAt) return alert("The code has expired. Please resend.");
    if (otpCombined !== otpUI.otpGenerated) return alert("Invalid code. Please try again.");

    try {
      setOtpUI((p) => ({ ...p, verifying: true }));
      await API.post("/auth/signup", inputs);
      alert("Signed up successfully. Please sign in.");
      localStorage.setItem("prefillEmail", inputs.email);
      if (onSignedUp) onSignedUp();

      setInputs({ firstName: "", lastName: "", role: "", department: "", email: "", password: "" });
      setErrors({});
      setRoleLocked(false);
      setOtpUI({ show: false, sending: false, verifying: false, otpGenerated: "", expiresAt: 0, resendAt: 0 });
      setOtpDigits(["", "", "", "", "", ""]);
    } catch (err) {
      setOtpUI((p) => ({ ...p, verifying: false }));
      if (err?.response) {
        alert(err.response.data.message || "Server error.");
      } else {
        alert("Could not connect to backend.");
      }
    }
  };

  const resendOtp = async () => {
    if (resendRemain > 0) return;
    await sendOtpEmail(inputs.email);
  };

  // OTP input controls
  const onOtpChange = (i, val) => {
    const only = val.replace(/\D/g, "").slice(0, 1);
    const next = [...otpDigits];
    next[i] = only;
    setOtpDigits(next);
    if (only && i < 5) inputsRef.current?.[i + 1]?.focus();
  };
  const onOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otpDigits[i] && i > 0) inputsRef.current?.[i - 1]?.focus();
    if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && i > 0) { e.preventDefault(); inputsRef.current?.[i - 1]?.focus(); }
    if ((e.key === "ArrowRight" || e.key === "ArrowDown") && i < 5) { e.preventDefault(); inputsRef.current?.[i + 1]?.focus(); }
  };
  const onOtpPaste = (e) => {
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!txt) return;
    e.preventDefault();
    const arr = txt.split("");
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < arr.length; i++) next[i] = arr[i];
    setOtpDigits(next);
    const focusIdx = Math.min(arr.length, 5);
    setTimeout(() => inputsRef.current?.[focusIdx]?.focus(), 0);
  };

  return (
    <>
      <form className="p-4" onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="firstName">First Name</label>
          <input
            type="text"
            id="firstName"
            className="form-control"
            value={inputs.firstName}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {errors.firstName && <small className="text-danger">{errors.firstName}</small>}
        </div>

        <div className="mb-3">
          <label htmlFor="lastName">Last Name</label>
          <input
            type="text"
            id="lastName"
            className="form-control"
            value={inputs.lastName}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {errors.lastName && <small className="text-danger">{errors.lastName}</small>}
        </div>

        <div className="mb-3">
          <label htmlFor="role">Role</label>
          <select
            id="role"
            className="form-select"
            value={inputs.role}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={roleLocked}
          >
            <option value="">Select your role</option>
            <option value="student">Student</option>
            <option value="sc">Scheduling Committee</option>
            <option value="tlc">Teaching Load Committee</option>
            <option value="registrar">Registrar</option>
          </select>
          {errors.role && <small className="text-danger">{errors.role}</small>}
        </div>

        <div className="mb-3">
          <label htmlFor="department">Department</label>
          <DepartmentDropdown onSelect={(depId) => setInputs((prev) => ({ ...prev, department: depId }))} />
          {errors.department && <small className="text-danger">{errors.department}</small>}
        </div>

        <div className="mb-3">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            className="form-control"
            value={inputs.email}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {errors.email && <small className="text-danger">{errors.email}</small>}
        </div>

        <div className="mb-3">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            className="form-control"
            value={inputs.password}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {errors.password && <small className="text-danger">{errors.password}</small>}
        </div>

        <button type="submit" className="btn btn-primary w-100" disabled={otpUI.sending}>
          {otpUI.sending ? "Sending OTP..." : "Sign Up"}
        </button>
      </form>

      {otpUI.show && (
        <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "18px" }}>
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Verify your email</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() =>
                    setOtpUI({ show: false, sending: false, verifying: false, otpGenerated: "", expiresAt: 0, resendAt: 0 })
                  }
                ></button>
              </div>

              <div className="modal-body pt-2">
                <p className="mb-2">We sent a 6-digit code to: <b>{inputs.email}</b></p>
                <p className="text-muted small mb-3">Enter the code before it expires. You can paste all 6 digits at once.</p>

                <div className="d-flex justify-content-center gap-2" onPaste={onOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => (inputsRef.current[i] = el)}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className="form-control text-center"
                      style={{ width: "48px", height: "56px", fontSize: "24px", borderRadius: "12px", letterSpacing: "2px" }}
                      value={otpDigits[i]}
                      onChange={(e) => onOtpChange(i, e.target.value)}
                      onKeyDown={(e) => onOtpKeyDown(i, e)}
                    />
                  ))}
                </div>

                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">Expires in: {remain}s</small>
                  <button
                    type="button"
                    className="btn btn-link p-0"
                    onClick={resendOtp}
                    disabled={resendRemain > 0}
                  >
                    {resendRemain > 0 ? `Resend after ${resendRemain}s` : "Resend code"}
                  </button>
                </div>
              </div>

              <div className="modal-footer border-0 pt-0">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() =>
                    setOtpUI({ show: false, sending: false, verifying: false, otpGenerated: "", expiresAt: 0, resendAt: 0 })
                  }
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={verifyOtpThenSignup}
                  disabled={otpUI.verifying}
                >
                  {otpUI.verifying ? "Verifying..." : "Verify"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
