import "dotenv/config";
import compression from "compression";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import sqliteStoreFactory from "better-sqlite3-session-store";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4174);
const isProduction = process.env.NODE_ENV === "production";
const dataDir = path.resolve(rootDir, process.env.DATA_DIR || "server");
const uploadDir = path.resolve(rootDir, process.env.UPLOAD_DIR || "server/uploads");
const dbPath = path.resolve(rootDir, process.env.DATABASE_PATH || "server/portfolio.sqlite");
const legacyDataPath = path.join(__dirname, "data.json");
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const SqliteStore = sqliteStoreFactory(session);

const defaultData = {
  profile: {
    name: "Your Name",
    role: "Full Stack Developer",
    tagline: "I build accessible, fast, and thoughtful digital experiences.",
    location: "United Kingdom",
    email: "you@example.com",
    github: "https://github.com/",
    linkedin: "https://linkedin.com/",
    resumeUrl: "",
    photoUrl: "",
    about:
      "I build fast, accessible web applications with clean interfaces, practical architecture, and just enough personality to keep things human."
  },
  skills: ["React", "JavaScript", "Node.js", "Express", "SQLite", "CSS"],
  experiences: [
    {
      id: crypto.randomUUID(),
      title: "Frontend Developer",
      company: "Your Company",
      start: "2024",
      end: "Present",
      description:
        "Built responsive interfaces, improved user flows, and helped turn product ideas into usable software.",
      highlights: ["Built responsive interfaces", "Improved page performance"]
    }
  ],
  projects: [
    {
      id: crypto.randomUUID(),
      name: "Featured Project",
      description:
        "A practical project with a clear goal, a working interface, and fewer surprises than the average group assignment.",
      stack: ["React", "Node.js"],
      link: "https://example.com",
      imageUrl: "",
      completed: true
    }
  ],
  certificates: []
};

await fsp.mkdir(dataDir, { recursive: true });
await fsp.mkdir(uploadDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      tagline TEXT NOT NULL,
      location TEXT,
      email TEXT,
      github TEXT,
      linkedin TEXT,
      resume_url TEXT,
      photo_url TEXT,
      about TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS experiences (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      description TEXT,
      highlights TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      stack TEXT NOT NULL DEFAULT '[]',
      link TEXT,
      image_url TEXT,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      issuer TEXT,
      issue_date TEXT,
      file_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM profile").get().count;
  if (count > 0) return;

  let seed = defaultData;
  if (fs.existsSync(legacyDataPath)) {
    try {
      seed = { ...defaultData, ...JSON.parse(fs.readFileSync(legacyDataPath, "utf8")) };
      seed.profile = { ...defaultData.profile, ...seed.profile };
    } catch (error) {
      console.warn("Could not read legacy data.json, using defaults.", error.message);
    }
  }

  saveProfile(seed.profile, seed.skills);
  seed.experiences.forEach((item, index) => upsertExperience(item, index));
  seed.projects.forEach((item, index) => upsertProject(item, index));
  seed.certificates.forEach((item, index) => insertCertificate(item, index));
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split("\n")
      .flatMap((line) => line.split(","))
      .map(cleanText)
      .filter(Boolean);
  }
  return [];
}

function parseJsonList(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getPortfolio() {
  const profileRow = db.prepare("SELECT * FROM profile WHERE id = 1").get();
  const skills = db
    .prepare("SELECT name FROM skills ORDER BY sort_order ASC, name ASC")
    .all()
    .map((row) => row.name);
  const experiences = db
    .prepare("SELECT * FROM experiences ORDER BY sort_order ASC, created_at DESC")
    .all()
    .map((row) => ({
      id: row.id,
      title: row.title,
      company: row.company,
      start: row.start_date,
      end: row.end_date,
      description: row.description,
      highlights: parseJsonList(row.highlights)
    }));
  const projects = db
    .prepare("SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC")
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      stack: parseJsonList(row.stack),
      link: row.link,
      imageUrl: row.image_url,
      completed: Boolean(row.completed)
    }));
  const certificates = db
    .prepare("SELECT * FROM certificates ORDER BY sort_order ASC, created_at DESC")
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      issuer: row.issuer,
      date: row.issue_date,
      fileUrl: row.file_url
    }));

  return {
    profile: {
      name: profileRow.name,
      role: profileRow.role,
      tagline: profileRow.tagline,
      location: profileRow.location,
      email: profileRow.email,
      github: profileRow.github,
      linkedin: profileRow.linkedin,
      resumeUrl: profileRow.resume_url,
      photoUrl: profileRow.photo_url,
      about: profileRow.about
    },
    skills,
    experiences,
    projects,
    certificates
  };
}

