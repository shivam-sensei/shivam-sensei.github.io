class CommandRegistry {
    constructor() {
        this.commands = new Map();
    }

    register(name, handler) {
        this.commands.set(name.toLowerCase(), handler);
    }

    async execute(name, args) {
        name = name.toLowerCase();

        if (!this.commands.has(name)) {
            return {
                type: "error",
                message: `portfolio: command '${name}' not found`,
                hint: 'Type "help" to see available commands.'
            };
        }

        return this.commands.get(name)(args);
    }

    exists(name) {
        return this.commands.has(name.toLowerCase());
    }

    list() {
        return [...this.commands.keys()].sort();
    }
}

const registry = new CommandRegistry();

const PROJECT_INDEX_PATH = "data/projects/index.json";
const projectIndexCache = {
    loaded: false,
    data: null,
};

function normalizeProjectSlug(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-");
}

async function loadProjectIndex() {
    if (projectIndexCache.loaded && projectIndexCache.data) {
        return projectIndexCache.data;
    }

    const response = await fetch(PROJECT_INDEX_PATH, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("Unable to load project index.");
    }

    const data = await response.json();
    projectIndexCache.loaded = true;
    projectIndexCache.data = data;
    return data;
}

async function loadProjectBySlug(slugInput) {
    const slug = normalizeProjectSlug(slugInput);
    const index = await loadProjectIndex();
    const entry = (index.projects || []).find((project) => project.slug === slug);

    if (!entry) {
        return null;
    }

    const response = await fetch(`data/projects/${entry.file}`, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Unable to load project '${slug}'.`);
    }

    const data = await response.json();
    return { ...data, slug };
}

registry.register("help", () => ({
    type: "manual",
    title: "PortfolioOS Command Reference",
    description: "A lightweight guide to the available workstation commands.",
    sections: [
        {
            title: "Navigation",
            items: [
                { name: "about", detail: "Show system profile" },
                { name: "projects", detail: "List active projects" },
                { name: "skills", detail: "Show technical stack" },
                { name: "open <project>", detail: "Open a project viewer" }
            ]
        },
        {
            title: "Documents",
            items: [
                { name: "resume", detail: "Open the resume viewer" },
                { name: "contact", detail: "Show contact details" }
            ]
        },
        {
            title: "Utilities",
            items: [
                { name: "clear", detail: "Clear terminal output" },
                { name: "help", detail: "Show this reference" }
            ]
        }
    ]
}));

registry.register("about", () => ({
    type: "system-info",
    title: "System Profile",
    sections: [
        {
            title: "Developer",
            items: [
                { label: "Name", value: "Shivam Gupta" },
                { label: "Role", value: "Embedded Systems & Robotics Engineer" }
            ]
        },
        {
            title: "Education",
            items: [
                { label: "University", value: "Maharaja Agrasen Institute of Technology" },
                { label: "Degree", value: "B.Tech in Information Technology" }
            ]
        },
        {
            title: "Focus",
            items: [
                { label: "Core", value: "Embedded Systems, Robotics, Industrial IoT" },
                { label: "Interests", value: "ROS2, ESP32, Autonomous Navigation" }
            ]
        },
        {
            title: "Current Status",
            items: [
                { label: "Working On", value: "Embedded and robotics projects" },
                { label: "Availability", value: "Open to collaborations" }
            ]
        }
    ]
}));

registry.register("projects", async () => {
    try {
        const index = await loadProjectIndex();
        const items = (index.projects || []).map((project, idx) => ({
            rank: idx + 1,
            slug: project.slug,
            name: project.title,
            status: project.status,
            year: project.year,
        }));

        return {
            type: "project-list",
            title: "Projects",
            items,
            tip: "Tip: open quadruped",
            loadingSteps: ["Loading projects...", "Reading metadata..."],
        };
    } catch (error) {
        return {
            type: "error",
            message: "Unable to read project index.",
            hint: "Check data/projects/index.json and try again.",
        };
    }
});

registry.register("open", async (args) => {
    const slugInput = args[0];

    if (!slugInput) {
        return {
            type: "warning",
            message: "Usage: open <project-slug>",
            hint: "Example: open quadruped",
        };
    }

    try {
        const project = await loadProjectBySlug(slugInput);
        if (!project) {
            return {
                type: "error",
                message: `Project '${slugInput}' was not found.`,
                hint: "Run 'projects' to see available project slugs.",
            };
        }

        return {
            type: "open-project-window",
            title: project.title,
            project,
            loadingSteps: ["Loading project...", "Composing workspace..."],
        };
    } catch (error) {
        return {
            type: "error",
            message: `Unable to open project '${slugInput}'.`,
            hint: "Verify that the project JSON and assets exist.",
        };
    }
});

registry.register("skills", () => ({
    type: "skill-list",
    title: "Skills",
    groups: [
        {
            title: "Programming",
            items: [
                { name: "Python", tone: "accent" },
                { name: "C++", tone: "accent" },
                { name: "JavaScript", tone: "accent" }
            ],
            progress: [
                { label: "Python", level: 6 },
                { label: "C++", level: 5 },
                { label: "JavaScript", level: 4 }
            ]
        },
        {
            title: "Embedded",
            items: [
                { name: "ESP32", tone: "accent" },
                { name: "STM32", tone: "accent" },
                { name: "Arduino", tone: "accent" }
            ]
        },
        {
            title: "Robotics",
            items: [
                { name: "ROS2", tone: "accent" },
                { name: "Gazebo", tone: "accent" },
                { name: "OpenCV", tone: "accent" }
            ]
        }
    ]
}));

registry.register("resume", () => ({
    type: "launch-app",
    title: "Resume Viewer",
    steps: ["Launching Resume Viewer...", "Loading PDF..."],
    done: "Done.",
    app: "resume"
}));

registry.register("contact", () => ({
    type: "contact-card",
    title: "Contact",
    entries: [
        {
            label: "GitHub",
            value: "github.com/shivam-sensei",
            href: "https://github.com/shivam-sensei/",
            external: true,
        },
        {
            label: "LinkedIn",
            value: "linkedin.com/in/shivam-gupta-ab609a218",
            href: "https://www.linkedin.com/in/shivam-gupta-ab609a218/",
            external: true,
        },
        {
            label: "Email",
            value: "shivgupta751157@gmail.com",
            href: "mailto:shivgupta751157@gmail.com",
            external: false,
        },
    ],
}));

registry.register("clear", () => ({ type: "clear" }));