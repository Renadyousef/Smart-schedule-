import { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";

export default function OfferElective() {
  const [electives, setElectives] = useState([]);
  const [selectedElectives, setSelectedElectives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchElectives = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("http://localhost:5000/offer/view", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setElectives(res.data.electives || []);
      } catch (err) {
        console.error("Error fetching electives:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchElectives();
  }, []);

  const toggleElective = (elective) => {
    if (selectedElectives.some((e) => e.CourseID === elective.CourseID)) {
      setSelectedElectives(
        selectedElectives.filter((e) => e.CourseID !== elective.CourseID)
      );
    } else {
      setSelectedElectives([
        ...selectedElectives,
        {
          ...elective,
          lectureSection: "",   // user inputs manually
          lectureDays: "",
          lectureStart: "",
          lectureEnd: "",
          tutorialSection: "",  // auto = lecture + 1
          tutorialDays: "",
          tutorialStart: "",
          tutorialEnd: "",
          labSection: "",       // auto = lecture + 2
          labIncluded: false,
          labDays: "",
          labStart: "",
          labEnd: "",
        },
      ]);
    }
  };

  const handleOffer = async () => {
    if (!selectedElectives.length) {
      alert("⚠️ Please select at least one elective!");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:5000/offer/submit",
        { electives: selectedElectives },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("✅ Electives offered successfully!");
      setSelectedElectives([]);
    } catch (err) {
      console.error("Error offering electives:", err);
      alert("❌ Failed to offer electives");//error here even tho its saved to DB 
    }
  };

  if (loading) return <h3 className="text-center mt-5">Loading electives...</h3>;

  return (
    <div className="container py-5">
      <h1 className="text-center mb-4">📚 Elective Requests</h1>
      {electives.length === 0 ? (
        <p className="text-center text-muted">No elective requests yet.</p>
      ) : (
        <div className="row g-4">
          {electives.map((elective) => {
            const sel = selectedElectives.find(
              (e) => e.CourseID === elective.CourseID
            );
            const isSelected = !!sel;

            return (
              <div className="col-md-6 col-lg-4" key={elective.CourseID}>
                <div
                  className={`card h-100 shadow-sm ${
                    isSelected ? "border-success border-2" : ""
                  }`}
                >
                  <div className="card-body">
                    <h5 className="card-title">{elective.name}</h5>
                    <p className="text-muted">
                      {elective.count} students requested this elective
                    </p>

                    <button
                      className={`btn ${isSelected ? "btn-success" : "btn-outline-success"}`}
                      onClick={() => toggleElective(elective)}
                    >
                      {isSelected ? "Selected ✅" : "Select"}
                    </button>

                    {isSelected && (
                      <div className="mt-3">
                        {/* Lecture Section */}
                        <h6>Lecture</h6>
                        <label>Section:</label>
                        <input
                          type="number"
                          className="form-control mb-1"
                          value={sel.lectureSection}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setSelectedElectives((prev) =>
                              prev.map((el) =>
                                el.CourseID === elective.CourseID
                                  ? { 
                                      ...el, 
                                      lectureSection: val,
                                      tutorialSection: val + 1,
                                      labSection: el.labIncluded ? val + 2 : "",
                                    }
                                  : el
                              )
                            );
                          }}
                        />
                        <label>Days (comma-separated, full day names):</label>
                        <input
                          type="text"
                          className="form-control mb-1"
                          value={sel.lectureDays}
                          onChange={(e) =>
                            setSelectedElectives((prev) =>
                              prev.map((el) =>
                                el.CourseID === elective.CourseID
                                  ? { ...el, lectureDays: e.target.value }
                                  : el
                              )
                            )
                          }
                        />
                        <div className="d-flex gap-2 mb-2">
                          <input
                            type="time"
                            className="form-control"
                            value={sel.lectureStart}
                            onChange={(e) =>
                              setSelectedElectives((prev) =>
                                prev.map((el) =>
                                  el.CourseID === elective.CourseID
                                    ? { ...el, lectureStart: e.target.value }
                                    : el
                                )
                              )
                            }
                          />
                          <input
                            type="time"
                            className="form-control"
                            value={sel.lectureEnd}
                            onChange={(e) =>
                              setSelectedElectives((prev) =>
                                prev.map((el) =>
                                  el.CourseID === elective.CourseID
                                    ? { ...el, lectureEnd: e.target.value }
                                    : el
                                )
                              )
                            }
                          />
                        </div>

                        {/* Tutorial */}
                        <h6>Tutorial</h6>
                        <label>Section:</label>
                        <input
                          type="number"
                          className="form-control mb-1"
                          value={sel.tutorialSection}
                          readOnly
                        />
                        <label>Days (comma-separated, full day names):</label>
                        <input
                          type="text"
                          className="form-control mb-1"
                          value={sel.tutorialDays}
                          onChange={(e) =>
                            setSelectedElectives((prev) =>
                              prev.map((el) =>
                                el.CourseID === elective.CourseID
                                  ? { ...el, tutorialDays: e.target.value }
                                  : el
                              )
                            )
                          }
                        />
                        <div className="d-flex gap-2 mb-2">
                          <input
                            type="time"
                            className="form-control"
                            value={sel.tutorialStart}
                            onChange={(e) =>
                              setSelectedElectives((prev) =>
                                prev.map((el) =>
                                  el.CourseID === elective.CourseID
                                    ? { ...el, tutorialStart: e.target.value }
                                    : el
                                )
                              )
                            }
                          />
                          <input
                            type="time"
                            className="form-control"
                            value={sel.tutorialEnd}
                            onChange={(e) =>
                              setSelectedElectives((prev) =>
                                prev.map((el) =>
                                  el.CourseID === elective.CourseID
                                    ? { ...el, tutorialEnd: e.target.value }
                                    : el
                                )
                              )
                            }
                          />
                        </div>

                        {/* Lab */}
                        <div className="form-check mb-2">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={sel.labIncluded}
                            onChange={(e) =>
                              setSelectedElectives((prev) =>
                                prev.map((el) =>
                                  el.CourseID === elective.CourseID
                                    ? { 
                                        ...el, 
                                        labIncluded: e.target.checked,
                                        labSection: e.target.checked ? el.lectureSection + 2 : "",
                                      }
                                    : el
                                )
                              )
                            }
                          />
                          <label className="form-check-label">Include Lab</label>
                        </div>

                        {sel.labIncluded && (
                          <>
                            <h6>Lab</h6>
                            <label>Section:</label>
                            <input
                              type="number"
                              className="form-control mb-1"
                              value={sel.labSection}
                              readOnly
                            />
                            <label>Days (comma-separated, full day names):</label>
                            <input
                              type="text"
                              className="form-control mb-1"
                              value={sel.labDays}
                              onChange={(e) =>
                                setSelectedElectives((prev) =>
                                  prev.map((el) =>
                                    el.CourseID === elective.CourseID
                                      ? { ...el, labDays: e.target.value }
                                      : el
                                  )
                                )
                              }
                            />
                            <div className="d-flex gap-2 mb-2">
                              <input
                                type="time"
                                className="form-control"
                                value={sel.labStart}
                                onChange={(e) =>
                                  setSelectedElectives((prev) =>
                                    prev.map((el) =>
                                      el.CourseID === elective.CourseID
                                        ? { ...el, labStart: e.target.value }
                                        : el
                                    )
                                  )
                                }
                              />
                              <input
                                type="time"
                                className="form-control"
                                value={sel.labEnd}
                                onChange={(e) =>
                                  setSelectedElectives((prev) =>
                                    prev.map((el) =>
                                      el.CourseID === elective.CourseID
                                        ? { ...el, labEnd: e.target.value }
                                        : el
                                    )
                                  )
                                }
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
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
          disabled={!selectedElectives.length || loading}
        >
          Offer {selectedElectives.length} Elective Section(s)
        </button>
      </div>
    </div>
  );
}
