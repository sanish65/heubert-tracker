import { useCallback, useRef, useState } from "react";

// One save at a time. A second click or tap while the first save is still on its way does
// nothing, so a slow network can't turn a double-click into two records. The ref stops the
// second click at once; `busy` is for the button ("Saving…", disabled).
export function useSubmitOnce() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const submitOnce = useCallback(async (save) => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    try {
      return await save();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, submitOnce];
}
