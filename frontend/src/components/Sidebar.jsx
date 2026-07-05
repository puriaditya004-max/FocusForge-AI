import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  CalendarClock,
  ClipboardList,
  Users,
  Bot,
  Youtube,
  BarChart3,
  Trophy,
  ShieldAlert,
  Camera,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  Brain,
} from "lucide-react";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { key: "timetable", label: "Smart Timetable", icon: CalendarClock, path: "/timetable" },
  { key: "plan", label: "Today's Plan", icon: ClipboardList, path: "/todays-plan" },
  { key: "study-room", label: "Study Room", icon: Users, path: "/study-room" },
  { key: "ai-mentor", label: "AI Mentor", icon: Bot, path: "/ai-mentor" },
  { key: "quiz", label: "Quiz Generator", icon: Brain, path: "/quiz" },
  { key: "youtube", label: "YouTube Suggestions", icon: Youtube, path: "/youtube" },
  { key: "classes", label: "Classes Marketplace", icon: Store, path: "/classes" },
  { key: "progress", label: "Progress", icon: BarChart3, path: "/progress" },
  { key: "rewards", label: "Rewards", icon: Trophy, path: "/rewards" },
  { key: "penalties", label: "Penalties", icon: ShieldAlert, path: "/penalties" },
  { key: "focus-mode", label: "Focus Mode", icon: Camera, path: "/focus-mode" },
  { key: "settings", label: "Settings", icon: Settings, path: "/settings" },
];

// ---------------------------------------------------------
// Sidebar — desktop: normal fixed-width column (unchanged).
// Mobile (<md): collapses into an off-canvas drawer, opened
// via a floating hamburger button. Fully self-contained —
// no other page needs to change to support this.
// ---------------------------------------------------------
export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  async function handleLogout() {
    setIsOpen(false);
    await logout();
    navigate("/login");
  }

  function handleNavigate(path) {
    navigate(path);
    setIsOpen(false); // close the drawer after picking a page on mobile
  }

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 bg-[#13131f] border border-white/10 text-gray-200 p-2 rounded-lg shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop — mobile only, shown while drawer is open */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`w-64 bg-[#0e0e18] border-r border-white/5 flex flex-col py-4 px-3
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:h-auto`}
      >
        <div className="flex items-center justify-between px-2 mb-6">
          <div>
            <h1 className="text-base font-bold text-white">FocusForge AI</h1>
            <p className="text-xs text-gray-500">Discipline Today, Freedom Tomorrow</p>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden text-gray-400 hover:text-white"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {navItems.map(({ key, label, icon: Icon, path }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={key}
                onClick={() => handleNavigate(path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-purple-700/30 text-purple-200"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Logout section — bottom of sidebar */}
        <div className="pt-3 mt-3 border-t border-white/5">
          {user && (
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {user.name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-200 truncate">{user.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}