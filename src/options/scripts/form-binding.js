// Pure helpers for reading/writing the "personal" + "workAuthorization" +
// "preferences" sections of the profile form. Kept framework-free and
// DOM-only so they can be unit tested with jsdom without needing a real
// extension context.

function getTriStateValue(selectElement) {
    if (selectElement.value === "") return null;
    return selectElement.value === "true";
}

function setTriStateValue(selectElement, value) {
    selectElement.value = value === null || value === undefined ? "" : String(value);
}

// Reads every plain text/email/tel/url input whose id starts with
// "<sectionName>." into a flat object keyed by the part after the dot.
// Tri-state (yes/no/unset) <select> fields are excluded here and handled
// separately since they need boolean conversion, not raw string values.
function readTextInputSection(formElement, sectionName, { excludeKeys = [] } = {}) {
    const section = {};
    formElement.querySelectorAll(`[id^="${sectionName}."]`).forEach((input) => {
        const key = input.id.slice(sectionName.length + 1);
        if (excludeKeys.includes(key)) return;
        section[key] = input.value;
    });
    return section;
}

function writeTextInputSection(formElement, sectionName, sectionValues, { excludeKeys = [] } = {}) {
    Object.entries(sectionValues || {}).forEach(([key, value]) => {
        if (excludeKeys.includes(key)) return;
        const input = formElement.querySelector(`#${sectionName}\\.${key}`);
        if (input) input.value = value ?? "";
    });
}

export function readPersonalForm(formElement) {
    const personal = readTextInputSection(formElement, "personal");

    const workAuthorization = {
        ...readTextInputSection(formElement, "workAuthorization", {
            excludeKeys: ["isAuthorizedToWork", "requiresSponsorship"],
        }),
        isAuthorizedToWork: getTriStateValue(formElement.querySelector('#workAuthorization\\.isAuthorizedToWork')),
        requiresSponsorship: getTriStateValue(formElement.querySelector('#workAuthorization\\.requiresSponsorship')),
    };

    const preferences = readTextInputSection(formElement, "preferences");

    return { personal, workAuthorization, preferences };
}

export function writePersonalForm(formElement, profile) {
    writeTextInputSection(formElement, "personal", profile.personal);
    writeTextInputSection(formElement, "workAuthorization", profile.workAuthorization, {
        excludeKeys: ["isAuthorizedToWork", "requiresSponsorship"],
    });
    writeTextInputSection(formElement, "preferences", profile.preferences);

    const authInput = formElement.querySelector('#workAuthorization\\.isAuthorizedToWork');
    const sponsorshipInput = formElement.querySelector('#workAuthorization\\.requiresSponsorship');
    if (authInput) setTriStateValue(authInput, profile.workAuthorization?.isAuthorizedToWork);
    if (sponsorshipInput) setTriStateValue(sponsorshipInput, profile.workAuthorization?.requiresSponsorship);
}

export function parseSkillsInput(rawValue) {
    return rawValue
        .split(",")
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 0);
}

export function formatSkillsInput(skills) {
    return (skills || []).join(", ");
}
