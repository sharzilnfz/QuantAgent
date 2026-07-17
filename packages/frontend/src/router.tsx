import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Portfolio } from "./pages/Portfolio";
import { Watchlist } from "./pages/Watchlist";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected routes wrapped in Layout */}
      <Route element={<Layout />}>
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/watchlist" element={<Watchlist />} />
      </Route>

      <Route path="*" element={<Navigate to="/portfolio" replace />} />
    </Routes>
  );
}
