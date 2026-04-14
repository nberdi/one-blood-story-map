import { useMemo, useState } from "react";
import PublicTopNav from "../PublicTopNav";
import { useAuth } from "../auth/AuthContext";
import { supabase, supabaseConfigError } from "../supabaseClient";
import { useRouter } from "../router";

function getSafeRedirectTarget(rawTarget) {
  if (typeof rawTarget !== "string") return "/map";
  const trimmed = rawTarget.trim();
  if (!trimmed.startsWith("/")) return "/map";
  if (trimmed.startsWith("//")) return "/map";
  return trimmed;
}

export default function LoginPage() {
  const { user, signOut } = useAuth();
  const { location, navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTarget = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return getSafeRedirectTarget(params.get("next") || "/map");
  }, [location.search]);
  const resetSuccess = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return params.get("reset") === "success";
  }, [location.search]);

  const handleLogout = async () => {
    await signOut();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setStatus("");
    setIsSubmitting(true);

    if (!supabase) {
      setError(
        supabaseConfigError ||
          "Supabase is not configured. Authentication is currently unavailable.",
      );
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      const isEmailUnverified = /confirm|verified|verification/i.test(
        signInError.message || "",
      );
      setError(
        isEmailUnverified
          ? "Please verify your email before logging in. Check your inbox for the confirmation link."
          : signInError.message || "Login failed. Please try again.",
      );
      setIsSubmitting(false);
      return;
    }

    setStatus("Login successful. Redirecting...");
    setIsSubmitting(false);
    navigate(redirectTarget, { replace: true });
  };

  return (
    <div className="auth-shell">
      <PublicTopNav user={user} onLogout={handleLogout} />

      <main className="auth-main">
        <section className="auth-card">
          <h1>Log in</h1>
          <p>
            Log in with your Berea account to contribute your hometown story.
          </p>
          {resetSuccess && (
            <p className="auth-success">
              Password reset successful. You can log in now.
            </p>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="login-email">
              Email
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@berea.edu"
                required
              />
            </label>

            <label htmlFor="login-password">
              Password
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                required
              />
            </label>

            {error && <p className="auth-error">{error}</p>}
            {status && <p className="auth-success">{status}</p>}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="auth-switch auth-switch--inline">
            Forgot your password?{" "}
            <button type="button" onClick={() => navigate("/forgot-password")}>
              Reset it
            </button>
          </p>

          <p className="auth-switch">
            Need an account?{" "}
            <button type="button" onClick={() => navigate("/signup")}>
              Create one
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
