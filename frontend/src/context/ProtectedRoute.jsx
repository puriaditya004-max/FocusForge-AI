import React from "react";
import { Navigate } from "react-router-dom";
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
};

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to={ROLE_HOME[user?.role] || "/dashboard"} replace />;
  }

  return children;
}