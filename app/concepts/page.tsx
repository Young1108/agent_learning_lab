"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import conceptsData from "../../data/concepts.json";
import { LabShell } from "../LabShell";
import { CURRICULUM_AS_OF, RADIUS, relateToRadius, type RadiusId } from "../lab-chrome";

type Concept = {
  id: string;
  title: string;
  source: string;
  url: string;
  date: string;
  summary: string;
  maturity: "established" | "emerging" | "proposed";
  tags: string[];
  addedAt: string;
};

const DATA = conceptsData as {
  updatedAt: string;
  version: number;
  sourceCount: number;
  conceptCount: number;
  concepts: Concept[];
};

const MATURITY_LABEL: Record<string, string> = {
  established: "已确立",
  emerging: "新兴中",
  proposed: "提出中",
};

const archiveNav = [
  { id: "sec-ledger", num: "Ⅰ", label: "每日账本", color: "#262626" },
  { id: "sec-radius", num: "Ⅱ", label: "控制半径索引", color: "#434343" },
];

function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((c: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const loadedRef = useRef(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (loadedRef.current) return;
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

function ConceptArchive() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>("全部");
  const [maturity, setMaturity] = useState<string>("全部");
  const [source, setSource] = useState<string>("全部");
  const [radius, setRadius] = useState<string>("全部");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [subs, setSubs] = useLocalStorage<{ tags: string[]; email: string }>("ai-lab-subs", {
    tags: [],
    email: "",
  });
  const [seenVersion, setSeenVersion] = useLocalStorage<number>("ai-lab-seen-version", 0);
  const [showSub, setShowSub] = useState(false);
  const [draftEmail, setDraftEmail] = useState("");
  const [activeId, setActiveId] = useState("sec-ledger");

  const concepts = DATA.concepts;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("radius");
    if (r && RADIUS.some((x) => x.id === r)) setRadius(r);
  }, []);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    concepts.forEach((c) => c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [concepts]);

  const allSources = useMemo(
    () => [...new Set(concepts.map((c) => c.source))].sort(),
    [concepts],
  );

  const newCount = Math.max(0, DATA.version - seenVersion);
  const isNewVisit = newCount > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return concepts.filter((c) => {
      if (tag !== "全部" && !c.tags.includes(tag)) return false;
      if (maturity !== "全部" && c.maturity !== maturity) return false;
      if (source !== "全部" && c.source !== source) return false;
      if (radius !== "全部" && !relateToRadius(c).includes(radius as RadiusId)) return false;
      if (q && !`${c.title} ${c.summary} ${c.tags.join(" ")}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [concepts, query, tag, maturity, source, radius]);

  const subTags = subs.tags;
  const recommendedCount = useMemo(
    () =>
      subTags.length === 0
        ? 0
        : concepts.filter((c) => c.tags.some((t) => subTags.includes(t))).length,
    [concepts, subTags],
  );

  const radiusCounts = useMemo(() => {
    const m = new Map<string, number>();
    concepts.forEach((c) => {
      relateToRadius(c).forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
    });
    return m;
  }, [concepts]);

  function toggleTag(t: string) {
    setSubs((cur) => ({
      ...cur,
      tags: cur.tags.includes(t) ? cur.tags.filter((x) => x !== t) : [...cur.tags, t],
    }));
  }

  function toggleExpand(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <LabShell
      wing="concepts"
      logo="本章"
      tag="每日账本 · 挂回控制半径"
      searchExtra={RADIUS.map((r) => ({
        href: `/concepts?radius=${r.id}`,
        label: `${r.en} · ${r.label}`,
        hint: "控制半径",
        kind: "概念",
      }))}
      navItems={archiveNav}
      activeId={activeId}
      onActive={setActiveId}
      crumb={radius === "全部" ? "Ⅰ · 每日账本" : `半径 · ${RADIUS.find((r) => r.id === radius)?.en ?? radius}`}
      progressLabel="馆藏"
      footer={
        <footer className="pagefoot">
          概念馆账本每日本地抓取入库（GitHub Actions）；上限 400 条、自动去重。
          <br />
          基础馆课程核对于 {CURRICULUM_AS_OF}；本馆账本更新于 {DATA.updatedAt.slice(0, 10)}。proposed 仅代表提出方主张。
          <div>
            <a href="/">今日</a>
            <a href="/#sec-network">知识网络</a>
            <a href="/agent-foundations.html">基础馆</a>
          </div>
        </footer>
      }
    >
      <section className="lesson" id="sec-ledger" style={{ ["--sc" as string]: "#262626" }}>
        <div className="path-bridge">
          <span className="pb-k">学习路径</span>
          <div className="pb-steps">
            <a href="/">今日</a>
            <span>→</span>
            <a href="/#sec-network">知识网络</a>
            <span>→</span>
            <a href="/agent-foundations.html">基础馆</a>
            <span>→</span>
            <strong>概念（当前）</strong>
          </div>
        </div>

        <div className="hello archive-hero">
          <p className="eyebrow">概念账本</p>
          <h1>
            账本在生长，<span className="tone">半径不变</span>
          </h1>
          <p className="sub">
            定时抓取 OpenAI / Google DeepMind / Hugging Face / arXiv 等一手来源。每张卡片是一条可对读的展陈，不是信息流。
          </p>
          <div className="meta-chips">
            <span className="mc">馆藏 {DATA.conceptCount} 条</span>
            <span className="mc">来源 {DATA.sourceCount} 处</span>
            <span className="mc">账本 {DATA.updatedAt.slice(0, 10)}</span>
            <span className="mc">课程核对 {CURRICULUM_AS_OF}</span>
          </div>
        </div>

        {isNewVisit && (
          <div className="archive-banner">
            自上次访问新增 <b>{newCount}</b> 个版本记号（v{DATA.version}）。{" "}
            <button type="button" className="text-button" onClick={() => setSeenVersion(DATA.version)}>
              标记为已读
            </button>
          </div>
        )}

        <div className="archive-sub">
          <div className="as-head">
            <div>
              <b>订阅概念方向</b>
              <small>
                {subTags.length > 0
                  ? `已订阅 ${subTags.length} 个方向，馆内相关 ${recommendedCount} 条`
                  : "选择关心的方向；新概念以站内横幅提醒"}
              </small>
            </div>
            <button type="button" className="btn" onClick={() => setShowSub((s) => !s)}>
              {showSub ? "收起" : subTags.length > 0 ? "编辑订阅" : "立即订阅"}
            </button>
          </div>
          {showSub && (
            <div className="as-body">
              <div className="as-tags">
                {allTags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`as-tag ${subTags.includes(t) ? "on" : ""}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="as-email">
                <input
                  type="email"
                  value={draftEmail || subs.email}
                  placeholder="邮箱（可选，仅存本地浏览器）"
                  onChange={(e) => {
                    setDraftEmail(e.target.value);
                    setSubs((cur) => ({ ...cur, email: e.target.value }));
                  }}
                />
                <p className="ms-note">
                  订阅仅保存在当前浏览器。邮件网关接入后启用提醒。{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setSubs({ tags: [], email: "" });
                      setDraftEmail("");
                    }}
                  >
                    清空订阅
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="lesson" id="sec-radius" style={{ ["--sc" as string]: "#434343" }}>
        <div className="sec-head">
          <span className="sec-num">Ⅱ</span>
          <h2>按控制半径浏览</h2>
        </div>
        <p className="sec-sub">与首页知识网络、基础馆章节共用同一组节点。点选即筛选账本。</p>
        <div className="cat-chips" aria-label="按控制半径筛选">
          <button type="button" className={`count-chip ${radius === "全部" ? "on" : ""}`} onClick={() => setRadius("全部")}>
            全部 <b>{concepts.length}</b>
          </button>
          {RADIUS.map((r) => (
            <button
              type="button"
              key={r.id}
              className={`count-chip ${radius === r.id ? "on" : ""}`}
              onClick={() => setRadius((cur) => (cur === r.id ? "全部" : r.id))}
            >
              {r.en} <b>{radiusCounts.get(r.id) ?? 0}</b>
            </button>
          ))}
        </div>
      </section>

      <div className="archive-toolbar">
        <input
          type="search"
          placeholder="搜索概念 / 摘要 / 标签…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={maturity} onChange={(e) => setMaturity(e.target.value)}>
          <option value="全部">成熟度：全部</option>
          {Object.entries(MATURITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="全部">来源：全部</option>
          {allSources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="archive-tags">
        <button type="button" className={`count-chip ${tag === "全部" ? "on" : ""}`} onClick={() => setTag("全部")}>
          全部标签
        </button>
        {allTags.map((t) => (
          <button type="button" key={t} className={`count-chip ${tag === t ? "on" : ""}`} onClick={() => setTag(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="archive-count">
        共 {filtered.length} 条
        {radius !== "全部" ? ` · 半径 ${RADIUS.find((r) => r.id === radius)?.en}` : ""}
      </div>

      <div className="archive-list catalog-grid">
        {filtered.map((c) => {
          const open = expanded.has(c.id);
          const related = relateToRadius(c);
          return (
            <article className="concept-card catalog-card" key={c.id}>
              <div className="catalog-preview" aria-hidden="true">
                <div className="pv-win">
                  <div className="pv-bar" />
                </div>
                <span className="pv-dot" />
              </div>
              <div className="cc-body">
              <div className="cc-head">
                <span className="cc-source">{c.source}</span>
                <span className="cc-date">{c.date}</span>
                <span className={`maturity ${c.maturity}`}>{MATURITY_LABEL[c.maturity] ?? c.maturity}</span>
              </div>
              <h3>{c.title}</h3>
              <p className={open ? "cc-summary open" : "cc-summary"}>{c.summary || "（摘要待补）"}</p>
              {related.length > 0 && (
                <div className="cc-radius">
                  {related.map((id) => {
                    const r = RADIUS.find((x) => x.id === id);
                    if (!r) return null;
                    return (
                      <button type="button" key={id} className="cc-radius-chip" onClick={() => setRadius(id)}>
                        {r.en}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="cc-tags">
                {c.tags.map((t) => (
                  <button type="button" key={t} className="cc-tag" onClick={() => setTag(t)}>
                    #{t}
                  </button>
                ))}
              </div>
              <div className="cc-actions">
                <button type="button" className="text-button" onClick={() => toggleExpand(c.id)}>
                  {open ? "收起" : "查看详情"}
                </button>
                {related[0] && (
                  <a className="text-button" href={RADIUS.find((r) => r.id === related[0])?.foundation}>
                    对读基础馆
                  </a>
                )}
                <a className="text-button" href={c.url} target="_blank" rel="noreferrer">
                  打开原文 ↗
                </a>
              </div>
              {open && (
                <div className="cc-detail">
                  <div className="cd-row">
                    <span>概念 ID</span>
                    <code>{c.id}</code>
                  </div>
                  <div className="cd-row">
                    <span>入库时间</span>
                    <span>{c.addedAt.slice(0, 10)}</span>
                  </div>
                  <div className="cd-row">
                    <span>来源链接</span>
                    <a href={c.url} target="_blank" rel="noreferrer">
                      {c.url}
                    </a>
                  </div>
                  <p className="cd-hint">
                    想深入理解？回到{" "}
                    <a href="/#sec-network">
                      <b>知识网络</b>
                    </a>{" "}
                    点亮对应节点，或打开首页 AI 导师用反问带你走一遍。
                  </p>
                </div>
              )}
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ marginTop: 8 }}>
            <span className="es-ico" aria-hidden="true">
              🔍
            </span>
            <p>没有匹配的概念，换个关键词或半径试试。</p>
          </div>
        )}
      </div>
    </LabShell>
  );
}

export default ConceptArchive;
