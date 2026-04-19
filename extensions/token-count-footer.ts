/**
 * Token Count Footer Extension
 *
 * Replaces the default footer with a custom one that shows actual token counts
 * instead of just percentages. Shows format like "45.2k/200k" instead of "22.6%/200k".
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent/dist/modes/interactive/theme/theme.js";
import type { ReadonlyFooterDataProvider } from "@mariozechner/pi-coding-agent/dist/core/footer-data-provider.js";

/**
 * Format token counts (similar to web-ui)
 */
function formatTokens(count: number): string {
    if (count < 1000)
        return count.toString();
    if (count < 10000)
        return `${(count / 1000).toFixed(1)}k`;
    if (count < 1000000)
        return `${Math.round(count / 1000)}k`;
    if (count < 10000000)
        return `${(count / 1000000).toFixed(1)}M`;
    return `${Math.round(count / 1000000)}M`;
}

export default function (pi: ExtensionAPI) {
    pi.on("session_start", async (_event, ctx) => {
        // Create custom footer component
        ctx.ui.setFooter((tui, theme, footerData) => {
            return new CustomFooterComponent(ctx, theme, footerData);
        });
    });
}

class CustomFooterComponent implements Component {
    private ctx: any;
    private theme: Theme;
    private footerData: ReadonlyFooterDataProvider;
    private autoCompactEnabled: boolean = true;

    constructor(ctx: any, theme: Theme, footerData: ReadonlyFooterDataProvider) {
        this.ctx = ctx;
        this.theme = theme;
        this.footerData = footerData;
    }

    invalidate(): void {
        // No-op
    }

    dispose(): void {
        // No-op
    }

    render(width: number): string[] {
        const session = this.ctx.sessionManager.getCurrentSession();
        if (!session) {
            return [];
        }

        const state = session.state;

        // Calculate cumulative usage from ALL session entries
        let totalInput = 0;
        let totalOutput = 0;
        let totalCacheRead = 0;
        let totalCacheWrite = 0;
        let totalCost = 0;

        for (const entry of session.sessionManager.getEntries()) {
            if (entry.type === "message" && entry.message.role === "assistant") {
                totalInput += entry.message.usage.input;
                totalOutput += entry.message.usage.output;
                totalCacheRead += entry.message.usage.cacheRead;
                totalCacheWrite += entry.message.usage.cacheWrite;
                totalCost += entry.message.usage.cost.total;
            }
        }

        // Get context usage - now showing tokens instead of percentage
        const contextUsage = session.getContextUsage();
        const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
        const contextTokens = contextUsage?.tokens;

        // Replace home directory with ~
        let pwd = session.sessionManager.getCwd();
        const home = process.env.HOME || process.env.USERPROFILE;
        if (home && pwd.startsWith(home)) {
            pwd = `~${pwd.slice(home.length)}`;
        }

        // Add git branch if available
        const branch = this.footerData.getGitBranch();
        if (branch) {
            pwd = `${pwd} (${branch})`;
        }

        // Add session name if set
        const sessionName = session.sessionManager.getSessionName();
        if (sessionName) {
            pwd = `${pwd} • ${sessionName}`;
        }

        // Build stats line - skip input/output tokens, only show cache and cost
        const statsParts: string[] = [];
        if (totalCacheRead)
            statsParts.push(`R${formatTokens(totalCacheRead)}`);
        if (totalCacheWrite)
            statsParts.push(`W${formatTokens(totalCacheWrite)}`);

        // Show cost with "(sub)" indicator if using OAuth subscription
        const usingSubscription = state.model ? session.modelRegistry.isUsingOAuth(state.model) : false;
        if (totalCost || usingSubscription) {
            const costStr = `$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`;
            statsParts.push(costStr);
        }

        // Show token count instead of percentage
        let contextDisplay: string;
        
        if (contextTokens === null || contextTokens === undefined) {
            // Tokens unknown (e.g., right after compaction)
            contextDisplay = `?/${formatTokens(contextWindow)}`;
        } else {
            // Show actual token count
            contextDisplay = `${formatTokens(contextTokens)}/${formatTokens(contextWindow)}`;
        }

        // Colorize based on usage percentage (still calculate percentage for color coding)
        const contextPercentValue = contextUsage?.percent ?? 0;
        let contextDisplayStr: string;
        if (contextPercentValue > 90) {
            contextDisplayStr = this.theme.fg("error", contextDisplay);
        } else if (contextPercentValue > 70) {
            contextDisplayStr = this.theme.fg("warning", contextDisplay);
        } else {
            contextDisplayStr = contextDisplay;
        }

        statsParts.push(contextDisplayStr);

        // Combine pwd and stats on the same line
        const leftSide = `${pwd}  ${statsParts.join(" ")}`;

        // Add model name on the right side
        const modelName = state.model?.id || "no-model";

        // Add thinking level indicator if model supports reasoning
        let rightSideWithoutProvider = modelName;
        if (state.model?.reasoning) {
            const thinkingLevel = state.thinkingLevel || "off";
            rightSideWithoutProvider =
                thinkingLevel === "off" ? `${modelName} [thinking off]` : `${modelName} [${thinkingLevel}]`;
        }

        // Prepend the provider in parentheses if there are multiple providers
        let rightSide = rightSideWithoutProvider;
        if (this.footerData.getAvailableProviderCount() > 1 && state.model) {
            rightSide = `(${state.model.provider}) ${rightSideWithoutProvider}`;
        }

        // Calculate widths for layout
        const leftSideWidth = this.visibleWidth(leftSide);
        const rightSideWidth = this.visibleWidth(rightSide);
        const minPadding = 2;
        const totalNeeded = leftSideWidth + minPadding + rightSideWidth;

        let footerLine: string;
        if (totalNeeded <= width) {
            const padding = " ".repeat(width - leftSideWidth - rightSideWidth);
            footerLine = leftSide + padding + rightSide;
        } else {
            // Truncate left side if needed
            const availableForLeft = width - rightSideWidth - minPadding;
            if (availableForLeft > 0) {
                const truncatedLeft = this.truncateToWidth(leftSide, availableForLeft, "...");
                const truncatedLeftWidth = this.visibleWidth(truncatedLeft);
                const padding = " ".repeat(Math.max(0, width - truncatedLeftWidth - rightSideWidth));
                footerLine = truncatedLeft + padding + rightSide;
            } else {
                footerLine = this.truncateToWidth(leftSide, width, "...");
            }
        }

        // Apply dim styling
        const dimFooterLine = this.theme.fg("dim", footerLine);

        const lines = [dimFooterLine];

        // Add extension statuses
        const extensionStatuses = this.footerData.getExtensionStatuses();
        if (extensionStatuses.size > 0) {
            const sortedStatuses = Array.from(extensionStatuses.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([, text]) => this.sanitizeStatusText(text));
            const statusLine = sortedStatuses.join(" ");
            lines.push(this.truncateToWidth(statusLine, width, this.theme.fg("dim", "...")));
        }

        return lines;
    }

    private visibleWidth(text: string): number {
        // Simple implementation - strips ANSI codes and counts characters
        return text.replace(/\x1b\[[0-9;]*m/g, '').length;
    }

    private truncateToWidth(text: string, width: number, suffix: string = ""): string {
        const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
        if (stripped.length <= width) {
            return text;
        }
        const availableWidth = width - suffix.length;
        return stripped.substring(0, Math.max(0, availableWidth)) + suffix;
    }

    private sanitizeStatusText(text: string): string {
        return text
            .replace(/[\r\n\t]/g, " ")
            .replace(/ +/g, " ")
            .trim();
    }
}
