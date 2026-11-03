import { getStorage, setStorage } from "../../common/storage";
import { STORAGE_KEYS, DEFAULT_LLM_CONFIG } from "../../common/settings";
import { MESSAGE_TYPES } from "../../common/messaging";
import {
    DEFAULT_PROFILE,
    normalizeProfile,
    validateProfile,
    createEmptyExperience,
    createEmptyEducation,
} from "../../common/profile-schema";
import { removeFieldMapping } from "../../common/custom-site-map";
import { readPersonalForm, writePersonalForm, parseSkillsInput, formatSkillsInput } from "./form-binding";
import { renderRepeatableList, readRepeatableList } from "./repeatable-list";
import { renderSiteMapList } from "./site-map-list";

const EXPERIENCE_FIELD_DEFS = [
    { key: "company", label: "会社名" },
    { key: "title", label: "職種" },
    { key: "startDate", label: "開始日", type: "month" },
    { key: "endDate", label: "終了日", type: "month" },
    { key: "isCurrent", label: "現在も在籍中", type: "checkbox" },
    { key: "description", label: "業務内容", type: "textarea" },
];

const EDUCATION_FIELD_DEFS = [
    { key: "school", label: "学校名" },
    { key: "degree", label: "学位" },
    { key: "fieldOfStudy", label: "専攻" },
    { key: "startDate", label: "開始日", type: "month" },
    { key: "endDate", label: "終了日", type: "month" },
];

let currentProfile = DEFAULT_PROFILE;

function showStatus(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    setTimeout(() => { el.textContent = ""; }, 3000);
}

function renderValidationWarnings(profile) {
    const warnings = validateProfile(profile);
    const list = document.getElementById("personalWarnings");
    list.innerHTML = "";
    warnings.forEach((warning) => {
        const li = document.createElement("li");
        li.textContent = warning.message;
        list.appendChild(li);
    });
}

function renderAll(profile) {
    writePersonalForm(document.getElementById("personalForm"), profile);
    renderValidationWarnings(profile);

    renderRepeatableList(
        document.getElementById("experienceList"),
        profile.experiences,
        EXPERIENCE_FIELD_DEFS,
        (index) => {
            currentProfile.experiences.splice(index, 1);
            renderAll(currentProfile);
        }
    );
    renderRepeatableList(
        document.getElementById("educationList"),
        profile.education,
        EDUCATION_FIELD_DEFS,
        (index) => {
            currentProfile.education.splice(index, 1);
            renderAll(currentProfile);
        }
    );

    document.getElementById("skillsInput").value = formatSkillsInput(profile.skills);
    document.getElementById("coverLetterTemplate").value = profile.coverLetterTemplate || "";
    document.getElementById("resumeFileRef").value = profile.resumeFileRef || "";
}

function persistProfile(partialUpdate) {
    currentProfile = { ...currentProfile, ...partialUpdate };
    setStorage(STORAGE_KEYS.PROFILE, currentProfile);
    return currentProfile;
}

function setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-button");
    tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.tab;
            tabButtons.forEach((btn) => btn.setAttribute("aria-selected", String(btn === button)));
            document.querySelectorAll(".tab-panel").forEach((panel) => {
                panel.hidden = panel.dataset.tabPanel !== target;
            });
        });
    });
}

function setupPersonalForm() {
    document.getElementById("savePersonal").addEventListener("click", () => {
        const formElement = document.getElementById("personalForm");
        const { personal, workAuthorization, preferences } = readPersonalForm(formElement);
        const updated = persistProfile({ personal, workAuthorization, preferences });
        renderValidationWarnings(updated);
        showStatus("personalSaveStatus", "保存しました");
    });
}

function setupExperienceEducation() {
    document.getElementById("addExperience").addEventListener("click", () => {
        currentProfile.experiences.push(createEmptyExperience());
        renderAll(currentProfile);
    });
    document.getElementById("addEducation").addEventListener("click", () => {
        currentProfile.education.push(createEmptyEducation());
        renderAll(currentProfile);
    });
    document.getElementById("saveExperienceEducation").addEventListener("click", () => {
        const experiences = readRepeatableList(document.getElementById("experienceList"), EXPERIENCE_FIELD_DEFS);
        const education = readRepeatableList(document.getElementById("educationList"), EDUCATION_FIELD_DEFS);
        persistProfile({ experiences, education });
        showStatus("experienceSaveStatus", "保存しました");
    });
}

