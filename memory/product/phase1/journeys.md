# Phase 1 journeys

- id: JRN-1
  steps: open the preview URL as a visitor on desktop, then on mobile width
  expected: the welcome/home page renders with Pinkberry branding and buttons to sign up / log in; no blank page; `/api/openapi.json` returns 200.

- id: JRN-2
  steps: log in as a client, open the menu
  expected: products show photo, name, price "$x ≈ y FC"; category filters and search narrow the list.

- id: JRN-3
  steps: open a product, pick a size, tick 2 toppings, set quantity 2, add to cart
  expected: price updates live with each choice; cart badge/total increases by the shown amount.

- id: JRN-4
  steps: go to cart → address, choose a covered commune, fill avenue/numéro/repère → continue
  expected: step 2 (paiement) opens with address, items, subtotal + delivery fee = total.

- id: JRN-5
  steps: at the address step, pick a commune that is not covered (or an admin-disabled one)
  expected: visible out-of-zone message; order cannot be placed.

- id: JRN-6
  steps: choose "paiement à la livraison", confirm the order
  expected: order created with status reçue and number PB-xxxx; tracking page opens showing steps.

- id: JRN-7
  steps: choose Mobile Money, pick an operator, enter a sandbox number, confirm
  expected: "En attente de confirmation" waiting state; on sandbox success → "Paiement confirmé" and tracking; on failure → "Réessayer" and "Payer à la livraison" offered.

- id: JRN-8
  steps: as admin open the dashboard while a client places an order
  expected: new order appears within 10 s without reload, with client, address, payment mode, status, total.

- id: JRN-9
  steps: admin opens the order, assigns a livreur, sets "en préparation"
  expected: status saved; client tracking page shows "en préparation" within 10 s.

- id: JRN-10
  steps: livreur logs in, opens the course, marks récupérée → en route → livré, confirms cash
  expected: each status visible to client tracking and admin dashboard within 10 s; order ends livrée and paid.

- id: JRN-11
  steps: admin edits a product price, adds a topping, marks another product out of stock
  expected: client menu shows the new price and topping; the out-of-stock product cannot be ordered.

- id: JRN-12
  steps: client cancels an order in reçue; then tries to cancel one already en route
  expected: first becomes annulée; second shows no cancel option / is refused.

- id: JRN-13
  steps: as client, open /admin and /livreur URLs; as visitor open /menu
  expected: client redirected to client home; visitor redirected to welcome/login.

- id: JRN-14
  steps: log in with wrong password; log in with correct phone + password
  expected: clear error message on wrong password; correct credentials land on the role's home.
