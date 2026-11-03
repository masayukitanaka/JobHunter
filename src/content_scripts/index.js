import { getStorage, setStorage } from "../common/storage";
import { STORAGE_KEYS } from "../common/settings";
import { MESSAGE_TYPES } from "../common/messaging";
import { normalizeProfile } from "../common/profile-schema";
import { lookupEssayAnswer, upsertEssayAnswer } from "../common/essay-cache";
import { detectFields } from "./detectors";
import { fillField } from "./fillers/field-filler";
import { injectAiAssistButton } from "./fillers/ai-assist-button";
import { extractJobDescription } from "./job-description";
import { showToast, highlightLowConfidenceField, buildRunSummaryMessage } from "./overlay";

function requestAiAnswer({ question, jobDescription }) {
    return chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GENERATE_AI_ANSWER,
        payload: { question, jobDescription },
    }).then((response) => {
        if (response?.error) throw new Error(response.error);
        return response.answer;
    });
}

function showAiAssistError(button, err) {
    const existing = button.nextElementSibling;
    if (existing?.classList?.contains("jobhunter-ai-assist-error")) existing.remove();

    const errorEl = document.createElement("span");
    errorEl.className = "jobhunter-ai-assist-error";
    errorEl.textContent = `エラー: ${err.message}`;
    errorEl.setAttribute("style", "color: #c00; font-size: 12px; margin-left: 8px;");
    button.insertAdjacentElement("afterend", errorEl);
}

// Reads the profile value at a dot-separated path, e.g. "personal.firstName".
function getProfileValue(profile, profilePath) {
    if (!profilePath) return undefined;
    return profilePath.split(".").reduce((value, key) => (value == null ? undefined : value[key]), profile);
}

async function runAutofill() {
    const [savedProfile, savedLlmConfig] = await Promise.all([
        new Promise((resolve) => getStorage(STORAGE_KEYS.PROFILE, resolve)),
        new Promise((resolve) => getStorage(STORAGE_KEYS.LLM_CONFIG, resolve)),
    ]);
    let profile = normalizeProfile(savedProfile);
    const llmEnabled = Boolean(savedLlmConfig?.enabled);

    // Saved back to storage whenever a fresh AI answer is generated, so
    // the same question elsewhere on this form (or on a later application)
    // can be filled from cache instead of calling the API again. See
    // docs/SPEC.md §3.2.
    function cacheEssayAnswer(question, answer) {
        profile = { ...profile, essayAnswers: upsertEssayAnswer(profile.essayAnswers, question, answer) };
        setStorage(STORAGE_KEYS.PROFILE, profile);
    }

    const { strategy, fields } = await detectFields(document, window.location.hostname);

    let filledCount = 0;
    let needsReviewCount = 0;
    let aiAssistCount = 0;
    let needsManualFileUploadCount = 0;

    // Extracted once per run and shared across every "AIで作成" button click
    // (docs/SPEC.md §6.2) rather than re-scraping the page on every click.
    let cachedJobDescription = null;
    const getJobDescription = () => {
        if (cachedJobDescription === null) cachedJobDescription = extractJobDescription(document);
        return cachedJobDescription;
    };

    fields.forEach((fieldMatch) => {
        if (fieldMatch.isFreeTextEssay) {
            if (llmEnabled) {
                injectAiAssistButton(fieldMatch, {
                    getJobDescription,
                    generateAnswerFn: requestAiAnswer,
                    getCachedAnswer: (question) => lookupEssayAnswer(profile.essayAnswers, question)?.answer ?? null,
                    onAnswerGenerated: cacheEssayAnswer,
                    onError: showAiAssistError,
                });
                aiAssistCount += 1;
            }
            return;
        }
        if (!fieldMatch.profilePath) return;

        const value = getProfileValue(profile, fieldMatch.profilePath);
        const didFill = fillField(fieldMatch, value);

        if (didFill) {
            filledCount += 1;
            if (fieldMatch.confidence === "low") {
                needsReviewCount += 1;
                highlightLowConfidenceField(fieldMatch.element);
            }
        } else if (fieldMatch.fieldKind === "file" && value) {
            // fillField never writes a value into a file input (browsers
            // don't allow it) — it only highlights it. Still worth
            // reporting so the user doesn't miss it. See docs/SPEC.md §5.2/§7.5.
            needsManualFileUploadCount += 1;
        }
    });

    const summary = { filledCount, needsReviewCount, aiAssistCount, needsManualFileUploadCount, strategy, ranAt: Date.now() };
    showToast(buildRunSummaryMessage(summary));
    return summary;
}

// Exposed for chrome.scripting.executeScript({ func: ... }) style invocation
// as well as the IIFE-on-injection path used by the popup (see docs/SPEC.md §2.1).
window.__jobhunterRunAutofill = runAutofill;

runAutofill().then((summary) => {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.AUTOFILL_RESULT, payload: summary }).catch(() => {});
});
