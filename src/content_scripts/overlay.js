const TOAST_ID = "jobhunter-toast";

export function showToast(message, { durationMs = 6000 } = {}) {
    const existing = document.getElementById(TOAST_ID);
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.textContent = message;
    toast.setAttribute("style", [
        "position: fixed",
        "bottom: 16px",
        "right: 16px",
        "z-index: 2147483647",
        "background: #1f1f1f",
        "color: #fff",
        "padding: 12px 16px",
        "border-radius: 6px",
        "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        "font-size: 14px",
        "max-width: 320px",
        "box-shadow: 0 2px 8px rgba(0,0,0,0.3)",
    ].join(";"));

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), durationMs);
    return toast;
}

export function highlightLowConfidenceField(element) {
    element.style.outline = "2px solid #ffc107";
}

export function buildRunSummaryMessage({ filledCount, needsReviewCount, aiAssistCount, needsManualFileUploadCount, strategy }) {
    const strategyLabel = { ats: "ATS検出", custom: "カスタム設定", heuristic: "汎用検出" }[strategy] || strategy;
    let message = `${filledCount}件自動入力しました（${strategyLabel}）`;
    if (needsReviewCount > 0) {
        message += `\n${needsReviewCount}件は確認が必要です`;
    }
    if (aiAssistCount > 0) {
        message += `\n${aiAssistCount}件の自由記述欄にAI入力支援ボタンを表示しました`;
    }
    if (needsManualFileUploadCount > 0) {
        message += `\nレジュメは手動でアップロードしてください（${needsManualFileUploadCount}件）`;
    }
    return message;
}
