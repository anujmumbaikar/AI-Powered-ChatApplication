"use client";

import { useParams } from "next/navigation";
import { AuthenticatedApp } from "@/components/Authenticated-app";
import { User } from "stream-chat";

const USER_STORAGE_KEY = "chat-ai-app-user";

export default function ChatPage() {
  const params = useParams();
  const channelId = params?.channelId as string | undefined;

  // Load the stored user from localStorage
  let user: User | null = null;
  if (typeof window !== "undefined") {
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (savedUser) {
      user = JSON.parse(savedUser);
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-lg text-muted-foreground">
          Please log in to access this chat.
        </p>
      </div>
    );
  }

  return <AuthenticatedApp user={user} onLogout={() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    window.location.href = "/";
  }} />;
}
