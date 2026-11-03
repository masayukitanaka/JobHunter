import { getStorage } from "../../common/storage";
import { STORAGE_KEYS } from "../../common/settings";
import { getSiteMapping } from "../../common/custom-site-map";
import { getFieldKind } from "./dom-utils";

function loadCustomSiteMap() {
    return new Promise((resolve) => getStorage(STORAGE_KEYS.SITE_MAP, resolve));
}

// User-saved selector mappings (docs/SPEC.md §4.2 / §7.3) are trusted the
// same way ATS adapters are: a mapped selector that isn't found on the
// page is simply reported as "not filled", not retried via heuristics.
export async function detectViaCustomSiteMap(document, hostname) {
    const customSiteMap = await loadCustomSiteMap();
    const { fieldMappings } = getSiteMapping(customSiteMap, hostname);
    if (!fieldMappings.length) return [];

    return fieldMappings
        .map(({ selector, profilePath, aiAssist }) => {
            let element;
            try {
                element = document.querySelector(selector);
            } catch {
                return null; // selector became invalid (e.g. page markup changed)
            }
            if (!element) return null;

            const fieldKind = getFieldKind(element);
            if (!fieldKind) return null;

            return {
                element,
                profilePath: aiAssist ? null : profilePath,
                fieldKind,
                isFreeTextEssay: Boolean(aiAssist),
                confidence: "high",
            };
        })
        .filter(Boolean);
}
