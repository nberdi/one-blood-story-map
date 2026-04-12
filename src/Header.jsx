import { AppLink } from "./router";

export default function Header({
  onAddStory,
  isAddMode,
  user,
  onLogin,
  onSignup,
  onLogout,
}) {
  return (
    <header className="app-header">
      <div>
        <p className="app-kicker">One Blood Story Map</p>
        <h1>One map. Many stories. Shared humanity.</h1>
      </div>

      <div className="app-header-actions">
        <button
          type="button"
          className={`header-add-btn ${isAddMode ? "header-add-btn--active" : ""}`}
          onClick={onAddStory}
        >
          {isAddMode ? "Profile Open" : "Profile"}
        </button>

        {user ? (
          <>
            <span className="auth-email" title={user.email || ""}>
              {user.email}
            </span>
            <button
              type="button"
              className="header-secondary-btn"
              onClick={onLogout}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="header-secondary-btn"
              onClick={onLogin}
            >
              Log in
            </button>
            <button
              type="button"
              className="header-secondary-btn"
              onClick={onSignup}
            >
              Sign up
            </button>
          </>
        )}

        <AppLink to="/" className="header-link">
          Intro
        </AppLink>
      </div>
    </header>
  );
}
