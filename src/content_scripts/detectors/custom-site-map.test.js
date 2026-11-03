const get = jest.fn();
global.chrome = { storage: { local: { get } } };

import { detectViaCustomSiteMap } from "./custom-site-map";
import { STORAGE_KEYS } from "../../common/settings";

function mockStoredSiteMap(siteMap) {
    get.mockImplementation((keys, callback) => {
        callback({ [STORAGE_KEYS.SITE_MAP]: siteMap });
    });
}

describe("custom-site-map detector → detectViaCustomSiteMap", () => {
    beforeEach(() => {
        get.mockReset();
    });

    test("returns an empty array when the hostname has no saved mapping", async () => {
        mockStoredSiteMap({});
        document.body.innerHTML = `<input id="first_name" />`;

        const result = await detectViaCustomSiteMap(document, "example.com");
        expect(result).toEqual([]);
    });

    test("maps saved selectors to profile paths with high confidence", async () => {
        mockStoredSiteMap({
            "example.com": {
                fieldMappings: [
                    { selector: "#fname", profilePath: "personal.firstName" },
                    { selector: "#email", profilePath: "personal.email" },
                ],
            },
        });
        document.body.innerHTML = `<input id="fname" /><input id="email" />`;

        const result = await detectViaCustomSiteMap(document, "example.com");

        expect(result.length).toBe(2);
        expect(result.every((m) => m.confidence === "high")).toBe(true);
        expect(result.map((m) => m.profilePath)).toEqual(["personal.firstName", "personal.email"]);
    });

    test("skips mappings whose selector is not found on the page", async () => {
        mockStoredSiteMap({
            "example.com": {
                fieldMappings: [
                    { selector: "#fname", profilePath: "personal.firstName" },
                    { selector: "#missing", profilePath: "personal.lastName" },
                ],
            },
        });
        document.body.innerHTML = `<input id="fname" />`;

        const result = await detectViaCustomSiteMap(document, "example.com");
        expect(result.length).toBe(1);
        expect(result[0].profilePath).toBe("personal.firstName");
    });

    test("marks aiAssist mappings as free-text essay fields with no profile path", async () => {
        mockStoredSiteMap({
            "example.com": {
                fieldMappings: [{ selector: "#essay", profilePath: null, aiAssist: true }],
            },
        });
        document.body.innerHTML = `<textarea id="essay"></textarea>`;

        const result = await detectViaCustomSiteMap(document, "example.com");
        expect(result.length).toBe(1);
        expect(result[0].isFreeTextEssay).toBe(true);
        expect(result[0].profilePath).toBe(null);
    });

    test("does not throw on an invalid saved selector", async () => {
        mockStoredSiteMap({
            "example.com": { fieldMappings: [{ selector: "###invalid[", profilePath: "personal.firstName" }] },
        });
        document.body.innerHTML = `<input id="fname" />`;

        const result = await detectViaCustomSiteMap(document, "example.com");
        expect(result).toEqual([]);
    });
});
