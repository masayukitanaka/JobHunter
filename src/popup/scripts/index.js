import { getStorage, setStorage, getSessionStorage, removeSessionStorage } from "../../common/storage";
import { STORAGE_KEYS } from "../../common/settings";
import { MESSAGE_TYPES } from "../../common/messaging";
import { PROFILE_PATH_LABELS, upsertFieldMapping } from "../../common/custom-site-map";

const STRATEGY_LABELS = { ats: "ATS検出", custom: "カスタム設定", heuristic: "汎用検出" };

function renderRunSummary(summary) {
    const container = document.getElementById("lastRunSummary");
    if (!summary) {
        container.textContent = "";
        return;
    }
    const strategyLabel = STRATEGY_LABELS[summary.strategy] || summary.strategy;
    const ranAt = summary.ranAt ? new Date(summary.ranAt).toLocaleTimeString() : "";
    const fileUploadNote = summary.needsManualFileUploadCount > 0
        ? `<p>📎 レジュメは手動でアップロードしてください（${summary.needsManualFileUploadCount}件）</p>`
        : "";
    container.innerHTML = `
        <p>直近の実行結果 (${ranAt}):</p>
        <p>✓ ${summary.filledCount}件入力 / ⚠ ${summary.needsReviewCount}件要確認</p>
        <p>(${strategyLabel})</p>
        ${fileUploadNote}
    `;
}

function loadLastRunSummary() {
    getStorage(STORAGE_KEYS.RUN_LOG, renderRunSummary);
}

function setupRunAutofillButton() {
    const button = document.getElementById("runAutofill");
    const status = document.getElementById("runStatus");

    button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "実行中…";

        try {
            const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RUN_AUTOFILL });
            if (response?.error) {
                status.textContent = `エラー: ${response.error}`;
            } else {
                status.textContent = "実行しました";
                // The content script finishes filling and reports its
                // summary to background asynchronously; poll once after a
                // short delay rather than wiring up a persistent listener
                // for this short-lived popup.
                setTimeout(loadLastRunSummary, 800);
            }
        } catch (err) {
            status.textContent = `エラー: ${err.message}`;
        } finally {
            button.disabled = false;
        }
    });
}

function setupOpenOptionsButton() {
    document.getElementById("openOptions").addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
    });
}

let pendingPickerResult = null; // { selector, fieldKind, hostname } once the user has clicked a page field

function populateProfilePathOptions() {
    const select = document.getElementById("pickedProfilePath");
    select.innerHTML = "";
    Object.entries(PROFILE_PATH_LABELS).forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    });
    const aiAssistOption = document.createElement("option");
    aiAssistOption.value = "";
    aiAssistOption.textContent = "（自由記述欄としてAI入力支援を使う）";
    select.appendChild(aiAssistOption);
}

function showPickerResultForm(pickerResult) {
    pendingPickerResult = pickerResult;
    document.getElementById("pickedSelector").textContent = pickerResult.selector;
    document.getElementById("pickerPrompt").hidden = true;
    document.getElementById("pickerResultForm").hidden = false;
}

function hidePickerResultForm() {
    pendingPickerResult = null;
    document.getElementById("pickerResultForm").hidden = true;
    document.getElementById("pickerPrompt").hidden = false;
}

// On every popup open, check whether the element picker (launched from a
// previous popup session that has since closed — see docs/SPEC.md §7.3)
// left a result behind, and resume the assignment flow if so.
function checkPendingPickerResult() {
    getSessionStorage(STORAGE_KEYS.PICKER_RESULT, (pickerResult) => {
        if (!pickerResult) return;
        removeSessionStorage(STORAGE_KEYS.PICKER_RESULT);

        if (pickerResult.cancelled) return;
        if (pickerResult.error) {
            document.getElementById("pickerStatus").textContent = pickerResult.error;
            return;
        }
        showPickerResultForm(pickerResult);
    });
}

function setupSiteMapping() {
    populateProfilePathOptions();

    document.getElementById("startElementPicker").addEventListener("click", async () => {
        const status = document.getElementById("pickerStatus");
        status.textContent = "ページ上で登録したい入力欄をクリックしてください（Escでキャンセル）";

        try {
            const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.START_ELEMENT_PICKER });
            if (response?.error) status.textContent = response.error;
            // Clicking the page closes this popup immediately after this;
            // the result is picked up on the next popup open (see
            // checkPendingPickerResult).
        } catch (err) {
            status.textContent = `エラー: ${err.message}`;
        }
    });

    document.getElementById("confirmPickedField").addEventListener("click", () => {
        if (!pendingPickerResult) return;
        const profilePath = document.getElementById("pickedProfilePath").value || null;
        const mapping = profilePath
            ? { selector: pendingPickerResult.selector, profilePath }
            : { selector: pendingPickerResult.selector, profilePath: null, aiAssist: true };

        getStorage(STORAGE_KEYS.SITE_MAP, (savedSiteMap) => {
            const updated = upsertFieldMapping(savedSiteMap || {}, pendingPickerResult.hostname, mapping);
            setStorage(STORAGE_KEYS.SITE_MAP, updated);
            hidePickerResultForm();
            document.getElementById("pickerStatus").textContent = "登録しました";
        });
    });

    document.getElementById("cancelPickedField").addEventListener("click", hidePickerResultForm);
}

window.onload = function() {
    setupRunAutofillButton();
    setupOpenOptionsButton();
    setupSiteMapping();
    loadLastRunSummary();
    checkPendingPickerResult();
};
