// Keyword dictionary used by the heuristic detector (see docs/SPEC.md §4.3).
// Each profilePath maps to autocomplete token(s) plus a list of keywords
// matched (case-insensitively, substring) against name/id/label/placeholder text.
// Japanese and English keywords are both included since target ATS forms
// may be in either language.

export const FIELD_KEYWORDS = [
    { profilePath: "personal.firstName", autocomplete: ["given-name"], keywords: ["first name", "given name", "fname", "名"] },
    { profilePath: "personal.lastName", autocomplete: ["family-name"], keywords: ["last name", "family name", "surname", "lname", "姓"] },
    { profilePath: "personal.email", autocomplete: ["email"], keywords: ["email", "e-mail", "メール"] },
    { profilePath: "personal.phone", autocomplete: ["tel"], keywords: ["phone", "mobile", "telephone", "電話"] },
    { profilePath: "personal.addressLine1", autocomplete: ["address-line1", "street-address"], keywords: ["address", "street", "住所"] },
    { profilePath: "personal.city", autocomplete: ["address-level2"], keywords: ["city", "town", "市区町村", "市"] },
    { profilePath: "personal.region", autocomplete: ["address-level1"], keywords: ["state", "province", "region", "都道府県"] },
    { profilePath: "personal.postalCode", autocomplete: ["postal-code"], keywords: ["zip", "postal", "post code", "郵便番号"] },
    { profilePath: "personal.country", autocomplete: ["country-name", "country"], keywords: ["country", "国"] },
    // Checked after city/region/country/postalCode above (array order
    // matters: first match wins) so a single-line "Current Location"
    // question is only matched when it's NOT one of the more specific
    // structured address fields.
    { profilePath: "personal.currentLocation", autocomplete: [], keywords: ["current location", "your location", "現在地", "居住地"] },
    { profilePath: "personal.linkedinUrl", autocomplete: [], keywords: ["linkedin"] },
    { profilePath: "personal.portfolioUrl", autocomplete: [], keywords: ["portfolio", "website", "personal site"] },
    { profilePath: "personal.githubUrl", autocomplete: [], keywords: ["github"] },
    { profilePath: "preferences.desiredCompensation", autocomplete: [], keywords: ["compensation", "salary expectation", "target salary", "希望年収", "希望給与"] },
    { profilePath: "workAuthorization.visaStatus", autocomplete: [], keywords: ["visa status", "visa type", "ビザ", "在留資格"] },
    // These are matched against label text only (no realistic autocomplete
    // or name/id convention exists for them), and the matched element is
    // virtually always a <select> with Yes/No-ish options — see
    // selectOptionByText's boolean handling in field-filler.js.
    {
        profilePath: "workAuthorization.requiresSponsorship",
        autocomplete: [],
        keywords: ["require sponsorship", "sponsorship to work", "スポンサーシップ", "就労ビザのスポンサー"],
    },
    {
        profilePath: "workAuthorization.isAuthorizedToWork",
        autocomplete: [],
        keywords: ["authorized to work", "legally authorized", "就労資格", "就労許可"],
    },
];

export function normalizeText(value) {
    return (value || "").toLowerCase().trim();
}
