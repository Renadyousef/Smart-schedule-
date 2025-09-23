import { useEffect, useState } from "react";
import axios from "axios";

export default function ManageRules() {
  const [rules, setRules] = useState([]);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await axios.get("http://localhost:5000/rules/display"); // replace with your endpoint
        setRules(response.data);
      } catch (error) {
        console.error("Error fetching rules:", error);
      }
    };

    fetchRules(); // call the async function
  }, []); // empty dependency → runs once on mount

  return (
    <div className="d-flex justify-content-center mt-5">
      <div className="card" style={{ width: "50rem" }}>
        <div className="card-body d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">Manage Scheduling Rules</h5>
          <button className="btn btn-primary btn-sm">+ Add Rule</button>
        </div>

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
    <button className="btn btn-sm btn-warning">Edit</button>
    <button className="btn btn-sm btn-danger">Delete</button>
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
