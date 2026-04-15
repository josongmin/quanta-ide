import type { Capability, RulesDocMeta, RulesDocument, RulesSection } from "./types";

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;
const SECTION_HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const INLINE_FLAG = /\{([a-z-]+):\s*([^}]+)\}/g;

export function parseRules(raw: string): RulesDocument {
  const { meta, body } = extractFrontmatter(raw);
  const sections = splitSections(body);
  return { meta, sections };
}

function extractFrontmatter(raw: string): { meta: RulesDocMeta; body: string } {
  const match = raw.match(FRONTMATTER);
  if (!match) {
    return {
      meta: { name: "Project Rules", version: 1 },
      body: raw.trimStart(),
    };
  }
  const frontmatter = match[1];
  const body = raw.slice(match[0].length);
  const meta: RulesDocMeta = { name: "Project Rules", version: 1 };
  for (const line of frontmatter.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === "name") meta.name = value;
    else if (key === "version") meta.version = Number(value) || 1;
    else if (key === "scope") meta.scope = value;
  }
  return { meta, body };
}

function splitSections(body: string): RulesSection[] {
  const lines = body.split("\n");
  const sections: RulesSection[] = [];
  let current: { title: string; level: number; lines: string[]; flags: Map<string, string> } | null = null;

  const flush = () => {
    if (!current) return;
    const capabilities: Capability[] = [];
    const flags = current.flags;
    if (flags.has("capability")) {
      for (const raw of flags.get("capability")!.split(",")) {
        const c = raw.trim();
        if (c === "tool-permission" || c === "frontmatter" || c === "scoped") {
          capabilities.push(c);
        }
      }
    }
    if (capabilities.length === 0) capabilities.push("plain");
    sections.push({
      title: current.title,
      level: current.level,
      body: current.lines.join("\n").trim(),
      scope: flags.get("scope"),
      capabilities,
    });
  };

  for (const line of lines) {
    const heading = line.match(SECTION_HEADING);
    if (heading) {
      flush();
      const { title, flags } = extractFlags(heading[2]);
      current = {
        title,
        level: heading[1].length,
        lines: [],
        flags,
      };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return sections;
}

function extractFlags(heading: string): { title: string; flags: Map<string, string> } {
  const flags = new Map<string, string>();
  const cleanTitle = heading.replace(INLINE_FLAG, (_, key, val) => {
    flags.set(String(key), String(val).trim());
    return "";
  }).trim();
  return { title: cleanTitle, flags };
}

export function stringifyDocument(doc: RulesDocument): string {
  const frontmatterLines = [
    "---",
    `name: ${doc.meta.name}`,
    `version: ${doc.meta.version}`,
  ];
  if (doc.meta.scope) frontmatterLines.push(`scope: ${doc.meta.scope}`);
  frontmatterLines.push("---", "");

  const sectionBlocks = doc.sections.map((s) => {
    const flagParts: string[] = [];
    const caps = s.capabilities.filter((c) => c !== "plain");
    if (caps.length > 0) flagParts.push(`{capability: ${caps.join(",")}}`);
    if (s.scope) flagParts.push(`{scope: ${s.scope}}`);
    const heading = `${"#".repeat(s.level)} ${s.title}${flagParts.length > 0 ? "  " + flagParts.join(" ") : ""}`;
    return `${heading}\n\n${s.body}`;
  });

  return [...frontmatterLines, ...sectionBlocks].join("\n") + "\n";
}
