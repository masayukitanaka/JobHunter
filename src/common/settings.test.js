import * as settingsModule from "./settings";

describe("settings → STORAGE_KEYS", () => {
  test("defines the expected set of storage keys", () => {
    expect(settingsModule.STORAGE_KEYS).toEqual({
      PROFILE: "jobhunter.profile",
      LLM_CONFIG: "jobhunter.llmConfig",
      SITE_MAP: "jobhunter.customSiteMap",
      RUN_LOG: "jobhunter.lastRunLog",
      PICKER_RESULT: "jobhunter.pickerResult",
    });
  });
});

describe("settings → DEFAULT_LLM_CONFIG", () => {
  test("is disabled by default and has no API key preset", () => {
    const config = settingsModule.DEFAULT_LLM_CONFIG;
    expect(config.enabled).toBe(false);
    expect(config.apiKey).toBe("");
    expect(config.provider).toBe("anthropic");
  });
});
