window.__ModuleLoader__.load({
	id: "dsh-desktop-tweaks",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const h = React.createElement;
		// dsh-desktop-tweaks v0.2.0 — slim edition: F11 titlebar/fullscreen toggle
		// and smart terminal Ctrl+C/V only. Sidebar width controls were removed.

		//#region settings
		const STORAGE_KEY = "dsh-desktop-tweaks/settings";
		const DEFAULTS = {
			/** F11 toggles window fullscreen. */
			titlebarToggle: true,
			/** Smart Ctrl+C/V inside the built-in terminal. */
			terminalClipboard: true,
		};
		const state = { settings: { ...DEFAULTS } };
		const listeners = new Set();
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw !== null) Object.assign(state.settings, JSON.parse(raw));
		} catch (error) {
			console.warn("[desktop-tweaks] settings load failed:", error);
		}
		/** Read the live settings snapshot. */
		function getSettings() {
			return state.settings;
		}
		/** Merge a patch into settings, persist it, and notify the UI. */
		function updateSettings(patch) {
			state.settings = { ...state.settings, ...patch };
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
			} catch (error) {
				console.warn("[desktop-tweaks] settings save failed:", error);
			}
			for (const listener of [...listeners]) {
				try {
					listener();
				} catch (error) {
					console.error("[desktop-tweaks] settings listener failed:", error);
				}
			}
		}
		//#endregion

		//#region F11 fullscreen (feature 2)
		let fullscreenBusy = false;

		/** F11 toggles window fullscreen. The Electron shell hides the native
		 * caption buttons in fullscreen on its own; the plugin only hides the
		 * menu bar so nothing overlaps the content. */
		function onTitlebarKey(event) {
			if (!getSettings().titlebarToggle) return;
			if (event.key !== "F11") return;
			if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
			event.preventDefault();
			event.stopPropagation();
			if (fullscreenBusy) return;
			fullscreenBusy = true;
			const settle = () => { fullscreenBusy = false; };
			try {
				const action = document.fullscreenElement === null
					? document.documentElement.requestFullscreen()
					: document.exitFullscreen();
				Promise.resolve(action).catch((error) => {
					console.warn("[desktop-tweaks] fullscreen toggle failed:", error);
				}).finally(settle);
			} catch (error) {
				console.warn("[desktop-tweaks] fullscreen toggle failed:", error);
				settle();
			}
		}

		/** Hide the menu bar and lift the chrome away while fullscreen, so the
		 * content can occupy the top edge. */
		function onFullscreenChange() {
			const fullscreen = document.fullscreenElement !== null;
			const root = document.documentElement;
			root.toggleAttribute("data-dsh-titlebar-hidden", fullscreen);
			if (root.dataset.platform !== "win32") return;
			if (fullscreen) {
				root.removeAttribute("data-windows-titlebar");
				root.style.setProperty("--dsh-windows-titlebar-height", "0px");
			} else {
				root.setAttribute("data-windows-titlebar", "");
				root.style.setProperty("--dsh-windows-titlebar-height", "40px");
			}
		}
		//#endregion

		//#region terminal Ctrl+C/V (feature 3)
		/** Read xterm's own selection text by letting its copy listener fill a synthetic event. */
		function readTerminalSelection(xtermElement) {
			try {
				const data = new DataTransfer();
				const event = new ClipboardEvent("copy", { bubbles: true, cancelable: true });
				Object.defineProperty(event, "clipboardData", { value: data });
				xtermElement.dispatchEvent(event);
				return data.getData("text/plain");
			} catch (error) {
				console.warn("[desktop-tweaks] selection read failed:", error);
				return "";
			}
		}

		/** Write text to the system clipboard without leaving the renderer. */
		function writeClipboard(text) {
			try {
				if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
					navigator.clipboard.writeText(text).catch(() => {});
					return;
				}
			} catch {}
			try {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				textarea.remove();
			} catch (error) {
				console.warn("[desktop-tweaks] clipboard write failed:", error);
			}
		}

		/** Deliver clipboard text to xterm through its own paste pipeline. */
		function pasteIntoTerminal(xtermElement, text) {
			const textarea = xtermElement.querySelector(".xterm-helper-textarea");
			if (!(textarea instanceof HTMLTextAreaElement)) return false;
			try {
				const data = new DataTransfer();
				data.setData("text/plain", text);
				const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
				Object.defineProperty(event, "clipboardData", { value: data });
				textarea.dispatchEvent(event);
				return true;
			} catch (error) {
				console.warn("[desktop-tweaks] paste dispatch failed:", error);
				return false;
			}
		}

		/** Smart Ctrl+C/V inside the built-in terminal; no effect anywhere else. */
		function onTerminalKey(event) {
			if (!getSettings().terminalClipboard) return;
			if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
			const key = event.key.toLowerCase();
			if (key !== "c" && key !== "v") return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const terminal = target.closest("[data-sidebar-terminal]");
			if (terminal === null) return;
			const xtermElement = terminal.querySelector(".xterm");
			if (!(xtermElement instanceof HTMLElement)) return;
			if (key === "c") {
				const selection = readTerminalSelection(xtermElement);
				// No selection means the shell is the target: let ^C reach it (SIGINT).
				if (selection === "") return;
				event.preventDefault();
				event.stopPropagation();
				writeClipboard(selection);
				return;
			}
			// Ctrl+V always pastes at the prompt instead of sending the literal ^V.
			event.preventDefault();
			event.stopPropagation();
			const paste = (text) => {
				if (typeof text === "string" && text !== "") pasteIntoTerminal(xtermElement, text);
			};
			try {
				if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
					navigator.clipboard.readText().then(paste, () => {
						// Permission denied: fall back to the native paste command,
						// which still routes through xterm's own paste listener.
						try {
							xtermElement.querySelector(".xterm-helper-textarea")?.focus();
							document.execCommand("paste");
						} catch {}
					});
					return;
				}
			} catch {}
			try {
				xtermElement.querySelector(".xterm-helper-textarea")?.focus();
				document.execCommand("paste");
			} catch (error) {
				console.warn("[desktop-tweaks] paste failed:", error);
			}
		}
		//#endregion

		//#region settings rows (Settings → General)
		/** Shared subscription so each row re-renders when a sibling toggles. */
		function useSettingsState() {
			const [settings, setLocal] = React.useState(getSettings());
			React.useEffect(() => {
				const listener = () => { setLocal(getSettings()); };
				listeners.add(listener);
				return () => { listeners.delete(listener); };
			}, []);
			return settings;
		}

		const rowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: "24px",
			padding: "16px 0",
			borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
		};
		const titleStyle = { color: "var(--dsw-alias-label-primary)", fontSize: "14px", lineHeight: "20px" };
		const hintStyle = { color: "var(--dsw-alias-label-secondary)", marginTop: "4px", fontSize: "12px", lineHeight: "18px" };

		/** Native-looking toggle switch, matching the DSH primitives Switch. */
		function ToggleSwitch(props) {
			const { checked, label, onChange } = props;
			return h("button", {
				type: "button",
				role: "switch",
				"aria-checked": checked,
				"aria-label": label,
				className: "dsh-desktop-tweaks-switch",
				onClick: () => { onChange(!checked); },
				children: h("span", { className: "dsh-desktop-tweaks-thumb" }),
			});
		}

		/** One General-settings preference row with a switch on the right. */
		function ToggleRow(props) {
			const { title, hint, checked, onChange } = props;
			return h("div", { style: rowStyle },
				h("div", { style: { minWidth: 0 } },
					h("div", { style: titleStyle }, title),
					hint === undefined ? null : h("div", { style: hintStyle }, hint),
				),
				h(ToggleSwitch, { checked, label: title, onChange }),
			);
		}

		/** F11 fullscreen preference row. */
		function FullscreenRow() {
			const settings = useSettingsState();
			return h(ToggleRow, {
				title: "F11 切换窗口全屏",
				hint: "按 F11 进入/退出全屏：原生最小化/最大化按钮和菜单栏一起隐藏，退出后恢复。",
				checked: settings.titlebarToggle,
				onChange: (checked) => { updateSettings({ titlebarToggle: checked }); },
			});
		}

		/** Terminal clipboard preference row. */
		function TerminalClipboardRow() {
			const settings = useSettingsState();
			return h(ToggleRow, {
				title: "终端 Ctrl+C/V 智能复制粘贴",
				hint: "仅在自带终端内生效：选中文本时 Ctrl+C 复制，无选区时 Ctrl+C 仍发送 SIGINT；Ctrl+V 粘贴而不是输入 ^V。",
				checked: settings.terminalClipboard,
				onChange: (checked) => { updateSettings({ terminalClipboard: checked }); },
			});
		}
		//#endregion

		//#region css
		const CSS = `
html[data-dsh-titlebar-hidden] [data-windows-menu] {
	display: none !important;
}
html[data-dsh-titlebar-hidden] [data-shell-leading] {
	display: none !important;
}
html[data-dsh-titlebar-hidden] button[aria-label="后退"],
html[data-dsh-titlebar-hidden] button[aria-label="前进"],
html[data-dsh-titlebar-hidden] button[aria-label="Back"],
html[data-dsh-titlebar-hidden] button[aria-label="Forward"] {
	display: none !important;
}
/* General-settings switch: mirrors the DSH primitives Switch (36x20 track). */
.dsh-desktop-tweaks-switch {
	box-sizing: border-box;
	position: relative;
	flex: 0 0 auto;
	width: 36px;
	height: 20px;
	padding: 2px;
	border: 0;
	border-radius: 999px;
	background: var(--dsw-alias-border-l3);
	cursor: pointer;
}
.dsh-desktop-tweaks-switch[aria-checked="true"] {
	background: var(--dsw-alias-brand-primary);
}
.dsh-desktop-tweaks-switch:disabled {
	cursor: default;
	opacity: .5;
}
.dsh-desktop-tweaks-switch:focus-visible {
	outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
	outline-offset: 2px;
}
.dsh-desktop-tweaks-thumb {
	display: block;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: var(--dsw-alias-label-primary-foreground);
	transition: transform .12s ease;
}
.dsh-desktop-tweaks-switch[aria-checked="false"] .dsh-desktop-tweaks-thumb {
	background: var(--dsw-alias-switch-thumb);
}
.dsh-desktop-tweaks-switch[aria-checked="true"] .dsh-desktop-tweaks-thumb {
	transform: translate(16px);
}
`;
		//#endregion

		//#region apply
		/**
		 * Client plugin body: inject the chrome stylesheet, wire the F11 handler
		 * (titlebar strip or fullscreen), the terminal clipboard handler, and the
		 * settings page.
		 * @param ctx - client context carrying the slots service.
		 */
		function apply(ctx) {
			const cleanups = [];
			const style = document.createElement("style");
			style.setAttribute("data-dsh-desktop-tweaks", "");
			style.textContent = CSS;
			document.head.appendChild(style);
			cleanups.push(() => { style.remove(); });

			document.addEventListener("keydown", onTitlebarKey, true);
			cleanups.push(() => { document.removeEventListener("keydown", onTitlebarKey, true); });
			document.addEventListener("keydown", onTerminalKey, true);
			cleanups.push(() => { document.removeEventListener("keydown", onTerminalKey, true); });
			document.addEventListener("fullscreenchange", onFullscreenChange);
			cleanups.push(() => { document.removeEventListener("fullscreenchange", onFullscreenChange); });
			cleanups.push(() => { listeners.clear(); });

			const slots = ctx.get("slots");
			if (slots !== undefined && typeof slots.inject === "function" && typeof slots.register === "function") {
				cleanups.push(slots.inject("settings.general.item", () => slots.register({
					name: "settings.general.item",
					id: "desktop-tweaks-fullscreen",
					order: 90,
				}, FullscreenRow)));
				cleanups.push(slots.inject("settings.general.item", () => slots.register({
					name: "settings.general.item",
					id: "desktop-tweaks-terminal",
					order: 21,
				}, TerminalClipboardRow)));
			}
			ctx.effect(() => () => {
				for (const cleanup of cleanups) {
					try {
						cleanup();
					} catch (error) {
						console.warn("[desktop-tweaks] cleanup failed:", error);
					}
				}
			}, "dsh-desktop-tweaks: teardown");
		}
		//#endregion

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});
