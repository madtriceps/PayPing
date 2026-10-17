"use client";

import { useState } from "react";
import { siteContent } from "@/content/site";

export function CopyTemplateButton({ text, language }: { text: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy is unavailable in this browser. Select and copy the message instead.");
    }
  }

  return (
    <div className="template-copy-action">
      <button type="button" className="button-secondary template-copy-button" onClick={copy}>
        {copied ? siteContent.resources.copied : siteContent.resources.copy} · {language}
      </button>
      {error && <span role="status">{error}</span>}
    </div>
  );
}
