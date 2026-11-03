import { getFieldKind } from "./dom-utils";

// Known ATS DOM structures. Selectors are vendor UI details that change
// over time — see docs/SPEC.md §4.1 for the maintenance caveat.
//
// Deliberately does NOT fall back to the heuristic detector when a mapped
// selector isn't found on the page: once a hostname is recognized as a
// known ATS, only its own field map is trusted, to avoid mis-filling an
// unrelated field. Missing selectors are simply reported as "not filled".
export const ATS_ADAPTERS = [
    {
        name: "workday",
        matcher: (hostname) => hostname.includes("myworkdayjobs.com"),
        fieldMap: [
            { selector: '[data-automation-id="legalNameSection_firstName"] input', profilePath: "personal.firstName" },
            { selector: '[data-automation-id="legalNameSection_lastName"] input', profilePath: "personal.lastName" },
            { selector: '[data-automation-id="email"] input', profilePath: "personal.email" },
            { selector: '[data-automation-id="phone-number"] input', profilePath: "personal.phone" },
            { selector: '[data-automation-id="addressSection_addressLine1"] input', profilePath: "personal.addressLine1" },
            { selector: '[data-automation-id="addressSection_city"] input', profilePath: "personal.city" },
            { selector: '[data-automation-id="addressSection_postalCode"] input', profilePath: "personal.postalCode" },
        ],
    },
    {
        name: "greenhouse",
        matcher: (hostname) => hostname.includes("greenhouse.io"),
        fieldMap: [
            { selector: "#first_name", profilePath: "personal.firstName" },
            { selector: "#last_name", profilePath: "personal.lastName" },
            { selector: "#email", profilePath: "personal.email" },
            { selector: "#phone", profilePath: "personal.phone" },
        ],
    },
    {
        name: "lever",
        matcher: (hostname) => hostname.includes("lever.co"),
        fieldMap: [
            { selector: 'input[name="name"]', profilePath: "personal.firstName" },
            { selector: 'input[name="email"]', profilePath: "personal.email" },
            { selector: 'input[name="phone"]', profilePath: "personal.phone" },
            { selector: 'input[name="urls[LinkedIn]"]', profilePath: "personal.linkedinUrl" },
            { selector: 'input[name="urls[GitHub]"]', profilePath: "personal.githubUrl" },
            { selector: 'input[name="urls[Portfolio]"]', profilePath: "personal.portfolioUrl" },
        ],
    },
    {
        name: "icims",
        matcher: (hostname) => hostname.includes("icims.com"),
        fieldMap: [
            { selector: "#firstname", profilePath: "personal.firstName" },
            { selector: "#lastname", profilePath: "personal.lastName" },
            { selector: "#email", profilePath: "personal.email" },
            { selector: "#phone", profilePath: "personal.phone" },
        ],
    },
];

export function findAtsAdapter(hostname) {
    return ATS_ADAPTERS.find((adapter) => adapter.matcher(hostname)) || null;
}

export function detectViaAtsAdapter(document, hostname) {
    const adapter = findAtsAdapter(hostname);
    if (!adapter) return [];

    return adapter.fieldMap
        .map(({ selector, profilePath }) => {
            const element = document.querySelector(selector);
            if (!element) return null;

            const fieldKind = getFieldKind(element);
            if (!fieldKind) return null;

            return { element, profilePath, fieldKind, isFreeTextEssay: false, confidence: "high" };
        })
        .filter(Boolean);
}
