import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ---------------------------------------------------------
// ProtectedAdminRoute — this app only ever has ONE kind of
// protected page (the dashboard), for ONE role (ADMIN). Unlike
// the main frontend's ProtectedRoute, there's no ROLE_HOME map
// to bounce students/teachers/parents to — if you're not an
// admin, you simply don't belong in this app at all, so you're
// sent to /login with an explanation.
// ---------------------------------------------------------
export default function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "ADMIN") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
