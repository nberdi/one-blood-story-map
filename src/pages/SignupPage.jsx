import { useState } from "react";
import PublicTopNav from "../PublicTopNav";
import { useAuth } from "../auth/AuthContext";
import {
  ALLOWED_SIGNUP_DOMAIN,
  isAllowedCommunityEmail,
} from "../auth/authConfig";
import { supabase, supabaseConfigError } from "../supabaseClient";
import { useRouter } from "../router";

export default function SignupPage() {
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

    const normalizedEmail = email.trim().toLowerCase();

    if (!isAllowedCommunityEmail(normalizedEmail)) {
      setError(
        `This project currently accepts ${ALLOWED_SIGNUP_DOMAIN} community emails only. Please use your Berea email.`,
      );
      return;
    }

    if (password.length < 8) {
      setError("Please use a password with at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    if (!supabase) {
      setError(
        supabaseConfigError ||
          "Supabase is not configured. Authentication is currently unavailable.",
      );
      setIsSubmitting(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (signUpError) {
      setError(
        signUpError.message || "Could not create account. Please try again.",
      );
      setIsSubmitting(false);
      return;
    }

    setStatus(
      "Account created. Check your Berea email to verify your account.",
    );
    setIsSubmitting(false);
    navigate(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
  };

  return (
    <div className="auth-shell">
      <PublicTopNav user={user} onLogout={handleLogout} />

      <main className="auth-main">
        <section className="auth-card">
          <h1>Sign up</h1>
          <p>
            Create your account with a Berea email. You must verify your email
            before contributing a hometown story.
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="signup-email">
              Berea Email
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={`you@${ALLOWED_SIGNUP_DOMAIN}`}
                required
              />
            </label>

            <label htmlFor="signup-password">
              Password
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
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
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <button type="button" onClick={() => navigate("/login")}>
              Log in
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
