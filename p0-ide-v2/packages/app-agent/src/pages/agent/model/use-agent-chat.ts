import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  PROJECTS,
  CHANGED_FILES,
  createInitialSessions,
  pickResponse,
  makeId,
  STREAM_SPEED,
  type ChatMessage,
  type ChatSession,
} from "@quanta/app-agent/entities/agent";

export function useAgentChat() {
  const [sessions, setSessions] = useState<ChatSession[]>(createInitialSessions);
  const [activeSessionId, setActiveSessionId] = useState("s8");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string>(CHANGED_FILES[0].path);
  const selectedFile = CHANGED_FILES.find((f) => f.path === selectedPath) ?? CHANGED_FILES[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamAbort = useRef(false);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession?.messages ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, ChatSession[]>();
    for (const p of PROJECTS) map.set(p.id, []);
    for (const s of sessions) {
      if (!map.has(s.projectId)) map.set(s.projectId, []);
      map.get(s.projectId)!.push(s);
    }
    return map;
  }, [sessions]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const streamResponse = useCallback((sessionId: string, fullText: string) => {
    setStreaming(true);
    streamAbort.current = false;
    const agentMsgId = makeId();

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, { id: agentMsgId, role: "agent" as const, text: "", streaming: true }] }
          : s,
      ),
    );

    let charIdx = 0;
    const tick = () => {
      if (streamAbort.current) {
        setStreaming(false);
        return;
      }
      charIdx += 1 + Math.floor(Math.random() * 2);
      if (charIdx >= fullText.length) charIdx = fullText.length;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === agentMsgId
                    ? { ...m, text: fullText.slice(0, charIdx), streaming: charIdx < fullText.length }
                    : m,
                ),
              }
            : s,
        ),
      );

      if (charIdx < fullText.length) {
        setTimeout(tick, STREAM_SPEED + Math.random() * 8);
      } else {
        setStreaming(false);
      }
    };
    setTimeout(tick, 300 + Math.random() * 400);
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: ChatMessage = { id: makeId(), role: "user", text };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              title: s.messages.length === 0 ? text.slice(0, 50) : s.title,
              time: "just now",
              messages: [...s.messages, userMsg],
            }
          : s,
      ),
    );

    setTimeout(() => {
      streamResponse(activeSessionId, pickResponse(text));
    }, 100);
  }, [input, streaming, activeSessionId, streamResponse]);

  const handleNewSession = useCallback(() => {
    const id = `s-${makeId()}`;
    const newSession: ChatSession = {
      id,
      projectId: activeSession?.projectId ?? "home",
      title: "New chat",
      time: "now",
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    setInput("");
  }, [activeSession?.projectId]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    input,
    setInput,
    streaming,
    rightOpen,
    setRightOpen,
    selectedPath,
    setSelectedPath,
    selectedFile,
    messagesEndRef,
    activeSession,
    messages,
    grouped,
    handleSend,
    handleNewSession,
  };
}
