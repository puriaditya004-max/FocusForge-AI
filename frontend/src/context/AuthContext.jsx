import React, { createContext, useContext, useState, useEffect } from "react";
import { applyTheme } from "../utils/theme";

// ---------------------------------------------------------
// AuthContext — single source of truth for "who is logged in".
// Wrap the whole app with <AuthProvider> (done in App.jsx),
// then any page/component can call useAuth() to get:
//   { user, loading, login, signup, logout, isAuthenticated }
//
// signup() now takes an optional `role` param:
//   "STUDENT" (default) | "PARENT" | "TEACHER"
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
        applyTheme(data.user?.theme);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signup(name, email, role = "STUDENT") {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Signup failed. Please try again.");
    }
    if (data.user && !data.verificationToken) {
      setUser(data.user);
      applyTheme(data.user?.theme);
    }
    return data;
  }

  async function login(identifier, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (res.status === 403 && (data.code === "EMAIL_VERIFICATION_REQUIRED" || data.code === "ONBOARDING_REQUIRED")) {
      if (data.user) {
        setUser(data.user);
        applyTheme(data.user?.theme);
      }
      return data;
    }
    if (!res.ok) {
      throw new Error(data.error || "Login failed. Please try again.");
    }
    setUser(data.user);
    applyTheme(data.user?.theme);
    return data;
  }

  async function completeOnboarding(payload) {
    const res = await fetch(`${API_BASE}/auth/onboarding/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not complete onboarding.");
    }
    setUser(data.user);
    applyTheme(data.user?.theme);
    return data;
  }

  async function verifyEmail(verificationToken, code) {
    const res = await fetch(`${API_BASE}/auth/email/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ verificationToken, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Email verification failed.");
    }
    setUser(data.user);
    applyTheme(data.user?.theme);
    return data;
  }

  async function resendEmailVerification(verificationToken) {
    const res = await fetch(`${API_BASE}/auth/email/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ verificationToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not resend OTP.");
    }
    return data;
  }

  async function requestPasswordReset(email) {
    const res = await fetch(`${API_BASE}/auth/forgot-password/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not send reset OTP.");
    }
    return data;
  }

  async function resetPassword(email, code, password) {
    const res = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, code, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Could not reset password.");
    }
    return data;
  }

  async function logout() {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  }

  async function deleteAccount(password, confirmation) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password, confirmation }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || "Failed to delete account.");
    }
    setUser(null);
    return data;
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    signup,
    login,
    completeOnboarding,
    verifyEmail,
    resendEmailVerification,
    requestPasswordReset,
    resetPassword,
    logout,
    deleteAccount,
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