function setupSkills() {
    document.getElementById("saveSkills").addEventListener("click", () => {
        const skills = parseSkillsInput(document.getElementById("skillsInput").value);
        const coverLetterTemplate = document.getElementById("coverLetterTemplate").value;
        const resumeFileRef = document.getElementById("resumeFileRef").value || null;
        persistProfile({ skills, coverLetterTemplate, resumeFileRef });
        showStatus("skillsSaveStatus", "保存しました");
    });
}

function setupLlmConfig() {
    const enabledInput = document.getElementById("llm.enabled");
    const apiKeyInput = document.getElementById("llm.apiKey");
    const modelSelect = document.getElementById("llm.model");

    document.getElementById("toggleApiKeyVisibility").addEventListener("click", (event) => {
        apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
        event.target.textContent = apiKeyInput.type === "password" ? "表示" : "非表示";
    });

    document.getElementById("saveLlmConfig").addEventListener("click", () => {
        const llmConfig = {
            ...DEFAULT_LLM_CONFIG,
            enabled: enabledInput.checked,
            apiKey: apiKeyInput.value,
            model: modelSelect.value,
        };
        setStorage(STORAGE_KEYS.LLM_CONFIG, llmConfig);
        showStatus("llmSaveStatus", "保存しました");
    });

    document.getElementById("testLlmConnection").addEventListener("click", async () => {
        const button = document.getElementById("testLlmConnection");
        button.disabled = true;
        showStatus("llmSaveStatus", "接続確認中…");

        try {
            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.TEST_LLM_CONNECTION,
                payload: { apiKey: apiKeyInput.value, model: modelSelect.value, enabled: true },
            });
            showStatus("llmSaveStatus", response?.ok ? "接続に成功しました" : `接続に失敗しました: ${response?.error}`);
        } catch (err) {
            showStatus("llmSaveStatus", `接続に失敗しました: ${err.message}`);
        } finally {
            button.disabled = false;
        }
    });
}

function renderLlmConfig(llmConfig) {
    document.getElementById("llm.enabled").checked = Boolean(llmConfig.enabled);
    document.getElementById("llm.apiKey").value = llmConfig.apiKey || "";
    document.getElementById("llm.model").value = llmConfig.model || DEFAULT_LLM_CONFIG.model;
}

let currentSiteMap = {};

function renderSiteMapTab() {
    renderSiteMapList(document.getElementById("siteMapList"), currentSiteMap, {
        onRemove: (hostname, index) => {
            currentSiteMap = removeFieldMapping(currentSiteMap, hostname, index);
            setStorage(STORAGE_KEYS.SITE_MAP, currentSiteMap);
            renderSiteMapTab();
        },
    });
}

// Registration itself happens in the popup (docs/SPEC.md §7.3 — activeTab
// only grants temporary access to the tab the user invoked the extension
// UI from, so the picker must be launched from there, not from this
// options tab). Watch for storage changes so the list here stays in sync
// if options is left open while the user registers a field from popup.
function setupSiteMapping() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[STORAGE_KEYS.SITE_MAP]) return;
        currentSiteMap = changes[STORAGE_KEYS.SITE_MAP].newValue || {};
        renderSiteMapTab();
    });
}

function setupDataManagement() {
    document.getElementById("exportProfile").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(currentProfile, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "jobhunter-profile.json";
        link.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById("importProfileFile").addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const imported = JSON.parse(reader.result);
                currentProfile = normalizeProfile(imported);
                setStorage(STORAGE_KEYS.PROFILE, currentProfile);
                renderAll(currentProfile);
                showStatus("dataStatus", "インポートしました");
            } catch (err) {
                showStatus("dataStatus", "インポートに失敗しました: 不正なJSONファイルです");
            }
        };
        reader.readAsText(file);
    });
}

window.onload = function() {
    setupTabs();
    setupPersonalForm();
    setupExperienceEducation();
    setupSkills();
    setupDataManagement();
    setupLlmConfig();
    setupSiteMapping();

    getStorage(STORAGE_KEYS.PROFILE, (savedProfile) => {
        currentProfile = normalizeProfile(savedProfile);
        renderAll(currentProfile);
    });
    getStorage(STORAGE_KEYS.LLM_CONFIG, (savedLlmConfig) => {
        renderLlmConfig({ ...DEFAULT_LLM_CONFIG, ...savedLlmConfig });
    });
    getStorage(STORAGE_KEYS.SITE_MAP, (savedSiteMap) => {
        currentSiteMap = savedSiteMap || {};
        renderSiteMapTab();
    });
};
