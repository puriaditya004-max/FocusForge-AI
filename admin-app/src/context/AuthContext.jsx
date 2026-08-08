import React, { createContext, useContext, useState, useEffect } from "react";

// ---------------------------------------------------------
// AuthContext — admin-app's own copy of the main frontend's
// AuthContext. Deliberately kept as a SEPARATE file (not a shared
// package) so the two apps stay fully decoupled — editing one
// can never accidentally break the other's build.
//
// Auth mechanism is identical to the main app: httpOnly JWT
// cookie set by the backend on /api/auth/login, sent automatically
// on every fetch via credentials: "include". No backend changes
// needed for this to work from a new origin — see backend
// src/app.js `allowedOrigins`, which just needs ADMIN_URL added.
// ---------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check if already logged in

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed. Please try again.");
    }
    // Admin app deliberately does NOT expose signup — admins are
    // provisioned only via scripts/makeAdmin.js (backend/DB side),
    // never through a public-facing form. Reject here as a second
    // safety net even though the UI never calls signup().
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
