# CodeGraph Deployment Guide

CodeGraph is engineered to be deployed in multiple production environments depending on your infrastructure preferences:

---

## Architecture Overview

CodeGraph consists of:
1. **React / TypeScript Client**: High-performance UI built with Vite, styled with custom editorial CSS.
2. **Node.js / Express Backend**: API router and orchestration service that executes native language tracers (Python, GCC/G++ for C/C++) and provides the fallback DryRun simulation engine.

When compiled (`npm run build`), the Express server automatically serves the frontend static bundle from `client/dist` and handles API requests on `/api/*`—allowing the entire application to run as a single, self-contained service on a single port.

---

## Deployment Options

### Option 1: 1-Click Docker Deploy (Recommended: Render, Railway, Fly.io)

Using the included multi-stage `Dockerfile`, all native compilers (Python 3, GCC, G++, OpenJDK) are automatically provisioned.

#### A. Railway
1. Push this repository to GitHub.
2. Create a new project in [Railway.app](https://railway.app).
3. Select **Deploy from GitHub repo**.
4. Railway will automatically detect `railway.json` and `Dockerfile` and deploy the service.

#### B. Render
1. Go to [Render.com](https://render.com).
2. Click **New +** > **Blueprint**.
3. Connect your repository. Render will automatically read `render.yaml`.
4. Click **Apply**.

#### C. Fly.io
```bash
fly launch
fly deploy
```

---

### Option 2: Fullstack Node.js Host (Heroku, Render Web Service, VPS)

If your host has Node 18+ and Python installed:

1. **Build command**:
   ```bash
   npm run build
   ```
2. **Start command**:
   ```bash
   npm start
   ```
3. **Environment variables**:
   ```env
   NODE_ENV=production
   PORT=5000
   ```

---

### Option 3: Split Deployment (Frontend on Vercel/Netlify, Backend on Render/Railway)

#### 1. Backend (Render / Railway)
- Deploy `server/` with `npm start`.
- Copy your backend URL (e.g. `https://codegraph-api.onrender.com`).

#### 2. Frontend (Vercel)
- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variable:
  ```env
  VITE_API_URL=https://codegraph-api.onrender.com
  ```

---

### Option 4: Local or VPS Production Server (Docker or PM2)

#### Run with Docker locally:
```bash
docker build -t codegraph .
docker run -p 5000:5000 codegraph
```
Then visit `http://localhost:5000`.

#### Run with PM2:
```bash
npm run build
pm2 start server/server.js --name codegraph
```

---

## Verifying Deployment

Once deployed, you can verify your service health at:
```
GET /api/health
```
Response:
```json
{
  "status": "ok",
  "time": "2026-10-23T13:30:00.000Z",
  "supportedLanguages": ["python", "c", "cpp", "java", "javascript"]
}
```
