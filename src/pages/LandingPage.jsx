import PublicTopNav from "../PublicTopNav";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "../router";

const LANDING_FEATURES = [
  {
    key: "contribute",
    title: "Contribute",
    className: "landing-feature-section--contribute",
    description:
      "Create an account with your Berea email, verify it, and add your hometown pin along with a short text or audio story. By contributing your own background and experience, you help make the map a more welcoming and representative space where others can learn, relate, and feel connected.",
  },
  {
    key: "one-blood",
    title: "One Blood",
    className: "landing-feature-section--one-blood",
    description:
      "Inspired by Berea's commitment to the kinship of all people, this app shows that the Berea community is made up of many different journeys, yet tied together by a shared sense of belonging. It encourages people to see one another more fully, appreciate different backgrounds, and build a campus culture rooted in connection, understanding, and unity.",
  },
];

export default function LandingPage() {
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();
  const [openFeatureKey, setOpenFeatureKey] = useState(null);

  const handleLogout = async () => {
    await signOut();
  };

  const handleFeatureToggle = (featureKey) => {
    setOpenFeatureKey((currentKey) =>
      currentKey === featureKey ? null : featureKey,
    );
  };

  return (
    <div className="landing-shell">
      <PublicTopNav user={user} onLogout={handleLogout} />

      <main className="landing-main">
        <section className="landing-hero">
          <p className="landing-eyebrow">Berea Community Project</p>
          <h1>One Blood Story Map</h1>
          <p>
            Welcome to a shared space where members of the Berea community can
            map where they come from, tell hometown stories, and celebrate
            cultural experiences. Explore the map to see how many journeys and
            identities connect through shared humanity and belonging. Verified
            community members can contribute new stories.
          </p>

          <div className="landing-actions">
            <button
              type="button"
              className="landing-primary-btn"
              onClick={() => navigate("/map")}
            >
              Enter the Story Map
            </button>
          </div>

          <div className="landing-photo-slot">
            <img
              src="/landing-community-photo.jpg"
              alt="Berea community"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>
        </section>

        <div className="landing-side-stack">
          {LANDING_FEATURES.map((feature) => {
            const isOpen = openFeatureKey === feature.key;
            const panelId = `landing-feature-panel-${feature.key}`;

            return (
              <section
                key={feature.key}
                className={`landing-feature-section ${feature.className} ${isOpen ? "landing-feature-section--open" : ""}`}
              >
                <button
                  type="button"
                  className="landing-feature-toggle"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => handleFeatureToggle(feature.key)}
                >
                  <h2>{feature.title}</h2>
                  <span
                    className={`landing-feature-toggle__icon ${isOpen ? "landing-feature-toggle__icon--open" : ""}`}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>

                <div
                  id={panelId}
                  className={`landing-feature-content ${isOpen ? "landing-feature-content--open" : ""}`}
                >
                  <div>
                    <p>{feature.description}</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
