import { useCallback, useState } from "react";
import { getAiService } from "../../lib/ai-service-ref";
import { renderSettingsStore, useRenderSettings } from "../../store/render-settings-store";

// Natural-language filter input (ai.naturalLanguageFilter).
// -------------------------------------------------------------------
// A sibling to FilterDslInput: the user types plain English, we call
// the AiService to translate to DSL, and write the result into the
// same edgeFilterQuery the DSL input edits. Explanation + confidence
// are shown underneath after submission so the translation is visible.
//
// Gating: the caller (SceneSection) is responsible for mounting /
// unmounting this component behind `useFeature("ai.naturalLanguageFilter")`.
// Keeps this file focused on UI state + the AI roundtrip.

export interface NlFilterInputProps {
  edgeKinds: string[];
  edgeLayers: string[];
  fileIds: string[];
  onSwitchToDsl?: () => void;
}

interface LastResult {
  query: string;
  dsl: string;
  confidence: number;
  explanation: string;
}

export function NlFilterInput({ edgeKinds, edgeLayers, fileIds, onSwitchToDsl }: NlFilterInputProps) {
  // Keep our own input value — we don't want every keystroke to thrash
  // the edge filter; translation happens on Enter / submit.
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<LastResult | null>(null);
  const currentDsl = useRenderSettings(s => s.edgeFilterQuery);

  const submit = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const svc = getAiService();
      const result = await svc.naturalLanguageToDsl(trimmed, {
        edgeKinds,
        edgeLayers,
        files: fileIds,
      });
      renderSettingsStore.setEdgeFilterQuery(result.dsl);
      setLast({
        query: trimmed,
        dsl: result.dsl,
        confidence: result.confidence,
        explanation: result.explanation,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [draft, edgeKinds, edgeLayers, fileIds]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.preventDefault();
      onSwitchToDsl?.();
    }
  };

  return (
    <div className="ws-debug__filter-wrap">
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="text"
          className="ws-debug__input"
          value={draft}
          placeholder="자연어로 질문... (⌘/ 로 DSL 전환)"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          spellCheck={false}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => void submit()}
          disabled={loading || draft.trim().length === 0}
          title="DSL 로 변환"
        >
          {loading ? "…" : "질문"}
        </button>
      </div>
      {error && (
        <div className="ws-debug__err" style={{ color: "#f87171", fontSize: 10, marginTop: 2 }}>
          {error}
        </div>
      )}
      {last && !loading && (
        <div style={{ marginTop: 4, fontSize: 10, opacity: 0.85 }}>
          <div>
            <span style={{ opacity: 0.7 }}>DSL: </span>
            <code>{last.dsl || "(비어 있음)"}</code>
          </div>
          <div>
            <span style={{ opacity: 0.7 }}>신뢰도: </span>
            <span style={{ color: last.confidence >= 0.7 ? "#22c55e" : "#eab308" }}>
              {(last.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ opacity: 0.75 }}>{last.explanation}</div>
          {last.dsl !== currentDsl && (
            <div style={{ opacity: 0.6 }}>(이후 DSL 이 편집됨)</div>
          )}
        </div>
      )}
      <div className="ws-debug__hint" style={{ fontSize: 10, opacity: 0.6 }}>
        예: "DB 로 흐르는 오염", "auth 의 안전성 엣지", "심각도 높음"
      </div>
    </div>
  );
}
