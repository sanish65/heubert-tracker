"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { div as MotionDiv } from "motion/react-m";

// Whether there is a document to portal into never changes, so there is nothing to
// subscribe to. The server snapshot is false: the server and the hydrating render draw
// nothing, and the portal follows straight after, so the markup always matches.
const subscribeNever = () => () => {};
const hasDocument = () => typeof document !== "undefined";
const onServer = () => false;

/**
 * Renders its children into <body>, outside every page box.
 *
 * A fixed overlay inside .glass / .glass-card (backdrop-filter), a lifted card
 * (transform) or a size container (container-type) takes that box as its containing
 * block, so the scrim would cover only that card and clip the dialog. From <body> it
 * covers the viewport. React context (AppContext, MotionConfig) and React events still
 * flow through the portal as if it were rendered in place.
 *
 * <Modal> uses it for every dialog. Dialogs that draw their own .modal-overlay are
 * wrapped in it where they sit inside such a box.
 */
export function ModalPortal({ children }) {
  const canPortal = useSyncExternalStore(subscribeNever, hasDocument, onServer);
  return canPortal ? createPortal(children, document.body) : null;
}

/**
 * Animated modal shell.
 *
 * Keeps the existing .modal-overlay / .modal-content class names so all current
 * modal CSS still applies — motion only takes over enter/exit. The `is-motion`
 * class switches off the CSS keyframes so the two don't fight.
 *
 * AnimatePresence lives here (not in the caller), so a modal keeps its current
 * `<Modal isOpen={...}>` call site and gains an exit animation for free. It sits
 * inside the portal and stays the parent of the conditional panel, so the exit
 * animation still plays.
 */
export default function Modal({ isOpen, onClose, size = "", overlayClassName = "", children }) {
  return (
    <ModalPortal>
      <AnimatePresence>
        {isOpen && (
          <MotionDiv
            className={`modal-overlay is-motion ${overlayClassName}`.trim()}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <MotionDiv
              className={`modal-content ${size}`.trim()}
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
            >
              {children}
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
