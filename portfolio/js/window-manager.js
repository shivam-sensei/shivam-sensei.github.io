(function () {
    const desktop = document.getElementById("desktop");
    const taskbarApps = document.getElementById("taskbar-apps");
    const taskbarClock = document.getElementById("taskbar-clock");

    class WindowManager {
        constructor(container) {
            this.container = container;
            this.windows = [];
            this.zIndex = 30;
            this.activeWindow = null;
            this.draggedWindow = null;
            this.resizingWindow = null;
            this.taskbarEntries = new Map();
            this.taskbarApps = taskbarApps;
            this.taskbarClock = taskbarClock;
            this.gap = 12;
            this.taskbarHeight = 48;

            window.addEventListener("resize", () => this.refreshLayout());
            document.addEventListener("mousemove", (event) => this.handlePointerMove(event));
            document.addEventListener("mouseup", () => this.handlePointerUp());
            this.startClock();
        }

        startClock() {
            const tick = () => {
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, "0");
                const minutes = String(now.getMinutes()).padStart(2, "0");
                this.taskbarClock.textContent = `${hours}:${minutes}`;
            };
            tick();
            window.setInterval(tick, 15000);
        }

        getDesktopBounds() {
            return {
                left: this.gap,
                top: this.gap,
                right: window.innerWidth - this.gap,
                bottom: window.innerHeight - this.taskbarHeight - this.gap,
            };
        }

        createWindow(options = {}) {
            const windowElement = document.createElement("div");
            windowElement.className = "app-window";
            windowElement.dataset.app = options.app || "window";
            windowElement.dataset.closable = options.closable === false ? "false" : "true";
            windowElement.classList.add("is-opening");

            const titleBar = document.createElement("div");
            titleBar.className = "window-titlebar";
            const closeButton = options.closable === false
                ? ""
                : '<button class="window-button close" data-action="close" aria-label="Close">×</button>';
            titleBar.innerHTML = `
                <div class="window-titlebar-left">
                    <span class="window-dot red"></span>
                    <span class="window-dot yellow"></span>
                    <span class="window-dot green"></span>
                </div>
                <div class="window-title">${options.title || "Window"}</div>
                <div class="window-titlebar-right">
                    <button class="window-button" data-action="minimize" aria-label="Minimize">—</button>
                    ${closeButton}
                </div>`;

            const content = document.createElement("div");
            content.className = "window-content";
            if (options.content) {
                content.appendChild(options.content);
            }

            windowElement.appendChild(titleBar);
            windowElement.appendChild(content);
            this.container.appendChild(windowElement);

            const windowInstance = {
                element: windowElement,
                titleBar,
                content,
                options,
                buttons: Array.from(titleBar.querySelectorAll(".window-button")),
                taskbarEntry: null,
                key: options.key || `${options.app || "window"}-${Date.now()}`,
                state: {
                    left: 0,
                    top: 0,
                    width: options.width || 920,
                    height: options.height || 620,
                },
                minWidth: options.minWidth || 340,
                minHeight: options.minHeight || 260,
                isDragging: false,
                isResizing: false,
                resizeEdge: null,
                dragOffsetX: 0,
                dragOffsetY: 0,
                resizeStart: null,
            };

            this.initializeState(windowInstance);
            this.bindWindow(windowInstance);
            this.attachResizeHandles(windowInstance);
            this.applyState(windowInstance);
            this.windows.push(windowInstance);
            requestAnimationFrame(() => windowElement.classList.remove("is-opening"));
            this.focus(windowInstance);
            this.renderTaskbarEntry(windowInstance);
            return windowInstance;
        }

        initializeState(windowInstance) {
            const bounds = this.getDesktopBounds();
            const state = windowInstance.state;

            if (this.isMobile()) {
                state.left = this.gap;
                state.top = this.gap;
                state.width = window.innerWidth - this.gap * 2;
                state.height = window.innerHeight - this.taskbarHeight - this.gap * 2;
                return;
            }

            state.width = Math.min(state.width, bounds.right - bounds.left);
            state.height = Math.min(state.height, bounds.bottom - bounds.top);
            const idx = this.windows.length;
            const baseLeft = (window.innerWidth - state.width) / 2 + idx * 32;
            const baseTop = (window.innerHeight - this.taskbarHeight - state.height) / 2 + idx * 24;
            state.left = this.clamp(baseLeft, bounds.left, bounds.right - state.width);
            state.top = this.clamp(baseTop, bounds.top, bounds.bottom - state.height);
        }

        createTerminalWindow() {
            const existing = this.windows.find((entry) => entry.options.app === "terminal");
            if (existing) {
                this.restore(existing);
                this.focus(existing);
                this.focusTerminalInput(existing);
                return existing;
            }

            const terminalBody = document.createElement("div");
            terminalBody.id = "terminal-body";
            terminalBody.innerHTML = `
                <div id="output"></div>
                <div id="input-line">
                    <span class="prompt">
                        <span class="prompt-user">shivam</span>
                        <span class="prompt-host">@portfolio</span>
                        <span class="prompt-path">:~</span>
                        <span class="prompt-symbol">$</span>
                    </span>
                    <input id="command-input" autocomplete="off" spellcheck="false">
                </div>`;

            const terminalWindow = this.createWindow({
                app: "terminal",
                key: "terminal",
                title: "PortfolioOS Terminal",
                content: terminalBody,
                width: 920,
                height: 620,
                minWidth: 520,
                minHeight: 340,
                closable: false,
            });

            window.terminalWindow = terminalWindow;
            return terminalWindow;
        }

        createResumeWindow() {
            const existing = this.windows.find((entry) => entry.options.app === "resume");
            if (existing) {
                this.restore(existing);
                this.focus(existing);
                return existing;
            }

            const resumeContent = document.createElement("div");
            resumeContent.className = "resume-viewer";
            const iframe = document.createElement("iframe");
            iframe.src = "resume.pdf";
            iframe.title = "Resume Viewer";
            resumeContent.appendChild(iframe);

            return this.createWindow({
                app: "resume",
                key: "resume",
                title: "Resume Viewer",
                content: resumeContent,
                width: 860,
                height: 640,
                minWidth: 560,
                minHeight: 360,
            });
        }

        createProjectWindow(project) {
            const key = `project:${project.slug}`;
            const existing = this.windows.find((entry) => entry.key === key);
            if (existing) {
                this.restore(existing);
                this.focus(existing);
                return existing;
            }

            const projectContent = this.buildProjectContent(project);
            return this.createWindow({
                app: "project",
                key,
                title: project.title,
                taskbarTitle: project.title,
                content: projectContent,
                width: 920,
                height: 650,
                minWidth: 520,
                minHeight: 380,
            });
        }

        buildProjectContent(project) {
            const wrapper = document.createElement("div");
            wrapper.className = "project-viewer";

            const links = [
                { label: "GitHub", href: project.github },
                { label: "Demo", href: project.website },
                { label: "Docs", href: project.documentation },
            ].filter((entry) => entry.href);

            const highlights = (project.highlights || []).map((item) => `<li>${this.escape(item)}</li>`).join("");
            const tags = (project.tags || []).map((tag) => `<span class="project-tag">${this.escape(tag)}</span>`).join("");
            const technologies = (project.technologies || []).map((tech) => `<span class="project-tech">${this.escape(tech)}</span>`).join("");
            const linksHtml = links.map((entry) => (
                `<a class="project-link" href="${this.escapeAttr(entry.href)}" target="_blank" rel="noopener noreferrer">${this.escape(entry.label)}</a>`
            )).join("");

            wrapper.innerHTML = `
                <section class="project-summary">
                    <h2 class="project-title">${this.escape(project.title)}</h2>
                    <p class="project-description">${this.escape(project.description || "")}</p>
                    <div class="project-meta">
                        <span class="project-badge">${this.escape(project.status || "Status TBD")}</span>
                        <span class="project-badge">${this.escape(String(project.year || "Year TBD"))}</span>
                    </div>
                    <div class="project-tech-stack">${technologies}</div>
                    <div class="project-links">${linksHtml}</div>
                </section>
                <section>
                    <h3 class="project-section-title">Highlights</h3>
                    <ul class="project-highlights">${highlights}</ul>
                </section>
                <section>
                    <h3 class="project-section-title">Images</h3>
                    <div class="project-image-grid">
                        ${this.renderImageCards(project.images || [], project.title)}
                    </div>
                </section>
                <section>
                    <h3 class="project-section-title">Tags</h3>
                    <div class="project-tags">${tags}</div>
                </section>
            `;
            return wrapper;
        }

        renderImageCards(images, projectTitle) {
            return images.map((image) => {
                const src = this.escapeAttr(image.src);
                const alt = this.escapeAttr(image.alt || `${projectTitle} image`);
                const caption = this.escape(image.caption || "");
                return `
                    <figure class="project-image-card">
                        <img src="${src}" alt="${alt}" loading="lazy">
                        ${caption ? `<figcaption>${caption}</figcaption>` : ""}
                    </figure>
                `;
            }).join("");
        }

        bindWindow(windowInstance) {
            windowInstance.titleBar.addEventListener("mousedown", (event) => this.startDrag(windowInstance, event));
            windowInstance.element.addEventListener("mousedown", (event) => {
                this.focus(windowInstance);
                if (windowInstance.options.app === "terminal" && !event.target.closest(".window-titlebar") && !event.target.closest(".window-button")) {
                    this.focusTerminalInput(windowInstance);
                }
            });

            windowInstance.buttons.forEach((button) => {
                button.addEventListener("click", (event) => {
                    event.stopPropagation();
                    if (button.dataset.action === "close") {
                        this.close(windowInstance);
                    } else if (button.dataset.action === "minimize") {
                        this.minimize(windowInstance);
                    }
                });
            });
        }

        attachResizeHandles(windowInstance) {
            if (this.isMobile()) {
                return;
            }

            const handles = [
                { edge: "right", className: "resize-handle resize-right" },
                { edge: "bottom", className: "resize-handle resize-bottom" },
                { edge: "corner", className: "resize-handle resize-corner" },
            ];

            handles.forEach((handleData) => {
                const handle = document.createElement("div");
                handle.className = handleData.className;
                handle.dataset.edge = handleData.edge;
                handle.addEventListener("mousedown", (event) => this.startResize(windowInstance, handleData.edge, event));
                windowInstance.element.appendChild(handle);
            });
        }

        applyState(windowInstance) {
            const state = windowInstance.state;
            windowInstance.element.style.left = `${state.left}px`;
            windowInstance.element.style.top = `${state.top}px`;
            windowInstance.element.style.width = `${state.width}px`;
            windowInstance.element.style.height = `${state.height}px`;
        }

        startDrag(windowInstance, event) {
            if (this.isMobile() || event.target.closest(".window-button") || event.target.closest(".window-titlebar-left")) {
                return;
            }

            this.focus(windowInstance);
            windowInstance.titleBar.classList.add("dragging");
            windowInstance.isDragging = true;
            this.draggedWindow = windowInstance;
            windowInstance.dragOffsetX = event.clientX - windowInstance.state.left;
            windowInstance.dragOffsetY = event.clientY - windowInstance.state.top;
        }

        startResize(windowInstance, edge, event) {
            if (this.isMobile()) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            this.focus(windowInstance);
            windowInstance.isResizing = true;
            windowInstance.resizeEdge = edge;
            windowInstance.resizeStart = {
                x: event.clientX,
                y: event.clientY,
                width: windowInstance.state.width,
                height: windowInstance.state.height,
                left: windowInstance.state.left,
                top: windowInstance.state.top,
            };
            this.resizingWindow = windowInstance;
        }

        handlePointerMove(event) {
            if (this.draggedWindow) {
                this.drag(this.draggedWindow, event);
            } else if (this.resizingWindow) {
                this.resize(this.resizingWindow, event);
            }
        }

        handlePointerUp() {
            if (this.draggedWindow) {
                this.endDrag(this.draggedWindow);
                this.draggedWindow = null;
            }

            if (this.resizingWindow) {
                this.endResize(this.resizingWindow);
                this.resizingWindow = null;
            }
        }

        drag(windowInstance, event) {
            if (!windowInstance.isDragging) {
                return;
            }

            const bounds = this.getDesktopBounds();
            const nextLeft = event.clientX - windowInstance.dragOffsetX;
            const nextTop = event.clientY - windowInstance.dragOffsetY;
            windowInstance.state.left = this.clamp(nextLeft, bounds.left, bounds.right - windowInstance.state.width);
            windowInstance.state.top = this.clamp(nextTop, bounds.top, bounds.bottom - windowInstance.state.height);
            this.applyState(windowInstance);
        }

        resize(windowInstance, event) {
            if (!windowInstance.isResizing || !windowInstance.resizeStart) {
                return;
            }

            const bounds = this.getDesktopBounds();
            const dx = event.clientX - windowInstance.resizeStart.x;
            const dy = event.clientY - windowInstance.resizeStart.y;
            const edge = windowInstance.resizeEdge;
            const maxWidth = bounds.right - windowInstance.state.left;
            const maxHeight = bounds.bottom - windowInstance.state.top;

            if (edge === "right" || edge === "corner") {
                windowInstance.state.width = this.clamp(
                    windowInstance.resizeStart.width + dx,
                    windowInstance.minWidth,
                    maxWidth
                );
            }

            if (edge === "bottom" || edge === "corner") {
                windowInstance.state.height = this.clamp(
                    windowInstance.resizeStart.height + dy,
                    windowInstance.minHeight,
                    maxHeight
                );
            }

            this.applyState(windowInstance);
        }

        endDrag(windowInstance) {
            windowInstance.isDragging = false;
            windowInstance.titleBar.classList.remove("dragging");
        }

        endResize(windowInstance) {
            windowInstance.isResizing = false;
            windowInstance.resizeEdge = null;
            windowInstance.resizeStart = null;
        }

        focus(windowInstance) {
            if (!windowInstance) {
                return;
            }

            this.windows.forEach((entry) => {
                entry.element.classList.toggle("focused", entry === windowInstance);
            });

            this.activeWindow = windowInstance;
            this.zIndex += 1;
            windowInstance.element.style.zIndex = `${this.zIndex}`;
            this.updateTaskbarState();
            if (windowInstance.options.app === "terminal") {
                this.focusTerminalInput(windowInstance);
            }
        }

        minimize(windowInstance) {
            if (windowInstance.element.classList.contains("minimized")) {
                return;
            }

            windowInstance.element.classList.add("is-hiding");
            windowInstance.element.style.pointerEvents = "none";
            window.setTimeout(() => {
                windowInstance.element.classList.add("minimized");
                windowInstance.element.classList.remove("is-hiding");
                windowInstance.element.style.display = "none";
                windowInstance.element.style.pointerEvents = "auto";
                this.updateTaskbarState();
            }, 160);
        }

        restore(windowInstance) {
            if (!windowInstance.element.classList.contains("minimized")) {
                this.focus(windowInstance);
                return;
            }

            windowInstance.element.style.display = "flex";
            windowInstance.element.classList.remove("minimized");
            windowInstance.element.classList.add("is-showing");
            window.setTimeout(() => {
                windowInstance.element.classList.remove("is-showing");
                this.focus(windowInstance);
                if (windowInstance.options.app === "terminal") {
                    this.focusTerminalInput(windowInstance);
                }
            }, 180);
        }

        close(windowInstance) {
            if (windowInstance.options.closable === false) {
                return;
            }

            this.removeTaskbarEntry(windowInstance);
            windowInstance.element.remove();
            this.windows = this.windows.filter((entry) => entry !== windowInstance);
            if (this.activeWindow === windowInstance) {
                this.activeWindow = this.windows[this.windows.length - 1] || null;
            }
            this.updateTaskbarState();
        }

        refreshLayout() {
            const bounds = this.getDesktopBounds();
            this.windows.forEach((windowInstance) => {
                if (this.isMobile()) {
                    windowInstance.state.left = this.gap;
                    windowInstance.state.top = this.gap;
                    windowInstance.state.width = window.innerWidth - this.gap * 2;
                    windowInstance.state.height = window.innerHeight - this.taskbarHeight - this.gap * 2;
                } else {
                    windowInstance.state.width = this.clamp(windowInstance.state.width, windowInstance.minWidth, bounds.right - bounds.left);
                    windowInstance.state.height = this.clamp(windowInstance.state.height, windowInstance.minHeight, bounds.bottom - bounds.top);
                    windowInstance.state.left = this.clamp(windowInstance.state.left, bounds.left, bounds.right - windowInstance.state.width);
                    windowInstance.state.top = this.clamp(windowInstance.state.top, bounds.top, bounds.bottom - windowInstance.state.height);
                }
                this.applyState(windowInstance);
            });
        }

        renderTaskbarEntry(windowInstance) {
            const entry = document.createElement("button");
            entry.className = "taskbar-entry";
            entry.type = "button";
            const label = windowInstance.options.taskbarTitle || windowInstance.options.title || "Window";
            entry.innerHTML = `<span class="taskbar-app-icon">${this.getAppIcon(windowInstance)}</span><span class="taskbar-app-label">${this.escape(label)}</span>`;
            entry.addEventListener("click", () => {
                if (windowInstance.element.classList.contains("minimized")) {
                    this.restore(windowInstance);
                } else {
                    this.focus(windowInstance);
                }
            });
            this.taskbarApps.appendChild(entry);
            windowInstance.taskbarEntry = entry;
            this.taskbarEntries.set(windowInstance, entry);
            this.updateTaskbarState();
        }

        removeTaskbarEntry(windowInstance) {
            const entry = this.taskbarEntries.get(windowInstance);
            if (entry) {
                entry.remove();
                this.taskbarEntries.delete(windowInstance);
            }
        }

        updateTaskbarState() {
            this.taskbarEntries.forEach((entry, windowInstance) => {
                const isActive = this.activeWindow === windowInstance;
                const isMinimized = windowInstance.element.classList.contains("minimized");
                entry.classList.toggle("active", isActive);
                entry.classList.toggle("minimized", isMinimized);
            });
        }

        getAppIcon(windowInstance) {
            const app = windowInstance.options.app || "window";
            if (app === "terminal") {
                return "⌘";
            }
            if (app === "resume") {
                return "▤";
            }
            if (app === "project") {
                return "◫";
            }
            return "◦";
        }

        focusTerminalInput(windowInstance) {
            if (windowInstance.options.app !== "terminal") {
                return;
            }
            window.setTimeout(() => {
                const terminalInput = windowInstance.element.querySelector("#command-input");
                if (terminalInput) {
                    terminalInput.focus();
                }
            }, 0);
        }

        clamp(value, min, max) {
            return Math.max(min, Math.min(value, max));
        }

        escape(text) {
            return String(text)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }

        escapeAttr(text) {
            return this.escape(text).replace(/"/g, "&quot;");
        }

        isMobile() {
            return window.matchMedia("(max-width: 768px)").matches;
        }
    }

    const manager = new WindowManager(desktop);
    window.WindowManager = WindowManager;
    window.windowManager = manager;
    manager.createTerminalWindow();
})();
