import React from "react";
import { Navigate } from "react-router-dom";
import FocusForgeLoader from "../components/FocusForgeLoader";
import { useAuth } from "./AuthContext";

// ---------------------------------------------------------
// ProtectedRoute — wraps any page that should only be visible
// to logged-in users. If not logged in, redirects to /login.
//
// Now also supports `allowedRoles` — e.g. a Parent Dashboard
// route should only be visible to PARENT users. If a STUDENT
// tries to visit /parent-dashboard directly by URL, they get
// bounced to their own correct home instead.
//
// Usage:
//   <ProtectedRoute><Dashboard /></ProtectedRoute>
//   <ProtectedRoute allowedRoles={["PARENT"]}><ParentDashboard /></ProtectedRoute>
// ---------------------------------------------------------

const ROLE_HOME = {
  STUDENT: "/dashboard",
  PARENT: "/parent-dashboard",
  TEACHER: "/teacher-dashboard",
  ADMIN: "/login",
};

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <FocusForgeLoader message="Verifying your session" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={ROLE_HOME[user?.role] || "/dashboard"} replace />;
  }

  return children;
}
