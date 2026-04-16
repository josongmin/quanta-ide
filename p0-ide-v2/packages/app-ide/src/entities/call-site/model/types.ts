import type { TaintPath } from "@quanta/app-ide/entities/taint";

export interface CallSiteFacts {
  line: number;
  callee: string;
  calleeFile: string;
  taintPath?: TaintPath;
  effects?: string[];
  async?: boolean;
}
