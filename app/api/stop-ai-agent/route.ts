import { aiAgentCache, pendingAiAgents } from "@/agents/AIAgentInstance";
import { serverClient } from "@/serverClient";
import { AIAgent } from "@/types/types";
import { NextRequest, NextResponse } from "next/server";

async function disposeAiAgent(aiAgent: AIAgent) {
  await aiAgent.dispose();
  if (!aiAgent.user) {
    return;
  }
  await serverClient.deleteUser(aiAgent.user.id, {
    hard_delete: true,
  });
}

export async function POST(req: NextRequest) {
    try {
        const {channel_id} = await req.json();
        console.log(`Stopping AI agent for channel: ${channel_id}`);
        const user_id = `ai-bot-${channel_id.replace(/[!]/g, "")}`;

        const aiAgent = aiAgentCache.get(user_id);
        if(aiAgent){
            console.log(`Stopping AI agent for user: ${user_id}`);
            await disposeAiAgent(aiAgent);
            aiAgentCache.delete(user_id);
        }else{
            console.log(`No AI agent found for user: ${user_id}`);
        }
        return NextResponse.json({ success: true, message: "AI agent stopped successfully." });
    } catch (error) {
        console.log(`Error stopping AI agent: ${error}`);
        return NextResponse.json({ success: false, message: "Failed to stop AI agent." }, { status: 500 });
        
    }
}