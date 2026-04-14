import { Suspense, lazy } from "react";
import { AuthProvider } from "./auth/AuthContext";
import { RouterProvider, useRouter } from "./router";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const FoundersPage = lazy(() => import("./pages/FoundersPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function RouterView() {
  const { location, navigate } = useRouter();
  const path = normalizePath(location.pathname);

  if (path === "/") return <LandingPage />;
  if (path === "/founders") return <FoundersPage />;
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
        <Suspense
          fallback={
            <main className="not-found-shell">
              <p>Loading...</p>
            </main>
          }
        >
          <RouterView />
        </Suspense>
      </AuthProvider>
    </RouterProvider>
  );
}
