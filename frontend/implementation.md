Act as a Senior Frontend Engineer, Product Engineer, and UI/UX-focused Full-Stack Engineer.

We are rebuilding the complete Shopwise MiniPOS frontend from the current static HTML/CSS/JavaScript implementation into:

React
Vite
Tailwind CSS
React Router
TanStack Query
Lucide React
Stripe Elements

The existing backend is already built and exposed through a versioned REST API.

Your job is to:

1. rebuild the entire frontend in React
2. preserve the existing Shopwise product design direction
3. improve the structure and maintainability
4. connect the React frontend to the existing backend
5. remove legacy static frontend code only after the replacement is complete
6. verify all major owner and shopkeeper workflows end-to-end
7. keep the code clean, human-readable, and portfolio-quality

Do NOT change the backend architecture unless a genuine integration bug requires a very small fix.

Do NOT redesign database logic.

Do NOT add unrelated features.

--------------------------------------------------
1. FIRST INSPECT THE CURRENT PROJECT
--------------------------------------------------

Before writing code, inspect:

- current frontend pages
- existing HTML/CSS/JS
- current backend README/API docs
- backend routes
- backend response format
- auth/session behavior
- roles
- Stripe flow
- reports
- notifications
- environment variables
- current deployment config
- current Vercel setup

Use the current backend as the API source of truth.

Do not invent endpoints.

--------------------------------------------------
2. FRONTEND STACK
--------------------------------------------------

Create the frontend using:

React
Vite
Tailwind CSS
React Router
TanStack Query
Lucide React
Stripe Elements

Do not add Redux unless there is a real need.

Prefer:

TanStack Query
+
small React Context for auth/session/UI state

Keep dependencies minimal.

--------------------------------------------------
3. TARGET FRONTEND STRUCTURE
--------------------------------------------------

Use a clean structure approximately like:

frontend/
├── src/
│   ├── app/
│   │   ├── router.jsx
│   │   └── providers.jsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── forms/
│   │   ├── tables/
│   │   └── feedback/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── shops/
│   │   ├── shopkeepers/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── payments/
│   │   ├── reports/
│   │   └── returns/
│   │
│   ├── pages/
│   │   ├── auth/
│   │   ├── owner/
│   │   └── shopkeeper/
│   │
│   ├── services/
│   │   ├── apiClient.js
│   │   ├── authService.js
│   │   └── queryClient.js
│   │
│   ├── hooks/
│   ├── utils/
│   ├── constants/
│   ├── styles/
│   ├── App.jsx
│   └── main.jsx
│
├── public/
├── .env.example
├── package.json
└── README.md

Adjust if necessary, but keep responsibilities clear.

--------------------------------------------------
4. DESIGN DIRECTION
--------------------------------------------------

The UI should feel like a polished commercial product.

Target quality:

- Stripe
- Linear
- Square
- Shopify
- modern premium commerce software

Do not copy them directly.

Keep Shopwise's dark green brand direction.

The UI should feel:

premium
calm
clean
confident
trustworthy
fast
intentional

Avoid:

- generic admin templates
- glassmorphism
- excessive gradients
- giant cards
- too many rounded containers
- glowing effects
- random colors
- AI-dashboard appearance
- student-project styling

--------------------------------------------------
5. DESIGN SYSTEM
--------------------------------------------------

Create a consistent Tailwind-based design system.

Use a restrained palette:

- dark green primary
- neutral backgrounds
- neutral borders
- semantic success/warning/error colors

Create reusable component styles for:

- buttons
- inputs
- selects
- tables
- cards
- badges
- dropdowns
- modals
- drawers
- toasts
- loading states
- empty states
- confirmation dialogs

Do not repeatedly hardcode long Tailwind class strings if a reusable component is justified.

--------------------------------------------------
6. RESPONSIVE DESIGN
--------------------------------------------------

Support:

desktop
laptop
tablet
mobile

Test approximately:

