import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Award,
  BriefcaseBusiness,
  ExternalLink,
  FileText,
  Github,
  Globe2,
  Linkedin,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Plus,
  Save,
  Trash2,
  Upload
} from "lucide-react";
import "./styles.css";

const emptyExperience = {
  title: "",
  company: "",
  start: "",
  end: "",
  description: "",
  highlights: ""
};

const emptyProject = {
  name: "",
  description: "",
  stack: "",
  link: "",
  completed: false
};

function api(path, options = {}) {
  return fetch(path, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "Request failed");
    return payload;
  });
}

function App() {
  const [data, setData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState(window.location.pathname === "/admin" ? "admin" : "portfolio");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([api("/api/portfolio"), api("/api/session")])
      .then(([portfolio, session]) => {
        setData(portfolio);
        setIsAdmin(session.authenticated);
      })
      .catch((error) => setNotice(error.message));
  }, []);

  useEffect(() => {
    const handleMove = (event) => {
      document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
    };
    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, []);

  function refresh(nextData, message) {
    setData(nextData);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  if (!data) {
    return <div className="loading">Loading portfolio...</div>;
  }

  return (
    <>
      <TopBar
        view={view}
        setView={setView}
        isAdmin={isAdmin}
        onLogout={async () => {
          await api("/api/logout", { method: "POST" });
          setIsAdmin(false);
          setView("portfolio");
        }}
      />
      {notice && <div className="toast">{notice}</div>}
      {view === "admin" ? (
        <Admin data={data} setData={refresh} isAdmin={isAdmin} setIsAdmin={setIsAdmin} />
      ) : (
        <Portfolio data={data} />
      )}
    </>
  );
}

function TopBar({ view, setView, isAdmin, onLogout }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => setView("portfolio")}>
        Portfolio
      </button>
      <nav aria-label="Main navigation">
        <a href="#about" onClick={() => setView("portfolio")}>About</a>
        <a href="#experience" onClick={() => setView("portfolio")}>Experience</a>
        <a href="#work" onClick={() => setView("portfolio")}>Work</a>
        <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
          <Lock size={16} />
          Admin
        </button>
        {isAdmin && (
          <button onClick={onLogout} title="Log out">
            <LogOut size={16} />
          </button>
        )}
      </nav>
    </header>
  );
}

