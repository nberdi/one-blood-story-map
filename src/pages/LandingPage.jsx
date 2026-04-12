import PublicTopNav from "../PublicTopNav";
import { useAuth } from "../auth/AuthContext";
import { useRouter } from "../router";

export default function LandingPage() {
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();

  const handleLogout = async () => {
    await signOut();
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
          <section className="landing-feature-section landing-feature-section--explore">
            <h2>Explore</h2>
            <p>
              Browse the map to discover where people in the Berea community
              come from and learn more about the many places, stories, and
              backgrounds that shape campus life. By moving through the map,
              users can see what makes each journey unique and what brings
              people together across different cultures and experiences.
            </p>
          </section>

          <section className="landing-feature-section landing-feature-section--belong">
            <h2>Connect</h2>
            <p>
              The app is designed to foster meaningful connection by helping
              people find common ground with others on campus, whether through
              shared hometowns, countries, regions, or similar experiences. Its
              purpose is not only to connect people from similar places, but
              also to create a stronger sense of unity across the community as a
              whole.
            </p>
          </section>

          <section className="landing-feature-section landing-feature-section--contribute">
            <h2>Contribute</h2>
            <p>
              Create an account with your Berea email, verify it, and add your
              hometown pin along with a short text or audio story. By
              contributing your own background and experience, you help make the
              map a more welcoming and representative space where others can
              learn, relate, and feel connected.
            </p>
          </section>

          <section className="landing-feature-section landing-feature-section--one-blood">
            <h2>One Blood</h2>
            <p>
              Inspired by Berea&apos;s commitment to the kinship of all people,
              this app shows that the Berea community is made up of many
              different journeys, yet tied together by a shared sense of
              belonging. It encourages people to see one another more fully,
              appreciate different backgrounds, and build a campus culture
              rooted in connection, understanding, and unity.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
