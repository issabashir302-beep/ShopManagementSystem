# Payments

Payments are created only by the atomic checkout RPC. Their amount always equals the database-calculated sale total.

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/sales/:saleId/payments` | Active member | Paginated payments for a current-shop sale |
| GET | `/api/v1/payments/:paymentId` | Active member | Current-shop payment detail |
| POST | `/api/v1/payments/stripe/create-intent` | Active member | Create or reuse the sale's Stripe PaymentIntent |
| POST | `/api/v1/payments/stripe/webhook` | Stripe signature | Apply trusted Stripe status events |

## Status behavior

- Cash: payment `completed`, sale payment status `paid`.
- M-Pesa: payment and sale remain `pending`; provider integration is deferred.
- Card: checkout creates a pending local payment. Creating a PaymentIntent does not mark it paid. A verified `payment_intent.succeeded` webhook atomically changes payment to `completed` and sale to `paid`. A verified `payment_intent.payment_failed` changes payment to `failed` and sale to `unpaid`.

The create-intent request accepts only `{ "saleId": "uuid" }`. The repository loads the sale, pending card payment, shop ownership, amount, and currency through the caller's RLS context. Exact decimal strings are converted to Stripe minor units without floating-point arithmetic. The stable payment ID is used as Stripe's idempotency key, and the PaymentIntent ID is attached through `attach_stripe_payment_intent`.

The webhook uses Express raw-body parsing and Stripe signature verification. `process_stripe_payment_event` verifies the persisted PaymentIntent reference, amount, and currency; updates payment and sale atomically; writes an audit record; and deduplicates Stripe event IDs in `payment_provider_events`. No browser endpoint can set amount or status. Raw provider metadata and card data are never stored or returned.

## Stripe setup

Use Stripe test-mode values locally:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Forward test events to `/api/v1/payments/stripe/webhook` with the Stripe CLI. Never expose either secret to frontend code. The future frontend must use Stripe.js/Elements with the returned `clientSecret`; it must not collect raw card details on this server.

Run `npm test` from `backend/`.