function saveProfile(profile, skills) {
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO profile (
        id, name, role, tagline, location, email, github, linkedin, resume_url, photo_url, about
      ) VALUES (
        1, @name, @role, @tagline, @location, @email, @github, @linkedin, @resumeUrl, @photoUrl, @about
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        tagline = excluded.tagline,
        location = excluded.location,
        email = excluded.email,
        github = excluded.github,
        linkedin = excluded.linkedin,
        resume_url = COALESCE(excluded.resume_url, profile.resume_url),
        photo_url = COALESCE(excluded.photo_url, profile.photo_url),
        about = excluded.about
    `).run({
      name: cleanText(profile.name) || defaultData.profile.name,
      role: cleanText(profile.role) || defaultData.profile.role,
      tagline: cleanText(profile.tagline) || defaultData.profile.tagline,
      location: cleanText(profile.location),
      email: cleanText(profile.email),
      github: cleanText(profile.github),
      linkedin: cleanText(profile.linkedin),
      resumeUrl: cleanText(profile.resumeUrl || profile.resume_url) || null,
      photoUrl: profile.photoUrl ?? profile.photo_url ?? null,
      about: cleanText(profile.about) || defaultData.profile.about
    });

    if (skills) {
      db.prepare("DELETE FROM skills").run();
      const insert = db.prepare("INSERT INTO skills (name, sort_order) VALUES (?, ?)");
      normalizeList(skills).forEach((skill, index) => insert.run(skill, index));
    }
  });
  transaction();
}

function updatePhoto(url) {
  db.prepare("UPDATE profile SET photo_url = ? WHERE id = 1").run(url);
}

function updateResume(url) {
  db.prepare("UPDATE profile SET resume_url = ? WHERE id = 1").run(url);
}

function upsertExperience(item, sortOrder = 0) {
  db.prepare(`
    INSERT INTO experiences (
      id, title, company, start_date, end_date, description, highlights, sort_order
    ) VALUES (
      @id, @title, @company, @start, @end, @description, @highlights, @sortOrder
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      description = excluded.description,
      highlights = excluded.highlights,
      sort_order = excluded.sort_order
  `).run({
    id: item.id || crypto.randomUUID(),
    title: cleanText(item.title) || "Untitled Role",
    company: cleanText(item.company),
    start: cleanText(item.start),
    end: cleanText(item.end),
    description: cleanText(item.description),
    highlights: JSON.stringify(normalizeList(item.highlights)),
    sortOrder
  });
}

function upsertProject(item, sortOrder = 0) {
  db.prepare(`
    INSERT INTO projects (id, name, description, stack, link, image_url, completed, sort_order)
    VALUES (@id, @name, @description, @stack, @link, @imageUrl, @completed, @sortOrder)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      stack = excluded.stack,
      link = excluded.link,
      image_url = COALESCE(excluded.image_url, projects.image_url),
      completed = excluded.completed,
      sort_order = excluded.sort_order
  `).run({
    id: item.id || crypto.randomUUID(),
    name: cleanText(item.name) || "Untitled Project",
    description: cleanText(item.description),
    stack: JSON.stringify(normalizeList(item.stack)),
    link: cleanText(item.link),
    imageUrl: item.imageUrl ?? item.image_url ?? null,
    completed: item.completed === true || item.completed === "true" || item.completed === "on" ? 1 : 0,
    sortOrder
  });
}

function updateProjectImage(id, url) {
  db.prepare("UPDATE projects SET image_url = ? WHERE id = ?").run(url, id);
}

function reorderItems(table, ids) {
  const allowed = new Set(["experiences", "projects", "certificates"]);
  if (!allowed.has(table)) throw new Error("Invalid reorder target.");
  const update = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
  const transaction = db.transaction(() => {
    ids.forEach((id, index) => update.run(index, id));
  });
  transaction();
}

function getContactMessages() {
  return db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all();
}

function insertCertificate(item, sortOrder = 0) {
  db.prepare(`
    INSERT OR REPLACE INTO certificates (id, name, issuer, issue_date, file_url, sort_order)
    VALUES (@id, @name, @issuer, @date, @fileUrl, @sortOrder)
  `).run({
    id: item.id || crypto.randomUUID(),
    name: cleanText(item.name) || "Untitled Certificate",
    issuer: cleanText(item.issuer),
    date: cleanText(item.date || item.issue_date),
    fileUrl: cleanText(item.fileUrl || item.file_url),
    sortOrder
  });
}

migrate();
ensureColumn("projects", "completed", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("projects", "image_url", "TEXT");
seedIfEmpty();

function requireAuth(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.status(401).json({ message: "Admin login required." });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    cb(null, `${Date.now()}-${safeBase || "upload"}-${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf"
    ]);
    if (allowed.has(file.mimetype)) return cb(null, true);
    return cb(new Error("Only images and PDF files are allowed."));
  }
});

