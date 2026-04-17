"use client";

import { useApp } from "@/context/AppContext";

export default function EmployeeList({ onEditEmployee, onAddEmployee }) {
  const { employees, removeEmployee, getEmployeeStats, isAdmin } = useApp();

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="employee-directory">
      <div className="directory-header">
        <div className="directory-title">
          <h2 className="section-title">Employee Directory</h2>
          <span className="directory-count">{employees.length} Members</span>
        </div>
        <button className="btn btn-primary btn-add-employee" onClick={onAddEmployee}>
          <span>+</span> Add Employee
        </button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Phone</th>  
              <th>ID</th>
              <th>Employee ID</th>
              <th>Joined Date</th>
              <th>Work Email</th>
              <th>Personal Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-row">No employees found</td>
              </tr>
            ) : (
              employees.map((emp) => {
                console.log("checking the ema details", emp);
                const stats = getEmployeeStats(emp.name);
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="emp-name-cell">
                        <div className="emp-avatar">{emp.name?.charAt(0)}</div>
                        <div className="emp-info">
                          <span className="emp-main-name">{emp.name}</span>
                        </div>
                      </div>
                    </td>
                    <td>{emp.phone || "N/A"}</td>
                    <td className="emp-id-cell">{emp.id || `EMP-${emp.id}`}</td>
                    <td className="emp-number-id-cell">{emp.emp_no || `EMP-${emp.id}`}</td>
                    <td>{formatDate(emp.joined_date)}</td>
                    <td className="email-cell">{emp.work_email || "N/A"}</td>
                    <td className="email-cell">{emp.personal_email || "N/A"}</td>
                    <td>
                      <span className={`status-badge ${emp.status || 'active'}`}>
                        {emp.status || 'active'}
                      </span>
                    </td>
                    <td>
                      {isAdmin && (
                        <div className="action-group">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => onEditEmployee(emp)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger-ghost"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${emp.name}?`)) {
                                removeEmployee(emp.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
