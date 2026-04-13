import PublicTopNav from "../PublicTopNav";
import { useAuth } from "../auth/AuthContext";

const TEAM_MEMBERS = [
  {
    name: "Nauryzbek Berdi",
    linkedinUrl: "https://www.linkedin.com/in/nauryzbekberdi/",
    founder: "/founder-1.png",
  },
  {
    name: "Muneeba Hussain",
    linkedinUrl: "https://www.linkedin.com/in/muneeba-hussain-29b071275/",
    founder: "/founder-2.png",
  },
  {
    name: "Tafreed Sardar",
    linkedinUrl: "https://www.linkedin.com/in/tafreed-sardar-19bab1246/",
    founder: "/founder-3.png",
  },
];

const TECH_STACK = [
  "JavaScript",
  "React",
  "Vite",
  "Leaflet",
  "Supabase",
  "PostgreSQL",
  "Canvas 2D API",
  "CSS",
  "OpenStreetMap",
];

export default function FoundersPage() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="landing-shell">
      <PublicTopNav user={user} onLogout={handleLogout} />

      <main className="founders-main">
        <section className="founders-team">
          <h2>Meet the Team</h2>
          <div className="founders-team-grid">
            {TEAM_MEMBERS.map((member) => (
              <article key={member.name} className="founders-member-card">
                <div className="founders-member-photo">
                  <img src={member.founder} alt={member.name} loading="lazy" />
                </div>
                <h3>{member.name}</h3>
                {member.linkedinUrl ? (
                  <a
                    href={member.linkedinUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="founders-linkedin-btn"
                  >
                    LinkedIn
                  </a>
                ) : (
                  <span className="founders-member-link-placeholder">
                    LinkedIn URL coming soon
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="founders-tech">
          <h2>Tech We Used</h2>
          <div className="founders-tech-list">
            {TECH_STACK.map((techName) => (
              <span key={techName} className="founders-tech-chip">
                {techName}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
