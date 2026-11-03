import { generateSelector } from "../common/custom-site-map";
import { setSessionStorage } from "../common/storage";
import { STORAGE_KEYS } from "../common/settings";
import { getFieldKind } from "./detectors/dom-utils";

// Injected on-demand from the popup (docs/SPEC.md §7.3) to let the user
// click a form field on the real page instead of typing a CSS selector by
// hand.
//
// The result is written to chrome.storage.session rather than sent via
// chrome.runtime.sendMessage, because the popup that launched the picker
// is gone by the time the user clicks a page element — Chrome closes any
// popup automatically the moment the user clicks outside it. Storing the
// result lets the user re-open the popup afterwards and pick up where
// they left off.

const HIGHLIGHT_STYLE = "outline: 2px solid #4285f4 !important; cursor: crosshair !important;";

let hoveredElement = null;
let previousOutline = "";

function clearHighlight() {
    if (hoveredElement) {
        hoveredElement.style.outline = previousOutline;
        hoveredElement = null;
    }
}

function onMouseOver(event) {
    clearHighlight();
    hoveredElement = event.target;
    previousOutline = hoveredElement.style.outline;
    hoveredElement.style.cssText += HIGHLIGHT_STYLE;
}

function onClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const element = event.target;
    const fieldKind = getFieldKind(element);
    clearHighlight();
    stopPicking();

    const result = fieldKind
        ? { selector: generateSelector(element), fieldKind, hostname: window.location.hostname }
        : { error: "対応していない要素です（input/textarea/select以外）" };
    setSessionStorage(STORAGE_KEYS.PICKER_RESULT, result);
}

function onKeyDown(event) {
    if (event.key === "Escape") {
        clearHighlight();
        stopPicking();
        setSessionStorage(STORAGE_KEYS.PICKER_RESULT, { cancelled: true });
    }
}

function stopPicking() {
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
}

document.addEventListener("mouseover", onMouseOver, true);
document.addEventListener("click", onClick, true);
document.addEventListener("keydown", onKeyDown, true);
