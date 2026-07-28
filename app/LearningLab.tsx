"use client";

import { useEffect, useMemo, useState } from "react";
import {
  runGraphDemo,
  runHarnessDemo,
  runLoopDemo,
  type GraphResult,
  type HarnessConfig,
  type HarnessResult,
  type LoopResult,
} from "./lab-model.mjs";

const navItems = [
  { id: "sec-0", num: "0", label: "总览与学习地图", color: "#64748b" },
  { id: "sec-network", num: "1", label: "知识网络", color: "#2563eb" },
  { id: "sec-labs", num: "2", label: "技术复现实验", color: "#059669" },
  { id: "sec-skill", num: "3", label: "Skill 体系", color: "#7c3aed" },
  { id: "sec-tacit", num: "4", label: "判断手感", color: "#d97706" },
  { id: "sec-courses", num: "5", label: "深入课程", color: "#0891b2" },
  { id: "sec-sources", num: "6", label: "一手来源", color: "#e11d48" },
];

const sources = [
  {
    label: "Harness Engineering",
    publisher: "OpenAI",
    date: "2026-02-11",
    maturity: "emerging",
    url: "https://openai.com/index/harness-engineering/",
    note: "Agent-first 团队如何设计可见环境、仓库知识、结构约束与反馈回路。",
  },
  {
    label: "Loop Engineering",
    publisher: "IBM",
    date: "2026-07-17",
    maturity: "emerging",
    url: "https://www.ibm.com/think/topics/loop-engineering",
    note: "目标、行动、观察、调整，以及调度、状态、工具和人工门禁。",
  },
  {
    label: "Graph Engineering",
    publisher: "Eigent",
    date: "2026-07-21",
    maturity: "proposed",
    url: "https://www.eigent.ai/blog/graph-engineering-ai-agents",
    note: "多个反馈循环之间的权威、节奏、否决边与外部锚点；仍是单一组织提出的新标签。",
  },
  {
    label: "A2A and MCP",
    publisher: "A2A Project",
    date: "持续更新",
    maturity: "established",
    url: "https://a2acn.com/docs/topics/a2a-and-mcp/",
    note: "官方互补定位：MCP 连接工具与数据源，A2A 负责独立 Agent 间发现、任务协作与上下文交换。",
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
    note: "让模型能改变外部状态",
    links: "连接 → react / mcp",
    color: "#d97706",
  },
  {
    id: "react",
    eyebrow: "认知循环",
    title: "ReAct",
    note: "推理 → 行动 → 观察",
    links: "连接 → loop",
    color: "#7c3aed",
  },
  {
    id: "mcp",
    eyebrow: "工具协议",
    title: "MCP",
    note: "Agent ↔ 工具 / API / 数据源",
    links: "对比 → a2a / card",
    color: "#2563eb",
  },
  {
    id: "a2a",
    eyebrow: "协作协议",
    title: "A2A",
    note: "独立 Agent 间发现、委托、长任务",
    links: "依赖 → card · 对比 → mcp",
    color: "#0891b2",
  },
  {
    id: "card",
    eyebrow: "能力名片",
    title: "Agent Card",
    note: "公开身份、技能、端点与认证",
    links: "服务 → a2a · 不同于 → skill",
    color: "#c026d3",
  },
  {
    id: "skill",
    eyebrow: "能力模块",
    title: "Skill",
    note: "分层手册：路由、流程、资料、工具",
    links: "连接 → harness / mcp",
    color: "#7c3aed",
  },
  {
    id: "harness",
    eyebrow: "单次运行",
    title: "Harness Engineering",
    note: "环境、工具、可见性、约束、完成证据",
    links: "连接 → loop",
    color: "#059669",
  },
  {
    id: "loop",
    eyebrow: "重复运行",
    title: "Loop Engineering",
    note: "状态、验证、预算、停止与升级",
    links: "连接 → graph",
    color: "#0891b2",
  },
  {
    id: "graph",
    eyebrow: "多循环治理",
    title: "Graph Engineering",
    note: "目标所有权、冲突、节奏与外部锚点",
    links: "外部目标与治理锚点",
    color: "#e11d48",
  },
];

