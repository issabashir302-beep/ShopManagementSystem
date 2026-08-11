# Monthly report notifications

On the first day of each month at 08:00 in `APP_TIMEZONE` (default cron `0 8 1 * *`), the job sends the previous calendar month's summary. The recipient is resolved from `shops.owner_id -> users.email`; neither the scheduled job nor the manual endpoint accepts a recipient.

Flow: acquire a persisted delivery claim, resolve owner/report data, render short HTML and plain text, send through the shared Resend client, then store the Resend message ID and `sent_at`. Failures store a bounded error message and remain retryable. A unique shop/type/month database key prevents concurrent workers from creating two logical deliveries. Resend also receives the stable idempotency key `monthly-report/{shopId}/{YYYY-MM}` to cover ambiguous provider timeouts.

Required configuration:

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=
APP_TIMEZONE=UTC
MONTHLY_REPORT_CRON=0 8 1 * *
```

The sender must be verified in Resend. Tests inject a fake email client and never contact Resend.
