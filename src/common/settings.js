export const STORAGE_KEYS = {
    PROFILE: "jobhunter.profile",
    LLM_CONFIG: "jobhunter.llmConfig",
    SITE_MAP: "jobhunter.customSiteMap",
    RUN_LOG: "jobhunter.lastRunLog",
    PICKER_RESULT: "jobhunter.pickerResult",
};

export const DEFAULT_LLM_CONFIG = {
    enabled: false,
    provider: "anthropic",
    apiKey: "",
    model: "claude-sonnet-5",
    maxOutputTokens: 1024,
};
