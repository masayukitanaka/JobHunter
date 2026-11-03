import { readPersonalForm, writePersonalForm, parseSkillsInput, formatSkillsInput } from "./form-binding";

function buildPersonalForm() {
    document.body.innerHTML = `
        <form id="personalForm">
            <input id="personal.firstName" />
            <input id="personal.lastName" />
            <input id="personal.email" />
            <input id="personal.currentLocation" />
            <select id="workAuthorization.isAuthorizedToWork">
                <option value="">未設定</option>
                <option value="true">はい</option>
                <option value="false">いいえ</option>
            </select>
            <select id="workAuthorization.requiresSponsorship">
                <option value="">未設定</option>
                <option value="true">はい</option>
                <option value="false">いいえ</option>
            </select>
            <input id="workAuthorization.visaStatus" />
            <input id="preferences.desiredCompensation" />
        </form>
    `;
    return document.getElementById("personalForm");
}

describe("form-binding → readPersonalForm", () => {
    test("reads personal fields keyed by the part after the dot", () => {
        const form = buildPersonalForm();
        form.querySelector("#personal\\.firstName").value = "Taro";
        form.querySelector("#personal\\.email").value = "taro@example.com";

        const { personal } = readPersonalForm(form);
        expect(personal.firstName).toBe("Taro");
        expect(personal.email).toBe("taro@example.com");
    });

    test("reads tri-state select as null/true/false", () => {
        const form = buildPersonalForm();
        form.querySelector("#workAuthorization\\.isAuthorizedToWork").value = "true";
        form.querySelector("#workAuthorization\\.requiresSponsorship").value = "";

        const { workAuthorization } = readPersonalForm(form);
        expect(workAuthorization.isAuthorizedToWork).toBe(true);
        expect(workAuthorization.requiresSponsorship).toBe(null);
    });

    test("reads visaStatus as plain text, separate from the tri-state selects", () => {
        const form = buildPersonalForm();
        form.querySelector("#workAuthorization\\.visaStatus").value = "H-1B";

        const { workAuthorization } = readPersonalForm(form);
        expect(workAuthorization.visaStatus).toBe("H-1B");
        expect(workAuthorization.isAuthorizedToWork).toBe(null);
    });

    test("reads the preferences section", () => {
        const form = buildPersonalForm();
        form.querySelector("#preferences\\.desiredCompensation").value = "$150,000";

        const { preferences } = readPersonalForm(form);
        expect(preferences.desiredCompensation).toBe("$150,000");
    });
});

describe("form-binding → writePersonalForm", () => {
    test("writes profile values back into matching inputs", () => {
        const form = buildPersonalForm();
        writePersonalForm(form, {
            personal: { firstName: "Hanako", lastName: "", email: "hanako@example.com" },
            workAuthorization: { isAuthorizedToWork: false, requiresSponsorship: null, visaStatus: "永住権" },
            preferences: { desiredCompensation: "$150,000" },
        });

        expect(form.querySelector("#personal\\.firstName").value).toBe("Hanako");
        expect(form.querySelector("#personal\\.email").value).toBe("hanako@example.com");
        expect(form.querySelector("#workAuthorization\\.isAuthorizedToWork").value).toBe("false");
        expect(form.querySelector("#workAuthorization\\.requiresSponsorship").value).toBe("");
        expect(form.querySelector("#workAuthorization\\.visaStatus").value).toBe("永住権");
        expect(form.querySelector("#preferences\\.desiredCompensation").value).toBe("$150,000");
    });
});

describe("form-binding → skills helpers", () => {
    test("parseSkillsInput splits, trims, and drops empty entries", () => {
        expect(parseSkillsInput("JavaScript,  React ,,SQL")).toEqual(["JavaScript", "React", "SQL"]);
    });

    test("formatSkillsInput joins with comma-space and handles empty/undefined", () => {
        expect(formatSkillsInput(["JavaScript", "React"])).toBe("JavaScript, React");
        expect(formatSkillsInput(undefined)).toBe("");
    });
});
