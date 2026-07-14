export async function exportProjectToZip(data) {
    if (!window.JSZip) {
        throw new Error("JSZip kütüphanesi yüklenemedi.");
    }
    const zip = new window.JSZip();

    // 1. Create subfolders
    const docsFolder = zip.folder("docs");
    const tasksFolder = zip.folder("tasks");
    const rulesFolder = zip.folder("rules");
    const skillsFolder = zip.folder("skills/project-architect");
    const stateFolder = zip.folder(".project-architect");

    // 2. Generate documents
    docsFolder.file("PROJECT_BRIEF.md", data.docs?.brief || "");
    docsFolder.file("REQUIREMENTS.md", data.docs?.requirements || "");
    docsFolder.file("ARCHITECTURE.md", data.docs?.architecture || "");
    docsFolder.file("TECH_STACK.md", data.docs?.tech_stack || "");
    docsFolder.file("RISKS.md", data.docs?.risks || "");
    docsFolder.file("state.md", data.docs?.state_md || "");

    // 3. Generate tasks
    if (Array.isArray(data.prompts)) {
        data.prompts.forEach((step, i) => {
            const stepNum = i + 1;
            let fileContent = `# TASK-${stepNum.toString().padStart(3, '0')}: ${step.title}\n\n`;
            fileContent += `## Açıklama\n${step.description}\n\n`;
            fileContent += `## Önerilen Model\n${step.recommendedModel}\n\n`;
            fileContent += `## Prompt Yönergesi\n\`\`\`text\n${step.content}\n\`\`\`\n`;
            if (step.developerNotes) {
                fileContent += `\n## Geliştirici Notları\n${step.developerNotes}\n`;
            }
            tasksFolder.file(`TASK-${stepNum.toString().padStart(3, '0')}.md`, fileContent);
        });
    }

    // 4. Generate rules & skills
    rulesFolder.file("general.md", data.cursorRules || "");
    rulesFolder.file("security.md", data.windsurfRules || "");
    skillsFolder.file("SKILL.md", data.skillMarkdown || "");

    // 5. Generate JSON state files
    stateFolder.file("state.json", JSON.stringify(data, null, 2));
    stateFolder.file("decisions.json", JSON.stringify(data.decisions || [], null, 2));
    stateFolder.file("assumptions.json", JSON.stringify(data.assumptions || [], null, 2));
    stateFolder.file("risks.json", JSON.stringify(data.risks || [], null, 2));

    // 6. Generate ZIP blob
    const content = await zip.generateAsync({ type: "blob" });
    return content;
}
