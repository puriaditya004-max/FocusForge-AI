import React from "react";
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
} from "lucide-react";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { key: "timetable", label: "Smart Timetable", icon: CalendarClock, path: "/timetable" },
  { key: "plan", label: "Today's Plan", icon: ClipboardList, path: "/todays-plan" },
  { key: "study-room", label: "Study Room", icon: Users, path: "/study-room" },
  { key: "ai-mentor", label: "AI Mentor", icon: Bot, path: "/ai-mentor" },
  { key: "youtube", label: "YouTube Suggestions", icon: Youtube, path: "/youtube" },
  { key: "progress", label: "Progress", icon: BarChart3, path: "/progress" },
  { key: "rewards", label: "Rewards", icon: Trophy, path: "/rewards" },
  { key: "penalties", label: "Penalties", icon: ShieldAlert, path: "/penalties" },
  { key: "focus-mode", label: "Focus Mode", icon: Camera, path: "/focus-mode" },
  { key: "settings", label: "Settings", icon: Settings, path: "/settings" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <aside className="w-64 bg-[#0e0e18] border-r border-white/5 flex flex-col py-4 px-3">
      <div className="px-2 mb-6">
        <h1 className="text-base font-bold text-white">FocusForge AI</h1>
        <p className="text-xs text-gray-500">Discipline Today, Freedom Tomorrow</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ key, label, icon: Icon, path }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={key}
              onClick={() => navigate(path)}
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
  );
}