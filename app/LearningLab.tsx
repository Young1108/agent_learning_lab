"use client";

import { useMemo, useState } from "react";
import {
  runGraphDemo,
  runHarnessDemo,
  runLoopDemo,
  type GraphResult,
  type HarnessConfig,
  type HarnessResult,
  type LoopResult,
} from "./lab-model.mjs";

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
    links: ["react", "mcp"],
  },
  {
    id: "react",
    eyebrow: "认知循环",
    title: "ReAct",
    note: "推理 → 行动 → 观察",
    links: ["loop"],
  },
  {
    id: "mcp",
    eyebrow: "接口协议",
    title: "MCP",
    note: "标准化工具、资源与提示",
    links: ["harness", "loop"],
  },
  {
    id: "harness",
    eyebrow: "单次运行",
    title: "Harness Engineering",
    note: "环境、工具、可见性、约束、完成证据",
    links: ["loop"],
  },
  {
    id: "loop",
    eyebrow: "重复运行",
    title: "Loop Engineering",
    note: "状态、验证、预算、停止与升级",
    links: ["graph"],
  },
  {
    id: "graph",
    eyebrow: "多循环治理",
    title: "Graph Engineering",
    note: "目标所有权、冲突、节奏与外部锚点",
    links: [],
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
    <article className="lab-card" id="harness-lab">
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
            运行一次 Agent
          </button>
        </div>
        <div className="trace-panel" aria-live="polite">
          <div className="trace-head">
            <span>EXECUTION TRACE</span>
            <b>{result ? result.status : "等待运行"}</b>
          </div>
          {result ? (
            <>
              <ol className="trace-list">
                {result.trace.map((item) => (
                  <li className={item.ok ? "trace-ok" : "trace-bad"} key={item.phase}>
                    <span>{item.phase}</span>
                    <p>{item.text}</p>
                  </li>
                ))}
              </ol>
              <p className="result-note">{result.explanation}</p>
            </>
          ) : (
            <p className="empty-state">
              当前故意关闭了“环境可观察”。运行后看它是否会被准确定位，而不是只得到一个抽象分数。
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function LoopLab() {
  const [target, setTarget] = useState(80);
  const [budget, setBudget] = useState(5);
  const [result, setResult] = useState<LoopResult | null>(null);

  return (
    <article className="lab-card" id="loop-lab">
      <div className="lab-title">
        <span className="lab-index">02</span>
        <div>
          <p>重复运行控制半径</p>
          <h3>Loop Lab</h3>
        </div>
        <span className="maturity emerging">emerging</span>
      </div>
      <p className="lab-intro">
        调整目标和预算，真实跑一遍“行动—观察—调整”，并看到循环究竟因收敛、预算还是轮次停止。
      </p>
      <div className="loop-controls">
        <label>
          <span>
            验证目标 <b>{target}</b>
          </span>
          <input
            type="range"
            min="65"
            max="95"
            step="5"
            value={target}
            onChange={(event) => {
              setTarget(Number(event.target.value));
              setResult(null);
            }}
          />
        </label>
        <label>
          <span>
            预算轮次 <b>{budget}</b>
          </span>
          <input
            type="range"
            min="1"
            max="5"
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
                initialScore: 35,
                targetScore: target,
                maxIterations: 5,
                budget,
              }),
            )
          }
        >
          启动有界循环
        </button>
      </div>
      <div className="loop-stage" aria-live="polite">
        {result ? (
          <>
            <div className="loop-summary">
              <span>停止原因</span>
              <strong>{result.status}</strong>
              <span>运行 {result.iterations} 轮</span>
              <strong>最终 {result.finalScore}</strong>
            </div>
            <div className="iteration-grid">
              {result.trace.map((item) => (
                <div className="iteration" key={item.iteration}>
                  <span>ITER {item.iteration}</span>
                  <b>
                    {item.before} → {item.score}
                  </b>
                  <div className="score-track">
                    <i style={{ width: `${item.score}%` }} />
                  </div>
                  <p>{item.observation}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="empty-state">
            初始质量固定为 35，每轮最多改善 15。把目标拉高或预算压低，观察循环如何诚实地失败。
          </p>
        )}
      </div>
    </article>
  );
}

function GraphLab() {
  const [anchorEnabled, setAnchorEnabled] = useState(false);
  const [vetoEnabled, setVetoEnabled] = useState(false);
  const [result, setResult] = useState<GraphResult | null>(null);

  const nodes = useMemo(
    () => [
      { name: "速度循环", metric: "96", tone: "cyan" },
      { name: "自动质量分", metric: "91", tone: "violet" },
      { name: "成本循环", metric: "90", tone: "amber" },
      {
        name: "真实续费率",
        metric: result ? String(result.retention) : "?",
        tone: result?.systemHealthy ? "green" : "red",
      },
    ],
    [result],
  );

  return (
    <article className="lab-card" id="graph-lab">
      <div className="lab-title">
        <span className="lab-index">03</span>
        <div>
          <p>多循环治理半径</p>
          <h3>Graph Lab</h3>
        </div>
        <span className="maturity proposed">proposed</span>
      </div>
      <p className="lab-intro">
        让三个局部指标同时变绿，再决定是否接入不可自我改写的外部锚点和治理否决边。
      </p>
      <div className="graph-workbench">
        <div className="graph-canvas">
          {nodes.map((node) => (
            <div className={`graph-node ${node.tone}`} key={node.name}>
              <span>{node.name}</span>
              <strong>{node.metric}</strong>
            </div>
          ))}
          <div className={`graph-edge anchor ${anchorEnabled ? "is-on" : ""}`}>
            外部事实
          </div>
          <div className={`graph-edge veto ${vetoEnabled ? "is-on" : ""}`}>
            否决 / 回滚
          </div>
        </div>
        <div className="control-stack compact">
          <Toggle
            checked={anchorEnabled}
            label="接入外部锚点"
            detail="真实续费率与人工抽检只读"
            onChange={(value) => {
              setAnchorEnabled(value);
              setResult(null);
            }}
          />
          <Toggle
            checked={vetoEnabled}
            label="连接治理否决边"
            detail="发现偏差后能冻结阈值并回滚"
            onChange={(value) => {
              setVetoEnabled(value);
              setResult(null);
            }}
          />
          <button
            className="run-button"
            type="button"
            onClick={() =>
              setResult(runGraphDemo({ anchorEnabled, vetoEnabled }))
            }
          >
            运行多循环系统
          </button>
        </div>
      </div>
      <div className="event-stream" aria-live="polite">
        {result ? (
          result.events.map((event, index) => (
            <div className={`event ${event.kind}`} key={`${event.kind}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{event.text}</p>
            </div>
          ))
        ) : (
          <p className="empty-state">
            默认状态会复现“局部仪表盘全绿、真实目标下跌”。再逐步接入锚点和否决边。
          </p>
        )}
      </div>
    </article>
  );
}

function TacitBridge() {
  const [revealed, setRevealed] = useState<number[]>([]);

  return (
    <section className="section tacit-section" id="learning-method">
      <div className="section-heading">
        <p>POLANYI-INSPIRED LEARNING</p>
        <h2>先训练注意力，再学习术语</h2>
        <span>
          不把直觉神秘化：先写下你看见的信号，再展开可观察的参考线索，把隐性判断桥接成显性知识。
        </span>
      </div>
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
  return (
    <main>
      <nav className="top-nav" aria-label="主导航">
        <a className="brand" href="#top">
          <span>AI</span> Learning Lab
        </a>
        <div className="nav-links">
          <a href="#network">知识网络</a>
          <a href="#labs">技术实验</a>
          <a href="#learning-method">学习方法</a>
          <a href="#sources">一手来源</a>
        </div>
        <a className="nav-cta" href="/agent-foundations.html">
          进入基础馆
        </a>
      </nav>

      <header className="hero" id="top">
        <div className="hero-copy">
          <p className="overline">FRONTIER KNOWLEDGE · RUNNABLE LABS · KNOWLEDGE GRAPH</p>
          <h1>
            前沿技术，
            <br />
            <em>亲手跑懂。</em>
          </h1>
          <p className="hero-lede">
            定期追踪一手来源，把最新 AI 工程知识沉淀成可以操作、比较、验证和串联的个性化课程，帮助产品与工程人员形成持续生长的知识网络。
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#labs">
              开始技术实验
            </a>
            <a className="secondary-link" href="#network">
              查看知识网络
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <b>3</b> 个前沿机制 Demo
            </span>
            <span>
              <b>4</b> 条一手来源
            </span>
            <span>
              <b>18+</b> 个原有交互组件
            </span>
          </div>
        </div>
        <aside className="radar-card">
          <div className="radar-head">
            <span>KNOWLEDGE RADAR</span>
            <i>LIVE DATASET</i>
          </div>
          <div className="radar-orbit" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="radar-core">AI</div>
            <span className="signal signal-one">Harness</span>
            <span className="signal signal-two">Loop</span>
            <span className="signal signal-three">Graph</span>
          </div>
          <dl className="radar-stats">
            <div>
              <dt>知识截止</dt>
              <dd>2026-07-28</dd>
            </div>
            <div>
              <dt>来源等级</dt>
              <dd>T0 / T1</dd>
            </div>
            <div>
              <dt>调度状态</dt>
              <dd>待接入周期任务</dd>
            </div>
          </dl>
        </aside>
      </header>

      <section className="learning-pipeline" aria-label="知识更新流程">
        {[
          ["01", "发现", "官方文档、论文与实验室博客"],
          ["02", "核验", "区分事实、主张、推断与成熟度"],
          ["03", "建图", "比较概念、依赖、边界和反例"],
          ["04", "练习", "运行 Demo、判断情境、复述迁移"],
        ].map(([index, title, note]) => (
          <div className="pipeline-step" key={index}>
            <span>{index}</span>
            <div>
              <b>{title}</b>
              <p>{note}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="section network-section" id="network">
        <div className="section-heading split">
          <div>
            <p>KNOWLEDGE NETWORK</p>
            <h2>不是词汇表，是控制半径</h2>
          </div>
          <span>
            从“模型能调用工具”一路走到“多个优化循环如何不互相欺骗”。每个知识点都说明它依赖谁、优化什么、不能解决什么。
          </span>
        </div>
        <div className="knowledge-graph">
          {knowledgeNodes.map((node, index) => (
            <article className={`knowledge-node node-${node.id}`} key={node.id}>
              <span>{node.eyebrow}</span>
              <h3>{node.title}</h3>
              <p>{node.note}</p>
              <small>
                {node.links.length
                  ? `连接 → ${node.links.join(" / ")}`
                  : "外部目标与治理锚点"}
              </small>
              {index < knowledgeNodes.length - 1 && (
                <i className="node-connector" aria-hidden="true" />
              )}
            </article>
          ))}
        </div>
        <div className="comparison-table" role="table" aria-label="三个工程层级对比">
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
      </section>

      <section className="section labs-section" id="labs">
        <div className="section-heading">
          <p>RUNNABLE TECHNOLOGY DEMOS</p>
          <h2>Demo 复现的是技术机制</h2>
          <span>
            每个实验都改变可观察状态，并明确显示为什么成功、为什么失败、为什么停止。
          </span>
        </div>
        <HarnessLab />
        <LoopLab />
        <GraphLab />
      </section>

      <TacitBridge />

      <section className="section library-section">
        <div className="section-heading split">
          <div>
            <p>DEEP COURSES</p>
            <h2>把原有知识沉淀接进来</h2>
          </div>
          <span>
            保留 `agent-learning-lab` 现有完整内容，作为深入课程，而不是丢掉已有的 Tool、ReAct、MCP、Multi-Agent 与 Git 实验。
          </span>
        </div>
        <div className="course-grid">
          <a className="course-card foundations" href="/agent-foundations.html">
            <span>FOUNDATION COURSE · 18+ INTERACTIONS</span>
            <h3>现代 Agent 完整拼图</h3>
            <p>Tool Calling、ReAct、Agent Loop、MCP、MCP Server、多智能体与前沿概念雷达。</p>
            <b>进入课程 →</b>
          </a>
          <a className="course-card git" href="/git-workflow.html">
            <span>ENGINEERING COURSE · RUNNABLE SIMULATOR</span>
            <h3>Git Workflow 实验室</h3>
            <p>用图形化提交网络理解 merge、rebase、冲突、远端同步和协作分支。</p>
            <b>进入课程 →</b>
          </a>
        </div>
      </section>

      <section className="section sources-section" id="sources">
        <div className="section-heading split">
          <div>
            <p>PRIMARY SOURCES</p>
            <h2>所有新知识都回到一手来源</h2>
          </div>
          <span>
            “Graph Engineering”当前标记为 proposed；来源支持定义，不等于证明行业已形成统一标准。
          </span>
        </div>
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
                <i className={`maturity ${source.maturity}`}>
                  {source.maturity}
                </i>
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

      <footer>
        <a className="brand" href="#top">
          <span>AI</span> Learning Lab
        </a>
        <p>
          为产品与工程人员建立持续生长的 AI 知识网络。
          <br />
          本期知识截止 2026-07-28；学习进度仅保存在当前浏览器。
        </p>
        <div>
          <a href="/agent-foundations.html">Agent 基础馆</a>
          <a href="/git-workflow.html">Git 实验室</a>
          <a href="#sources">来源</a>
        </div>
      </footer>
    </main>
  );
}
