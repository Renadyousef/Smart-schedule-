import { useEffect, useState } from "react";
import axios from "axios";
import API from "../../API_continer";

export default function ManageRules() {
  const [rules, setRules] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState({
    description: "",
    applies_to: "3",
    timeBlock: "",
    dayConstraints: "",
  });
  const [editingRule, setEditingRule] = useState(null); // <-- track editing
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  // Fetch rules on mount
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await API.get("/rules/display");
        setRules(response.data);
      } catch (error) {
        console.error("Error fetching rules:", error);
      }
    };
    fetchRules();
  }, []);

  // Validation (same as yours)...
  const validate = () => {
    const errs = {};
    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

    if (!["All", "3", "4", "5", "6", "7", "8"].includes(newRule.applies_to)) {
      errs.applies_to = "Invalid level selection";
    }

    if (!/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.test(newRule.timeBlock)) {
      errs.timeBlock = "TimeBlock must be in format HH:MM-HH:MM";
    } else {
      const [start, end] = newRule.timeBlock.split("-");
      if (start >= end) errs.timeBlock = "Start time must be before end time";
    }

    const dayRange = newRule.dayConstraints.split("-");
    if (
      dayRange.length === 1
        ? !days.includes(dayRange[0])
        : !days.includes(dayRange[0]) || !days.includes(dayRange[1])
    ) {
      errs.dayConstraints = "Day(s) must be valid day names";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Handle form submit (add or edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!validate()) return;

    try {
      if (editingRule) {
        // --- UPDATE EXISTING ---
        await API.put(`/rules/update/${editingRule.rule_id}`, newRule);

        setRules((prev) =>
          prev.map((rule) =>
            rule.rule_id === editingRule.rule_id ? { ...rule, ...newRule } : rule
          )
        );

        setMessage("Rule updated successfully!");
      } else {
        // --- ADD NEW ---
        const response = await API.post("/rules/add", newRule);
        setRules((prev) => [...prev, response.data]);
        setMessage("Rule added successfully!");
      }

      // Reset
      setNewRule({ description: "", applies_to: "3", timeBlock: "", dayConstraints: "" });
      setEditingRule(null);
      setShowForm(false);
      setErrors({});

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error saving rule:", error);
      setMessage("Failed to save rule. Try again.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setNewRule({ description: "", applies_to: "3", timeBlock: "", dayConstraints: "" });
    setEditingRule(null);
    setErrors({});
    setMessage("");
  };

  // Delete (same as yours)
  const handleDelete = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this rule?");
    if (!confirm) return;

    try {
      await API.delete(`/rules/delete/${id}`);
      setRules((prev) => prev.filter((rule) => rule.rule_id !== id));
      setMessage("Rule deleted successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error deleting rule:", error);
      setMessage("Failed to delete rule. Try again.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  // Start editing
  const handleEdit = (rule) => {
    setEditingRule(rule);
    setNewRule({
      description: rule.description,
      applies_to: rule.applies_to,
      timeBlock: rule.timeBlock,
      dayConstraints: rule.dayConstraints,
    });
    setShowForm(true);
  };

  return (
    <div className="d-flex justify-content-center mt-5">
      <div className="card w-100" style={{ maxWidth: "50rem" }}>
        <div className="card-body d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">Manage Scheduling Rules</h5>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowForm(true);
              setEditingRule(null);
              setNewRule({ description: "", applies_to: "3", timeBlock: "", dayConstraints: "" });
            }}
          >
            + Add Rule
          </button>
        </div>

        {message && <div className="alert alert-info m-3">{message}</div>}

        {showForm && (
          <form className="p-3 border-bottom" onSubmit={handleSubmit}>
            <div className="mb-2">
              <input
                type="text"
                placeholder="Description"
                className="form-control"
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                required
              />
            </div>
            <div className="mb-2">
              <select
                className="form-select"
                value={newRule.applies_to}
                onChange={(e) => setNewRule({ ...newRule, applies_to: e.target.value })}
              >
                <option value="All">All</option>
                {[3, 4, 5, 6, 7, 8].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    Level {lvl}
                  </option>
                ))}
              </select>
              {errors.applies_to && <small className="text-danger">{errors.applies_to}</small>}
            </div>
            <div className="mb-2">
              <input
                type="text"
                placeholder="TimeBlock (HH:MM-HH:MM)"
                className="form-control"
                value={newRule.timeBlock}
                onChange={(e) => setNewRule({ ...newRule, timeBlock: e.target.value })}
                required
              />
              {errors.timeBlock && <small className="text-danger">{errors.timeBlock}</small>}
            </div>
            <div className="mb-2">
              <input
                type="text"
                placeholder="DayConstraints (e.g., Monday or Monday-Wednesday)"
                className="form-control"
                value={newRule.dayConstraints}
                onChange={(e) => setNewRule({ ...newRule, dayConstraints: e.target.value })}
                required
              />
              {errors.dayConstraints && <small className="text-danger">{errors.dayConstraints}</small>}
            </div>
            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-success btn-sm">
                {editingRule ? "Save Changes" : "Add Rule"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Rules table */}
        <div className="table-responsive">
          <table className="table border-0 mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Applies To</th>
                <th>TimeBlock</th>
                <th>DayConstraints</th>
                <th>Handle</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => (
                <tr key={rule.rule_id}>
                  <th scope="row">{index + 1}</th>
                  <td>{rule.description}</td>
                  <td>{rule.applies_to}</td>
                  <td>{rule.timeBlock}</td>
                  <td>{rule.dayConstraints}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="btn btn-sm btn-warning"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(rule.rule_id)}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
