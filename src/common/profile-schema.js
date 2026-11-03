export const DEFAULT_PROFILE = {
    personal: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        addressLine1: "",
        city: "",
        region: "",
        postalCode: "",
        country: "",
        // Free-text "Current Location" field, distinct from the structured
        // address above — many ATS forms ask for this as a single line
        // (e.g. "Tokyo, Japan") rather than separate city/region/country
        // inputs. Added after manual testing showed it's a very common
        // standalone question.
        currentLocation: "",
        linkedinUrl: "",
        portfolioUrl: "",
        githubUrl: "",
    },
    workAuthorization: {
        isAuthorizedToWork: null,
        requiresSponsorship: null,
        // Free-text visa/status description (e.g. "H-1B", "永住権",
        // "日本国籍") for forms that ask beyond a simple yes/no.
        visaStatus: "",
    },
    // Compensation expectations — a very common standalone question
    // ("What is your target total compensation for your next role?") that
    // doesn't fit under personal or workAuthorization.
    preferences: {
        desiredCompensation: "",
    },
    experiences: [],
    education: [],
    skills: [],
    resumeFileRef: null,
    coverLetterTemplate: "",
    essayAnswers: {},
};

export const REQUIRED_PERSONAL_FIELDS = ["firstName", "lastName", "email"];

function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === "";
}

export function createEmptyExperience() {
    return {
        company: "",
        title: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        description: "",
    };
}

export function createEmptyEducation() {
    return {
        school: "",
        degree: "",
        fieldOfStudy: "",
        startDate: "",
        endDate: "",
    };
}

// Merges a possibly-partial saved profile onto the default shape so that
// fields added to the schema later still have a defined value for older
// saved profiles.
export function normalizeProfile(savedProfile) {
    const profile = savedProfile || {};
    return {
        personal: { ...DEFAULT_PROFILE.personal, ...profile.personal },
        workAuthorization: { ...DEFAULT_PROFILE.workAuthorization, ...profile.workAuthorization },
        preferences: { ...DEFAULT_PROFILE.preferences, ...profile.preferences },
        experiences: Array.isArray(profile.experiences) ? profile.experiences : [],
        education: Array.isArray(profile.education) ? profile.education : [],
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        resumeFileRef: profile.resumeFileRef ?? DEFAULT_PROFILE.resumeFileRef,
        coverLetterTemplate: profile.coverLetterTemplate ?? DEFAULT_PROFILE.coverLetterTemplate,
        essayAnswers: profile.essayAnswers ?? {},
    };
}

// Returns a list of missing-field warnings for display in the options UI.
// This never blocks saving — different job forms require different fields.
export function validateProfile(profile) {
    const warnings = [];
    REQUIRED_PERSONAL_FIELDS.forEach((field) => {
        if (isBlank(profile?.personal?.[field])) {
            warnings.push({ path: `personal.${field}`, message: `${field} is empty` });
        }
    });
    return warnings;
}
