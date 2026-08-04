class Shell {
    constructor() {
        this.aliases = {
            cls: "clear",
            ls: "projects",
            project: "open",
        };
    }

    resolveCommand(name, args) {
        const normalized = name.toLowerCase();
        const resolved = this.aliases[normalized] || normalized;

        if (resolved === "projects" && args.length > 0) {
            return "open";
        }

        return resolved;
    }

    async execute(input) {
        input = input.trim();

        if (input === "") {
            return "";
        }

        const tokens = input.split(/\s+/);
        const args = tokens.slice(1);
        const command = this.resolveCommand(tokens[0], args);

        return registry.execute(command, args);
    }
}

const shell = new Shell();