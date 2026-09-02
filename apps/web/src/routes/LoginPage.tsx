/**
 * Login / register. One form, two modes — the fields are identical, so a second
 * page would be two screens' maintenance for one screen's worth of UI.
 *
 * Details that matter here: the submit button is disabled while in flight and
 * shows a spinner in place (no layout shift), the server error is announced via
 * `role="alert"`, autocomplete hints are correct so password managers work, and
 * an already-signed-in visitor is redirected out immediately instead of being
 * shown a form they don't need.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useLogin, useRegister, useSession } from "../lib/queries";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { FullPageLoader, Spinner } from "../components/ui/States";
import { useTheme } from "../theme/ThemeProvider";
import { cn } from "../lib/cn";

type Mode = "login" | "register";

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const { resolved, toggle } = useTheme();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useLogin();
  const register = useRegister();
  const active = mode === "login" ? login : register;

  if (session.isPending) return <FullPageLoader label="Restoring your session" />;

  if (session.data) {
    const from = (location.state as LocationState | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    active.mutate({ email, password });
  }

  function switchMode(next: Mode) {
    setMode(next);
    login.reset();
    register.reset();
  }

  const errorMessage =
    active.error instanceof ApiError
      ? active.error.message
      : active.error
        ? "Something went wrong. Please try again."
        : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-page px-4 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="enter">
          <div className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-series"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 17.5 9 11l4 4 8-9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm font-semibold tracking-tight text-ink">
                The Committee
              </span>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} theme`}
              className={cn(
                "rounded-lg border border-hairline p-2 text-ink-2",
                "transition-[transform,color] duration-150 ease-out active:scale-[0.97]",
                "[@media(hover:hover)]:hover:text-ink",
              )}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path
                  d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {mode === "login" ? "Sign in" : "Create an account"}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {mode === "login"
              ? "Sign in to see your portfolio and the committee's latest analysis."
              : "Register to start a paper-trading portfolio."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 rounded-xl border border-hairline bg-surface p-5">
            <Field
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type="password"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />

            {errorMessage ? (
              <p
                role="alert"
                className="mb-3 rounded-lg border border-hairline bg-surface-well px-3 py-2 text-xs text-[var(--status-critical)]"
              >
                {errorMessage}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={active.isPending}>
              {active.isPending ? <Spinner className="h-3.5 w-3.5" /> : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-hairline" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface px-2 text-ink-3">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={active.isPending}
              onClick={() => {
                login.mutate({ email: "analyst@committee.test", password: "Password123!" });
              }}
            >
              Explore Live Demo (1-Click)
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-ink-2">
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="font-medium text-ink underline underline-offset-2"
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
