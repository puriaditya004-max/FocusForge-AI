import React from "react";
import { Link } from "react-router-dom";

// Public page — no login required. Linked from Signup/Login footer.
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-200 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="text-purple-400 text-sm hover:underline">
          ← Back
        </Link>

        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Privacy Policy — FocusForge AI</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: 18/07/2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            This Privacy Policy explains what personal data FocusForge AI ("we," "our," "the app")
            collects, why we collect it, and how it is stored and protected. It applies to all users
            of the platform — Students, Parents, and Teachers.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Who this applies to</h2>
            <p>
              FocusForge AI is used by three types of accounts: Students, Parents, and Teachers. If
              you are a Student under 18, a parent or legal guardian should review this policy with
              you before you create an account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. What data we collect</h2>
            <p className="mb-2">
              <strong>Account information:</strong> name, email address, password (stored as a
              one-way hash — we never store or can see your actual password), and role
              (Student/Parent/Teacher).
            </p>
            <p className="mb-2">
              <strong>Study activity data:</strong> tasks, roadmap progress, focus session timing,
              study streaks, XP/level, timetable preferences, and habit-tracking data you enter into
              the app.
            </p>
            <p className="mb-2">
              <strong>AI Mentor data:</strong> your chat messages with the AI Mentor, any photos or
              PDFs you upload to ask a doubt, and your quiz/exam results. If you add your own
              Anthropic (Claude) API key in Settings, it is encrypted before storage and only
              decrypted at the moment it's used. We never show your full key back to you — only a
              masked version (e.g. <code>sk-ant-...4f2a</code>).
            </p>
            <p className="mb-2">
              <strong>Certificate & exam data:</strong> your exam attempt history, scores, and
              issued certificates.
            </p>
            <p className="mb-2">
              <strong>Marketplace data:</strong> if you enroll in a teacher's course, we store the
              enrollment record and a contact phone number so the teacher can confirm payment with
              you directly. We do not process or store card, UPI, or bank details — FocusForge does
              not currently use a payment gateway.
            </p>
            <p className="mb-2">
              <strong>Study Room data:</strong> messages and activity within live Study Room
              sessions are stored to enable the feature to function.
            </p>
            <p>
              <strong>Parent–Student links:</strong> if a Parent account is linked to a Student
              account, the Parent can view that student's progress and activity data in the Parent
              Dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Why we collect it</h2>
            <p>
              To create and secure your account, run the core features you use, let Parents see
              linked Students' progress, let Teachers manage courses, and improve the app based on
              aggregate usage patterns. We do not build advertising profiles and do not sell your
              data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Third parties who process your data</h2>
            <p className="mb-2">
              <strong>Google (Gemini API)</strong> — used by default for all students.
            </p>
            <p>
              <strong>Anthropic (Claude API)</strong> — used only if you've added your own API key,
              under Anthropic's own privacy terms, using your own account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              5. Data belonging to children (users under 18)
            </h2>
            <p>
              India's Digital Personal Data Protection Act, 2023 (DPDP Act) requires verifiable
              parental or guardian consent before processing a child's personal data, and prohibits
              behavioral tracking, profiling, and targeted advertising directed at children. We do
              not run targeted advertising or behavioral profiling on any user, and especially not
              on users under 18. We recommend Student accounts be created with a parent or
              guardian's awareness.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. How long we keep your data</h2>
            <p>
              We keep your account and activity data for as long as your account is active. If you
              delete your account, we delete or anonymize your personal data within [X days], except
              where we're required to retain records for legal or dispute-resolution purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Your rights</h2>
            <p>
              You can access and review your data via Settings, correct inaccurate data, delete your
              saved AI Mentor API key at any time, and request account deletion by contacting us at{" "}
              <a href="mailto:focusforgeai1026@gmail.com" className="text-purple-400 hover:underline">
                focusforgeai1026@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Security</h2>
            <p>
              We use password hashing, encrypted storage for sensitive fields, HTTPS in transit, and
              access controls. No system is 100% secure — please use a strong, unique password.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">9. Changes to this policy</h2>
            <p>
              We may update this policy as FocusForge adds features. We'll update the date above and
              notify users in-app for material changes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">10. Contact us</h2>
            <p>
              Questions about this policy or your data? Contact us at{" "}
              <a href="mailto:focusforgeai1026@gmail.com" className="text-purple-400 hover:underline">
                focusforgeai1026@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}