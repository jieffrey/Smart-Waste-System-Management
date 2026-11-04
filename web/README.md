# Smart Waste Admin (web)

Admin-only web app for the Smart Waste Management System (Next.js App Router). User features live in the mobile app.

## Setup

```bash
cp .env.example .env   # set NEXT_PUBLIC_API_URL if the backend is not on http://localhost:4000
npm install
npm run dev            # http://localhost:3000
```

Only accounts with the `admin` role can sign in.
