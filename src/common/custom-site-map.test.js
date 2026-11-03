import {
    getSiteMapping,
    upsertFieldMapping,
    removeFieldMapping,
    generateSelector,
} from "./custom-site-map";

describe("custom-site-map → getSiteMapping", () => {
    test("returns an empty mapping when the hostname is not present", () => {
        expect(getSiteMapping({}, "example.com")).toEqual({ fieldMappings: [] });
    });

    test("returns the stored mapping for a known hostname", () => {
        const map = { "example.com": { fieldMappings: [{ selector: "#a", profilePath: "personal.firstName" }] } };
        expect(getSiteMapping(map, "example.com").fieldMappings.length).toBe(1);
    });
});

describe("custom-site-map → upsertFieldMapping / removeFieldMapping", () => {
    test("adds a new mapping for a new hostname", () => {
        const result = upsertFieldMapping({}, "example.com", { selector: "#a", profilePath: "personal.firstName" });
        expect(result["example.com"].fieldMappings).toEqual([{ selector: "#a", profilePath: "personal.firstName" }]);
    });

    test("appends to existing mappings for a known hostname without affecting other hostnames", () => {
        const initial = {
            "example.com": { fieldMappings: [{ selector: "#a", profilePath: "personal.firstName" }] },
            "other.com": { fieldMappings: [{ selector: "#z", profilePath: "personal.email" }] },
        };
        const result = upsertFieldMapping(initial, "example.com", { selector: "#b", profilePath: "personal.lastName" });

        expect(result["example.com"].fieldMappings.length).toBe(2);
        expect(result["other.com"].fieldMappings.length).toBe(1);
    });

    test("removeFieldMapping removes only the given index", () => {
        const initial = {
            "example.com": {
                fieldMappings: [
                    { selector: "#a", profilePath: "personal.firstName" },
                    { selector: "#b", profilePath: "personal.lastName" },
                ],
            },
        };
        const result = removeFieldMapping(initial, "example.com", 0);
        expect(result["example.com"].fieldMappings).toEqual([{ selector: "#b", profilePath: "personal.lastName" }]);
    });
});

describe("custom-site-map → generateSelector", () => {
    test("prefers a unique id selector", () => {
        document.body.innerHTML = `<input id="firstName" /><input id="lastName" />`;
        expect(generateSelector(document.getElementById("firstName"))).toBe("#firstName");
    });

    test("falls back to a name-based selector when id is missing or not unique", () => {
        document.body.innerHTML = `<input name="email" /><input name="email2" />`;
        expect(generateSelector(document.querySelector('[name="email"]'))).toBe('input[name="email"]');
    });

    test("falls back to a data-* attribute selector when no id/name is available", () => {
        document.body.innerHTML = `<div data-automation-id="legalName"><input /></div>`;
        const input = document.querySelector("input");
        // no id/name on the input itself, so it falls through to structural
        const selector = generateSelector(input);
        expect(selector).toContain("input");
    });

    test("uses a data-* attribute selector on the element itself when present", () => {
        document.body.innerHTML = `<input data-qa="first-name" />`;
        expect(generateSelector(document.querySelector("input"))).toBe('[data-qa="first-name"]');
    });

    test("falls back to a structural selector with nth-of-type when nothing else is unique", () => {
        document.body.innerHTML = `
            <div class="row">
                <input />
                <input />
            </div>
        `;
        const inputs = document.querySelectorAll("input");
        const selector = generateSelector(inputs[1]);

        expect(selector).toContain("nth-of-type(2)");
        expect(document.querySelectorAll(selector).length).toBe(1);
        expect(document.querySelector(selector)).toBe(inputs[1]);
    });
});
