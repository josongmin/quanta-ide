import { useState, useRef, useEffect, useCallback } from "react";
import type { AgentMsg, AgentSession } from "@quanta/app-ide/entities/agent-chat";
import {
  STREAM_SPEED,
  makeId,
  pickResponse,
  mockToolCalls,
} from "@quanta/app-ide/entities/agent-chat";

function createSession(title = "New chat"): AgentSession {
  return { id: makeId(), title, messages: [] };
}

function titleFromFirstMsg(text: string): string {
  const trimmed = text.slice(0, 28);
  return trimmed.length < text.length ? `${trimmed}...` : trimmed;
}

export function useAgentChat() {
  const [sessions, setSessions] = useState<AgentSession[]>(() => [createSession()]);
  const [activeId, setActiveId] = useState(() => sessions[0].id);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const messages = activeSession.messages;

  const scrollToEnd = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToEnd, [messages, scrollToEnd]);

  const updateSessionMessages = useCallback(
    (sessionId: string, updater: (msgs: AgentMsg[]) => AgentMsg[]) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, messages: updater(s.messages) } : s)),
      );
    },
    [],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const sid = activeId;
    const userMsg: AgentMsg = { id: makeId(), role: "user", text, streaming: false };
    const agentId = makeId();
    const fullResponse = pickResponse();
    const tools = mockToolCalls();
    const startTime = Date.now();

    // Set title from first message
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sid) return s;
        const title = s.messages.length === 0 ? titleFromFirstMsg(text) : s.title;
        return {
          ...s,
          title,
          messages: [
            ...s.messages,
            userMsg,
            { id: agentId, role: "agent", text: "", streaming: true, toolCalls: tools },
          ],
        };
      }),
    );
    setStreaming(true);

    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      if (idx >= fullResponse.length) {
        clearInterval(timer);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        updateSessionMessages(sid, (msgs) =>
          msgs.map((m) =>
            m.id === agentId ? { ...m, text: fullResponse, streaming: false, elapsed } : m,
          ),
        );
        setStreaming(false);
        queueMicrotask(() => inputRef.current?.focus());
        return;
      }
      updateSessionMessages(sid, (msgs) =>
        msgs.map((m) => (m.id === agentId ? { ...m, text: fullResponse.slice(0, idx) } : m)),
      );
    }, STREAM_SPEED);

    return () => clearInterval(timer);
  }, [input, streaming, activeId, updateSessionMessages]);

  const newSession = useCallback(() => {
    const s = createSession();
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
    setInput("");
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  const closeSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const fresh = createSession();
          next.push(fresh);
        }
        if (activeId === id) {
          setActiveId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [activeId],
  );

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
    setInput("");
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  const fillInput = useCallback((text: string) => {
    setInput(text);
    queueMicrotask(() => inputRef.current?.focus());
  }, []);

  return {
    sessions,
    activeId,
    activeSession,
    messages,
    input,
    streaming,
    endRef,
    inputRef,
    setInput,
    handleSend,
    fillInput,
    newSession,
    closeSession,
    selectSession,
  } as const;
}
