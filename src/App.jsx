import { AuthProvider } from "./auth/AuthContext";
import { RouterProvider, useRouter } from "./router";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import MapPage from "./pages/MapPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SignupPage from "./pages/SignupPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function RouterView() {
  const { location, navigate } = useRouter();
  const path = normalizePath(location.pathname);

  if (path === "/") return <LandingPage />;
  if (path === "/map") return <MapPage />;
  if (path === "/login") return <LoginPage />;
  if (path === "/signup") return <SignupPage />;
  if (path === "/forgot-password") return <ForgotPasswordPage />;
  if (path === "/reset-password") return <ResetPasswordPage />;
  if (path === "/verify-email" || path === "/auth/callback")
    return <VerifyEmailPage />;

  return (
    <main className="not-found-shell">
      <h1>Page not found</h1>
      <p>This page does not exist. Head back to the story map.</p>
      <button
        type="button"
        className="landing-primary-btn"
        onClick={() => navigate("/map")}
      >
        Go to Map
      </button>
    </main>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <RouterView />
      </AuthProvider>
    </RouterProvider>
  );
}
