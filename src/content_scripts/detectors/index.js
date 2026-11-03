import { findAtsAdapter, detectViaAtsAdapter } from "./ats-adapters";
import { detectViaCustomSiteMap } from "./custom-site-map";
import { detectViaHeuristic } from "./heuristic";

// ATS/custom-mapped fields are combined with a heuristic pass over the
// rest of the form, rather than being mutually exclusive. Real ATS pages
// mix standardized fields (name/email — what the ATS adapters cover) with
// employer-specific screening questions (work authorization, compensation
// expectations, on-call availability, etc.) that no fixed selector map can
// anticipate; treating "ATS recognized" as "use only the fixed map" left
// most of a real application form empty (see field reports after manual
// testing). Already-matched elements are excluded from the heuristic pass
// so the same field never gets filled twice.
export async function detectFields(document, hostname) {
    const atsFields = detectViaAtsAdapter(document, hostname);
    const customFields = await detectViaCustomSiteMap(document, hostname);
    const knownFields = [...atsFields, ...customFields];

    const alreadyMatchedElements = new Set(knownFields.map((f) => f.element));
    const heuristicFields = detectViaHeuristic(document, { excludeElements: alreadyMatchedElements });

    // strategy reflects what kind of site this is recognized as (for the
    // popup summary label), independent of how many fields each pass
    // actually matched — a known ATS with zero matched selectors is still
    // worth reporting as "ats" so the user knows the site was recognized.
    let strategy = "heuristic";
    if (findAtsAdapter(hostname)) strategy = "ats";
    else if (customFields.length) strategy = "custom";

    return { strategy, fields: [...knownFields, ...heuristicFields] };
}
