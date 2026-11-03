import { injectAiAssistButton, extractQuestionText } from "./ai-assist-button";

function flushMicrotasks() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ai-assist-button → extractQuestionText", () => {
    test("prefers the associated label text", () => {
        document.body.innerHTML = `<label for="q1">Why do you want to work here?</label><textarea id="q1"></textarea>`;
        expect(extractQuestionText(document.getElementById("q1"))).toBe("Why do you want to work here?");
    });

    test("falls back to the nearest preceding sibling text when there is no label", () => {
        document.body.innerHTML = `<p>Tell us about a challenge you overcame</p><textarea id="q2"></textarea>`;
        expect(extractQuestionText(document.getElementById("q2"))).toBe("Tell us about a challenge you overcame");
    });

    test("returns empty string when nothing is found", () => {
        document.body.innerHTML = `<textarea id="q3"></textarea>`;
        expect(extractQuestionText(document.getElementById("q3"))).toBe("");
    });
});

describe("ai-assist-button → injectAiAssistButton", () => {
    test("inserts a button immediately after the field element", () => {
        document.body.innerHTML = `<textarea id="essay"></textarea>`;
        const element = document.getElementById("essay");

        injectAiAssistButton({ element, fieldKind: "textarea" }, {
            getJobDescription: () => "",
            generateAnswerFn: jest.fn(),
        });

        expect(element.nextElementSibling.textContent).toBe("✨ AIで作成");
        expect(element.nextElementSibling.tagName).toBe("BUTTON");
    });

    test("calls generateAnswerFn with question and job description, then fills the field", async () => {
        document.body.innerHTML = `<label for="essay">Why us?</label><textarea id="essay"></textarea>`;
        const element = document.getElementById("essay");
        const generateAnswerFn = jest.fn().mockResolvedValue("Generated answer text");

        const button = injectAiAssistButton({ element, fieldKind: "textarea" }, {
            getJobDescription: () => "We build widgets",
            generateAnswerFn,
        });

        button.click();
        await flushMicrotasks();

        expect(generateAnswerFn).toHaveBeenCalledWith({ question: "Why us?", jobDescription: "We build widgets" });
        expect(element.value).toBe("Generated answer text");
    });

    test("shows an undo link that restores the original value when clicked", async () => {
        document.body.innerHTML = `<textarea id="essay">Original draft</textarea>`;
        const element = document.getElementById("essay");
        const generateAnswerFn = jest.fn().mockResolvedValue("AI generated text");

        const button = injectAiAssistButton({ element, fieldKind: "textarea" }, {
            getJobDescription: () => "",
            generateAnswerFn,
        });

        button.click();
        await flushMicrotasks();
        expect(element.value).toBe("AI generated text");

        const undoLink = document.querySelector("a");
        expect(undoLink.textContent).toBe("元に戻す");
        undoLink.click();

        expect(element.value).toBe("Original draft");
    });

    test("calls onError and re-enables the button when generation fails", async () => {
        document.body.innerHTML = `<textarea id="essay"></textarea>`;
        const element = document.getElementById("essay");
        const generateAnswerFn = jest.fn().mockRejectedValue(new Error("API error"));
        const onError = jest.fn();

        const button = injectAiAssistButton({ element, fieldKind: "textarea" }, {
            getJobDescription: () => "",
            generateAnswerFn,
            onError,
        });

        button.click();
        await flushMicrotasks();

        expect(onError).toHaveBeenCalledWith(button, expect.any(Error));
        expect(button.disabled).toBe(false);
    });

    test("uses a cached answer instead of calling generateAnswerFn when one is available", async () => {
        document.body.innerHTML = `<label for="essay">Why us?</label><textarea id="essay"></textarea>`;
        const element = document.getElementById("essay");
        const generateAnswerFn = jest.fn();
        const getCachedAnswer = jest.fn().mockReturnValue("Cached answer text");

        const button = injectAiAssistButton({ element, fieldKind: "textarea" }, {
            getJobDescription: () => "",
            generateAnswerFn,
            getCachedAnswer,
        });

        button.click();
        await flushMicrotasks();

        expect(getCachedAnswer).toHaveBeenCalledWith("Why us?");
        expect(generateAnswerFn).not.toHaveBeenCalled();
        expect(element.value).toBe("Cached answer text");
    });

    test("calls onAnswerGenerated after a fresh (non-cached) generation succeeds", async () => {
        document.body.innerHTML = `<label for="essay">Why us?</label><textarea id="essay"></textarea>`;
        const element = document.getElementById("essay");
        const generateAnswerFn = jest.fn().mockResolvedValue("Fresh answer");
        const onAnswerGenerated = jest.fn();

        const button = injectAiAssistButton({ element, fieldKind: "textarea" }, {
            getJobDescription: () => "",
            generateAnswerFn,
            getCachedAnswer: () => null,
            onAnswerGenerated,
        });

        button.click();
        await flushMicrotasks();

        expect(onAnswerGenerated).toHaveBeenCalledWith("Why us?", "Fresh answer");
    });

    test("does not call onAnswerGenerated when the answer came from the cache", async () => {
        document.body.innerHTML = `<label for="essay">Why us?</label><textarea id="essay"></textarea>`;
        const element = document.getElementById("essay");
        const generateAnswerFn = jest.fn();
        const onAnswerGenerated = jest.fn();

        const button = injectAiAssistButton({ element, fieldKind: "textarea" }, {
            getJobDescription: () => "",
            generateAnswerFn,
            getCachedAnswer: () => "Cached answer",
            onAnswerGenerated,
        });

        button.click();
        await flushMicrotasks();

        expect(onAnswerGenerated).not.toHaveBeenCalled();
    });
});
