import { fillField, setNativeInputValue, selectOptionByText, setCheckedByLabelText, setCheckboxValue } from "./field-filler";

describe("field-filler → setNativeInputValue", () => {
    test("sets value and fires input/change events", () => {
        document.body.innerHTML = `<input />`;
        const input = document.querySelector("input");
        const inputHandler = jest.fn();
        const changeHandler = jest.fn();
        input.addEventListener("input", inputHandler);
        input.addEventListener("change", changeHandler);

        setNativeInputValue(input, "hello@example.com");

        expect(input.value).toBe("hello@example.com");
        expect(inputHandler).toHaveBeenCalledTimes(1);
        expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    test("bypasses an overridden instance-level value setter (as React installs) so input events still fire", () => {
        document.body.innerHTML = `<input />`;
        const input = document.querySelector("input");
        const instanceSetter = jest.fn();

        // React installs an instance-level setter on the DOM node that
        // intercepts plain `input.value = x` writes. setNativeInputValue
        // must go through the prototype's setter directly, bypassing this.
        Object.defineProperty(input, "value", { set: instanceSetter, get: () => "" });
        let eventFired = false;
        input.addEventListener("input", () => { eventFired = true; });

        setNativeInputValue(input, "Taro");

        expect(instanceSetter).not.toHaveBeenCalled();
        expect(eventFired).toBe(true);
    });
});

describe("field-filler → selectOptionByText", () => {
    test("selects the option matching by visible text", () => {
        document.body.innerHTML = `
            <select>
                <option value="jp">Japan</option>
                <option value="us">United States</option>
            </select>
        `;
        const select = document.querySelector("select");
        const changeHandler = jest.fn();
        select.addEventListener("change", changeHandler);

        const result = selectOptionByText(select, "united states");

        expect(result).toBe(true);
        expect(select.value).toBe("us");
        expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    test("returns false when no option matches", () => {
        document.body.innerHTML = `<select><option value="jp">Japan</option></select>`;
        const select = document.querySelector("select");

        expect(selectOptionByText(select, "Germany")).toBe(false);
    });

    test.each([
        ["Yes", true],
        ["No", false],
        ["はい", true],
        ["いいえ", false],
    ])("matches a boolean value against a %s/%s style option (true/false -> %s)", (optionText, boolValue) => {
        document.body.innerHTML = `
            <select>
                <option value="">Select...</option>
                <option value="y">${optionText}</option>
            </select>
        `;
        const select = document.querySelector("select");

        expect(selectOptionByText(select, boolValue)).toBe(true);
        expect(select.value).toBe("y");
    });

    test("boolean true does not accidentally match a negative option", () => {
        document.body.innerHTML = `<select><option value="n">No</option></select>`;
        const select = document.querySelector("select");

        expect(selectOptionByText(select, true)).toBe(false);
    });
});

describe("field-filler → setCheckedByLabelText", () => {
    function buildRadioGroup() {
        document.body.innerHTML = `
            <input type="radio" name="auth" value="yes" id="auth-yes" /><label for="auth-yes">Yes</label>
            <input type="radio" name="auth" value="no" id="auth-no" /><label for="auth-no">No</label>
        `;
        return document.getElementById("auth-yes"); // the group's representative element
    }

    test("checks the option whose label matches a boolean true", () => {
        const representative = buildRadioGroup();
        const result = setCheckedByLabelText(representative, true);

        expect(result).toBe(true);
        expect(document.getElementById("auth-yes").checked).toBe(true);
        expect(document.getElementById("auth-no").checked).toBe(false);
    });

    test("checks the option whose label matches a boolean false", () => {
        const representative = buildRadioGroup();
        const result = setCheckedByLabelText(representative, false);

        expect(result).toBe(true);
        expect(document.getElementById("auth-no").checked).toBe(true);
        expect(document.getElementById("auth-yes").checked).toBe(false);
    });

    test("dispatches change events on the selected option", () => {
        const representative = buildRadioGroup();
        const changeHandler = jest.fn();
        document.getElementById("auth-no").addEventListener("change", changeHandler);

        setCheckedByLabelText(representative, false);

        expect(changeHandler).toHaveBeenCalledTimes(1);
    });

    test("returns false when no option in the group matches", () => {
        const representative = buildRadioGroup();
        expect(setCheckedByLabelText(representative, "Maybe")).toBe(false);
    });

    test("matches by option value as a fallback text source", () => {
        document.body.innerHTML = `
            <input type="radio" name="country" value="jp" id="c-jp" />
            <input type="radio" name="country" value="us" id="c-us" />
        `;
        const result = setCheckedByLabelText(document.getElementById("c-jp"), "us");

        expect(result).toBe(true);
        expect(document.getElementById("c-us").checked).toBe(true);
    });
});

describe("field-filler → setCheckboxValue", () => {
    test("checks an unchecked checkbox when value is true", () => {
        document.body.innerHTML = `<input type="checkbox" />`;
        const element = document.querySelector("input");

        expect(setCheckboxValue(element, true)).toBe(true);
        expect(element.checked).toBe(true);
    });

    test("unchecks a checked checkbox when value is false", () => {
        document.body.innerHTML = `<input type="checkbox" checked />`;
        const element = document.querySelector("input");

        expect(setCheckboxValue(element, false)).toBe(true);
        expect(element.checked).toBe(false);
    });

    test("is a no-op (but reports success) when already in the desired state", () => {
        document.body.innerHTML = `<input type="checkbox" checked />`;
        const element = document.querySelector("input");
        const changeHandler = jest.fn();
        element.addEventListener("change", changeHandler);

        expect(setCheckboxValue(element, true)).toBe(true);
        expect(changeHandler).not.toHaveBeenCalled();
    });

    test("returns false for non-boolean values", () => {
        document.body.innerHTML = `<input type="checkbox" />`;
        const element = document.querySelector("input");

        expect(setCheckboxValue(element, "yes")).toBe(false);
        expect(element.checked).toBe(false);
    });
});

describe("field-filler → fillField", () => {
    test("fills a text field", () => {
        document.body.innerHTML = `<input />`;
        const element = document.querySelector("input");

        const result = fillField({ element, fieldKind: "text" }, "Taro");

        expect(result).toBe(true);
        expect(element.value).toBe("Taro");
    });

    test("skips empty/undefined/null values without touching the element", () => {
        document.body.innerHTML = `<input value="existing" />`;
        const element = document.querySelector("input");

        expect(fillField({ element, fieldKind: "text" }, "")).toBe(false);
        expect(fillField({ element, fieldKind: "text" }, undefined)).toBe(false);
        expect(fillField({ element, fieldKind: "text" }, null)).toBe(false);
        expect(element.value).toBe("existing");
    });

    test("highlights file inputs instead of writing a value", () => {
        document.body.innerHTML = `<input type="file" />`;
        const element = document.querySelector("input");

        const result = fillField({ element, fieldKind: "file" }, "resume.pdf");

        expect(result).toBe(false);
        expect(element.title).toContain("resume.pdf");
    });

    test("does not skip a boolean false value (distinct from empty/null/undefined)", () => {
        document.body.innerHTML = `<select><option value="n">No</option></select>`;
        const element = document.querySelector("select");

        const result = fillField({ element, fieldKind: "select" }, false);

        expect(result).toBe(true);
        expect(element.value).toBe("n");
    });

    test("fills a radio group field", () => {
        document.body.innerHTML = `
            <input type="radio" name="auth" value="yes" id="auth-yes" /><label for="auth-yes">Yes</label>
            <input type="radio" name="auth" value="no" id="auth-no" /><label for="auth-no">No</label>
        `;
        const element = document.getElementById("auth-yes");

        const result = fillField({ element, fieldKind: "radio" }, true);

        expect(result).toBe(true);
        expect(document.getElementById("auth-yes").checked).toBe(true);
    });

    test("fills a standalone checkbox field", () => {
        document.body.innerHTML = `<input type="checkbox" />`;
        const element = document.querySelector("input");

        const result = fillField({ element, fieldKind: "checkbox" }, true);

        expect(result).toBe(true);
        expect(element.checked).toBe(true);
    });
});
