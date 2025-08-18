"use client";

import { useState, useEffect } from "react";
import { Login } from "@/components/login";
import { User } from "stream-chat";
import { AuthenticatedApp } from "@/components/Authenticated-app";

const USER_STORAGE_KEY = "chat-ai-app-user";

export default function Page() {
  const [user, setUser] = useState<User | null>(null);

  // ✅ Load user from localStorage on mount (client-side only)
  useEffect(() => {
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleUserLogin = (authenticatedUser: User) => {
    const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${authenticatedUser.name}`;
    const userWithImage = {
      ...authenticatedUser,
      image: avatarUrl,
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userWithImage));
    setUser(userWithImage);
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  };

  return (
    <div className="h-screen bg-background">
      {user ? (
        <AuthenticatedApp user={user} onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleUserLogin} />
      )}
    </div>
  );
}
