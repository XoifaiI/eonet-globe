import { useMemo, useState, useEffect, useRef } from "react"
import uFuzzy from "@leeoniya/ufuzzy"
import type { EONETEvent } from "@/types"
import { SEARCH_DEBOUNCE_MS, MIN_SEARCH_QUERY_LENGTH } from "@/lib/constants"

const uf = new uFuzzy({ intraMode: 1, intraIns: 1 })

export function useFuzzySearch(
  events: EONETEvent[],
  query: string,
  categoryFilter: string | null
) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (query.length < MIN_SEARCH_QUERY_LENGTH) {
      setDebouncedQuery(query)
      return
    }
    timerRef.current = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const categoryFiltered = useMemo(() => {
    if (!categoryFilter) return events
    return events.filter((e) => e.categories[0]?.title === categoryFilter)
  }, [events, categoryFilter])

  const haystack = useMemo(
    () => categoryFiltered.map((e) => e.title),
    [categoryFiltered]
  )

  return useMemo(() => {
    const needle = debouncedQuery.trim()
    if (!needle) return categoryFiltered

    const [idxs, info, order] = uf.search(haystack, needle)
    if (!idxs) return []

    if (order && order.length > 0 && info) {
      return order.map((oi) => categoryFiltered[idxs[oi]])
    }

    return idxs.map((idx) => categoryFiltered[idx])
  }, [categoryFiltered, haystack, debouncedQuery])
}
