/**
 * Route guard.
 *
 * `GET /auth/me` runs on boot; while it is in flight we render a full-page
 * loader rather than guessing, because guessing means either a flash of the
 * login screen for a signed-in user or a flash of the dashboard for a
 * signed-out one. On ANY failure (401 or otherwise) we bounce to `/login`,
 * remembering where the user was headed so login can return them there.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../lib/queries";
import { AppLayout } from "../components/layout/AppLayout";
import { FullPageLoader } from "../components/ui/States";

export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return <FullPageLoader label="Restoring your session" />;
  }

  if (session.isError || !session.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <AppLayout user={session.data} />;
}
