export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  streaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  time: string;
  projectId: string;
  branch?: string;
  messages: ChatMessage[];
}

export interface Project {
  id: string;
  label: string;
  kind: "repo" | "home";
}

export interface DiffLine {
  kind: "add" | "del" | "ctx" | "hunk";
  old?: number;
  new?: number;
  text: string;
}

export interface ChangedFile {
  path: string;
  badge: string;
  tag: string;
  isNew?: boolean;
  diff: DiffLine[];
}
