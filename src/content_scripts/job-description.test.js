import { extractJobDescription } from "./job-description";

describe("job-description → extractJobDescription", () => {
    test("prefers a known ATS selector when present", () => {
        document.body.innerHTML = `
            <div data-automation-id="jobPostingDescription">We are hiring a software engineer.</div>
            <meta name="description" content="Fallback description" />
        `;
        expect(extractJobDescription(document)).toBe("We are hiring a software engineer.");
    });

    test("falls back to the meta description when no known selector matches", () => {
        document.head.innerHTML = `<meta name="description" content="Fallback description" />`;
        document.body.innerHTML = `<div>short</div>`;
        expect(extractJobDescription(document)).toBe("Fallback description");
    });

    test("falls back to the largest text block when nothing else matches", () => {
        document.head.innerHTML = "";
        document.body.innerHTML = `
            <div>short</div>
            <article>${"A".repeat(500)}</article>
        `;
        expect(extractJobDescription(document)).toBe("A".repeat(500));
    });

    test("returns empty string when nothing can be extracted", () => {
        document.head.innerHTML = "";
        document.body.innerHTML = "";
        expect(extractJobDescription(document)).toBe("");
    });
});
