import { AppLink } from "./router";

export default function PublicTopNav({ user, onLogout }) {
  return (
    <header className="public-nav">
      <AppLink to="/" className="public-nav__brand">
        One Blood Story Map
      </AppLink>

      <nav className="public-nav__actions">
        <AppLink to="/" className="public-nav__link">
          Intro
        </AppLink>
        <AppLink to="/founders" className="public-nav__link">
          Founders
        </AppLink>
        <AppLink to="/map" className="public-nav__link">
          Explore Map
        </AppLink>

        {user ? (
          <>
            <span className="public-nav__user">{user.email}</span>
            <button
              type="button"
              className="public-nav__btn"
              onClick={onLogout}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <AppLink
              to="/login"
              className="public-nav__btn public-nav__btn--ghost"
            >
              Log in
            </AppLink>
            <AppLink to="/signup" className="public-nav__btn">
              Sign up
            </AppLink>
          </>
        )}
      </nav>
    </header>
  );
}
