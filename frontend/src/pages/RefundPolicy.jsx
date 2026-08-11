import React from "react";
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "focusforgeai1026@gmail.com";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-200 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="text-purple-400 text-sm hover:underline">
          Back
        </Link>

        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Refund Policy - FocusForge AI</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: 11 Aug 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            This policy explains how refund requests are handled for FocusForge AI subscriptions,
            family access, and marketplace purchases.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Subscription refunds</h2>
            <p>
              Refunds for FocusForge AI paid access are reviewed case by case. We may approve a
              refund when there is a duplicate charge, a failed payment that still deducted money,
              an incorrect charge, or a technical issue that prevents access after payment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Non-refundable cases</h2>
            <p>
              Refunds may be denied when the paid period has already been substantially used, the
              request is made after the access period ends, the account violated our Terms, or the
              purchase was used to access paid features and then cancelled only after use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Marketplace courses</h2>
            <p>
              Teacher marketplace purchases are reviewed separately. If a course is not delivered,
              is clearly misrepresented, or the teacher is removed for abuse, we may help review the
              issue and coordinate a resolution. Marketplace refunds can depend on the teacher,
              course access, and proof of payment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Payment method rules</h2>
            <p>
              Web checkout payments made through Razorpay are refunded to the original payment
              method when approved. If a purchase is made through Google Play Billing, refund
              handling follows Google Play's refund process. Android builds using India Alternative
              Billing may show provider-specific refund steps at checkout.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. How to request a refund</h2>
            <p>
              Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-400 hover:underline">
                {CONTACT_EMAIL}
              </a>{" "}
              with your account email, payment receipt or order ID, payment date, plan or course
              name, and the reason for the request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Review and processing time</h2>
            <p>
              We aim to review refund requests within 7 business days. Approved refunds are sent to
              the original payment method. Your bank, card network, UPI provider, Razorpay, or
              Google Play may take additional time to show the refund.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Related policies</h2>
            <p>
              Please also read our{" "}
              <Link to="/terms" className="text-purple-400 hover:underline">
                Terms of Service
              </Link>
              ,{" "}
              <Link to="/subscription-policy" className="text-purple-400 hover:underline">
                Subscription and Cancellation Policy
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
