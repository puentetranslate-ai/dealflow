# DealFlow

Transaction management PWA for solo real estate agents.
Built with React + Vite, Tailwind CSS, Supabase, and React Router.

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full contents of `supabase/schema.sql`
3. *(Optional)* In **Authentication → Providers**, disable email confirmation for faster local testing

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase project URL and anon key (found in **Project Settings → API**):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:5173`

---

## PWA Icons

The app references `/icons/icon-192.png` and `/icons/icon-512.png` for the PWA install icon.
Create a `public/icons/` folder and add your logo at those sizes.

Quick way using ImageMagick:

```bash
mkdir -p public/icons
# Create a 512×512 PNG from your SVG logo, then resize:
convert logo.svg -resize 512x512 public/icons/icon-512.png
convert public/icons/icon-512.png -resize 192x192 public/icons/icon-192.png
```

Or use any image editor. The app works fine without them; the icons only affect the PWA install prompt.

---

## Build & Deploy

### Build

```bash
npm run build
```

Output is in `dist/`.

### Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo at [vercel.com](https://vercel.com)
3. Add your two environment variables in the Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Vite

### Deploy to Netlify

Same process. Build command: `npm run build`. Publish directory: `dist`.
Add a `_redirects` file in `public/`:

```
/* /index.html 200
```

---

## Project Structure

```
src/
├── App.jsx                  # Router + AuthProvider
├── main.jsx
├── index.css                # Tailwind + custom component classes
├── context/
│   └── AuthContext.jsx      # Auth state, signIn/signUp/signOut helpers
├── lib/
│   ├── supabase.js          # Supabase client (initialized once)
│   ├── constants.js         # Phases, colors, default checklist items
│   └── utils.js             # formatCurrency, formatDate, daysUntil, etc.
├── components/
│   ├── BottomNav.jsx        # Fixed bottom navigation (4 tabs)
│   ├── DealCard.jsx         # Dashboard deal card
│   ├── PhaseBadge.jsx       # Colored phase pill
│   ├── StatCard.jsx         # Dashboard stat card
│   ├── LoadingSpinner.jsx
│   └── ProtectedRoute.jsx
└── pages/
    ├── auth/
    │   ├── Login.jsx
    │   ├── SignUp.jsx
    │   └── ForgotPassword.jsx
    ├── Dashboard.jsx         # Home screen
    ├── DealForm.jsx          # New deal + edit deal (same form)
    ├── DealDetail.jsx        # Overview / Checklist / Log tabs
    ├── ClientDirectory.jsx   # All clients derived from deals
    ├── CommissionTracker.jsx # Financial summary
    └── Settings.jsx          # Profile, password, preferences
```

---

## Database Schema

See `supabase/schema.sql` for the full schema including:
- `profiles` — per-user settings (name, default commission %, notifications)
- `deals` — transaction records with RLS
- `checklist_items` — per-deal checklist with optional due dates
- `comm_logs` — append-only communication log per deal

All tables have **Row Level Security** enabled — users only see their own data.

A Postgres trigger auto-creates a `profiles` row when a new user signs up.

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `navy` | `#0c1e35` | Primary / headers / text |
| `gold` | `#c9a84c` | Accent / CTAs / active states |
| `cream` | `#f7f3ec` | App background |
| `muted` | `#8a9ab5` | Secondary text |

---

## Tech Stack

- **React 18** + **Vite 5**
- **Tailwind CSS 3** — utility-first styling
- **Supabase JS v2** — auth + database
- **React Router v6** — client-side routing
- **date-fns** — date formatting and math
- **vite-plugin-pwa** — service worker + web manifest