function Portfolio({ data }) {
  const { profile, experiences, projects, certificates, skills } = data;
  const [previewProject, setPreviewProject] = useState(null);
  useReveal();

  return (
    <>
      <div className="marquee-strip" aria-hidden="true">
        <div className="marquee-track">
          {[...skills, profile.role, "Portfolio", "Certificates", "Experience"].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
          {[...skills, profile.role, "Portfolio", "Certificates", "Experience"].map((item, index) => (
            <span key={`${item}-clone-${index}`}>{item}</span>
          ))}
        </div>
      </div>
      <main className="portfolio">
        <aside className="intro">
          <div>
          <p className="hero-kicker">Building Technology / Crafting Interfaces</p>
          <div className="photo">
            {profile.photoUrl ? <img src={profile.photoUrl} alt={profile.name} /> : <span>{initials(profile.name)}</span>}
          </div>
          <h1>{profile.name}</h1>
          <h2>{profile.role}</h2>
          <p className="tagline">{profile.tagline}</p>
          <div className="meta">
            {profile.location && <span><MapPin size={16} />{profile.location}</span>}
            {profile.email && <a href={`mailto:${profile.email}`}><Mail size={16} />{profile.email}</a>}
          </div>
          <div className="hero-actions">
            {profile.email && <a className="magnetic-btn" href={`mailto:${profile.email}`}><span>Hire me</span></a>}
            {profile.resumeUrl && <a className="ghost-btn" href={profile.resumeUrl} target="_blank" rel="noreferrer"><FileText size={16} /> Resume</a>}
            <a className="ghost-btn" href="#work">View work</a>
          </div>
          <div className="stat-row" aria-label="Portfolio summary">
            <span><strong>{experiences.length}</strong> Roles</span>
            <span><strong>{projects.length}</strong> Projects</span>
            <span><strong>{certificates.length}</strong> Certs</span>
          </div>
        </div>
        <div className="socials">
          {profile.github && <a href={profile.github} target="_blank" rel="noreferrer" title="GitHub"><Github /></a>}
          {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer" title="LinkedIn"><Linkedin /></a>}
          {profile.email && <a href={`mailto:${profile.email}`} title="Email"><Mail /></a>}
        </div>
      </aside>

      <section className="content">
        <section id="about" className="section" data-reveal>
          <p className="eyebrow">About</p>
          <h2 className="section-title">A portfolio that moves like a product lab.</h2>
          <p className="about-text">{profile.about}</p>
          <div className="skill-list">
            {skills.map((skill) => <span key={skill}>{skill}</span>)}
          </div>
        </section>

        <section id="experience" className="section" data-reveal>
          <p className="eyebrow">Experience</p>
          <h2 className="section-title">Where I have built, shipped, and improved things.</h2>
          <div className="timeline">
            {experiences.map((item) => (
              <article className="timeline-item" key={item.id} data-reveal>
                <div className="date">{item.start} - {item.end}</div>
                <div>
                  <h3>{item.title} <span>@ {item.company}</span></h3>
                  <p>{item.description}</p>
                  <ul>
                    {item.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="work" className="section" data-reveal>
          <p className="eyebrow">Selected Work</p>
          <h2 className="section-title">Projects with intention, polish, and clear outcomes.</h2>
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id} data-reveal>
                <div className="card-top">
                  <BriefcaseBusiness />
                  <span className={project.completed ? "status-pill complete" : "status-pill progress"}>
                    {project.completed ? "Complete" : "In progress"}
                  </span>
                </div>
                <h3>{project.name}</h3>
                <p>{project.description}</p>
                <div className="mini-tags">
                  {project.stack.map((tech) => <span key={tech}>{tech}</span>)}
                </div>
                {project.link && (
                  <div className="project-actions">
                    <button type="button" onClick={() => setPreviewProject(project)}>
                      <Globe2 size={16} />
                      Preview
                    </button>
                    <a href={project.link} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} />
                      Visit
                    </a>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="certificates" className="section" data-reveal>
          <p className="eyebrow">Certificates</p>
          <h2 className="section-title">Proof of learning, practice, and momentum.</h2>
          <div className="cert-list">
            {certificates.length === 0 && <p className="muted">Certificates you upload will appear here.</p>}
            {certificates.map((certificate) => (
              <a className="cert-row" href={certificate.fileUrl || "#"} target="_blank" rel="noreferrer" key={certificate.id}>
                <Award />
                <span>
                  <strong>{certificate.name}</strong>
                  <small>{certificate.issuer} {certificate.date && `- ${certificate.date}`}</small>
                </span>
                <ExternalLink />
              </a>
            ))}
          </div>
        </section>
      </section>
      </main>
      {previewProject && (
        <div className="preview-backdrop" role="dialog" aria-modal="true" aria-label={`${previewProject.name} preview`}>
          <div className="preview-modal">
            <div className="preview-header">
              <div>
                <small>Live preview</small>
                <strong>{previewProject.name}</strong>
              </div>
              <button type="button" onClick={() => setPreviewProject(null)}>Close</button>
            </div>
            <iframe title={`${previewProject.name} website preview`} src={previewProject.link} />
            <p>
              Some websites block embedded previews. If it does not load,
              <a href={previewProject.link} target="_blank" rel="noreferrer"> open it in a new tab</a>.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function useReveal() {
  useEffect(() => {
    const elements = [...document.querySelectorAll("[data-reveal]")];
    const revealVisibleElements = () => {
      elements.forEach((element) => {
        const box = element.getBoundingClientRect();
        if (box.top < window.innerHeight * 0.92) {
          element.classList.add("is-visible");
        }
      });
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.16 }
    );

    elements.forEach((element) => observer.observe(element));
    requestAnimationFrame(revealVisibleElements);
    const fallback = window.setTimeout(revealVisibleElements, 250);
    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);
}

function Admin({ data, setData, isAdmin, setIsAdmin }) {
  const [login, setLogin] = useState({ username: "", password: "" });
  const [profile, setProfile] = useState({ ...data.profile, skills: data.skills.join(", ") });
  const [experience, setExperience] = useState(emptyExperience);
  const [project, setProject] = useState(emptyProject);
  const [certificate, setCertificate] = useState({ name: "", issuer: "", date: "", file: null });
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setProfile({ ...data.profile, skills: data.skills.join(", ") });
  }, [data]);

  if (!isAdmin) {
    return (
      <main className="admin auth-screen">
        <form
          className="panel login-panel"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await api("/api/login", { method: "POST", body: JSON.stringify(login) });
              setIsAdmin(true);
            } catch (err) {
              setError(err.message);
            }
          }}
        >
          <Lock size={28} />
          <h1>Admin Login</h1>
          <p>Only the site owner can edit portfolio content.</p>
          <input placeholder="Username" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
          <input placeholder="Password" type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
          {error && <p className="error">{error}</p>}
          <button className="primary">Log in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <div className="admin-heading">
        <p className="eyebrow">Dashboard</p>
        <h1>Edit your portfolio</h1>
      </div>

      <section className="editor-grid">
        <form
          className="panel wide"
          onSubmit={async (event) => {
            event.preventDefault();
            const next = await api("/api/profile", { method: "PUT", body: JSON.stringify(profile) });
            setData(next, "Profile saved");
          }}
        >
          <h2>Profile</h2>
          <div className="form-grid">
            <input placeholder="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <input placeholder="Role" value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })} />
            <input placeholder="Location" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
            <input placeholder="Email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <input placeholder="GitHub URL" value={profile.github} onChange={(e) => setProfile({ ...profile, github: e.target.value })} />
            <input placeholder="LinkedIn URL" value={profile.linkedin} onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })} />
            <input placeholder="Resume URL" value={profile.resumeUrl || ""} onChange={(e) => setProfile({ ...profile, resumeUrl: e.target.value })} />
          </div>
          <input placeholder="Tagline" value={profile.tagline} onChange={(e) => setProfile({ ...profile, tagline: e.target.value })} />
          <textarea rows="5" placeholder="About" value={profile.about} onChange={(e) => setProfile({ ...profile, about: e.target.value })} />
          <textarea rows="2" placeholder="Skills learned, separated by commas. Example: React, Node.js, SQLite" value={profile.skills} onChange={(e) => setProfile({ ...profile, skills: e.target.value })} />
          <p className="field-hint">Add the skills you have learned here. They show on the public page and in the moving skills bar.</p>
          <button className="primary"><Save size={16} /> Save profile</button>
        </form>

        <form
          className="panel"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!photo) return;
            const body = new FormData();
            body.append("photo", photo);
            const next = await api("/api/profile/photo", { method: "POST", body });
            setData(next, "Photo uploaded");
            setPhoto(null);
          }}
        >
          <h2>Profile Photo</h2>
          <label className="upload-box">
            <Upload />
            <strong>{photo ? photo.name : "Choose image"}</strong>
            <small>PNG, JPG, WEBP or GIF up to 8MB</small>
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
          </label>
          <button className="primary upload-action"><Upload size={16} /> Upload photo</button>
        </form>

        <EditorPanel
          title="Experience"
          item={experience}
          setItem={setExperience}
          fields={["title", "company", "start", "end", "description", "highlights"]}
          textareaFields={["description", "highlights"]}
          onSubmit={async () => {
            const next = await api("/api/experiences", { method: "POST", body: JSON.stringify(experience) });
            setData(next, "Experience saved");
            setExperience(emptyExperience);
          }}
        />

        <ProjectEditor
          project={project}
          setProject={setProject}
          onSubmit={async () => {
            const next = await api("/api/projects", { method: "POST", body: JSON.stringify(project) });
            setData(next, "Project saved");
            setProject(emptyProject);
          }}
        />

        <form
          className="panel"
          onSubmit={async (event) => {
            event.preventDefault();
            const body = new FormData();
            body.append("name", certificate.name);
            body.append("issuer", certificate.issuer);
            body.append("date", certificate.date);
            if (certificate.file) body.append("file", certificate.file);
            const next = await api("/api/certificates", { method: "POST", body });
            setData(next, "Certificate added");
            setCertificate({ name: "", issuer: "", date: "", file: null });
          }}
        >
          <h2>Certificate</h2>
          <input placeholder="Certificate name" value={certificate.name} onChange={(e) => setCertificate({ ...certificate, name: e.target.value })} />
          <input placeholder="Issuer" value={certificate.issuer} onChange={(e) => setCertificate({ ...certificate, issuer: e.target.value })} />
          <input placeholder="Date" value={certificate.date} onChange={(e) => setCertificate({ ...certificate, date: e.target.value })} />
          <label className="upload-box">
            <Upload />
            <strong>{certificate.file ? certificate.file.name : "Upload PDF or image"}</strong>
            <small>Certificate proof, badge, or PDF</small>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setCertificate({ ...certificate, file: e.target.files[0] })} />
          </label>
          <button className="primary"><Plus size={16} /> Add certificate</button>
        </form>

        <ContentList data={data} setData={setData} />
      </section>
    </main>
  );
}

