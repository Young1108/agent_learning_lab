"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WINGS, type WingId } from "./lab-chrome";

export type ShellNavItem = { id: string; num: string; label: string; color: string; href?: string };

function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((c: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, ready, value]);
  return [value, setValue];
}

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

export function LabShell({
  wing,
  logo,
  tag,
  navItems,
  activeId,
  onActive,
  done,
  onReset,
  crumb,
  progressLabel,
  children,
  footer,
  extra,
  modes,
  mode,
  onMode,
  searchExtra,
}: {
  wing: WingId;
  logo: string;
  tag: string;
  navItems: ShellNavItem[];
  activeId: string;
  onActive?: (id: string) => void;
  done?: string[];
  onReset?: () => void;
  crumb: string;
  progressLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  extra?: ReactNode;
  modes?: { id: string; label: string }[];
  mode?: string;
  onMode?: (id: string) => void;
  searchExtra?: { href: string; label: string; hint: string; kind: string; id?: string }[];
}) {
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("ai-lab-theme", "light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQ, setCmdQ] = useState("");
  const [glide, setGlide] = useState({ y: 0, h: 0, on: false });
  const navRef = useRef<HTMLDivElement>(null);
  const cmdInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
        setCmdQ("");
      }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (cmdOpen) cmdInput.current?.focus();
  }, [cmdOpen]);

  const doneCount = done?.length ?? 0;
  const progress = navItems.length ? Math.round((doneCount / navItems.length) * 100) : 0;
  const activeItem = navItems.find((item) => item.id === activeId) ?? navItems[0];

  const catalog = useMemo(() => {
    const wings = WINGS.map((w) => ({
      href: w.href,
      label: w.label,
      hint: w.hint,
      kind: "馆翼",
    }));
    const secs = navItems.map((item) => ({
      href: item.href ?? `#${item.id}`,
      label: `${item.num} · ${item.label}`,
      hint: "本章",
      kind: "目录",
      id: item.id,
    }));
    const extras = (searchExtra ?? []).map((item) => ({
      href: item.href,
      label: item.label,
      hint: item.hint,
      kind: item.kind,
      id: item.id,
    }));
    return [...wings, ...secs, ...extras];
  }, [navItems, searchExtra]);

  const hits = catalog.filter((c) => {
    const blob = `${c.label} ${c.hint} ${c.kind}`.toLowerCase();
    return blob.includes(cmdQ.trim().toLowerCase());
  });

  function moveGlide(el: HTMLElement) {
    const host = navRef.current;
    if (!host) return;
    const hr = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setGlide({ y: r.top - hr.top + host.scrollTop, h: r.height, on: true });
  }

  return (
    <div className={`lab-shell ${modes?.length ? "has-modes" : ""}`}>
      <div id="progressbar" style={{ width: `${progress}%` }} />

      <nav id="sidebar" className={sidebarOpen ? "open" : ""} aria-label="馆内目录">
        <div className="side-head">
          <div className="logo">
            {logo} <span className="badge">LAB</span>
          </div>
          <div className="tag">{tag}</div>
          <div className="lab-switch wing-switch" role="navigation" aria-label="馆翼">
            {WINGS.map((w) => (
              <a key={w.id} href={w.href} className={w.id === wing ? "on" : undefined} aria-current={w.id === wing ? "page" : undefined}>
                {w.label}
              </a>
            ))}
          </div>
        </div>
        {navItems.length > 0 && (
          <div className="side-prog">
            <ProgressRing value={progress} />
            <div className="sp-info">
              <div className="lbl">
                <span>{progressLabel ?? "学习进度"}</span>
              </div>
              <div className="sp-detail">
                {done ? `已读 ${doneCount}/${navItems.length}` : "同一条控制半径"}
              </div>
            </div>
          </div>
        )}
        <div
          className="side-nav"
          ref={navRef}
          onMouseLeave={() => setGlide((g) => ({ ...g, on: false }))}
        >
          <div
            className={`nav-glide ${glide.on ? "on" : ""}`}
            style={{ transform: `translateY(${glide.y}px)`, height: glide.h || 40 }}
            aria-hidden="true"
          />
          {navItems.map((item) => (
            <a
              key={item.id}
              className={`nav-item ${activeId === item.id ? "active" : ""} ${done?.includes(item.id) ? "done" : ""}`}
              href={item.href ?? `#${item.id}`}
              style={{ ["--nc" as string]: item.color }}
              aria-current={activeId === item.id ? "true" : undefined}
              onMouseEnter={(e) => moveGlide(e.currentTarget)}
              onFocus={(e) => moveGlide(e.currentTarget)}
              onClick={() => {
                onActive?.(item.id);
                setSidebarOpen(false);
              }}
            >
              <span className="num">{item.num}</span>
              <span className="t">{item.label}</span>
              <span className="dot" />
            </a>
          ))}
        </div>
        <div className="side-foot">
          <span className="mini">进度保存在本地</span>
          {onReset && (
            <button className="icon-btn" type="button" title="重置进度" onClick={onReset}>
              ↺
            </button>
          )}
        </div>
      </nav>

      <div id="backdrop" className={sidebarOpen ? "open" : ""} onClick={() => setSidebarOpen(false)} />

      <header className="topbar">
        <button className="icon-btn" type="button" title="目录" aria-label="打开目录" onClick={() => setSidebarOpen((o) => !o)}>
          ☰
        </button>
        <div className="crumb">
          <span className="crumb-dot" style={{ background: activeItem?.color ?? "var(--acc)" }} />
          {crumb}
        </div>
        {modes && modes.length > 0 && (
          <div className="mode-tabs" role="tablist" aria-label="内容模式">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                className={mode === m.id ? "on" : undefined}
                onClick={() => onMode?.(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
        {done && <span className="pct">{progressLabel ? `${progressLabel} ${progress}%` : `进度 ${progress}%`}</span>}
        <button
          className="icon-btn"
          type="button"
          title="搜索 ⌘K"
          aria-label="打开搜索"
          onClick={() => {
            setCmdOpen(true);
            setCmdQ("");
          }}
        >
          ⌕
        </button>
        <button
          className="icon-btn theme-btn"
          type="button"
          title="切换深浅色"
          onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        >
          <span className="theme-ico" key={theme}>
            {theme === "light" ? "🌙" : "☀️"}
          </span>
        </button>
      </header>

      {cmdOpen && (
        <div className="cmdk" role="dialog" aria-label="搜索馆内内容">
          <button type="button" className="cmdk-scrim" aria-label="关闭搜索" onClick={() => setCmdOpen(false)} />
          <div className="cmdk-panel">
            <input
              ref={cmdInput}
              value={cmdQ}
              onChange={(e) => setCmdQ(e.target.value)}
              placeholder="搜索章节、馆翼、Demo…"
              aria-label="搜索"
            />
            <ul>
              {hits.slice(0, 12).map((h) => (
                <li key={`${h.kind}-${h.href}-${h.label}`}>
                  <a
                    href={h.href}
                    onClick={() => {
                      if ("id" in h && h.id) onActive?.(h.id as string);
                      setCmdOpen(false);
                      setSidebarOpen(false);
                    }}
                  >
                    <span className="tool-chip">{h.kind}</span>
                    <span>{h.label}</span>
                    <small>{h.hint}</small>
                  </a>
                </li>
              ))}
              {hits.length === 0 && <li className="cmdk-empty">没有匹配。试试 Loop、MCP、基础馆。</li>}
            </ul>
          </div>
        </div>
      )}

      <main className="lab-main">
        <div className="wrap">
          {children}
          {footer}
        </div>
      </main>

      <button
        type="button"
        className={`to-top ${showTop ? "show" : ""}`}
        aria-label="回到顶部"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        ↑
      </button>
      {extra}
    </div>
  );
}
