import { buildRunSummaryMessage, showToast } from "./overlay";

describe("overlay → buildRunSummaryMessage", () => {
    test("reports filled count and strategy label", () => {
        const message = buildRunSummaryMessage({ filledCount: 8, needsReviewCount: 0, strategy: "ats" });
        expect(message).toBe("8件自動入力しました（ATS検出）");
    });

    test("appends a review warning when some fields need review", () => {
        const message = buildRunSummaryMessage({ filledCount: 5, needsReviewCount: 2, strategy: "heuristic" });
        expect(message).toContain("5件自動入力しました（汎用検出）");
        expect(message).toContain("2件は確認が必要です");
    });

    test("appends an AI-assist count when essay fields got a button", () => {
        const message = buildRunSummaryMessage({ filledCount: 3, needsReviewCount: 0, aiAssistCount: 2, strategy: "heuristic" });
        expect(message).toContain("2件の自由記述欄にAI入力支援ボタンを表示しました");
    });

    test("appends a manual file upload reminder when a resume field was found", () => {
        const message = buildRunSummaryMessage({ filledCount: 3, needsReviewCount: 0, needsManualFileUploadCount: 1, strategy: "heuristic" });
        expect(message).toContain("レジュメは手動でアップロードしてください（1件）");
    });
});

describe("overlay → showToast", () => {
    test("renders a single toast element, replacing any previous one", () => {
        document.body.innerHTML = "";
        showToast("first");
        showToast("second");

        const toasts = document.querySelectorAll("#jobhunter-toast");
        expect(toasts.length).toBe(1);
        expect(toasts[0].textContent).toBe("second");
    });
});