const protocolQuiz = [
  {
    id: "p1",
    prompt:
      "外层客服 Agent 调用内层知识库的 knowledge_chat：传入 message / conversation_id，返回答案。该用什么？",
    answer: "mcp",
    choices: [
      { id: "mcp", label: "保留 MCP：这是在调用一个知识能力/工具" },
      { id: "a2a", label: "立刻换成 A2A：因为内层也是 Agent" },
      { id: "both", label: "必须双协议并行，否则无法问答" },
    ],
    explain:
      "角色上像 Agent 调 Agent，协议上仍是外层调用一个知识能力。MCP 负责工具 schema、参数和结构化结果；A2A 在这里过重。",
  },
  {
    id: "p2",
    prompt: "你需要让对方 Agent 通过公开名片发现“我会什么、端点在哪、怎么认证”。核心构件是？",
    answer: "card",
    choices: [
      { id: "mcp", label: "MCP tools/list 菜单" },
      { id: "card", label: "Agent Card（.well-known/agent-card.json）" },
      { id: "skillmd", label: "本地 SKILL.md 目录" },
    ],
    explain:
      "Agent Card 是 A2A 的能力发现入口；MCP 的 tools/list 面向工具菜单，本地 Skill 面向宿主内渐进披露，不是跨 Agent 名片。",
  },
  {
    id: "p3",
    prompt: "出现跨团队独立部署、长任务取消/恢复、Artifact 交付时，更合理的演进是？",
    answer: "adapter",
    choices: [
      { id: "replace", label: "删掉 MCP，全部重写成 A2A" },
      { id: "adapter", label: "保留 MCP，外层加 A2A Adapter 处理长任务委托" },
      { id: "wrap", label: "把 A2A 客户端再包成一个 MCP 工具就够了" },
    ],
    explain:
      "官方定位是互补。未来应分层：短请求与确定性工具走 MCP，长任务与独立 Agent 委托走 A2A；只把 A2A 再包成 MCP 工具，往往只增加复杂度。",
  },
];

const tacitCards = [
  {
    title: "先看失败落在哪一层",
    situation:
      "Agent 会写代码，却总要人类复制日志和截图才能继续。你先注意到什么？",
    cues:
      "卡点跨任务重复；完成证据存在但在 Agent 视野外；重试没有带来新反馈。先补 Harness，而不是继续改提示。",
  },
  {
    title: "先看问题是否跨轮出现",
    situation:
      "手动执行很顺，一到每周自动运行就重复修改、无限重试。你先注意到什么？",
    cues:
      "单次运行能完成，缺的是跨轮状态、预算、停止和升级条件。问题落在 Loop。",
  },
  {
    title: "先看局部绿色是否背离真实目标",
    situation:
      "速度、质量分、成本指标都变绿，续费率却持续下降。你先注意到什么？",
    cues:
      "局部循环能解释自己的成功，但缺少共同目标所有者和不可自改的外部锚点。问题进入 Graph 层。",
  },
];

const skillPlacementQuiz = [
  {
    id: "q1",
    prompt: "“Agent 每次都必须先建立可复现的反馈循环，再提出假设。”",
    answer: "skill.md",
    choices: [
      { id: "skill.md", label: "SKILL.md（操作手册）" },
      { id: "references", label: "references/（资料库）" },
      { id: "scripts", label: "scripts/（工具箱）" },
      { id: "assets", label: "assets/（原材料）" },
    ],
    explain: "这是每次都必须执行的流程与判断，应放在 SKILL.md。",
  },
  {
    id: "q2",
    prompt: "“只有用户问到 Stripe 退款时才需要阅读的退款政策细节。”",
    answer: "references",
    choices: [
      { id: "skill.md", label: "SKILL.md（操作手册）" },
      { id: "references", label: "references/（资料库）" },
      { id: "scripts", label: "scripts/（工具箱）" },
      { id: "assets", label: "assets/（原材料）" },
    ],
    explain: "分支才需要的知识应渐进披露到 references，避免每次都塞进上下文。",
  },
  {
    id: "q3",
    prompt: "“把 JSONL 账本做 URL 规范化、内容指纹和 added/updated 判定。”",
    answer: "scripts",
    choices: [
      { id: "skill.md", label: "SKILL.md（操作手册）" },
      { id: "references", label: "references/（资料库）" },
      { id: "scripts", label: "scripts/（工具箱）" },
      { id: "assets", label: "assets/（原材料）" },
    ],
    explain: "重复、脆弱、要求稳定输出的确定性逻辑适合 scripts。",
  },
  {
    id: "q4",
    prompt: "“生成课程时要复制并改写的单文件 HTML 模板。”",
    answer: "assets",
    choices: [
      { id: "skill.md", label: "SKILL.md（操作手册）" },
      { id: "references", label: "references/（资料库）" },
      { id: "scripts", label: "scripts/（工具箱）" },
      { id: "assets", label: "assets/（原材料）" },
    ],
    explain: "最终产物要复制或加工的文件属于 assets，不是给 Agent 通读的资料。",
  },
];

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

