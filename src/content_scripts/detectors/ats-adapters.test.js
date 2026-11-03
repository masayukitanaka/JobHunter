import { findAtsAdapter, detectViaAtsAdapter } from "./ats-adapters";

describe("ats-adapters → findAtsAdapter", () => {
    test.each([
        ["company.wd1.myworkdayjobs.com", "workday"],
        ["boards.greenhouse.io", "greenhouse"],
        ["jobs.lever.co", "lever"],
        ["careers-company.icims.com", "icims"],
    ])("matches %s -> %s", (hostname, expectedName) => {
        expect(findAtsAdapter(hostname)?.name).toBe(expectedName);
    });

    test("returns null for an unrecognized hostname", () => {
        expect(findAtsAdapter("example.com")).toBe(null);
    });
});

describe("ats-adapters → detectViaAtsAdapter", () => {
    test("returns an empty array for an unrecognized hostname", () => {
        document.body.innerHTML = `<input id="first_name" />`;
        expect(detectViaAtsAdapter(document, "example.com")).toEqual([]);
    });

    test("maps Greenhouse's known selectors with high confidence", () => {
        document.body.innerHTML = `
            <input id="first_name" />
            <input id="last_name" />
            <input id="email" />
        `;
        const matches = detectViaAtsAdapter(document, "boards.greenhouse.io");

        expect(matches.length).toBe(3);
        expect(matches.every((m) => m.confidence === "high")).toBe(true);
        expect(matches.map((m) => m.profilePath)).toEqual([
            "personal.firstName",
            "personal.lastName",
            "personal.email",
        ]);
    });

    test("skips selectors that are not present on the page without falling back", () => {
        document.body.innerHTML = `<input id="first_name" />`; // last_name, email, phone missing
        const matches = detectViaAtsAdapter(document, "boards.greenhouse.io");

        expect(matches.length).toBe(1);
        expect(matches[0].profilePath).toBe("personal.firstName");
    });

    test("maps Workday's nested data-automation-id selectors", () => {
        document.body.innerHTML = `
            <div data-automation-id="legalNameSection_firstName"><input /></div>
            <div data-automation-id="email"><input /></div>
        `;
        const matches = detectViaAtsAdapter(document, "acme.wd1.myworkdayjobs.com");

        expect(matches.length).toBe(2);
        expect(matches.map((m) => m.profilePath)).toEqual(["personal.firstName", "personal.email"]);
    });
});
