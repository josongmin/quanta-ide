import { useCallback, useEffect, useState } from "react";
import { buildReply } from "../lib/buildReply";
import { postAgentTurn, postAgentOneshot, makeTurnId, DevosError, DEVOS_REPO_PATH, type ExecutionMetadata } from "./devosClient";
import type { ChatMsg, SessionChat } from "./types";

const INITIAL_MESSAGES: ChatMsg[] = [
  {
    id: "init-user",
    role: "user",
    parts: [{ type: "text", text: "Which path can double-refund a customer?" }],
  },
  ...buildReply("double-refund"),
];

export function useAgentSession(
  activeSessionId: string,
  updateSessionTitle: (id: string, title: string) => void,
  serverOnlineRef: React.RefObject<boolean | null>,
) {
  const [sessionChats, setSessionChats] = useState<Record<string, SessionChat>>({
    [activeSessionId]: { messages: INITIAL_MESSAGES, typing: false },
  });
  const [input, setInput] = useState("");

  const currentChat: SessionChat = sessionChats[activeSessionId] ?? { messages: [], typing: false };
  const { messages, typing } = currentChat;

  const setCurrentChat = useCallback((updater: (prev: SessionChat) => SessionChat) => {
    setSessionChats((prev) => {
      const current = prev[activeSessionId] ?? { messages: [], typing: false };
      return { ...prev, [activeSessionId]: updater(current) };
    });
  }, [activeSessionId]);

  // reset input on session switch
  useEffect(() => { queueMicrotask(() => { setInput(""); }); }, [activeSessionId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", parts: [{ type: "text", text }] };
    setCurrentChat((prev) => ({ ...prev, messages: [...prev.messages, userMsg], typing: true }));
    setInput("");

    const isFirstMsg = (sessionChats[activeSessionId] ?? { messages: [] }).messages.filter((m) => m.role === "user").length === 0;
    if (isFirstMsg) updateSessionTitle(activeSessionId, text);

    try {
      let resultText = "";
      let meta: ExecutionMetadata | null = null;

      const turnRes = await postAgentTurn({
        session_id: activeSessionId,
        client_turn_id: makeTurnId(),
        user_message: text,
        repo_path: DEVOS_REPO_PATH,
        execution_mode: "standard",
      });

      const turnStatus = turnRes.status;
      if ((turnStatus.state === "completed" || turnStatus.state === "in_progress") && turnRes.result) {
        resultText = turnRes.result;
        meta = turnRes.metadata;
      } else if (turnStatus.state === "failed" || turnStatus.state === "unavailable") {
        resultText = `[${turnStatus.state}] ${"reason" in turnStatus ? turnStatus.reason : ""}`;
        meta = turnRes.metadata;
      } else {
        const oneshotRes = await postAgentOneshot({
          task: text,
          repo_path: DEVOS_REPO_PATH,
          mode: "fast",
        });
        const os = oneshotRes.status;
        resultText = oneshotRes.result !== "" ? oneshotRes.result : (os.state !== "completed" && os.state !== "in_progress" && "reason" in os ? `[${os.state}] ${os.reason}` : "(결과 없음)");
        meta = oneshotRes.metadata;
      }

      serverOnlineRef.current = true;

      const metricsParts = [{
        type: "metrics" as const,
        items: [
          { label: "EXEC TIME", value: `${meta.execution_time_ms}ms` },
          { label: "LANES OK",  value: `${meta.lanes_succeeded}/${meta.lanes_executed}` },
          ...(meta.lanes_failed > 0 ? [{ label: "FAILED", value: meta.lanes_failed, risk: true }] : []),
        ],
      }];
      const agentMsg: ChatMsg = {
        id: `agent-${Date.now()}`,
        role: "agent",
        parts: [{ type: "text", text: resultText }, ...metricsParts],
      };
      setCurrentChat((prev) => ({ messages: [...prev.messages, agentMsg], typing: false }));
    } catch (err) {
      serverOnlineRef.current = false;
      const fallbackReplies = buildReply(text);
      const notice: ChatMsg = {
        id: `notice-${Date.now()}`,
        role: "agent",
        parts: [{ type: "text", text: `⚠ 서버 연결 실패${err instanceof DevosError ? ` (HTTP ${err.status})` : ""} — 데모 응답으로 대체합니다.` }],
      };
      setCurrentChat((prev) => ({ messages: [...prev.messages, notice, ...fallbackReplies], typing: false }));
    }
  }, [typing, activeSessionId, sessionChats, setCurrentChat, updateSessionTitle, serverOnlineRef]);

  // pending query handoff
  useEffect(() => {
    if (window.__agentPendingQuery) {
      const q = window.__agentPendingQuery;
      window.__agentPendingQuery = undefined;
      const t = setTimeout(() => { void sendMessage(q); }, 50);
      return () => { clearTimeout(t); };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { sessionChats, input, setInput, sendMessage, messages, typing, currentChat };
}
