import { Navigate, Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { fetchApi } from "../lib/api";
import { LogOut, LineChart, List, Settings } from "lucide-react";

export function Layout() {
  const { isAuthenticated, user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const handleLogout = async () => {
    try {
      await fetchApi("/auth/logout", { method: "POST" });
    } catch (e) {
      // Ignore errors on logout
    } finally {
      clearAuth();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 text-surface-50 flex flex-col">
      <header className="border-b border-surface-800 bg-surface-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-xl font-semibold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                QuantAgent
              </span>
              <nav className="flex space-x-4">
                <Link
                  to="/portfolio"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/portfolio"
                      ? "bg-surface-800 text-white"
                      : "text-surface-300 hover:bg-surface-800 hover:text-white"
                  }`}
                >
                  <LineChart size={16} /> Portfolio
                </Link>
                <Link
                  to="/watchlist"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/watchlist"
                      ? "bg-surface-800 text-white"
                      : "text-surface-300 hover:bg-surface-800 hover:text-white"
                  }`}
                >
                  <List size={16} /> Watchlist
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-surface-400">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="p-2 text-surface-400 hover:text-white hover:bg-surface-800 rounded-md transition-colors"
                title="Log out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Outlet />
      </main>
    </div>
  );
}
