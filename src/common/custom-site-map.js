// Shape (see docs/SPEC.md §3.4):
//   customSiteMap: { [hostname]: { fieldMappings: [{ selector, profilePath, aiAssist? }] } }

// Shared between the popup's field-assignment form and the options page's
// registered-sites list (docs/SPEC.md §7.1/§7.3), so both offer/display
// the same set of assignable profile fields.
export const PROFILE_PATH_LABELS = {
    "personal.firstName": "名 (First name)",
    "personal.lastName": "姓 (Last name)",
    "personal.email": "メールアドレス",
    "personal.phone": "電話番号",
    "personal.addressLine1": "住所1行目",
    "personal.city": "市区町村",
    "personal.region": "都道府県・州",
    "personal.postalCode": "郵便番号",
    "personal.country": "国",
    "personal.linkedinUrl": "LinkedIn URL",
    "personal.portfolioUrl": "ポートフォリオ URL",
    "personal.githubUrl": "GitHub URL",
    "coverLetterTemplate": "カバーレター テンプレート",
};

export function getSiteMapping(customSiteMap, hostname) {
    return customSiteMap?.[hostname] || { fieldMappings: [] };
}

export function upsertFieldMapping(customSiteMap, hostname, mapping) {
    const existing = getSiteMapping(customSiteMap, hostname);
    const fieldMappings = [...existing.fieldMappings, mapping];
    return { ...customSiteMap, [hostname]: { fieldMappings } };
}

export function removeFieldMapping(customSiteMap, hostname, index) {
    const existing = getSiteMapping(customSiteMap, hostname);
    const fieldMappings = existing.fieldMappings.filter((_, i) => i !== index);
    return { ...customSiteMap, [hostname]: { fieldMappings } };
}

// CSS selector generation priority (docs/SPEC.md §7.3): id > name > data-*
// attributes > a short structural path. Each strategy is tried in order
// and the first one that uniquely identifies the element within its
// document wins — picking the most stable selector available rather than
// always falling back to a brittle structural path.
function isUniqueSelector(document, selector) {
    try {
        return document.querySelectorAll(selector).length === 1;
    } catch {
        return false;
    }
}

function cssEscape(value) {
    if (typeof window !== "undefined" && window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function buildStructuralSelector(element) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && parts.length < 5) {
        let part = node.tagName.toLowerCase();
        const parent = node.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter((el) => el.tagName === node.tagName);
            if (siblings.length > 1) {
                part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
            }
        }
        parts.unshift(part);
        node = parent;
    }
    return parts.join(" > ");
}

export function generateSelector(element) {
    const document = element.ownerDocument;

    if (element.id) {
        const idSelector = `#${cssEscape(element.id)}`;
        if (isUniqueSelector(document, idSelector)) return idSelector;
    }

    const name = element.getAttribute("name");
    if (name) {
        const nameSelector = `${element.tagName.toLowerCase()}[name="${name}"]`;
        if (isUniqueSelector(document, nameSelector)) return nameSelector;
    }

    for (const attr of Array.from(element.attributes)) {
        if (attr.name.startsWith("data-")) {
            const dataSelector = `[${attr.name}="${attr.value}"]`;
            if (isUniqueSelector(document, dataSelector)) return dataSelector;
        }
    }

    return buildStructuralSelector(element);
}
