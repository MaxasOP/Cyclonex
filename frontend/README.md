# CYCLONEX frontend

## Local run

1. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.
2. Set `VITE_GOOGLE_MAPS_API_KEY` to a browser-restricted Google Maps key.
3. Run `npm install` and `npm run dev`.

## Vercel

Import the `frontend` directory as the project root. Set the same three
environment variables in Vercel Project Settings, then deploy. The Google key
must be restricted to the deployed Vercel domain and `http://localhost:*/*`.

After Vercel gives you its production URL, add it to the Render backend as:

```text
CORS_ALLOWED_ORIGINS=https://your-project.vercel.app,http://localhost:5173
```
