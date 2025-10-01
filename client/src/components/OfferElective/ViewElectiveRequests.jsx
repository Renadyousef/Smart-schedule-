import { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

export default function OfferElective() {
  const [electives, setElectives] = useState([]);
  const [selectedElectives, setSelectedElectives] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch electives from backend on component mount
  useEffect(() => {
    const fetchElectives = async () => {
      try {
        const token = localStorage.getItem("token"); // JWT from login
        const res = await axios.get("http://localhost:5000/offer/view", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Backend returns { departmentId, electives: [...] }
        setElectives(res.data.electives || []);
      } catch (err) {
        console.error("Error fetching electives:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchElectives();
  }, []);

  // Toggle elective selection
  const toggleElective = (elective) => {
    if (selectedElectives.some((e) => e.CourseID === elective.CourseID)) {
      // Remove if already selected
      setSelectedElectives(
        selectedElectives.filter((e) => e.CourseID !== elective.CourseID)
      );
    } else {
      // Add if not selected
      setSelectedElectives([...selectedElectives, elective]);
    }
  };

  // Handle offering selected electives
  const handleOffer = async () => {
    if (selectedElectives.length === 0) {
      alert("⚠️ Please select at least one elective first!");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:5000/offer/submit",
        { electives: selectedElectives },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      alert("✅ Electives offered successfully!");
      setSelectedElectives([]); // reset selection
    } catch (err) {
      console.error("Error offering electives:", err);
      alert("❌ Failed to offer electives");
    }
  };

  if (loading) {
    return <h3 className="text-center mt-5">Loading electives...</h3>;
  }

  return (
    <div className="container py-5">
      <h1 className="text-center mb-4">📚 Elective Requests</h1>

      {electives.length === 0 ? (
        <p className="text-center text-muted">No elective requests yet.</p>
      ) : (
        <div className="row g-4">
          {electives.map((elective) => {
            const isSelected = selectedElectives.some(
              (e) => e.CourseID === elective.CourseID
            );
            return (
              <div className="col-md-6 col-lg-4" key={elective.CourseID}>
                <div
                  className={`card h-100 shadow-sm ${
                    isSelected ? "border-success border-2" : ""
                  }`}
                >
                  <div className="card-body text-center">
                    <h5 className="card-title">{elective.name}</h5>
                    <p className="card-text text-muted">
                      {elective.count} students requested this elective
                    </p>
                    <button
                      className={`btn ${
                        isSelected ? "btn-success" : "btn-outline-success"
                      }`}
                      onClick={() => toggleElective(elective)}
                      disabled={loading}
                    >
                      {isSelected ? "Selected ✅" : "Select"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center mt-5">
        <button
          className="btn btn-primary btn-lg"
          onClick={handleOffer}
          disabled={selectedElectives.length === 0 || loading}
        >
          Offer {selectedElectives.length > 0 ? selectedElectives.length : ""}{" "}
          Elective(s)
        </button>
      </div>
    </div>
  );
}
