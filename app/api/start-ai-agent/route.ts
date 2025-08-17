import { NextResponse } from "next/server";
import { createAgent } from "@/agents/createAgent";
import { AgentPlatform, AIAgent } from "@/types/types"
import { apikey,serverClient } from "@/serverClient";
import { aiAgentCache, pendingAiAgents } from "@/agents/AIAgentInstance";


export async function POST(req: Request) {
  let user_id: string | undefined;
  try {
    const { channel_id, channel_type = "messaging" } = await req.json();
    console.log(`[API] /start-ai-agent called for channel: ${channel_id}`);
    if (!channel_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    user_id = `ai-bot-${channel_id.replace(/[!]/g, "")}`;

    if (!aiAgentCache.has(user_id) && !pendingAiAgents.has(user_id)) {
      pendingAiAgents.add(user_id);

      await serverClient.upsertUser({
        id: user_id,
        name: "AI Writing Assistant",
      });

      const channel = serverClient.channel(channel_type, channel_id);
      await channel.addMembers([user_id]);

      const agent = await createAgent(
        user_id,
        AgentPlatform.OPENAI,
        channel_type,
        channel_id
      );
      await agent.init();

      if(aiAgentCache.has(user_id)) {
        await agent.dispose();
      }else{
        aiAgentCache.set(user_id, agent);
      }
    }else{
      console.log(`[API] AI Agent for ${user_id} already exists or is pending.`);
    }
    return NextResponse.json({ data: [], message: "AI Agent started" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to start AI Agent", reason: error.message },
      { status: 500 }
    );
  } finally {
    if (user_id) {
      pendingAiAgents.delete(user_id);
    }
  }
}
