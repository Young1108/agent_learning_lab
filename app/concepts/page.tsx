"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import conceptsData from "../../data/concepts.json";
import Link from "next/link";
import { LabShell } from "../LabShell";
import { CURRICULUM_AS_OF, RADIUS, relateToRadius, type RadiusId } from "../lab-chrome";
import "./kami.css";

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
  cover?: string;
  tldr?: string;
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
  { id: "sec-radius", num: "01", label: "控制半径", color: "var(--ink)" },
  { id: "sec-filter", num: "02", label: "检索与筛选", color: "var(--ink-soft)" },
  { id: "sec-ledger", num: "03", label: "账本", color: "var(--ink)" },
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
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const r = params.get("radius");
      if (r && RADIUS.some((x) => x.id === r)) setRadius(r);
    });
    return () => window.cancelAnimationFrame(frame);
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
      skin="kami"
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
      crumb={
        radius === "全部" ? "概念账本" : `半径 · ${RADIUS.find((r) => r.id === radius)?.en ?? radius}`
      }
      progressLabel="馆藏"
      footer={
        <footer className="pagefoot">
          概念馆账本每日本地抓取入库（GitHub Actions）；上限 400 条、自动去重。
          <br />
          基础馆课程核对于 {CURRICULUM_AS_OF}；本馆账本更新于 {DATA.updatedAt.slice(0, 10)}。proposed 仅代表提出方主张。
          <div>
            <Link href="/">今日</Link>
            <Link href="/#sec-network">知识网络</Link>
            <a href="/agent-foundations.html">基础馆</a>
          </div>
        </footer>
      }
    >
      <header>
        <div className="k-kicker">AI Learning Lab / 概念账本</div>
        <h1 className="k-title">
          账本在生长，<em>半径不变</em>
        </h1>
        <p className="k-lead">
          定时抓取 OpenAI / Google DeepMind / Hugging Face / arXiv 等一手来源，并策展 Meta Muse /
          Kimi / Creao AI / Genspark 等技术文章。每张卡片是一条可对读的展陈，不是信息流。
        </p>
        <div className="k-meta">
          <span>
            馆藏 <b>{DATA.conceptCount}</b> 条
          </span>
          <span>
            来源 <b>{DATA.sourceCount}</b> 处
          </span>
          <span>
            账本 <b>{DATA.updatedAt.slice(0, 10)}</b>
          </span>
          <span>
            课程核对 <b>{CURRICULUM_AS_OF}</b>
          </span>
        </div>

        <div className="k-path">
          <span>学习路径</span>
          <Link href="/">今日</Link>
          <span>→</span>
          <Link href="/#sec-network">知识网络</Link>
          <span>→</span>
          <a href="/agent-foundations.html">基础馆</a>
          <span>→</span>
          <strong>概念（当前）</strong>
        </div>

        {isNewVisit && (
          <div className="k-note">
            <span>
              自上次访问新增 <b>{newCount}</b> 个版本记号（v{DATA.version}）。
            </span>
            <button type="button" className="k-link" onClick={() => setSeenVersion(DATA.version)}>
              标记为已读
            </button>
          </div>
        )}

        <div className="k-sub">
          <div className="k-sub-head">
            <div>
              <b>订阅概念方向</b>
              <small>
                {subTags.length > 0
                  ? `已订阅 ${subTags.length} 个方向，馆内相关 ${recommendedCount} 条`
                  : "选择关心的方向；新概念以站内横幅提醒"}
              </small>
            </div>
            <button type="button" className="k-btn" onClick={() => setShowSub((s) => !s)}>
              {showSub ? "收起" : subTags.length > 0 ? "编辑订阅" : "立即订阅"}
            </button>
          </div>
          {showSub && (
            <div className="k-sub-body">
              <div className="k-chip-row">
                {allTags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`k-chip ${subTags.includes(t) ? "on" : ""}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                type="email"
                value={draftEmail || subs.email}
                placeholder="邮箱（可选，仅存本地浏览器）"
                onChange={(e) => {
                  setDraftEmail(e.target.value);
                  setSubs((cur) => ({ ...cur, email: e.target.value }));
                }}
              />
              <p className="k-sub-note">
                订阅仅保存在当前浏览器。邮件网关接入后启用提醒。{" "}
                <button
                  type="button"
                  className="k-link"
                  onClick={() => {
                    setSubs({ tags: [], email: "" });
                    setDraftEmail("");
                  }}
                >
                  清空订阅
                </button>
              </p>
            </div>
          )}
        </div>
      </header>

      <section className="k-sec" id="sec-radius">
        <h2>
          <span className="k-no">01</span>按控制半径浏览
        </h2>
        <p className="k-sec-sub">与首页知识网络、基础馆章节共用同一组节点。点选即筛选账本。</p>
        <div className="k-chip-row" aria-label="按控制半径筛选">
          <button
            type="button"
            className={`k-chip ${radius === "全部" ? "on" : ""}`}
            onClick={() => setRadius("全部")}
          >
            全部 <b>{concepts.length}</b>
          </button>
          {RADIUS.map((r) => (
            <button
              type="button"
              key={r.id}
              className={`k-chip ${radius === r.id ? "on" : ""}`}
              onClick={() => setRadius((cur) => (cur === r.id ? "全部" : r.id))}
            >
              {r.en} <b>{radiusCounts.get(r.id) ?? 0}</b>
            </button>
          ))}
        </div>
      </section>

      <hr className="k-sep" />

      <section className="k-sec" id="sec-filter">
        <h2>
          <span className="k-no">02</span>检索与筛选
        </h2>
        <div className="k-toolbar">
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
        <div className="k-chip-row">
          <button
            type="button"
            className={`k-chip ${tag === "全部" ? "on" : ""}`}
            onClick={() => setTag("全部")}
          >
            全部标签
          </button>
          {allTags.map((t) => (
            <button
              type="button"
              key={t}
              className={`k-chip ${tag === t ? "on" : ""}`}
              onClick={() => setTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <hr className="k-sep" />

      <section className="k-sec" id="sec-ledger">
        <h2>
          <span className="k-no">03</span>账本
        </h2>
        <div className="k-count">
          共 {filtered.length} 条
          {radius !== "全部" ? ` · 半径 ${RADIUS.find((r) => r.id === radius)?.en}` : ""}
          {tag !== "全部" ? ` · 标签 ${tag}` : ""}
          {source !== "全部" ? ` · 来源 ${source}` : ""}
        </div>

        <div className="k-ledger">
          {filtered.map((c) => {
            const open = expanded.has(c.id);
            const related = relateToRadius(c);
            return (
              <article className="k-card" key={c.id}>
                <div className="k-card-head">
                  <span className="k-card-src">{c.source}</span>
                  <span className="k-card-date">{c.date}</span>
                  <span className={`k-mat ${c.maturity}`}>
                    {MATURITY_LABEL[c.maturity] ?? c.maturity}
                  </span>
                </div>
                <h3>
                  <a href={c.url} target="_blank" rel="noreferrer">
                    {c.title}
                  </a>
                </h3>
                <p className="k-sum">
                  {open ? (
                    c.summary || c.tldr || "（摘要待补）"
                  ) : (
                    <>
                      <span className="k-badge">TL;DR</span>
                      {c.tldr || c.summary || "（摘要待补）"}
                    </>
                  )}
                </p>
                {related.length > 0 && (
                  <div className="k-card-radius">
                    {related.map((id) => {
                      const r = RADIUS.find((x) => x.id === id);
                      if (!r) return null;
                      return (
                        <button type="button" key={id} onClick={() => setRadius(id)}>
                          {r.en}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="k-card-tags">
                  {c.tags.map((t) => (
                    <button type="button" key={t} onClick={() => setTag(t)}>
                      #{t}
                    </button>
                  ))}
                </div>
                <div className="k-card-acts">
                  <button type="button" className="k-link" onClick={() => toggleExpand(c.id)}>
                    {open ? "收起" : "查看详情"}
                  </button>
                  {related[0] && (
                    <a
                      className="k-link"
                      href={RADIUS.find((r) => r.id === related[0])?.foundation}
                    >
                      对读基础馆
                    </a>
                  )}
                  <a className="k-link" href={c.url} target="_blank" rel="noreferrer">
                    打开原文 ↗
                  </a>
                </div>
                {open && (
                  <div className="k-detail">
                    {c.cover && (
                      <figure>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.cover}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <figcaption>原文封面 · {c.source}</figcaption>
                      </figure>
                    )}
                    <div className="k-detail-row">
                      <span>概念 ID</span>
                      <code>{c.id}</code>
                    </div>
                    <div className="k-detail-row">
                      <span>入库时间</span>
                      <span>{c.addedAt.slice(0, 10)}</span>
                    </div>
                    <div className="k-detail-row">
                      <span>来源链接</span>
                      <a href={c.url} target="_blank" rel="noreferrer">
                        {c.url}
                      </a>
                    </div>
                    <p className="k-detail-hint">
                      想深入理解？回到{" "}
                      <Link href="/#sec-network">
                        <b>知识网络</b>
                      </Link>{" "}
                      点亮对应节点，或打开首页 AI 导师用反问带你走一遍。
                    </p>
                  </div>
                )}
              </article>
            );
          })}
          {filtered.length === 0 && (
            <p className="k-empty">没有匹配的概念。换个关键词、标签或控制半径再试。</p>
          )}
        </div>
      </section>
    </LabShell>
  );
}

export default ConceptArchive;
