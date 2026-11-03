import { MESSAGE_TYPES } from "../common/messaging";
import { getStorage, setStorage } from "../common/storage";
import { STORAGE_KEYS, DEFAULT_LLM_CONFIG } from "../common/settings";
import { normalizeProfile } from "../common/profile-schema";
import { generateAnswer, testConnection, LlmApiError } from "../common/llm/anthropic-client";

async function runAutofillOnActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { error: "No active tab" };

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content_scripts.js"],
    });

    return { tabId: tab.id };
}

function getLlmConfig() {
    return new Promise((resolve) => {
        getStorage(STORAGE_KEYS.LLM_CONFIG, (saved) => resolve({ ...DEFAULT_LLM_CONFIG, ...saved }));
    });
}

function getProfile() {
    return new Promise((resolve) => {
        getStorage(STORAGE_KEYS.PROFILE, (saved) => resolve(normalizeProfile(saved)));
    });
}

// Runs in the background service worker so the API key never has to be
// passed to (or read by) the content script. See docs/SPEC.md §2.1/§6.3.
async function handleGenerateAiAnswer({ question, jobDescription }) {
    const llmConfig = await getLlmConfig();
    if (!llmConfig.enabled || !llmConfig.apiKey) {
        return { error: "LLM機能が有効になっていません。オプション画面でAPIキーを設定してください。" };
    }

    const profile = await getProfile();
    try {
        const answer = await generateAnswer({ question, jobDescription, profile }, llmConfig);
        return { answer };
    } catch (err) {
        if (err instanceof LlmApiError) return { error: `APIエラー (${err.status}): ${err.body}` };
        return { error: err.message };
    }
}

async function handleTestLlmConnection(llmConfigOverride) {
    const llmConfig = { ...(await getLlmConfig()), ...llmConfigOverride };
    try {
        await testConnection(llmConfig);
        return { ok: true };
    } catch (err) {
        if (err instanceof LlmApiError) return { ok: false, error: `APIエラー (${err.status}): ${err.body}` };
        return { ok: false, error: err.message };
    }
}

// Launched from popup, not options: activeTab only grants temporary
// access to the tab the user invoked the extension UI from, and popup
// (unlike the options tab) IS that tab's invocation context.
// See docs/SPEC.md §7.3. The picker itself writes its result to
// chrome.storage.session (not back through this message channel) since
// the popup that triggered it will already be closed by the time the
// user clicks a page element.
async function startElementPickerOnActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { error: "No active tab" };

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["element_picker.js"],
    });

    return { tabId: tab.id };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.RUN_AUTOFILL) {
        runAutofillOnActiveTab().then(sendResponse).catch((err) => sendResponse({ error: err.message }));
        return true; // keep the message channel open for the async response
    }
    if (message.type === MESSAGE_TYPES.AUTOFILL_RESULT) {
        setStorage(STORAGE_KEYS.RUN_LOG, message.payload);
        return false;
    }
    if (message.type === MESSAGE_TYPES.GENERATE_AI_ANSWER) {
        handleGenerateAiAnswer(message.payload).then(sendResponse);
        return true;
    }
    if (message.type === MESSAGE_TYPES.TEST_LLM_CONNECTION) {
        handleTestLlmConnection(message.payload).then(sendResponse);
        return true;
    }
    if (message.type === MESSAGE_TYPES.START_ELEMENT_PICKER) {
        startElementPickerOnActiveTab().then(sendResponse).catch((err) => sendResponse({ error: err.message }));
        return true;
    }
    return false;
});
