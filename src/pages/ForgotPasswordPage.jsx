import { useState } from "react";
import PublicTopNav from "../PublicTopNav";
import { useAuth } from "../auth/AuthContext";
import { ALLOWED_SIGNUP_DOMAIN } from "../auth/authConfig";
import { supabase, supabaseConfigError } from "../supabaseClient";
import { useRouter } from "../router";

export default function ForgotPasswordPage() {
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const normalizedEmail = email.trim().toLowerCase();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );

    if (resetError) {
      setError(
        resetError.message || "Could not send reset email. Please try again.",
      );
      setIsSubmitting(false);
      return;
    }

    setStatus(
      "If an account exists, a password reset link has been sent to your email.",
    );
    setIsSubmitting(false);
  };

  return (
    <div className="auth-shell">
      <PublicTopNav user={user} onLogout={handleLogout} />

      <main className="auth-main">
        <section className="auth-card">
          <h1>Forgot password</h1>
          <p>
            Enter your Berea email and we&apos;ll send a secure link to reset
            your password.
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="forgot-email">
              Berea Email
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={`you@${ALLOWED_SIGNUP_DOMAIN}`}
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
              {isSubmitting ? "Sending reset link..." : "Send reset link"}
            </button>
          </form>

          <p className="auth-switch">
            Remembered your password?{" "}
            <button type="button" onClick={() => navigate("/login")}>
              Back to login
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
