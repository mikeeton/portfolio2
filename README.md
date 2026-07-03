# Editable React Portfolio

A React portfolio inspired by clean developer portfolios, with a protected admin dashboard for updating your profile, photo, resume link, experience, projects, and certificates. Content is stored in SQLite.

## Run Locally

```bash
npm install
npm run dev
```

Open:

- Portfolio: http://localhost:5173
- Admin: http://localhost:5173/admin

Default local admin login:

- Username: `admin`
- Password: `admin123`

## Change The Admin Login

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Then set strong values:

```bash
ADMIN_USER=your-username
ADMIN_PASSWORD=your-strong-password
SESSION_SECRET=a-long-random-secret
PORT=4174
```

Restart `npm run dev` after changing `.env`.

For production, prefer a password hash:

```bash
npm run hash:password -- your-strong-password
```

Set the output as `ADMIN_PASSWORD_HASH` and do not set `ADMIN_PASSWORD` on the host.

## Uploaded Content

The app stores editable portfolio data in `server/portfolio.sqlite` and uploaded files in `server/uploads`.

Admin-only actions are protected by a server-side session cookie. Visitors can view the portfolio, but they cannot use the editing APIs unless they are logged in as the admin.

For deployment, persist both of these paths:

- `server/portfolio.sqlite`
- `server/uploads`

You can change those locations with `DATABASE_PATH` and `UPLOAD_DIR`.

Health check:

```bash
curl http://localhost:4174/api/health
```

## Production

```bash
npm run build
npm start
```

In production, the Express server serves the built React app and the API from the same port.

## Deploy

The repo includes:

- `Dockerfile` for container hosts
- `render.yaml` for Render Blueprint deployment
- `/api/health` health check

For hosts with temporary filesystems, set persistent paths:

```bash
DATA_DIR=/data
DATABASE_PATH=/data/portfolio.sqlite
UPLOAD_DIR=/data/uploads
```

On Render, the included `render.yaml` mounts a persistent disk at `/data`.
