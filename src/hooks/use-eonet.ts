import { useEffect } from "react";
import { useEventStore } from "@/store/event-store";
import { retryAsync } from "@/lib/retry-async";

const EONET_ENDPOINT = "/api/eonet/events";

let cached: Promise<unknown[]> | null = null;

function fetchEvents(): Promise<unknown[]> {
  if (cached) return cached;

  cached = retryAsync(
    async () => {
      const res = await fetch(EONET_ENDPOINT);
      if (!res.ok)
        throw new Error(
          "Unable to load events. NASA EONET may be temporarily unavailable.",
        );
      const data = await res.json();
      return data.events as unknown[];
    },
    {
      maxAttempts: 3,
      pauseBase: 3,
      pauseExponent: 2,
    },
  );

  cached.catch(() => {
    cached = null;
  });
  return cached;
}

export function useEONET() {
  const setEvents = useEventStore((s) => s.setEvents);
  const setLoading = useEventStore((s) => s.setLoading);
  const setError = useEventStore((s) => s.setError);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchEvents()
      .then((events) => {
        if (!cancelled)
          setEvents(
            events as ReturnType<typeof useEventStore.getState>["events"],
          );
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load events",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setEvents, setLoading, setError]);
}
