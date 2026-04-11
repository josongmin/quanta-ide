import { useToast } from "../model/useToast";

export function Toast() {
  const { message, visible } = useToast();
  if (!visible) return null;

  return (
    <div className="ide-toast">
      <span className="ide-toast-icon">✓</span>
      <span className="ide-toast-msg">{message}</span>
    </div>
  );
}
