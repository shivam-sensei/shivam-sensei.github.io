(function (global) {
    class TerminalRenderer {
        constructor(outputEl) {
            this.outputEl = outputEl;
        }

        clear() {
            this.outputEl.innerHTML = "";
            this.outputEl.scrollTop = 0;
        }

        appendHtml(html) {
            const wrapper = document.createElement("div");
            wrapper.className = "terminal-block";
            wrapper.innerHTML = html;
            this.outputEl.appendChild(wrapper);
            this.outputEl.scrollTop = this.outputEl.scrollHeight;
        }

        appendLine(text, className = "") {
            const block = document.createElement("div");
            block.className = `terminal-line${className ? ` ${className}` : ""}`;
            block.textContent = text;
            this.outputEl.appendChild(block);
            this.outputEl.scrollTop = this.outputEl.scrollHeight;
        }

        render(model) {
            if (!model) {
                return;
            }

            if (typeof model === "string") {
                this.appendLine(model);
                return;
            }

            if (model.type === "clear") {
                this.clear();
                return;
            }

            if (model.type === "manual") {
                this.renderManual(model);
                return;
            }

            if (model.type === "system-info") {
                this.renderSystemInfo(model);
                return;
            }

            if (model.type === "project-list") {
                this.renderProjectList(model);
                return;
            }

            if (model.type === "skill-list") {
                this.renderSkillList(model);
                return;
            }

            if (model.type === "config") {
                this.renderConfig(model);
                return;
            }

            if (model.type === "contact-card") {
                this.renderContactCard(model);
                return;
            }

            if (model.type === "launch-app") {
                this.renderLaunch(model);
                return;
            }

            if (model.type === "error") {
                this.renderError(model);
                return;
            }

            if (model.type === "warning") {
                this.renderWarning(model);
                return;
            }

            if (model.type === "table") {
                this.renderTable(model);
                return;
            }

            if (model.type === "tree") {
                this.renderTree(model);
                return;
            }

            if (model.type === "info") {
                this.appendHtml(this.box(model.title || "Info", this.inline(model.content || "")));
                return;
            }

            this.appendLine(model.message || model.content || "", "terminal-line-muted");
        }

        renderManual(model) {
            this.appendHtml(this.header(model.title || "Command Reference"));
            if (model.description) {
                this.appendHtml(this.info(model.description));
            }

            model.sections.forEach((section) => {
                this.appendHtml(this.subheader(section.title));
                const items = section.items.map((item) => {
                    const label = this.highlight(item.name);
                    const detail = item.detail ? `<span class="terminal-muted">${this.escape(item.detail)}</span>` : "";
                    return `<div class="terminal-list-item"><span class="terminal-list-label">${label}</span>${detail}</div>`;
                }).join("");
                this.appendHtml(`<div class="terminal-list">${items}</div>`);
            });
        }

        renderSystemInfo(model) {
            this.appendHtml(this.header(model.title || "System Information"));
            this.appendHtml(this.separator());
            const groups = model.sections || [];
            const items = groups.map((group) => {
                const cards = group.items.map((item) => {
                    return `<div class="terminal-card"><div class="terminal-card-label">${this.escape(item.label)}</div><div class="terminal-card-value">${this.escape(item.value)}</div></div>`;
                }).join("");
                return `<div class="terminal-group">${this.subheader(group.title)}${cards}</div>`;
            }).join("");
            this.appendHtml(`<div class="terminal-card-grid">${items}</div>`);
        }

        renderProjectList(model) {
            this.appendHtml(this.header(model.title || "Projects"));
            (model.items || []).forEach((item) => {
                const meta = [item.status, item.year].filter(Boolean).join(" • ");
                const metaLine = meta ? `<div class="terminal-meta">${this.escape(meta)}</div>` : "";
                this.appendHtml(`<div class="terminal-project-item"><div class="terminal-project-title">${item.rank}. ${this.escape(item.name)}</div><div class="terminal-meta">Slug: ${this.escape(item.slug)}</div>${metaLine}</div>`);
            });
            if (model.tip) {
                this.appendHtml(this.info(model.tip));
            }
        }

        renderSkillList(model) {
            this.appendHtml(this.header(model.title || "Skills"));
            (model.groups || []).forEach((group) => {
                this.appendHtml(this.subheader(group.title));
                const badges = (group.items || []).map((item) => this.badge(item.name, item.tone || "default")).join("");
                this.appendHtml(`<div class="terminal-badge-row">${badges}</div>`);
                if (group.progress) {
                    this.appendHtml(this.progressList(group.progress));
                }
            });
        }

        renderConfig(model) {
            this.appendHtml(this.header(model.title || "Configuration"));
            const rows = (model.fields || []).map((field) => {
                return `<div class="terminal-config-row"><span class="terminal-config-label">${this.escape(field.label)}</span><span class="terminal-config-value">${this.escape(field.value)}</span></div>`;
            }).join("");
            this.appendHtml(`<div class="terminal-config">${rows}</div>`);
        }

        renderContactCard(model) {
            this.appendHtml(this.header(model.title || "Contact"));
            const rows = (model.entries || []).map((entry) => {
                const target = entry.external ? ' target="_blank" rel="noopener noreferrer"' : "";
                return `<div class="terminal-config-row"><span class="terminal-config-label">${this.escape(entry.label)}</span><a class="terminal-link" href="${this.escapeAttribute(entry.href)}"${target}>${this.escape(entry.value)}</a></div>`;
            }).join("");
            this.appendHtml(`<div class="terminal-config terminal-contact-card">${rows}</div>`);
        }

        renderLaunch(model) {
            this.appendHtml(this.header(model.title || "Launching"));
            (model.steps || []).forEach((step) => {
                this.appendHtml(`<div class="terminal-loading-line">${this.escape(step)}</div>`);
            });
            this.appendHtml(this.success(model.done || "Done."));
        }

        renderError(model) {
            this.appendHtml(this.error(model.message || "Unknown error"));
            if (model.hint) {
                this.appendHtml(this.info(model.hint));
            }
        }

        renderWarning(model) {
            this.appendHtml(this.warning(model.message || "Warning"));
            if (model.hint) {
                this.appendHtml(this.info(model.hint));
            }
        }

        renderTable(model) {
            const headers = (model.headers || []).map((header) => `<th>${this.escape(header)}</th>`).join("");
            const rows = (model.rows || []).map((row) => `<tr>${row.map((cell) => `<td>${this.escape(String(cell))}</td>`).join("")}</tr>`).join("");
            this.appendHtml(`<div class="terminal-table-wrap"><table class="terminal-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`);
        }

        renderTree(model) {
            const renderItems = (items, depth = 0) => {
                return items.map((item) => {
                    const children = item.children ? `<div class="terminal-tree-children">${renderItems(item.children, depth + 1)}</div>` : "";
                    return `<div class="terminal-tree-item"><div class="terminal-tree-label" style="padding-left:${depth * 12}px">${this.escape(item.label)}</div>${children}</div>`;
                }).join("");
            };
            this.appendHtml(`<div class="terminal-tree">${renderItems(model.items || [])}</div>`);
        }

        header(text) {
            return `<div class="terminal-header">${this.escape(text)}</div>`;
        }

        subheader(text) {
            return `<div class="terminal-subheader">${this.escape(text)}</div>`;
        }

        separator() {
            return `<div class="terminal-separator"></div>`;
        }

        badge(text, tone = "default") {
            return `<span class="terminal-badge terminal-badge-${tone}">${this.escape(text)}</span>`;
        }

        box(title, content) {
            return `<div class="terminal-box"><div class="terminal-box-title">${this.escape(title)}</div><div class="terminal-box-body">${content}</div></div>`;
        }

        info(text) {
            return `<div class="terminal-info">${this.escape(text)}</div>`;
        }

        warning(text) {
            return `<div class="terminal-warning">${this.escape(text)}</div>`;
        }

        success(text) {
            return `<div class="terminal-success">${this.escape(text)}</div>`;
        }

        error(text) {
            return `<div class="terminal-error">${this.escape(text)}</div>`;
        }

        highlight(text) {
            return `<span class="terminal-highlight">${this.escape(text)}</span>`;
        }

        inline(text) {
            return `<span class="terminal-inline">${this.escape(text)}</span>`;
        }

        progressList(items) {
            return `<div class="terminal-progress-list">${items.map((item) => {
                const blocks = "█".repeat(Math.max(1, item.level || 1));
                return `<div class="terminal-progress-row"><span>${this.escape(item.label)}</span><span class="terminal-progress-bar">${blocks}</span></div>`;
            }).join("")}</div>`;
        }

        escape(text) {
            return String(text)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }

        escapeAttribute(text) {
            return this.escape(text).replace(/"/g, "&quot;");
        }
    }

    global.TerminalRenderer = TerminalRenderer;
})(window);
