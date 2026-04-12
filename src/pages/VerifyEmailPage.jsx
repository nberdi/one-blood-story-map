import PublicTopNav from "../PublicTopNav";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "../router";

export default function VerifyEmailPage() {
  const { location, navigate } = useRouter();
  const { user, signOut } = useAuth();

  const params = new URLSearchParams(location.search || "");
  const email = params.get("email") || "";

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="auth-shell">
      <PublicTopNav user={user} onLogout={handleLogout} />

      <main className="auth-main">
        <section className="auth-card auth-card--info">
          <h1>Verify your email</h1>
          <p>
            {email
              ? `We sent a confirmation link to ${email}.`
              : "We sent a confirmation link to your email address."}
          </p>
          <p>
            Open the link in your inbox, then log in to start contributing your
            hometown story.
          </p>

          <div className="auth-info-actions">
            <button
              type="button"
              className="auth-submit-btn"
              onClick={() => navigate("/login")}
            >
              Go to Login
            </button>
            <button
              type="button"
              className="auth-secondary-btn"
              onClick={() => navigate("/map")}
            >
              Continue Browsing Map
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
