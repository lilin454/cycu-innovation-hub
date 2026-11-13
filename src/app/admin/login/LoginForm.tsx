"use client";

import { useActionState, useState } from "react";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {state?.error && (
        <p role="alert" className="border-2 border-danger bg-white px-3 py-2 text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="field-label">帳號</span>
        <input name="account" className="input" defaultValue={state?.account ?? ""} autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} autoFocus />
      </label>
      <label className="block">
        <span className="field-label">密碼</span>
        <span className="flex items-stretch">
          <input
            name="password"
            type={show ? "text" : "password"}
            className="input !border-r-0"
            autoComplete="current-password"
            required
            maxLength={200}
          />
          <button
            type="button"
            className="flex-none border-[1.5px] border-[#9aa7b6] bg-paper-2 px-3 text-sm font-bold hover:border-ink"
            aria-pressed={show}
            onClick={() => setShow((v) => !v)}
          >
            {show ? "隱藏" : "顯示"}
          </button>
        </span>
      </label>
      <button type="submit" className="btn btn-ink w-full" disabled={pending}>
        {pending ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
