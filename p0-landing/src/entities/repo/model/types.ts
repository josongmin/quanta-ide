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
}
