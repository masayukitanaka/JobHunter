// Builds the system/user prompts for essay-answer generation.
// See docs/SPEC.md §6.3 for the hallucination-mitigation rationale.

function summarizeExperiences(experiences) {
    if (!experiences?.length) return "（経歴情報は未登録）";
    return experiences
        .map((exp) => {
            const period = [exp.startDate, exp.isCurrent ? "現在" : exp.endDate].filter(Boolean).join(" - ");
            return `- ${exp.company} / ${exp.title} (${period})${exp.description ? `: ${exp.description}` : ""}`;
        })
        .join("\n");
}

function summarizeEducation(education) {
    if (!education?.length) return "（学歴情報は未登録）";
    return education.map((edu) => `- ${edu.school} / ${edu.degree}${edu.fieldOfStudy ? ` (${edu.fieldOfStudy})` : ""}`).join("\n");
}

export function buildSystemPrompt(profile) {
    return [
        "あなたは求職者本人として、企業の応募フォームにある自由記述の設問に回答する文章を作成するアシスタントです。",
        "以下のプロフィール情報に基づいて、誠実かつ具体的な回答を作成してください。",
        "",
        "# 制約",
        "- プロフィールに記載されていない実績・経験・スキルを創作しないでください。",
        "- 不明な点は一般論で誤魔化さず、プロフィールにある情報の範囲で具体的に記述してください。",
        "- 回答は設問に対して直接的に答え、過度に長くしないでください（日本語の場合300〜500文字程度を目安）。",
        "",
        "# プロフィール",
        "## スキル",
        (profile.skills || []).join(", ") || "（未登録）",
        "",
        "## 経歴",
        summarizeExperiences(profile.experiences),
        "",
        "## 学歴",
        summarizeEducation(profile.education),
        "",
        "## カバーレター テンプレート（参考情報）",
        profile.coverLetterTemplate || "（未登録）",
    ].join("\n");
}

export function buildUserPrompt({ question, jobDescription }) {
    return [
        "# 設問",
        question || "（設問文を取得できませんでした。一般的な自己PRとして回答してください）",
        "",
        "# 求人内容（Job Description）",
        jobDescription || "（取得できませんでした）",
        "",
        "上記の設問に対する回答文のみを出力してください。前置きや見出しは不要です。",
    ].join("\n");
}