const app = express();

app.set("trust proxy", 1);
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: "1mb" }));
if (!isProduction) {
  app.use(cors({ origin: allowedOrigin, credentials: true }));
}
app.use(
  session({
    name: "portfolio.sid",
    store: new SqliteStore({
      client: db,
      expired: { clear: true, intervalMs: 15 * 60 * 1000 }
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);
app.use("/uploads", express.static(uploadDir, { maxAge: isProduction ? "7d" : 0 }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storage: "sqlite" });
});

app.get("/api/portfolio", (_req, res, next) => {
  try {
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: Boolean(req.session?.isAdmin) });
});

app.post("/api/login", async (req, res) => {
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || "";
  const username = cleanText(req.body?.username);
  const password = String(req.body?.password || "");

  const passwordMatches = adminPasswordHash
    ? await bcrypt.compare(password, adminPasswordHash)
    : password === adminPassword;

  if (username === adminUser && passwordMatches) {
    req.session.isAdmin = true;
    return res.json({ authenticated: true });
  }

  return res.status(401).json({ message: "Incorrect username or password." });
});

app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ authenticated: false }));
});

app.put("/api/profile", requireAuth, (req, res, next) => {
  try {
    const current = getPortfolio();
    saveProfile({ ...current.profile, ...req.body }, req.body.skills);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/profile/photo", requireAuth, upload.single("photo"), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded." });
    updatePhoto(`/uploads/${req.file.filename}`);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/profile/resume", requireAuth, upload.single("resume"), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No resume uploaded." });
    updateResume(`/uploads/${req.file.filename}`);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/experiences", requireAuth, (req, res, next) => {
  try {
    upsertExperience(req.body, 0);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/experiences/reorder", requireAuth, (req, res, next) => {
  try {
    reorderItems("experiences", Array.isArray(req.body.ids) ? req.body.ids : []);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/experiences/:id", requireAuth, (req, res, next) => {
  try {
    db.prepare("DELETE FROM experiences WHERE id = ?").run(req.params.id);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects", requireAuth, (req, res, next) => {
  try {
    upsertProject(req.body, 0);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/reorder", requireAuth, (req, res, next) => {
  try {
    reorderItems("projects", Array.isArray(req.body.ids) ? req.body.ids : []);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/projects/:id/image", requireAuth, upload.single("image"), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded." });
    updateProjectImage(req.params.id, `/uploads/${req.file.filename}`);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/projects/:id", requireAuth, (req, res, next) => {
  try {
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/certificates", requireAuth, upload.single("file"), (req, res, next) => {
  try {
    insertCertificate({
      id: req.body.id,
      name: req.body.name,
      issuer: req.body.issuer,
      date: req.body.date,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : ""
    });
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/certificates/reorder", requireAuth, (req, res, next) => {
  try {
    reorderItems("certificates", Array.isArray(req.body.ids) ? req.body.ids : []);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/certificates/:id", requireAuth, (req, res, next) => {
  try {
    db.prepare("DELETE FROM certificates WHERE id = ?").run(req.params.id);
    res.json(getPortfolio());
  } catch (error) {
    next(error);
  }
});

app.post("/api/contact", (req, res, next) => {
  try {
    const name = cleanText(req.body.name);
    const email = cleanText(req.body.email);
    const message = cleanText(req.body.message);

    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email, and message are required." });
    }

    db.prepare(`
      INSERT INTO contact_messages (id, name, email, message)
      VALUES (?, ?, ?, ?)
    `).run(crypto.randomUUID(), name, email, message);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/contact", requireAuth, (_req, res, next) => {
  try {
    res.json({ messages: getContactMessages() });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/contact/:id", requireAuth, (req, res, next) => {
  try {
    db.prepare("DELETE FROM contact_messages WHERE id = ?").run(req.params.id);
    res.json({ messages: getContactMessages() });
  } catch (error) {
    next(error);
  }
});

if (isProduction) {
  app.use(express.static(path.join(rootDir, "dist"), { maxAge: "1h" }));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(rootDir, "dist", "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  const message = error.message || "Something went wrong.";
  res.status(error.status || 500).json({ message });
});

app.listen(port, () => {
  console.log(`Portfolio app running on http://localhost:${port}`);
  console.log(`Database: ${dbPath}`);
});
