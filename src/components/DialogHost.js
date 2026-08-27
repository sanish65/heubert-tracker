"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useDialogState } from "@/context/DialogContext";

const TONE_ICON = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
const DEFAULT_TITLE = { confirm: "Are you sure?", alert: "Notice", prompt: "Enter a value" };

export default function DialogHost() {
  const { dialog, resolveDialog } = useDialogState();
  const isOpen = !!dialog;
  const [value, setValue] = useState("");
  const inputRef = useRef(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (dialog?.kind === "prompt") setValue(dialog.defaultValue || "");
  }, [dialog]);

  useEffect(() => {
    if (!isOpen) return;
    const el = dialog.kind === "prompt" ? inputRef.current : confirmBtnRef.current;
    el?.focus();
  }, [isOpen, dialog]);

  if (!dialog) return null;

  const { kind, title, message, danger, confirmText, cancelText, tone } = dialog;

  const handleCancel = () => resolveDialog(kind === "prompt" ? null : false);
  const handleConfirm = () => resolveDialog(kind === "prompt" ? value : true);

  const icon = TONE_ICON[tone] || (danger ? "⚠️" : kind === "prompt" ? "✏️" : "❓");

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} size="confirm-dialog">
      <div className={`confirm-dialog-icon ${danger || tone === "error" ? "is-danger" : ""}`}>
        {icon}
      </div>
      <h3 className="confirm-dialog-title">{title || DEFAULT_TITLE[kind]}</h3>
      {message && <p className="confirm-dialog-message">{message}</p>}
      {kind === "prompt" && (
        <input
          ref={inputRef}
          type="text"
          className="form-input confirm-dialog-input"
          value={value}
          placeholder={dialog.placeholder || ""}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") handleCancel();
          }}
        />
      )}
      <div className="confirm-dialog-actions">
        {kind !== "alert" && (
          <button type="button" className="btn btn-secondary" onClick={handleCancel}>
            {cancelText || "Cancel"}
          </button>
        )}
        <button
          ref={confirmBtnRef}
          type="button"
          className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
          onClick={handleConfirm}
        >
          {confirmText || (kind === "alert" ? "OK" : kind === "prompt" ? "Submit" : "Confirm")}
        </button>
      </div>
    </Modal>
  );
}
