import { useSearchParams } from "react-router-dom";

export function usePage(defaultSize = 12) {
  const [params, setParams] = useSearchParams();

  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const size = Math.max(1, parseInt(params.get("size") || String(defaultSize), 10));

  const setPage = (p) => {
    const next = new URLSearchParams(params);
    next.set("page", String(Math.max(1, p)));
    setParams(next, { replace: true });
  };

  const setSize = (s) => {
    const next = new URLSearchParams(params);
    next.set("size", String(Math.max(1, s)));
    next.set("page", "1"); // reset when size changes
    setParams(next, { replace: true });
  };

  const paginate = (items) => {
    const start = (page - 1) * size;
    return items.slice(start, start + size);
  };

  const totalPagesOf = (totalItems) =>
    Math.max(1, Math.ceil(totalItems / size));

  return { page, size, setPage, setSize, paginate, totalPagesOf };
}
