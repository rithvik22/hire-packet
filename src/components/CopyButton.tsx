"use client";

import { useState } from "react";

type CopyButtonProps = {
  text: string;
  label: string;
  className?: string;
};

export function CopyButton({ text, label, className = "btn-ghost" }: CopyButtonProps) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1600);
    } catch {
      setDone(false);
    }
  }

  return (
    <button type="button" className={className} onClick={copy} disabled={!text}>
      {done ? "Copied" : label}
    </button>
  );
}
