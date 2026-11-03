import { FIELD_KEYWORDS, normalizeText } from "./field-keywords";
import { getAssociatedLabelText, getGroupQuestionText, getFieldKind, collectFormCandidates } from "./dom-utils";

function matchAgainstKeywords(candidateText) {
    const normalized = normalizeText(candidateText);
    if (!normalized) return null;
    return FIELD_KEYWORDS.find((entry) => entry.keywords.some((kw) => normalized.includes(normalizeText(kw)))) || null;
}

// Matches a single text/textarea/select element against the keyword
// dictionary, trying signals in order of reliability (see docs/SPEC.md
// §4.3):
//   1. autocomplete attribute (high confidence — a web standard)
//   2. name/id attribute text (medium)
//   3. associated <label> text (medium)
//   4. placeholder text (low)
function matchProfilePath(element) {
    const autocomplete = normalizeText(element.getAttribute("autocomplete"));
    if (autocomplete) {
        const byAutocomplete = FIELD_KEYWORDS.find((entry) => entry.autocomplete.includes(autocomplete));
        if (byAutocomplete) return { profilePath: byAutocomplete.profilePath, confidence: "high" };
    }

    const nameOrId = normalizeText(element.getAttribute("name") || element.id).replace(/[\s_-]+/g, "");
    const byNameOrId = FIELD_KEYWORDS.find((entry) => entry.keywords.some((kw) => nameOrId.includes(normalizeText(kw).replace(/[\s_-]+/g, ""))));
    if (byNameOrId) return { profilePath: byNameOrId.profilePath, confidence: "medium" };

    const byLabel = matchAgainstKeywords(getAssociatedLabelText(element));
    if (byLabel) return { profilePath: byLabel.profilePath, confidence: "medium" };

    const byPlaceholder = matchAgainstKeywords(element.getAttribute("placeholder"));
    if (byPlaceholder) return { profilePath: byPlaceholder.profilePath, confidence: "low" };

    return { profilePath: null, confidence: "low" };
}

// Radio buttons are grouped by name (docs/SPEC.md §5.1): a question like
// "Are you authorized to work..." is one logical field spread across
// several <input type="radio"> elements, not one field per option. Each
// group is represented by its first element only, matched against the
// question text (fieldset/legend or preceding heading — see
// getGroupQuestionText) rather than any single option's own "Yes"/"No" label.
function groupRadios(elements) {
    const seenGroupKeys = new Set();
    const groupRepresentatives = [];

    elements.forEach((element) => {
        const name = element.getAttribute("name");
        const groupKey = name ? `radio:${name}` : `radio:${elements.indexOf(element)}`; // ungrouped radio: treat alone
        if (seenGroupKeys.has(groupKey)) return;
        seenGroupKeys.add(groupKey);
        groupRepresentatives.push(element);
    });

    return groupRepresentatives;
}

function matchRadioGroup(element) {
    const byQuestionText = matchAgainstKeywords(getGroupQuestionText(element));
    if (byQuestionText) return { profilePath: byQuestionText.profilePath, confidence: "medium" };
    return { profilePath: null, confidence: "low" };
}

function matchCheckbox(element) {
    const byLabel = matchAgainstKeywords(getAssociatedLabelText(element));
    if (byLabel) return { profilePath: byLabel.profilePath, confidence: "medium" };
    return { profilePath: null, confidence: "low" };
}

// Any file input found on a job application form is assumed to be the
// resume/CV upload (the overwhelmingly common case). The profile only
// stores a filename reference, never the file contents (docs/SPEC.md
// §7.5) — field-filler.js highlights the input and asks the user to pick
// the file themselves rather than writing a value.
function matchFileInput() {
    return { profilePath: "resumeFileRef", confidence: "medium" };
}

export function detectViaHeuristic(document, { checkVisibility, excludeElements } = {}) {
    let candidates = collectFormCandidates(document, checkVisibility ? { checkVisibility } : undefined);
    if (excludeElements?.size) {
        candidates = candidates.filter((element) => !excludeElements.has(element));
    }

    const radios = candidates.filter((el) => getFieldKind(el) === "radio");
    const radioRepresentatives = new Set(groupRadios(radios));
    candidates = candidates.filter((el) => getFieldKind(el) !== "radio" || radioRepresentatives.has(el));

    return candidates.map((element) => {
        const fieldKind = getFieldKind(element);
        let matchResult;
        if (fieldKind === "radio") matchResult = matchRadioGroup(element);
        else if (fieldKind === "checkbox") matchResult = matchCheckbox(element);
        else if (fieldKind === "file") matchResult = matchFileInput();
        else matchResult = matchProfilePath(element);

        const { profilePath, confidence } = matchResult;
        const isFreeTextEssay = profilePath === null && (fieldKind === "textarea" || fieldKind === "contenteditable");

        return { element, profilePath, fieldKind, isFreeTextEssay, confidence };
    });
}
