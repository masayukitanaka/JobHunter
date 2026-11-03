import * as profileSchema from "./profile-schema";

describe("profile-schema → normalizeProfile", () => {
  test("fills in defaults when given undefined", () => {
    const normalized = profileSchema.normalizeProfile(undefined);
    expect(normalized).toEqual(profileSchema.DEFAULT_PROFILE);
  });

  test("merges partial saved data onto defaults without dropping fields", () => {
    const saved = { personal: { firstName: "Taro" }, skills: ["JavaScript"] };
    const normalized = profileSchema.normalizeProfile(saved);

    expect(normalized.personal.firstName).toBe("Taro");
    expect(normalized.personal.email).toBe("");
    expect(normalized.skills).toEqual(["JavaScript"]);
    expect(normalized.experiences).toEqual([]);
  });

  test("defaults array fields to empty arrays when saved value is not an array", () => {
    const normalized = profileSchema.normalizeProfile({ experiences: "not-an-array" });
    expect(normalized.experiences).toEqual([]);
  });

  test("merges preferences and the visaStatus field without dropping other defaults", () => {
    const saved = {
      preferences: { desiredCompensation: "$150,000" },
      workAuthorization: { visaStatus: "H-1B" },
    };
    const normalized = profileSchema.normalizeProfile(saved);

    expect(normalized.preferences.desiredCompensation).toBe("$150,000");
    expect(normalized.workAuthorization.visaStatus).toBe("H-1B");
    expect(normalized.workAuthorization.isAuthorizedToWork).toBe(null);
    expect(normalized.personal.currentLocation).toBe("");
  });
});

describe("profile-schema → validateProfile", () => {
  test("flags missing required personal fields", () => {
    const warnings = profileSchema.validateProfile(profileSchema.DEFAULT_PROFILE);
    const paths = warnings.map((w) => w.path);

    expect(paths).toContain("personal.firstName");
    expect(paths).toContain("personal.lastName");
    expect(paths).toContain("personal.email");
  });

  test("returns no warnings when required fields are filled", () => {
    const profile = profileSchema.normalizeProfile({
      personal: { firstName: "Taro", lastName: "Yamada", email: "taro@example.com" },
    });

    expect(profileSchema.validateProfile(profile)).toEqual([]);
  });
});

describe("profile-schema → createEmptyExperience / createEmptyEducation", () => {
  test("return fresh objects with blank fields", () => {
    const experience = profileSchema.createEmptyExperience();
    const education = profileSchema.createEmptyEducation();

    expect(experience).toEqual({
      company: "",
      title: "",
      startDate: "",
      endDate: "",
      isCurrent: false,
      description: "",
    });
    expect(education).toEqual({
      school: "",
      degree: "",
      fieldOfStudy: "",
      startDate: "",
      endDate: "",
    });
  });
});
