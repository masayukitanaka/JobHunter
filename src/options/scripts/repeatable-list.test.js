import { renderRepeatableList, readRepeatableList } from "./repeatable-list";

const FIELD_DEFS = [
    { key: "company", label: "会社名" },
    { key: "isCurrent", label: "現在も在籍中", type: "checkbox" },
    { key: "description", label: "業務内容", type: "textarea" },
];

describe("repeatable-list → renderRepeatableList / readRepeatableList", () => {
    test("renders one row per item with correct field values", () => {
        document.body.innerHTML = '<div id="list"></div>';
        const container = document.getElementById("list");

        renderRepeatableList(container, [
            { company: "Acme", isCurrent: true, description: "Built things" },
            { company: "Globex", isCurrent: false, description: "" },
        ], FIELD_DEFS, jest.fn());

        const rows = container.querySelectorAll(".repeatable-row");
        expect(rows.length).toBe(2);
        expect(rows[0].querySelector('[data-field="company"]').value).toBe("Acme");
        expect(rows[0].querySelector('[data-field="isCurrent"]').checked).toBe(true);
        expect(rows[1].querySelector('[data-field="company"]').value).toBe("Globex");
        expect(rows[1].querySelector('[data-field="isCurrent"]').checked).toBe(false);
    });

    test("readRepeatableList reads back edited values including checkboxes", () => {
        document.body.innerHTML = '<div id="list"></div>';
        const container = document.getElementById("list");
        renderRepeatableList(container, [{ company: "Acme", isCurrent: false, description: "" }], FIELD_DEFS, jest.fn());

        container.querySelector('[data-field="company"]').value = "Updated Co";
        container.querySelector('[data-field="isCurrent"]').checked = true;

        const result = readRepeatableList(container, FIELD_DEFS);
        expect(result).toEqual([{ company: "Updated Co", isCurrent: true, description: "" }]);
    });

    test("remove button invokes onRemove with the row index", () => {
        document.body.innerHTML = '<div id="list"></div>';
        const container = document.getElementById("list");
        const onRemove = jest.fn();
        renderRepeatableList(container, [
            { company: "Acme", isCurrent: false, description: "" },
            { company: "Globex", isCurrent: false, description: "" },
        ], FIELD_DEFS, onRemove);

        container.querySelectorAll(".repeatable-row")[1].querySelector("button").click();

        expect(onRemove).toHaveBeenCalledWith(1);
    });
});
