"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  runGraphDemo,
  runHarnessDemo,
  runLoopDemo,
  type GraphResult,
  type HarnessConfig,
  type HarnessResult,
  type LoopResult,
} from "./lab-model.mjs";
import { LabShell } from "./LabShell";
import { CURRICULUM_AS_OF, RADIUS, relateToRadius } from "./lab-chrome";
import conceptsData from "../data/concepts.json";

const navItems = [
  { id: "sec-0", num: "0", label: "今日", color: "var(--ink)" },
  { id: "sec-network", num: "1", label: "知识网络", color: "var(--ink)" },
  { id: "sec-labs", num: "2", label: "技术复现实验", color: "var(--emerald)" },
  { id: "sec-skill", num: "3", label: "Skill 体系", color: "var(--ink-soft)" },
  { id: "sec-tacit", num: "4", label: "场景诊断", color: "var(--slate)" },
  { id: "sec-courses", num: "5", label: "深入课程", color: "var(--ink-soft)" },
  { id: "sec-sources", num: "6", label: "一手来源", color: "var(--ink)" },
];

/* AI 导师章节上下文：让导师知道学习者当前学到哪、该问什么 */
const mentorCtx: Record<
  string,
  { section: string; points: string[]; questions: string[] }
> = {
  "sec-0": {
    section: "总览与学习地图",
    points: [
      "AI Learning Lab：聚焦 Agent 架构全景、协议选型与闭环工程实践",
      "核心维度：执行环境(Harness) → 闭环迭代(Loop) → 协同治理(Graph) → 技能封装(Skill)",
    ],
    questions: [
      "在你的实际项目中，开发 Agent 时遇到的最大痛点是什么？",
      "首页的三个实验（Harness / Loop / Graph）分别对应工程中的哪些阶段？",
      "如果只保留一个实验来排查 Agent 任务执行失败，你会优先关注哪一层？",
    ],
  },
  "sec-network": {
    section: "知识网络与协议全景",
    points: [
      "Tool Calling：模型与外部环境交互的基础能力，通过函数签名调用外部 API",
      "MCP：标准化工具与数据源接入协议（Agent ↔ 工具/API/数据源）",
      "ACP：客户端与本地 Agent 会话协议（Client ↔ 本地 Agent，基于 stdio/RPC）",
      "A2A：面向独立 Agent 间的长任务委托与状态同步规范",
      "Agent CLI：运行于本地终端的编码助手，具备完整工作区开发上下文",
      "Agent Card：对外声明的能力元数据清单；Skill：结构化工作流与技能手册",
      "ReAct：Reason + Act 基础认知循环（思考、工具执行与观察）",
    ],
    questions: [
      "MCP、ACP 与 A2A 分别连接哪两端？在实际开发中如何选择？",
      "为什么说完整的编码助手不适合只作为一个单次调用的 MCP 工具？",
      "Tool Calling、MCP 与 Skill 三者各自解决什么问题？试着梳理它们的分工。",
    ],
  },
  "sec-labs": {
    section: "技术复现实验",
    points: [
      "Harness：单次任务执行保障——工具链、环境可观测性、架构约束与验收判据",
      "Loop：多轮自主迭代——状态持久化、评估器打分、预算限制与退出策略",
      "Graph：多智能体协同治理——所有权边界、全局否决机制与业务基准锚点",
    ],
    questions: [
      "在 Harness 实验中，如果关闭环境可观测性，Agent 为什么会无法前进？",
      "在 Loop 迭代中，目标分数与计算预算的关系是什么？为什么需要预算熔断？",
      "为什么会出现「各子模块指标全绿，但全局业务指标恶化」的现象？",
    ],
  },
  "sec-skill": {
    section: "Skill 体系",
    points: [
      "SKILL.md 规定工作流与判断规则；references/ 沉淀参考资料；scripts/ 承载确定性脚本；assets/ 存放模板素材",
      "三级渐进加载降低上下文开销：元数据路由 → SKILL.md 流程 → 按需读取资料/运行脚本",
      "Skill 的核心价值是流程与工程规范的可复现性，而非每次生成字字一致",
    ],
    questions: [
      "结构化的 Skill 与一段超长 Prompt 的本质区别是什么？",
      "为什么详细的业务规则或文档适合放入 references/，而不是全塞进 SKILL.md？",
      "哪些逻辑适合写成确定性脚本（scripts/），哪些适合交由模型判断？",
    ],
  },
  "sec-tacit": {
    section: "场景诊断与信号定位",
    points: [
      "故障分层定位：跨任务重复缺乏反馈→补齐 Harness；多轮修改陷入死循环→优化 Loop 控制；局部达标全局受损→强化 Graph 治理",
      "从可观察的系统信号切入，避免盲目修改 Prompt",
    ],
    questions: [
      "如果 Agent 经常卡在报错并需要人工复制控制台输出，提示应该优先解决哪一层的问题？",
      "在日常开发中，你遇到过哪些典型的 Agent 失控或死循环场景？",
    ],
  },
  "sec-courses": {
    section: "深入课程",
    points: [
      "系统教程：从基础工具调用到多智能体架构的全流程指引",
      "Git 协作实验：通过图形化网络直观理解分支、合并与冲突解决",
    ],
    questions: [
      "你希望先深入理解协议规范与源码，还是先在实验台中验证机制？",
    ],
  },
  "sec-sources": {
    section: "一手来源",
    points: [
      "行业技术来源成熟度分级：established（成熟标准）/ emerging（发展中提议）/ proposed（探索性构想）",
      "区分官方事实规范与单一组织的提议构想，避免盲目跟风概念",
    ],
    questions: [
      "面对社区新出现的技术术语与概念，你会从哪些维度评估其落地成熟度？",
    ],
  },
};

const sources = [
  {
    label: "Harness Engineering",
    publisher: "OpenAI",
    date: "2026-02-11",
    maturity: "emerging",
    url: "https://openai.com/index/harness-engineering/",
    note: "针对以 Agent 为核心的研发团队，探讨如何设计执行环境、项目代码上下文、结构约束与反馈回路。",
  },
  {
    label: "Loop Engineering",
    publisher: "IBM",
    date: "2026-07-17",
    maturity: "emerging",
    url: "https://www.ibm.com/think/topics/loop-engineering",
    note: "构建目标驱动的迭代闭环：涵盖任务调度、状态流转、工具链调用与人工审核把关机制。",
  },
  {
    label: "Graph Engineering",
    publisher: "Eigent",
    date: "2026-07-21",
    maturity: "proposed",
    url: "https://www.eigent.ai/blog/graph-engineering-ai-agents",
    note: "探讨多循环协同下的权限划分、执行节奏、否决机制与业务锚点；目前属于探索性提议。",
  },
  {
    label: "A2A and MCP",
    publisher: "A2A Project",
    date: "持续更新",
    maturity: "established",
    url: "https://a2acn.com/docs/topics/a2a-and-mcp/",
    note: "官方定位互补：MCP 连接工具与数据源，A2A 负责独立 Agent 间发现、任务协作与上下文交换。",
  },
  {
    label: "Agent Client Protocol",
    publisher: "Zed / ACP",
    date: "持续更新",
    maturity: "emerging",
    url: "https://agentclientprotocol.com/",
    note: "客户端把本地 Agent 作为子进程拉起，JSON-RPC 2.0 over stdin/stdout（NDJSON）。MCP 管 Agent↔工具，ACP 管 Client↔Agent。",
  },
  {
    label: "Agent Skills and Card",
    publisher: "A2A Project",
    date: "持续更新",
    maturity: "established",
    url: "https://a2acn.com/docs/tutorials/python/3-agent-skills-and-card/",
    note: "Agent Card 是公开能力名片；AgentSkill 描述可发现的具体能力、输入输出与示例。",
  },
  {
    label: "Workflows and agents",
    publisher: "LangChain",
    date: "持续更新",
    maturity: "established",
    url: "https://docs.langchain.com/oss/python/langgraph/workflows-agents",
    note: "显式状态图、节点、边、条件路由和持久执行的 Work Graph。",
  },
];

