# FocusForge AI — Admin App (standalone)

Separate frontend, separate deployment, separate subdomain — for admin-only
functionality (refunds, teacher payouts, teacher verification, platform-wide
financial data). Ships as its own JS bundle so none of this ever loads in a
student/teacher/parent browser.

Talks to the **same backend** as the main app — no backend rewrite, just one
new trusted CORS origin (`ADMIN_URL`).

## Local development

```powershell
cd admin-app
npm install
copy .env.example .env
npm run dev
```

Runs on `http://localhost:5174` (main frontend stays on 5173, no port clash).

Make sure the backend has `ADMIN_URL="http://localhost:5174"` in its `.env`
and the backend server has been restarted after adding it.

## Getting admin access locally

Signup deliberately blocks self-registering as ADMIN. Promote an existing
account:

```powershell
cd backend
npm run make-admin -- your-email@example.com
```

Then log in at `http://localhost:5174/login` with that account.

## Production deployment

1. Push this repo (with `admin-app/` included) to GitHub — already done,
   it's a folder in the same monorepo, not a separate repo.
2. In Vercel: **New Project** → import the same GitHub repo again → set
   **Root Directory** to `admin-app` → framework preset **Vite**.
3. Add environment variable on that Vercel project:
   `VITE_API_URL = https://your-backend.onrender.com/api`
4. Assign a subdomain to this Vercel project, e.g. `admin.focusforge.app`
   (Vercel dashboard → Domains).
5. On the **backend** (Render), add/update env var:
   `ADMIN_URL = https://admin.focusforge.app`
   → redeploy backend so the new CORS origin takes effect.
6. Verify: visit `admin.focusforge.app/login`, log in with an ADMIN account,
   confirm all 6 tabs load real data (not just that the page renders).

## Retiring the old in-app route

Once step 6 above is verified working end-to-end, remove the admin route
from the main frontend so the admin bundle stops shipping to every visitor:

- `frontend/src/App.jsx` — delete the `/admin-dashboard` `<Route>` block
  and the `import AdminDashboard from "./pages/AdminDashboard"` line.
- `frontend/src/pages/AdminDashboard.jsx` — safe to delete once the route
  referencing it is gone (kept here until then in case rollback is needed).
- `frontend/src/context/AuthContext.jsx` and `ProtectedRoute.jsx` — no
  changes needed, other roles still use them.

## What did NOT change

- Backend routes (`/api/admin/*`) — untouched, same controllers, same auth.
- `scripts/makeAdmin.js` — still the only way to provision an admin account.
- Role-based access control — still enforced server-side regardless of
  which frontend is calling it. This app's route guard
  (`ProtectedAdminRoute`) is a UX convenience, not the security boundary.
