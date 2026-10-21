import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

// The time now, refreshed every `ms` while the screen is in front. A tab screen stays mounted behind
// the others, so the timer stops when you leave and catches up when you come back.
export function useNow(ms) {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), ms);
      return () => clearInterval(id);
    }, [ms])
  );
  return now;
}