const knowledgeNodes = [
  {
    id: "tool",
    eyebrow: "基础能力",
    title: "Tool Calling",
    note: "模型与外部交互的基础，通过参数签名调用 API",
    links: "连接 → react / mcp",
    color: "var(--ink)",
  },
  {
    id: "react",
    eyebrow: "认知循环",
    title: "ReAct",
    note: "推理、执行工具、观察反馈的交替推演闭环",
    links: "连接 → loop",
    color: "var(--ink-soft)",
  },
  {
    id: "mcp",
    eyebrow: "工具协议",
    title: "MCP",
    note: "标准化接入工具与数据源（Agent ↔ 工具/API/数据）",
    links: "对比 → acp / a2a / card",
    color: "var(--ink)",
  },
  {
    id: "acp",
    eyebrow: "会话协议",
    title: "ACP",
    note: "客户端与本地 Agent 会话通道（Client ↔ 本地 Agent）",
    links: "对比 → mcp · 依赖 → cli",
    color: "#8a6234",
  },
  {
    id: "cli",
    eyebrow: "本地 Agent",
    title: "Agent CLI",
    note: "命令行环境中的编码助手，基于 stdio 双向通信",
    links: "连接 → acp / harness / loop",
    color: "#c46a2b",
  },
  {
    id: "a2a",
    eyebrow: "协作协议",
    title: "A2A",
    note: "跨服务 Agent 间的服务发现、长任务委托与状态同步",
    links: "依赖 → card · 对比 → mcp",
    color: "var(--slate)",
  },
  {
    id: "card",
    eyebrow: "能力名片",
    title: "Agent Card",
    note: "对外公开的服务元数据：服务地址、认证方式与技能清单",
    links: "服务 → a2a · 不同于 → skill",
    color: "var(--slate)",
  },
  {
    id: "skill",
    eyebrow: "能力模块",
    title: "Skill",
    note: "结构化工作流与技能手册，按需分层加载节省上下文",
    links: "连接 → harness / mcp",
    color: "var(--ink-soft)",
  },
  {
    id: "harness",
    eyebrow: "执行环境",
    title: "Harness Engineering",
    note: "为单次运行提供工具链、环境观测、安全约束与验收判据",
    links: "连接 → loop",
    color: "var(--emerald)",
  },
  {
    id: "loop",
    eyebrow: "闭环迭代",
    title: "Loop Engineering",
    note: "多轮迭代控制：状态维护、质量评估、预算熔断与退出",
    links: "连接 → graph",
    color: "var(--slate)",
  },
  {
    id: "graph",
    eyebrow: "协同治理",
    title: "Graph Engineering",
    note: "多智能体协同治理：权责划分、冲突仲裁与全局基准约束",
    links: "业务基准与全局治理约束",
    color: "var(--ink)",
  },
];

const knowledgeEdges: Record<string, string[]> = {
  tool: ["react", "mcp"],
  react: ["tool", "loop"],
  mcp: ["tool", "a2a", "card", "skill", "acp"],
  acp: ["mcp", "cli", "a2a"],
  cli: ["acp", "harness", "loop"],
  a2a: ["mcp", "card", "acp"],
  card: ["a2a", "skill"],
  skill: ["card", "harness", "mcp"],
  harness: ["skill", "loop", "cli"],
  loop: ["react", "harness", "graph", "cli"],
  graph: ["loop"],
};

const protocolQuiz = [
  {
    id: "p1",
    prompt:
      "业务场景：外层客服 Agent 调用内层知识库的 knowledge_chat 接口：传入 message / conversation_id 并获取回答。该选什么协议？",
    answer: "mcp",
    choices: [
      { id: "mcp", label: "使用 MCP：本质是在调用一个标准化的知识检索工具" },
      { id: "a2a", label: "使用 A2A：因为被调用方也是一个 Agent" },
      { id: "both", label: "双协议并行：同时使用 MCP 和 A2A" },
    ],
    explain:
      "虽然被调用方内部有智能体逻辑，但对外交互本质上仍是确定性的问答能力调用。MCP 提供了标准化的工具 Schema 与结构化数据交互，在这里更轻量直接；引入 A2A 属于过度设计。",
  },
  {
    id: "p2",
    prompt:
      "业务场景：你需要让第三方系统的 Agent 能够动态发现“我具备哪些能力、服务地址在哪里、如何进行鉴权”。核心规范是？",
    answer: "card",
    choices: [
      { id: "mcp", label: "MCP tools/list 接口" },
      { id: "card", label: "Agent Card（.well-known/agent-card.json）" },
      { id: "skillmd", label: "本地 SKILL.md 规范" },
    ],
    explain:
      "Agent Card 是分布式 Agent 的声明式服务名片；MCP 的 tools/list 面向单个 Agent 的本地工具菜单，本地 SKILL.md 面向代码库内的工作流组织，均非跨服务能力发现规范。",
  },
  {
    id: "p3",
    prompt: "业务场景：当系统演进至跨团队独立部署、需要支持异步长任务取消/恢复、并能交付复杂工件（Artifact）时，合理的架构演进是？",
    answer: "adapter",
    choices: [
      { id: "replace", label: "彻底废弃 MCP，全部重构为 A2A" },
      { id: "adapter", label: "底层保留 MCP 工具接入，在上层引入 A2A 适配层处理长任务委托" },
      { id: "wrap", label: "将 A2A 客户端重新包装成一个普通的 MCP 工具" },
    ],
    explain:
      "MCP 与 A2A 属于互补层级：短周期高频工具调用与数据查询保留在 MCP 层，跨团队长周期异步任务委托交由 A2A 处理。将 A2A 简单包裹为 MCP 工具只会引入不必要的嵌套与状态管理混乱。",
  },
  {
    id: "p4",
    prompt:
      "业务场景：代码编辑器或 IDE 需要在本地启动编码智能体，进行持续交互会话（Prompt 交互、流式输出、生成 Diff、确认权限）。该选什么协议？",
    answer: "acp",
    choices: [
      { id: "acp", label: "ACP：客户端拉起本地子进程，通过 stdio/RPC 驱动完整交互会话" },
      { id: "mcpwrap", label: "把整个编码 Agent 包装为一个 MCP 工具，单次 tools/call 执行" },
      { id: "a2a", label: "A2A：给本地命令行进程生成 Agent Card 进行网络协商" },
    ],
    explain:
      "完整的编码交互属于典型的 Client ↔ 本地 Agent 会话，ACP 原生支持 stdio 进程通信与双向流式协议；单次 MCP 调用无法支撑持续的交互会话与中断控制，而 A2A 则面向分布式网络场景，在本地进程间过于繁重。",
  },
];

const tacitCards = [
  {
    title: "执行中断与环境盲区",
    situation:
      "Agent 编写代码逻辑正常，但每次执行遇到报错时，都必须依赖人工手动复制控制台日志或截图喂给它才能继续。",
    cues:
      "诊断线索：该问题在多个任务中重复出现；报错日志客观存在但处于 Agent 观察视野之外。根本原因是单次执行环境（Harness）缺乏自动化日志收集与环境反馈回传，应优先完善执行外壳，而非盲目调优 Prompt。",
  },
  {
    title: "多轮反复与无限重试",
    situation:
      "在本地手动调用单次执行非常顺利，但一旦配置为无人值守的定时自动化任务，就会陷入反复修改同一处代码、甚至无限重试直至超时。",
    cues:
      "诊断线索：单次执行能力完备，但缺少多轮状态追踪、进度评估、最大尝试预算与升级介入机制。根因出在闭环控制（Loop Engineering）缺乏终止约束与熔断保护。",
  },
  {
    title: "局部指标达标但全局结果恶化",
    situation:
      "代码生成速度提升、单测覆盖率达标、局部打分全绿，但交付到用户环境的实际业务留存率和满意度持续下滑。",
    cues:
      "诊断线索：各个子模块的局部优化均能自我闭环解释，但缺乏全局目标校验与不可被局部改写的外部业务基准（Ground Truth）。问题属于多 Agent 协同治理（Graph Engineering）层级。",
  },
];

const skillPlacementQuiz = [
  {
    id: "q1",
    prompt: "“Agent 每次执行时都必须首先遵循：先复现问题并建立验证闭环，再开始编写代码。”",
    answer: "skill.md",
    choices: [
      { id: "skill.md", label: "SKILL.md（操作流程规范）" },
      { id: "references", label: "references/（参考文档库）" },
      { id: "scripts", label: "scripts/（自动化脚本）" },
      { id: "assets", label: "assets/（模板素材库）" },
    ],
    explain: "这是每次任务都必须执行的核心工作流与原则规范，应明确写入 SKILL.md。",
  },
  {
    id: "q2",
    prompt: "“仅当涉及跨币种支付清算时，才需要查阅的退款手续费与银行规则明细。”",
    answer: "references",
    choices: [
      { id: "skill.md", label: "SKILL.md（操作流程规范）" },
      { id: "references", label: "references/（参考文档库）" },
      { id: "scripts", label: "scripts/（自动化脚本）" },
      { id: "assets", label: "assets/（模板素材库）" },
    ],
    explain: "特定分支才需要的详细业务知识应放入 references/ 进行渐进式按需读取，避免膨胀系统基础上下文。",
  },
  {
    id: "q3",
    prompt: "“对抓取的抓取条目进行 URL 规范化清洗、提取内容指纹、以及判定更新状态。”",
    answer: "scripts",
    choices: [
      { id: "skill.md", label: "SKILL.md（操作流程规范）" },
      { id: "references", label: "references/（参考文档库）" },
      { id: "scripts", label: "scripts/（自动化脚本）" },
      { id: "assets", label: "assets/（模板素材库）" },
    ],
    explain: "计算确定、对一致性要求严格的重复性逻辑，最适合编写为独立脚本（scripts/）交给宿主直接运行。",
  },
  {
    id: "q4",
    prompt: "“生成技术分析报告时需要复制并填充的预设 Markdown 或 HTML 骨架文件。”",
    answer: "assets",
    choices: [
      { id: "skill.md", label: "SKILL.md（操作流程规范）" },
      { id: "references", label: "references/（参考文档库）" },
      { id: "scripts", label: "scripts/（自动化脚本）" },
      { id: "assets", label: "assets/（模板素材库）" },
    ],
    explain: "作为交付产物模板的样板文件归入 assets/，Agent 仅在生成目标文件时进行复制与填充。",
  },
];

