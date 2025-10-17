// src/components/Documents/PaginationBar.jsx
import React from "react";
import "./pagination.css";

export default function PaginationBar({
  page,
  totalPages,
  onChange,
  size,
  onSizeChange,
  sizes = [6, 9, 12, 18],
}) {
  const go = (p) => onChange(Math.min(totalPages, Math.max(1, p)));

  return (
    <div className="pager">
      <div className="pager-left">
        <label className="pager-label">
          Per page:
          <select
            className="pager-select"
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
          >
            {sizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="pager-right">
        <button className="pager-btn" onClick={() => go(1)} disabled={page === 1}>
          « First
        </button>
        <button className="pager-btn" onClick={() => go(page - 1)} disabled={page === 1}>
          ‹ Prev
        </button>

        <span className="pager-status">
          Page {page} / {totalPages}
        </span>

        <button className="pager-btn" onClick={() => go(page + 1)} disabled={page === totalPages}>
          Next ›
        </button>
        <button className="pager-btn" onClick={() => go(totalPages)} disabled={page === totalPages}>
          Last »
        </button>
      </div>
    </div>
  );
}
