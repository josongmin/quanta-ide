import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { TextInput } from "@/shared/ui";
import { IconChevron, IconPlus, IconSend } from "./icons";

const SUGGESTIONS = [
  "Who actually owns refund state?",
  "What breaks if webhook ordering changes?",
  "Show me the blast radius of db.update",
];

export interface AgentPanelInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => Promise<void>;
  typing: boolean;
  messageCount: number;
}

export function AgentPanelInput({ input, onInputChange, onSend, typing, messageCount }: AgentPanelInputProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* suggestion chips */}
      {messageCount <= 2 && !typing && (
        <div className="agw-suggestions">
          {SUGGESTIONS.slice(0, 2).map((s) => (
            <button key={s} type="button" className="agw-suggestion-chip" onClick={() => { void onSend(s); }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* input row — floating */}
      <div className="agw-input-wrap">
        <div className="agw-input-outer">
          <TextInput
            ref={inputRef}
            variant="minimal"
            className="agw-input"
            placeholder=""
            value={input}
            onChange={(e) => { onInputChange(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") { void onSend(input); } }}
          />
          <div className="agw-input-toolbar">
            <div className="agw-input-toolbar-left">
              <button type="button" className="agw-toolbar-btn" aria-label={t("ide.agent.add")}><IconPlus /></button>
              <button type="button" className="agw-toolbar-model" aria-label={t("ide.agent.selectModel")}>
                p0 <IconChevron />
              </button>
              <button type="button" className="agw-toolbar-model" aria-label={t("ide.agent.analysisDepth")}>
                Deep <IconChevron />
              </button>
            </div>
            <button
              type="button"
              className="agw-send-btn"
              onClick={() => { void onSend(input); }}
              disabled={!input.trim() || typing}
            >
              <IconSend />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
