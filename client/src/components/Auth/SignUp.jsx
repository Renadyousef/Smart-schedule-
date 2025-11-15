import { useEffect, useMemo, useState, useRef } from "react";
import { validateEmail, validatePassword, validateName, validateDropdown, getRoleByEmail } from "./validations";
import emailjs from "@emailjs/browser";
import DepartmentDropdown from "./Departments";
import API from "../../API_continer";

const EMAILJS_PUBLIC_KEY = "x5WDJxfErFk5PA4Pj";
const EMAILJS_SERVICE_ID = "service_rnr7lbk";
const EMAILJS_TEMPLATE_ID = "template_1cnpeyg";
const APP_NAME = "SmartSchedule";

function genOTP() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}
function secsLeft(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function SignUp() {
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
    otpGenerated: "",
    verifying: false,
    expiresAt: 0,
    resendAt: 0,
  });
  const [popup, setPopup] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputsRef = useRef([]);
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

  async function precheckEmailExists(email) {
    try {
      const res = await API.post("/auth/check-email", { email });
      return !!res?.data?.exists;
    } catch {
      return false;
    }
  }

  async function sendOtpEmail(targetEmail) {
    const otp = genOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const resendAt = Date.now() + 30 * 1000;
    const expiryTimeText = new Date(expiresAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { email: targetEmail, passcode: otp, time: expiryTimeText, app: APP_NAME },
        { publicKey: EMAILJS_PUBLIC_KEY }
      );
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpUI({ show: true, otpGenerated: otp, verifying: false, expiresAt, resendAt });
      setTimeout(() => inputsRef.current?.[0]?.focus(), 50);
    } catch (err) {
      alert(`Failed to send the code.\n${err?.message || "Check your EmailJS setup."}`);
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

    const exists = await precheckEmailExists(inputs.email);
    if (exists) {
      setPopup(true);
      return;
    }

    await sendOtpEmail(inputs.email);
  };

  const otpCombined = otpDigits.join("");

  const verifyOtpThenSignup = async () => {
    if (!otpUI.otpGenerated) return alert("No code has been sent.");
    if (otpCombined.length !== 6) return alert("Enter a 6-digit code.");
    if (Date.now() > otpUI.expiresAt) return alert("The code has expired.");
    if (otpCombined !== otpUI.otpGenerated) return alert("Invalid code.");

    try {
      setOtpUI((p) => ({ ...p, verifying: true }));
      await API.post("/auth/signup", inputs);
      setOtpUI({ show: false, otpGenerated: "", verifying: false, expiresAt: 0, resendAt: 0 });
      setSuccessModal(true);
    } catch (err) {
      setOtpUI((p) => ({ ...p, verifying: false }));
      alert(err?.response?.data?.message || "Server error.");
    }
  };

  const resendOtp = async () => {
    if (resendRemain > 0) return;
    await sendOtpEmail(inputs.email);
  };

  const onOtpChange = (i, val) => {
    const only = val.replace(/\D/g, "").slice(0, 1);
    const next = [...otpDigits];
    next[i] = only;
    setOtpDigits(next);
    if (only && i < 5) inputsRef.current?.[i + 1]?.focus();
  };
  const onOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otpDigits[i] && i > 0) inputsRef.current?.[i - 1]?.focus();
  };
  const onOtpPaste = (e) => {
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!txt) return;
    e.preventDefault();
    setOtpDigits(txt.split(""));
  };

  return (
    <>
      {/* === Sign Up Form === */}
      <form className="p-4" onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="firstName">First Name</label>
          <input type="text" id="firstName" className="form-control" value={inputs.firstName} onChange={handleChange} onBlur={handleBlur} />
          {errors.firstName && <small className="text-danger">{errors.firstName}</small>}
        </div>

        <div className="mb-3">
          <label htmlFor="lastName">Last Name</label>
          <input type="text" id="lastName" className="form-control" value={inputs.lastName} onChange={handleChange} onBlur={handleBlur} />
          {errors.lastName && <small className="text-danger">{errors.lastName}</small>}
        </div>

        <div className="mb-3">
          <label htmlFor="role">Role</label>
          <select id="role" className="form-select" value={inputs.role} onChange={handleChange} disabled={roleLocked}>
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
          <input type="email" id="email" className="form-control" value={inputs.email} onChange={handleChange} onBlur={handleBlur} />
          {errors.email && <small className="text-danger">{errors.email}</small>}
        </div>

        <div className="mb-3">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" className="form-control" value={inputs.password} onChange={handleChange} onBlur={handleBlur} />
          {errors.password && <small className="text-danger">{errors.password}</small>}
        </div>

        <button type="submit" className="btn btn-primary w-100">Sign Up</button>
      </form>

      {/* === Popup Email Exists === */}
      {popup && (
        <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-center p-4">
              <h5 className="fw-bold text-danger mb-2">Email Already Exists</h5>
              <p className="text-muted mb-3">Please use a different email or sign in if you already have an account.</p>
              <button className="btn btn-secondary" onClick={() => setPopup(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* === OTP Modal (Centered & Styled) === */}
      {otpUI.show && (
        <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg text-center p-4" style={{ borderRadius: "18px" }}>
              <div className="modal-header border-0 justify-content-center">
                <h4 className="fw-bold mb-0">Verify Your Email</h4>
              </div>

              <div className="modal-body">
                <p className="text-muted mb-3">
                  We sent a 6-digit verification code to<br />
                  <b>{inputs.email}</b>
                </p>

                <div className="d-flex justify-content-center gap-2 my-3" onPaste={onOtpPaste}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => (inputsRef.current[i] = el)}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      className="form-control text-center"
                      style={{
                        width: "52px",
                        height: "58px",
                        fontSize: "24px",
                        borderRadius: "12px",
                        letterSpacing: "2px",
                      }}
                      value={otpDigits[i]}
                      onChange={(e) => onOtpChange(i, e.target.value)}
                      onKeyDown={(e) => onOtpKeyDown(i, e)}
                    />
                  ))}
                </div>

                <p className="small text-muted mt-3 mb-2">
                  Expires in: {remain}s
                </p>
                <button
                  type="button"
                  className="btn btn-link p-0 small"
                  onClick={resendOtp}
                  disabled={resendRemain > 0}
                >
                  {resendRemain > 0 ? `Resend after ${resendRemain}s` : "Resend Code"}
                </button>
              </div>

              <div className="modal-footer border-0 justify-content-center gap-3">
                <button className="btn btn-outline-secondary px-4" onClick={() => setOtpUI({ show: false })}>
                  Cancel
                </button>
                <button className="btn btn-primary px-4" onClick={verifyOtpThenSignup}>
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Success Modal === */}
      {successModal && (
        <div className="modal fade show" style={{ display: "block", background: "rgba(0,0,0,.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-center p-4 border-0 shadow-lg" style={{ borderRadius: "16px" }}>
              <h4 className="fw-bold text-success mb-3"> Account Created Successfully!</h4>
              <p className="text-muted mb-4">You can now sign in using your new account.</p>
              <button className="btn btn-primary w-50 mx-auto" onClick={() => setSuccessModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
