import { buildSystemPrompt, buildUserPrompt } from "./prompt-builder";

describe("prompt-builder → buildSystemPrompt", () => {
    test("includes skills, experience, and education summaries", () => {
        const profile = {
            skills: ["JavaScript", "SQL"],
            experiences: [{ company: "Acme", title: "Engineer", startDate: "2020-01", isCurrent: true, description: "Built APIs" }],
            education: [{ school: "Example Univ", degree: "B.Sc.", fieldOfStudy: "CS" }],
            coverLetterTemplate: "I am passionate about...",
        };

        const prompt = buildSystemPrompt(profile);

        expect(prompt).toContain("JavaScript, SQL");
        expect(prompt).toContain("Acme");
        expect(prompt).toContain("Built APIs");
        expect(prompt).toContain("Example Univ");
        expect(prompt).toContain("I am passionate about...");
    });

    test("instructs the model not to fabricate information not in the profile", () => {
        const prompt = buildSystemPrompt({ skills: [], experiences: [], education: [] });
        expect(prompt).toContain("創作しないでください");
    });

    test("handles an empty profile without throwing", () => {
        expect(() => buildSystemPrompt({})).not.toThrow();
        const prompt = buildSystemPrompt({});
        expect(prompt).toContain("未登録");
    });
});

describe("prompt-builder → buildUserPrompt", () => {
    test("includes the question and job description", () => {
        const prompt = buildUserPrompt({ question: "Why do you want this job?", jobDescription: "We build widgets." });
        expect(prompt).toContain("Why do you want this job?");
        expect(prompt).toContain("We build widgets.");
    });

    test("falls back to a placeholder when question or JD are missing", () => {
        const prompt = buildUserPrompt({});
        expect(prompt).toContain("取得できませんでした");
    });
});
