// Lightweight cache of past AI-generated (or user-edited) essay answers,
// keyed by a hash of the question text, so a recurring question ("Why do
// you want to work here?") doesn't need a fresh API call every time it's
// seen on a new application. Exact-match only for now (docs/SPEC.md §3.2 —
// similarity matching is a future extension).

function normalizeQuestion(question) {
    return (question || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// A simple non-cryptographic string hash (32-bit FNV-1a). Collisions are
// acceptable here — the key only needs to disambiguate cache entries, not
// provide any security property.
export function hashQuestion(question) {
    const normalized = normalizeQuestion(question);
    let hash = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i++) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

export function lookupEssayAnswer(essayAnswers, question) {
    if (!question?.trim()) return null;
    const entry = essayAnswers?.[hashQuestion(question)];
    return entry?.question === question.trim() ? entry : null;
}

export function upsertEssayAnswer(essayAnswers, question, answer) {
    if (!question?.trim()) return essayAnswers || {};
    const key = hashQuestion(question);
    return {
        ...essayAnswers,
        [key]: { question: question.trim(), answer, updatedAt: Date.now() },
    };
}
