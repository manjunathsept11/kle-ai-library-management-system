import { useMemo, useState } from "react";
import { useApi } from "./useApi";
import type { Page } from "../api/types";

/** Paged list with filter params; returns data + controls. */
export function usePagedQuery<T>(
  base: string,
  filters: Record<string, string | number | boolean | undefined>,
  pageSize = 25,
) {
  const [page, setPage] = useState(1);
  const filterKey = JSON.stringify(filters);

  const path = useMemo(() => {
    const parsed = JSON.parse(filterKey) as typeof filters;
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined && v !== "" && v !== false) p.set(k, String(v));
    }
    return `${base}?${p.toString()}`;
  }, [base, page, pageSize, filterKey]);

  const query = useApi<Page<T>>(path);
  const pages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.page_size))
    : 1;

  return { ...query, page, pages, setPage };
}
