import axios from "axios";
import { OpenAI } from "openai";
import type { AssistantStream } from "openai/lib/AssistantStream";

import type { Channel, Event, MessageResponse, StreamChat } from "stream-chat";

export class OpenAIResponseHandler {
  private message_text = "";
  private chunk_counter = 0;
  private run_id = "";
  private is_done = false;
  private last_update_time = 0;

  constructor(
    private readonly openai: OpenAI,
    private readonly openai_thread: OpenAI.Beta.Threads.Thread,
    private readonly assistant_stream: AssistantStream,
    private readonly chatClient: StreamChat,
    private readonly channel: Channel,
    private readonly message: MessageResponse,
    private readonly onDispose: () => void
  ) {
    this.chatClient.on("ai_indicator.stop", this.handleStopGenerating);
  }

  private handleStopGenerating = async (event: Event) => {
    if (this.is_done || event.message_id != this.message.id) return;
    console.log("Stop generating message");
    if (!this.openai || !this.openai_thread || !this.run_id) return;

    try {
      await this.openai.beta.threads.runs.cancel(this.run_id, {
        thread_id: this.openai_thread.id,
      });
    } catch (error) {
      console.error("Error cancelling OpenAI thread run:", error);
    }

    await this.channel.sendEvent({
      type: "ai_indicator.clear",
      cid: this.channel.cid,
      message_id: this.message.id,
    });
    await this.dispose();
  };

  private handleStreamEvent = async (
    event: OpenAI.Beta.Assistants.AssistantStreamEvent
  ) => {
    const { cid, id } = this.message;
    if (event.event === "thread.run.created") {
      this.run_id = event.data.id;
    } else if (event.event === "thread.message.delta") {
      const textDelta = event.data.delta.content?.[0];
      if (textDelta?.type === "text" && textDelta.text) {
        this.message.text += textDelta.text.value || "";
        const now = Date.now();
        if (now - this.last_update_time > 1000) {
          this.chatClient.partialUpdateMessage(id, {
            set: {
              text: this.message.text,
              message: this.message.text,
            },
          });
          this.last_update_time = now;
        }
        this.chunk_counter++;
      }
    } else if (event.event === "thread.message.completed") {
      this.chatClient.partialUpdateMessage(id, {
        set: {
          text:
            event.data.content[0].type === "text"
              ? event.data.content[0].text.value
              : this.message_text,
          message: this.message.text,
        },
      });
      this.channel.sendEvent({
        type: "ai_indicator.clear",
        cid: cid,
        message_id: id,
      });
    } else if (event.event === "thread.run.step.created") {
      if (event.data.step_details.type === "message_creation") {
        this.channel.sendEvent({
          type: "ai_indicator.update",
          ai_message: "AI_STATE_GENERATING",
          cid: cid,
          message_id: id,
        });
      }
    }
  };

  private handleError = async (error: Error) => {
    if (this.is_done) return;

    await this.channel.sendEvent({
      type: "ai_indicator.update",
      ai_state: "AI_STATE_ERROR",
      cid: this.channel.cid,
      message_id: this.message.id,
    });
    await this.chatClient.partialUpdateMessage(this.message.id, {
      set: {
        text: `Error: ${error.message}`,
        message: error.toString(),
      },
    });
    await this.dispose();
  };

  private performWebSearch = async (query: string): Promise<string> => {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_API_KEY) {
      throw new Error("TAVILY_API_KEY is not set in environment variables.");
    }
    console.log("performing web search for query:", query);
    try {
      const res = await axios.post("https://api.tavily.com/v1/search", {
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query: query,
          Search_depth: "advanced",
          max_results: 5,
          include_answers: true,
          include_raw_content: false,
        }),
      });
      if (res.status < 200 || res.status >= 300) {
        return JSON.stringify({
          error: `Web search failed with status code ${res.status}`,
          status: res.status,
        });
      }
      console.log(`Tavily seach successful for query: ${query}`);
      return JSON.stringify({
        results: res.data,
        status: res.status,
      });
    } catch (error) {
      console.error("Error performing web search:", error);
      return JSON.stringify({
        error: "Web search failed",
        status: 500,
      });
    }
  };

  run = async () => {
    const { cid, id: message_id } = this.message;
    let isCompleted = false;
    let toolOutputs: any[] = [];
    let currentStream: AssistantStream = this.assistant_stream;

    try {
      while (!isCompleted) {
        for await (const event of currentStream) {
          await this.handleStreamEvent(event);

          if (
            event.event === "thread.run.requires_action" &&
            event.data.required_action?.type === "submit_tool_outputs"
          ) {
            this.run_id = event.data.id;
            await this.channel.sendEvent({
              type: "ai_indicator.update",
              ai_state: "AI_STATE_EXTERNAL_SOURCES",
              cid,
              message_id,
            });

            const toolCalls =
              event.data.required_action.submit_tool_outputs.tool_calls;
            toolOutputs = [];

            for (const toolCall of toolCalls) {
              if (toolCall.function.name === "web_search") {
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  const searchResult = await this.performWebSearch(args.query);
                  toolOutputs.push({
                    tool_call_id: toolCall.id,
                    output: searchResult,
                  });
                } catch {
                  toolOutputs.push({
                    tool_call_id: toolCall.id,
                    output: JSON.stringify({ error: "Web search failed" }),
                  });
                }
              }
            }
            break;
          }

          if (event.event === "thread.run.completed") {
            isCompleted = true;
            break;
          }

          if (event.event === "thread.run.failed") {
            isCompleted = true;
            await this.handleError(
              new Error(event.data.last_error?.message || "Run failed")
            );
            break;
          }
        }

        if (toolOutputs.length > 0) {
          currentStream = this.openai.beta.threads.runs.submitToolOutputsStream(
            this.run_id,
            { thread_id: this.openai_thread.id, tool_outputs: toolOutputs }
          );
          toolOutputs = [];
        }
      }
    } catch (error) {
      console.error("An error occurred during the run:", error);
      await this.handleError(error as Error);
    } finally {
      await this.dispose();
    }
  };

  dispose = () => {
    if (this.is_done) return;
    this.is_done = true;
    this.chatClient.off("ai_indicator.stop", this.handleStopGenerating);
    this.onDispose();
  };
}
