// Pure rendering helper for the "registered sites" list in the site
// mapping tab. Kept DOM-only (no chrome.* APIs) for testability.
import { PROFILE_PATH_LABELS } from "../../common/custom-site-map";

function describeMapping(mapping) {
    if (mapping.aiAssist) return "AI入力支援（自由記述）";
    return PROFILE_PATH_LABELS[mapping.profilePath] || mapping.profilePath;
}

export function renderSiteMapList(container, customSiteMap, { onRemove }) {
    container.innerHTML = "";
    const hostnames = Object.keys(customSiteMap || {}).filter((hostname) => customSiteMap[hostname]?.fieldMappings?.length);

    if (!hostnames.length) {
        container.textContent = "登録済みのサイトはまだありません。";
        return;
    }

    hostnames.forEach((hostname) => {
        const siteBlock = document.createElement("div");
        siteBlock.className = "site-map-entry";

        const heading = document.createElement("h4");
        heading.textContent = hostname;
        siteBlock.appendChild(heading);

        const list = document.createElement("ul");
        customSiteMap[hostname].fieldMappings.forEach((mapping, index) => {
            const item = document.createElement("li");
            item.textContent = `${mapping.selector} → ${describeMapping(mapping)}`;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "削除";
            removeButton.addEventListener("click", () => onRemove(hostname, index));
            item.appendChild(removeButton);

            list.appendChild(item);
        });
        siteBlock.appendChild(list);
        container.appendChild(siteBlock);
    });
}
