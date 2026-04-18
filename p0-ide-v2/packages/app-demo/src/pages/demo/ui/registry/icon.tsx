import type { ComponentType, ReactNode } from "react";

const ICON_SIZE = 15;
const ICON_STROKE = 1.5;

export const iconOf = (
  Cmp: ComponentType<{ size?: number; strokeWidth?: number }>,
): ReactNode => <Cmp size={ICON_SIZE} strokeWidth={ICON_STROKE} />;
