import { detectViaHeuristic } from "./heuristic";

function alwaysVisible() {
    return true;
}

describe("heuristic detector", () => {
    test("matches via autocomplete attribute with high confidence", () => {
        document.body.innerHTML = `<input autocomplete="email" name="whatever" />`;
        const [match] = detectViaHeuristic(document, { checkVisibility: alwaysVisible });

        expect(match.profilePath).toBe("personal.email");
        expect(match.confidence).toBe("high");
        expect(match.fieldKind).toBe("text");
    });

    test("matches via name attribute with medium confidence when no autocomplete", () => {
        document.body.innerHTML = `<input name="first_name" />`;
        const [match] = detectViaHeuristic(document, { checkVisibility: alwaysVisible });

        expect(match.profilePath).toBe("personal.firstName");
        expect(match.confidence).toBe("medium");
    });

    test("matches via associated label text", () => {
        document.body.innerHTML = `
            <label for="f1">Phone Number</label>
            <input id="f1" />
        `;
        const matches = detectViaHeuristic(document, { checkVisibility: alwaysVisible });
        const input = matches.find((m) => m.element.tagName === "INPUT");

        expect(input.profilePath).toBe("personal.phone");
        expect(input.confidence).toBe("medium");
    });

    test("matches via placeholder with low confidence as last resort", () => {
        document.body.innerHTML = `<input placeholder="LinkedIn profile URL" />`;
        const [match] = detectViaHeuristic(document, { checkVisibility: alwaysVisible });

        expect(match.profilePath).toBe("personal.linkedinUrl");
        expect(match.confidence).toBe("low");
    });

    test("flags unmatched textarea as a free-text essay field", () => {
        document.body.innerHTML = `<textarea name="why_us"></textarea>`;
        const [match] = detectViaHeuristic(document, { checkVisibility: alwaysVisible });

        expect(match.profilePath).toBe(null);
        expect(match.isFreeTextEssay).toBe(true);
        expect(match.fieldKind).toBe("textarea");
    });

    test("does not flag an unmatched plain text input as a free-text essay", () => {
        document.body.innerHTML = `<input name="random_field" />`;
        const [match] = detectViaHeuristic(document, { checkVisibility: alwaysVisible });

        expect(match.profilePath).toBe(null);
        expect(match.isFreeTextEssay).toBe(false);
    });

    test("skips disabled and readonly fields", () => {
        document.body.innerHTML = `
            <input name="email" disabled />
            <input name="email" readonly />
        `;
        const matches = detectViaHeuristic(document, { checkVisibility: alwaysVisible });

        expect(matches.length).toBe(0);
    });

    test("excludes elements already matched by an ATS/custom adapter (excludeElements)", () => {
        document.body.innerHTML = `<input name="first_name" /><input name="custom_question" />`;
        const alreadyMatched = document.querySelector('[name="first_name"]');

        const matches = detectViaHeuristic(document, {
            checkVisibility: alwaysVisible,
            excludeElements: new Set([alreadyMatched]),
        });

        expect(matches.length).toBe(1);
        expect(matches[0].element).not.toBe(alreadyMatched);
    });

    test("collapses a radio group into a single match on its first element", () => {
        document.body.innerHTML = `
            <fieldset>
                <legend>Are you authorized to work?</legend>
                <input type="radio" name="auth" value="yes" id="auth-yes" /><label for="auth-yes">Yes</label>
                <input type="radio" name="auth" value="no" id="auth-no" /><label for="auth-no">No</label>
            </fieldset>
        `;
        document.querySelectorAll("input").forEach((el) => Object.defineProperty(el, "offsetParent", { get: () => document.body }));

        const matches = detectViaHeuristic(document);

        expect(matches.length).toBe(1);
        expect(matches[0].fieldKind).toBe("radio");
        expect(matches[0].element.id).toBe("auth-yes");
        expect(matches[0].profilePath).toBe("workAuthorization.isAuthorizedToWork");
        expect(matches[0].confidence).toBe("medium");
    });

    test("does not match a radio group's question against an option's own Yes/No label", () => {
        document.body.innerHTML = `
            <fieldset>
                <legend>Unrelated custom question</legend>
                <input type="radio" name="custom" id="custom-yes" /><label for="custom-yes">Yes</label>
                <input type="radio" name="custom" id="custom-no" /><label for="custom-no">No</label>
            </fieldset>
        `;
        document.querySelectorAll("input").forEach((el) => Object.defineProperty(el, "offsetParent", { get: () => document.body }));

        const matches = detectViaHeuristic(document);

        expect(matches.length).toBe(1);
        expect(matches[0].profilePath).toBe(null);
    });

    test("matches a standalone checkbox via its own label", () => {
        document.body.innerHTML = `<label for="sponsor-cb">Will you require sponsorship?</label><input type="checkbox" id="sponsor-cb" />`;
        document.querySelectorAll("input").forEach((el) => Object.defineProperty(el, "offsetParent", { get: () => document.body }));

        const matches = detectViaHeuristic(document);

        expect(matches.length).toBe(1);
        expect(matches[0].fieldKind).toBe("checkbox");
        expect(matches[0].profilePath).toBe("workAuthorization.requiresSponsorship");
    });

    test("always maps a file input to resumeFileRef", () => {
        document.body.innerHTML = `<input type="file" name="cover_letter_attachment" />`; // name doesn't mention resume at all
        document.querySelectorAll("input").forEach((el) => Object.defineProperty(el, "offsetParent", { get: () => document.body }));

        const [match] = detectViaHeuristic(document);

        expect(match.fieldKind).toBe("file");
        expect(match.profilePath).toBe("resumeFileRef");
        expect(match.isFreeTextEssay).toBe(false);
    });
});
