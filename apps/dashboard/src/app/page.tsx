import Link from "next/link";

const metrics = [
  { label: "Pending listings", value: "—", detail: "Awaiting review" },
  { label: "Upcoming events", value: "—", detail: "Next 90 days" },
  { label: "Active sellers", value: "—", detail: "Current marketplace" },
];

const sections = [
  { title: "Listings", description: "Review and approve vehicle submissions." },
  { title: "Events", description: "Plan markets and manage registrations." },
  { title: "Check-in", description: "Verify sellers and vehicles on event day." },
  { title: "Users", description: "Support buyers, sellers, and staff accounts." },
];

export default function Dashboard() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Gearboxe Internal home">
          <span className="brandMark">G</span>
          <span>
            Gearboxe
            <small>Internal</small>
          </span>
        </Link>
        <nav aria-label="Dashboard navigation">
          <a className="active" href="#overview">Overview</a>
          {sections.map((section) => (
            <a key={section.title} href={`#${section.title.toLowerCase()}`}>
              {section.title}
            </a>
          ))}
        </nav>
        <p className="environment"><span /> Development workspace</p>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Good morning.</h1>
            <p className="subtitle">Here’s what’s happening across the marketplace.</p>
          </div>
          <div className="avatar" aria-label="Internal user">IN</div>
        </header>

        <section className="metrics" id="overview" aria-label="Marketplace overview">
          {metrics.map((metric) => (
            <article key={metric.label} className="metricCard">
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.detail}</span>
            </article>
          ))}
        </section>

        <section className="workspace">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">Workspace</p>
              <h2>Internal tools</h2>
            </div>
            <span className="status">Foundation ready</span>
          </div>
          <div className="toolGrid">
            {sections.map((section, index) => (
              <article className="toolCard" id={section.title.toLowerCase()} key={section.title}>
                <span className="toolIndex">0{index + 1}</span>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
                <span className="comingSoon">Ready for integration</span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
