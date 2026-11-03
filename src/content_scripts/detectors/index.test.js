const get = jest.fn((keys, callback) => callback({}));
global.chrome = { storage: { local: { get } } };

import { detectFields } from "./index";
import { STORAGE_KEYS } from "../../common/settings";

function stubVisible(element) {
    Object.defineProperty(element, "offsetParent", { get: () => document.body, configurable: true });
}

describe("detectors → detectFields (ATS/custom + heuristic combined)", () => {
    beforeEach(() => {
        get.mockImplementation((keys, callback) => callback({}));
    });

    test("uses the ats strategy and still fills custom screening questions via heuristic", async () => {
        document.body.innerHTML = `
            <input id="first_name" />
            <input autocomplete="email" />
        `;
        document.querySelectorAll("input").forEach(stubVisible);

        const result = await detectFields(document, "boards.greenhouse.io");

        expect(result.strategy).toBe("ats");
        expect(result.fields.length).toBe(2); // #first_name via ATS adapter + email via heuristic
        const paths = result.fields.map((f) => f.profilePath);
        expect(paths).toContain("personal.firstName");
        expect(paths).toContain("personal.email");
    });

    test("does not double-fill an element that the ATS adapter already matched", async () => {
        document.body.innerHTML = `<input id="first_name" autocomplete="email" />`; // also matches heuristic's email rule
        stubVisible(document.querySelector("input"));

        const result = await detectFields(document, "boards.greenhouse.io");

        expect(result.fields.length).toBe(1);
        expect(result.fields[0].profilePath).toBe("personal.firstName"); // ATS mapping wins, not re-matched as email
    });

    test("reports the ats strategy even when zero ATS selectors are found, as long as heuristics fill something", async () => {
        document.body.innerHTML = `<input autocomplete="email" />`; // no Greenhouse selectors present
        stubVisible(document.querySelector("input"));

        const result = await detectFields(document, "boards.greenhouse.io");

        expect(result.strategy).toBe("ats");
        expect(result.fields.length).toBe(1);
        expect(result.fields[0].profilePath).toBe("personal.email");
    });

    test("uses the heuristic strategy for an unrecognized hostname", async () => {
        document.body.innerHTML = `<input autocomplete="email" />`;
        stubVisible(document.querySelector("input"));

        const result = await detectFields(document, "example.com");

        expect(result.strategy).toBe("heuristic");
        expect(result.fields.length).toBe(1);
        expect(result.fields[0].profilePath).toBe("personal.email");
    });

    test("uses the custom strategy when a saved site mapping matches, and still adds heuristic matches", async () => {
        get.mockImplementation((keys, callback) => {
            callback({
                [STORAGE_KEYS.SITE_MAP]: {
                    "example.com": { fieldMappings: [{ selector: "#fname", profilePath: "personal.firstName" }] },
                },
            });
        });
        document.body.innerHTML = `<input id="fname" /><input autocomplete="email" />`;
        document.querySelectorAll("input").forEach(stubVisible);

        const result = await detectFields(document, "example.com");

        expect(result.strategy).toBe("custom");
        expect(result.fields.length).toBe(2);
        const paths = result.fields.map((f) => f.profilePath);
        expect(paths).toContain("personal.firstName");
        expect(paths).toContain("personal.email");
    });

    test("falls back to heuristic when the hostname has no custom mapping", async () => {
        document.body.innerHTML = `<input autocomplete="email" />`;
        stubVisible(document.querySelector("input"));

        const result = await detectFields(document, "unmapped.example.com");
        expect(result.strategy).toBe("heuristic");
    });
});
