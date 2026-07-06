# Editable Portfolio

React portfolio with a private admin dashboard for editing profile content, skills, experience, projects, certificates, uploaded resume, screenshots, and contact messages.

## Features

- Public portfolio page
- Admin login
- Editable profile and skills
- Resume upload
- Profile photo upload
- Experience, projects, and certificates
- Edit, delete, and reorder admin items
- Project completion status
- Project screenshots
- Project preview and visit buttons
- Contact form with admin inbox
- SQLite database
- Persistent uploads
- Render Blueprint and Docker deployment support

## Local Development

```bash
npm install
npm run dev
```

Open:

- Portfolio: `http://localhost:5173`
- Admin: `http://localhost:5173/admin`

Default local admin login:

- Username: `guess`
- Password: keep this private and set it locally with `ADMIN_PASSWORD`.

## Environment Variables

No `.env` file is committed to the repo. Create one locally only if you need custom values.

```bash
ADMIN_USER=admin
ADMIN_PASSWORD=change-this-password
SESSION_SECRET=replace-with-a-long-random-secret
PORT=4174
DATABASE_PATH=server/portfolio.sqlite
UPLOAD_DIR=server/uploads
DATA_DIR=server
MAX_UPLOAD_MB=8
CORS_ORIGIN=http://localhost:5173
```

For production, use a password hash instead of `ADMIN_PASSWORD`:

```bash
npm run hash:password -- your-strong-password
```

Set the output as:

```bash
ADMIN_PASSWORD_HASH=the-generated-bcrypt-hash
```

Then log in with the original password, not the hash.

## Storage

Local default storage:

- Database: `server/portfolio.sqlite`
- Uploads: `server/uploads`

Production persistent storage should use:

```bash
DATA_DIR=/data
DATABASE_PATH=/data/portfolio.sqlite
UPLOAD_DIR=/data/uploads
```

## Production

```bash
npm run build
npm start
```

The Express server serves both the API and the built React app.

Health check:

```bash
curl http://localhost:4174/api/health
```

## Deploy On Render

This repo includes `render.yaml`.

1. Create a new Render Blueprint from this repository.
2. Use branch `main`.
3. Set `ADMIN_USER`.
4. Generate and set `ADMIN_PASSWORD_HASH`.
5. Deploy.

The Blueprint mounts a persistent disk at `/data`, so the SQLite database and uploaded files survive redeploys.

## Docker

```bash
docker build -t editable-portfolio .
docker run -p 4174:4174 \
  -e SESSION_SECRET=replace-me \
  -e ADMIN_USER=admin \
  -e ADMIN_PASSWORD_HASH='your-bcrypt-hash' \
  -e DATABASE_PATH=/data/portfolio.sqlite \
  -e UPLOAD_DIR=/data/uploads \
  -v portfolio-data:/data \
  editable-portfolio
```
