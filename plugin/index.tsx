/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import definePlugin from "@utils/types";
import { React } from "@webpack/common";

import { settings } from "./settings";
import { FullTextView, FullTextViewProps } from "./viewer";

// Discord stable build 643186 (2026-10-20) fetches text previews with
// Range: bytes=0-50000 and then renders "(N MB left)" from the unread tail.
// Anything past that old cap is virtualized so highlight.js cannot freeze the client.
const VIRTUALIZE_AFTER = 64 * 1024;

interface ModalBodyProps {
    useMarkdown: boolean;
    jsx: (type: any, props: any) => React.ReactNode;
    Markdown: any;
    text: string;
    notice: string;
    Highlighter: any;
    language: string;
    wordWrap: boolean;
}

export default definePlugin({
    name: "FullFileViewer",
    description: "Shows the entire text attachment instead of stopping at 50 KB and appending “(N MB left)”.",
    tags: ["Utility"],
    searchTerms: ["text file", "attachment", "preview", "log", "mb left"],
    authors: [{ name: "narayan", id: 0n }],
    settings,
    enabledByDefault: true,

    settingsAboutComponent: () => (
        <>
            <Paragraph>
                Open a text attachment the same way you do now. The preview loads the whole file, up to the size limit below, instead of cutting it off with “(2 MB left)”.
            </Paragraph>
            <Paragraph className={Margins.top8}>
                Large files get a searchable viewer so Discord does not freeze. Close and reopen a file after changing the size limit. Ctrl+F searches inside the open file.
            </Paragraph>
        </>
    ),

    patches: [
        {
            // Text preview module. Discord stable 643186 (2026-10-20).
            find: 'Accept:"text/plain"',
            replacement: [
                {
                    match: /Range:"bytes=0-\d+"/,
                    replace: "Range:$self.previewRange()"
                },
                {
                    // Expanded preview. Passes Discord's wrap toggle and the "(N MB left)" notice through.
                    match: /(\i)\?\(0,(\i)\.jsx\)\((\i),\{text:(\i),notice:(\i)\}\):\(0,\2\.jsx\)\((\i),\{text:\4\+\5,language:(\i),wordWrap:(\i)\}\)/,
                    replace: "$self.renderModalBody({useMarkdown:$1,jsx:$2.jsx,Markdown:$3,text:$4,notice:$5,Highlighter:$6,language:$7,wordWrap:$8})"
                }
            ]
        },
        {
            // Safety net if the modal patch misses. Discord build 670026 (2026-11-11)
            // no longer has location:"PlaintextFilePreview"; the preview renderer is
            // a plain function that wraps the text in a <pre>.
            find: /let\{text:\i,language:\i,className:\i\}=\i,\i=\i\(\)\(\i\.kw,"hljs"/,
            replacement: {
                match: /function\((\i)\)\{(?=let\{text:\i,language:\i,className:\i\}=\1)/,
                replace: "function($1){if($self.shouldVirtualize($1.text))return $self.renderVirtual($1);"
            }
        }
    ],

    previewRange() {
        let mb = 25;
        try {
            mb = Number(settings.store.maxPreviewMB) || 25;
        } catch { }
        mb = Math.min(100, Math.max(1, mb));
        return `bytes=0-${Math.floor(mb * 1024 * 1024) - 1}`;
    },

    shouldVirtualize(text?: unknown) {
        return typeof text === "string" && text.length > VIRTUALIZE_AFTER;
    },

    renderVirtual(props: FullTextViewProps) {
        return React.createElement(FullTextView, props);
    },

    renderModalBody({ useMarkdown, jsx, Markdown, text, notice, Highlighter, language, wordWrap }: ModalBodyProps) {
        const body = text ?? "";
        const tail = notice ?? "";
        if (this.shouldVirtualize(body) || this.shouldVirtualize(body + tail)) {
            return React.createElement(FullTextView, { text: body, notice: tail, language, wordWrap });
        }
        if (useMarkdown) return jsx(Markdown, { text: body, notice: tail });
        return jsx(Highlighter, { text: body + tail, language, wordWrap });
    }
});
