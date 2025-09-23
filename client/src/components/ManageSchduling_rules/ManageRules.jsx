export default function ManageRules() {
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
              <tr>
                <th scope="row">1</th>
                <td>off day</td>
                <td>Level 3</td>
                <td>24 hr</td>
                <td>Mon-sun</td>
                <td>
                  <button className="btn btn-sm btn-warning me-2">Edit</button>
                  <button className="btn btn-sm btn-danger">Delete</button>
                </td>
              </tr>
              <tr>
                <th scope="row">2</th>
                <td>lab time</td>
                <td>Level 1</td>
                <td>2 hr</td>
                <td>Mon</td>
                <td>
                  <button className="btn btn-sm btn-warning me-2">Edit</button>
                  <button className="btn btn-sm btn-danger">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