1440px
1280px
1024px
768px
430px
390px

Desktop:
- full sidebar
- dense operational layouts
- side-by-side POS/cart

Tablet:
- collapsible navigation
- responsive grids
- POS still highly usable

Mobile:
- sidebar becomes drawer
- tables adapt or scroll
- forms become single column
- POS cart becomes drawer/sheet or separate mobile panel

Do not simply shrink desktop layouts.

--------------------------------------------------
7. ROUTING
--------------------------------------------------

Use React Router.

Suggested routes:

PUBLIC

/login
/signup

OWNER

/app
/app/products
/app/inventory
/app/shopkeepers
/app/sales
/app/sales/:saleId
/app/payments
/app/reports
/app/settings
/app/profile

SHOPKEEPER

/pos
/pos/sales
/pos/sales/:saleId
/pos/profile

Use route guards.

Do not expose owner routes to shopkeepers.

--------------------------------------------------
8. AUTH ARCHITECTURE
--------------------------------------------------

Create a clean auth layer.

Frontend should integrate with the existing backend endpoints.

Expected flow:

signup
login
refresh
logout
session
profile

Do not trust a role selected in the frontend.

Role comes from the backend/user profile.

Create reusable auth state.

Example concept:

AuthProvider
useAuth()

It should provide:

user
profile
role
isAuthenticated
isLoading
login()
logout()
refreshSession()

Do not store excessive auth state.

--------------------------------------------------
9. API CLIENT
--------------------------------------------------

Create one central API client.

Example:

src/services/apiClient.js

Responsibilities:

- base URL
- Authorization Bearer header
- JSON handling
- common error parsing
- request ID extraction
- 401 handling
- token refresh/retry where appropriate

Do not scatter raw fetch calls throughout components.

Use environment variable:

VITE_API_URL=

Example:

VITE_API_URL=http://localhost:5000/api/v1

--------------------------------------------------
10. TANSTACK QUERY
--------------------------------------------------

Use TanStack Query for server state.

Use it for:

products
inventory
shopkeepers
sales
payments
reports
shop/profile

Use:

queries
mutations
invalidation
loading states
error states

Do not manually maintain duplicated server data in React state.

--------------------------------------------------
11. AUTH PAGES
--------------------------------------------------

Rebuild Login and Signup in React.

Use the premium split-layout design direction.

Keep:

- Shopwise branding
- dark green panel
- concise product messaging
- polished form card

Do not include broken image placeholders.

Login:

email
password
forgot password link where supported
sign in
signup link

Signup:

full name
email
password
confirm password
terms checkbox
create account

No role selector.

--------------------------------------------------
12. OWNER ONBOARDING
--------------------------------------------------

After owner signup/login:

If owner has no shop:

show a clean shop setup flow.

Collect only fields supported by backend.

Example:

shop name
type
address
city
country
currency if available

After creation:

redirect to owner dashboard.

Do not permit creation of a second shop.

--------------------------------------------------
13. OWNER APP SHELL
--------------------------------------------------

Create a premium app shell:

sidebar
top bar
main content

Sidebar:

Overview
Products
Inventory
Sales
Shopkeepers
Reports
Settings
Profile

Bottom:

user/profile
logout

Make active route obvious but restrained.

--------------------------------------------------
14. OWNER DASHBOARD
--------------------------------------------------

Create a practical dashboard.

Show:

Today's sales
Transactions
Gross profit
Low stock

Then:

sales trend
recent transactions
top products
low stock
payment method breakdown

Use real backend report data where available.

Do not invent fake KPI data.

--------------------------------------------------
15. PRODUCTS
--------------------------------------------------

Connect product APIs.

Support:

list
search
filter
create
edit
archive
detail

Owner:
full CRUD/archive

Shopkeeper:
read only

Do not allow frontend to send:

shopId
ownerId
inventory quantity

Use forms with clear sections:

Basic Information
Pricing
Inventory Thresholds

