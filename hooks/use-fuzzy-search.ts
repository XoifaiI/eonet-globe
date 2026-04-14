import { useMemo, useState, useEffect } from "react";
import uFuzzy from "@leeoniya/ufuzzy";
import type { EONETEvent } from "@/types";
import { SEARCH_DEBOUNCE_MS, MIN_SEARCH_QUERY_LENGTH } from "@/lib/constants";

const uf = new uFuzzy({ intraMode: 1, intraIns: 1 });

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return value.length < MIN_SEARCH_QUERY_LENGTH ? value : debounced;
}

export function useFuzzySearch(
  events: EONETEvent[],
  query: string,
  categoryFilter: string | null,
) {
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const categoryFiltered = useMemo(() => {
    if (!categoryFilter) return events;
    return events.filter((e) => e.categories[0]?.title === categoryFilter);
  }, [events, categoryFilter]);

  const haystack = useMemo(
    () => categoryFiltered.map((e) => e.title),
    [categoryFiltered],
  );

  return useMemo(() => {
    const needle = debouncedQuery.trim();
    if (!needle) return categoryFiltered;

    const [idxs, info, order] = uf.search(haystack, needle);
    if (!idxs) return [];

    if (order && order.length > 0 && info) {
      return order.map((oi) => categoryFiltered[idxs[oi]]);
    }

    return idxs.map((idx) => categoryFiltered[idx]);
  }, [categoryFiltered, haystack, debouncedQuery]);
}
