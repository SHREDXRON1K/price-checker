"use client";

import { useEffect } from "react";

type Props = { message: string; onClose: () => void };

export default function Toast({ message, onClose }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  const isError =
    message.toLowerCase().includes("fail") ||
    message.toLowerCase().includes("error") ||
    message.toLowerCase().includes("invalid");
  return (
    <div className={`toast ${isError ? "toast-error" : ""}`}>
      <span>{message}</span>
      <button onClick={onClose} className="toast-close">✕</button>
    </div>
  );
}
