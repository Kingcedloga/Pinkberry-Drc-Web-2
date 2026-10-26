# Requirements: Pinkberry DRC (web app)

Context: existing repo (Kingcedloga/Pinkberry-WebApp) already contains a mature Expo (React Native + react-native-web) app at /app/frontend and a FastAPI + MongoDB backend at /app/backend. Full history in /app/memory/PRD.md. User decision: KEEP the Expo codebase and optimise it as a complete, deployable web app (custom domain). No rewrite.

## Core Value
A Kinshasa customer orders Pinkberry frozen yogurt (flavours + toppings) from a browser, pays cash or Mobile Money, and follows the order live until delivery, while the shop manages orders and menu in real time.

## Personas & Roles
- Client (particulier à Kinshasa): browse, compose order, address, pay, track.
- Livreur: assigned deliveries, GPS sharing, status updates, cash collection.
- Admin: live orders dashboard, status updates, driver assignment, menu/catalogue, zones.
- Super admin (owner, mecedloga@gmail.com via Google): everything admin + staff accounts.

## Features
| id | feature | persona | phase |
|---|---|---|---|
| F-1 | Web app runs reliably on preview (backend up, Expo web served, no blank/crash pages) | all | 1 |
| F-2 | Attractive home/landing presenting products (flavours, toppings) | client | 1 |
| F-3 | Menu: compose order (size, toppings, quantity) → cart | client | 1 |
| F-4 | Checkout: delivery address (map, zone check) + payment choice: cash on delivery or online Mobile Money (PawaPay sandbox) | client | 1 |
| F-5 | Real-time order tracking (reçue → en préparation → en route → livré) | client | 1 |
| F-6 | Admin live dashboard: see orders, update status, assign driver | admin | 1 |
| F-7 | Admin menu management (products, flavours, toppings, prices, availability) | admin | 1 |
| F-8 | Livreur flow on web: courses, statuses, GPS, cash confirmation | livreur | 1 |
| F-9 | Existing login kept (phone+password, email OTP, Google) | all | 1 |
| F-10 | Advanced features verified/polished on web: reports xlsx/pdf, archives, promotions, banners, FR/EN, dark mode, web push, legal pages, staff mgmt, zones | admin/client/livreur | 2 |
| F-11 | Production web build + SEO/meta/PWA + deployment readiness for custom domain | all | 3 |

## Phases
- Phase 1 (MVP) → the core order loop works end to end in the browser, desktop + mobile web → F-1..F-9. Docs: [phase1/requirement.md](phase1/requirement.md), [phase1/journeys.md](phase1/journeys.md)
- Phase 2 → advanced features verified and polished on web → F-10
- Phase 3 → production build, deployment health check, custom domain guidance → F-11

## UI/UX Rules
- French by default (FR/EN available). Existing design system (rose #E6156F, vert #8DC63F, Fredoka/Nunito) kept.
- Desktop-first web with responsive mobile web (360 → 1440 px). Browser back button and shareable URLs work.
- No emoji as UI icons (heroicons).

## Integrations (all existing, keep as-is)
- PawaPay Mobile Money sandbox (M-Pesa, Airtel, Orange) — user's own keys in backend/.env
- Mapbox (map, directions, reverse geocode) + TomTom (address search) — keys in backend/.env
- Emergent managed email (Resend) for OTP; Emergent Google Auth
- Emergent Object Storage for product photos
- Web push VAPID

## Edge Cases
- Address outside covered zones → order refused.
- Mobile Money failure/timeout → retry or fallback to cash.
- Client cancel only before "en route".
- Disabled account blocked.

## Seed Data
Existing seeds only (demo accounts controlled by SEED_DEMO_ACCOUNTS, catalogue, zones). No new demo data without approval.
