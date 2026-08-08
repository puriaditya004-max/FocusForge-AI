import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

// ---------------------------------------------------------
// App — deliberately only 2 real routes. This app does exactly
// one job (admin panel), so there's no router sprawl to maintain
// the way the main frontend has. Anything unrecognized redirects
// to /login rather than a 404 — an admin who mistypes a URL
// should land somewhere useful, not on a dead page.
// ---------------------------------------------------------
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            }
          />
          <Route path="/" element={<Navigate to="/admin-dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
