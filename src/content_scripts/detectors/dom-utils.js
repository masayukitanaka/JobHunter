// DOM helpers shared by the detectors. Kept dependency-free so they can be
// unit tested with jsdom in isolation from chrome.* APIs.

export function getAssociatedLabelText(element) {
    if (element.id) {
        const labelFor = element.ownerDocument.querySelector(`label[for="${cssEscape(element.id)}"]`);
        if (labelFor) return labelFor.textContent;
    }
    const wrappingLabel = element.closest("label");
    if (wrappingLabel) return wrappingLabel.textContent;

    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;

    return "";
}

// For a radio/checkbox, the field's own associated label is usually the
// choice text ("Yes"/"No"), not the question being asked. The question
// text instead typically lives in an enclosing <fieldset><legend> or a
// heading/paragraph that precedes the group — the same lookup heuristic
// used for free-text essay questions (see ai-assist-button.js).
export function getGroupQuestionText(element) {
    const fieldset = element.closest("fieldset");
    const legend = fieldset?.querySelector("legend");
    if (legend?.textContent.trim()) return legend.textContent;

    const container = fieldset || element.closest("[role='radiogroup'], [role='group']") || element.parentElement;
    let node = container?.previousElementSibling;
    while (node) {
        const text = node.textContent?.trim();
        if (text) return text;
        node = node.previousElementSibling;
    }
    return "";
}

function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export function getFieldKind(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "select";
    if (element.isContentEditable) return "contenteditable";
    if (tag === "input") {
        const type = (element.getAttribute("type") || "text").toLowerCase();
        if (type === "radio") return "radio";
        if (type === "checkbox") return "checkbox";
        if (type === "file") return "file";
        if (["text", "email", "tel", "url", "search", "number", ""].includes(type)) return "text";
        return null; // unsupported input type (hidden, password, submit, etc.)
    }
    return null;
}

// Visibility check is isolated from collectFormCandidates so it can be
// disabled/stubbed in jsdom-based tests, which have no real layout engine
// and always report offsetParent === null.
export function isVisible(element) {
    return element.offsetParent !== null || element.tagName.toLowerCase() === "select";
}

export function collectFormCandidates(document, { checkVisibility = isVisible } = {}) {
    return Array.from(document.querySelectorAll("input, textarea, select, [contenteditable='true']")).filter((el) => {
        if (el.disabled || el.readOnly) return false;
        if (!checkVisibility(el)) return false;
        return getFieldKind(el) !== null;
    });
}
