export const CURRICULUM_AS_OF = "2026-07-28";

export type WingId = "home" | "network" | "foundations" | "concepts" | "git";

export const WINGS: { id: WingId; href: string; label: string; hint: string }[] = [
  { id: "home", href: "/", label: "今日", hint: "选择起点" },
  { id: "network", href: "/#sec-network", label: "知识网络", hint: "控制半径" },
  { id: "concepts", href: "/concepts", label: "概念", hint: "每日账本" },
  { id: "foundations", href: "/agent-foundations.html", label: "基础馆", hint: "通关课程" },
  { id: "git", href: "/git-workflow.html", label: "Git", hint: "协作图" },
];

export type RadiusId =
  | "tool"
  | "react"
  | "loop"
  | "mcp"
  | "acp"
  | "cli"
  | "a2a"
  | "card"
  | "skill"
  | "harness"
  | "graph";

/* Warm paper tokens: ink / ink-soft / olive / emerald / slate. Lime is never a node fill. */
export const RADIUS: {
  id: RadiusId;
  label: string;
  en: string;
  color: string;
  foundation: string;
  tags: string[];
}[] = [
  { id: "tool", label: "工具", en: "Tool", color: "var(--ink)", foundation: "/agent-foundations.html#sec-1", tags: ["Tool Use"] },
  { id: "react", label: "认知循环", en: "ReAct", color: "var(--ink-soft)", foundation: "/agent-foundations.html#sec-2", tags: ["推理"] },
  { id: "loop", label: "重复运行", en: "Loop", color: "var(--emerald)", foundation: "/agent-foundations.html#sec-3", tags: ["推理", "Agent"] },
  { id: "mcp", label: "工具协议", en: "MCP", color: "var(--ink)", foundation: "/agent-foundations.html#sec-4", tags: ["MCP"] },
  { id: "acp", label: "会话协议", en: "ACP", color: "#8a6234", foundation: "/agent-foundations.html#sec-acp", tags: ["ACP"] },
  { id: "cli", label: "本地 Agent", en: "CLI", color: "#c46a2b", foundation: "/agent-foundations.html#sec-cli", tags: ["CLI"] },
  { id: "a2a", label: "协作协议", en: "A2A", color: "var(--slate)", foundation: "/agent-foundations.html#sec-6", tags: ["Agent"] },
  { id: "card", label: "能力名片", en: "Agent Card", color: "var(--slate)", foundation: "/agent-foundations.html#sec-6", tags: ["Agent"] },
  { id: "skill", label: "分层手册", en: "Skill", color: "var(--ink-soft)", foundation: "/agent-foundations.html#sec-skill", tags: ["Skill"] },
  { id: "harness", label: "单次运行", en: "Harness", color: "var(--emerald)", foundation: "/#sec-labs", tags: ["Harness"] },
  { id: "graph", label: "多循环治理", en: "Graph", color: "var(--ink)", foundation: "/#sec-network", tags: ["Graph"] },
];

const TITLE_HINTS: [RegExp, RadiusId][] = [
  [/\bmcp\b|model context protocol/i, "mcp"],
  [/\bacp\b|agent client protocol/i, "acp"],
  [/\bstdio agent\b|coding[- ]agent cli|\bgrok cli\b|\bcodex cli\b|\bcli\b.*stdio|本地 Agent CLI/i, "cli"],
  [/\bskill\b/i, "skill"],
  [/\bharness\b/i, "harness"],
  [/\bgraph\b|multi-agent|multi agent/i, "graph"],
  [/\ba2a\b|agent[- ]?to[- ]?agent|agent card/i, "a2a"],
  [/\breact\b|chain of thought|reasoning/i, "react"],
  [/\bloop\b/i, "loop"],
  [/tool[- ]?use|function call|tool calling/i, "tool"],
];

export function relateToRadius(input: { tags?: string[]; title?: string; summary?: string }): RadiusId[] {
  const hits = new Set<RadiusId>();
  const tags = input.tags ?? [];
  for (const r of RADIUS) {
    if (r.tags.some((t) => tags.includes(t))) hits.add(r.id);
  }
  const blob = `${input.title ?? ""} ${input.summary ?? ""}`;
  for (const [re, id] of TITLE_HINTS) {
    if (re.test(blob)) hits.add(id);
  }
  return [...hits];
}

export function radiusById(id: string) {
  return RADIUS.find((r) => r.id === id);
}
