# AI Learning Lab

面向产品与工程人员的前沿 AI 技术学习实验室。

它借鉴隐性知识的学习思想：不仅解释“概念是什么”，还通过真实情境、对比、可运行 Demo 和知识网络，训练学习者先注意关键线索，再把判断桥接成可验证的显性知识。

公网入口：https://yang1108.ryzedns.org/

## 产品闭环

1. 定期发现官方文档、论文、实验室博客等一手来源。
2. 区分事实、厂商主张、分析推断和术语成熟度。
3. 把知识点连接为依赖、对比、边界和反例网络。
4. 为技术机制提供可运行 Demo，而不是只展示静态说明。
5. 保存学习证据，用错题、观察线索和复述结果生成后续课程。

## 当前内容

- 首页：知识网络、Harness / Loop / Graph 技术复现 Demo、Skill 体系、判断手感桥接
- [`public/agent-foundations.html`](./public/agent-foundations.html)：Agent 基础馆（Tool / ReAct / Loop / MCP / Multi-Agent / Skill / A2A）
- [`public/git-workflow.html`](./public/git-workflow.html)：Git Workflow 图形化实验室

## 本地开发

```bash
npm install
npm run dev
npm run build
npm test
```

要求 Node.js `>=22.13.0`。运行时基于 [vinext](https://github.com/cloudflare/vinext)。

## 证据边界

- Harness Engineering 与 Loop Engineering 标记为 `emerging`。
- Graph Engineering 标记为 `proposed`，不能写成已有统一规范的行业标准。
- 网站展示的“知识截止日期”不等于后台调度已启用；周期抓取和自动发布需要单独配置运行任务。

## 参考与致谢

本项目在调研与设计时参考了以下开源仓库与能力包。它们**不是硬依赖**；AI Learning Lab 保持独立的账本契约、课程契约与站点实现。若你要深入某条能力链，请直接阅读原仓库。

### 学习产品与研究编排

| 仓库 | 用途说明 |
|---|---|
| [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) | 交互学习产品形态参考：Research → Knowledge → Living Book → Mastery Path、可追溯记忆与测验设计 |
| [Orchestra-Research/AI-Research-SKILLs](https://github.com/Orchestra-Research/AI-Research-SKILLs) | 自治研究 Skill 形态参考：Autoresearch、Research Manager（claim / proof / provenance）、Rigor Reviewer |
| [MODSetter/SurfSense](https://github.com/MODSetter/SurfSense) | 个人知识工作区与研究报告导出能力参考 |
| [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | 可安装研究 Skill、多来源聚合与引用追踪参考 |
| [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) | 开源 Deep Research Agent / LangGraph 研究流水线参考 |
| [199-biotechnologies/claude-deep-research-skill](https://github.com/199-biotechnologies/claude-deep-research-skill) | 研究质量流水线、来源评分与静态报告校验参考 |
| [stanford-oval/storm](https://github.com/stanford-oval/storm) | 带引用长文生成与 Co-STORM 协同学习参考 |
| [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | 自托管个人知识 Agent、重复研究自动化参考 |
| [mlnjsh/ai-research-radar](https://github.com/mlnjsh/ai-research-radar) | 轻量定时扫描 arXiv 并沉淀摘要的自动化模式参考 |
| [f-labs-io/agent-html-skills](https://github.com/f-labs-io/agent-html-skills) | Agent 可交付交互 HTML / playground 教学组件参考 |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | Skills 发现、安装与更新工具链参考（`find-skills`） |

### 协议、运行时与一手工程来源

| 仓库 / 入口 | 用途说明 |
|---|---|
| [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | MCP 规范与正式变更（T0） |
| [a2aproject/A2A](https://github.com/a2aproject/A2A) | A2A / Agent Card 互操作规范（T0） |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 图编排与长期运行 Agent 运行时参考 |
| [google/adk-python](https://github.com/google/adk-python) | Google ADK 多智能体 / 工作流编排参考 |
| [microsoft/autogen](https://github.com/microsoft/autogen) | 多智能体框架参考 |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | OpenAI Agents SDK 参考 |
| [eigent-ai/eigent](https://github.com/eigent-ai/eigent) | Graph Engineering 相关讨论与多 Agent 工作区参考（术语成熟度 `proposed`） |
| [cloudflare/vinext](https://github.com/cloudflare/vinext) | 本站点运行时与构建脚手架 |

### 一手阐述（非仓库，但构成术语证据）

- [OpenAI · Harness engineering](https://openai.com/index/harness-engineering/)
- [Anthropic · Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Eigent · Graph Engineering for AI Agents](https://www.eigent.ai/blog/graph-engineering-ai-agents)

## License / 归属

上游参考项目各自保留其原许可证与版权。本仓库对它们的引用仅用于设计对照与来源致谢，不表示隶属、背书或代码合并关系。
