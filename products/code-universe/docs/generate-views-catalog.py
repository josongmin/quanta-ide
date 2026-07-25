#!/usr/bin/env python3
"""Regenerate views-catalog.md and views-catalog.tsv from feature view.tsx files.

Source of truth for rows: any `features/**/view.tsx` that exports a ViewDescriptor
(id, label, category, hint, usecase, tech).
Must match `VIEW_DESCRIPTORS.length` in view-mode/model/view-registry.tsx.
"""

from __future__ import annotations

import csv
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
FEATURES = REPO / "src" / "features"
MD_OUT = Path(__file__).with_name("views-catalog.md")
TSV_OUT = Path(__file__).with_name("views-catalog.tsv")

CATEGORY_ORDER = [
    "ai",
    "arch",
    "deps",
    "explore",
    "history",
    "metrics",
    "quality",
    "refactor",
    "security",
    "team",
]
CATEGORY_BLURB: dict[str, tuple[str, str]] = {
    "ai": ("에이전트/LLM 비용·품질·리스크·라우팅", "AI 도입·에이전트 운영·감사·게이트"),
    "arch": ("경계·API·패키지 구조 건강", "아키텍처 리뷰·MS 분리·레이어 점검"),
    "deps": ("의존성·호출·흐름", "핫픽스 영향, 리팩터 경로, 그래프 탐색"),
    "explore": ("구조/공간 시각으로 온보딩·스캔", "새 팀원, 전체 맵, 유사 모듈 찾기"),
    "history": ("시간 축·진화·공동 변경", "회고, 귀책, 트렌드, 히스토리 리뷰"),
    "metrics": ("정적 지표·테스트·복잡도", "스프린트 품질·핫스팟·릴리즈 점검"),
    "quality": ("DORA/부채/게이트/DevEx", "경영/릴리즈/파이프라인 건강"),
    "refactor": ("객체 지향/중복/시뮬/ROI", "리팩터 백로그·안전한 분리·사전 시뮬"),
    "security": ("취약점·의존성·SBOM", "보안 릴리즈·공급망 감사"),
    "team": ("blame·리뷰·팀 리스크", "담당자, 리뷰 라우팅, 버스 팩터"),
}


def str_field(src: str, key: str) -> str:
    m = re.search(rf'^\s*{re.escape(key)}:\s*"((?:\\.|[^"\\])*)"\s*,', src, re.M)
    if m:
        return m.group(1)
    m = re.search(
        rf"^\s*{re.escape(key)}:\s*\n\s*\"((?:\\.|[^\"\\])*)\"\s*,", src, re.M | re.S
    )
    if m:
        return m.group(1)
    return ""


def md_escape(s: str) -> str:
    return s.replace("|", "\\|")


def collect_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for f in sorted(FEATURES.glob("**/view.tsx")):
        t = f.read_text(encoding="utf-8")
        if "ViewDescriptor" not in t:
            continue
        bid = str_field(t, "id")
        if not bid:
            m = re.search(r'\bid:\s*"([^"]+)"', t)
            bid = m.group(1) if m else ""
        if not bid:
            continue
        rows.append(
            {
                "relpath": str(f.relative_to(REPO)),
                "id": bid,
                "label": str_field(t, "label") or "—",
                "category": str_field(t, "category") or "—",
                "hint": str_field(t, "hint") or "—",
                "usecase": str_field(t, "usecase") or "—",
                "tech": str_field(t, "tech") or "—",
            }
        )
    return rows


def sort_categories(cats: set[str]) -> list[str]:
    ordered = [c for c in CATEGORY_ORDER if c in cats]
    rest = sorted(c for c in cats if c not in CATEGORY_ORDER)
    return ordered + rest


def build_markdown(rows: list[dict[str, str]], today: str) -> str:
    n = len(rows)
    by: dict[str, list[dict[str, str]]] = defaultdict(list)
    for r in rows:
        by[r["category"]].append(r)
    cat_order = sort_categories(set(by.keys()))

    parts: list[str] = [
        f"# Code Universe — 분석 뷰 카탈로그 ({n})\n\n",
        f"**자동 생성** (`docs/generate-views-catalog.py`) — {today}.  \n"
        f"**행 소스:** 각 feature `view.tsx`의 `ViewDescriptor` 필드 — "
        f"`hint`(목적), `usecase`(언제/의도), `tech`(기반).  \n"
        f"**개수**는 `view-mode/model/view-registry.tsx`의 `VIEW_DESCRIPTORS`와 일치해야 합니다.  \n"
        f"**참고:** `features/code-city/view.tsx`는 3D 씬 전용(Descriptor 없음)이며, "
        f"캔버스 모드 `code-city-3d`는 `code-city-3d/view.tsx`에 있습니다.\n\n",
        "## 카테고리 요약\n\n",
        "| 카테고리 | 개수 | 한 줄 목적 | 주로 쓰는 시점 |\n",
        "|---|---:|---|---|\n",
    ]
    for c in cat_order:
        b = CATEGORY_BLURB.get(c, ("(카테고리)", "(상황)"))
        parts.append(
            f"| {c} | {len(by[c])} | {b[0]} | {b[1]} |\n"
        )
    parts.append("\n---\n\n")
    for c in cat_order:
        parts.append(f"## {c} ({len(by[c])})\n\n")
        parts.append(
            "| id | label | 목적 (hint) | 언제 사용 (usecase) | 기반/데이터 (tech) |\n"
        )
        parts.append("|---|---|---|---|---|\n")
        for r in sorted(by[c], key=lambda x: x["id"]):
            parts.append(
                f"| `{r['id']}` | {md_escape(r['label'])} | {md_escape(r['hint'])} | "
                f"{md_escape(r['usecase'])} | {md_escape(r['tech'])} |\n"
            )
        parts.append("\n")
    return "".join(parts)


def main() -> int:
    rows = collect_rows()
    today = date.today().isoformat()

    tsv_cats = sort_categories({r["category"] for r in rows})
    with TSV_OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(["category", "id", "label", "hint", "usecase", "tech", "source_relpath"])
        for c in tsv_cats:
            for r in sorted(
                (x for x in rows if x["category"] == c), key=lambda x: x["id"]
            ):
                w.writerow(
                    [c, r["id"], r["label"], r["hint"], r["usecase"], r["tech"], r["relpath"]]
                )

    MD_OUT.write_text(build_markdown(rows, today), encoding="utf-8")
    print(f"Wrote {len(rows)} rows -> {MD_OUT} , {TSV_OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
