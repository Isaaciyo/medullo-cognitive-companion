"use client";

import { FormEvent, useState } from "react";
import { getApiBaseUrl, setStoredAccessToken } from "@/lib/api";

interface Props {
  onTokenSaved: () => void;
  message?: string;
}

export function AuthTokenPrompt({ onTokenSaved, message }: Props) {
  const [token, setToken] = useState("");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setStoredAccessToken(trimmed);
    setToken("");
    onTokenSaved();
  }

  return (
    <section className="mx-auto max-w-md px-6 text-center">
      <h1 className="font-welcome text-5xl text-ink-900">Hello.</h1>
      <p className="mt-6 text-base font-light leading-relaxed text-ink-700">
        Connect this browser to your Medullo memory.
      </p>
      {message && <p className="mt-2 text-sm font-light text-ink-500">{message}</p>}
      <p className="mt-3 break-all text-xs font-light text-ink-400">
        API: <code>{getApiBaseUrl()}</code>
      </p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          type="password"
          placeholder="Paste Medullo access token"
          className="rounded-full border border-white/80 bg-white/85 px-4 py-3 text-sm text-ink-800 shadow-lg shadow-mist-200/60 outline-none backdrop-blur transition focus:border-mist-300"
        />
        <button
          type="submit"
          className="rounded-full border border-white/80 bg-ink-900 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-mist-200/70 transition hover:-translate-y-0.5"
        >
          Continue
        </button>
      </form>
    </section>
  );
}
