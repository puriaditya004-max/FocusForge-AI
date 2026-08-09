# Play Console — Data Safety Form Guide

## Why this exists

Play Console requires every app to fill out a Data Safety
questionnaire before it can be published — what data the app
collects, why, whether it's shared with third parties, and whether
users can request deletion. Answering it wrong (understating what's
collected) is a policy violation Google actively enforces; answering
it defensively (overstating) just looks worse to users than
necessary. This doc is a checklist of exactly what FocusForge
actually collects, worked out from the real code (Prisma schema,
controllers, third-party integrations) rather than guessed —
answer the Play Console form directly from this table.

**Reminder:** this reflects the codebase as of this doc being
written. If you add a new field to the User model, a new third-party
SDK, or a new upload type later, this table (and the live Play
Console answers) need updating to match — Data Safety accuracy is
an ongoing thing, not a one-time form.

## Data types FocusForge actually collects

| Data type | Collected? | Details | Shared with a third party? |
|---|---|---|---|
| **Name** | Yes | Account signup (`User.name`) | No |
| **Email address** | Yes | Account signup/login (`User.email`) | No |
| **Phone number** | Yes, optional | `User.mobileNumber` — used for OTP verification | No |
| **Date of birth** | Yes | `User.dateOfBirth` — required for the age-gating/parental-consent flow (DPDP compliance) | No |
| **Photos** | Yes, optional | Avatar (`User.avatarUrl`); teacher ID/education documents during teacher verification | No — stored in your own R2/S3 bucket, not shared out |
| **Videos** | Yes, teachers only | Course lecture videos teachers upload | No — same bucket |
| **User-generated content** | Yes | Study Room chat messages, AI Mentor chat messages, quiz answers | **AI Mentor messages: yes** — sent to Google Gemini and/or Anthropic Claude (if the student added their own key) to generate a reply. This is the one real "shared with third party" answer on this form. |
| **App activity / in-app actions** | Yes | Focus session stats (duration, focus score, distraction count), course enrollment, quiz attempts, streaks/XP | No |
| **Camera** | **Processed, not collected** | Focus Mode's face-tracking (MediaPipe) runs entirely in the browser/WebView, on-device — no video frame, image, or camera data is ever sent to FocusForge's backend or any third party. Play Console's Data Safety form has a specific distinction for this: if you're asked "is this data collected" for Photos/Videos in the context of camera use, the accurate answer is **not collected** for the video stream itself, since nothing leaves the device. Don't confuse this with the "Photos" row above, which is about documents/avatars a user explicitly uploads. |
| **Financial info (payment)** | **Not collected by FocusForge directly** | Razorpay's hosted checkout handles card/UPI entry — FocusForge's backend only ever stores a Razorpay order ID, payment ID, and signature (verification tokens), never raw card/bank details. Depending on how strictly you want to answer, you can mark "Purchase history" as collected (course purchases, amounts, timestamps) while marking raw payment method details as not applicable to your app itself — that data lives with Razorpay, who has their own Data Safety disclosures as the payment processor. |
| **Device or other IDs** | Yes, only if Sentry is configured | Sentry (error tracking, see `SENTRY_DSN` in backend `.env`) automatically captures device model, OS version, and IP address on any error report, for debugging purposes. If you haven't set `SENTRY_DSN` yet, this row doesn't apply yet — but plan to answer "yes" once you do, since it's part of the intended production setup (see `docs/STAGING.md` and the earlier Redis/Sentry work). |
| **Location** | No | No geolocation API is used anywhere in the app | — |
| **Health / fitness data** | No | — | — |
| **Contacts** | No | — | — |
| **Analytics / advertising IDs** | No | No analytics SDK (Google Analytics, Mixpanel, etc.) or ad SDK is integrated anywhere in the app — confirmed by checking both `frontend/package.json` and `backend/package.json` for such dependencies | — |

## Purpose (why each category is collected)

Play Console also asks *why* — for FocusForge, the honest answer
across almost every row is the same short list, which you can reuse:

- **App functionality** — account creation, course access, Focus
  Mode session tracking, AI Mentor
- **Account management** — login, password reset, profile
- **Fraud prevention/compliance** — age verification (DPDP), payment
  verification signatures

None of this data is used for **advertising or marketing purposes**
— true, and worth confirming explicitly on the form (this app runs
no ad SDK and no behavioral-profiling analytics, as noted in the
table above and in the app's own Privacy Policy page, Section on
advertising).

## Deletion / data controls to mention on the form

Play Console asks whether users can request data deletion. Point
this at whatever your account-deletion flow currently supports —
if there isn't one yet in the app itself, the Grievance Officer
contact (added to the Privacy Policy, Section 10) is the fallback
channel users can use to request it, which is an acceptable answer
as long as it's true and the grievance process actually handles
deletion requests when they come in.

## Children's data — since this app has real underage users

Because of the age-gating work already shipped (minors can sign up
with parental consent for payments), Play Console's separate
"Is your app directed at children" / families-policy questions
deserve a careful, honest answer too — this isn't part of the Data
Safety form itself but comes up in the same Play Console flow for
an app like this. If you're not certain how FocusForge's audience
mix affects that classification, that's worth a specific question
to Play Console support or a lawyer familiar with Play's families
policy (this is a good one to fold into the existing Item 9 legal
review, alongside DPDP) — Play's families-policy requirements are
stricter than DPDP's and getting the declaration wrong risks a
policy strike, not just a compliance gap.
