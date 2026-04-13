import { useEffect, useRef } from "react";
import type { ChatMsg } from "../model/types";
import { MsgPart } from "./MsgPart";

export interface AgentPanelChatProps {
  messages: ChatMsg[];
  typing: boolean;
}

export function AgentPanelChat({ messages, typing }: AgentPanelChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  return (
    <div className="agw-chat-body">
      {messages.map((msg) => (
        <div key={msg.id} className={`agw-msg is-${msg.role}`}>
          <div className="agw-msg-role">{msg.role === "agent" ? "p0" : "You"}</div>
          <div className="agw-msg-bubble">
            {msg.parts.map((part, i) => <MsgPart key={i} part={part} />)}
          </div>
        </div>
      ))}

      {typing && (
        <div className="agw-msg is-agent">
          <div className="agw-msg-role">p0</div>
          <div className="agw-typing">
            <div className="agw-typing-dot" />
            <div className="agw-typing-dot" />
            <div className="agw-typing-dot" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
