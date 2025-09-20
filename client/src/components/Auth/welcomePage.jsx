import { useEffect, useState } from "react";
import axios from "axios";

export default function WelcomePage() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchWelcome = async () => {
      const token = localStorage.getItem("token"); // get JWT from localStorage
      if (!token) {
        setMessage("No token found. Please log in.");
        return;
      }

      try {
        const res = await axios.get("http://localhost:5000/try/welcome", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessage(res.data.message);
      } catch (err) {
        console.error(err);
        setMessage(err.response?.data?.message || "Error fetching welcome message");
      }
    };

    fetchWelcome();
  }, []);

  return (
    <div className="p-4">
      <h1>{message}</h1>
    </div>
  );
}
