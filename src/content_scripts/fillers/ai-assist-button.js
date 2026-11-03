import { getAssociatedLabelText } from "../detectors/dom-utils";
import { setNativeInputValue, setContentEditableValue } from "./field-filler";

const BUTTON_CLASS = "jobhunter-ai-assist-btn";

// Falls back to the nearest preceding heading/paragraph text when there is
// no <label>, since many ATS essay fields use a question header instead.
export function extractQuestionText(element) {
    const labelText = getAssociatedLabelText(element).trim();
    if (labelText) return labelText;

    let node = element.previousElementSibling;
    while (node) {
        const text = node.textContent?.trim();
        if (text) return text;
        node = node.previousElementSibling;
    }
    return "";
}

function applyAnswer(fieldMatch, answer) {
    const { element, fieldKind } = fieldMatch;
    if (fieldKind === "contenteditable") {
        setContentEditableValue(element, answer);
    } else {
        setNativeInputValue(element, answer);
    }
}

const DEFAULT_LABEL = "✨ AIで作成";

function addUndoLink(button, fieldMatch, originalValue) {
    if (!originalValue) return;
    const undoLink = document.createElement("a");
    undoLink.href = "#";
    undoLink.textContent = "元に戻す";
    undoLink.style.marginLeft = "8px";
    undoLink.style.fontSize = "12px";
    undoLink.addEventListener("click", (event) => {
        event.preventDefault();
        applyAnswer(fieldMatch, originalValue);
        undoLink.remove();
    });
    button.insertAdjacentElement("afterend", undoLink);
}

// Injects a small "AIで作成" button after the given essay field.
//   - generateAnswerFn performs the actual API call (via background, see
//     docs/SPEC.md §6.4).
//   - getCachedAnswer/onAnswerGenerated (optional) hook into the
//     essayAnswers cache (docs/SPEC.md §3.2) so a question seen before
//     doesn't need a fresh API call — getCachedAnswer(question) returns a
//     cached answer string or null, onAnswerGenerated(question, answer) is
//     called after a successful fresh generation so the caller can save it.
// All are injected so this module stays testable without chrome.* APIs.
export function injectAiAssistButton(fieldMatch, { getJobDescription, generateAnswerFn, getCachedAnswer, onAnswerGenerated, onError }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = DEFAULT_LABEL;
    button.setAttribute(
        "style",
        "margin: 4px 0; padding: 4px 10px; font-size: 12px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: #fff;"
    );

    button.addEventListener("click", async () => {
        const originalValue = fieldMatch.fieldKind === "contenteditable" ? fieldMatch.element.innerText : fieldMatch.element.value;
        const question = extractQuestionText(fieldMatch.element);

        const cachedAnswer = getCachedAnswer?.(question);
        if (cachedAnswer) {
            applyAnswer(fieldMatch, cachedAnswer);
            addUndoLink(button, fieldMatch, originalValue);
            return;
        }

        button.disabled = true;
        button.textContent = "生成中…";

        try {
            const answer = await generateAnswerFn({ question, jobDescription: getJobDescription() });
            applyAnswer(fieldMatch, answer);
            button.textContent = DEFAULT_LABEL;
            onAnswerGenerated?.(question, answer);
            addUndoLink(button, fieldMatch, originalValue);
        } catch (err) {
            button.textContent = DEFAULT_LABEL;
            onError?.(button, err);
        } finally {
            button.disabled = false;
        }
    });

    fieldMatch.element.insertAdjacentElement("afterend", button);
    return button;
}
