import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd(
  { className = "", children, ...rest },
  ref,
) {
  const cls = `kbd${className ? ` ${className}` : ""}`;
  return (
    <kbd ref={ref} className={cls} {...rest}>
      {children}
    </kbd>
  );
});
