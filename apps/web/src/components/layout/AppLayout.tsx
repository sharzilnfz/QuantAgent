/**
 * App shell: sidebar nav, header with the signed-in user + logout, content area.
 *
 * The sidebar collapses to a horizontal nav strip under `lg`, so the layout is
 * usable on a laptop-in-a-demo without a separate mobile design. The header is
 * sticky because the logout affordance should never require a scroll to reach.
 */
import { NavLink, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import type { AuthUser } from "../../lib/api";
import { useLogout } from "../../lib/queries";
import { useTheme } from "../../theme/ThemeProvider";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/States";
import { cn } from "../../lib/cn";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  /** Sprint 2+ screens are listed but disabled, so the shell reads as a plan. */
  enabled: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Portfolio", icon: <PortfolioIcon />, enabled: true },
  { to: "/observatory", label: "Observatory", icon: <ObservatoryIcon />, enabled: true },
  { to: "/lineage", label: "Lineage", icon: <DebateIcon />, enabled: true },
  { to: "/config", label: "Agent Config", icon: <ConfigIcon />, enabled: true },
  { to: "/signals", label: "Signals", icon: <SignalsIcon />, enabled: true },
];

export function AppLayout({ user }: { user: AuthUser }) {
  return (
    <div className="min-h-screen bg-page text-ink lg:flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside
      className={cn(
        "shrink-0 border-b border-hairline bg-surface",
        "lg:h-screen lg:w-56 lg:border-b-0 lg:border-r lg:sticky lg:top-0",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4 lg:px-5">
        <Mark />
        <span className="text-sm font-semibold tracking-tight">The Committee</span>
      </div>
      <nav aria-label="Primary" className="px-2 pb-3 lg:px-3">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <li key={item.to} className="shrink-0 lg:shrink">
              {item.enabled ? (
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                      "transition-colors duration-150 ease-out",
                      isActive
                        ? "bg-surface-well text-ink"
                        : "text-ink-2 [@media(hover:hover)]:hover:bg-surface-well [@media(hover:hover)]:hover:text-ink",
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ) : (
                <span
                  aria-disabled="true"
                  title="Coming in a later sprint"
                  className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-3"
                >
                  {item.icon}
                  {item.label}
                  <span className="ml-auto hidden rounded border border-hairline px-1 py-px text-[10px] uppercase tracking-wide lg:inline">
                    Soon
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function Header({ user }: { user: AuthUser }) {
  const logout = useLogout();

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.email}</p>
          <p className="text-xs text-ink-3">Paper trading</p>
        </div>
        <ThemeToggle />
        <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {logout.isPending ? <Spinner className="h-3.5 w-3.5" /> : null}
          Log out
        </Button>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        "rounded-lg border border-hairline p-2 text-ink-2",
        "transition-[transform,color,background-color] duration-150 ease-out active:scale-[0.97]",
        "[@media(hover:hover)]:hover:bg-surface-well [@media(hover:hover)]:hover:text-ink",
      )}
    >
      {resolved === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

// --- icons (inline SVG; no icon dependency) ---------------------------------

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-series" fill="none" aria-hidden="true">
      <path
        d="M3 17.5 9 11l4 4 8-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4 20V9m5 11V4m5 16v-7m5 7V7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ObservatoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m12 7 2.5 5 5 2.5-5 2.5L12 17l-2.5-5L4.5 9.5 9.5 7 12 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SignalsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M3 12h4l3-7 4 14 3-7h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DebateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M8 15H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v1M10 19h8l3 2v-7a3 3 0 0 0-3-3h-8a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConfigIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
