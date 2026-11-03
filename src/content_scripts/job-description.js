// Extracts a best-effort Job Description string from the current page.
// See docs/SPEC.md §6.2. Tries known ATS selectors first, then falls back
// to a meta description, then the largest block of visible text — in that
// order of reliability.

const KNOWN_JD_SELECTORS = [
    '[data-automation-id="jobPostingDescription"]', // Workday
    "#content .section-wrapper", // Greenhouse (job description section)
    ".posting-headline + .section-wrapper", // Greenhouse alt layout
    "[data-qa='job-description']", // Lever
    ".iCIMS_JobContent", // iCIMS
];

// jsdom (used in unit tests) does not implement innerText (it requires a
// layout engine), so fall back to textContent there. In a real browser,
// innerText is preferred because it respects visibility/CSS better.
function getVisibleText(element) {
    return (element.innerText ?? element.textContent ?? "").trim();
}

function getLargestTextBlock(document) {
    const candidates = Array.from(document.querySelectorAll("article, main, section, div"));
    let best = null;
    let bestLength = 0;

    candidates.forEach((el) => {
        const text = getVisibleText(el);
        if (text.length > bestLength && text.length < 20000) {
            best = text;
            bestLength = text.length;
        }
    });
    return best;
}

export function extractJobDescription(document) {
    for (const selector of KNOWN_JD_SELECTORS) {
        const el = document.querySelector(selector);
        const text = el ? getVisibleText(el) : "";
        if (text) return text;
    }

    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute("content");
    if (metaDescription?.trim()) return metaDescription.trim();

    return getLargestTextBlock(document) || "";
}
