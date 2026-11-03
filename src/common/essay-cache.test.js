import { hashQuestion, lookupEssayAnswer, upsertEssayAnswer } from "./essay-cache";

describe("essay-cache → hashQuestion", () => {
    test("is stable for the same question text", () => {
        expect(hashQuestion("Why do you want to work here?")).toBe(hashQuestion("Why do you want to work here?"));
    });

    test("normalizes case and surrounding whitespace before hashing", () => {
        expect(hashQuestion("  Why Do You Want To Work Here?  ")).toBe(hashQuestion("why do you want to work here?"));
    });

    test("differs for different questions", () => {
        expect(hashQuestion("Why do you want to work here?")).not.toBe(hashQuestion("What is your greatest weakness?"));
    });
});

describe("essay-cache → upsertEssayAnswer / lookupEssayAnswer", () => {
    test("round-trips a stored answer", () => {
        const updated = upsertEssayAnswer({}, "Why do you want to work here?", "Because I love building things.");
        const found = lookupEssayAnswer(updated, "Why do you want to work here?");

        expect(found.answer).toBe("Because I love building things.");
        expect(found.question).toBe("Why do you want to work here?");
        expect(typeof found.updatedAt).toBe("number");
    });

    test("lookupEssayAnswer returns null for a question with no cached answer", () => {
        expect(lookupEssayAnswer({}, "Unseen question?")).toBe(null);
    });

    test("lookupEssayAnswer returns null for an empty/missing question", () => {
        expect(lookupEssayAnswer({ x: { question: "x" } }, "")).toBe(null);
        expect(lookupEssayAnswer({ x: { question: "x" } }, undefined)).toBe(null);
    });

    test("upsertEssayAnswer overwrites the previous answer for the same question", () => {
        let cache = upsertEssayAnswer({}, "Why us?", "First answer");
        cache = upsertEssayAnswer(cache, "Why us?", "Second answer");

        expect(lookupEssayAnswer(cache, "Why us?").answer).toBe("Second answer");
        expect(Object.keys(cache).length).toBe(1);
    });

    test("upsertEssayAnswer keeps other cached questions intact", () => {
        let cache = upsertEssayAnswer({}, "Why us?", "Answer A");
        cache = upsertEssayAnswer(cache, "Greatest weakness?", "Answer B");

        expect(lookupEssayAnswer(cache, "Why us?").answer).toBe("Answer A");
        expect(lookupEssayAnswer(cache, "Greatest weakness?").answer).toBe("Answer B");
    });

    test("upsertEssayAnswer is a no-op for an empty question", () => {
        const cache = { existing: { question: "x", answer: "y" } };
        expect(upsertEssayAnswer(cache, "", "z")).toBe(cache);
    });
});
