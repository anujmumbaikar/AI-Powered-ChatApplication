"use client";

import { ReactNode, useCallback } from "react";
import { User } from "stream-chat";
import { Chat, useCreateChatClient } from "stream-chat-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useTheme } from "@/hooks/use-theme";
import axios from "axios";

interface ChatProviderProps {
  user: User;
  children: ReactNode;
}

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

if (!apiKey) {
  throw new Error("Missing NEXT_PUBLIC_STREAM_API_KEY in .env.local file");
}

export const ChatProvider = ({ user, children }: ChatProviderProps) => {
  const { theme } = useTheme();

  // ✅ Token provider to call your backend API
  const tokenProvider = useCallback(async () => {
    if (!user) throw new Error("User not available");

    try {
      const { data } = await axios.post("/api/token", {
        user_id: user.id,
      });
      return data.token;
    } catch (err: any) {
      console.error("Error fetching token:", err.response?.data || err.message);
      throw err;
    }
  }, [user]);

  // ✅ Create Stream client
  const client = useCreateChatClient({
    apiKey,
    tokenOrProvider: tokenProvider,
    userData: user,
  });

  if (!client) {
    return <LoadingScreen />;
  }

  return (
    <Chat
      client={client}
      theme={theme === "dark" ? "str-chat__theme-dark" : "str-chat__theme-light"}
    >
      {children}
    </Chat>
  );
};