function ProjectEditor({ project, setProject, onSubmit }) {
  return (
    <form className="panel" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <h2>Project</h2>
      <input placeholder="Name" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
      <textarea rows="3" placeholder="Description" value={project.description} onChange={(e) => setProject({ ...project, description: e.target.value })} />
      <input placeholder="Skills/tech used, separated by commas" value={project.stack} onChange={(e) => setProject({ ...project, stack: e.target.value })} />
      <input placeholder="Live website URL" value={project.link} onChange={(e) => setProject({ ...project, link: e.target.value })} />
      <label className="toggle-row">
        <input type="checkbox" checked={project.completed} onChange={(e) => setProject({ ...project, completed: e.target.checked })} />
        <span>Project is complete</span>
      </label>
      <button className="primary"><Plus size={16} /> Save project</button>
    </form>
  );
}

function EditorPanel({ title, item, setItem, fields, textareaFields, onSubmit }) {
  return (
    <form className="panel" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <h2>{title}</h2>
      {fields.map((field) => {
        const placeholder = field === "highlights" || field === "stack" ? `${title} ${field} separated by commas` : field[0].toUpperCase() + field.slice(1);
        if (textareaFields.includes(field)) {
          return <textarea key={field} rows="3" placeholder={placeholder} value={item[field]} onChange={(e) => setItem({ ...item, [field]: e.target.value })} />;
        }
        return <input key={field} placeholder={placeholder} value={item[field]} onChange={(e) => setItem({ ...item, [field]: e.target.value })} />;
      })}
      <button className="primary"><Plus size={16} /> Save {title.toLowerCase()}</button>
    </form>
  );
}

function ContentList({ data, setData }) {
  const groups = useMemo(() => [
    ["Experiences", data.experiences, "/api/experiences"],
    ["Projects", data.projects, "/api/projects"],
    ["Certificates", data.certificates, "/api/certificates"]
  ], [data]);

  return (
    <section className="panel wide">
      <h2>Published Items</h2>
      <div className="manage-list">
        {groups.map(([label, items, endpoint]) => (
          <div key={label}>
            <h3>{label}</h3>
            {items.map((item) => (
              <div className="manage-row" key={item.id}>
                <span>{item.title || item.name}</span>
                <button
                  type="button"
                  title="Delete"
                  onClick={async () => {
                    const next = await api(`${endpoint}/${item.id}`, { method: "DELETE" });
                    setData(next, "Item deleted");
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

createRoot(document.getElementById("root")).render(<App />);
