import React from "react";
import { Link } from "react-router-dom";

// Public page — no login required. Linked from Signup/Login footer.
export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-200 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <Link to="/login" className="text-purple-400 text-sm hover:underline">
          ← Back
        </Link>

        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Terms of Service — FocusForge AI</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: 18/07/2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            Welcome to FocusForge AI. By creating an account or using the platform, you agree to
            these Terms of Service. Please read them alongside our{" "}
            <Link to="/privacy-policy" className="text-purple-400 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Who can use FocusForge AI</h2>
            <p>
              FocusForge AI is intended for Students, Parents, and Teachers. If you are under 18,
              you should have your parent or guardian's permission to use this service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Your account</h2>
            <p>
              You're responsible for keeping your login credentials secure and for all activity
              under your account. Notify us immediately at{" "}
              <a href="mailto:focusforgeai1026@gmail.com" className="text-purple-400 hover:underline">
                focusforgeai1026@gmail.com
              </a>{" "}
              if you believe your account has been compromised.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. AI Mentor — please read this carefully</h2>
            <p className="mb-2">
              AI Mentor, quiz generator, and doubt-solver features are powered by third-party AI
              models (Google Gemini by default, or Anthropic Claude if you provide your own API
              key). AI-generated content can be wrong, incomplete, or outdated — always verify
              important facts, especially before exams. It is a study aid, not a substitute for a
              teacher or other professional.
            </p>
            <p>
              If you provide your own Anthropic API key, you're responsible for your own usage costs
              and for complying with Anthropic's terms. FocusForge is not responsible for charges on
              your own API key.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Certificates</h2>
            <p>
              FocusForge AI certificate exams are graded on our servers against a fixed question
              bank, requiring a 97%+ score to pass. Certificates reflect completion of our internal
              assessment and are not an accredited or government-recognized qualification unless
              explicitly stated otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Marketplace — courses, teachers, and payment</h2>
            <p className="mb-2">
              The Marketplace lets Teachers list courses and Students enroll. FocusForge AI does not
              process payments — we do not currently integrate a payment gateway. When you enroll in
              a paid course, payment is confirmed manually and directly between the Student and the
              Teacher, outside the app.
            </p>
            <p>
              We are not a party to that transaction, do not hold funds in escrow, and cannot
              guarantee refunds, quality, or delivery of paid course content. We may remove Teachers
              or listings we determine to be fraudulent, abusive, or in violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Study Rooms & community conduct</h2>
            <p>
              Study Rooms are live, shared spaces. You agree not to post content that is harassing,
              hateful, sexually explicit, illegal, or otherwise inappropriate for a platform used by
              students. We may remove content or suspend accounts that violate this.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Attempt to bypass or exploit the certificate/quiz grading system.</li>
              <li>Use automated scripts/bots to abuse the AI Mentor or any other feature.</li>
              <li>Share your account with others, or use another person's account.</li>
              <li>Upload content you don't have the right to share.</li>
              <li>Use the platform for anything illegal or harmful to other users, especially minors.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Fees</h2>
            <p>
              The core FocusForge AI platform is currently free to use. Paid courses in the
              Marketplace are set by individual Teachers. [Update this section as you introduce
              subscriptions or paid tiers.]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">9. Termination</h2>
            <p>
              You may delete your account at any time from Settings. We may suspend or terminate
              accounts that violate these Terms, engage in abuse, or pose a risk to other users.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">10. Disclaimer & limitation of liability</h2>
            <p>
              FocusForge AI is provided "as is." We don't guarantee uninterrupted service, that AI
              responses will always be correct, or that the platform will be error-free. To the
              maximum extent permitted by law, FocusForge AI and its team are not liable for indirect
              damages arising from your use of the platform, including academic outcomes based on AI
              Mentor guidance or disputes arising from Marketplace transactions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">11. Changes to these Terms</h2>
            <p>
              We may update these Terms as the platform evolves. Continued use after an update means
              you accept the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">12. Governing law</h2>
            <p>These Terms are governed by the laws of India. [Specify your state/jurisdiction.]</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">13. Contact us</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
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