--------------------------------------------------
16. INVENTORY
--------------------------------------------------

Connect:

inventory listing
low stock
product stock
movement history
adjustments

Owner can:

INITIAL_STOCK
RESTOCK
ADJUSTMENT
DAMAGE

Shopkeeper:
read only

Do NOT allow direct quantity editing.

Use the backend stock-adjustment endpoint.

Show movement history clearly.

--------------------------------------------------
17. SHOPKEEPERS
--------------------------------------------------

Connect:

create
list
detail
update
activate/deactivate
reset password/recovery

Use a clean table and action menu.

Do not expose role selection.

Owner only.

--------------------------------------------------
18. POS SCREEN
--------------------------------------------------

This is the most important frontend screen.

Build it specifically for fast retail use.

Desktop layout:

Product Browser | Cart

Product browser:

search by:
name
SKU
barcode

Product row/card should show:

name
selling price
stock
category/SKU

Keep it dense and quick.

Cart:

product
quantity
price
line total
remove

Bottom:

subtotal
discount/tax if backend supports them
total
payment method
checkout

--------------------------------------------------
19. CART STATE
--------------------------------------------------

Use local React state or a small dedicated hook/store.

Do not use Redux unless necessary.

Cart should support:

add item
increment
decrement
remove
clear

Do not treat client-calculated totals as authoritative.

They are display-only.

Backend response is final.

--------------------------------------------------
20. CHECKOUT
--------------------------------------------------

Connect the actual checkout endpoint.

Send only:

clientRequestId
payment.method
items:
  productId
  quantity

Do NOT send:

unit price
subtotal
total
shopId
cashierId
receipt number
payment status

Generate one clientRequestId per logical checkout.

Reuse it when retrying the same uncertain request.

--------------------------------------------------
21. CHECKOUT UX
--------------------------------------------------

While submitting:

disable checkout button
show clear processing state

On success:

show authoritative receipt number
show authoritative backend totals
clear cart
refresh inventory
refresh recent sales

On failure:

do not clear cart

Show meaningful errors such as:

Insufficient stock
Product unavailable
Session expired
Payment pending

--------------------------------------------------
22. CASH PAYMENT
--------------------------------------------------

For cash:

display:

Amount due
Cash received
Change

Change may be calculated in UI for cashier convenience.

Do not send it as authoritative sale data unless backend explicitly supports it.

--------------------------------------------------
23. M-PESA
--------------------------------------------------

Use the backend-supported state.

If M-Pesa remains pending:

show a pending payment state.

Do not display fake success.

Allow sale/payment state refresh.

--------------------------------------------------
24. STRIPE CARD PAYMENT
--------------------------------------------------

Use:

@stripe/react-stripe-js
@stripe/stripe-js

Frontend environment:

VITE_STRIPE_PUBLISHABLE_KEY=

Never expose:

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

Card flow:

1. checkout with payment.method = card
2. backend creates pending sale/payment
3. call Stripe create-intent endpoint with saleId
4. receive clientSecret
5. render Stripe Elements
6. confirm payment through Stripe
7. do NOT mark payment complete locally
8. backend webhook controls final payment state
9. refresh sale/payment after confirmation

Never build raw card-number inputs yourself.

--------------------------------------------------
25. SALES
--------------------------------------------------

Connect:

sales list
pagination
filters
sale detail

Show:

receipt
date/time
cashier
items
payment method
total
status

Sale detail:

sale header
sale items
totals
payment
references
return/void actions if supported

--------------------------------------------------
26. RETURNS / VOIDS
--------------------------------------------------

If backend endpoints are active:

connect:

void sale
partial return

Owner only.

Use confirmation dialogs.

Never mutate original sale data locally.

After completion invalidate:

sale
sales list
inventory
reports

If backend still does not support these:

do not fake them.

Hide or disable the actions clearly.

--------------------------------------------------
27. PAYMENTS
--------------------------------------------------

