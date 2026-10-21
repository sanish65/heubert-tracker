"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { useDialogState } from "@/context/DialogContext";

// The header's icon tile: which icon, on which pill pair.
function toneTile(kind, tone, danger) {
  if (tone === "success") return { icon: "check", className: "modal-icon-green" };
  if (tone === "error" || danger) return { icon: "alert", className: "modal-icon-red" };
  if (tone === "warning") return { icon: "alert", className: "modal-icon-amber" };
  if (kind === "prompt") return { icon: "edit", className: "" };
  return { icon: "alert", className: "" };
}
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

  const tile = toneTile(kind, tone, danger);

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} size="confirm-dialog" overlayClassName="dialog-host-overlay">
      <div className="modal-header">
        <span className={`modal-icon ${tile.className}`.trim()}>
          <Icon name={tile.icon} size={20} />
        </span>
        <h2>{title || DEFAULT_TITLE[kind]}</h2>
        <button type="button" className="modal-close" onClick={handleCancel} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>
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
      <div className="modal-actions">
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
