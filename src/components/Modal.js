"use client";

import { AnimatePresence } from "motion/react";
import { div as MotionDiv } from "motion/react-m";

/**
 * Animated modal shell.
 *
 * Keeps the existing .modal-overlay / .modal-content class names so all current
 * modal CSS still applies — motion only takes over enter/exit. The `is-motion`
 * class switches off the CSS keyframes so the two don't fight.
 *
 * AnimatePresence lives here (not in the caller), so a modal keeps its current
 * `<Modal isOpen={...}>` call site and gains an exit animation for free.
 */
export default function Modal({ isOpen, onClose, size = "", children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <MotionDiv
          className="modal-overlay is-motion"
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
  );
}
