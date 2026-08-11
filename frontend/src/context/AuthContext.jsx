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

  async function signup(name, email, password, role = "STUDENT", dateOfBirth = null, mobileNumber = "") {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password, role, dateOfBirth, mobileNumber }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Signup failed. Please try again.");
    }
    setUser(data.user);
    applyTheme(data.user?.theme);
    return data.user;
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
    setUser(data.user);
    applyTheme(data.user?.theme);
    return data.user;
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
