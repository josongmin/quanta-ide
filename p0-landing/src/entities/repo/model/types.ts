export interface RepoMeta { k: string; v: string; }
export interface RepoData {
  color: string; desc: string; stack: string[]; meta: RepoMeta[];
  scenario: string; seeds: string[]; tree: string;
}
