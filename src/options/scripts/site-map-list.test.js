import { renderSiteMapList } from "./site-map-list";

describe("site-map-list → renderSiteMapList", () => {
    test("shows a placeholder message when there are no registered sites", () => {
        document.body.innerHTML = `<div id="list"></div>`;
        renderSiteMapList(document.getElementById("list"), {}, { onRemove: jest.fn() });

        expect(document.getElementById("list").textContent).toContain("登録済みのサイトはまだありません");
    });

    test("renders one block per hostname with its field mappings", () => {
        document.body.innerHTML = `<div id="list"></div>`;
        const siteMap = {
            "example.com": {
                fieldMappings: [
                    { selector: "#fname", profilePath: "personal.firstName" },
                    { selector: "#essay", profilePath: null, aiAssist: true },
                ],
            },
        };

        renderSiteMapList(document.getElementById("list"), siteMap, { onRemove: jest.fn() });

        const container = document.getElementById("list");
        expect(container.querySelector("h4").textContent).toBe("example.com");
        const items = container.querySelectorAll("li");
        expect(items.length).toBe(2);
        expect(items[0].textContent).toContain("#fname");
        expect(items[0].textContent).toContain("名 (First name)");
        expect(items[1].textContent).toContain("AI入力支援");
    });

    test("skips hostnames with no field mappings", () => {
        document.body.innerHTML = `<div id="list"></div>`;
        const siteMap = { "empty.com": { fieldMappings: [] } };

        renderSiteMapList(document.getElementById("list"), siteMap, { onRemove: jest.fn() });
        expect(document.getElementById("list").textContent).toContain("登録済みのサイトはまだありません");
    });

    test("calls onRemove with hostname and index when a remove button is clicked", () => {
        document.body.innerHTML = `<div id="list"></div>`;
        const onRemove = jest.fn();
        const siteMap = {
            "example.com": {
                fieldMappings: [
                    { selector: "#a", profilePath: "personal.firstName" },
                    { selector: "#b", profilePath: "personal.lastName" },
                ],
            },
        };

        renderSiteMapList(document.getElementById("list"), siteMap, { onRemove });
        document.querySelectorAll("li")[1].querySelector("button").click();

        expect(onRemove).toHaveBeenCalledWith("example.com", 1);
    });
});
