import { createContext, useContext } from "react";
import type { ShellAPI } from "./shell-api";

const ShellContext = createContext<ShellAPI | null>(null);

export const ShellProvider = ShellContext.Provider;

export function useShell(): ShellAPI {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellProvider");
  return ctx;
}
