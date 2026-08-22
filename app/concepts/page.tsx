"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import conceptsData from "../../data/concepts.json";

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [subs, setSubs] = useLocalStorage<{ tags: string[]; email: string }>("ai-lab-subs", {
    tags: [],
    email: "",
  });
  const [seenVersion, setSeenVersion] = useLocalStorage<number>("ai-lab-seen-version", 0);
  const [showSub, setShowSub] = useState(false);
  const [draftEmail, setDraftEmail] = useState("");

  const concepts = DATA.concepts;

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
      if (q && !`${c.title} ${c.summary} ${c.tags.join(" ")}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [concepts, query, tag, maturity, source]);

  const subTags = subs.tags;
  const recommendedCount = useMemo(
    () =>
      subTags.length === 0
        ? 0
        : concepts.filter((c) => c.tags.some((t) => subTags.includes(t))).length,
    [concepts, subTags],
  );

  function toggleTag(t: string) {
    setSubs((cur) => ({
      ...cur,
      tags: cur.tags.includes(t)
        ? cur.tags.filter((x) => x !== t)
        : [...cur.tags, t],
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
    <div className="archive-shell">
      <div className="archive-top">
        <Link className="archive-back" href="/">
          ← 返回 AI Learning Lab 首页
        </Link>
        <div className="hero archive-hero">
          <h1>
            前沿概念馆
            <br />
            <span className="grad">每日自动抓取 · 持续沉淀</span>
          </h1>
          <p className="sub">
            定时抓取 OpenAI / Google DeepMind / Google AI Blog / Hugging Face /
            arXiv 等一手来源，把最新 AI 工程概念沉淀成可检索、可订阅的学习素材。
          </p>
          <div className="meta-chips">
            <span className="mc">📥 概念 {DATA.conceptCount}+</span>
            <span className="mc">🔗 来源 {DATA.sourceCount} 个</span>
            <span className="mc">🔄 每日自动更新</span>
            <span className="mc">🕓 更新于 {DATA.updatedAt.slice(0, 10)}</span>
          </div>
        </div>

        {isNewVisit && (
          <div className="archive-banner">
            ✨ 自上次访问新增 <b>{newCount}</b> 个概念（v{DATA.version}）。{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => setSeenVersion(DATA.version)}
            >
              标记为已读
            </button>
          </div>
        )}
      </div>

      <div className="archive-sub" style={{ ["--sc" as string]: "#7c3aed" }}>
        <div className="as-head">
          <div>
            <b>订阅概念方向</b>
            <small>
              {subTags.length > 0
                ? `已订阅 ${subTags.length} 个方向，馆内相关概念 ${recommendedCount} 条`
                : "选择你关心的方向，新概念到达时优先提醒"}
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
                订阅信息仅保存在你当前浏览器。邮箱用于后续邮件提醒（邮件网关接入后启用）；
                当前会以站内横幅提醒新概念。{" "}
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
        <button
          type="button"
          className={`at-chip ${tag === "全部" ? "on" : ""}`}
          onClick={() => setTag("全部")}
        >
          全部
        </button>
        {allTags.map((t) => (
          <button
            type="button"
            key={t}
            className={`at-chip ${tag === t ? "on" : ""}`}
            onClick={() => setTag(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="archive-count">
        共 {filtered.length} 条概念
      </div>

      <div className="archive-list">
        {filtered.map((c) => {
          const open = expanded.has(c.id);
          return (
            <article className="concept-card" key={c.id}>
              <div className="cc-head">
                <span className={`maturity ${c.maturity}`}>
                  {MATURITY_LABEL[c.maturity] ?? c.maturity}
                </span>
                <span className="cc-source">{c.source}</span>
                <span className="cc-date">{c.date}</span>
              </div>
              <h3>{c.title}</h3>
              <p className={open ? "cc-summary open" : "cc-summary"}>{c.summary}</p>
              <div className="cc-tags">
                {c.tags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    className="cc-tag"
                    onClick={() => setTag(t)}
                  >
                    #{t}
                  </button>
                ))}
              </div>
              <div className="cc-actions">
                <button type="button" className="text-button" onClick={() => toggleExpand(c.id)}>
                  {open ? "收起" : "查看详情"}
                </button>
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
                    想要深入理解这个概念？回到首页打开 <b>🧑🏫 AI 导师</b>，它会结合你所在章节用反问方式带你搞懂它。
                  </p>
                </div>
              )}
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ marginTop: 8 }}>
            <span className="es-ico" aria-hidden="true">
              🔍
            </span>
            <p>没有匹配的概念，换个关键词或筛选条件试试。</p>
          </div>
        )}
      </div>

      <footer className="archive-foot">
        概念库每日本地抓取入库（GitHub Actions 定时任务）；来源与条目自动去重，上限 400
        条。<br />
        标记为 proposed 的概念仅代表提出方主张，不等于行业已形成统一标准。
      </footer>
    </div>
  );
}

export default ConceptArchive;
