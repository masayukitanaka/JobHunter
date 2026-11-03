// Sets a value on a controlled (React/Vue-style) input by going through the
// native property setter before dispatching input/change events — plain
// `element.value = x` does not notify frameworks that manage their own
// internal state. See docs/SPEC.md §5.1.
export function setNativeInputValue(element, value) {
    const proto = element.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value").set;
    nativeSetter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
}

// Yes/No-style screening questions ("Are you authorized to work...",
// "Will you require sponsorship...") are almost always rendered as a
// <select> whose options are plain English/Japanese affirmative/negative
// words rather than "true"/"false". Profile fields like
// workAuthorization.isAuthorizedToWork store an actual boolean, so this
// list bridges the two when the target value is a boolean.
const AFFIRMATIVE_OPTION_TEXTS = ["yes", "true", "はい", "有", "あり"];
const NEGATIVE_OPTION_TEXTS = ["no", "false", "いいえ", "無", "なし"];

function findOptionByTexts(selectElement, candidateTexts) {
    return Array.from(selectElement.options).find((opt) => {
        const text = opt.textContent.trim().toLowerCase();
        const value = opt.value.trim().toLowerCase();
        return candidateTexts.some((candidate) => text === candidate || value === candidate);
    });
}

export function selectOptionByText(selectElement, value) {
    let option;
    if (typeof value === "boolean") {
        option = findOptionByTexts(selectElement, value ? AFFIRMATIVE_OPTION_TEXTS : NEGATIVE_OPTION_TEXTS);
    } else {
        const normalizedTarget = String(value).trim().toLowerCase();
        option = findOptionByTexts(selectElement, [normalizedTarget]);
    }
    if (!option) return false;

    selectElement.value = option.value;
    selectElement.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

export function setContentEditableValue(element, value) {
    element.innerText = value;
    element.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

// Gets the label text associated with a single radio/checkbox option,
// trying (in order): a <label for="id">, a wrapping <label>, then the
// option's own following text node (a common pattern: <input><span>Yes</span>).
function getOptionLabelText(element) {
    if (element.id) {
        const labelFor = element.ownerDocument.querySelector(`label[for="${element.id}"]`);
        if (labelFor?.textContent.trim()) return labelFor.textContent;
    }
    const wrappingLabel = element.closest("label");
    if (wrappingLabel?.textContent.trim()) return wrappingLabel.textContent;

    const next = element.nextSibling;
    if (next?.nodeType === 3 && next.textContent.trim()) return next.textContent; // text node
    if (next?.nodeType === 1 && next.textContent.trim()) return next.textContent; // element node (e.g. <span>)

    return element.value || "";
}

// A radio group is a logical single-choice field spread across multiple
// <input type="radio" name="..."> elements that share a name. This finds
// the sibling in the same group whose own label/value matches the target
// text (or Yes/No synonyms when the target is a boolean — same affirmative/
// negative word list used for <select>, see selectOptionByText above).
function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

export function setCheckedByLabelText(groupElement, value) {
    const name = groupElement.getAttribute("name");
    const group = name
        ? Array.from(groupElement.ownerDocument.querySelectorAll(`input[type="radio"][name="${cssEscape(name)}"]`))
        : [groupElement];

    const candidateTexts = typeof value === "boolean"
        ? (value ? AFFIRMATIVE_OPTION_TEXTS : NEGATIVE_OPTION_TEXTS)
        : [String(value).trim().toLowerCase()];

    const match = group.find((el) => {
        const text = getOptionLabelText(el).trim().toLowerCase();
        const optionValue = (el.value || "").trim().toLowerCase();
        return candidateTexts.some((candidate) => text === candidate || optionValue === candidate);
    });
    if (!match) return false;

    match.checked = true;
    match.dispatchEvent(new Event("click", { bubbles: true }));
    match.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

// A standalone checkbox (no radio group) represents a single yes/no fact
// ("I agree to...", "I am open to relocation"). Only boolean values are
// meaningful here; anything else is left untouched.
export function setCheckboxValue(element, value) {
    if (typeof value !== "boolean") return false;
    if (element.checked === value) return true; // already in the desired state

    element.checked = value;
    element.dispatchEvent(new Event("click", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

export function highlightForManualAction(element, message) {
    element.style.outline = "2px solid #e0a800";
    element.title = message;
}

// Applies a profile value to a detected field based on its fieldKind.
// Returns true if a value was actually written, false if skipped (e.g. no
// matching option, or a file input that requires manual user action).
export function fillField(fieldMatch, value) {
    if (value === undefined || value === null || value === "") return false;

    const { element, fieldKind } = fieldMatch;
    switch (fieldKind) {
        case "text":
        case "textarea":
            setNativeInputValue(element, value);
            return true;
        case "select":
            return selectOptionByText(element, value);
        case "contenteditable":
            setContentEditableValue(element, value);
            return true;
        case "file":
            highlightForManualAction(element, `このファイルを手動で選択してください: ${value}`);
            return false;
        case "radio":
            return setCheckedByLabelText(element, value);
        case "checkbox":
            return setCheckboxValue(element, value);
        default:
            return false;
    }
}
