# Production Environment Checklist

This checklist is for Render, Vercel, and the separate admin app before a production release.

## Backend: Render

Required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLIENT_URL`
- `ADMIN_URL`
- `GEMINI_API_KEY`
- `ENCRYPTION_KEY`

Strongly recommended:

- `REDIS_URL`
- `SENTRY_DSN`
- `S3_BUCKET`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION`
- `PUBLIC_BASE_URL`

Payments and subscriptions:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `PLATFORM_FEE_PERCENT`
- `SUBSCRIPTION_TRIAL_DAYS`
- `SUBSCRIPTION_GRACE_DAYS`
- `STUDENT_MONTHLY_AMOUNT_PAISE`
- `STUDENT_YEARLY_AMOUNT_PAISE`
- `FAMILY_MONTHLY_AMOUNT_PAISE`

OTP delivery:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `OTP_SMS_PROVIDER`
- `MSG91_AUTH_KEY`
- `MSG91_OTP_TEMPLATE_ID`
- `SMS_OTP_WEBHOOK_URL`
- `EMAIL_OTP_WEBHOOK_URL`

Optional SMS provider:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

YouTube:

- `YOUTUBE_API_KEY`

AI monitoring:

- `GEMINI_DAILY_ALERT_THRESHOLD`

## Frontend: Vercel

Required:

- `VITE_API_URL`

Optional:

- `VITE_PLAY_STORE_BUILD=true` for Android builds that must hide non-Play billing paths.

## Admin App: Vercel

Required:

- `VITE_API_URL`

## Security Notes

- Never commit `.env` files.
- Never paste real secrets into GitHub issues, commit messages, or screenshots.
- Keep `CLIENT_URL` and `ADMIN_URL` exact. Wrong origins can break auth cookies and CORS.
- Keep `JWT_SECRET` and `ENCRYPTION_KEY` different between staging and production.
- Use Razorpay test keys only in staging.
- Use a separate Sentry project for staging if staging is created.
- The backend now fails fast in production if `DATABASE_URL` or `JWT_SECRET` is missing.
- Important provider groups such as frontend origins, encryption, Gemini, Razorpay, SMTP, and MSG91 log clear warnings when incomplete, without printing secret values.
- Backend logs redact secret-like keys before writing to console or log files.

## Panel Audit Notes

- Admin dashboard is mapped to real backend queues and overview APIs.
- Teacher dashboard is mapped to real verification, courses, enrollment, uploads, and payout status.
- Parent dashboard is mapped to real linked children, pending requests, family plan seats, and child goals.
- Empty states are present for no users, payments, courses, requests, reports, digital IDs, and linked students.