/* ---------------- 通用 hooks ---------------- */

function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const loadedRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw != null) setValue(JSON.parse(raw) as T);
      } catch {
        /* ignore */
      }
      loadedRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}

function useToast(): [string | null, (msg: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const show = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  return [toast, show];
}

/** 模拟一次"真实运行"：短暂 loading 后给出结果，每次运行 runId 自增以重置动画 */
function useRun<T>(compute: () => T) {
  const [result, setResult] = useState<T | null>(null);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const timer = useRef<number | null>(null);

  const run = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setRunning(true);
    setResult(null);
    timer.current = window.setTimeout(() => {
      setResult(compute());
      setRunning(false);
      setRunId((id) => id + 1);
    }, 160);
  }, [compute]);

  const reset = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setRunning(false);
    setResult(null);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return { result, running, run, reset, runId };
}

/** 结果 trace 逐条浮现 */
function useStagger(count: number, step = 80) {
  // 调用方通过 key={runId} 重挂载来归零，无需在 effect 里同步重置
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (count === 0) return;
    let n = 0;
    const timer = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= count) window.clearInterval(timer);
    }, step);
    return () => window.clearInterval(timer);
  }, [count, step]);
  return shown;
}

/* ---------------- 通用组件 ---------------- */

function ProgressRing({ value }: { value: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="ring" aria-hidden="true">
      <circle className="ring-bg" cx="28" cy="28" r={r} />
      <circle
        className="ring-fg"
        cx="28"
        cy="28"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
      />
      <text className="ring-text" x="28" y="32" textAnchor="middle">
        {value}%
      </text>
    </svg>
  );
}

