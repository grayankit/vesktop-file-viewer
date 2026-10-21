/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyWithToast } from "@utils/discord";
import { React, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { settings } from "./settings";

const LINE_HEIGHT = 18;
const OVERSCAN = 12;
const MAX_LINE_CHARS = 20_000;

export interface FullTextViewProps {
    text: string;
    notice?: string;
    language?: string;
    wordWrap?: boolean;
    className?: string;
}

function findStart(offsets: ArrayLike<number>, scrollTop: number) {
    let lo = 0;
    let hi = offsets.length - 2;
    if (hi < 0) return 0;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (offsets[mid + 1] <= scrollTop) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function highlight(line: string, query: string, sensitive: boolean) {
    if (!query) return line;
    const haystack = sensitive ? line : line.toLowerCase();
    const needle = sensitive ? query : query.toLowerCase();
    const parts: Array<string | React.ReactElement> = [];
    let from = 0;
    let hits = 0;
    while (hits < 40) {
        const at = haystack.indexOf(needle, from);
        if (at < 0) break;
        if (at > from) parts.push(line.slice(from, at));
        parts.push(
            <mark className="vc-ffv-mark" key={at}>
                {line.slice(at, at + needle.length)}
            </mark>
        );
        from = at + needle.length;
        hits++;
    }
    if (from < line.length) parts.push(line.slice(from));
    return parts.length ? parts : line;
}

export function FullTextView({ text, notice, wordWrap, className }: FullTextViewProps) {
    const { showLineNumbers } = settings.use(["showLineNumbers"]);
    const lines = useMemo(
        () => text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n"),
        [text]
    );
    const maxChars = useMemo(() => lines.reduce((max, line) => Math.max(max, line.length), 0), [lines]);

    const rootRef = useRef<HTMLDivElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const rafRef = useRef(0);

    const [scrollTop, setScrollTop] = useState(0);
    const [viewport, setViewport] = useState({ width: 0, height: 480 });
    const [charWidth, setCharWidth] = useState(7.8);
    const [query, setQuery] = useState("");
    const [sensitive, setSensitive] = useState(false);
    const [cursor, setCursor] = useState(0);
    const [findOpen, setFindOpen] = useState(false);
    const wrap = wordWrap ?? true;

    useEffect(() => {
        const el = measureRef.current;
        if (!el) return;
        const width = el.getBoundingClientRect().width / 10;
        if (width > 0) setCharWidth(width);
    }, [lines.length]);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const observer = new ResizeObserver(() => {
            setViewport({ width: el.clientWidth, height: el.clientHeight });
        });
        observer.observe(el);
        setViewport({ width: el.clientWidth, height: el.clientHeight });
        return () => observer.disconnect();
    }, []);

    useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

    const gutterChars = showLineNumbers ? String(Math.max(lines.length, 1)).length : 0;
    const gutterPx = showLineNumbers ? gutterChars * charWidth + 22 : 0;
    const textWidth = Math.max(32, viewport.width - gutterPx - 16);
    const charsPerLine = Math.max(8, Math.floor(textWidth / charWidth) - 1);

    const measured = viewport.width > 80;
    const layout = useMemo(() => {
        if (!wrap || !measured) {
            return {
                total: lines.length * LINE_HEIGHT,
                offset: (index: number) => index * LINE_HEIGHT,
                height: () => LINE_HEIGHT,
                startAt: (top: number) => Math.min(lines.length, Math.floor(top / LINE_HEIGHT))
            };
        }
        const heights = new Uint16Array(lines.length);
        const offsets = new Float64Array(lines.length + 1);
        for (let i = 0; i < lines.length; i++) {
            const visual = Math.max(1, Math.ceil((lines[i].length || 1) / charsPerLine));
            heights[i] = Math.min(visual, 80) * LINE_HEIGHT;
            offsets[i + 1] = offsets[i] + heights[i];
        }
        return {
            total: offsets[lines.length] || 0,
            offset: (index: number) => offsets[index] || 0,
            height: (index: number) => heights[index] || LINE_HEIGHT,
            startAt: (top: number) => findStart(offsets, top)
        };
    }, [wrap, measured, lines, charsPerLine]);

    const matches = useMemo(() => {
        const needle = query.trim();
        if (!needle) return [] as number[];
        const found: number[] = [];
        const q = sensitive ? needle : needle.toLowerCase();
        for (let i = 0; i < lines.length; i++) {
            const line = sensitive ? lines[i] : lines[i].toLowerCase();
            if (line.includes(q)) found.push(i);
        }
        return found;
    }, [lines, query, sensitive]);

    const layoutRef = useRef(layout);
    layoutRef.current = layout;

    useEffect(() => {
        if (!matches.length) return;
        const el = scrollerRef.current;
        if (!el) return;
        const index = matches[Math.min(cursor, matches.length - 1)];
        el.scrollTop = Math.max(0, layoutRef.current.offset(index) - LINE_HEIGHT);
    }, [matches, cursor]);

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") return;
            if (!rootRef.current?.isConnected) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            setFindOpen(true);
            requestAnimationFrame(() => {
                searchRef.current?.focus();
                searchRef.current?.select();
            });
        }
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    }, []);

    function onScroll() {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            const el = scrollerRef.current;
            if (el) setScrollTop(el.scrollTop);
        });
    }

    function goMatch(delta: number) {
        if (!matches.length) return;
        setCursor(current => (current + delta + matches.length) % matches.length);
    }

    const viewHeight = viewport.height || 480;
    const from = Math.max(0, layout.startAt(scrollTop) - OVERSCAN);
    let end = from;
    const limit = scrollTop + viewHeight + OVERSCAN * LINE_HEIGHT;
    while (end < lines.length && layout.offset(end) < limit) end++;
    end = Math.min(lines.length, end + OVERSCAN);
    const currentMatch = matches.length ? matches[Math.min(cursor, matches.length - 1)] : -1;
    const matchSet = useMemo(() => new Set(matches), [matches]);
    const contentWidth = wrap
        ? Math.max(viewport.width, 1)
        : Math.max(viewport.width, gutterPx + Math.min(maxChars, MAX_LINE_CHARS) * charWidth + 24);

    const rows: React.ReactElement[] = [];
    for (let i = from; i < end; i++) {
        const raw = lines[i];
        const shown = raw.length > MAX_LINE_CHARS ? raw.slice(0, MAX_LINE_CHARS) + "…" : raw;
        const isCurrent = i === currentMatch;
        rows.push(
            <div
                key={i}
                className={"vc-ffv-row" + (wrap ? " is-wrap" : "") + (matchSet.has(i) ? " is-match" : "") + (isCurrent ? " is-current" : "")}
                style={{ top: layout.offset(i), height: layout.height(i), width: wrap ? contentWidth : undefined }}
            >
                {showLineNumbers && (
                    <span className="vc-ffv-gutter" style={{ width: gutterPx }}>
                        {i + 1}
                    </span>
                )}
                <span className="vc-ffv-text">
                    {highlight(shown, query.trim(), sensitive)}
                </span>
            </div>
        );
    }

    const trimmedNotice = notice?.replace(/^\.\.\.\s*/, "").trim();

    function closeFind() {
        setQuery("");
        setFindOpen(false);
    }

    return (
        <div ref={rootRef} className={"vc-ffv" + (className ? " " + className : "")}>
            {findOpen ? (
                <div className="vc-ffv-find">
                    <input
                        ref={searchRef}
                        className="vc-ffv-search"
                        placeholder="Find"
                        value={query}
                        spellCheck={false}
                        aria-label="Find in file"
                        onChange={event => {
                            setQuery(event.target.value);
                            setCursor(0);
                        }}
                        onKeyDown={event => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                event.stopPropagation();
                                closeFind();
                                return;
                            }
                            if (event.key === "Enter") {
                                event.preventDefault();
                                goMatch(event.shiftKey ? -1 : 1);
                            }
                        }}
                    />
                    <span className="vc-ffv-count">
                        {query.trim() ? (matches.length ? `${cursor + 1}/${matches.length.toLocaleString("en-US")}` : "0") : ""}
                    </span>
                    <button type="button" className="vc-ffv-icon" disabled={!matches.length} aria-label="Previous match" onClick={() => goMatch(-1)}>
                        <Caret dir="up" />
                    </button>
                    <button type="button" className="vc-ffv-icon" disabled={!matches.length} aria-label="Next match" onClick={() => goMatch(1)}>
                        <Caret dir="down" />
                    </button>
                    <button type="button" className={"vc-ffv-icon" + (sensitive ? " is-on" : "")} aria-label="Match case" onClick={() => setSensitive(value => !value)}>
                        Aa
                    </button>
                    <button type="button" className="vc-ffv-icon" aria-label="Copy file" onClick={() => copyWithToast(text, "Copied the full file")}>
                        <CopyMark />
                    </button>
                    <button type="button" className="vc-ffv-icon" aria-label="Close find" onClick={closeFind}>
                        <CloseMark />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    className="vc-ffv-icon vc-ffv-find-toggle"
                    aria-label="Find in file"
                    onClick={() => {
                        setFindOpen(true);
                        requestAnimationFrame(() => searchRef.current?.focus());
                    }}
                >
                    <SearchMark />
                </button>
            )}
            {trimmedNotice && (
                <div className="vc-ffv-banner">
                    Still cut off ({trimmedNotice}). Raise the size limit in Full File Viewer settings, then reopen this file.
                </div>
            )}
            <div
                ref={scrollerRef}
                className={"vc-ffv-scroll" + (wrap ? " is-wrap" : "")}
                onScroll={onScroll}
                role="region"
                aria-label="File contents"
            >
                <span ref={measureRef} className="vc-ffv-measure">0000000000</span>
                <div className="vc-ffv-spacer" style={{ height: layout.total, width: wrap ? "100%" : contentWidth }}>
                    {rows}
                </div>
            </div>
        </div>
    );
}

function SearchMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M15.62 17.03a9 9 0 1 1 1.41-1.41l4.68 4.67a1 1 0 0 1-1.42 1.42l-4.67-4.68ZM17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>
    );
}

function Caret({ dir }: { dir: "up" | "down"; }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={dir === "up" ? { transform: "rotate(180deg)" } : undefined}>
            <path fill="currentColor" d="M8.3 10.3a1 1 0 0 1 1.4 0L12 12.58l2.3-2.3a1 1 0 1 1 1.4 1.42l-3 3a1 1 0 0 1-1.4 0l-3-3a1 1 0 0 1 0-1.42Z" />
        </svg>
    );
}

function CloseMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z" />
        </svg>
    );
}

function CopyMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M3 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2H5a2 2 0 0 1-2-2V5Zm2 0v8h6V5H5Zm4 12v2h8V9h-2v6a2 2 0 0 1-2 2H9Z" />
        </svg>
    );
}
