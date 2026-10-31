# Acceptance Copilot (prototype)

A copilot that turns acceptance data into a prioritised, approvable action plan, and a small pilot tests whether it works.
Synthetic data only. No real payments, accounts, BIN certification, fraud models or NPCI integration. No proven uplift is claimed.

## Run
    npm install
    npm run dev        # app (offline rules mode, no /api)
    npm test           # 12 tests
    npm run data       # regenerate data + independent Python checker

## Deploy (Vercel)
1. Import this repo in Vercel (framework: Vite is auto-detected).
2. Project Settings → Environment Variables → add `GEMINI_API_KEY` (never commit it). Optional: `GEMINI_MODEL`.
3. Redeploy. Without a key the app still works in "Offline rules mode".

## How it works
- `src/lib/stats.js`: every number is computed here.
- `src/lib/agent.js` + `api/agent.js`: Gemini calls these tools (function calling) and only explains what they return.
- Approve/Reject is human; decisions go to the audit log (browser storage).
