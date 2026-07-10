import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./context/ProtectedRoute";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

import Dashboard from "./pages/Dashboard";
import Timetable from "./pages/Timetable";
import TodaysPlan from "./pages/TodaysPlan";
import StudyRoom from "./pages/StudyRoom";
import FocusMode from "./pages/FocusMode";
import Progress from "./pages/Progress";
import AiMentor from "./pages/AiMentor";
import YoutubeSuggestions from "./pages/YoutubeSuggestions";
import Rewards from "./pages/Rewards";
import CertificateExam from "./pages/CertificateExam";
import Penalties from "./pages/Penalties";
import Settings from "./pages/Settings";
import ParentDashboard from "./pages/ParentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import ClassesMarketplace from "./pages/ClassesMarketplace";
import QuizGenerator from "./pages/QuizGenerator";
import HeyForgeWidget from "./components/HeyForgeWidget";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no login required */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

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
                <QuizGenerator />
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
                <AiMentor />
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
                <FocusMode />
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
                <TodaysPlan />
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
                <Timetable />
              </ProtectedRoute>
            }
          />

          {/* Root path — send logged-in users to their own home;
              ProtectedRoute+allowedRoles below bounces correctly */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        {/* Global "Hey Forge" floating voice widget — renders itself
            only for logged-in STUDENT users, on every page above */}
        <HeyForgeWidget />
      </AuthProvider>
    </BrowserRouter>
  );
}