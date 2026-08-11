import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./context/ProtectedRoute";

import HeyForgeWidget from "./components/HeyForgeWidget";
import PremiumGate from "./components/PremiumGate";

const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const SubscriptionPolicy = lazy(() => import("./pages/SubscriptionPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Timetable = lazy(() => import("./pages/Timetable"));
const TodaysPlan = lazy(() => import("./pages/TodaysPlan"));
const StudyRoom = lazy(() => import("./pages/StudyRoom"));
const FocusMode = lazy(() => import("./pages/FocusMode"));
const Progress = lazy(() => import("./pages/Progress"));
const AiMentor = lazy(() => import("./pages/AiMentor"));
const YoutubeSuggestions = lazy(() => import("./pages/YoutubeSuggestions"));
const Rewards = lazy(() => import("./pages/Rewards"));
const CertificateExam = lazy(() => import("./pages/CertificateExam"));
const Penalties = lazy(() => import("./pages/Penalties"));
const Settings = lazy(() => import("./pages/Settings"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const ClassesMarketplace = lazy(() => import("./pages/ClassesMarketplace"));
const QuizGenerator = lazy(() => import("./pages/QuizGenerator"));
const DigitalId = lazy(() => import("./pages/DigitalId"));
const VerifyId = lazy(() => import("./pages/VerifyId"));
const Subscription = lazy(() => import("./pages/Subscription"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0b0b14] text-gray-300 flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Public routes — no login required */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/subscription-policy" element={<SubscriptionPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/verify-id/:token" element={<VerifyId />} />

          {/* Role-specific dashboards */}
          <Route
            path="/parent-dashboard"
            element={
              <ProtectedRoute allowedRoles={["PARENT"]}>
                <ParentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher-dashboard"
            element={
              <ProtectedRoute allowedRoles={["TEACHER"]}>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />

          {/* Student-only protected routes */}
          <Route
            path="/quiz"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <PremiumGate featureName="Quiz Generator">
                  <QuizGenerator />
                </PremiumGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/classes"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <ClassesMarketplace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/digital-id"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <DigitalId />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription"
            element={
              <ProtectedRoute allowedRoles={["STUDENT", "PARENT"]}>
                <Subscription />
              </ProtectedRoute>
            }
          />
          <Route
            path="/penalties"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <Penalties />
              </ProtectedRoute>
            }
          />
          <Route
            path="/certificate-exam"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <CertificateExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <Rewards />
              </ProtectedRoute>
            }
          />
          <Route
            path="/youtube"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <YoutubeSuggestions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-mentor"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <PremiumGate featureName="AI Mentor">
                  <AiMentor />
                </PremiumGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <Progress />
              </ProtectedRoute>
            }
          />
          <Route
            path="/focus-mode"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <PremiumGate featureName="Focus Mode">
                  <FocusMode />
                </PremiumGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/study-room"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <StudyRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/todays-plan"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <PremiumGate featureName="Today's Plan">
                  <TodaysPlan />
                </PremiumGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timetable"
            element={
              <ProtectedRoute allowedRoles={["STUDENT"]}>
                <PremiumGate featureName="Smart Timetable">
                  <Timetable />
                </PremiumGate>
              </ProtectedRoute>
            }
          />

          {/* Root path — send logged-in users to their own home;
              ProtectedRoute+allowedRoles below bounces correctly */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>

        {/* Global "Hey Forge" floating voice widget — renders itself
            only for logged-in STUDENT users, on every page above */}
        <HeyForgeWidget />
      </AuthProvider>
    </BrowserRouter>
  );
}
