import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import Sidebar from "../components/Sidebar";
import {
  Users,
  MessageSquare,
  Send,
  Crown,
  Circle,
  Hash,
  Globe,
  Plus,
  X,
  Loader2,
  Flag,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:5000";

function formatTime(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function avatarColor(name) {
  const colors = [
    "bg-purple-600",
    "bg-blue-600",
    "bg-pink-600",
    "bg-green-600",
    "bg-yellow-600",
    "bg-orange-600",
    "bg-teal-600",
  ];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}

export default function StudyRoom() {
  const [currentUser, setCurrentUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [input, setInput] = useState("");
  const [chatError, setChatError] = useState(null);
  const [reportedIds, setReportedIds] = useState(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setCurrentUser(data.user || data))
      .catch(() => setChatError("Could not load your Study Room profile."));
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      setRoomsLoading(true);
      const res = await fetch(`${API_BASE}/studyroom/rooms`, { credentials: "include" });
      const data = await res.json();
      const results = data.results || [];
      setRooms(results);

      if (!activeRoom) {
        const global = results.find((r) => r.isGlobal);
        if (global) setActiveRoom(global);
      }
    } catch (err) {
      setChatError(err.message || "Failed to load study rooms.");
    } finally {
      setRoomsLoading(false);
    }
  }, [activeRoom]);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => setChatError(null));
    socket.on("connect_error", () => setChatError("Live chat connection failed. Refresh and try again."));
    socket.on("disconnect", () => setChatError("Live chat disconnected. Reconnecting..."));

    socket.on("online_users", (list) => setOnlineUsers(list));
    socket.on("new_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on("error_message", (err) => {
      setChatError(err?.error || "Something went wrong.");
      setTimeout(() => setChatError(null), 4000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!activeRoom || !socketRef.current) return;

    socketRef.current.emit("join_room", { roomId: activeRoom.id });

    async function loadMessages() {
      try {
        setMessagesLoading(true);
        const res = await fetch(`${API_BASE}/studyroom/rooms/${activeRoom.id}/messages`, {
          credentials: "include",
        });
        const data = await res.json();
        setMessages(data.results || []);
      } catch (err) {
        setChatError(err.message || "Failed to load messages.");
      } finally {
        setMessagesLoading(false);
      }
    }

    loadMessages();
  }, [activeRoom]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function selectRoom(room) {
    if (room.id === activeRoom?.id) return;
    setActiveRoom(room);
  }

  function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || !activeRoom || !socketRef.current) return;
    socketRef.current.emit("send_message", { roomId: activeRoom.id, message: trimmed });
    setInput("");
  }

  async function reportMessage(msg) {
    if (!activeRoom || reportedIds.has(msg.id)) return;

    try {
      const res = await fetch(`${API_BASE}/studyroom/rooms/${activeRoom.id}/messages/${msg.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to report message.");
      }

      setReportedIds((prev) => new Set(prev).add(msg.id));
    } catch (err) {
      setChatError(err.message);
      setTimeout(() => setChatError(null), 4000);
    }
  }

  async function handleCreateRoom() {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;

    try {
      setCreating(true);
      const res = await fetch(`${API_BASE}/studyroom/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      });

      const newRoom = await res.json();
      setRooms((prev) => [...prev, newRoom]);
      setActiveRoom(newRoom);
      setNewRoomName("");
      setShowCreateModal(false);
    } catch (err) {
      setChatError(err.message || "Failed to create room.");
    } finally {
      setCreating(false);
    }
  }

  const globalRoom = rooms.find((r) => r.isGlobal);
  const subjectRooms = rooms.filter((r) => !r.isGlobal && r.subject);
  const customRooms = rooms.filter((r) => !r.isGlobal && !r.subject);

  return (
    <div className="flex min-h-screen bg-[#0f0f1a] text-white">
      <Sidebar />

      <main className="flex-1 p-4 pt-16 md:p-6 md:pt-6 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={24} className="text-purple-400" /> Study Room
          </h1>
          <p className="text-gray-400 text-sm mt-1">Study together, grow together</p>
        </div>

        <div className="lg:hidden">
          <select
            value={activeRoom?.id || ""}
            onChange={(e) => {
              const room = rooms.find((r) => r.id === e.target.value);
              if (room) selectRoom(room);
            }}
            className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-100 outline-none focus:border-purple-500"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.isGlobal ? "Global - " : "# "}
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          <div className="hidden lg:flex w-56 flex-shrink-0 bg-[#1a1a2e] rounded-2xl border border-white/5 p-3 flex-col gap-4 overflow-y-auto">
            {roomsLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-500 text-xs gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading rooms...
              </div>
            ) : (
              <>
                {globalRoom && (
                  <div>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5 px-1">
                      Global
                    </p>
                    <button
                      onClick={() => selectRoom(globalRoom)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${
                        activeRoom?.id === globalRoom.id
                          ? "bg-purple-600/20 text-purple-200 border border-purple-500/30"
                          : "text-gray-400 hover:bg-white/5"
                      }`}
                    >
                      <Globe size={14} />
                      <span className="truncate">{globalRoom.name}</span>
                    </button>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5 px-1">
                    Subjects
                  </p>
                  <div className="space-y-1">
                    {subjectRooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => selectRoom(room)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${
                          activeRoom?.id === room.id
                            ? "bg-purple-600/20 text-purple-200 border border-purple-500/30"
                            : "text-gray-400 hover:bg-white/5"
                        }`}
                      >
                        <Hash size={14} />
                        <span className="truncate">{room.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">My Rooms</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="text-gray-500 hover:text-purple-300"
                      title="Create a room"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {customRooms.length === 0 && (
                      <p className="text-[10px] text-gray-600 px-1">No rooms yet - create one!</p>
                    )}

                    {customRooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => selectRoom(room)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${
                          activeRoom?.id === room.id
                            ? "bg-purple-600/20 text-purple-200 border border-purple-500/30"
                            : "text-gray-400 hover:bg-white/5"
                        }`}
                      >
                        <Hash size={14} />
                        <span className="truncate">{room.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex-1 bg-[#1a1a2e] rounded-2xl border border-white/5 flex flex-col min-w-0">
            <div className="p-4 border-b border-white/5 flex items-center gap-2">
              <MessageSquare size={18} className="text-purple-400" />
              <span className="text-sm font-semibold text-gray-200">
                {activeRoom ? activeRoom.name : "Select a room"}
              </span>
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                <Circle size={8} fill="currentColor" /> Live
              </span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500 text-xs gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-gray-600 text-xs py-8">No messages yet - say hi</p>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.userId === currentUser?.id;

                  return (
                    <div key={msg.id} className={`flex gap-3 group ${isMe ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`w-8 h-8 rounded-full ${avatarColor(
                          msg.userName
                        )} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                      >
                        {msg.userName?.charAt(0).toUpperCase()}
                      </div>

                      <div className={`max-w-xs flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">{isMe ? "" : msg.userName}</span>
                          <span className="text-xs text-gray-600">{formatTime(msg.time)}</span>
                        </div>

                        <div className={`flex items-center gap-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
                          <div
                            className={`px-4 py-2 rounded-2xl text-sm ${
                              isMe
                                ? "bg-purple-600 text-white rounded-tr-sm"
                                : "bg-white/10 text-gray-200 rounded-tl-sm"
                            }`}
                          >
                            {msg.message}
                          </div>

                          {!isMe && (
                            <button
                              onClick={() => reportMessage(msg)}
                              disabled={reportedIds.has(msg.id)}
                              title={reportedIds.has(msg.id) ? "Reported" : "Report message"}
                              className={`opacity-0 group-hover:opacity-100 transition p-1 rounded ${
                                reportedIds.has(msg.id) ? "text-red-400" : "text-gray-600 hover:text-red-400"
                              }`}
                            >
                              <Flag size={12} fill={reportedIds.has(msg.id) ? "currentColor" : "none"} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-white/5 flex flex-col gap-2">
              {chatError && (
                <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5">
                  {chatError}
                </p>
              )}

              <div className="flex gap-3">
                <input
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500 placeholder-gray-500"
                  placeholder={activeRoom ? "Type a message..." : "Select a room first"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={!activeRoom}
                />
                <button
                  onClick={sendMessage}
                  disabled={!activeRoom}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl transition"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-64 flex-shrink-0 space-y-3">
            <div className="bg-[#1a1a2e] rounded-2xl p-4 border border-white/5">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Users size={15} className="text-purple-400" /> Online ({onlineUsers.length})
              </h2>

              <div className="space-y-3">
                {onlineUsers.length === 0 && <p className="text-xs text-gray-600">No one else here yet</p>}

                {onlineUsers.map((u) => (
                  <div key={u.userId} className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className={`w-9 h-9 rounded-full ${avatarColor(
                          u.name
                        )} flex items-center justify-center text-white text-sm font-bold`}
                      >
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#1a1a2e] bg-green-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-white text-sm font-medium truncate">{u.name}</span>
                        {u.userId === currentUser?.id && (
                          <Crown size={12} className="text-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">Online now</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-100">Create a new room</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            <input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
              placeholder="e.g. Night Owls Study Group"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500/50 mb-4"
              autoFocus
            />

            <button
              onClick={handleCreateRoom}
              disabled={creating || !newRoomName.trim()}
              className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-sm font-medium text-white"
            >
              {creating ? "Creating..." : "Create Room"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
