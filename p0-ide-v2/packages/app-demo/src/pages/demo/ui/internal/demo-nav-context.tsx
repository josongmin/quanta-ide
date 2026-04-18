import { createContext, useContext } from "react";

export interface DemoNavCtx {
  navigate: (id: string) => void;
}

const DemoNavContext = createContext<DemoNavCtx>({ navigate: () => {} });

export function useDemoNav(): DemoNavCtx {
  return useContext(DemoNavContext);
}

export const DemoNavProvider = DemoNavContext.Provider;
