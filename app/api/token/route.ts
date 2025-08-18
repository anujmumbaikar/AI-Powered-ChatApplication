import { aiAgentCache, pendingAiAgents } from "@/agents/AIAgentInstance";
import { serverClient } from "@/serverClient";
import { AIAgent } from "@/types/types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req:NextRequest){
    try {
        const {user_id} = await req.json();
        if(!user_id) {
            return NextResponse.json({error: "User ID is required"}, {status: 400});
        }
        const issueAt = Math.floor(Date.now() / 1000);
        const expiration = issueAt + 60 * 60; // 1 hour expiration

        const token = serverClient.createToken(user_id,expiration, issueAt);        
        return NextResponse.json({token});
    } catch (error) {
        console.error("Error creating token:", error);
        return NextResponse.json({error: "Failed to create token"}, {status: 500});
    }
}