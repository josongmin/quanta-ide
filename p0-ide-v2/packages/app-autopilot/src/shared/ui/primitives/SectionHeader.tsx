import type { ReactNode } from "react";
import "./section-header.css";

export interface SectionHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}

export function SectionHeader({ eyebrow, title, subtitle, trailing }: SectionHeaderProps) {
  return (
    <div className="ap-section-h">
      <div className="ap-section-h__text">
        {eyebrow != null && <div className="ap-section-h__eyebrow">{eyebrow}</div>}
        <div className="ap-section-h__title">{title}</div>
        {subtitle != null && <div className="ap-section-h__sub">{subtitle}</div>}
      </div>
      {trailing != null && <div className="ap-section-h__trail">{trailing}</div>}
    </div>
  );
}
