import "./agent-page.css";
import { useAgentChat } from "../model/use-agent-chat";
import { AgentSessionSidebar } from "./AgentSessionSidebar";
import { AgentChatArea } from "./AgentChatArea";
import { AgentSourcePanel } from "./AgentSourcePanel";

export function AgentPage() {
  const chat = useAgentChat();

  return (
    <div className="agent-page">
      <AgentSessionSidebar
        grouped={chat.grouped}
        activeSessionId={chat.activeSessionId}
        onSelectSession={chat.setActiveSessionId}
        onNewSession={chat.handleNewSession}
      />

      <AgentChatArea
        activeSession={chat.activeSession}
        messages={chat.messages}
        input={chat.input}
        streaming={chat.streaming}
        rightOpen={chat.rightOpen}
        messagesEndRef={chat.messagesEndRef}
        onInputChange={chat.setInput}
        onSend={() => chat.handleSend()}
        onToggleRight={() => chat.setRightOpen((v) => !v)}
      />

      {chat.rightOpen && (
        <AgentSourcePanel
          activeSession={chat.activeSession}
          selectedPath={chat.selectedPath}
          onSelectPath={chat.setSelectedPath}
        />
      )}
    </div>
  );
}
