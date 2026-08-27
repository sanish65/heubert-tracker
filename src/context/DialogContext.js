"use client";

import { createContext, useCallback, useContext, useState } from "react";

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const open = useCallback((kind, message, opts = {}) => {
    return new Promise((resolve) => {
      setDialog({ kind, message, ...opts, resolve });
    });
  }, []);

  // Promise<boolean>
  const confirmDialog = useCallback((message, opts) => open("confirm", message, opts), [open]);
  // Promise<void>
  const alertDialog = useCallback((message, opts) => open("alert", message, opts), [open]);
  // Promise<string|null>
  const promptDialog = useCallback((message, opts) => open("prompt", message, opts), [open]);

  const resolveDialog = useCallback((result) => {
    setDialog((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  return (
    <DialogContext.Provider value={{ confirmDialog, alertDialog, promptDialog, dialog, resolveDialog }}>
      {children}
    </DialogContext.Provider>
  );
}

// Trigger dialogs from anywhere under DialogProvider.
export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  const { confirmDialog, alertDialog, promptDialog } = ctx;
  return { confirmDialog, alertDialog, promptDialog };
}

// Consumed by <DialogHost/> — kept separate so DialogHost can be mounted deeper in the
// tree (inside MotionProvider, so its Framer Motion `m` components get a LazyMotion
// context to animate with) while DialogProvider itself stays above AppProvider, where
// AppContext.js's own confirm/alert calls need it.
export function useDialogState() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialogState must be used within a DialogProvider");
  const { dialog, resolveDialog } = ctx;
  return { dialog, resolveDialog };
}
