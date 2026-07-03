import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./context/ProtectedRoute";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

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

// ---------------------------------------------------------
// App.jsx
// Root component. Sets up all page routes here.
//
// AuthProvider wraps everything so any page can call useAuth().
// Every real app page is wrapped in <ProtectedRoute> so it's
// only visible to logged-in users — if not logged in, they get
// redirected to /login automatically.
//
// As we build more pages, just add a new <Route> line below
// (wrapped in ProtectedRoute) pointing to the new page component.
// ---------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — no login required */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected routes — must be logged in */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/penalties"
            element={
              <ProtectedRoute>
                <Penalties />
              </ProtectedRoute>
            }
          />
          <Route
            path="/certificate-exam"
            element={
              <ProtectedRoute>
                <CertificateExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <ProtectedRoute>
                <Rewards />
              </ProtectedRoute>
            }
          />
          <Route
            path="/youtube"
            element={
              <ProtectedRoute>
                <YoutubeSuggestions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-mentor"
            element={
              <ProtectedRoute>
                <AiMentor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <Progress />
              </ProtectedRoute>
            }
          />
          <Route
            path="/focus-mode"
            element={
              <ProtectedRoute>
                <FocusMode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/study-room"
            element={
              <ProtectedRoute>
                <StudyRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/todays-plan"
            element={
              <ProtectedRoute>
                <TodaysPlan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timetable"
            element={
              <ProtectedRoute>
                <Timetable />
              </ProtectedRoute>
            }
          />

          {/* Root path redirects to dashboard (ProtectedRoute there will
              bounce to /login automatically if not logged in) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}