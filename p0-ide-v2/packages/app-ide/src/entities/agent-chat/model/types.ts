export interface AgentMsg {
  id: string;
  role: "user" | "agent";
  text: string;
  streaming: boolean;
  elapsed?: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  file?: string;
  status: "done" | "running";
}

export interface AgentSession {
  id: string;
  title: string;
  messages: AgentMsg[];
}
