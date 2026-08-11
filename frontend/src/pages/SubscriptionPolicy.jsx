import React from "react";
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "focusforgeai1026@gmail.com";

export default function SubscriptionPolicy() {
  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-200 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="text-purple-400 text-sm hover:underline">
          Back
        </Link>

        <h1 className="text-3xl font-bold text-white mt-4 mb-2">
          Subscription and Cancellation Policy - FocusForge AI
        </h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: 11 Aug 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            This policy explains how FocusForge AI trials, paid access, family plans, cancellations,
            and billing access work.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Trial access</h2>
            <p>
              Eligible student accounts can start a 30-day free trial. Trial access is intended for
              one user and may be blocked or revoked if it is abused, duplicated, or used in a way
              that violates our Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Paid plans</h2>
            <p>
              FocusForge AI may offer Student Monthly, Student Yearly, and Family Plan access.
              Current plan names, prices, features, and duration are shown on the Subscription page
              before checkout.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Renewal model</h2>
            <p>
              At this stage, paid access is activated for the purchased period after payment
              verification. Automatic renewal will apply only if it is clearly shown at checkout and
              supported by the selected payment method.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Cancellation</h2>
            <p>
              You can cancel active trial or paid access from the Subscription page when the cancel
              option is available. In the current app behavior, cancellation ends the active access
              immediately. If future recurring billing is introduced, cancellation will stop future
              renewals while any remaining access terms will be shown at checkout and in-app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Grace period</h2>
            <p>
              Paid access may enter a short grace period after the paid period ends, unless it was
              cancelled, revoked, or blocked for abuse. During grace, premium access may remain
              available while the account resolves payment or renewal issues.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Family Plan access</h2>
            <p>
              A Family Plan can provide access to approved linked student accounts, up to the seat
              limit shown in the app. If the parent account loses access, linked student access may
              also end.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Failed or disputed payments</h2>
            <p>
              A plan is activated only after payment verification succeeds. Failed, pending, or
              disputed payments do not guarantee access. Payment attempts and receipts may be shown
              in the Subscription page for account transparency.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Play Store and web checkout</h2>
            <p>
              Web checkout can use Razorpay. Android builds distributed through Google Play must use
              Google Play Billing or India's Alternative Billing program where required before
              showing Razorpay inside the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">9. Support</h2>
            <p>
              For subscription questions, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-400 hover:underline">
                {CONTACT_EMAIL}
              </a>{" "}
              with your account email and payment receipt or order ID.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">10. Related policies</h2>
            <p>
              Please also read our{" "}
              <Link to="/refund-policy" className="text-purple-400 hover:underline">
                Refund Policy
              </Link>
              ,{" "}
              <Link to="/terms" className="text-purple-400 hover:underline">
                Terms of Service
              </Link>
              , and{" "}
              <Link to="/privacy-policy" className="text-purple-400 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
