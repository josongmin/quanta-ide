import {
  IconMessageSquare,
  IconSearch,
  IconBranch,
  IconDiffStat,
  IconFile,
} from "@/shared/ui/icons/icons";

const SESSION_TYPES = [
  { id: "chat",       label: "Chat",        icon: IconMessageSquare, desc: "코드베이스에 대해 질문" },
  { id: "trace",      label: "Trace",       icon: IconSearch,        desc: "실행 경로 추적" },
  { id: "review",     label: "Review",      icon: IconDiffStat,      desc: "변경사항 리뷰" },
  { id: "impact",     label: "Impact",      icon: IconBranch,        desc: "변경 영향도 분석" },
  { id: "explain",    label: "Explain",     icon: IconFile,          desc: "코드 설명 & 문서화" },
] as const;

interface SessionPickerProps {
  onSelect: (type: string) => void;
}

export function SessionPicker({ onSelect }: SessionPickerProps) {
  return (
    <div className="agw-picker">
      <div className="agw-picker-grid">
        {SESSION_TYPES.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            type="button"
            className="agw-picker-card"
            onClick={() => { onSelect(id); }}
          >
            <span className="agw-picker-icon">
              <Icon size={20} strokeWidth={1.5} />
            </span>
            <span className="agw-picker-label">{label}</span>
            <span className="agw-picker-desc">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
