import { generateAnswer, testConnection, LlmApiError } from "./anthropic-client";

const llmConfig = { apiKey: "test-key", model: "claude-sonnet-5", maxOutputTokens: 1024 };

beforeEach(() => {
    global.fetch = jest.fn();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("anthropic-client → generateAnswer", () => {
    test("sends the API key, model, and prompts to the Messages API", async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ content: [{ text: "Generated answer" }] }),
        });

        const result = await generateAnswer(
            { question: "Why us?", jobDescription: "JD text", profile: { skills: [], experiences: [], education: [] } },
            llmConfig
        );

        expect(result).toBe("Generated answer");
        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.anthropic.com/v1/messages",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({ "x-api-key": "test-key" }),
            })
        );

        const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
        expect(requestBody.model).toBe("claude-sonnet-5");
        expect(requestBody.messages[0].content).toContain("Why us?");
    });

    test("throws LlmApiError with status and body on a non-ok response", async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => "invalid api key",
        });

        await expect(
            generateAnswer({ question: "q", jobDescription: "jd", profile: {} }, llmConfig)
        ).rejects.toThrow(LlmApiError);
    });

    test("returns empty string when response content is missing", async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ content: [] }) });

        const result = await generateAnswer({ question: "q", jobDescription: "jd", profile: {} }, llmConfig);
        expect(result).toBe("");
    });
});

describe("anthropic-client → testConnection", () => {
    test("resolves true on a successful response", async () => {
        global.fetch.mockResolvedValue({ ok: true, json: async () => ({ content: [{ text: "OK" }] }) });
        await expect(testConnection(llmConfig)).resolves.toBe(true);
    });

    test("throws LlmApiError on failure", async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" });
        await expect(testConnection(llmConfig)).rejects.toThrow(LlmApiError);
    });
});
