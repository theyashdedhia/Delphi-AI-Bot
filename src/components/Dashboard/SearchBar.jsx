import React, { useEffect, useMemo, useState } from "react";
import "./SearchBar.css";

export default function SearchBar({ onSearch, suggestions = [] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const debouncedQ = useMemo(() => q, [q]);
  useEffect(() => {
    const id = setTimeout(() => onSearch?.(debouncedQ), 300);
    return () => clearTimeout(id);
  }, [debouncedQ, onSearch]);

  const filtered = q
    ? suggestions.filter(s => s.label.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : [];

  const choose = (item) => {
    setQ(item.label);
    setOpen(false);
    onSearch?.(item.label);
  };

  return (
    <div className="searchbar" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search documents, chats, or keywords…"
        aria-label="Global search"
      />
      <button className="search-btn" onClick={() => onSearch?.(q)}>Search</button>

      {open && filtered.length > 0 && (
        <div className="search-suggest">
          {filtered.map(item => (
            <div key={item.id} className="suggest-item" onMouseDown={() => choose(item)}>
              <span className="t">{item.label}</span>
              <span className="k">{item.kind}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