function Toggle({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`toggle-row ${checked ? "is-on" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-ui" aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </label>
  );
}

function RunButton({
  running,
  hasResult,
  label,
  onClick,
}: {
  running: boolean;
  hasResult: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`run-button ${running ? "loading" : ""}`}
      type="button"
      disabled={running}
      onClick={onClick}
    >
      {running ? "运行中…" : hasResult ? "再跑一次" : label}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="es-ico" aria-hidden="true">
        ▶
      </span>
      <p>{children}</p>
    </div>
  );
}

function StatusPill({ kind, text }: { kind: "ok" | "warn" | "bad"; text: string }) {
  return (
    <span className={`status ${kind}`}>
      <i aria-hidden="true" />
      {text}
    </span>
  );
}

type QuizItem = {
  id: string;
  prompt: string;
  answer: string;
  choices: { id: string; label: string }[];
  explain: string;
};

function Quiz({
  storageKey,
  items,
  color,
}: {
  storageKey: string;
  items: QuizItem[];
  color: string;
}) {
  const [answers, setAnswers] = useLocalStorage<Record<string, string>>(
    storageKey,
    {},
  );
  const score = items.filter((item) => answers[item.id] === item.answer).length;
  const answered = items.filter((item) => answers[item.id]).length;
  const pct = items.length ? Math.round((score / items.length) * 100) : 0;
  const complete = answered === items.length;

  return (
    <div className="quiz" style={{ ["--sc" as string]: color }}>
      <div className="quiz-score">
        <div className="qs-info">
          <b>{score}</b>
          <span> / {items.length} 正确 · 已作答 {answered}/{items.length}</span>
        </div>
        <div className="qs-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        {answered > 0 && (
          <button type="button" className="text-button" onClick={() => setAnswers({})}>
            重做
          </button>
        )}
      </div>

      {complete && (
        <div className={`callout ${score === items.length ? "tip" : "info"}`}>
          <div className="ct">
            {score === items.length ? "全部答对，可以进入下一章" : `答对 ${score}/${items.length}`}
          </div>
          <div>
            {score === items.length
              ? "这些判断已经形成反射。试着把每条解释复述给一个不熟悉协议的同事听。"
              : "回到上面的对比表，找出答错题对应的行，再判断一次。"}
          </div>
        </div>
      )}

      {items.map((item, qi) => {
        const selected = answers[item.id];
        return (
          <div className="card quiz-card" key={item.id}>
            <div className="quiz-q">
              <span className="quiz-num">{qi + 1}</span>
              <span>{item.prompt}</span>
            </div>
            <div className="choice-grid">
              {item.choices.map((choice, ci) => {
                const className =
                  selected == null
                    ? ""
                    : choice.id === item.answer
                      ? "correct"
                      : selected === choice.id
                        ? "wrong"
                        : "muted";
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={className}
                    onClick={() =>
                      setAnswers((current) => ({ ...current, [item.id]: choice.id }))
                    }
                  >
                    <span className="ch-key">{String.fromCharCode(65 + ci)}</span>
                    <span className="ch-label">{choice.label}</span>
                    {selected != null && choice.id === item.answer && (
                      <span className="ch-mark ok" aria-hidden="true">
                        ✓
                      </span>
                    )}
                    {selected === choice.id && choice.id !== item.answer && (
                      <span className="ch-mark bad" aria-hidden="true">
                        ✕
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selected && <div className="feedback">{item.explain}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- AI 导师（DeepSeek · 苏格拉底式反问） ---------------- */

type MentorMsg = { role: "user" | "assistant"; content: string };

/* DeepSeek 原生 Responses API（OpenAI Responses 格式，无状态：每次回传完整历史） */
const DS_API = "https://api.deepseek.com/responses";
const DS_DEFAULT_MODEL = "deepseek-v4-flash";

type DSOutputPart = { type: "output_text"; text?: string };
type DSOutputItem = { type?: string; content?: DSOutputPart[] };
type DSResponse = { output_text?: string; output?: DSOutputItem[] };

function welcomeFor(activeId: string): string {
  const ctx = mentorCtx[activeId] ?? mentorCtx["sec-0"];
  return `你好，我是这里的 AI 导师 👋 你现在正在「${ctx.section}」。
我先不急着讲——先从你出发：${ctx.questions[0]}
（也可以直接点下面的问题，或随意提问。想让我直接讲解时，说一声「直接告诉我答案」即可。）`;
}

function MentorPanel({ activeId }: { activeId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "settings">("chat");
  const [key, setKey] = useLocalStorage("ai-lab-ds-key", "");
  const [model, setModel] = useLocalStorage("ai-lab-ds-model", DS_DEFAULT_MODEL);
  const [messages, setMessages] = useState<MentorMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<"idle" | "ok" | "fail">("idle");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ctx = mentorCtx[activeId] ?? mentorCtx["sec-0"];
  // 欢迎语不进 state（避免 effect 内 setState），由展示层兜底
  const display: MentorMsg[] =
    messages.length > 0
      ? messages
      : [{ role: "assistant", content: welcomeFor(activeId) }];

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  function buildSystem(): string {
    return `你是「AI Learning Lab」内置的苏格拉底式导师，教学理念参考 DeepTutor：不灌输，而是通过反问引导学习者自己得出结论。

【学习者当前所在章节】${ctx.section}
【本章核心知识点】${ctx.points.join("；")}

【对话规则】
1. 默认反问引导：学习者提问后，先用 1-2 个启发式问题反问，激活他的已有知识，让他先说出自己的想法，不要急着给答案。
2. 学习者给出想法后：先肯定其中正确的部分，再针对错误或模糊处给出精准反馈，并追问下一步。
3. 以下情况可以直接讲解：(a) 学习者明确说「直接告诉我答案 / 直接回答 / 解释一下」；(b) 同一概念反问两次后仍卡住；(c) 纯事实性问题（如「MCP 的全称是什么」）。
4. 用中文回答；常规回答控制在 150 字以内，讲解场景可适当展开；概念类比要清晰准确：MCP=标准化工具与数据接口、ACP=宿主与本地 Agent 的双向会话通道、CLI=终端本地编码助手、A2A=跨系统智能体协同协议、Agent Card=声明式能力名片、Skill=结构化工作流与技能手册。
5. 对话要像一对一辅导而不是问答机器：解释后用提问收尾，或抛一个现实场景让学习者判断。`;
  }

  async function callDeepSeek(history: MentorMsg[]): Promise<string> {
    const res = await fetch(DS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim() || DS_DEFAULT_MODEL,
        instructions: buildSystem(),
        input: history.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        max_output_tokens: 1200,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const detail = data?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(detail);
    }
    const data = (await res.json()) as DSResponse;
    // 优先 output_text，否则从 output[] 中拼接 message → output_text
    const text =
      data.output_text ??
      (data.output ?? [])
        .filter((item) => item.type === "message")
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === "output_text")
        .map((part) => part.text ?? "")
        .join("");
    if (!text) throw new Error("返回内容为空，请重试");
    return text;
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    if (!key.trim()) {
      setTab("settings");
      setError("请先在「设置」里填写 DeepSeek API Key（仅保存在你本地浏览器）");
      return;
    }
    setError(null);
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await callDeepSeek(next);
      setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "请求失败";
      setError(`出错了：${msg}。请检查 Key 是否有效、网络是否可达（页面直连 api.deepseek.com）。`);
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    if (!key.trim()) {
      setTestState("fail");
      return;
    }
    setTestState("idle");
    try {
      await callDeepSeek([{ role: "user", content: "只回复：ok" }]);
      setTestState("ok");
    } catch {
      setTestState("fail");
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`mentor-fab ${open ? "active" : ""}`}
        aria-label="打开 AI 导师"
        title="AI 导师（DeepSeek）"
        onClick={() => {
          setOpen((o) => !o);
          setError(null);
        }}
      >
        🧑‍🏫
        <span className="mentor-fab-dot" aria-hidden="true" />
      </button>

      {open && (
        <section className="mentor-panel" aria-label="AI 导师对话">
          <header className="mentor-head">
            <div className="mentor-title">
              <span className="mentor-avatar" aria-hidden="true">
                🧑‍🏫
              </span>
              <div>
                <strong>AI 导师</strong>
                <small>
                  DeepSeek · {ctx.section}
                </small>
              </div>
            </div>
            <div className="mentor-head-actions">
              <button
                type="button"
                className={`mentor-tab-btn ${tab === "settings" ? "active" : ""}`}
                onClick={() => setTab("settings")}
                title="设置"
                aria-label="设置"
              >
                ⚙️
              </button>
              <button
                type="button"
                className="mentor-tab-btn"
                onClick={() => setOpen(false)}
                title="关闭"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
          </header>

          {tab === "settings" ? (
            <div className="mentor-settings">
              <div className="ms-field">
                <label htmlFor="ds-key">DeepSeek API Key</label>
                <input
                  id="ds-key"
                  type="password"
                  value={key}
                  placeholder="sk-..."
                  autoComplete="off"
                  onChange={(e) => {
                    setKey(e.target.value);
                    setTestState("idle");
                  }}
                />
                <p className="ms-note">
                  Key 仅保存在你当前浏览器的 localStorage 中，页面通过 HTTPS
                  直连 api.deepseek.com，不会上传到其他服务器。可在{" "}
                  <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer">
                    platform.deepseek.com
                  </a>{" "}
                  创建。
                </p>
              </div>
              <div className="ms-field">
                <label htmlFor="ds-model">模型名（像 cc-switch 一样自由填写）</label>
                <input
                  id="ds-model"
                  type="text"
                  value={model}
                  placeholder={DS_DEFAULT_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setModel(e.target.value)}
                />
                <p className="ms-note">
                  走 DeepSeek 原生 Responses API（POST /responses，无状态，每次回传完整对话历史）。当前支持{" "}
                  <code>deepseek-v4-flash</code>，<code>deepseek-v4-pro</code> 预计 2026-08
                  支持；<code>deepseek-chat</code> / <code>deepseek-reasoner</code> 已于
                  2026-07-24 弃用。
                </p>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => void testConnection()}
                disabled={!key.trim()}
              >
                {testState === "ok"
                  ? "✅ 连接成功"
                  : testState === "fail"
                    ? "❌ 连接失败"
                    : "测试连接"}
              </button>
              <button type="button" className="btn back" onClick={() => setTab("chat")}>
                ← 返回对话
              </button>
            </div>
          ) : (
            <div className="mentor-chat">
              <div className="mentor-list" ref={listRef}>
                {error && (
                  <div className="mentor-error" role="alert">
                    {error}
                  </div>
                )}
                {display.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={`mentor-bubble ${m.role === "user" ? "user" : "assistant"}`}
                  >
                    {m.content}
                  </div>
                ))}
                {loading && (
                  <div className="mentor-bubble assistant typing">
                    <span className="m-dot" />
                    <span className="m-dot" />
                    <span className="m-dot" />
                  </div>
                )}
              </div>

              <div className="mentor-suggests">
                {ctx.questions.map((q) => (
                  <button
                    type="button"
                    key={q}
                    className="ms-chip"
                    onClick={() => void send(q)}
                    disabled={loading}
                  >
                    {q.length > 26 ? `${q.slice(0, 26)}…` : q}
                  </button>
                ))}
              </div>

              <div className="mentor-input-row">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  placeholder="提问，或说「直接告诉我答案」"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="mentor-send"
                  onClick={() => void send(input)}
                  disabled={loading || !input.trim()}
                  aria-label="发送"
                >
                  发送
                </button>
              </div>
              <p className="mentor-foot">
                苏格拉底式引导 · 反问默认开启；想听答案时说一声即可
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}

/* ---------------- 三个技术实验 ---------------- */

function HarnessLab() {
  const [config, setConfig] = useState<HarnessConfig>({
    tools: true,
    observability: false,
    constraints: true,
    completionProof: true,
  });
  const { result, running, run, reset, runId } = useRun<HarnessResult>(() =>
    runHarnessDemo(config),
  );

  function update(key: keyof HarnessConfig, value: boolean) {
    setConfig((current) => ({ ...current, [key]: value }));
    reset();
  }

  return (
    <article className="lab-card studio-frame" id="harness-lab" style={{ ["--sc" as string]: "var(--emerald)" }}>
      <div className="lab-title">
        <span className="lab-index">01</span>
        <div>
          <p>单次执行环境</p>
          <h3>Harness Lab</h3>
        </div>
        <span className="maturity emerging">emerging</span>
      </div>
      <p className="lab-intro">
        配置 Agent 的运行环境，直观观察缺少工具、环境反馈、结构约束或验收标准时，任务会在哪一阶段中断。
      </p>
      <div className="tool-chips" aria-label="本次运行用到的能力">
        <span className="tool-chip">runHarnessDemo</span>
        <span className="tool-chip">tools</span>
        <span className="tool-chip">observability</span>
        <span className="tool-chip">constraints</span>
      </div>
      <div className="lab-workbench">
        <div className="control-stack">
          <Toggle
            checked={config.tools}
            label="工具调用能力"
            detail="允许 Agent 读写文件、执行终端命令与测试"
            onChange={(value) => update("tools", value)}
          />
          <Toggle
            checked={config.observability}
            label="环境可观察性"
            detail="日志、指标与界面状态能实时回传到上下文"
            onChange={(value) => update("observability", value)}
          />
          <Toggle
            checked={config.constraints}
            label="架构与安全约束"
            detail="依赖方向与代码规范由自动化工具拦截"
            onChange={(value) => update("constraints", value)}
          />
          <Toggle
            checked={config.completionProof}
            label="明确验收判据"
            detail="依赖测试结果或明确判定路径决定何时停止"
            onChange={(value) => update("completionProof", value)}
          />
          <RunButton
            running={running}
            hasResult={result != null}
            label="运行一次 Harness"
            onClick={run}
          />
        </div>
        <div className="result-panel" aria-live="polite">
          {running ? (
            <div className="running-hint">
              <span className="spinner" aria-hidden="true" />
              正在执行 Agent 运行…
            </div>
          ) : result ? (
            <HarnessResultView key={runId} result={result} />
          ) : (
            <EmptyState>调整环境开关后运行，查看 Agent 在当前配置下的执行轨迹与中断原因。</EmptyState>
          )}
        </div>
      </div>
    </article>
  );
}

function HarnessResultView({ result }: { result: HarnessResult }) {
  const shown = useStagger(result.trace.length);
  return (
    <>
      <StatusPill
        kind={result.status === "completed" ? "ok" : "bad"}
        text={result.status}
      />
      <h4>{result.explanation}</h4>
      <div className="trace-list">
        {result.trace.slice(0, shown).map((item) => (
          <div
            className={`trace-item anim ${item.ok ? "ok" : "bad"}`}
            key={`${item.phase}-${item.text}`}
          >
            <b>{item.phase}</b> · {item.text}
          </div>
        ))}
      </div>
    </>
  );
}

function LoopLab() {
  const [initialScore, setInitialScore] = useState(35);
  const [targetScore, setTargetScore] = useState(80);
  const [maxIterations, setMaxIterations] = useState(5);
  const [budget, setBudget] = useState(3);
  const { result, running, run, reset, runId } = useRun<LoopResult>(() =>
    runLoopDemo({ initialScore, targetScore, maxIterations, budget }),
  );

  function slider(
    label: string,
    value: number,
    min: number,
    max: number,
    setter: (v: number) => void,
  ) {
    const fill = ((value - min) / (max - min)) * 100;
    return (
      <label className="rg-row">
        <span className="rg-head">
          <span>{label}</span>
          <b>{value}</b>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          style={{ ["--fill" as string]: `${fill}%` }}
          onChange={(event) => {
            setter(Number(event.target.value));
            reset();
          }}
        />
      </label>
    );
  }

  return (
    <article className="lab-card studio-frame" id="loop-lab" style={{ ["--sc" as string]: "var(--ink-soft)" }}>
      <div className="lab-title">
        <span className="lab-index">02</span>
        <div>
          <p>闭环迭代控制</p>
          <h3>Loop Lab</h3>
        </div>
        <span className="maturity emerging">emerging</span>
      </div>
      <p className="lab-intro">
        模拟 Agent 自主迭代过程。调整目标要求、最大轮次与算力预算，观察系统是达成收敛还是在预算耗尽后安全退出。
      </p>
      <div className="tool-chips" aria-label="本次运行用到的能力">
        <span className="tool-chip">runLoopDemo</span>
        <span className="tool-chip">budget</span>
        <span className="tool-chip">validator</span>
        <span className="tool-chip">stop</span>
      </div>
      <div className="lab-workbench">
        <div className="range-grid">
          {slider("初始分数", initialScore, 0, 100, setInitialScore)}
          {slider("目标分数", targetScore, 0, 100, setTargetScore)}
          {slider("最大迭代", maxIterations, 1, 8, setMaxIterations)}
          {slider("预算", budget, 1, 8, setBudget)}
          <RunButton
            running={running}
            hasResult={result != null}
            label="运行 Loop"
            onClick={run}
          />
        </div>
        <div className="result-panel" aria-live="polite">
          {running ? (
            <div className="running-hint">
              <span className="spinner" aria-hidden="true" />
              正在迭代…
            </div>
          ) : result ? (
            <LoopResultView key={runId} result={result} />
          ) : (
            <EmptyState>调节参数后运行，观察评估器如何打分以及预算耗尽时的熔断表现。</EmptyState>
          )}
        </div>
      </div>
    </article>
  );
}

function LoopResultView({ result }: { result: LoopResult }) {
  const shown = useStagger(result.trace.length);
  return (
    <>
      <StatusPill
        kind={
          result.status === "converged"
            ? "ok"
            : result.status === "budget_exhausted"
              ? "warn"
              : "bad"
        }
        text={result.status}
      />
      <h4>
        迭代 {result.iterations} 次后分数 {result.finalScore}
      </h4>
      <div className="trace-list">
        {result.trace.slice(0, shown).map((item) => (
          <div className="trace-item anim" key={item.iteration}>
            <span className="ti-num">#{item.iteration}</span>
            {item.before} → {item.score} · {item.observation}
          </div>
        ))}
      </div>
    </>
  );
}

function GraphLab() {
  const [anchorEnabled, setAnchorEnabled] = useState(false);
  const [vetoEnabled, setVetoEnabled] = useState(false);
  const { result, running, run, reset, runId } = useRun<GraphResult>(() =>
    runGraphDemo({ anchorEnabled, vetoEnabled }),
  );

  return (
    <article className="lab-card studio-frame" id="graph-lab" style={{ ["--sc" as string]: "var(--ink)" }}>
      <div className="lab-title">
        <span className="lab-index">03</span>
        <div>
          <p>多智能体治理</p>
          <h3>Graph Lab</h3>
        </div>
        <span className="maturity proposed">proposed</span>
      </div>
      <p className="lab-intro">
        复现“各子模块局部达标，但核心业务目标恶化”的失控陷阱，观察全局约束锚点与否决机制的纠偏效果。
      </p>
      <div className="tool-chips" aria-label="本次运行用到的能力">
        <span className="tool-chip">runGraphDemo</span>
        <span className="tool-chip">anchor</span>
        <span className="tool-chip">veto</span>
        <span className="tool-chip">ownership</span>
      </div>
      <div className="lab-workbench">
        <div className="control-stack">
          <Toggle
            checked={anchorEnabled}
            label="全局业务锚点"
            detail="设定不可被局部优化篡改的真实业务指标（如留存率）"
            onChange={(value) => {
              setAnchorEnabled(value);
              reset();
            }}
          />
          <Toggle
            checked={vetoEnabled}
            label="全局否决权机制"
            detail="当局部优化改动损害全局指标时触发熔断驳回"
            onChange={(value) => {
              setVetoEnabled(value);
              reset();
            }}
          />
          <RunButton
            running={running}
            hasResult={result != null}
            label="运行 Graph"
            onClick={run}
          />
        </div>
        <div className="result-panel" aria-live="polite">
          {running ? (
            <div className="running-hint">
              <span className="spinner" aria-hidden="true" />
              正在检查多循环治理…
            </div>
          ) : result ? (
            <GraphResultView key={runId} result={result} />
          ) : (
            <EmptyState>
              默认配置下将复现“局部优化全绿、全局目标恶化”的失控现象；开启全局锚点与否决机制后可自动纠偏。
            </EmptyState>
          )}
        </div>
      </div>
    </article>
  );
}

function GraphResultView({ result }: { result: GraphResult }) {
  const shown = useStagger(result.events.length + 1);
  const kind =
    result.status === "corrected"
      ? "ok"
      : result.status === "detected_not_corrected"
        ? "warn"
        : "bad";
  return (
    <>
      <StatusPill kind={kind} text={result.status} />
      <h4>{result.explanation}</h4>
      <div className="trace-list">
        {result.events.slice(0, shown).map((event, index) => (
          <div
            className={`trace-item anim ${
              event.kind === "veto" || event.kind === "recover"
                ? "ok"
                : event.kind === "blindness"
                  ? "bad"
                  : ""
            }`}
            key={`${event.kind}-${index}`}
          >
            <b>{event.kind}</b> · {event.text}
          </div>
        ))}
        {shown > result.events.length && (
          <div className="trace-item anim external">
            外部目标（真实续费率）: {result.retention}%
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- 知识网络（可点击高亮连接） ---------------- */

function KnowledgeNetwork() {
  const [focus, setFocus] = useState<string | null>("graph");
  const focusNode = knowledgeNodes.find((node) => node.id === focus);
  const neighbors = focus ? (knowledgeEdges[focus] ?? []) : [];
  const ledger = (conceptsData as { concepts: { tags: string[]; title: string; summary: string }[] }).concepts;
  const relatedLedger = focus
    ? ledger.filter((c) => relateToRadius(c).includes(focus as (typeof RADIUS)[number]["id"])).length
    : 0;

  return (
    <>
      <p className="kn-hint">
        点击任意卡片，高亮查看该概念在系统架构中的上下游关联与对比关系；再次点击取消高亮。
      </p>
      <div className="card-grid cols-3 kn-grid">
        {knowledgeNodes.map((node) => {
          const state =
            focus == null
              ? ""
              : node.id === focus
                ? "lit"
                : neighbors.includes(node.id)
                  ? "linked"
                  : "dim";
          return (
            <button
              type="button"
              className={`mini-card kn-card ${state}`}
              key={node.id}
              style={{ ["--sc" as string]: node.color }}
              aria-pressed={focus === node.id}
              onClick={() => setFocus((current) => (current === node.id ? null : node.id))}
            >
              <div className="eyebrow">{node.eyebrow}</div>
              <h4>{node.title}</h4>
              <p>{node.note}</p>
              <small>{node.links}</small>
            </button>
          );
        })}
      </div>
      {focusNode && (
        <div className="kn-focus" style={{ ["--sc" as string]: focusNode.color }}>
          <span>
            <b>{focusNode.title}</b> 的关联节点：
            {neighbors.length > 0
              ? neighbors
                  .map((id) => knowledgeNodes.find((n) => n.id === id)?.title ?? id)
                  .join("、")
              : "暂无下游依赖"}
          </span>
          <div className="kn-focus-actions">
            {relatedLedger > 0 && (
              <a className="text-button" href={`/concepts?radius=${focusNode.id}`}>
                概念馆相关 {relatedLedger} 条 →
              </a>
            )}
            <a className="text-button" href={RADIUS.find((r) => r.id === focusNode.id)?.foundation ?? "/agent-foundations.html"}>
              基础馆深读
            </a>
            <button type="button" className="text-button" onClick={() => setFocus(null)}>
              清除高亮
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- 协议章节 ---------------- */

function ProtocolLab() {
  return (
    <div className="protocol-lab">
      <h3>协议选型与职责划分：MCP · ACP · CLI · A2A · Agent Card · Skill</h3>
      <p className="sec-sub" style={{ marginBottom: 12 }}>
        根据通信两端角色与交互复杂度进行技术选型。MCP、ACP 与 A2A 分属不同层级，各司其职、互为补充。
      </p>

      <div className="tldr" style={{ ["--sc" as string]: "var(--ink-soft)" }}>
        <div className="k">架构选型建议</div>
        <div className="v">
          外层 Agent 通过 MCP <code>knowledge_chat</code> 调用知识能力时，应保留
          MCP；先做好上下文边界治理。等未来演进出跨团队独立 Agent、长周期任务生命周期与复杂工件（Artifact）交付时，再在上层引入 A2A Adapter 进行异步任务委托，无须重写底层知识库。
        </div>
      </div>

      <div className="comparison-table protocol-table cols-5" role="table" aria-label="MCP、ACP 与 A2A 对比">
        <div className="comparison-row comparison-head" role="row">
          <span role="columnheader">场景</span>
          <span role="columnheader">MCP</span>
          <span role="columnheader">ACP</span>
          <span role="columnheader">A2A</span>
          <span role="columnheader">选型要点</span>
        </div>
        {[
          ["通信两端", "Agent ↔ 外部工具/数据源", "Client ↔ 本地 Agent", "独立 Agent ↔ 独立 Agent", "先明确两端通信实体，再定协议架构"],
          ["知识查询与能力调用", "首选方案（统一接口与数据结构）", "不适用（非会话控制场景）", "不推荐（仅数据调用无需对等协同）", "本质是能力调用，按标准 Tool 接入即可"],
          ["IDE 内完整编码会话", "能力不足（缺乏长生命周期会话）", "首选方案（子进程双向驱动）", "不推荐（本机会话无需跨网络协商）", "编辑器通过 stdio 实时驱动本地编码 Agent"],
          ["能力与服务发现", "tools/list 接口规范", "客户端启动协商 / 初始化", "Agent Card（声明式元数据）", "API 菜单 vs 进程协商 vs 服务名片"],
          ["跨团队任务委托", "不推荐（缺乏异步长任务原语）", "不适用（局限于本机单会话）", "原生支持（异步委派与事件流）", "面向跨系统、跨网络的长周期协作"],
          ["任务中断/恢复与流式推送", "需业务层自行封装", "支持在 stdio 会话内中断", "协议原生提供全生命周期管理", "按任务时长与可靠性要求选择协议层级"],
        ].map((row) => (
          <div className="comparison-row" role="row" key={row[0]}>
            {row.map((cell, ci) => (
              <span role="cell" key={cell} className={ci === 0 ? "row-key" : undefined}>
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="card-grid cols-3" style={{ marginTop: 16 }}>
        <article className="mini-card" style={{ ["--sc" as string]: "var(--ink)" }}>
          <div className="eyebrow">Agent ↔ 工具</div>
          <h4>MCP</h4>
          <p>统一工具、API 与数据源的接入规范，强调参数校验与结构化返回结果。</p>
          <small>类比：为智能体装上标准化的通用接口</small>
        </article>
        <article className="mini-card" style={{ ["--sc" as string]: "#8a6234" }}>
          <div className="eyebrow">Client ↔ Agent</div>
          <h4>ACP</h4>
          <p>宿主软件拉起本地 Agent 子进程，通过 stdio/RPC 高效驱动代码编辑与交互。</p>
          <small>类比：IDE 与本地助手之间的专属双向会话通道</small>
        </article>
        <article className="mini-card" style={{ ["--sc" as string]: "#c46a2b" }}>
          <div className="eyebrow">本地进程</div>
          <h4>Agent CLI</h4>
          <p>原生支持 stdio 通信的本地编码智能体，直接操作工作区代码库。</p>
          <small>类比：常驻终端的自动化结对开发助手</small>
        </article>
        <article className="mini-card" style={{ ["--sc" as string]: "var(--ink-soft)" }}>
          <div className="eyebrow">Agent ↔ Agent</div>
          <h4>A2A</h4>
          <p>面向独立部署智能体之间的服务发现、任务委派与长流程状态流转。</p>
          <small>类比：多智能体分布式协同与工作流协议</small>
        </article>
        <article className="mini-card" style={{ ["--sc" as string]: "var(--slate)" }}>
          <div className="eyebrow">公开身份</div>
          <h4>Agent Card</h4>
          <p>对外公布的机器可读名片，包含端点地址、认证方式与能力范围描述。</p>
          <small>类比：分布式服务契约，不同于内部的 SKILL.md</small>
        </article>
      </div>

      <div className="codebox" style={{ marginTop: 16 }}>
        <div className="cb-head">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>分层架构设计实践</span>
        </div>
        <pre>{`编辑器 / IM 宿主
  └─ ACP：拉起本地 CLI Agent，通过 stdio 驱动完整编码交互

核心业务 Agent
  ├─ MCP：短请求、确定性工具调用、knowledge_chat
  ├─ ACP：在需要本地编码辅助时，与本地工作区 Agent 对接
  └─ A2A：长周期任务、异步协作、跨团队独立 Agent 委托

知识库 / 内部服务
  └─ MCP：内部检索、HSCode、合规等业务工具接口

避坑提示：避免将完整长会话 Agent 粗暴包装为单次调用的 MCP 工具；A2A contextId 可映射为底层的会话 ID`}</pre>
      </div>

      <h3 style={{ marginTop: 28 }}>场景判断：该留 MCP 还是上 A2A？</h3>
      <Quiz storageKey="ai-lab-quiz-protocol" items={protocolQuiz} color="#0891b2" />

      <div className="callout tip">
        <div className="ct">常见概念辨析</div>
        <div>
          Tool Calling 解决模型如何调用函数；MCP 规范了工具与数据源的接入标准；ACP 解决了客户端（如 IDE）如何精确控制本地 Agent 进程；CLI 是可直接在终端交互的实体程序；Skill 是工程层面的工作流编排规范；Agent Card 与 A2A 则是跨网络 Agent 互相发现与委托协作的标准。按实际场景选择协议层级，切勿过度设计。
        </div>
      </div>
    </div>
  );
}

/* ---------------- Skill 章节 ---------------- */

function SkillLab() {
  return (
    <section className="lesson" id="sec-skill" style={{ ["--sc" as string]: "#7c3aed" }}>
      <div className="sec-head">
        <span className="sec-num">3</span>
        <h2>Skill：构建模块化、低上下文损耗的能力包</h2>
      </div>
      <p className="sec-sub">
        Skill 并非单纯把 Prompt 写长，而是按需渐进加载的工程规范：先路由匹配，再加载核心流程，细则与脚本仅在执行时按需读取。
      </p>

      <div className="tldr">
        <div className="k">核心结构</div>
        <div className="v">
          一个标准 Skill 真正必需的只有：一个独立目录 + `SKILL.md`。`references/`、`scripts/`、`assets/`
          都是按需添加的可选资源，不是必需项。
        </div>
      </div>

      <h3>最小形态 vs 推荐结构</h3>
      <div className="card-grid">
        <div className="codebox">
          <div className="cb-head">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>最小 Skill</span>
          </div>
          <pre>{`my-skill/
└── SKILL.md`}</pre>
        </div>
        <div className="codebox">
          <div className="cb-head">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>完整推荐结构</span>
          </div>
          <pre>{`my-skill/
├── SKILL.md
├── agents/openai.yaml
├── scripts/
├── references/
└── assets/`}</pre>
        </div>
      </div>

      <div className="callout tip">
        <div className="ct">构件分工原则</div>
        <div>
          `SKILL.md` 是操作流程规范，`references` 是参考资料库，`scripts` 承载确定性自动化脚本，`assets`
          存放产物样板与模板，协同构成完整的工程化能力包。
        </div>
      </div>

      <h3>三级加载：降低上下文开销</h3>
      <div className="level-stack">
        <div className="level-card">
          <b>第一级 · name + description</b>
          <div>常驻上下文的轻量描述：负责意图匹配与触发判断。</div>
        </div>
        <div className="level-card">
          <b>第二级 · SKILL.md 正文</b>
          <div>命中后载入：包含执行步骤、分支决策、验收规范及资源索引。</div>
        </div>
        <div className="level-card">
          <b>第三级 · references / scripts / assets</b>
          <div>特定任务分支需要时按需读取，避免一次性塞入全部资料导致上下文膨胀。</div>
        </div>
      </div>

      <h3>内容分类判定</h3>
      <Quiz storageKey="ai-lab-quiz-skill" items={skillPlacementQuiz} color="#7c3aed" />

      <h3>Skill 形态与触发方式</h3>
      <div className="card-grid cols-3">
        {[
          ["纯流程型", "仅包含 SKILL.md", "适用于逻辑清晰的推导与审核流程"],
          ["流程 + Reference", "主流程稳定，分支查阅资料", "适用于包含复杂业务政策、术语表的场景"],
          ["流程 + Script", "LLM 决策 + 确定性脚本自动化", "适用于数据清洗、环境检测等自动化任务"],
          ["流程 + Asset", "定义结构规范，模板提供骨架", "适用于代码样板、文档模板生成"],
          ["路由型 Skill", "不执行具体业务，负责任务分发", "适用于作为复杂系统的统一入口"],
          ["工程流水线", "多个 Skill 串联成标准化交付链路", "需求深挖 → 规格制定 → 任务拆解 → 测试实现"],
        ].map(([title, note, tip]) => (
          <div className="mini-card" key={title} style={{ ["--sc" as string]: "#7c3aed" }}>
            <div className="eyebrow">{note}</div>
            <h4>{title}</h4>
            <p>{tip}</p>
          </div>
        ))}
      </div>

      <h3>标准化研发工作流流水线</h3>
      <div className="roadline" aria-label="Skill 组合流水线">
        {[
          ["需求", "需求澄清与对齐", "把模糊诉求梳理透彻"],
          ["规格", "编写技术规格", "形成可执行的技术方案"],
          ["拆解", "工单任务拆分", "拆解为独立可验证的任务"],
          ["实现", "测试驱动开发", "遵循 TDD 编写测试与代码"],
          ["审查", "代码合规审查", "对照工程标准自动化验收"],
        ].map(([year, title, detail]) => (
          <div className="road-node" key={title} style={{ ["--rc" as string]: "#7c3aed" }}>
            <div className="rn-y">{year}</div>
            <div className="rn-t">{title}</div>
            <div className="rn-d">{detail}</div>
          </div>
        ))}
      </div>

      <table className="skill-table">
        <thead>
          <tr>
            <th>关系类型</th>
            <th>工程示例</th>
            <th>在当前系统中的对应</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>调用关系</td>
            <td>implement 依赖 tdd</td>
            <td>前沿追踪 Skill 驱动数据清洗脚本与页面渲染</td>
          </tr>
          <tr>
            <td>前后阶段</td>
            <td>to-spec → to-tickets</td>
            <td>文献核验 → 架构建图 → 交互实验 → 实践诊断</td>
          </tr>
          <tr>
            <td>共享规范</td>
            <td>多个 Skill 共用 codebase-design</td>
            <td>Harness / Loop / Graph 共用架构层级约定</td>
          </tr>
        </tbody>
      </table>

      <div className="callout info">
        <div className="ct">优秀 Skill 的工程标准</div>
        <div>
          目标不是强制要求每次输出字字一致，而是确保 Agent 每次都遵循清晰可预测的工程流程。入口流程在 `SKILL.md`，业务文档与规范按需读取，确定性逻辑交由自动化脚本稳定执行。
        </div>
      </div>
    </section>
  );
}

/* ---------------- 场景诊断 ---------------- */

function TacitBridge() {
  const [revealed, setRevealed] = useLocalStorage<number[]>("ai-lab-tacit-revealed", []);
  const [notes, setNotes] = useLocalStorage<Record<string, string>>(
    "ai-lab-tacit-notes",
    {},
  );

  return (
    <section className="lesson" id="sec-tacit" style={{ ["--sc" as string]: "#d97706" }}>
      <div className="sec-head">
        <span className="sec-num">4</span>
        <h2>场景诊断：工程实践与信号定位</h2>
      </div>
      <p className="sec-sub">
        面对复杂的 Agent 异常现象，从可观察的系统信号切入，快速定位问题究竟出在执行环境、闭环控制还是全局治理层。
      </p>
      <div className="tacit-grid">
        {tacitCards.map((card, index) => {
          const isRevealed = revealed.includes(index);
          return (
            <article className="tacit-card" key={card.title}>
              <span className="tacit-number">0{index + 1}</span>
              <h3>{card.title}</h3>
              <p>{card.situation}</p>
              <textarea
                aria-label={`${card.title}：写下你的观察`}
                placeholder="先写下你的观察与诊断依据…"
                value={notes[index] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [index]: event.target.value }))
                }
              />
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setRevealed((current) =>
                    current.includes(index) ? current : [...current, index],
                  )
                }
                disabled={isRevealed}
              >
                {isRevealed ? "诊断线索已展开" : "展开诊断线索"}
              </button>
              {isRevealed && <div className="cue-answer">{card.cues}</div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}


/* ---------------- 主组件 ---------------- */

export function LearningLab() {
  const [activeId, setActiveId] = useState("sec-0");
  const [done, setDone] = useLocalStorage<string[]>("ai-lab-done", []);
  const [toast, showToast] = useToast();

  /* 章节 scroll-spy + 完成记录 */
  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveId(visible.target.id);
          setDone((current) =>
            current.includes(visible.target.id)
              ? current
              : [...current, visible.target.id],
          );
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.15, 0.35, 0.6] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [setDone]);

  /* 滚动进入动画：首屏内容立即显示，其余进入视口时快速淡入 */
  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".lesson > *, .lab-card, .mini-card, .tacit-card, .source-card, .course-card, .card, .level-card",
      ),
    );

    // 网格内子项做小错峰（上限 3 档 × 45ms），其余无延迟
    document
      .querySelectorAll<HTMLElement>(".card-grid, .source-grid, .course-grid, .tacit-grid")
      .forEach((grid) => {
        Array.from(grid.children).forEach((child, index) => {
          child.style.setProperty("--d", `${Math.min(index, 3) * 45}ms`);
        });
      });

    // 不支持 IntersectionObserver 时直接全部显示，保证内容永远可见
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("reveal", "in"));
      return;
    }

    targets.forEach((el) => {
      el.classList.add("reveal");
      const rect = el.getBoundingClientRect();
      // 已在视口内（或视口上方）的元素立即显示：不等待观察器，避免首屏闪动
      if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
        el.classList.add("in");
      }
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -2% 0px" },
    );
    targets.forEach((el) => {
      if (!el.classList.contains("in")) io.observe(el);
    });

    return () => io.disconnect();
  }, []);

  const activeItem = navItems.find((item) => item.id === activeId) ?? navItems[0];
  const ledgerUpdated = String((conceptsData as { updatedAt: string }).updatedAt).slice(0, 10);

  return (
    <LabShell
      wing={activeId === "sec-network" ? "network" : "home"}
      logo="本章"
      tag="架构全景 · 协议选型 · 闭环实践"
      searchExtra={[
        { href: "/#harness-lab", label: "Harness Lab", hint: "执行环境", kind: "Demo", id: "sec-labs" },
        { href: "/#loop-lab", label: "Loop Lab", hint: "闭环迭代", kind: "Demo", id: "sec-labs" },
        { href: "/#graph-lab", label: "Graph Lab", hint: "协同治理", kind: "Demo", id: "sec-labs" },
        { href: "/#sec-sources", label: "一手来源", hint: "技术文献", kind: "来源", id: "sec-sources" },
        { href: "/concepts", label: "前沿概念", hint: "持续追踪", kind: "概念" },
      ]}
      navItems={navItems}
      activeId={activeId}
      onActive={(id) => {
        setActiveId(id);
      }}
      done={done}
      onReset={() => {
        setDone([]);
        showToast("学习进度已重置");
      }}
      crumb={`${activeItem.num} · ${activeItem.label}`}
      extra={
        <>
          <MentorPanel activeId={activeId} />
          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </>
      }
      footer={
          <footer className="pagefoot">
            AI Learning Lab · 面向工程师与产品技术人员的 Agent 架构实践平台。
            <br />
            基础馆课程核对于 {CURRICULUM_AS_OF}；概念馆更新于 {ledgerUpdated}。学习进度仅保存在当前浏览器。
            <div>
              <a href="/agent-foundations.html">基础馆</a>
              <a href="/concepts">概念馆</a>
              <a href="/git-workflow.html">Git 实验室</a>
              <a href="/jev-system-one.html">Jev 技术综述</a>
              <a href="#sec-skill">Skill 体系</a>
              <a href="#sec-sources">来源</a>
            </div>
          </footer>
      }
    >
          <section className="lesson" id="sec-0" style={{ ["--sc" as string]: "var(--ink)" }}>
            <div className="hello">
              <p className="eyebrow">今日</p>
              <h1>
                前沿技术，逐项验证
                <span className="tone"> 系统构建 Agent 工程知识体系</span>
              </h1>
              <p className="sub">
                一手技术文献 × 架构全景图 × 可交互实验台 × 结构化 Skill 规范。选择一个起点，开始探索。
              </p>
              <p className="today-path" aria-label="今日路径">
                今日路径：知识网络 → Graph Demo → 场景诊断 → 基础馆
              </p>
            </div>
            <div className="start-grid">
              <a className="start-card" href="#sec-network">
                <span className="start-k">全景</span>
                <div className="start-preview" aria-hidden="true">
                  <i style={{ left: 10, top: 16, width: 42, height: 28 }} />
                  <i style={{ left: 62, top: 22, width: 36, height: 22 }} />
                  <i style={{ left: 108, top: 14, width: 48, height: 34 }} />
                </div>
                <h2>知识网络</h2>
                <p>Agent 架构全景与协议关系图谱。</p>
              </a>
              <a className="start-card" href="#sec-labs">
                <span className="start-k">实验</span>
                <div className="start-preview" aria-hidden="true">
                  <i style={{ left: 12, top: 12, width: "70%", height: 10 }} />
                  <i style={{ left: 12, top: 30, width: "40%", height: 10 }} />
                  <i style={{ left: 12, top: 48, width: 18, height: 10, background: "var(--lime)" }} />
                </div>
                <h2>Harness / Loop / Graph Demo</h2>
                <p>交互式实验台：执行环境、闭环迭代、协同治理。</p>
              </a>
              <a className="start-card" href="/agent-foundations.html">
                <span className="start-k">教程</span>
                <div className="start-preview" aria-hidden="true">
                  <i style={{ left: 12, top: 14, width: "80%", height: 8 }} />
                  <i style={{ left: 12, top: 30, width: "55%", height: 8 }} />
                  <i style={{ left: 12, top: 46, width: "66%", height: 8 }} />
                </div>
                <h2>基础馆</h2>
                <p>从 Tool Calling 到多智能体架构的系统化教程。</p>
              </a>
              <a className="start-card" href="/agent-foundations.html#sec-acp">
                <span className="start-k">协议</span>
                <div className="start-preview" aria-hidden="true">
                  <i style={{ left: 14, top: 18, width: 36, height: 28 }} />
                  <i style={{ left: 62, top: 22, width: 22, height: 8 }} />
                  <i style={{ left: 92, top: 18, width: 40, height: 28 }} />
                </div>
                <h2>ACP / CLI</h2>
                <p>客户端与本地 Agent 进程间的会话协议。</p>
              </a>
              <a className="start-card" href="/concepts">
                <span className="start-k">追踪</span>
                <div className="start-preview" aria-hidden="true">
                  <i style={{ left: 10, top: 12, width: "45%", height: 48 }} />
                  <i style={{ left: "52%", top: 12, width: "40%", height: 48 }} />
                </div>
                <h2>前沿概念</h2>
                <p>自动追踪前沿技术文献，分类索引持续更新。</p>
              </a>
              <a className="start-card" href="/git-workflow.html">
                <span className="start-k">实验</span>
                <div className="start-preview" aria-hidden="true">
                  <i style={{ left: 20, top: 18, width: 14, height: 14, borderRadius: 99 }} />
                  <i style={{ left: 50, top: 28, width: 14, height: 14, borderRadius: 99 }} />
                  <i style={{ left: 80, top: 18, width: 14, height: 14, borderRadius: 99 }} />
                </div>
                <h2>Git</h2>
                <p>图形化理解分支策略、合并与冲突解决。</p>
              </a>
              <a className="start-card" href="#sec-skill">
                <span className="start-k">规范</span>
                <div className="start-preview" aria-hidden="true">
                  <i style={{ left: 14, top: 14, width: 22, height: 44 }} />
                  <i style={{ left: 44, top: 14, width: "50%", height: 12 }} />
                  <i style={{ left: 44, top: 34, width: "38%", height: 12 }} />
                </div>
                <h2>Skill 体系</h2>
                <p>模块化工作流规范，按需渐进加载。</p>
              </a>
            </div>
            <div className="meta-chips" aria-label="馆藏规模">
                <span className="mc">3 个交互式实验</span>
                <span className="mc">Skill 工程规范</span>
                <span className="mc">场景诊断训练</span>
                <span className="mc">System One 模型综述</span>
                <span className="mc">课程核对 {CURRICULUM_AS_OF}</span>
                <span className="mc">概念更新 {ledgerUpdated}</span>
              </div>

            <div className="tldr">
              <div className="k">平台定位</div>
              <div className="v">
                AI Learning Lab 聚焦 Agent 工程实践：一手技术文献追踪 × 架构与协议全景 × 可交互机制实验 × 结构化 Skill 工作流规范。
              </div>
            </div>

            <h3>学习路径</h3>
            <div className="roadline">
              {[
                ["01", "文献核验", "追踪官方文档、论文与技术成熟度"],
                ["02", "架构建图", "梳理依赖关系、协议边界与反模式"],
                ["03", "机制实验", "Harness / Loop / Graph 交互式验证"],
                ["04", "Skill 整合", "流程规范、参考文档、脚本与模板"],
                ["05", "实践诊断", "从系统信号定位问题层级"],
              ].map(([year, title, detail]) => (
                <div className="road-node" key={year} style={{ ["--rc" as string]: "var(--ink)" }}>
                  <div className="rn-y">{year}</div>
                  <div className="rn-t">{title}</div>
                  <div className="rn-d">{detail}</div>
                </div>
              ))}
            </div>

            <div className="btn-row">
              <a className="btn primary" href="#sec-labs">
                进入实验台
              </a>
              <a className="btn" href="#sec-skill">
                查看 Skill 规范
              </a>
              <a className="btn" href="/agent-foundations.html">
                进入基础馆
              </a>
              <a className="btn" href="/concepts">
                前沿概念追踪（持续更新）
              </a>
            </div>
          </section>

          <section
            className="lesson"
            id="sec-network"
            style={{ ["--sc" as string]: "var(--ink)" }}
          >
            <div className="sec-head">
              <span className="sec-num">1</span>
              <h2>知识网络：架构全景与协议对照</h2>
            </div>
            <p className="sec-sub">
              覆盖从单工具调用到多循环协同治理的完整链路，并将 MCP、ACP、CLI、A2A、Agent
              Card、Skill 纳入同一张架构对照图。
            </p>
            <div className="studio-frame">
              <div className="studio-frame-bar">知识网络</div>
              <div style={{ padding: "16px 20px 20px" }}>
                <KnowledgeNetwork />
              </div>
            </div>
            <div className="comparison-table" role="table" aria-label="工程与协议层级对比">
              <div className="comparison-row comparison-head" role="row">
                <span role="columnheader">层级</span>
                <span role="columnheader">核心问题</span>
                <span role="columnheader">可运行产物</span>
                <span role="columnheader">典型误区</span>
              </div>
              {[
                ["Harness", "一次运行能不能完成？", "工具、日志、约束、完成证明", "只改提示，不改环境"],
                ["Loop", "重复运行能不能收敛？", "状态、验证器、预算、停止条件", "无限重试等于自动化"],
                ["Graph", "多个循环会不会共同漂移？", "所有权、否决边、节奏、外部锚点", "局部指标全绿就是成功"],
                ["Skill", "能力如何分层复用？", "手册、资料、脚本、素材、路由", "写成超长提示词一次塞满"],
                ["MCP", "工具/数据如何标准化接入？", "tools/list、schema、结构化结果", "把 MCP 当成 Agent 社交协议"],
                ["ACP", "客户端如何驱动本地 Agent 会话？", "stdio 子进程、JSON-RPC、NDJSON 流", "把 ACP 当成 MCP 或 A2A"],
                ["CLI", "Agent 作为一条本地命令如何跑？", "Grok CLI / Codex CLI 等 stdio agent", "把编码 Agent 再包成 MCP 工具就当完事"],
                ["A2A / Card", "独立 Agent 如何发现与协作？", "Agent Card、Task、委托与推送", "用 A2A 替换掉一切 MCP 调用"],
              ].map((row) => (
                <div className="comparison-row" role="row" key={row[0]}>
                  {row.map((cell, ci) => (
                    <span role="cell" key={cell} className={ci === 0 ? "row-key" : undefined}>
                      {cell}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <ProtocolLab />
          </section>

          <section className="lesson" id="sec-labs" style={{ ["--sc" as string]: "var(--emerald)" }}>
            <div className="sec-head">
              <span className="sec-num">2</span>
              <h2>技术复现 Demo：机制交互验证</h2>
            </div>
            <p className="sec-sub">
              每个实验复现一项技术机制：通过调整配置改变可观察状态，并明确呈现成功、失败或停止的具体原因。
            </p>
            <HarnessLab />
            <LoopLab />
            <GraphLab />
          </section>

          <SkillLab />
          <TacitBridge />

          <section
            className="lesson"
            id="sec-courses"
            style={{ ["--sc" as string]: "var(--ink-soft)" }}
          >
            <div className="sec-head">
              <span className="sec-num">5</span>
              <h2>深入课程：同一路径的下一站</h2>
            </div>
            <p className="sec-sub">
              首页提供架构对照与机制实验；基础馆将同一知识体系拆分为渐进式章节；概念馆将新入库条目归档至对应主题节点。各馆共用顶栏与学习路径。
            </p>
            <div className="course-grid cols-3">
              <a className="course-card exhibit" href="/agent-foundations.html">
                <span>基础馆 · 静态课程</span>
                <h3>Agent 基础馆</h3>
                <p>
                  Tool → ReAct → Loop → MCP → ACP/CLI → Multi-Agent → Skill → A2A。课程事实核对于 {CURRICULUM_AS_OF}。
                </p>
                <b>进入展厅 →</b>
              </a>
              <a className="course-card exhibit" href="/concepts">
                <span>概念馆 · 每日更新</span>
                <h3>前沿概念馆</h3>
                <p>一手来源自动入库，按主题网络索引。数据更新于 {ledgerUpdated}。</p>
                <b>进入展厅 →</b>
              </a>
              <a className="course-card exhibit" href="/git-workflow.html">
                <span>Git 实验室</span>
                <h3>Git 协作实验室</h3>
                <p>用图形化提交网络理解 merge、rebase、冲突与远端同步。</p>
                <b>进入课程 →</b>
              </a>
              <a className="course-card exhibit" href="/jev-system-one.html" style={{ gridColumn: "1 / -1" }}>
                <span>前沿模型馆 · 技术综述</span>
                <h3>TypeSafe Jev：System One 决策模型</h3>
                <p>不生成文本、只输出带校准概率的结构化决策。官方声称与第三方实测对比、开源复现路线与争议分析，四级证据分级呈现。</p>
                <b>进入展厅 →</b>
              </a>
            </div>
            <div className="chapter-jump">
              <span className="cj-k">直达基础馆章节</span>
              <div className="cj-row">
                {[
                  ["#sec-1", "1 Tool"],
                  ["#sec-2", "2 ReAct"],
                  ["#sec-3", "3 Loop"],
                  ["#sec-4", "4 MCP"],
                  ["#sec-acp", "6 ACP/CLI"],
                  ["#sec-6", "7 架构"],
                  ["#sec-skill", "8 Skill"],
                  ["#sec-7", "9 雷达"],
                ].map(([hash, label]) => (
                  <a key={hash} href={`/agent-foundations.html${hash}`}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section
            className="lesson"
            id="sec-sources"
            style={{ ["--sc" as string]: "var(--ink)" }}
          >
            <div className="sec-head">
              <span className="sec-num">6</span>
              <h2>一手来源</h2>
            </div>
            <p className="sec-sub">
              “Graph Engineering”当前标记为 proposed；来源支持定义，不等于证明行业已形成统一标准。
            </p>
            <div className="source-grid">
              {sources.map((source) => (
                <a
                  className="source-card context-card"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  key={source.label}
                >
                  <div>
                    <span>{source.publisher}</span>
                    <i className={`maturity ${source.maturity}`}>{source.maturity}</i>
                  </div>
                  <h3>{source.label}</h3>
                  <p className="chunk">{source.note}</p>
                  <div className="chunk-src">
                    <span className="tool-chip">一手来源</span>
                    <small>
                      {source.date} · {source.note.length} 字 · 打开原始来源 ↗
                    </small>
                  </div>
                </a>
              ))}
            </div>
          </section>

    </LabShell>
  );
}
