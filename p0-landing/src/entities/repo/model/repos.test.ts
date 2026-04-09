import { describe, it, expect } from "vitest";
import { REPOS, REPO_NAMES } from "./repos";

describe("repos data", () => {
  it("REPO_NAMES has entries", () => {
    expect(REPO_NAMES.length).toBeGreaterThan(0);
  });

  it("every REPO_NAME maps to a valid repo", () => {
    for (const name of REPO_NAMES) {
      const repo = REPOS[name];
      expect(repo).toBeDefined();
      expect(repo.kind).toBeTruthy();
      expect(repo.language).toBeTruthy();
      expect(repo.meta.length).toBeGreaterThan(0);
      expect(repo.questions.length).toBeGreaterThan(0);
      expect(repo.signals.length).toBeGreaterThan(0);
      expect(repo.tree).toBeTruthy();
    }
  });

  it("each question has required fields", () => {
    for (const name of REPO_NAMES) {
      for (const q of REPOS[name].questions) {
        expect(q.ask).toBeTruthy();
        expect(q.answerTitle).toBeTruthy();
        expect(q.answerSummary).toBeTruthy();
        expect(q.answerBullets.length).toBeGreaterThan(0);
        expect(q.stats.length).toBeGreaterThan(0);
        expect(q.artifacts.length).toBeGreaterThan(0);
      }
    }
  });
});
