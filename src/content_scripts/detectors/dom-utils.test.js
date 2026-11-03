import { getAssociatedLabelText, getGroupQuestionText, getFieldKind, collectFormCandidates } from "./dom-utils";

describe("dom-utils → getAssociatedLabelText", () => {
    test("finds label via for= attribute", () => {
        document.body.innerHTML = `<label for="x">Email address</label><input id="x" />`;
        expect(getAssociatedLabelText(document.getElementById("x"))).toBe("Email address");
    });

    test("finds label wrapping the input", () => {
        document.body.innerHTML = `<label>Email <input id="y" /></label>`;
        expect(getAssociatedLabelText(document.getElementById("y"))).toContain("Email");
    });

    test("falls back to aria-label", () => {
        document.body.innerHTML = `<input id="z" aria-label="Phone number" />`;
        expect(getAssociatedLabelText(document.getElementById("z"))).toBe("Phone number");
    });

    test("returns empty string when nothing matches", () => {
        document.body.innerHTML = `<input id="w" />`;
        expect(getAssociatedLabelText(document.getElementById("w"))).toBe("");
    });
});

describe("dom-utils → getGroupQuestionText", () => {
    test("reads the question from a fieldset's legend", () => {
        document.body.innerHTML = `
            <fieldset>
                <legend>Are you authorized to work?</legend>
                <input type="radio" name="auth" id="auth-yes" /><label for="auth-yes">Yes</label>
                <input type="radio" name="auth" id="auth-no" /><label for="auth-no">No</label>
            </fieldset>
        `;
        const radio = document.getElementById("auth-yes");
        expect(getGroupQuestionText(radio)).toBe("Are you authorized to work?");
    });

    test("falls back to a preceding sibling of the group container when there is no legend", () => {
        document.body.innerHTML = `
            <p>Will you require sponsorship?</p>
            <div>
                <input type="radio" name="sponsor" id="sponsor-yes" />
                <input type="radio" name="sponsor" id="sponsor-no" />
            </div>
        `;
        const radio = document.getElementById("sponsor-yes");
        expect(getGroupQuestionText(radio)).toBe("Will you require sponsorship?");
    });

    test("returns empty string when nothing is found", () => {
        document.body.innerHTML = `<input type="radio" name="x" id="x1" />`;
        expect(getGroupQuestionText(document.getElementById("x1"))).toBe("");
    });
});

describe("dom-utils → getFieldKind", () => {
    test.each([
        ["<textarea></textarea>", "textarea"],
        ["<select></select>", "select"],
        ["<input type='text' />", "text"],
        ["<input />", "text"],
        ["<input type='email' />", "text"],
        ["<input type='radio' />", "radio"],
        ["<input type='checkbox' />", "checkbox"],
        ["<input type='file' />", "file"],
        ["<input type='hidden' />", null],
        ["<input type='password' />", null],
    ])("%s -> %s", (html, expected) => {
        document.body.innerHTML = html;
        const el = document.body.firstElementChild;
        expect(getFieldKind(el)).toBe(expected);
    });

    test("contenteditable element is detected as contenteditable", () => {
        document.body.innerHTML = `<div contenteditable="true"></div>`;
        const el = document.body.firstElementChild;
        Object.defineProperty(el, "isContentEditable", { value: true });
        expect(getFieldKind(el)).toBe("contenteditable");
    });
});

describe("dom-utils → collectFormCandidates", () => {
    test("filters out disabled, readonly, and unsupported-type fields", () => {
        document.body.innerHTML = `
            <input name="a" />
            <input name="b" disabled />
            <input name="c" readonly />
            <input name="d" type="hidden" />
            <textarea name="e"></textarea>
        `;
        const candidates = collectFormCandidates(document, { checkVisibility: () => true });
        const names = candidates.map((el) => el.getAttribute("name"));

        expect(names).toEqual(["a", "e"]);
    });

    test("respects an injected visibility check", () => {
        document.body.innerHTML = `<input name="a" /><input name="b" />`;
        const candidates = collectFormCandidates(document, { checkVisibility: (el) => el.getAttribute("name") === "a" });

        expect(candidates.length).toBe(1);
        expect(candidates[0].getAttribute("name")).toBe("a");
    });
});
