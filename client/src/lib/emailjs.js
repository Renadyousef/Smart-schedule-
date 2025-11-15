
import emailjs from "@emailjs/browser";

const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const APP_NAME    = import.meta.env.VITE_APP_NAME ?? "SmartSchedule";

// Init once
if (PUBLIC_KEY) {
  emailjs.init({ publicKey: PUBLIC_KEY });
}

/** Ensure env vars exist (helps during local dev). */
export function assertEmailJsConfig() {
  if (!PUBLIC_KEY || !SERVICE_ID || !TEMPLATE_ID) {
    throw new Error("EmailJS env vars are missing. Check client/.env.local");
  }
}

export {
  emailjs as default,
  SERVICE_ID,
  TEMPLATE_ID,
  APP_NAME,
};