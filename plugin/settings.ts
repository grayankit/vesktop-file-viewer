/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    maxPreviewMB: {
        type: OptionType.SLIDER,
        description: "How many megabytes of a text file to load. Discord normally stops at 50 KB. Close and reopen the file after changing this.",
        markers: [1, 8, 16, 25, 50, 100],
        default: 25,
        stickToMarkers: true
    },
    showLineNumbers: {
        type: OptionType.BOOLEAN,
        description: "Show line numbers when viewing a large text file",
        default: true
    }
});
