export interface RepoMeta { k: string; v: string; }

export interface RepoQuestion {
  ask: string;
  answerTitle: string;
  answerSummary: string;
  answerBullets: string[];
  stats: RepoMeta[];
  artifacts: string[];
}

export interface RepoData {
  color: string;
  kind: string;
  language: string;
  desc: string;
  stack: string[];
  meta: RepoMeta[];
  pain: string;
  outcome: string;
  signals: string[];
  questions: RepoQuestion[];
  tree: string;
  // incident-specific (optional)
  incident?: true;
  cve?: string;
  severity?: string;
  date?: string;
  impact?: string;
}

export interface IncidentData {
  color: string;
  kind: string;
  language: string;
  cve: string;
  severity: string;
  date: string;
  repo: string;
  desc: string;
  impact: string;
  howP0Catches: string;
  signals: string[];
  meta: RepoMeta[];
  questions: RepoQuestion[];
  tree: string;
}
