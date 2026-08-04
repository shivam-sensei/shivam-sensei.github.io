const output = document.getElementById("output");
const input = document.getElementById("command-input");
const renderer = new TerminalRenderer(output);
const history = [];
let historyIndex = -1;
let isExecuting = false;

function printPromptCommand(command) {
    const commandText = `shivam@portfolio:~$ ${command}`;
    renderer.appendHtml(`<div class="terminal-command-line">${renderer.escape(commandText)}</div>`);
}

function renderOutput(model) {
    if (!model) {
        return;
    }

    if (model.type === "clear") {
        renderer.clear();
        return;
    }

    renderer.render(model);
}

function runStepSequence(steps, onDone) {
    const sequence = Array.isArray(steps) ? steps : [];
    let index = 0;

    const stepRunner = () => {
        if (index >= sequence.length) {
            onDone();
            return;
        }

        renderer.appendHtml(`<div class="terminal-loading-line">${renderer.escape(sequence[index])}</div>`);
        index += 1;
        setTimeout(stepRunner, 140);
    };

    stepRunner();
}

function handleLaunch(model) {
    runStepSequence(model.steps, () => {
        renderer.appendHtml(renderer.success(model.done || "Done."));
        if (window.windowManager && model.app === "resume") {
            window.windowManager.createResumeWindow();
        }
    });
}

function handleProjectOpen(model) {
    runStepSequence(model.loadingSteps, () => {
        renderer.appendHtml(renderer.success("Project ready."));
        if (window.windowManager && model.project) {
            window.windowManager.createProjectWindow(model.project);
        }
    });
}

async function execute(command) {
    if (isExecuting) {
        return;
    }

    command = command.trim();
    if (command === "") {
        return;
    }

    isExecuting = true;
    input.disabled = true;

    printPromptCommand(command);
    history.push(command);
    historyIndex = history.length;

    const result = await shell.execute(command);

    if (!result) {
        input.disabled = false;
        input.focus();
        isExecuting = false;
        return;
    }

    if (result.type === "launch-app") {
        handleLaunch(result);
    } else if (result.type === "open-project-window") {
        handleProjectOpen(result);
    } else if (result.loadingSteps) {
        runStepSequence(result.loadingSteps, () => renderOutput(result));
    } else {
        renderOutput(result);
    }

    input.disabled = false;
    input.focus();
    isExecuting = false;
}

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        execute(input.value);
        input.value = "";
        return;
    }

    if (event.key === "ArrowUp") {
        event.preventDefault();
        if (historyIndex > 0) {
            historyIndex -= 1;
            input.value = history[historyIndex] || "";
        }
        return;
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        if (historyIndex < history.length - 1) {
            historyIndex += 1;
            input.value = history[historyIndex] || "";
        } else {
            historyIndex = history.length;
            input.value = "";
        }
    }
});

window.addEventListener("boot-complete", () => {
    renderer.render({
        type: "info",
        title: "PortfolioOS",
        content: "v1.0 • Build 2026.08 • Developer Workstation",
    });
    renderer.appendHtml('<div class="terminal-info">Type <span class="terminal-highlight">help</span> to begin.</div>');
    input.focus();
});