Connect payment records.

Show:

Cash
M-Pesa
Card

Statuses:

Pending
Completed
Failed
Refunded

Map exact backend values to friendly labels.

Do not expose controls that allow arbitrary payment status changes.

--------------------------------------------------
28. REPORTS
--------------------------------------------------

Connect real report endpoints.

Support:

daily sales
monthly sales
products
inventory
profit
monthly summary

Build polished charts/tables.

Use a lightweight chart library only if justified.

If adding one, use something simple and maintainable.

Do not create fake analytics.

--------------------------------------------------
29. MONTHLY EMAIL REPORT
--------------------------------------------------

Connect:

POST /reports/monthly-summary/email

Owner only.

Provide:

Send report now

with:

loading
success
failure

Do not allow arbitrary email recipients.

--------------------------------------------------
30. PROFILE
--------------------------------------------------

Connect:

GET /users/me
PATCH /users/me

Allow only fields backend permits.

Email should remain read-only if backend requires auth-specific update flow.

--------------------------------------------------
31. SHOP SETTINGS
--------------------------------------------------

Connect current shop retrieval/update.

Allow only supported fields.

Do not expose owner_id or protected fields.

--------------------------------------------------
32. ERROR HANDLING
--------------------------------------------------

Create one reusable frontend error approach.

Map backend errors such as:

VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
INSUFFICIENT_STOCK
SALE_ALREADY_PAID
PAYMENT_PENDING
STRIPE_UNAVAILABLE
RATE_LIMITED

to clear user-facing messages.

Do not expose raw backend/database text.

--------------------------------------------------
33. TOASTS
--------------------------------------------------

Use a consistent toast system for:

Product created
Inventory updated
Shopkeeper created
Sale completed
Report sent

Avoid browser alert().

--------------------------------------------------
34. LOADING STATES
--------------------------------------------------

Use:

skeletons
button loaders
table placeholders

Avoid unnecessary full-page spinners.

--------------------------------------------------
35. EMPTY STATES
--------------------------------------------------

Create clear empty states.

Examples:

No products yet
No sales yet
No shopkeepers yet
No low-stock items

Provide useful next actions.

--------------------------------------------------
36. ACCESSIBILITY
--------------------------------------------------

Use:

semantic HTML
labels
keyboard focus
aria attributes where appropriate
proper buttons
accessible modals
reasonable color contrast
keyboard-friendly POS controls

--------------------------------------------------
37. HUMAN-READABLE CODE
--------------------------------------------------

This is a portfolio project.

Code must be:

clean
properly indented
meaningfully named
well structured
easy to trace

Use comments only for non-obvious decisions.

Good comments:

// Backend checkout is authoritative for prices and totals.

// Stripe webhook updates the persisted payment status;
// the client must not mark card payments complete itself.

Do not comment obvious code.

Avoid generated-looking over-abstraction.

Do not create:

BaseService
BaseComponent
UniversalTableFactory
GenericEverythingProvider

unless genuinely needed.

--------------------------------------------------
38. REMOVE LEGACY FRONTEND
--------------------------------------------------

Once React replacement is complete and verified:

identify old static frontend files.

Only remove them if:

1. no longer referenced
2. replacement exists
3. functionality verified

Do not delete uncertain files.

Create a cleanup report.

--------------------------------------------------
39. ENVIRONMENT FILE
--------------------------------------------------

Create:

frontend/.env.example

Include placeholders only:

VITE_API_URL=
VITE_STRIPE_PUBLISHABLE_KEY=

Add any other frontend-safe variable actually needed.

Never include backend secrets.

--------------------------------------------------
40. VERCEL DEPLOYMENT SUPPORT
--------------------------------------------------

Prepare the React/Vite frontend for Vercel.

Ensure:

npm run build

creates a valid dist directory.

Configure SPA routing if necessary.

Ensure refreshing:

/app/products
/pos

does not return 404.

