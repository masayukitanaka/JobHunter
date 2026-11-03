import { buildSystemPrompt, buildUserPrompt } from "./prompt-builder";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export class LlmApiError extends Error {
    constructor(status, body) {
        super(`Anthropic API error (${status}): ${body}`);
        this.status = status;
        this.body = body;
    }
}

// Runs in the background service worker only — never called from a content
// script, so the API key never leaves that context. See docs/SPEC.md §2.1.
export async function generateAnswer({ question, jobDescription, profile }, llmConfig) {
    const systemPrompt = buildSystemPrompt(profile);
    const userPrompt = buildUserPrompt({ question, jobDescription });

    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": llmConfig.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
            model: llmConfig.model,
            max_tokens: llmConfig.maxOutputTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new LlmApiError(response.status, body);
    }

    const data = await response.json();
    return data.content?.[0]?.text ?? "";
}

// Minimal round-trip used by the options page's "connection test" button
// (docs/SPEC.md §7.4). Reuses the same endpoint with a tiny token budget.
export async function testConnection(llmConfig) {
    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": llmConfig.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
            model: llmConfig.model,
            max_tokens: 8,
            messages: [{ role: "user", content: "Reply with OK." }],
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new LlmApiError(response.status, body);
    }
    return true;
}
