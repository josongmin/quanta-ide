import type { Toast } from "@quanta/shell-contract";
import "./toast.css";
export interface ToastHostProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}
/** Pure presentational toast renderer. Store subscription lives in the shell. */
export declare function ToastHost({ toasts, onDismiss }: ToastHostProps): import("react").ReactPortal | null;