function HarnessLab() {
  const [config, setConfig] = useState<HarnessConfig>({
    tools: true,
    observability: false,
    constraints: true,
    completionProof: true,
  });
  const [result, setResult] = useState<HarnessResult | null>(null);

  function update(key: keyof HarnessConfig, value: boolean) {
    setConfig((current) => ({ ...current, [key]: value }));
    setResult(null);
  }

  return (
    <article className="lab-card" id="harness-lab" style={{ ["--sc" as string]: "#059669" }}>
      <div className="lab-title">
        <span className="lab-index">01</span>
        <div>
          <p>单次运行控制半径</p>
          <h3>Harness Lab</h3>
        </div>
        <span className="maturity emerging">emerging</span>
      </div>
      <p className="lab-intro">
        亲手拆掉或补回 Agent 的执行环境，观察它究竟卡在行动、观察、约束还是完成证明。
      </p>
      <div className="lab-workbench">
        <div className="control-stack">
          <Toggle
            checked={config.tools}
            label="工具可调用"
            detail="文件、终端、浏览器与测试"
            onChange={(value) => update("tools", value)}
          />
          <Toggle
            checked={config.observability}
            label="环境可观察"
            detail="日志、指标与界面状态回到上下文"
            onChange={(value) => update("observability", value)}
          />
          <Toggle
            checked={config.constraints}
            label="结构约束"
            detail="依赖方向与边界由机器检查"
            onChange={(value) => update("constraints", value)}
          />
          <Toggle
            checked={config.completionProof}
            label="完成证据"
            detail="测试与用户路径决定何时停止"
            onChange={(value) => update("completionProof", value)}
          />
          <button
            className="run-button"
            type="button"
            onClick={() => setResult(runHarnessDemo(config))}
          >
            运行一次 Harness
          </button>
        </div>
        <div className="result-panel">
          {result ? (
            <>
              <span className={`status ${result.status === "completed" ? "ok" : "bad"}`}>
                {result.status}
              </span>
              <h4>{result.explanation}</h4>
              <div className="trace-list">
                {result.trace.map((item) => (
                  <div
                    className={`trace-item ${item.ok ? "ok" : "bad"}`}
                    key={`${item.phase}-${item.text}`}
                  >
                    <b>{item.phase}</b> · {item.text}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">先切换开关，再运行。失败原因会停在第一个缺失能力。</p>
          )}
        </div>
      </div>
    </article>
  );
}

function LoopLab() {
  const [initialScore, setInitialScore] = useState(35);
  const [targetScore, setTargetScore] = useState(80);
  const [maxIterations, setMaxIterations] = useState(5);
  const [budget, setBudget] = useState(3);
  const [result, setResult] = useState<LoopResult | null>(null);

  return (
    <article className="lab-card" id="loop-lab" style={{ ["--sc" as string]: "#0891b2" }}>
      <div className="lab-title">
        <span className="lab-index">02</span>
        <div>
          <p>重复运行控制半径</p>
          <h3>Loop Lab</h3>
        </div>
        <span className="maturity emerging">emerging</span>
      </div>
      <p className="lab-intro">
        调整目标、迭代上限和预算，观察循环是真实收敛，还是在耗尽预算后诚实停下。
      </p>
      <div className="lab-workbench">
        <div className="range-grid">
          <label>
            初始分数 {initialScore}
            <input
              type="range"
              min={0}
              max={100}
              value={initialScore}
              onChange={(event) => {
                setInitialScore(Number(event.target.value));
                setResult(null);
              }}
            />
          </label>
          <label>
            目标分数 {targetScore}
            <input
              type="range"
              min={0}
              max={100}
              value={targetScore}
              onChange={(event) => {
                setTargetScore(Number(event.target.value));
                setResult(null);
              }}
            />
          </label>
          <label>
            最大迭代 {maxIterations}
            <input
              type="range"
              min={1}
              max={8}
              value={maxIterations}
              onChange={(event) => {
                setMaxIterations(Number(event.target.value));
                setResult(null);
              }}
            />
          </label>
          <label>
            预算 {budget}
            <input
              type="range"
              min={1}
              max={8}
              value={budget}
              onChange={(event) => {
                setBudget(Number(event.target.value));
                setResult(null);
              }}
            />
          </label>
          <button
            className="run-button"
            type="button"
            onClick={() =>
              setResult(
                runLoopDemo({
                  initialScore,
                  targetScore,
                  maxIterations,
                  budget,
                }),
              )
            }
          >
            运行 Loop
          </button>
        </div>
        <div className="result-panel">
          {result ? (
            <>
              <span
                className={`status ${
                  result.status === "converged"
                    ? "ok"
                    : result.status === "budget_exhausted"
                      ? "warn"
                      : "bad"
                }`}
              >
                {result.status}
              </span>
              <h4>
                迭代 {result.iterations} 次后分数 {result.finalScore}
              </h4>
              <div className="trace-list">
                {result.trace.map((item) => (
                  <div className="trace-item" key={item.iteration}>
                    #{item.iteration}：{item.before} → {item.score} · {item.observation}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">试着把预算设得比目标所需更小，看它如何报告预算耗尽。</p>
          )}
        </div>
      </div>
    </article>
  );
}

function GraphLab() {
  const [anchorEnabled, setAnchorEnabled] = useState(false);
  const [vetoEnabled, setVetoEnabled] = useState(false);
  const [result, setResult] = useState<GraphResult | null>(null);

  return (
    <article className="lab-card" id="graph-lab" style={{ ["--sc" as string]: "#e11d48" }}>
      <div className="lab-title">
        <span className="lab-index">03</span>
        <div>
          <p>多循环治理控制半径</p>
          <h3>Graph Lab</h3>
        </div>
        <span className="maturity proposed">proposed</span>
      </div>
      <p className="lab-intro">
        复现“局部指标全绿但外部目标下跌”，再用外部锚点与否决边纠正互相冲突的循环。
      </p>
      <div className="lab-workbench">
        <div className="control-stack">
          <Toggle
            checked={anchorEnabled}
            label="外部锚点"
            detail="不可被局部循环自行改写的真实目标"
            onChange={(value) => {
              setAnchorEnabled(value);
              setResult(null);
            }}
          />
          <Toggle
            checked={vetoEnabled}
            label="否决边"
            detail="局部优化若伤害锚点则被拒绝"
            onChange={(value) => {
              setVetoEnabled(value);
              setResult(null);
            }}
          />
          <button
            className="run-button"
            type="button"
            onClick={() => setResult(runGraphDemo({ anchorEnabled, vetoEnabled }))}
          >
            运行 Graph
          </button>
        </div>
        <div className="result-panel">
          {result ? (
            <>
              <span className={`status ${result.status === "aligned" ? "ok" : "warn"}`}>
                {result.status}
              </span>
              <h4>{result.explanation}</h4>
              <div className="trace-list">
                {Object.entries(result.localMetrics).map(([key, value]) => (
                  <div className="trace-item" key={key}>
                    局部 {key}: {value}
                  </div>
                ))}
                <div className="trace-item">外部目标: {result.externalGoal}</div>
              </div>
            </>
          ) : (
            <p className="empty-state">
              默认状态会复现“局部仪表盘全绿、真实目标下跌”。再逐步接入锚点和否决边。
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function ProtocolLab() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const score = useMemo(
    () => protocolQuiz.filter((item) => answers[item.id] === item.answer).length,
    [answers],
  );

  return (
    <div className="protocol-lab">
      <h3>协议层举一反三：MCP · A2A · Agent Card · Skill</h3>
      <p className="sec-sub" style={{ marginBottom: 12 }}>
        先看“交互对象是什么”，再选协议。A2A 与 MCP 是互补，不是替代。
      </p>

      <div className="tldr" style={{ ["--sc" as string]: "#0891b2" }}>
        <div className="k">当前实践结论</div>
        <div className="v">
          外层 Agent 通过 MCP <code>knowledge_chat</code> 调用知识能力时，应保留
          MCP；先做上下文边界治理。等出现跨团队独立 Agent、长任务生命周期、Artifact
          交付时，再加 A2A Adapter，而不是重写知识库。
        </div>
      </div>

      <div className="comparison-table protocol-table" role="table" aria-label="MCP 与 A2A 对比">
        <div className="comparison-row comparison-head" role="row">
          <span role="columnheader">场景</span>
          <span role="columnheader">MCP</span>
          <span role="columnheader">A2A</span>
          <span role="columnheader">举一反三</span>
        </div>
        {[
          ["外层调用知识查询", "适合", "过重", "角色像 Agent，协议仍是能力调用"],
          ["工具 schema / 结构化结果", "核心", "不是重点", "像 function calling 的接入层"],
          ["能力发现", "tools/list", "Agent Card", "菜单 vs 名片"],
          ["Agent 间任务委托", "弱", "核心", "手 vs 社交"],
          ["长任务取消/恢复/推送", "需另建", "原生支持", "短请求 vs 任务生命周期"],
          ["跨团队/跨供应商 Agent", "有限", "更适合", "同进程工具 vs 对等协作"],
        ].map((row) => (
          <div className="comparison-row" role="row" key={row[0]}>
            {row.map((cell) => (
              <span role="cell" key={cell}>
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="card-grid cols-3" style={{ marginTop: 16 }}>
        <article className="mini-card" style={{ ["--sc" as string]: "#2563eb" }}>
          <div className="eyebrow">Agent ↔ 工具</div>
          <h4>MCP</h4>
          <p>连接工具、API、数据源；强调参数、schema、结构化结果。</p>
          <small>类比：给 Agent 装上标准化的手</small>
        </article>
        <article className="mini-card" style={{ ["--sc" as string]: "#0891b2" }}>
          <div className="eyebrow">Agent ↔ Agent</div>
          <h4>A2A</h4>
          <p>发现、协商、委托、共享任务与上下文；面向独立对等体。</p>
          <small>类比：给 Agent 装上社交与协作协议</small>
        </article>
        <article className="mini-card" style={{ ["--sc" as string]: "#c026d3" }}>
          <div className="eyebrow">公开身份</div>
          <h4>Agent Card</h4>
          <p>名片：名字、端点、skills、能力特性、认证方式。</p>
          <small>类比：A2A 的发现入口，不是本地 SKILL.md</small>
        </article>
      </div>

      <div className="codebox" style={{ marginTop: 16 }}>
        <div className="cb-head">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>推荐分层，而不是替换</span>
        </div>
        <pre>{`外层 Agent
  ├─ MCP：短请求、确定性工具、knowledge_chat
  └─ A2A：长任务、异步协作、独立 Agent 委托

知识库 Agent
  └─ MCP：内部检索、HSCode、合规等业务工具

注意：A2A contextId → opaque knowledge_thread_id
不要继续直接暴露数据库整数 conversation_id`}</pre>
      </div>

      <h3 style={{ marginTop: 28 }}>场景判断：该留 MCP 还是上 A2A？</h3>
      <p className="sec-sub" style={{ marginBottom: 8 }}>
        当前得分 {score}/{protocolQuiz.length}
      </p>
      {protocolQuiz.map((item) => {
        const selected = answers[item.id];
        return (
          <div className="card" key={item.id} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{item.prompt}</div>
            <div className="choice-grid">
              {item.choices.map((choice) => {
                const className =
                  selected == null
                    ? ""
                    : choice.id === item.answer
                      ? "correct"
                      : selected === choice.id
                        ? "wrong"
                        : "";
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={className}
                    onClick={() =>
                      setAnswers((current) => ({ ...current, [item.id]: choice.id }))
                    }
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
            {selected && <div className="feedback">{item.explain}</div>}
          </div>
        );
      })}

      <div className="callout tip">
        <div className="ct">和相邻概念怎么挂</div>
        <div>
          Tool Calling 是模型怎么开单；MCP 是工具从哪接进来；Skill
          是宿主内如何分层复用流程；Agent Card / A2A 是独立 Agent
          如何被发现并协作。换协议解决不了“鞋子和玻璃杯是否同一主题”这类上下文边界问题。
        </div>
      </div>
    </div>
  );
}

function SkillLab() {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const score = useMemo(
    () =>
      skillPlacementQuiz.filter((item) => answers[item.id] === item.answer).length,
    [answers],
  );

  return (
    <section className="lesson" id="sec-skill" style={{ ["--sc" as string]: "#7c3aed" }}>
      <div className="sec-head">
        <span className="sec-num">3</span>
        <h2>Skill：把能力做成可组合的分层手册</h2>
      </div>
      <p className="sec-sub">
        Skill 不是“很长的提示词”，而是一个节省上下文的分层执行系统：先路由，再加载流程，细节用到才读。
      </p>

      <div className="tldr">
        <div className="k">一句总纲</div>
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
        <div className="ct">记忆口诀</div>
        <div>
          `SKILL.md` 是操作手册，`references` 是资料库，`scripts` 是工具箱，`assets`
          是原材料，Skill 仓库是把这些能力组合起来的工作系统。
        </div>
      </div>

      <h3>三级加载：如何省上下文</h3>
      <div className="level-stack">
        <div className="level-card">
          <b>第一级 · name + description</b>
          <div>始终可见的轻量路由：这个 Skill 做什么、什么时候该触发。</div>
        </div>
        <div className="level-card">
          <b>第二级 · SKILL.md 正文</b>
          <div>命中后才加载：执行顺序、判断分支、完成标准、何时读取其他文件。</div>
        </div>
        <div className="level-card">
          <b>第三级 · references / scripts / assets</b>
          <div>某个任务分支需要时才读资料、跑脚本或使用模板，避免一次塞进全部知识。</div>
        </div>
      </div>

      <h3>内容该放哪里？动手分类</h3>
      <p className="sec-sub" style={{ marginBottom: 8 }}>
        当前得分 {score}/{skillPlacementQuiz.length}。先判断，再看解释。
      </p>
      {skillPlacementQuiz.map((item) => {
        const selected = answers[item.id];
        return (
          <div className="card" key={item.id} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{item.prompt}</div>
            <div className="choice-grid">
              {item.choices.map((choice) => {
                const className =
                  selected == null
                    ? ""
                    : choice.id === item.answer
                      ? "correct"
                      : selected === choice.id
                        ? "wrong"
                        : "";
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={className}
                    onClick={() =>
                      setAnswers((current) => ({ ...current, [item.id]: choice.id }))
                    }
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
            {selected && <div className="feedback">{item.explain}</div>}
          </div>
        );
      })}

      <h3>Skill 形态与触发方式</h3>
      <div className="card-grid cols-3">
        {[
          ["纯流程型", "只有 SKILL.md", "适合判断和文字流程"],
          ["流程 + Reference", "主流程稳定，分支查资料", "如支付政策、术语表"],
          ["流程 + Script", "判断 + 确定性自动化", "如诊断循环模板"],
          ["流程 + Asset", "Skill 定内容，模板给骨架", "如向导、课件模板"],
          ["路由型 Skill", "不直接做工程，只指路", "如 ask-matt / 总入口"],
          ["仓库级组合", "多个 Skill 形成生产线", "grill → spec → tickets → implement"],
        ].map(([title, note, tip]) => (
          <div className="mini-card" key={title} style={{ ["--sc" as string]: "#7c3aed" }}>
            <div className="eyebrow">{note}</div>
            <h4>{title}</h4>
            <p>{tip}</p>
          </div>
        ))}
      </div>

      <h3>Matt 式工程生产线</h3>
      <div className="roadline" aria-label="Skill 组合流水线">
        {[
          ["想法", "grill-with-docs", "把模糊需求问透"],
          ["规格", "to-spec", "写成可执行规格"],
          ["拆分", "to-tickets", "变成可交付工单"],
          ["实现", "implement + tdd", "按测试驱动推进"],
          ["审查", "code-review", "对照标准验收"],
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
            <th>例子</th>
            <th>在 Lab 中的对应</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>调用关系</td>
            <td>implement 使用 tdd</td>
            <td>前沿追踪 Skill 调用账本脚本与课程渲染器</td>
          </tr>
          <tr>
            <td>前后阶段</td>
            <td>to-spec → to-tickets</td>
            <td>发现核验 → 建图 → 技术复现 Demo → 学习反馈</td>
          </tr>
          <tr>
            <td>共享知识</td>
            <td>多个 Skill 共用 codebase-design</td>
            <td>Harness / Loop / Graph 共用“控制半径”词汇</td>
          </tr>
        </tbody>
      </table>

      <div className="callout info">
        <div className="ct">优秀 Skill 的标准</div>
        <div>
          目标不是让每次输出完全相同，而是让 Agent 每次遵循相对可预测的过程。本 Lab 的
          `track-ai-frontier` 正是按这个标准组织：入口流程在 `SKILL.md`，来源政策与课程规范按需读，账本与渲染脚本稳定执行。
        </div>
      </div>
    </section>
  );
}

function TacitBridge() {
  const [revealed, setRevealed] = useState<number[]>([]);

  return (
    <section className="lesson" id="sec-tacit" style={{ ["--sc" as string]: "#d97706" }}>
      <div className="sec-head">
        <span className="sec-num">4</span>
        <h2>判断手感：先训练注意力</h2>
      </div>
      <p className="sec-sub">
        不把直觉神秘化：先写下你看见的信号，再展开可观察的参考线索，把隐性判断桥接成显性知识。
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
                placeholder="先写下你的观察与判断依据…"
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
                {isRevealed ? "参考线索已展开" : "写完后展开参考线索"}
              </button>
              {isRevealed && <div className="cue-answer">{card.cues}</div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function LearningLab() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeId, setActiveId] = useState("sec-0");
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem("ai-lab-theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    }
    const savedDone = window.localStorage.getItem("ai-lab-done");
    if (savedDone) {
      try {
        setDone(JSON.parse(savedDone));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("ai-lab-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("ai-lab-done", JSON.stringify(done));
  }, [done]);

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
  }, []);

  const progress = Math.round((done.length / navItems.length) * 100);
  const activeLabel =
    navItems.find((item) => item.id === activeId)?.label ?? "总览与学习地图";
  const activeNum = navItems.find((item) => item.id === activeId)?.num ?? "0";

  return (
    <div className="lab-shell">
      <div id="progressbar" style={{ width: `${progress}%` }} />

      <nav id="sidebar" className={sidebarOpen ? "open" : ""} aria-label="章节目录">
        <div className="side-head">
          <div className="logo">
            AI Learning Lab <span className="badge">LAB</span>
          </div>
          <div className="tag">前沿首页 · Harness · Loop · Graph · Skill</div>
          <div className="lab-switch">
            <a href="/agent-foundations.html">基础馆深读 →</a>
            <a href="/agent-foundations.html#sec-skill">Skill 章</a>
            <a href="/git-workflow.html">Git 实验室</a>
          </div>
        </div>
        <div className="side-prog">
          <div className="lbl">
            <span>学习进度</span>
            <b>{progress}%</b>
          </div>
          <div className="bar">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="side-nav">
          {navItems.map((item) => (
            <a
              key={item.id}
              className={`nav-item ${activeId === item.id ? "active" : ""} ${
                done.includes(item.id) ? "done" : ""
              }`}
              href={`#${item.id}`}
              style={{ ["--nc" as string]: item.color }}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="num">{item.num}</span>
              <span className="t">{item.label}</span>
              <span className="dot" />
            </a>
          ))}
        </div>
        <div className="side-foot">
          <span className="mini">进度保存在本地</span>
          <button
            className="icon-btn"
            type="button"
            title="重置进度"
            onClick={() => setDone([])}
          >
            ↺
          </button>
        </div>
      </nav>

      <div
        id="backdrop"
        className={sidebarOpen ? "open" : ""}
        onClick={() => setSidebarOpen(false)}
      />

      <header className="topbar">
        <button
          className="icon-btn"
          type="button"
          title="目录"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          ☰
        </button>
        <div className="crumb">
          {activeNum} · {activeLabel}
        </div>
        <span className="pct">进度 {progress}%</span>
        <button
          className="icon-btn"
          type="button"
          title="切换深浅色"
          onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </header>

      <main className="lab-main">
        <div className="wrap">
          <section className="lesson" id="sec-0" style={{ ["--sc" as string]: "#64748b" }}>
            <div className="path-bridge">
              <span className="pb-k">AI LEARNING LAB · 学习路径</span>
              <div className="pb-steps">
                <strong>01 前沿首页（当前）</strong>
                <span>→</span>
                <a href="#sec-network">02 知识网络</a>
                <span>→</span>
                <a href="#sec-labs">03 技术 Demo</a>
                <span>→</span>
                <a href="/agent-foundations.html">04 基础馆深读</a>
                <span>→</span>
                <a href="/git-workflow.html">05 Git 实验室</a>
              </div>
              <p>
                首页负责「对比 + 亲手跑」；基础馆把同一条控制半径拆成可通关章节（Tool → ReAct →
                Loop → MCP → Multi-Agent → Skill → A2A）。
              </p>
            </div>
            <div className="hero">
              <h1>
                前沿技术，亲手跑懂
                <br />
                <span className="grad">并形成自己的知识网络</span>
              </h1>
              <p className="sub">
                定期追踪一手来源，把最新 AI 工程知识沉淀成可操作、可比较、可验证的个性化课程；用
                Harness / Loop / Graph 技术复现实验，再把 Skill
                体系接进同一套学习台，帮助产品与工程人员高效熟悉最新能力。
              </p>
              <div className="meta-chips">
                <span className="mc">3 个机制 Demo</span>
                <span className="mc">Skill 分层手册</span>
                <span className="mc">判断手感训练</span>
                <span className="mc">进度自动保存</span>
                <span className="mc">知识截止 2026-07-28</span>
              </div>
            </div>

            <div className="tldr">
              <div className="k">一句总纲</div>
              <div className="v">
                AI Learning Lab = 一手来源沉淀 × 概念对比网络 × 可运行技术 Demo × Skill
                分层能力手册。不是词汇表，是控制半径。
              </div>
            </div>

            <h3>学习地图</h3>
            <div className="roadline">
              {[
                ["01", "发现核验", "官方文档、论文、成熟度"],
                ["02", "建图对比", "依赖、边界、反例"],
                ["03", "技术复现", "Harness / Loop / Graph"],
                ["04", "Skill 整合", "手册、资料、工具、素材"],
                ["05", "判断迁移", "先观察，再形式化"],
              ].map(([year, title, detail]) => (
                <div className="road-node" key={year} style={{ ["--rc" as string]: "#5b5bd6" }}>
                  <div className="rn-y">{year}</div>
                  <div className="rn-t">{title}</div>
                  <div className="rn-d">{detail}</div>
                </div>
              ))}
            </div>

            <div className="btn-row">
              <a className="btn primary" href="#sec-labs">
                开始技术实验
              </a>
              <a className="btn" href="#sec-skill">
                学习 Skill 体系
              </a>
              <a className="btn" href="/agent-foundations.html">
                进入基础馆
              </a>
            </div>
          </section>

          <section
            className="lesson"
            id="sec-network"
            style={{ ["--sc" as string]: "#2563eb" }}
          >
            <div className="sec-head">
              <span className="sec-num">1</span>
              <h2>知识网络：不是词汇表，是控制半径</h2>
            </div>
            <p className="sec-sub">
              从“模型能调用工具”一路走到“多个优化循环如何不互相欺骗”，并把 MCP、A2A、Agent
              Card、Skill 放进同一张控制半径图。
            </p>
            <div className="card-grid cols-3">
              {knowledgeNodes.map((node) => (
                <article
                  className="mini-card"
                  key={node.id}
                  style={{ ["--sc" as string]: node.color }}
                >
                  <div className="eyebrow">{node.eyebrow}</div>
                  <h4>{node.title}</h4>
                  <p>{node.note}</p>
                  <small>{node.links}</small>
                </article>
              ))}
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
                ["A2A / Card", "独立 Agent 如何发现与协作？", "Agent Card、Task、委托与推送", "用 A2A 替换掉一切 MCP 调用"],
              ].map((row) => (
                <div className="comparison-row" role="row" key={row[0]}>
                  {row.map((cell) => (
                    <span role="cell" key={cell}>
                      {cell}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <ProtocolLab />
          </section>

          <section className="lesson" id="sec-labs" style={{ ["--sc" as string]: "#059669" }}>
            <div className="sec-head">
              <span className="sec-num">2</span>
              <h2>技术复现 Demo：亲手观察机制</h2>
            </div>
            <p className="sec-sub">
              Demo 复现的是技术机制本身。每个实验都改变可观察状态，并明确显示为什么成功、为什么失败、为什么停止。
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
            style={{ ["--sc" as string]: "#0891b2" }}
          >
            <div className="sec-head">
              <span className="sec-num">5</span>
              <h2>深入课程：同一路径的下一站</h2>
            </div>
            <p className="sec-sub">
              首页练「对比与复现」；基础馆把同一套控制半径拆成可通关章节。两边入口互通，章节也可直达。
            </p>
            <div className="course-grid">
              <a className="course-card" href="/agent-foundations.html">
                <span>FOUNDATION COURSE · 18+ INTERACTIONS</span>
                <h3>Agent 基础馆 · 完整拼图</h3>
                <p>
                  Tool → ReAct → Loop → MCP → Multi-Agent → Skill → A2A/Card →
                  前沿雷达。与首页知识网络同一主线，适合逐章通关。
                </p>
                <b>进入基础馆 →</b>
              </a>
              <a className="course-card" href="/git-workflow.html">
                <span>ENGINEERING COURSE · RUNNABLE SIMULATOR</span>
                <h3>Git Workflow 实验室</h3>
                <p>用图形化提交网络理解 merge、rebase、冲突、远端同步和协作分支。</p>
                <b>进入课程 →</b>
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
                  ["#sec-6", "6 架构"],
                  ["#sec-skill", "7 Skill"],
                  ["#sec-7", "8 雷达"],
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
            style={{ ["--sc" as string]: "#e11d48" }}
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
                  className="source-card"
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
                  <p>{source.note}</p>
                  <small>
                    {source.date} · 打开原始来源 ↗
                  </small>
                </a>
              ))}
            </div>
          </section>

          <footer className="pagefoot">
            AI Learning Lab · 为产品与工程人员建立持续生长的 AI 知识网络。
            <br />
            本期知识截止 2026-07-28；学习进度仅保存在当前浏览器。
            <div>
              <a href="/agent-foundations.html">Agent 基础馆</a>
              <a href="/git-workflow.html">Git 实验室</a>
              <a href="#sec-skill">Skill 体系</a>
              <a href="#sec-sources">来源</a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
