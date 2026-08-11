import React from "react";
import { Link } from "react-router-dom";

const CONTACT_EMAIL = "focusforgeai1026@gmail.com";

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-200 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="text-purple-400 text-sm hover:underline">
          Back
        </Link>

        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Data Deletion - FocusForge AI</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: 11 Aug 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            You can delete your FocusForge AI account and personal app data from inside the app, or
            request help by email if you cannot access your account.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Delete from the app</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>Log in to FocusForge AI.</li>
              <li>Open Settings.</li>
              <li>Go to Account & Data.</li>
              <li>Choose Delete account.</li>
              <li>Enter your password and type DELETE to confirm.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">What gets deleted</h2>
            <p>
              Account details, study data, timetable data, AI mentor history, progress records,
              certificates, saved videos, OTP challenges, digital ID records, parent/student links,
              teacher profile records, and app settings are deleted where they belong to your
              account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">What may be retained</h2>
            <p>
              Some payment, invoice, refund, security, abuse-prevention, or legal records may be
              retained where required or allowed by law. These records are kept only for legitimate
              compliance, refund, tax, dispute, or platform-safety purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Email deletion request</h2>
            <p>
              If you cannot log in, email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-purple-400 hover:underline">
                {CONTACT_EMAIL}
              </a>{" "}
              from your registered email address with the subject "FocusForge account deletion".
              We may ask for additional verification before deleting the account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Processing timeline</h2>
            <p>
              In-app deletion starts immediately after confirmation. Email deletion requests are
              reviewed as soon as reasonably possible. Some backups or provider logs may take
              additional time to expire.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Related policies</h2>
            <p>
              Please also read our{" "}
              <Link to="/privacy-policy" className="text-purple-400 hover:underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link to="/terms" className="text-purple-400 hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
