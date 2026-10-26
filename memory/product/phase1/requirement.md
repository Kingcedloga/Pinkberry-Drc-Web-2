# Phase 1 — MVP web: core order loop works in the browser

Version: phase-1. See /app/memory/product/overview.md and history in /app/memory/PRD.md.

Goal: the existing Expo app, served as a web app, runs the full loop — client orders on web → admin sees it live and moves it forward → livreur delivers → client sees each status live — on desktop and mobile web, with no crash, blank page or broken control. No rewrite; fix and optimise what exists.

## Functional requirements
- REQ-1 [always] The system shall serve the web app at the preview URL with the backend answering `GET /api/config` with 200.
- REQ-2 [unwanted] If a page fails to render, then the system shall show the error boundary instead of a blank screen.
- REQ-3 [always] The system shall expose the OpenAPI spec at `/api/openapi.json`.
- REQ-4 [always] The system shall present on the home/menu page the products with photo, name and price in USD and FC.
- REQ-5 [event] When a client opens a product, the system shall show its sizes, toppings and quantity with a live recalculated price.
- REQ-6 [event] When a client adds a composed product, the system shall increase the cart count and total.
- REQ-7 [event] When a client submits an address in a covered commune, the system shall allow continuing to payment.
- REQ-8 [unwanted] If the address is outside covered zones, then the system shall block the order with a visible message.
- REQ-9 [event] When a client confirms with "paiement à la livraison", the system shall create the order with status `recue` and open its tracking page.
- REQ-10 [event] When a client chooses Mobile Money (operator + number), the system shall start a PawaPay sandbox deposit and show the waiting state.
- REQ-11 [unwanted] If the Mobile Money payment fails or expires, then the system shall offer "Réessayer" and "Payer à la livraison".
- REQ-12 [state] While an order is active, the system shall refresh its status on the tracking page within 10 s of a change.
- REQ-13 [event] When a new order is created, the system shall list it on the admin dashboard within 10 s without manual reload.
- REQ-14 [event] When an admin changes an order status or assigns a livreur, the system shall persist it and show it to client and livreur.
- REQ-15 [event] When an admin creates, edits or marks a product out of stock, the system shall reflect it on the client menu.
- REQ-16 [event] When a livreur moves a course to récupérée / en route / livré and confirms cash, the system shall update the order for client and admin.
- REQ-17 [always] The system shall keep the existing login methods (phone + password, email OTP, Google) working on web.
- REQ-18 [unwanted] If a user opens a route outside their role, then the system shall redirect to their role's home.

## Quality requirements
Q-1  Tag: Web.Reliability
     Scale: console errors / uncaught exceptions on core pages
     Meter: e2e browser run over all core pages, 1 pass
     Must: 0 crashes, 0 blank pages
     Plan: 0 uncaught errors
Q-2  Tag: Web.Performance
     Scale: seconds from navigation to menu products visible
     Meter: browser timing, 3 trials
     Must: < 6 s (estimate)
     Plan: < 3 s
Q-3  Tag: Web.Responsive
     Scale: core pages usable without horizontal scroll or overlapping controls
     Meter: browser at 390 px and 1440 px
     Must: all core pages OK
     Plan: also 820 px
Q-4  Tag: Orders.Integrity (money)
     Scale: order total vs. items+fees
     Meter: API comparison on 3 orders
     Must: exact match
     Plan: exact match
Q-5  Tag: Access.Isolation (exposure)
     Scale: cross-role / cross-client data access
     Meter: API calls with other user tokens
     Must: 0 leaks
     Plan: 0 leaks
Q-6  Tag: Payment.Real (money)
     Scale: order marked paid only via signed PawaPay callback
     Meter: code review + sandbox run
     Must: never paid without confirmation
     Plan: same
