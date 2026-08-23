# Arunafeltz Frontend

React/Vite frontend for the Arunafeltz Cloud POS.

## Local commands

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
```

Set `VITE_API_BASE_URL` to the backend URL including `/api`. Vercel production should use `https://api.arunafeltz.com/api`. The variable is embedded at build time, so redeploy after changing it.

The Vercel project root is this directory. Build command: `npm run build`. Output directory: `dist`.
