/**
 * Route table. Exported without a Router so tests can mount it inside a
 * `MemoryRouter` at any entry point (see `tests/render.tsx`).
 */
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./routes/LoginPage";
import { PortfolioPage } from "./routes/PortfolioPage";
import { ObservatoryPage } from "./routes/ObservatoryPage";
import { RequireAuth } from "./routes/RequireAuth";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<PortfolioPage />} />
        <Route path="/observatory" element={<ObservatoryPage />} />
      </Route>
      {/* Unknown paths land on the dashboard, which re-guards them. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
