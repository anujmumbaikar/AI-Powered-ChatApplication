import { AIAgent } from "@/types/types";

export const aiAgentCache = new Map<string, AIAgent>();
export const pendingAiAgents = new Set<string>();

export const inactivityThreahold = 480 * 60 * 1000;

