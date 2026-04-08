"use client";

import { useEffect, useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useModalStore } from "@/app/stores/useModalStore";
import { useRepoStore } from "@/app/stores/useRepoStore";
import { REPOS, type RepoName } from "@/entities/repo/model/data";
import { RepoMetaGrid } from "@/entities/repo/ui/RepoMetaGrid";
import { RepoTree } from "@/entities/repo/ui/RepoTree";
import { RepoSeedChip } from "@/entities/repo/ui/RepoSeedChip";
import { RepoTabs } from "./RepoTabs";

export function RepoModal() {
  const { isRepoModalOpen, closeRepoModal } = useModalStore();
  const { current, setCurrent, getData } = useRepoStore();
  const [localRepo, setLocalRepo] = useState<RepoName>(current);

  useEffect(() => {
    if (isRepoModalOpen) setLocalRepo(current);
  }, [isRepoModalOpen, current]);

  const handleTab = useCallback(
    (name: RepoName) => {
      setLocalRepo(name);
      setCurrent(name);
    },
    [setCurrent],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRepoModal();
    };
    if (isRepoModalOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isRepoModalOpen, closeRepoModal]);

  const data = REPOS[localRepo];

  return (
    <AnimatePresence>
      {isRepoModalOpen && (
        <motion.div
          className="fixed inset-0 z-60 flex items-center justify-center font-sans"
          style={
            {
              "--accent": data.color,
              "--ink": "#0a0a14",
              "--ink-2": "#4b4b5a",
              "--ink-3": "#8a8a99",
              "--line": "#ececf2",
              "--line-2": "#f3f3f8",
              "--paper": "#ffffff",
              "--paper-2": "#fafafc",
            } as React.CSSProperties
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          {/* backdrop */}
          <motion.div
            className="absolute inset-0 bg-[rgba(8,6,18,0.55)] backdrop-blur-md"
            onClick={closeRepoModal}
          />

          {/* shell */}
          <motion.div
            className="relative w-[min(820px,calc(100vw-40px))] max-h-[calc(100vh-56px)] overflow-hidden rounded-2xl bg-white shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
            initial={{ y: 10, scale: 0.985 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 10, scale: 0.985 }}
            transition={{ duration: 0.26, ease: [0.2, 0.85, 0.2, 1] }}
          >
            <div className="flex max-h-[calc(100vh-56px)] flex-col gap-5 overflow-y-auto overflow-x-hidden p-8 pb-7 text-[var(--ink)]">
              {/* close */}
              <button
                type="button"
                onClick={closeRepoModal}
                className="absolute right-4 top-4 z-10 flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink-2)] transition hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                aria-label="Close"
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                >
                  <line x1={6} y1={6} x2={18} y2={18} />
                  <line x1={18} y1={6} x2={6} y2={18} />
                </svg>
              </button>

              {/* tabs */}
              <RepoTabs current={localRepo} onChange={handleTab} />

              {/* head */}
              <header className="flex flex-col gap-3 pr-11">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: data.color,
                      boxShadow: `0 0 0 3px color-mix(in srgb, ${data.color} 18%, transparent)`,
                    }}
                  />
                  <h2 className="font-mono text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    {localRepo}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.66rem] font-semibold uppercase tracking-wider text-emerald-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Indexed
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--ink-2)]">
                  {data.desc}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.stack.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[var(--line)] bg-[var(--paper-2)] px-2.5 py-1 text-[0.68rem] font-medium text-[var(--ink-2)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </header>

              {/* meta */}
              <RepoMetaGrid meta={data.meta} />

              {/* body 2-col */}
              <div className="grid grid-cols-[1.05fr_1fr] gap-6 max-md:grid-cols-1">
                {/* left */}
                <div className="flex flex-col gap-2">
                  <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--accent)]">
                    Scenario
                  </span>
                  <p className="text-sm leading-relaxed text-[var(--ink-2)]">
                    {data.scenario}
                  </p>
                  <span className="mt-2 text-[0.6rem] font-bold uppercase tracking-widest text-[var(--accent)]">
                    Try asking
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {data.seeds.map((s) => (
                      <RepoSeedChip key={s} label={s} />
                    ))}
                  </div>
                </div>

                {/* right */}
                <div className="flex flex-col gap-2">
                  <span className="text-[0.6rem] font-bold uppercase tracking-widest text-[var(--accent)]">
                    Structure
                  </span>
                  <RepoTree tree={data.tree} />
                </div>
              </div>

              {/* foot */}
              <div className="flex items-center justify-end border-t border-[var(--line-2)] pt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-px hover:bg-[#18182a] hover:shadow-lg"
                >
                  Run p0 on this repo
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1={5} y1={12} x2={19} y2={12} />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