Use the appropriate Vercel rewrite configuration if required.

--------------------------------------------------
41. SECURITY REVIEW
--------------------------------------------------

Verify frontend contains NO:

SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
backend secrets
database passwords

Only public frontend-safe values may use VITE_ variables.

--------------------------------------------------
42. MANUAL END-TO-END TEST
--------------------------------------------------

After integration, manually test in browser.

OWNER:

signup
login
create shop
create shopkeeper
create product
initial stock
restock
view inventory
view sales
view reports
send monthly report
update shop
update profile
logout/login

SHOPKEEPER:

login
view products
search
view stock
add products to cart
cash checkout
view receipt
view recent sale
confirm stock changed
confirm owner-only pages denied
logout

--------------------------------------------------
43. CHECKOUT MANUAL TEST
--------------------------------------------------

Test:

stock = 1
attempt quantity = 2

Expected:

checkout fails
cart remains
stock unchanged
no fake success

--------------------------------------------------
44. DOUBLE CHECKOUT TEST
--------------------------------------------------

Rapidly click checkout twice.

UI must prevent obvious double submission.

Backend idempotency remains final protection.

Verify one sale only.

--------------------------------------------------
45. STRIPE TEST MODE
--------------------------------------------------

Use Stripe TEST mode.

Use official Stripe test cards only.

Verify:

pending sale
PaymentIntent creation
Elements renders
payment confirmation
webhook-driven status update
persisted completed state

Never perform a real charge.

--------------------------------------------------
46. RESPONSIVE MANUAL TEST
--------------------------------------------------

Verify at:

1440
1280
1024
768
430
390

Test real API data in layouts.

Ensure:

no overflow
no broken navigation
usable tables
usable POS
usable modals
usable forms

--------------------------------------------------
47. CONSOLE / NETWORK CHECK
--------------------------------------------------

Inspect browser DevTools.

Fix:

console errors
unhandled promises
404 assets
duplicate requests
unexpected request loops
CORS failures
wrong URLs

Do not leave noisy production console logs.

--------------------------------------------------
48. TESTING
--------------------------------------------------

Add frontend tests where reasonable.

Prefer:

Vitest
React Testing Library

Focus on:

auth guards
critical forms
cart behavior
checkout payload
role restrictions
Stripe payment UI flow
API error handling

Do not create hundreds of shallow tests.

--------------------------------------------------
49. BUILD VERIFICATION
--------------------------------------------------

Run:

npm install
npm run lint
npm test
npm run build

Fix all meaningful errors.

Do not claim success unless actually executed.

--------------------------------------------------
50. BACKEND REGRESSION
--------------------------------------------------

Do not break the backend.

After integration, run the existing backend test suite as well if accessible.

--------------------------------------------------
51. FINAL QUALITY REVIEW
--------------------------------------------------

Review the React app like a recruiter would.

Ask:

Can I understand the architecture?
Are components reasonably sized?
Is server state handled consistently?
Are hooks understandable?
Are APIs centralized?
Is the POS workflow clear?
Is security handled deliberately?
Does this feel like a real product?
Does the code look maintainable?

Fix real quality issues.

--------------------------------------------------
52. FINAL OUTPUT
--------------------------------------------------

Return:

1. React architecture
2. Final directory tree
3. Dependencies added
4. Legacy frontend files removed
5. Auth/session architecture
6. API client architecture
7. Owner pages completed
8. Shopkeeper/POS pages completed
9. Checkout integration
10. Stripe integration
11. Reports/email integration
12. Responsive implementation
13. Tests added
14. Test results
15. Build result
16. Browser manual test checklist
17. Console/network issues found
18. Security check
19. Vercel readiness
20. Remaining issues

Finally answer:

Frontend rebuild complete: YES / NO

Frontend ↔ Backend integration complete: YES / NO

Ready for final deployment: YES / NO

If any answer is NO, list only the exact blockers.

Do not claim functionality that was not manually or automatically verified.