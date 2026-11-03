// Renders and reads back a dynamic list of plain-object rows (experiences,
// education) inside a container element. Each field is rendered as a
// labelled input/checkbox based on the fieldDefs passed in.

export function renderRepeatableList(container, items, fieldDefs, onRemove) {
    container.innerHTML = "";
    items.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "repeatable-row";
        row.dataset.index = String(index);

        fieldDefs.forEach((field) => {
            const label = document.createElement("label");
            label.textContent = field.label;

            let input;
            if (field.type === "checkbox") {
                input = document.createElement("input");
                input.type = "checkbox";
                input.checked = Boolean(item[field.key]);
            } else if (field.type === "textarea") {
                input = document.createElement("textarea");
                input.value = item[field.key] ?? "";
            } else {
                input = document.createElement("input");
                input.type = field.type || "text";
                input.value = item[field.key] ?? "";
            }
            input.dataset.field = field.key;
            label.appendChild(input);
            row.appendChild(label);
        });

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "削除";
        removeButton.addEventListener("click", () => onRemove(index));
        row.appendChild(removeButton);

        container.appendChild(row);
    });
}

export function readRepeatableList(container, fieldDefs) {
    const rows = Array.from(container.querySelectorAll(".repeatable-row"));
    return rows.map((row) => {
        const item = {};
        fieldDefs.forEach((field) => {
            const input = row.querySelector(`[data-field="${field.key}"]`);
            if (!input) return;
            item[field.key] = field.type === "checkbox" ? input.checked : input.value;
        });
        return item;
    });
}
