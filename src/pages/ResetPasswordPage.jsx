import { useEffect, useMemo, useState } from "react";
import PublicTopNav from "../PublicTopNav";
import { useAuth } from "../auth/AuthContext";
import { supabase, supabaseConfigError } from "../supabaseClient";
import { useRouter } from "../router";

function hasRecoveryHash() {
  const hash = window.location.hash || "";
  const params = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash,
  );
  return params.get("type") === "recovery";
}

export default function ResetPasswordPage() {
  const { user, signOut } = useAuth();
  const { location, navigate } = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canUseRecoveryFlow = useMemo(() => {
    if (user) return true;
    return hasRecoveryHash();
  }, [user, location.pathname]);

  useEffect(() => {
    if (canUseRecoveryFlow) return;
    setError(
      "Recovery link is missing or expired. Please request a new reset email.",
    );
  }, [canUseRecoveryFlow]);

  const handleLogout = async () => {
    await signOut();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setStatus("");

    if (!supabase) {
      setError(
        supabaseConfigError ||
          "Supabase is not configured. Authentication is currently unavailable.",
      );
      return;
    }

    if (!canUseRecoveryFlow) {
      setError(
        "Recovery link is missing or expired. Please request a new reset email.",
      );
      return;
    }

    if (password.length < 8) {
      setError("Please use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(
        updateError.message ||
          "Could not reset password. Please request a new reset email.",
      );
      setIsSubmitting(false);
      return;
    }

    setStatus("Password updated successfully. Redirecting to login...");
    setIsSubmitting(false);

    await supabase.auth.signOut();
    window.setTimeout(() => {
      navigate("/login?reset=success", { replace: true });
    }, 800);
  };

  return (
    <div className="auth-shell">
      <PublicTopNav user={user} onLogout={handleLogout} />

      <main className="auth-main">
        <section className="auth-card">
          <h1>Reset password</h1>
          <p>Set a new password for your Berea community account.</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="new-password">
              New Password
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>

            <label htmlFor="confirm-password">
              Confirm New Password
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Type password again"
                minLength={8}
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
              {isSubmitting ? "Updating password..." : "Update password"}
            </button>
          </form>

          <p className="auth-switch">
            Need a new recovery email?{" "}
            <button type="button" onClick={() => navigate("/forgot-password")}>
              Request another link
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
