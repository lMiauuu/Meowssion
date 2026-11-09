/**
 * @name Meowssion
 * @author Miau
 * @version 1.1.0
 * @description Criado Por Miau
 * @license GPL-3.0
 * @source https://github.com/lMiauuu/Meowssion
 */

/*
 * Copyright (C) 2026 Miau (lMiauuu)
 *
 * Meowssion - Discord Quests Automation & Management Plugin for BetterDiscord.
 * Architecture, UI/UX, visual themes, internationalization (i18n), and auto-enrollment
 * designed and implemented by Miau (lMiauuu).
 *
 * Internal Discord Store spoofing logic & simulation mechanisms reference:
 * - @aamiaa (Gist: 204cd9d42013ded9faf646fae7f89fbb)
 * Licensed under the GNU General Public License v3.0 (GPL-3.0).
 */


module.exports = class Meowssion {
    constructor() {
        this.pluginName = "Meowssion";
        this.activeModal = null;
        this.activeTab = "quests";
        this.questsSubTab = "pending";
        this.questsSelectedIds = new Set();
        this.isQuestsRunning = false;
        this.shouldStopQuests = false;
        this.runningQuestId = null;
        this.autoQuestsTimer = null;
        this.searchFilter = "";
        this.shopQuantity = 1;
        this._headerObserver = null;
        this._channelChangeListener = null;
        this._questsHeartbeatListener = null;
        this._modalEscListener = null;

        this.defaultSettings = {
            theme: "midnight",
            language: "en",
            autoQuests: false,
            autoQuestsInterval: 10 * 60 * 1000,
            customOrbBalance: null
        };
        this.settings = Object.assign({}, this.defaultSettings);
    }

    start() {
        this.loadSettings();
        this.initStores();
        this.injectStyles();
        this.injectHeaderButton();
        this.setupHeaderObserver();
        this.setupChannelListener();

        if (this.settings.autoQuests) {
            this.startAutoQuestsTimer();
        }

        const msg = this.settings.language === "en" ? "Meowssion enabled!" : "Meowssion ativado!";
        this.notify(msg, "info");
    }

    stop() {
        this.stopAutoQuestsTimer();
        this.stopQuests();
        this.removeStyles();
        this.removeHeaderButton();
        this.removeListeners();
        this.closeModal();
    }

    initStores() {
        this.Dispatcher = BdApi.Webpack.getByKeys("dispatch", "subscribe") ||
            BdApi.Webpack.getModule(m => m?.dispatch && m?.subscribe, { searchExports: true }) ||
            BdApi.Webpack.getStore("FluxDispatcher");

        this.ChannelStore = BdApi.Webpack.getStore("ChannelStore") ||
            BdApi.Webpack.getByKeys("getChannel") ||
            BdApi.Webpack.getModule(m => m?.getChannel);

        this.GuildStore = BdApi.Webpack.getStore("GuildStore") ||
            BdApi.Webpack.getByKeys("getGuild") ||
            BdApi.Webpack.getModule(m => m?.getGuilds);

        this.SelectedChannelStore = BdApi.Webpack.getStore("SelectedChannelStore") ||
            BdApi.Webpack.getByKeys("getChannelId", "getVoiceChannelId") ||
            BdApi.Webpack.getModule(m => m?.getChannelId && m?.getVoiceChannelId);

        this.QuestsStore = BdApi.Webpack.getStore("QuestsStore") ||
            BdApi.Webpack.getStore("QuestStore") ||
            BdApi.Webpack.Stores?.QuestStore ||
            BdApi.Webpack.Stores?.QuestsStore ||
            BdApi.Webpack.getModule(m => m?.quests instanceof Map || (m?.getQuest && m?.getQuests), { searchExports: true });

        this.RunningGameStore = BdApi.Webpack.getStore("RunningGameStore") ||
            BdApi.Webpack.Stores?.RunningGameStore ||
            BdApi.Webpack.getModule(m => m?.getRunningGames && m?.getGameForPID, { searchExports: true });

        this.ApplicationStreamingStore = BdApi.Webpack.getStore("ApplicationStreamingStore") ||
            BdApi.Webpack.Stores?.ApplicationStreamingStore ||
            BdApi.Webpack.getModule(m => m?.getStreamerActiveStreamMetadata, { searchExports: true });

        this.DiscordAPI = BdApi.Webpack.getModule(m => m?.Bo?.get)?.Bo ||
            BdApi.Webpack.getModule(m => m?.get && m?.post && m?.put && m?.delete, { searchExports: true });
    }

    loadSettings() {
        try {
            if (typeof BdApi !== "undefined" && BdApi.Data?.load) {
                const saved = BdApi.Data.load(this.pluginName, "settings");
                if (saved && typeof saved === "object") {
                    this.settings = Object.assign({}, this.defaultSettings, saved);
                    if (!this.settings.language || (this.settings.language !== "en" && this.settings.language !== "pt")) {
                        this.settings.language = "en";
                    }
                    return;
                }
            }
        } catch (e) { }

        try {
            const fs = require("fs");
            const path = require("path");
            const baseFolder = (typeof BdApi !== "undefined" && BdApi.Plugins?.folder) ||
                (process.env.APPDATA ? path.join(process.env.APPDATA, "BetterDiscord", "plugins") : __dirname);
            const configFile = path.join(baseFolder, "Meowssion.config.json");
            if (fs.existsSync(configFile)) {
                const data = JSON.parse(fs.readFileSync(configFile, "utf8"));
                if (data?.settings) {
                    this.settings = Object.assign({}, this.defaultSettings, data.settings);
                }
            }
        } catch (e) { }
    }

    saveSettings() {
        try {
            if (typeof BdApi !== "undefined" && BdApi.Data?.save) {
                BdApi.Data.save(this.pluginName, "settings", this.settings);
            }
        } catch (e) { }

        try {
            const fs = require("fs");
            const path = require("path");
            const baseFolder = (typeof BdApi !== "undefined" && BdApi.Plugins?.folder) ||
                (process.env.APPDATA ? path.join(process.env.APPDATA, "BetterDiscord", "plugins") : __dirname);
            const configFile = path.join(baseFolder, "Meowssion.config.json");
            let current = {};
            if (fs.existsSync(configFile)) {
                try { current = JSON.parse(fs.readFileSync(configFile, "utf8")); } catch (e) { }
            }
            current.settings = this.settings;
            fs.writeFileSync(configFile, JSON.stringify(current, null, 2), "utf8");
        } catch (e) { }
    }

    notify(message, type = "info", options = {}) {
        if (!message) return;
        const opts = Object.keys(options).length > 0 ? Object.assign({ type }, options) : { type };
        if (BdApi.UI?.showToast) {
            BdApi.UI.showToast(message, opts);
        } else if (BdApi.showToast) {
            BdApi.showToast(message, opts);
        }
    }

    escapeHTML(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    t(key, vars = {}) {
        const lang = (this.settings.language === "en") ? "en" : "pt";
        const dict = Meowssion.TRANSLATIONS?.[lang] || Meowssion.TRANSLATIONS?.pt || {};
        let text = dict[key] ?? Meowssion.TRANSLATIONS?.pt?.[key] ?? key;
        if (vars && typeof vars === "object") {
            for (const k of Object.keys(vars)) {
                text = text.replace(new RegExp(`\\{${k}\\}`, "g"), vars[k]);
            }
        }
        return text;
    }

    injectHeaderButton() {
        try {
            if (document.getElementById("meowssion-toolbar-btn")) return;

            const toolbar = document.querySelector('section[class*="container_"] [class*="toolbar_"], [class*="toolbar_"], [class*="upperContainer_"] [class*="toolbar_"]');
            if (!toolbar) return;

            const button = document.createElement("div");
            button.id = "meowssion-toolbar-btn";
            button.className = "meowssion-toolbar-btn";
            button.setAttribute("role", "button");
            button.setAttribute("aria-label", "Meowssion");
            button.setAttribute("tabindex", "0");
            button.title = this.t("header.tooltip_idle");

            button.innerHTML = `
                <svg class="meowssion-toolbar-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 3v10a8 8 0 1 1-16 0V3l3.432 3.432a7.963 7.963 0 0 1 4.568-1.432c1.669 0 3.217.51 4.491 1.382L20 3z"></path>
                    <path d="M9 12h.01"></path>
                    <path d="M15 12h.01"></path>
                    <path d="M11.5 14.5h1"></path>
                </svg>
            `;

            button.addEventListener("click", (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.openModal();
            });

            const purrgeBtn = toolbar.querySelector("#purrge-toolbar-btn");
            const searchBar = toolbar.querySelector('[class*="search_"], [role="search"]');

            if (purrgeBtn && purrgeBtn.nextSibling) {
                toolbar.insertBefore(button, purrgeBtn.nextSibling);
            } else if (searchBar && searchBar.parentElement === toolbar) {
                toolbar.insertBefore(button, searchBar);
            } else {
                toolbar.appendChild(button);
            }

            this.updateHeaderButtonState();
        } catch (e) {
            console.error("[Meowssion] Erro ao injetar botão no header:", e);
        }
    }

    updateHeaderButtonState() {
        const btn = document.getElementById("meowssion-toolbar-btn");
        if (!btn) return;

        if (this.isQuestsRunning) {
            btn.classList.add("meowssion-working");
            btn.title = this.t("header.tooltip_running");
        } else {
            btn.classList.remove("meowssion-working");
            btn.title = this.t("header.tooltip_idle");
        }
    }

    removeHeaderButton() {
        document.getElementById("meowssion-toolbar-btn")?.remove();
    }

    setupHeaderObserver() {
        try {
            this._headerObserver?.disconnect();
            this._headerObserver = new MutationObserver(() => {
                if (!document.getElementById("meowssion-toolbar-btn")) {
                    this.injectHeaderButton();
                }
            });
            const appMount = document.getElementById("app-mount");
            if (appMount) {
                this._headerObserver.observe(appMount, { childList: true, subtree: true });
            }
        } catch (e) { }
    }

    setupChannelListener() {
        try {
            if (this.SelectedChannelStore?.addChangeListener) {
                this._channelChangeListener = () => {
                    this.updateHeaderButtonState();
                };
                this.SelectedChannelStore.addChangeListener(this._channelChangeListener);
            }
        } catch (e) { }
    }

    removeListeners() {
        try {
            this._headerObserver?.disconnect();
            this._headerObserver = null;
        } catch (e) { }

        try {
            if (this._channelChangeListener && this.SelectedChannelStore?.removeChangeListener) {
                this.SelectedChannelStore.removeChangeListener(this._channelChangeListener);
                this._channelChangeListener = null;
            }
        } catch (e) { }
    }

    openModal() {
        this.closeModal();

        const backdrop = document.createElement("div");
        backdrop.id = "meowssion-modal-backdrop";
        backdrop.className = "msg-modal-backdrop";

        backdrop.innerHTML = `
            <div class="msg-modal-root" role="dialog" aria-modal="true" data-theme="${this.settings.theme || 'midnight'}">
                <div class="msg-modal-top">
                    <div class="msg-search-box">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" id="meowssion-filter-input" placeholder="${this.t('top.search_placeholder')}" value="${this.escapeHTML(this.searchFilter)}" />
                        ${this.searchFilter ? `<button class="msg-clear-search-btn" id="meowssion-clear-search" title="${this.t('top.clear_search')}">&times;</button>` : ""}
                    </div>
                    <div class="msg-top-actions">
                        <button class="msg-icon-btn" id="meowssion-btn-lang" title="${this.t('top.lang_title')}">
                            <span style="font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">${this.settings.language === 'en' ? 'EN' : 'PT'}</span>
                        </button>
                        <button class="msg-icon-btn" id="meowssion-btn-theme" title="${this.t('top.theme_title')}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="5"></circle>
                                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
                            </svg>
                        </button>
                        <button class="msg-icon-btn" id="meowssion-btn-refresh-top" title="${this.t('top.refresh_title')}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                        </button>
                        <button class="msg-icon-btn" id="meowssion-btn-close" title="${this.t('top.close')}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="msg-tabs-bar">
                    <button class="msg-tab-btn ${this.activeTab === 'quests' ? 'active' : ''}" data-tab="quests">
                        ${this.t("tabs.quests")} <span class="msg-tab-count">${this.getActiveQuestsCount()}</span>
                    </button>
                    <button class="msg-tab-btn ${this.activeTab === 'shop' ? 'active' : ''}" data-tab="shop">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: -2px;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v12M8 10l4-4 4 4"></path>
                        </svg>
                        ${this.t("tabs.orbs_shop")}
                    </button>
                </div>

                <div class="msg-modal-body" id="meowssion-tab-content"></div>
            </div>
        `;

        document.body.appendChild(backdrop);
        this.activeModal = backdrop;

        const modalRoot = backdrop.querySelector(".msg-modal-root");
        const content = backdrop.querySelector("#meowssion-tab-content");
        const searchInput = backdrop.querySelector("#meowssion-filter-input");
        const clearSearch = backdrop.querySelector("#meowssion-clear-search");
        const langBtn = backdrop.querySelector("#meowssion-btn-lang");
        const themeBtn = backdrop.querySelector("#meowssion-btn-theme");
        const refreshTopBtn = backdrop.querySelector("#meowssion-btn-refresh-top");
        const closeBtn = backdrop.querySelector("#meowssion-btn-close");

        const tabBtns = backdrop.querySelectorAll(".msg-tabs-bar .msg-tab-btn");
        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const tab = btn.getAttribute("data-tab");
                if (tab && tab !== this.activeTab) {
                    this.activeTab = tab;
                    tabBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === this.activeTab));
                    this.renderCurrentTab(content);
                }
            });
        });

        this.renderCurrentTab(content);

        searchInput?.addEventListener("input", (e) => {
            this.searchFilter = e.target.value.trim();
            if (this.activeTab === "quests") {
                this.renderQuestsTab(content);
            }
            const searchBox = searchInput.parentElement;
            let clearBtn = searchBox.querySelector("#meowssion-clear-search");
            if (this.searchFilter) {
                if (!clearBtn) {
                    clearBtn = document.createElement("button");
                    clearBtn.className = "msg-clear-search-btn";
                    clearBtn.id = "meowssion-clear-search";
                    clearBtn.title = this.t("top.clear_search");
                    clearBtn.innerHTML = "&times;";
                    clearBtn.addEventListener("click", () => {
                        searchInput.value = "";
                        this.searchFilter = "";
                        clearBtn.remove();
                        if (this.activeTab === "quests") {
                            this.renderQuestsTab(content);
                        }
                    });
                    searchBox.appendChild(clearBtn);
                }
            } else if (clearBtn) {
                clearBtn.remove();
            }
        });

        clearSearch?.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            this.searchFilter = "";
            clearSearch.remove();
            if (this.activeTab === "quests") {
                this.renderQuestsTab(content);
            }
        });

        langBtn?.addEventListener("click", () => {
            this.settings.language = (this.settings.language === "en") ? "pt" : "en";
            this.saveSettings();
            const langLabel = (this.settings.language === "en") ? "English (US)" : "Português (BR)";
            this.notify(this.t("lang.switched", { lang: langLabel }), "info");
            this.openModal();
        });

        themeBtn?.addEventListener("click", () => {
            const themes = ["midnight", "dark", "glass", "discord"];
            const curIdx = themes.indexOf(this.settings.theme || "midnight");
            const nextTheme = themes[(curIdx + 1) % themes.length];
            this.settings.theme = nextTheme;
            this.saveSettings();
            modalRoot?.setAttribute("data-theme", nextTheme);
            this.notify(this.t("theme.switched", { theme: nextTheme.toUpperCase() }), "info");
        });

        refreshTopBtn?.addEventListener("click", () => {
            this.initStores();
            this.renderCurrentTab(content);
            this.updateTabCounters();
            this.notify(this.t("quests.toast_refreshed"), "info");
        });

        closeBtn?.addEventListener("click", () => this.closeModal());

        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) {
                this.closeModal();
            }
        });

        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                this.closeModal();
                window.removeEventListener("keydown", onKeyDown);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        this._modalEscListener = onKeyDown;
    }

    closeModal() {
        if (this._modalEscListener) {
            window.removeEventListener("keydown", this._modalEscListener);
            this._modalEscListener = null;
        }
        const backdrop = document.getElementById("meowssion-modal-backdrop");
        if (backdrop) {
            backdrop.remove();
        }
        this.activeModal = null;
    }

    updateTabCounters() {
        if (!this.activeModal) return;
        const countEl = this.activeModal.querySelector('.msg-tabs-bar .msg-tab-btn[data-tab="quests"] .msg-tab-count');
        if (countEl) {
            countEl.innerText = this.getActiveQuestsCount();
        }
    }

    renderCurrentTab(container) {
        if (!container) return;
        if (this.activeTab === "shop") {
            this.renderShopTab(container);
        } else {
            this.renderQuestsTab(container);
        }
    }

    getToken() {
        try {
            const authStore = BdApi.Webpack.getStore("AuthenticationStore") || BdApi.Webpack.getByKeys(["getToken"]);
            if (authStore?.getToken) {
                const token = authStore.getToken();
                if (token) return token;
            }
        } catch (e) { }

        try {
            let extracted = null;
            if (window.webpackChunkdiscord_app) {
                window.webpackChunkdiscord_app.push([
                    [Math.random()],
                    {},
                    (req) => {
                        for (const id in req.c) {
                            const mod = req.c[id]?.exports;
                            if (mod?.default?.getToken) {
                                extracted = mod.default.getToken();
                                if (extracted) break;
                            } else if (mod?.getToken) {
                                extracted = mod.getToken();
                                if (extracted) break;
                            }
                        }
                    }
                ]);
            }
            if (extracted) return extracted;
        } catch (e) { }

        return null;
    }

    getAllQuests() {
        try {
            if (!this.QuestsStore) {
                this.initStores();
            }
            const store = this.QuestsStore;
            if (!store) return [];

            const questsMap = store.quests;
            if (questsMap instanceof Map) {
                return Array.from(questsMap.values());
            }
            if (typeof store.getQuests === "function") {
                const list = store.getQuests();
                if (Array.isArray(list)) return list;
                if (list instanceof Map) return Array.from(list.values());
                if (typeof list === "object" && list !== null) return Object.values(list);
            }
            if (Array.isArray(store._quests)) return store._quests;
            if (store._quests instanceof Map) return Array.from(store._quests.values());
            if (typeof store.quests === "object" && store.quests !== null) {
                return Object.values(store.quests);
            }
        } catch (e) {
            console.error("[Meowssion] Erro ao obter lista do QuestsStore:", e);
        }
        return [];
    }

    getAvailableQuests() {
        const all = this.getAllQuests();
        const now = Date.now();
        return all.filter(q => {
            if (!q || !q.id || !q.config) return false;
            const exp = new Date(q.config.expiresAt).getTime();
            if (!Number.isFinite(exp) || exp <= now) return false;
            const st = this.getQuestStatus(q);
            if (st.isCompleted) return true;
            return this.isQuestAutomatable(q);
        });
    }

    getActiveQuestsCount() {
        const quests = this.getAvailableQuests();
        return quests.filter(q => {
            const st = this.getQuestStatus(q);
            return !st.isCompleted;
        }).length;
    }

    getQuestApplicationId(quest) {
        const tasks = quest?.config?.taskConfigV2?.tasks ?? {};
        for (const task of Object.values(tasks)) {
            const id = task?.applications?.[0]?.id;
            if (id) return id;
        }
        return quest?.config?.application?.id ?? null;
    }

    getQuestName(quest) {
        return quest?.config?.messages?.questName ?? quest?.config?.messages?.gameTitle ?? (this.settings.language === "en" ? "Quest" : "Missão");
    }

    getQuestPublisher(quest) {
        return quest?.config?.messages?.gamePublisher ?? "";
    }

    getQuestRewards(quest) {
        return quest?.config?.rewardsConfig?.rewards ?? [];
    }

    getRewardText(quest) {
        const parts = this.getQuestRewards(quest).map(reward => {
            if (typeof reward?.orbQuantity === "number" && reward.orbQuantity > 0) {
                return reward.premiumOrbQuantity && reward.premiumOrbQuantity !== reward.orbQuantity
                    ? `${reward.orbQuantity} Orbes (${reward.premiumOrbQuantity} com Nitro)`
                    : `${reward.orbQuantity} Orbes`;
            }
            return reward?.messages?.name;
        }).filter(Boolean);
        return parts.length ? parts.join(", ") : "Recompensa não especificada";
    }

    getQuestTaskInfo(quest) {
        const tasks = quest?.config?.taskConfigV2?.tasks ?? {};
        const labels = {
            WATCH_VIDEO: "Assistir Vídeo",
            WATCH_VIDEO_ON_MOBILE: "Assistir Vídeo (Mobile)",
            PLAY_ON_DESKTOP: "Jogar no PC",
            STREAM_ON_DESKTOP: "Transmitir no PC",
            PLAY_ACTIVITY: "Jogar Atividade",
            ACHIEVEMENT_IN_ACTIVITY: "Conquista",
            PLAY_ON_PLAYSTATION: "PlayStation",
            PLAY_ON_XBOX: "Xbox"
        };
        const taskName = Object.keys(labels).find(x => tasks[x] != null) || Object.keys(tasks)[0];
        if (!taskName) return { taskName: "UNKNOWN", label: "Tarefa Desconhecida", seconds: 0, formattedDuration: "" };
        const seconds = tasks[taskName]?.target ?? 0;
        const formattedDuration = seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds} seg`;
        return {
            taskName,
            label: labels[taskName] || taskName,
            seconds,
            formattedDuration
        };
    }

    getQuestStatus(quest) {
        const taskInfo = this.getQuestTaskInfo(quest);
        const target = taskInfo.seconds;
        const current = quest?.userStatus?.progress?.[taskInfo.taskName]?.value ?? quest?.userStatus?.streamProgressSeconds ?? 0;
        const isCompleted = !!quest?.userStatus?.completedAt || (target > 0 && current >= target);
        const isClaimed = !!quest?.userStatus?.claimedAt;
        const isEnrolled = !!quest?.userStatus?.enrolledAt;
        const percent = target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : (isCompleted ? 100 : 0);

        return {
            taskName: taskInfo.taskName,
            taskLabel: taskInfo.label,
            target,
            current,
            percent,
            isCompleted,
            isClaimed,
            isEnrolled
        };
    }

    getQuestIconUrl(quest) {
        const assets = quest?.config?.assets ?? {};
        const file = assets.gameTileLight || assets.gameTileDark || assets.logotypeLight;
        if (!file) return null;
        return `https://cdn.discordapp.com/${file}`;
    }

    formatRelativeTime(dateStr) {
        if (!dateStr) return null;
        const ms = new Date(dateStr).getTime() - Date.now();
        if (!Number.isFinite(ms) || ms <= 0) return this.t("time.expired");
        const minutes = Math.floor(ms / 60000);
        const days = Math.floor(minutes / 1440);
        const hours = Math.floor((minutes % 1440) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    }

    formatDuration(sec) {
        if (!sec || isNaN(sec) || sec <= 0) return "0s";
        const s = Math.floor(sec);
        const m = Math.floor(s / 60);
        const remS = s % 60;
        if (m > 0) {
            return `${m}m ${remS}s`;
        }
        return `${s}s`;
    }

    async callDiscordAPI(method, endpoint, body = null) {
        const url = endpoint.startsWith("http") ? endpoint : `https://discord.com/api/v9${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
        const token = this.getToken();

        try {
            if (this.DiscordAPI) {
                const cleanEndpoint = endpoint.startsWith("/api/v9")
                    ? endpoint.slice(7)
                    : (endpoint.startsWith("http") ? new URL(endpoint).pathname.replace("/api/v9", "") : endpoint);
                if (method.toUpperCase() === "GET" && typeof this.DiscordAPI.get === "function") {
                    const res = await this.DiscordAPI.get({ url: cleanEndpoint });
                    if (res?.body) return res.body;
                } else if (method.toUpperCase() === "POST" && typeof this.DiscordAPI.post === "function") {
                    const res = await this.DiscordAPI.post({ url: cleanEndpoint, body: body || {} });
                    if (res?.body) return res.body;
                }
            }
        } catch (e1) { }

        try {
            if (typeof BdApi !== "undefined" && BdApi.Net?.fetch) {
                const opts = {
                    method: method.toUpperCase(),
                    headers: {
                        "Authorization": token,
                        "Content-Type": "application/json"
                    }
                };
                if (body && method.toUpperCase() !== "GET") {
                    opts.body = JSON.stringify(body);
                }
                const netRes = await BdApi.Net.fetch(url, opts);
                if (netRes && (netRes.ok || netRes.status < 400)) {
                    try {
                        return await netRes.json();
                    } catch (ej) {
                        return { ok: true };
                    }
                }
            }
        } catch (e2) { }

        try {
            const opts = {
                method: method.toUpperCase(),
                headers: {
                    "Authorization": token,
                    "Content-Type": "application/json"
                }
            };
            if (body && method.toUpperCase() !== "GET") {
                opts.body = JSON.stringify(body);
            }
            const res = await fetch(url, opts);
            if (res.ok) {
                try {
                    return await res.json();
                } catch (ej) {
                    return { ok: true };
                }
            }
        } catch (e3) { }

        return null;
    }

    async enrollQuest(questId) {
        if (!questId) return false;
        try {
            const body = { location: 11, is_targeted: false, metadata_raw: null };
            const res = await this.callDiscordAPI("POST", `/quests/${questId}/enroll`, body);
            return !!res;
        } catch (e) {
            console.error(`[Meowssion] Falha ao aceitar missão ${questId}:`, e);
            return false;
        }
    }

    isQuestAutomatable(quest) {
        if (!quest) return false;
        const taskInfo = this.getQuestTaskInfo(quest);
        const automatableTasks = ["WATCH_VIDEO", "WATCH_VIDEO_ON_MOBILE", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY"];
        return automatableTasks.includes(taskInfo.taskName);
    }

    startAutoQuestsTimer() {
        this.stopAutoQuestsTimer();
        const interval = this.settings.autoQuestsInterval || (10 * 60 * 1000);
        this.autoQuestsTimer = setInterval(() => {
            if (this.settings.autoQuests) {
                this.checkAndRunAutoQuests(false);
            }
        }, interval);
    }

    stopAutoQuestsTimer() {
        if (this.autoQuestsTimer) {
            clearInterval(this.autoQuestsTimer);
            this.autoQuestsTimer = null;
        }
    }

    async checkAndRunAutoQuests(isImmediate = false) {
        if (!this.settings.autoQuests) return;
        if (this.isQuestsRunning) return;

        try {
            if (!this.QuestsStore) {
                this.initStores();
            }
            const available = this.getAvailableQuests();
            const automatablePending = available.filter(q => {
                const st = this.getQuestStatus(q);
                return !st.isCompleted && this.isQuestAutomatable(q);
            });

            if (automatablePending.length === 0) return;

            automatablePending.forEach(q => this.questsSelectedIds.add(q.id));

            this.startQuestsExecution();
        } catch (e) {
            console.error("[Meowssion] Erro no checkAndRunAutoQuests:", e);
        }
    }

    openDiscordPage(path = "/quest-home") {
        try {
            const link = document.querySelector(`a[href="${path}"]`) || document.querySelector(`a[href*="${path}"]`);
            if (link) {
                link.click();
                return;
            }
            const Router = BdApi.Webpack.getModule(m => m?.transitionTo && m?.replaceWith && m?.getHistory, { searchExports: true }) ||
                BdApi.Webpack.getModule(m => m?.transitionTo, { searchExports: true });
            if (Router?.transitionTo) {
                Router.transitionTo(path);
                return;
            }
            const HistoryModule = BdApi.Webpack.getModule(m => m?.getHistory || m?.history?.push, { searchExports: true });
            const history = HistoryModule?.getHistory?.() || HistoryModule?.history;
            if (history?.push) {
                history.push(path);
                return;
            }
            window.history.pushState({}, "", path);
            window.dispatchEvent(new PopStateEvent("popstate"));
        } catch (e) {
            console.error(`[Meowssion] Falha ao navegar para ${path}:`, e);
        }
    }

    openDiscordQuestsPage() {
        this.openDiscordPage("/quest-home");
    }

    getQuestsOrbSummary() {
        const all = this.getAllQuests();
        let earnedOrbs = 0;
        let pendingOrbs = 0;

        for (const q of all) {
            if (!q || !q.config) continue;
            const rewards = this.getQuestRewards(q);
            let questOrbs = 0;
            for (const r of rewards) {
                if (typeof r?.orbQuantity === "number" && r.orbQuantity > 0) {
                    questOrbs += r.orbQuantity;
                }
            }
            if (questOrbs === 0) continue;

            const st = this.getQuestStatus(q);
            if (st.isCompleted) {
                earnedOrbs += questOrbs;
            } else {
                const exp = new Date(q.config.expiresAt).getTime();
                if (!Number.isFinite(exp) || exp > Date.now()) {
                    pendingOrbs += questOrbs;
                }
            }
        }

        let storeOrbs = null;
        try {
            const vcStore = BdApi.Webpack.getStore("VirtualCurrencyStore") ||
                BdApi.Webpack.getStore("OrbsStore") ||
                BdApi.Webpack.getStore("UserVirtualCurrencyStore") ||
                BdApi.Webpack.getStore("UserProfileStore") ||
                BdApi.Webpack.getStore("EntitlementStore");

            if (vcStore) {
                if (typeof vcStore.getOrbBalance === "function") storeOrbs = vcStore.getOrbBalance();
                else if (typeof vcStore.getBalance === "function") storeOrbs = vcStore.getBalance();
                else if (typeof vcStore.getOrbs === "function") storeOrbs = vcStore.getOrbs();
                else if (typeof vcStore.getVirtualCurrencyBalance === "function") storeOrbs = vcStore.getVirtualCurrencyBalance();
            }
            if (storeOrbs == null) {
                const orbMod = BdApi.Webpack.getModule(m => m?.getOrbBalance || m?.getOrbs || m?.getUserOrbBalance || m?.getVirtualCurrencyBalance, { searchExports: true });
                if (orbMod?.getOrbBalance) storeOrbs = orbMod.getOrbBalance();
                else if (orbMod?.getOrbs) storeOrbs = orbMod.getOrbs();
                else if (orbMod?.getUserOrbBalance) storeOrbs = orbMod.getUserOrbBalance();
                else if (orbMod?.getVirtualCurrencyBalance) storeOrbs = orbMod.getVirtualCurrencyBalance();
            }
        } catch (e) { }

        const isCustom = typeof this.settings.customOrbBalance === "number" && !isNaN(this.settings.customOrbBalance);
        let currentBalance = earnedOrbs;
        if (isCustom) {
            currentBalance = Math.max(0, this.settings.customOrbBalance);
        } else if (typeof storeOrbs === "number" && !isNaN(storeOrbs) && storeOrbs >= 0) {
            currentBalance = storeOrbs;
        }

        return {
            earnedOrbs,
            pendingOrbs,
            currentBalance,
            storeOrbs,
            isCustom
        };
    }

    renderQuestsTab(container) {
        if (!container) return;
        if (!this.questsSubTab) this.questsSubTab = "pending";

        const orbSummary = this.getQuestsOrbSummary();
        const allQuests = this.getAvailableQuests();
        const pendingCount = allQuests.filter(q => !this.getQuestStatus(q).isCompleted).length;
        const completedCount = allQuests.filter(q => this.getQuestStatus(q).isCompleted).length;

        let displayedQuests = (this.questsSubTab === "completed")
            ? allQuests.filter(q => this.getQuestStatus(q).isCompleted)
            : allQuests.filter(q => !this.getQuestStatus(q).isCompleted);

        if (this.searchFilter) {
            const term = this.searchFilter.toLowerCase();
            displayedQuests = displayedQuests.filter(q => {
                const qName = this.getQuestName(q).toLowerCase();
                const publisher = this.getQuestPublisher(q).toLowerCase();
                return qName.includes(term) || publisher.includes(term);
            });
        }

        displayedQuests.sort((a, b) => {
            const aName = this.getQuestName(a).toLowerCase();
            const bName = this.getQuestName(b).toLowerCase();
            return aName.localeCompare(bName);
        });

        const selectedPendingCount = allQuests.filter(q => this.questsSelectedIds.has(q.id) && !this.getQuestStatus(q).isCompleted).length;

        let listHtml = "";
        if (allQuests.length === 0) {
            listHtml = `
                <div class="msg-empty-state" style="padding: 40px 20px;">
                    <div class="msg-empty-title" style="font-size: 15px; font-weight: 600; color: #f2f3f5;">${this.t("empty.no_quests")}</div>
                    <div class="msg-empty-sub" style="font-size: 12.5px; color: #949ba4; max-width: 440px; margin-top: 6px; line-height: 1.4;">
                        ${this.t("empty.no_quests_sub")}
                    </div>
                    <button class="mp-btn mp-btn-secondary" id="mp-btn-open-discord-quests" style="margin-top: 14px;">
                        ${this.t("empty.open_discord_quests")}
                    </button>
                </div>
            `;
        } else if (displayedQuests.length === 0) {
            const emptyMsg = (this.questsSubTab === "completed")
                ? this.t("empty.no_completed_quests")
                : this.t("empty.no_pending_quests");
            listHtml = `
                <div class="msg-empty-state" style="padding: 40px 20px;">
                    <div class="msg-empty-title" style="font-size: 15px; font-weight: 600; color: #f2f3f5;">${emptyMsg}</div>
                </div>
            `;
        } else {
            listHtml = displayedQuests.map(q => {
                const st = this.getQuestStatus(q);
                const taskInfo = this.getQuestTaskInfo(q);
                const qName = this.getQuestName(q);
                const publisher = this.getQuestPublisher(q);
                const rewardText = this.getRewardText(q);
                const expiresIn = this.formatRelativeTime(q.config?.expiresAt);
                const isRunning = this.isQuestsRunning && this.runningQuestId === q.id;
                const isSelected = this.questsSelectedIds.has(q.id);

                let statusBadgeHtml = "";
                if (st.isCompleted) {
                    statusBadgeHtml = `<span class="mp-quest-badge mp-badge-success mp-quest-status-badge">${this.t("quests.status_completed")}</span>`;
                } else if (isRunning) {
                    statusBadgeHtml = `<span class="mp-quest-badge mp-badge-running mp-quest-status-badge">${this.t("quests.status_running", { percent: st.percent })}</span>`;
                } else if (st.isEnrolled) {
                    statusBadgeHtml = `<span class="mp-quest-badge mp-badge-enrolled mp-quest-status-badge">${this.t("quests.status_enrolled")}</span>`;
                } else {
                    statusBadgeHtml = `<span class="mp-quest-badge mp-badge-idle mp-quest-status-badge">${this.t("quests.status_idle")}</span>`;
                }

                let progressLabelText = "";
                if (st.isCompleted) {
                    const durStr = st.target ? this.formatDuration(st.target) : "";
                    progressLabelText = durStr ? `${durStr} / ${durStr} • 100%` : "100%";
                } else {
                    progressLabelText = `${this.formatDuration(st.current)} / ${this.formatDuration(st.target)} • ${st.percent}%`;
                }

                const selectorHtml = (st.isCompleted || this.questsSubTab === "completed")
                    ? `<div class="mp-quest-done-check" title="${this.t('quests.already_completed_tooltip')}">
                         <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                           <polyline points="20 6 9 17 4 12"></polyline>
                         </svg>
                       </div>`
                    : `<label class="msg-chk-wrap" title="${this.t('quests.select_tooltip')}">
                         <input type="checkbox" class="mp-quest-chk" data-quest-id="${q.id}" ${isSelected ? 'checked' : ''} />
                         <span class="msg-chk-custom">
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                             <polyline points="20 6 9 17 4 12"></polyline>
                           </svg>
                         </span>
                       </label>`;

                return `
                    <div class="mp-quest-card ${st.isCompleted ? 'mp-quest-completed' : ''} ${isRunning ? 'mp-quest-running' : ''}" data-quest-id="${q.id}">
                        <div class="mp-quest-card-top">
                            ${selectorHtml}
                            <div class="mp-quest-title-wrap">
                                <span class="mp-quest-title">${this.escapeHTML(qName)}</span>
                                ${publisher ? `<span class="mp-quest-publisher">${this.escapeHTML(publisher)}</span>` : ''}
                            </div>
                            <div class="mp-quest-badges">
                                <span class="mp-quest-badge mp-badge-task">${this.escapeHTML(taskInfo.label)}</span>
                                ${expiresIn ? `<span class="mp-quest-badge mp-badge-expires">${this.t("quests.expires_in", { time: expiresIn })}</span>` : ''}
                                ${statusBadgeHtml}
                            </div>
                        </div>
                        <div class="mp-quest-card-sub">
                            <div class="mp-quest-reward">
                                <span>${this.t("quests.reward", { reward: this.escapeHTML(rewardText) })}</span>
                            </div>
                            <div class="mp-quest-progress-labels">
                                <span class="mp-quest-percent-text">${progressLabelText}</span>
                            </div>
                        </div>
                        <div class="mp-quest-progress-track">
                            <div class="mp-progress-fill" style="width: ${st.percent}%;"></div>
                        </div>
                    </div>
                `;
            }).join("");
        }

        let actionsHtml = "";
        if (this.questsSubTab === "completed") {
            actionsHtml = `
                <span class="mp-quest-completed-badge-note">${this.t("quests.completed_count", { count: completedCount })}</span>
                <button class="mp-btn mp-btn-secondary" id="mp-quest-btn-refresh" style="padding: 5px 9px; font-size: 12px;">${this.t("quests.refresh")}</button>
            `;
        } else {
            actionsHtml = `
                <label class="mp-quests-auto-toggle-wrap" title="${this.t('quests.auto_quest_desc')}">
                    <span class="mp-quests-auto-toggle-label">${this.t('quests.auto_quest_label')}</span>
                    <label class="msg-switch" title="${this.t('quests.auto_quest_desc')}">
                        <input type="checkbox" id="mp-toggle-auto-quest" ${this.settings.autoQuests ? 'checked' : ''} />
                        <span class="msg-switch-slider"></span>
                    </label>
                </label>
                <button class="mp-btn mp-btn-secondary" id="mp-quest-btn-select-all" style="padding: 5px 9px; font-size: 12px;">${this.t("quests.select_all")}</button>
                <button class="mp-btn mp-btn-secondary" id="mp-quest-btn-deselect-all" style="padding: 5px 9px; font-size: 12px;">${this.t("quests.deselect_all")}</button>
                <button class="mp-btn mp-btn-secondary" id="mp-quest-btn-refresh" style="padding: 5px 9px; font-size: 12px;">${this.t("quests.refresh")}</button>
                ${this.isQuestsRunning
                    ? `<button class="mp-btn mp-btn-danger" id="mp-quest-btn-stop" style="padding: 5px 12px; font-size: 12px;">${this.t("quests.stop_execution")}</button>`
                    : `<button class="mp-btn mp-btn-primary" id="mp-quest-btn-start" style="padding: 5px 12px; font-size: 12px;">${this.t("quests.start_selected", { count: selectedPendingCount })}</button>`}
            `;
        }

        container.innerHTML = `
            <div class="mp-quests-container">
                <div class="mp-quests-subtabs">
                    <button class="mp-subtab-pill ${this.questsSubTab === 'pending' ? 'active' : ''}" data-subtab="pending">
                        ${this.t("quests.subtab_pending")} (${pendingCount})
                    </button>
                    <button class="mp-subtab-pill ${this.questsSubTab === 'completed' ? 'active' : ''}" data-subtab="completed">
                        ${this.t("quests.subtab_completed")} (${completedCount})
                    </button>
                </div>

                <div class="mp-quests-toolbar">
                    <div class="mp-quests-toolbar-left">
                        <span class="mp-quests-toolbar-title">${this.t("quests.title")}</span>
                        <span class="mp-quests-count-tag">${this.t("quests.pending_count", { count: pendingCount })}</span>
                        <div class="mp-quests-orb-badges">
                            <span class="mp-orb-badge mp-orb-badge-earned" title="${this.t('orbs.earned_tooltip')}">
                                <span class="mp-orb-sparkle">✦</span>
                                <span class="mp-orb-val">${orbSummary.earnedOrbs.toLocaleString()}</span>
                                <span class="mp-orb-lbl">${this.t("orbs.earned_label")}</span>
                            </span>
                            <span class="mp-orb-badge mp-orb-badge-pending" title="${this.t('orbs.pending_tooltip')}">
                                <span class="mp-orb-sparkle">✦</span>
                                <span class="mp-orb-val">+${orbSummary.pendingOrbs.toLocaleString()}</span>
                                <span class="mp-orb-lbl">${this.t("orbs.pending_label")}</span>
                            </span>
                        </div>
                    </div>
                    <div class="mp-quests-toolbar-right">
                        ${actionsHtml}
                    </div>
                </div>

                <div class="mp-quests-list">
                    ${listHtml}
                </div>
            </div>
        `;

        this.bindQuestsEvents(container);
    }

    bindQuestsEvents(root) {
        if (!root) return;

        root.querySelectorAll(".mp-subtab-pill").forEach(pill => {
            pill.addEventListener("click", (e) => {
                const subtab = e.currentTarget.getAttribute("data-subtab");
                if (subtab && subtab !== this.questsSubTab) {
                    this.questsSubTab = subtab;
                    this.renderQuestsTab(root);
                }
            });
        });

        root.querySelector("#mp-toggle-auto-quest")?.addEventListener("change", (e) => {
            this.settings.autoQuests = !!e.target.checked;
            this.saveSettings();
            if (this.settings.autoQuests) {
                this.startAutoQuestsTimer();
                this.checkAndRunAutoQuests(true);
                this.notify(this.t("quests.auto_quest_enabled"), "info");
            } else {
                this.stopAutoQuestsTimer();
                this.notify(this.t("quests.auto_quest_disabled"), "info");
            }
        });

        root.querySelectorAll(".mp-quest-chk").forEach(chk => {
            chk.addEventListener("change", (e) => {
                const qId = e.target.getAttribute("data-quest-id");
                if (e.target.checked) {
                    this.questsSelectedIds.add(qId);
                } else {
                    this.questsSelectedIds.delete(qId);
                }
                const btnStart = root.querySelector("#mp-quest-btn-start");
                if (btnStart) {
                    const selCount = this.getAvailableQuests().filter(q => this.questsSelectedIds.has(q.id) && !this.getQuestStatus(q).isCompleted).length;
                    btnStart.innerText = this.t("quests.start_selected", { count: selCount });
                }
            });
        });

        root.querySelector("#mp-quest-btn-select-all")?.addEventListener("click", () => {
            const available = this.getAvailableQuests();
            available.forEach(q => {
                if (!this.getQuestStatus(q).isCompleted && this.isQuestAutomatable(q)) {
                    this.questsSelectedIds.add(q.id);
                }
            });
            root.querySelectorAll(".mp-quest-chk:not(:disabled)").forEach(chk => {
                const qId = chk.getAttribute("data-quest-id");
                const qObj = available.find(x => x.id === qId);
                if (qObj && this.isQuestAutomatable(qObj)) {
                    chk.checked = true;
                }
            });
            const btnStart = root.querySelector("#mp-quest-btn-start");
            if (btnStart) {
                const selCount = available.filter(q => this.questsSelectedIds.has(q.id) && !this.getQuestStatus(q).isCompleted).length;
                btnStart.innerText = this.t("quests.start_selected", { count: selCount });
            }
        });

        root.querySelector("#mp-quest-btn-deselect-all")?.addEventListener("click", () => {
            this.questsSelectedIds.clear();
            root.querySelectorAll(".mp-quest-chk:not(:disabled)").forEach(chk => {
                chk.checked = false;
            });
            const btnStart = root.querySelector("#mp-quest-btn-start");
            if (btnStart) {
                btnStart.innerText = this.t("quests.start_selected", { count: 0 });
            }
        });

        root.querySelector("#mp-quest-btn-refresh")?.addEventListener("click", () => {
            this.initStores();
            this.renderQuestsTab(root);
            this.updateTabCounters();
            this.notify(this.t("quests.toast_refreshed"), "info");
        });

        root.querySelector("#mp-quest-btn-start")?.addEventListener("click", () => {
            this.startQuestsExecution();
        });

        root.querySelector("#mp-quest-btn-stop")?.addEventListener("click", () => {
            this.stopQuestsExecution();
        });

        root.querySelector("#mp-btn-open-discord-quests")?.addEventListener("click", () => {
            this.openDiscordQuestsPage();
        });
    }

    renderShopTab(container) {
        if (!container) return;

        const orbSummary = this.getQuestsOrbSummary();
        const currentOrbs = orbSummary.currentBalance;
        const pendingOrbs = orbSummary.pendingOrbs;
        const earnedOrbs = orbSummary.earnedOrbs;

        const maxAffordable = Math.floor(currentOrbs / 1400);

        if (!this.shopQuantity || this.shopQuantity < 1) {
            this.shopQuantity = 1;
        }
        const qty = this.shopQuantity;
        const totalCost = qty * 1400;
        const totalDays = qty * 3;
        const remainingOrbs = currentOrbs - totalCost;
        const hasEnoughForOne = currentOrbs >= 1400;
        const hasEnoughForQty = remainingOrbs >= 0;
        const missingForOne = Math.max(0, 1400 - currentOrbs);
        const missingForQty = Math.max(0, totalCost - currentOrbs);

        const pendingQuestsWithOrbs = this.getAvailableQuests().filter(q => {
            const st = this.getQuestStatus(q);
            if (st.isCompleted) return false;
            const rewards = this.getQuestRewards(q);
            return rewards.some(r => typeof r?.orbQuantity === "number" && r.orbQuantity > 0);
        });

        let balanceSourceNote = "";
        if (orbSummary.isCustom) {
            balanceSourceNote = `<span class="mp-shop-sync-pill mp-sync-manual" title="${this.t('shop.balance_manual_tooltip')}">${this.t('shop.balance_manual_tag')}</span>`;
        } else if (orbSummary.storeOrbs != null) {
            balanceSourceNote = `<span class="mp-shop-sync-pill mp-sync-live" title="${this.t('shop.balance_live_tooltip')}">${this.t('shop.balance_live_tag')}</span>`;
        } else {
            balanceSourceNote = `<span class="mp-shop-sync-pill mp-sync-auto" title="${this.t('shop.balance_calc_tooltip')}">${this.t('shop.balance_calc_tag')}</span>`;
        }

        let deficitHtml = "";
        if (!hasEnoughForQty) {
            const missingCount = (!hasEnoughForOne && qty === 1) ? missingForOne : missingForQty;
            deficitHtml = `
                <div class="mp-shop-warning-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; color: #f0b232;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div class="mp-shop-warning-text">
                        ${this.t("shop.missing_orbs_help", {
                            missing: missingCount.toLocaleString(),
                            pending: pendingOrbs.toLocaleString(),
                            count: pendingQuestsWithOrbs.length
                        })}
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="mp-shop-container">
                <div class="mp-shop-header-card">
                    <div class="mp-shop-header-info">
                        <h2 class="mp-shop-title">
                            <span class="mp-shop-title-sparkle">✦</span>
                            ${this.t("shop.title")}
                        </h2>
                        <p class="mp-shop-subtitle">${this.t("shop.subtitle")}</p>
                    </div>
                    <div class="mp-shop-stats-grid">
                        <div class="mp-shop-stat-box">
                            <div class="mp-shop-stat-label">
                                <span>${this.t("shop.stat_current_balance")}</span>
                                ${balanceSourceNote}
                            </div>
                            <div class="mp-shop-stat-value mp-val-highlight">✦ ${currentOrbs.toLocaleString()}</div>
                        </div>
                        <div class="mp-shop-stat-box">
                            <div class="mp-shop-stat-label">${this.t("shop.stat_earned_total")}</div>
                            <div class="mp-shop-stat-value">✦ ${earnedOrbs.toLocaleString()}</div>
                        </div>
                        <div class="mp-shop-stat-box">
                            <div class="mp-shop-stat-label">${this.t("shop.stat_pending_total")}</div>
                            <div class="mp-shop-stat-value mp-val-green">✦ +${pendingOrbs.toLocaleString()}</div>
                        </div>
                        <div class="mp-shop-stat-box">
                            <div class="mp-shop-stat-label">${this.t("shop.stat_max_redeemable")}</div>
                            <div class="mp-shop-stat-value">${maxAffordable}x <span class="mp-stat-sub">(${maxAffordable * 3}d)</span></div>
                        </div>
                    </div>
                </div>

                <div class="mp-shop-card">
                    <div class="mp-shop-card-badge-row">
                        <span class="mp-shop-exclusive-tag">${this.t("shop.exclusive_tag")}</span>
                        <span class="mp-shop-cost-tag">✦ 1.400 Orbs = 3 ${this.t("shop.days")} Nitro</span>
                    </div>

                    <div class="mp-shop-item-row">
                        <div class="mp-shop-nitro-icon-wrap">
                            <svg class="mp-shop-nitro-svg" width="42" height="42" viewBox="0 0 24 24" fill="none">
                                <defs>
                                    <linearGradient id="nitro-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stop-color="#f47fff" />
                                        <stop offset="50%" stop-color="#5865f2" />
                                        <stop offset="100%" stop-color="#00ffff" />
                                    </linearGradient>
                                </defs>
                                <path d="M12 2L3 9l9 13 9-13-9-7z" fill="url(#nitro-grad)" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" />
                                <path d="M12 22V9" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" />
                                <path d="M3 9h18" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" />
                                <path d="M7.5 5.5l4.5 3.5 4.5-3.5" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" />
                            </svg>
                        </div>

                        <div class="mp-shop-item-details">
                            <h3 class="mp-shop-item-title">${this.t("shop.nitro_card_title")}</h3>
                            <p class="mp-shop-item-desc">${this.t("shop.nitro_card_desc")}</p>
                        </div>
                    </div>

                    <div class="mp-shop-simulator-wrap">
                        <div class="mp-shop-simulator-top">
                            <span class="mp-shop-sim-label">${this.t("shop.qty_selector_label")}</span>
                            <div class="mp-shop-qty-control">
                                <button class="mp-qty-btn mp-qty-minus" id="mp-shop-qty-dec" ${qty <= 1 ? 'disabled' : ''}>-</button>
                                <input type="number" id="mp-shop-qty-input" class="mp-qty-input" min="1" max="999" value="${qty}" />
                                <button class="mp-qty-btn mp-qty-plus" id="mp-shop-qty-inc">+</button>
                                <button class="mp-qty-btn mp-qty-max" id="mp-shop-qty-max" title="${this.t('shop.max_tooltip')}">MAX (${Math.max(1, maxAffordable)}x)</button>
                            </div>
                        </div>

                        <div class="mp-shop-calc-grid">
                            <div class="mp-shop-calc-item">
                                <span class="mp-calc-label">${this.t("shop.calc_selected")}</span>
                                <span class="mp-calc-val"><strong>${qty}x</strong> ( ${this.t("shop.nitro_days_added", { days: totalDays })} )</span>
                            </div>
                            <div class="mp-shop-calc-item">
                                <span class="mp-calc-label">${this.t("shop.total_cost")}</span>
                                <span class="mp-calc-val mp-cost-val">✦ ${totalCost.toLocaleString()} Orbs</span>
                            </div>
                            <div class="mp-shop-calc-item">
                                <span class="mp-calc-label">${this.t("shop.remaining_orbs")}</span>
                                <span class="mp-calc-val ${hasEnoughForQty ? 'mp-val-green' : 'mp-val-danger'}">
                                    ✦ ${remainingOrbs.toLocaleString()} Orbs
                                    ${!hasEnoughForQty ? `<small style="font-size:11px; margin-left: 4px;">(${this.t("shop.insufficient_label")})</small>` : ''}
                                </span>
                            </div>
                        </div>

                        ${deficitHtml}
                    </div>

                    <div class="mp-shop-actions-wrap">
                        <button class="mp-btn mp-btn-primary mp-shop-btn-redeem" id="mp-shop-btn-open-discord">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            ${this.t("shop.btn_open_discord_shop", { qty })}
                        </button>
                        <div class="mp-shop-security-notice">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#57f287" stroke-width="2" style="flex-shrink: 0; margin-top: 1px;">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            <span>${this.t("shop.security_notice")}</span>
                        </div>
                    </div>
                </div>

                <div class="mp-shop-sync-card">
                    <div class="mp-shop-sync-header">
                        <div>
                            <h4 class="mp-shop-sync-title">${this.t("shop.sync_balance_title")}</h4>
                            <p class="mp-shop-sync-desc">${this.t("shop.sync_balance_desc")}</p>
                        </div>
                    </div>

                    <div class="mp-shop-sync-controls">
                        <div class="mp-shop-sync-input-group">
                            <span class="mp-sync-input-prefix">✦</span>
                            <input type="number" id="mp-shop-sync-input" class="mp-sync-input" value="${currentOrbs}" placeholder="${this.t('shop.sync_balance_placeholder')}" min="0" />
                            <button class="mp-btn mp-btn-secondary" id="mp-shop-btn-save-sync">${this.t("shop.btn_save_balance")}</button>
                            <button class="mp-btn mp-btn-secondary" id="mp-shop-btn-reset-sync" title="${this.t('shop.btn_reset_balance_tooltip')}">${this.t("shop.btn_reset_balance")}</button>
                        </div>

                        <button class="mp-btn mp-btn-secondary mp-shop-btn-deduct" id="mp-shop-btn-deduct-ledger">
                            ${this.t("shop.btn_register_redeem", { cost: totalCost.toLocaleString() })}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.bindShopEvents(container);
    }

    bindShopEvents(root) {
        if (!root) return;

        const inputQty = root.querySelector("#mp-shop-qty-input");
        const btnDec = root.querySelector("#mp-shop-qty-dec");
        const btnInc = root.querySelector("#mp-shop-qty-inc");
        const btnMax = root.querySelector("#mp-shop-qty-max");

        const updateQty = (newVal) => {
            let v = parseInt(newVal, 10);
            if (isNaN(v) || v < 1) v = 1;
            if (v > 999) v = 999;
            this.shopQuantity = v;
            this.renderShopTab(root);
        };

        inputQty?.addEventListener("change", (e) => updateQty(e.target.value));
        btnDec?.addEventListener("click", () => updateQty((this.shopQuantity || 1) - 1));
        btnInc?.addEventListener("click", () => updateQty((this.shopQuantity || 1) + 1));
        btnMax?.addEventListener("click", () => {
            const orbSummary = this.getQuestsOrbSummary();
            const maxAffordable = Math.floor(orbSummary.currentBalance / 1400);
            updateQty(Math.max(1, maxAffordable));
        });

        root.querySelector("#mp-shop-btn-open-discord")?.addEventListener("click", () => {
            const qty = this.shopQuantity || 1;
            this.closeModal();
            this.openDiscordPage("/shop");
            this.notify(this.t("shop.toast_manual_guide", { qty }), "info", { timeout: 6000 });
        });

        root.querySelector("#mp-shop-btn-save-sync")?.addEventListener("click", () => {
            const syncVal = parseInt(root.querySelector("#mp-shop-sync-input")?.value, 10);
            if (!isNaN(syncVal) && syncVal >= 0) {
                this.settings.customOrbBalance = syncVal;
                this.saveSettings();
                this.notify(this.t("shop.toast_balance_saved", { balance: syncVal }), "success");
                this.renderShopTab(root);
            }
        });

        root.querySelector("#mp-shop-btn-reset-sync")?.addEventListener("click", () => {
            this.settings.customOrbBalance = null;
            this.saveSettings();
            const freshSummary = this.getQuestsOrbSummary();
            this.notify(this.t("shop.toast_balance_reset", { balance: freshSummary.currentBalance }), "info");
            this.renderShopTab(root);
        });

        root.querySelector("#mp-shop-btn-deduct-ledger")?.addEventListener("click", () => {
            const qty = this.shopQuantity || 1;
            const totalCost = qty * 1400;
            const orbSummary = this.getQuestsOrbSummary();
            const cur = orbSummary.currentBalance;

            if (cur < totalCost) {
                this.notify(this.t("shop.toast_insufficient_orbs"), "warning");
                return;
            }

            const newBal = cur - totalCost;
            this.settings.customOrbBalance = newBal;
            this.saveSettings();
            this.notify(this.t("shop.toast_redeem_registered", { qty, cost: totalCost, balance: newBal }), "success");
            this.renderShopTab(root);
        });
    }

    async startQuestsExecution() {
        if (this.isQuestsRunning) return;

        const available = this.getAvailableQuests();
        const selected = available.filter(q => this.questsSelectedIds.has(q.id));

        if (selected.length === 0) {
            this.notify(this.t("quests.toast_select_first"), "warning");
            return;
        }

        const pending = selected.filter(q => !this.getQuestStatus(q).isCompleted);
        if (pending.length === 0) {
            this.notify(this.t("quests.toast_all_done"), "info");
            return;
        }

        this.isQuestsRunning = true;
        this.shouldStopQuests = false;
        this.updateTabCounters();
        this.updateHeaderButtonState();

        const container = document.getElementById("meowssion-tab-content");
        if (container) {
            this.renderCurrentTab(container);
        }

        this.notify(this.t("quests.toast_starting", { count: pending.length }), "info");

        (async () => {
            try {
                for (let i = 0; i < pending.length; i++) {
                    if (this.shouldStopQuests) break;
                    const quest = pending[i];
                    this.runningQuestId = quest.id;
                    const questName = this.getQuestName(quest);
                    const taskInfo = this.getQuestTaskInfo(quest);

                    this.updateQuestCardProgress(quest.id, {
                        stage: "starting",
                        percent: 0,
                        secondsDone: 0,
                        secondsNeeded: taskInfo.seconds,
                        message: this.t("quests.progress_init", { current: i + 1, total: pending.length, name: questName })
                    });

                    if (!quest.userStatus?.enrolledAt) {
                        this.updateQuestCardProgress(quest.id, {
                            stage: "enrolling",
                            percent: 0,
                            secondsDone: 0,
                            secondsNeeded: taskInfo.seconds,
                            message: this.t("quests.progress_enrolling", { name: questName })
                        });
                        await this.enrollQuest(quest.id);
                        await new Promise(r => setTimeout(r, 600));
                    }
                    if (this.shouldStopQuests) break;

                    const taskName = taskInfo.taskName;

                    if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
                        await this.runWatchVideoQuest(quest, (status) => {
                            this.updateQuestCardProgress(quest.id, status);
                        });
                    } else if (taskName === "PLAY_ON_DESKTOP") {
                        await this.runPlayOnDesktopQuest(quest, (status) => {
                            this.updateQuestCardProgress(quest.id, status);
                        });
                    } else if (taskName === "STREAM_ON_DESKTOP") {
                        await this.runStreamOnDesktopQuest(quest, (status) => {
                            this.updateQuestCardProgress(quest.id, status);
                        });
                    } else if (taskName === "PLAY_ACTIVITY") {
                        await this.runPlayActivityQuest(quest, (status) => {
                            this.updateQuestCardProgress(quest.id, status);
                        });
                    }

                    if (!this.shouldStopQuests) {
                        const fresh = this.getAvailableQuests().find(q => q.id === quest.id) || quest;
                        const st = this.getQuestStatus(fresh);
                        if (st.isCompleted || st.percent >= 100) {
                            this.updateQuestCardProgress(quest.id, {
                                isCompleted: true,
                                percent: 100,
                                secondsDone: taskInfo.seconds,
                                secondsNeeded: taskInfo.seconds,
                                message: this.t("quests.status_completed")
                            });
                            this.questsSelectedIds.delete(quest.id);
                            this.updateTabCounters();

                            const curCont = document.getElementById("meowssion-tab-content");
                            if (curCont) {
                                this.renderCurrentTab(curCont);
                            }

                            this.notify(this.t("quests.toast_completed", { name: questName }), "success");
                        }
                    }
                }
            } catch (err) {
                console.error("[Meowssion] Erro durante o motor de missões:", err);
                this.notify(this.t("quests.toast_error", { error: err.message }), "error");
            } finally {
                this.cleanupQuestsSpoofs();
                this.isQuestsRunning = false;
                this.shouldStopQuests = false;
                this.runningQuestId = null;
                this.updateTabCounters();
                this.updateHeaderButtonState();

                const curContainer = document.getElementById("meowssion-tab-content");
                if (curContainer) {
                    this.renderCurrentTab(curContainer);
                }
                this.notify(this.t("quests.toast_execution_finished"), "info");
            }
        })();
    }

    stopQuestsExecution() {
        this.shouldStopQuests = true;
        this.cleanupQuestsSpoofs();
        this.isQuestsRunning = false;
        this.runningQuestId = null;
        this.updateTabCounters();
        this.updateHeaderButtonState();

        const container = document.getElementById("meowssion-tab-content");
        if (container) {
            this.renderCurrentTab(container);
        }
        this.notify(this.t("quests.toast_stopped"), "warning");
    }

    async runWatchVideoQuest(quest, statusUpdateCallback) {
        const taskInfo = this.getQuestTaskInfo(quest);
        const taskName = taskInfo.taskName;
        const secondsNeeded = taskInfo.seconds;
        let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;
        const speed = 7;
        let isFinished = false;

        const emitProgress = (sec) => {
            const cur = Math.min(secondsNeeded, Math.max(0, sec));
            const percent = Math.min(100, Math.floor((cur / secondsNeeded) * 100));
            statusUpdateCallback?.({
                stage: "running",
                taskName,
                secondsDone: cur,
                secondsNeeded,
                percent,
                message: `${this.t("quests.watching_video")}: ${this.formatDuration(cur)} / ${this.formatDuration(secondsNeeded)}`
            });
        };

        emitProgress(secondsDone);

        while (!this.shouldStopQuests && secondsDone < secondsNeeded) {
            const remain = Math.min(speed, secondsNeeded - secondsDone);

            for (let step = 0; step < remain; step++) {
                await new Promise(r => setTimeout(r, 1000));
                if (this.shouldStopQuests) break;
                emitProgress(Math.min(secondsNeeded, secondsDone + step + 1));
            }
            if (this.shouldStopQuests) break;

            const timestamp = secondsDone + remain;
            const sendTs = Math.min(secondsNeeded, timestamp + Math.random() * 0.5);
            try {
                const res = await this.callDiscordAPI("POST", `/quests/${quest.id}/video-progress`, { timestamp: sendTs });
                if (res?.completed_at) {
                    isFinished = true;
                    secondsDone = secondsNeeded;
                    emitProgress(secondsNeeded);
                    break;
                }
            } catch (e) { }

            secondsDone = Math.min(secondsNeeded, timestamp);
            emitProgress(secondsDone);
            if (secondsDone >= secondsNeeded) break;
        }

        if (!this.shouldStopQuests && !isFinished) {
            try {
                await this.callDiscordAPI("POST", `/quests/${quest.id}/video-progress`, { timestamp: secondsNeeded });
            } catch (e) { }
        }
        return secondsDone >= secondsNeeded;
    }

    async runPlayOnDesktopQuest(quest, statusUpdateCallback) {
        const appId = this.getQuestApplicationId(quest);
        const questName = this.getQuestName(quest);
        if (!appId) {
            this.notify(this.t("quests.toast_app_id_error", { name: questName }), "error");
            return false;
        }

        const taskInfo = this.getQuestTaskInfo(quest);
        const secondsNeeded = taskInfo.seconds || 900;
        let secondsDone = quest.userStatus?.progress?.PLAY_ON_DESKTOP?.value ?? 0;
        let authoritativeSeconds = secondsDone;
        let displaySeconds = secondsDone;

        const emitProgress = () => {
            const cur = Math.min(secondsNeeded, Math.max(0, displaySeconds));
            const percent = Math.min(100, Math.floor((cur / secondsNeeded) * 100));
            const remainSec = Math.max(0, secondsNeeded - cur);
            const remainMin = Math.ceil(remainSec / 60);
            statusUpdateCallback?.({
                stage: "running",
                taskName: "PLAY_ON_DESKTOP",
                secondsDone: cur,
                secondsNeeded,
                percent,
                message: `${this.t("quests.simulating_game")}: ${this.formatDuration(cur)} / ${this.formatDuration(secondsNeeded)} (~${remainMin} min)`
            });
        };

        statusUpdateCallback?.({
            stage: "preparing",
            secondsDone: displaySeconds,
            secondsNeeded,
            percent: Math.min(100, Math.floor((displaySeconds / secondsNeeded) * 100)),
            message: this.t("quests.getting_game_data")
        });

        let appData = null;
        try {
            const res = await this.callDiscordAPI("GET", `/applications/public?application_ids=${appId}`);
            if (Array.isArray(res) && res.length > 0) {
                appData = res[0];
            } else if (res?.body && Array.isArray(res.body)) {
                appData = res.body[0];
            }
        } catch (e) { }

        const appName = appData?.name || questName || "Game";
        const exeName = appData?.executables?.find(x => x.os === "win32")?.name?.replace(">", "") ?? appName.replace(/[\/\\:*?"<>|]/g, "");
        const pid = Math.floor(Math.random() * 30000) + 1000;

        const fakeGame = {
            cmdLine: `C:\\Program Files\\${appName}\\${exeName}`,
            exeName,
            exePath: `c:/program files/${appName.toLowerCase()}/${exeName}`,
            hidden: false,
            isLauncher: false,
            id: appId,
            name: appName,
            pid: pid,
            pidPath: [pid],
            processName: appName,
            start: Date.now(),
        };

        if (!this.RunningGameStore) this.initStores();
        const realGetRunningGames = this.RunningGameStore?.getRunningGames;
        const realGetGameForPID = this.RunningGameStore?.getGameForPID;
        const realGames = typeof realGetRunningGames === "function" ? realGetRunningGames.call(this.RunningGameStore) : [];
        const fakeGames = [fakeGame];

        this._questsOriginalGetRunningGames = realGetRunningGames;
        this._questsOriginalGetGameForPID = realGetGameForPID;
        this._questsActiveFakeGame = fakeGame;
        this._questsActiveRealGames = realGames;

        if (this.RunningGameStore) {
            this.RunningGameStore.getRunningGames = () => fakeGames;
            this.RunningGameStore.getGameForPID = (p) => fakeGames.find(x => x.pid === p);
        }

        if (this.Dispatcher) {
            try {
                this.Dispatcher.dispatch({
                    type: "RUNNING_GAMES_CHANGE",
                    removed: realGames,
                    added: fakeGames,
                    games: fakeGames
                });
            } catch (e) { }
        }

        const onHeartbeat = (data) => {
            if (!data) return;
            const eventQuestId = data.questId || data.quest_id || data.userStatus?.questId;
            if (eventQuestId && eventQuestId !== quest.id) return;

            let val = null;
            if (quest.config?.configVersion === 1) {
                val = data.userStatus?.streamProgressSeconds;
            } else if (data.userStatus?.progress?.PLAY_ON_DESKTOP?.value != null) {
                val = Math.floor(data.userStatus.progress.PLAY_ON_DESKTOP.value);
            }
            if (val != null && val > authoritativeSeconds) {
                authoritativeSeconds = val;
                if (val > displaySeconds) {
                    displaySeconds = val;
                }
                emitProgress();
            }
        };

        this._questsHeartbeatListener = onHeartbeat;
        try {
            this.Dispatcher?.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
        } catch (e) { }

        this.notify(this.t("quests.toast_simulating_game", { name: questName, minutes: Math.ceil((secondsNeeded - displaySeconds) / 60) }), "info");
        emitProgress();

        let lastStoreCheck = Date.now();
        while (!this.shouldStopQuests && authoritativeSeconds < secondsNeeded) {
            await new Promise(r => setTimeout(r, 1000));
            if (this.shouldStopQuests) break;

            if (displaySeconds < secondsNeeded) {
                if (displaySeconds < authoritativeSeconds + 32) {
                    displaySeconds = Math.min(secondsNeeded, displaySeconds + 1);
                    emitProgress();
                }
            }

            if (Date.now() - lastStoreCheck >= 4000) {
                lastStoreCheck = Date.now();
                try {
                    const freshQuest = this.getAvailableQuests().find(q => q.id === quest.id);
                    if (freshQuest?.userStatus?.completedAt) {
                        authoritativeSeconds = secondsNeeded;
                        displaySeconds = secondsNeeded;
                        emitProgress();
                        break;
                    }
                    const pVal = freshQuest?.userStatus?.progress?.PLAY_ON_DESKTOP?.value;
                    if (pVal != null && pVal > authoritativeSeconds) {
                        authoritativeSeconds = Math.floor(pVal);
                        if (authoritativeSeconds > displaySeconds) {
                            displaySeconds = authoritativeSeconds;
                        }
                        emitProgress();
                    }
                } catch (e) { }
            }

            if (authoritativeSeconds >= secondsNeeded || displaySeconds >= secondsNeeded) {
                break;
            }
        }

        this.cleanupPlaySpoof(realGames, fakeGames);
        return authoritativeSeconds >= secondsNeeded || displaySeconds >= secondsNeeded;
    }

    cleanupPlaySpoof(realGames = [], fakeGames = []) {
        try {
            if (this._questsHeartbeatListener && this.Dispatcher) {
                this.Dispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", this._questsHeartbeatListener);
                this._questsHeartbeatListener = null;
            }
        } catch (e) { }

        try {
            if (this._questsOriginalGetRunningGames && this.RunningGameStore) {
                this.RunningGameStore.getRunningGames = this._questsOriginalGetRunningGames;
                this._questsOriginalGetRunningGames = null;
            }
            if (this._questsOriginalGetGameForPID && this.RunningGameStore) {
                this.RunningGameStore.getGameForPID = this._questsOriginalGetGameForPID;
                this._questsOriginalGetGameForPID = null;
            }
            if (this.Dispatcher && (fakeGames.length > 0 || this._questsActiveFakeGame)) {
                const f = fakeGames.length > 0 ? fakeGames : [this._questsActiveFakeGame].filter(Boolean);
                const r = realGames || this._questsActiveRealGames || [];
                this.Dispatcher.dispatch({
                    type: "RUNNING_GAMES_CHANGE",
                    removed: f,
                    added: r,
                    games: r
                });
            }
        } catch (e) { }

        this._questsActiveFakeGame = null;
        this._questsActiveRealGames = null;
    }

    async runStreamOnDesktopQuest(quest, statusUpdateCallback) {
        const appId = this.getQuestApplicationId(quest);
        const questName = this.getQuestName(quest);
        if (!appId) {
            this.notify(this.t("quests.toast_app_id_error", { name: questName }), "error");
            return false;
        }

        const pid = Math.floor(Math.random() * 30000) + 1000;
        const taskInfo = this.getQuestTaskInfo(quest);
        const secondsNeeded = taskInfo.seconds || 900;
        let secondsDone = quest.userStatus?.progress?.STREAM_ON_DESKTOP?.value ?? quest.userStatus?.streamProgressSeconds ?? 0;
        let authoritativeSeconds = secondsDone;
        let displaySeconds = secondsDone;

        const emitProgress = () => {
            const cur = Math.min(secondsNeeded, Math.max(0, displaySeconds));
            const percent = Math.min(100, Math.floor((cur / secondsNeeded) * 100));
            const remainSec = Math.max(0, secondsNeeded - cur);
            const remainMin = Math.ceil(remainSec / 60);
            statusUpdateCallback?.({
                stage: "running",
                taskName: "STREAM_ON_DESKTOP",
                secondsDone: cur,
                secondsNeeded,
                percent,
                message: `${this.t("quests.simulating_stream")}: ${this.formatDuration(cur)} / ${this.formatDuration(secondsNeeded)} (~${remainMin} min)`
            });
        };

        if (!this.ApplicationStreamingStore) this.initStores();
        const origMeta = this.ApplicationStreamingStore?.getStreamerActiveStreamMetadata;
        this._questsOriginalGetStreamerMeta = origMeta;

        if (this.ApplicationStreamingStore) {
            this.ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
                id: appId,
                pid,
                sourceName: null
            });
        }

        const onHeartbeat = (data) => {
            if (!data) return;
            const eventQuestId = data.questId || data.quest_id || data.userStatus?.questId;
            if (eventQuestId && eventQuestId !== quest.id) return;

            let val = null;
            if (quest.config?.configVersion === 1) {
                val = data.userStatus?.streamProgressSeconds;
            } else if (data.userStatus?.progress?.STREAM_ON_DESKTOP?.value != null) {
                val = Math.floor(data.userStatus.progress.STREAM_ON_DESKTOP.value);
            }
            if (val != null && val > authoritativeSeconds) {
                authoritativeSeconds = val;
                if (val > displaySeconds) {
                    displaySeconds = val;
                }
                emitProgress();
            }
        };

        this._questsHeartbeatListener = onHeartbeat;
        try {
            this.Dispatcher?.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", onHeartbeat);
        } catch (e) { }

        this.notify(this.t("quests.toast_simulating_stream", { name: questName }), "info");
        emitProgress();

        let lastStoreCheck = Date.now();
        while (!this.shouldStopQuests && authoritativeSeconds < secondsNeeded) {
            await new Promise(r => setTimeout(r, 1000));
            if (this.shouldStopQuests) break;

            if (displaySeconds < secondsNeeded) {
                if (displaySeconds < authoritativeSeconds + 32) {
                    displaySeconds = Math.min(secondsNeeded, displaySeconds + 1);
                    emitProgress();
                }
            }

            if (Date.now() - lastStoreCheck >= 4000) {
                lastStoreCheck = Date.now();
                try {
                    const freshQuest = this.getAvailableQuests().find(q => q.id === quest.id);
                    if (freshQuest?.userStatus?.completedAt) {
                        authoritativeSeconds = secondsNeeded;
                        displaySeconds = secondsNeeded;
                        emitProgress();
                        break;
                    }
                    const pVal = freshQuest?.userStatus?.progress?.STREAM_ON_DESKTOP?.value ?? freshQuest?.userStatus?.streamProgressSeconds;
                    if (pVal != null && pVal > authoritativeSeconds) {
                        authoritativeSeconds = Math.floor(pVal);
                        if (authoritativeSeconds > displaySeconds) {
                            displaySeconds = authoritativeSeconds;
                        }
                        emitProgress();
                    }
                } catch (e) { }
            }

            if (authoritativeSeconds >= secondsNeeded || displaySeconds >= secondsNeeded) {
                break;
            }
        }

        this.cleanupStreamSpoof();
        return authoritativeSeconds >= secondsNeeded || displaySeconds >= secondsNeeded;
    }

    cleanupStreamSpoof() {
        try {
            if (this._questsHeartbeatListener && this.Dispatcher) {
                this.Dispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", this._questsHeartbeatListener);
                this._questsHeartbeatListener = null;
            }
        } catch (e) { }

        try {
            if (this._questsOriginalGetStreamerMeta && this.ApplicationStreamingStore) {
                this.ApplicationStreamingStore.getStreamerActiveStreamMetadata = this._questsOriginalGetStreamerMeta;
                this._questsOriginalGetStreamerMeta = null;
            }
        } catch (e) { }
    }

    async runPlayActivityQuest(quest, statusUpdateCallback) {
        const questName = this.getQuestName(quest);
        const taskInfo = this.getQuestTaskInfo(quest);
        const secondsNeeded = taskInfo.seconds || 600;
        let secondsDone = quest.userStatus?.progress?.PLAY_ACTIVITY?.value ?? 0;

        let channelId = this.ChannelStore?.getSortedPrivateChannels?.()?.[0]?.id;
        if (!channelId) {
            const guilds = Object.values(this.GuildStore?.getGuilds?.() || {});
            channelId = guilds[0]?.id;
        }
        if (!channelId) channelId = "0";
        const streamKey = `call:${channelId}:1`;

        this.notify(this.t("quests.toast_starting_activity", { name: questName }), "info");

        while (!this.shouldStopQuests && secondsDone < secondsNeeded) {
            try {
                const res = await this.callDiscordAPI("POST", `/quests/${quest.id}/heartbeat`, { stream_key: streamKey, terminal: false });
                if (res?.progress?.PLAY_ACTIVITY?.value != null) {
                    secondsDone = res.progress.PLAY_ACTIVITY.value;
                }
            } catch (e) { }

            const percent = Math.min(100, Math.floor((secondsDone / secondsNeeded) * 100));
            statusUpdateCallback?.({
                stage: "running",
                taskName: "PLAY_ACTIVITY",
                secondsDone,
                secondsNeeded,
                percent,
                message: `${this.t("quests.activity_running")}: ${this.formatDuration(secondsDone)} / ${this.formatDuration(secondsNeeded)}`
            });

            if (secondsDone >= secondsNeeded) break;
            await new Promise(r => setTimeout(r, 20000));
        }

        if (!this.shouldStopQuests && secondsDone >= secondsNeeded) {
            try {
                await this.callDiscordAPI("POST", `/quests/${quest.id}/heartbeat`, { stream_key: streamKey, terminal: true });
            } catch (e) { }
        }

        return secondsDone >= secondsNeeded;
    }

    updateQuestCardProgress(questId, status) {
        if (!this.activeModal) return;
        const card = this.activeModal.querySelector(`.mp-quest-card[data-quest-id="${questId}"]`);
        if (card) {
            const fill = card.querySelector(".mp-progress-fill");
            const percentEl = card.querySelector(".mp-quest-percent-text");
            const badge = card.querySelector(".mp-quest-status-badge");

            if (status.isCompleted || status.percent >= 100) {
                card.classList.remove("mp-quest-running");
                card.classList.add("mp-quest-completed");
                if (fill) fill.style.width = "100%";
                if (percentEl) {
                    const totalDur = status.secondsNeeded ? this.formatDuration(status.secondsNeeded) : "";
                    percentEl.innerText = totalDur ? `${totalDur} / ${totalDur} • 100%` : "100%";
                }
                if (badge) {
                    badge.className = "mp-quest-badge mp-badge-success mp-quest-status-badge";
                    badge.innerText = this.t("quests.status_completed");
                }
                const chkWrap = card.querySelector(".msg-chk-wrap");
                if (chkWrap) {
                    chkWrap.outerHTML = `<div class="mp-quest-done-check" title="${this.t('quests.already_completed_tooltip')}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
                }
            } else {
                card.classList.add("mp-quest-running");
                if (fill) fill.style.width = `${status.percent}%`;
                if (percentEl) {
                    if (status.secondsDone != null && status.secondsNeeded != null) {
                        percentEl.innerText = `${this.formatDuration(status.secondsDone)} / ${this.formatDuration(status.secondsNeeded)} • ${status.percent}%`;
                    } else {
                        percentEl.innerText = `${status.percent}%`;
                    }
                }
                if (badge) {
                    badge.className = "mp-quest-badge mp-badge-running mp-quest-status-badge";
                    badge.innerText = this.t("quests.status_running", { percent: status.percent });
                }
            }

            const pillPending = this.activeModal.querySelector('.mp-subtab-pill[data-subtab="pending"]');
            const pillCompleted = this.activeModal.querySelector('.mp-subtab-pill[data-subtab="completed"]');
            if (pillPending || pillCompleted) {
                const allQ = this.getAvailableQuests();
                const pCount = allQ.filter(q => !this.getQuestStatus(q).isCompleted).length;
                const cCount = allQ.filter(q => this.getQuestStatus(q).isCompleted).length;
                if (pillPending) pillPending.innerText = `${this.t("quests.subtab_pending")} (${pCount})`;
                if (pillCompleted) pillCompleted.innerText = `${this.t("quests.subtab_completed")} (${cCount})`;
            }
        }
    }

    cleanupQuestsSpoofs() {
        this.cleanupPlaySpoof();
        this.cleanupStreamSpoof();
    }

    stopQuests() {
        this.shouldStopQuests = true;
        this.cleanupQuestsSpoofs();
        this.isQuestsRunning = false;
        this.runningQuestId = null;
    }

    injectStyles() {
        const css = `
            
            .meowssion-toolbar-btn {
                position: relative;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                margin: 0 4px;
                color: #ffffff;
                opacity: 0.85;
                border-radius: 4px;
                transition: color 0.15s, opacity 0.15s, background-color 0.15s;
            }
            .meowssion-toolbar-btn:hover {
                color: #ffffff;
                opacity: 1.0;
                background-color: var(--background-modifier-hover, rgba(78, 80, 88, 0.16));
            }
            .meowssion-toolbar-btn.meowssion-working {
                position: relative;
                color: #5865f2 !important;
                opacity: 1.0 !important;
                background-color: rgba(88, 101, 242, 0.14) !important;
                border: 1px solid rgba(88, 101, 242, 0.45);
                box-shadow: 0 0 8px rgba(88, 101, 242, 0.45);
            }
            .meowssion-toolbar-btn.meowssion-working .meowssion-toolbar-icon {
                color: #5865f2 !important;
                stroke: #5865f2 !important;
            }
            .meowssion-toolbar-btn.meowssion-working::after {
                content: "";
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 7px;
                height: 7px;
                border-radius: 50%;
                border: 1.5px solid var(--background-floating, #111214);
                background-color: #5865f2;
                box-shadow: 0 0 6px #5865f2;
                animation: meowssion-pulse-dot 1.5s infinite ease-in-out;
            }
            @keyframes meowssion-pulse-dot {
                0%, 100% {
                    transform: scale(0.9);
                    opacity: 0.8;
                }
                50% {
                    transform: scale(1.2);
                    opacity: 1;
                }
            }

            
            :root,
            [data-theme="midnight"],
            .msg-modal-root[data-theme="midnight"] {
                --meowssion-bg-primary: #0b0c0e;
                --meowssion-bg-secondary: #121417;
                --meowssion-bg-card: #16191e;
                --meowssion-bg-hover: rgba(255, 255, 255, 0.05);
                --meowssion-accent: #6366f1;
                --meowssion-accent-hover: #4f46e5;
                --meowssion-border: rgba(255, 255, 255, 0.07);
                --meowssion-text: #f3f4f6;
                --meowssion-text-muted: #9ca3af;
            }

            [data-theme="discord"],
            .msg-modal-root[data-theme="discord"] {
                --meowssion-bg-primary: #1e1f22;
                --meowssion-bg-secondary: #2b2d31;
                --meowssion-bg-card: #2b2d31;
                --meowssion-bg-hover: rgba(255, 255, 255, 0.06);
                --meowssion-accent: #5865F2;
                --meowssion-accent-hover: #4752c4;
                --meowssion-border: rgba(255, 255, 255, 0.06);
                --meowssion-text: #f2f3f5;
                --meowssion-text-muted: #949ba4;
            }

            [data-theme="dark"],
            .msg-modal-root[data-theme="dark"] {
                --meowssion-bg-primary: #141518;
                --meowssion-bg-secondary: #1c1d22;
                --meowssion-bg-card: #212328;
                --meowssion-bg-hover: rgba(255, 255, 255, 0.06);
                --meowssion-accent: #7983f5;
                --meowssion-accent-hover: #5865f2;
                --meowssion-border: rgba(255, 255, 255, 0.08);
                --meowssion-text: #ffffff;
                --meowssion-text-muted: #a3a6aa;
            }

            [data-theme="glass"],
            .msg-modal-root[data-theme="glass"] {
                --meowssion-bg-primary: rgba(15, 17, 23, 0.88);
                --meowssion-bg-secondary: rgba(22, 25, 34, 0.85);
                --meowssion-bg-card: rgba(30, 34, 48, 0.75);
                --meowssion-bg-hover: rgba(255, 255, 255, 0.08);
                --meowssion-accent: #6366f1;
                --meowssion-accent-hover: #4f46e5;
                --meowssion-border: rgba(255, 255, 255, 0.12);
                --meowssion-text: #f8fafc;
                --meowssion-text-muted: #94a3b8;
                backdrop-filter: blur(16px) saturate(180%);
            }

            
            #meowssion-modal-backdrop,
            .msg-modal-backdrop {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(4px);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: msgFadeIn 0.2s ease-out;
            }

            .msg-modal-root {
                background-color: var(--meowssion-bg-primary, #0b0c0e);
                width: 1040px;
                height: 750px;
                max-width: 95vw;
                max-height: 90vh;
                border-radius: 12px;
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                color: var(--meowssion-text, #dbdee1);
                font-family: var(--font-primary, sans-serif);
                transition: background-color 0.2s ease, border-color 0.2s ease;
            }

            .msg-modal-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                background-color: var(--meowssion-bg-secondary, #121417);
                border-bottom: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.06));
                transition: background-color 0.2s ease;
            }
            .msg-search-box {
                display: flex;
                align-items: center;
                background-color: var(--meowssion-bg-card, #16191e);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.07));
                border-radius: 6px;
                padding: 6px 10px;
                width: 380px;
                gap: 8px;
                position: relative;
                transition: background-color 0.2s ease, border-color 0.2s ease;
            }
            .msg-search-box input {
                background: transparent;
                border: none;
                outline: none;
                color: var(--meowssion-text, #f2f3f5);
                font-size: 13px;
                width: 100%;
            }
            .msg-clear-search-btn {
                background: transparent;
                border: none;
                color: var(--meowssion-text-muted, #949ba4);
                font-size: 16px;
                cursor: pointer;
                line-height: 1;
                padding: 0 4px;
            }
            .msg-clear-search-btn:hover { color: #f2f3f5; }

            .msg-top-actions {
                display: flex;
                gap: 8px;
                margin-left: auto;
            }
            .msg-icon-btn {
                background: transparent;
                border: none;
                color: var(--meowssion-text-muted, #949ba4);
                cursor: pointer;
                border-radius: 6px;
                padding: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.15s, background-color 0.15s;
            }
            .msg-icon-btn:hover {
                color: #f2f3f5;
                background-color: var(--meowssion-bg-hover, rgba(255, 255, 255, 0.08));
            }

            .msg-tabs-bar {
                display: flex;
                background-color: var(--meowssion-bg-secondary, #121417);
                padding: 0 16px;
                border-bottom: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.06));
                transition: background-color 0.2s ease;
            }
            .msg-tab-btn {
                background: transparent;
                border: none;
                border-bottom: 2px solid transparent;
                color: var(--meowssion-text-muted, #949ba4);
                padding: 12px 14px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.15s;
            }
            .msg-tab-btn:hover {
                color: var(--meowssion-text, #dbdee1);
            }
            .msg-tab-btn.active {
                color: var(--meowssion-text, #ffffff);
                border-bottom-color: var(--meowssion-accent, #6366f1);
            }
            .msg-tab-count {
                background-color: rgba(255, 255, 255, 0.08);
                color: var(--meowssion-text-muted, #949ba4);
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 700;
            }
            .msg-tab-btn.active .msg-tab-count {
                background-color: var(--meowssion-accent, #6366f1);
                color: #ffffff;
            }

            .msg-modal-body {
                flex: 1;
                overflow-y: auto;
                background-color: var(--meowssion-bg-primary, #0b0c0e);
                transition: background-color 0.2s ease;
            }

            
            .mp-btn { border: none; border-radius: 5px; padding: 8px 18px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
            .mp-btn-primary { background-color: #5865F2; color: #ffffff; }
            .mp-btn-primary:hover { background-color: #4752c4; }
            .mp-btn-secondary { background-color: #4e5058; color: #ffffff; }
            .mp-btn-secondary:hover { background-color: #6d6f78; }
            .mp-btn-danger { background-color: #da373c; color: #ffffff; }
            .mp-btn-danger:hover { background-color: #a12828; }

            
            .msg-switch {
                position: relative;
                display: inline-block;
                width: 42px;
                height: 24px;
                flex-shrink: 0;
                cursor: pointer;
                user-select: none;
            }
            .msg-switch input {
                opacity: 0;
                width: 0;
                height: 0;
                position: absolute;
                pointer-events: none;
            }
            .msg-switch-slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: #80848e;
                transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                border-radius: 24px;
            }
            .msg-switch-slider::before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background-color: #ffffff;
                border-radius: 50%;
                transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.28);
            }
            .msg-switch input:checked + .msg-switch-slider {
                background-color: #5865F2;
            }
            .msg-switch input:checked + .msg-switch-slider::before {
                transform: translateX(18px);
            }
            .msg-switch:hover .msg-switch-slider {
                filter: brightness(1.1);
            }

            
            .msg-chk-wrap {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                user-select: none;
            }
            .msg-chk-wrap input {
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0;
                pointer-events: none;
            }
            .msg-chk-custom {
                width: 20px;
                height: 20px;
                border-radius: 5px;
                border: 2px solid #4e5058;
                background: #1e1f22;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.18s ease;
                box-sizing: border-box;
            }
            .msg-chk-custom svg {
                width: 13px;
                height: 13px;
                color: #ffffff;
                opacity: 0;
                transform: scale(0.6);
                transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .msg-chk-wrap:hover .msg-chk-custom {
                border-color: #949ba4;
            }
            .msg-chk-wrap input:checked + .msg-chk-custom {
                background: #5865f2;
                border-color: #5865f2;
            }
            .msg-chk-wrap input:checked + .msg-chk-custom svg {
                opacity: 1;
                transform: scale(1);
            }

            
            .msg-empty-state { padding: 40px; text-align: center; color: #949ba4; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
            .msg-empty-title { font-size: 15px; font-weight: 600; color: #f2f3f5; }
            .msg-empty-sub { font-size: 12.5px; color: #949ba4; max-width: 440px; margin-top: 6px; line-height: 1.4; }

            
            .mp-quests-container {
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 14px 18px;
                height: 100%;
                box-sizing: border-box;
                overflow-y: auto;
            }

            .mp-quests-subtabs {
                display: flex;
                gap: 8px;
                padding-bottom: 2px;
                flex-wrap: wrap;
            }

            .mp-subtab-pill {
                background: var(--meowssion-bg-secondary, #121417);
                color: var(--meowssion-text-muted, #949ba4);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                border-radius: 6px;
                padding: 6px 14px;
                font-size: 12.5px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.15s ease;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .mp-subtab-pill:hover {
                color: var(--meowssion-text, #f2f3f5);
                background-color: var(--meowssion-bg-hover, rgba(255, 255, 255, 0.06));
            }

            .mp-subtab-pill.active {
                background-color: var(--meowssion-accent, #6366f1) !important;
                border-color: var(--meowssion-accent, #6366f1) !important;
                color: #ffffff !important;
            }

            .mp-quest-done-check {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .mp-quest-completed-badge-note {
                font-size: 11px;
                font-weight: 600;
                color: #23a55a;
                background: rgba(35, 165, 90, 0.15);
                border: 1px solid rgba(35, 165, 90, 0.35);
                padding: 4px 10px;
                border-radius: 6px;
            }

            .mp-quests-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: var(--meowssion-bg-secondary, #121417);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                border-radius: 8px;
                padding: 8px 12px;
                gap: 10px;
                flex-wrap: wrap;
                transition: background-color 0.2s ease, border-color 0.2s ease;
            }

            .mp-quests-toolbar-left {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--meowssion-text, #dbdee1);
            }

            .mp-quests-toolbar-title {
                font-weight: 700;
                font-size: 13.5px;
                color: var(--meowssion-text, #f2f3f5);
            }

            .mp-quests-count-tag {
                background: rgba(88, 101, 242, 0.15);
                color: var(--meowssion-accent, #5865f2);
                border: 1px solid rgba(88, 101, 242, 0.3);
                font-weight: 600;
                font-size: 11px;
                padding: 2px 7px;
                border-radius: 10px;
            }

            .mp-quests-toolbar-right {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }

            .mp-quests-auto-toggle-wrap {
                display: flex;
                align-items: center;
                gap: 7px;
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                padding: 4px 9px;
                border-radius: 6px;
                cursor: pointer;
                user-select: none;
                margin-right: 4px;
            }

            .mp-quests-auto-toggle-label {
                font-size: 11.5px;
                font-weight: 600;
                color: var(--meowssion-text, #dbdee1);
                white-space: nowrap;
            }

            .mp-quests-list {
                display: flex;
                flex-direction: column;
                gap: 7px;
            }

            .mp-quest-card {
                background: var(--meowssion-bg-card, #16191e);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                border-radius: 8px;
                padding: 10px 14px;
                display: flex;
                flex-direction: column;
                gap: 6px;
                transition: border-color 0.15s ease, background-color 0.15s ease;
                box-sizing: border-box;
            }

            .mp-quest-card:hover {
                border-color: var(--meowssion-accent, rgba(88, 101, 242, 0.4));
                background-color: var(--meowssion-bg-hover, rgba(255, 255, 255, 0.04));
            }

            .mp-quest-card.mp-quest-running {
                border-color: var(--meowssion-accent, #5865f2);
                background-color: rgba(88, 101, 242, 0.04);
            }

            .mp-quest-card.mp-quest-completed {
                border-color: rgba(35, 165, 90, 0.35);
                background-color: rgba(35, 165, 90, 0.03);
            }

            .mp-quest-card-top {
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
            }

            .mp-quest-title-wrap {
                display: flex;
                align-items: baseline;
                gap: 8px;
                min-width: 0;
                overflow: hidden;
            }

            .mp-quest-title {
                font-size: 13.5px;
                font-weight: 700;
                color: #f2f3f5;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .mp-quest-publisher {
                font-size: 12px;
                color: #949ba4;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .mp-quest-badges {
                margin-left: auto;
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }

            .mp-quest-badge {
                font-size: 11px;
                font-weight: 600;
                padding: 2px 7px;
                border-radius: 4px;
                display: inline-flex;
                align-items: center;
                line-height: 1.2;
                white-space: nowrap;
            }

            .mp-badge-task {
                background: rgba(88, 101, 242, 0.15);
                color: #5865f2;
                border: 1px solid rgba(88, 101, 242, 0.3);
            }

            .mp-badge-success {
                background: rgba(35, 165, 90, 0.15);
                color: #23a55a;
                border: 1px solid rgba(35, 165, 90, 0.35);
            }

            .mp-badge-running {
                background: rgba(88, 101, 242, 0.18);
                color: #5865f2;
                border: 1px solid rgba(88, 101, 242, 0.4);
            }

            .mp-badge-enrolled {
                background: rgba(148, 155, 164, 0.15);
                color: #b5bac1;
                border: 1px solid rgba(148, 155, 164, 0.3);
            }

            .mp-badge-idle {
                background: rgba(148, 155, 164, 0.1);
                color: #80848e;
                border: 1px solid rgba(148, 155, 164, 0.2);
            }

            .mp-badge-expires {
                background: rgba(242, 63, 67, 0.12);
                color: #f23f43;
                border: 1px solid rgba(242, 63, 67, 0.25);
            }

            .mp-quest-card-sub {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                font-size: 12px;
                color: #949ba4;
                padding-left: 30px;
            }

            .mp-quest-reward {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #949ba4;
            }

            .mp-quest-progress-labels {
                flex-shrink: 0;
                font-size: 11.5px;
                color: #949ba4;
                font-variant-numeric: tabular-nums;
            }

            .mp-quest-progress-track {
                width: calc(100% - 30px);
                margin-left: 30px;
                height: 4px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 2px;
                overflow: hidden;
                position: relative;
            }

            .mp-quest-progress-track .mp-progress-fill {
                height: 100%;
                background: #5865f2;
                border-radius: 2px;
                transition: width 0.25s ease;
            }

            .mp-quest-card.mp-quest-running .mp-progress-fill {
                background: linear-gradient(90deg, #5865f2, #7983f5);
            }

            .mp-quest-card.mp-quest-completed .mp-progress-fill {
                background: #23a55a;
            }

                        /* --- Orb Summary Badges (Quests Tab) --- */
            .mp-quests-orb-badges {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin-left: 6px;
            }
            .mp-orb-badge {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
                line-height: 1.2;
                user-select: none;
                cursor: default;
                transition: all 0.15s ease;
            }
            .mp-orb-badge-earned {
                background: rgba(88, 101, 242, 0.12);
                border: 1px solid rgba(88, 101, 242, 0.35);
                color: #8599ff;
            }
            .mp-orb-badge-earned:hover {
                background: rgba(88, 101, 242, 0.2);
                border-color: rgba(88, 101, 242, 0.55);
            }
            .mp-orb-badge-pending {
                background: rgba(35, 165, 90, 0.12);
                border: 1px solid rgba(35, 165, 90, 0.35);
                color: #23a55a;
            }
            .mp-orb-badge-pending:hover {
                background: rgba(35, 165, 90, 0.2);
                border-color: rgba(35, 165, 90, 0.55);
            }
            .mp-orb-sparkle {
                font-size: 11.5px;
                line-height: 1;
            }
            .mp-orb-val {
                font-weight: 700;
            }
            .mp-orb-lbl {
                font-size: 10px;
                opacity: 0.85;
            }

            /* --- Shop / Nitro Credit Tab --- */
            .mp-shop-container {
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 16px 20px;
                height: 100%;
                box-sizing: border-box;
                overflow-y: auto;
            }

            .mp-shop-header-card {
                background: var(--meowssion-bg-secondary, #121417);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                border-radius: 10px;
                padding: 14px 18px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .mp-shop-header-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .mp-shop-title {
                font-size: 16px;
                font-weight: 700;
                color: var(--meowssion-text, #f2f3f5);
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 0;
            }

            .mp-shop-title-sparkle {
                color: #5865f2;
                font-size: 18px;
            }

            .mp-shop-subtitle {
                font-size: 12.5px;
                color: var(--meowssion-text-muted, #949ba4);
                margin: 0;
                line-height: 1.4;
            }

            .mp-shop-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                gap: 10px;
            }

            .mp-shop-stat-box {
                background: var(--meowssion-bg-card, #16191e);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.06));
                border-radius: 8px;
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .mp-shop-stat-label {
                font-size: 11px;
                font-weight: 600;
                color: var(--meowssion-text-muted, #949ba4);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
            }

            .mp-shop-stat-value {
                font-size: 15px;
                font-weight: 700;
                color: var(--meowssion-text, #f2f3f5);
            }

            .mp-val-highlight {
                color: #5865f2;
            }

            .mp-val-green {
                color: #23a55a;
            }

            .mp-val-danger {
                color: #f23f43;
            }

            .mp-stat-sub {
                font-size: 11px;
                font-weight: 500;
                color: var(--meowssion-text-muted, #949ba4);
            }

            .mp-shop-sync-pill {
                font-size: 9.5px;
                font-weight: 700;
                padding: 1px 5px;
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .mp-sync-manual {
                background: rgba(240, 178, 50, 0.15);
                color: #f0b232;
                border: 1px solid rgba(240, 178, 50, 0.35);
            }

            .mp-sync-live {
                background: rgba(35, 165, 90, 0.15);
                color: #23a55a;
                border: 1px solid rgba(35, 165, 90, 0.35);
            }

            .mp-sync-auto {
                background: rgba(88, 101, 242, 0.15);
                color: #8599ff;
                border: 1px solid rgba(88, 101, 242, 0.35);
            }

            .mp-shop-card {
                background: var(--meowssion-bg-card, #16191e);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                border-radius: 10px;
                padding: 16px 20px;
                display: flex;
                flex-direction: column;
                gap: 14px;
                position: relative;
                box-sizing: border-box;
            }

            .mp-shop-card-badge-row {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .mp-shop-exclusive-tag {
                background: linear-gradient(135deg, rgba(88, 101, 242, 0.25), rgba(244, 127, 255, 0.25));
                border: 1px solid rgba(244, 127, 255, 0.45);
                color: #ff9cfb;
                font-size: 10.5px;
                font-weight: 700;
                letter-spacing: 0.5px;
                padding: 3px 8px;
                border-radius: 4px;
                text-transform: uppercase;
            }

            .mp-shop-cost-tag {
                background: rgba(88, 101, 242, 0.15);
                border: 1px solid rgba(88, 101, 242, 0.35);
                color: #8599ff;
                font-size: 11px;
                font-weight: 600;
                padding: 3px 8px;
                border-radius: 4px;
            }

            .mp-shop-item-row {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .mp-shop-nitro-icon-wrap {
                width: 58px;
                height: 58px;
                border-radius: 12px;
                background: linear-gradient(135deg, rgba(88, 101, 242, 0.15), rgba(244, 127, 255, 0.15));
                border: 1px solid rgba(255, 255, 255, 0.12);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 4px 16px rgba(88, 101, 242, 0.2);
            }

            .mp-shop-item-details {
                display: flex;
                flex-direction: column;
                gap: 4px;
                flex: 1;
            }

            .mp-shop-item-title {
                font-size: 16px;
                font-weight: 700;
                color: #f2f3f5;
                margin: 0;
            }

            .mp-shop-item-desc {
                font-size: 12.5px;
                color: var(--meowssion-text-muted, #949ba4);
                margin: 0;
                line-height: 1.45;
            }

            .mp-shop-simulator-wrap {
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.06));
                border-radius: 8px;
                padding: 12px 14px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .mp-shop-simulator-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
            }

            .mp-shop-sim-label {
                font-size: 12.5px;
                font-weight: 600;
                color: var(--meowssion-text, #f2f3f5);
            }

            .mp-shop-qty-control {
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }

            .mp-qty-btn {
                background: var(--meowssion-bg-secondary, #121417);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.1));
                color: var(--meowssion-text, #f2f3f5);
                border-radius: 5px;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.15s ease;
                user-select: none;
            }

            .mp-qty-btn:hover:not(:disabled) {
                background: rgba(255, 255, 255, 0.08);
                border-color: #5865f2;
                color: #ffffff;
            }

            .mp-qty-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }

            .mp-qty-btn.mp-qty-max {
                width: auto;
                padding: 0 10px;
                font-size: 11px;
                font-weight: 700;
                background: rgba(88, 101, 242, 0.15);
                border-color: rgba(88, 101, 242, 0.35);
                color: #8599ff;
            }

            .mp-qty-btn.mp-qty-max:hover {
                background: #5865f2;
                color: #ffffff;
            }

            .mp-qty-input {
                background: var(--meowssion-bg-secondary, #121417);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.1));
                color: #ffffff;
                width: 52px;
                height: 28px;
                border-radius: 5px;
                text-align: center;
                font-size: 13px;
                font-weight: 700;
                outline: none;
                box-sizing: border-box;
                -moz-appearance: textfield;
            }

            .mp-qty-input::-webkit-outer-spin-button,
            .mp-qty-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }

            .mp-shop-calc-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 8px;
                background: rgba(255, 255, 255, 0.02);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.05));
                border-radius: 6px;
                padding: 8px 12px;
            }

            .mp-shop-calc-item {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .mp-calc-label {
                font-size: 10.5px;
                color: var(--meowssion-text-muted, #949ba4);
                font-weight: 500;
            }

            .mp-calc-val {
                font-size: 13px;
                font-weight: 600;
                color: var(--meowssion-text, #f2f3f5);
            }

            .mp-cost-val {
                color: #8599ff;
            }

            .mp-shop-warning-box {
                background: rgba(240, 178, 50, 0.1);
                border: 1px solid rgba(240, 178, 50, 0.3);
                border-radius: 6px;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .mp-shop-warning-text {
                font-size: 11.5px;
                color: #f0b232;
                line-height: 1.4;
            }

            .mp-shop-actions-wrap {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .mp-shop-btn-redeem {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 10px 18px;
                font-size: 13.5px;
            }

            .mp-shop-security-notice {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                font-size: 11.5px;
                color: var(--meowssion-text-muted, #949ba4);
                line-height: 1.4;
                padding: 2px 4px;
            }

            .mp-shop-sync-card {
                background: var(--meowssion-bg-secondary, #121417);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                border-radius: 10px;
                padding: 14px 18px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .mp-shop-sync-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }

            .mp-shop-sync-title {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--meowssion-text, #f2f3f5);
                margin: 0;
            }

            .mp-shop-sync-desc {
                font-size: 12px;
                color: var(--meowssion-text-muted, #949ba4);
                margin: 2px 0 0 0;
                line-height: 1.4;
            }

            .mp-shop-sync-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                flex-wrap: wrap;
            }

            .mp-shop-sync-input-group {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: var(--meowssion-bg-card, #16191e);
                border: 1px solid var(--meowssion-border, rgba(255, 255, 255, 0.08));
                border-radius: 6px;
                padding: 3px 6px;
            }

            .mp-sync-input-prefix {
                color: #5865f2;
                font-size: 13px;
                padding-left: 4px;
            }

            .mp-sync-input {
                background: transparent;
                border: none;
                outline: none;
                color: #ffffff;
                font-size: 13px;
                font-weight: 600;
                width: 90px;
            }

            .mp-shop-btn-deduct {
                font-size: 12px;
                padding: 6px 12px;
            }

            @keyframes msgFadeIn { from { opacity: 0; } to { opacity: 1; } }
        `;
        BdApi.DOM.addStyle(this.pluginName, css);
    }

    removeStyles() {
        BdApi.DOM.removeStyle(this.pluginName);
    }

    static TRANSLATIONS = {
        pt: {
            "tabs.quests": "Missões",
            "top.search_placeholder": "Filtrar missões por nome ou desenvolvedor...",
            "top.clear_search": "Limpar busca",
            "top.theme_title": "Alternar Tema Visual",
            "top.refresh_title": "Atualizar Missões",
            "top.close": "Fechar",
            "header.tooltip_idle": "Meowssion • Missões do Discord",
            "header.tooltip_running": "Meowssion • Fazendo missão em 2º plano",
            "empty.no_quests": "Nenhuma missão disponível no momento",
            "empty.no_quests_sub": "O QuestsStore do Discord não retornou missões ativas para esta conta ou todas as missões atuais expiraram.",
            "empty.open_discord_quests": "Abrir Aba de Missões do Discord",
            "empty.no_completed_quests": "Nenhuma missão concluída até o momento.",
            "empty.no_pending_quests": "Parabéns! Todas as missões disponíveis já foram concluídas.",
            "quests.title": "Missões do Discord",
            "quests.subtab_pending": "Pendentes",
            "quests.subtab_completed": "Concluídas",
            "quests.pending_count": "{count} pendente(s)",
            "quests.completed_count": "{count} concluída(s)",
            "quests.select_all": "Selecionar Todas",
            "quests.deselect_all": "Desmarcar Todas",
            "quests.refresh": "Atualizar Lista",
            "quests.start_selected": "Iniciar Missões Selecionadas ({count})",
            "quests.stop_execution": "Parar Execução",
            "quests.status_completed": "Concluída",
            "quests.status_running": "Em andamento • {percent}%",
            "quests.status_enrolled": "Aceita",
            "quests.status_idle": "Não iniciada",
            "quests.reward": "Recompensa: {reward}",
            "quests.expires_in": "Expira em {time}",
            "quests.select_tooltip": "Selecionar missão",
            "quests.already_completed_tooltip": "Missão já concluída",
            "quests.auto_quest_label": "Auto-Missão",
            "quests.auto_quest_desc": "Verifica a cada 10 minutos e executa automaticamente missões pendentes em segundo plano",
            "quests.auto_quest_enabled": "Auto-Missão ativada! Verificação automática em segundo plano iniciada.",
            "quests.auto_quest_disabled": "Auto-Missão desativada.",
            "quests.toast_select_first": "Selecione pelo menos uma missão para iniciar.",
            "quests.toast_all_done": "Todas as missões selecionadas já estão concluídas!",
            "quests.toast_starting": "Iniciando {count} missão(ões) em segundo plano...",
            "quests.toast_completed": "Missão concluída: {name}!",
            "quests.toast_stopped": "Execução de missões interrompida.",
            "quests.toast_refreshed": "Lista de missões atualizada!",
            "quests.toast_app_id_error": "Não foi possível resolver o ID da aplicação para \"{name}\".",
            "quests.toast_execution_finished": "Execução das missões finalizada.",
            "quests.toast_simulating_game": "Simulando jogo para \"{name}\". Aguarde (~{minutes} min)...",
            "quests.getting_game_data": "Obtendo dados do jogo público...",
            "quests.watching_video": "Assistindo vídeo",
            "quests.simulating_game": "Simulando jogo",
            "quests.simulating_stream": "Simulando transmissão",
            "quests.toast_simulating_stream": "Simulando transmissão para \"{name}\". É necessário estar em uma chamada de voz para contabilizar.",
            "quests.toast_starting_activity": "Iniciando atividade para \"{name}\"...",
            "quests.activity_running": "Atividade em andamento",
            "theme.switched": "Tema alternado para: {theme}",
            "top.lang_title": "Alternar Idioma (EN / PT)",
            "lang.switched": "Idioma alterado para: {lang}",
            "time.expired": "Expirada",
            "quests.toast_error": "Erro na execução das missões: {error}",
            "quests.progress_init": "Missão {current}/{total}: Inicializando {name}...",
            "quests.progress_enrolling": "Aceitando missão \"{name}\" automaticamente...",
            "tabs.orbs_shop": "Crédito Nitro • Orbs",
            "orbs.earned_badge": "✦ {count} Orbs Conquistados",
            "orbs.pending_badge": "✦ +{count} Orbs Disponíveis",
            "orbs.earned_label": "Conquistados",
            "orbs.pending_label": "Disponíveis",
            "orbs.earned_tooltip": "Total de Orbs acumulados em missões concluídas",
            "orbs.pending_tooltip": "Total de Orbs disponíveis para conquistar em missões ativas",
            "shop.title": "Loja de Orbs • Crédito Nitro",
            "shop.subtitle": "Troque seus Orbs conquistados em missões por Crédito Nitro oficial do Discord com proteção anti-ban.",
            "shop.stat_current_balance": "Saldo Atual de Orbs",
            "shop.stat_earned_total": "Orbs Conquistados",
            "shop.stat_pending_total": "Orbs Pendentes",
            "shop.stat_max_redeemable": "Crédito Resgatável",
            "shop.balance_manual_tag": "Manual",
            "shop.balance_manual_tooltip": "Saldo ajustado manualmente pelo usuário",
            "shop.balance_live_tag": "Sincronizado",
            "shop.balance_live_tooltip": "Saldo lido diretamente da carteira do Discord",
            "shop.balance_calc_tag": "Calculado",
            "shop.balance_calc_tooltip": "Saldo calculado a partir de missões concluídas",
            "shop.exclusive_tag": "EXCLUSIVO PARA ORBS",
            "shop.days": "dias de",
            "shop.nitro_card_title": "Crédito Nitro (3 Dias)",
            "shop.nitro_card_desc": "Adiciona 3 dias de assinatura Nitro ao saldo de crédito da sua conta Discord. Pode ser acumulado resgatando múltiplas vezes para estender sua assinatura.",
            "shop.qty_selector_label": "Quantidade de resgates para simular:",
            "shop.max_tooltip": "Definir quantidade máxima com base no saldo atual",
            "shop.calc_selected": "Quantidade Selecionada:",
            "shop.nitro_days_added": "+{days} dias de Nitro",
            "shop.total_cost": "Custo Total:",
            "shop.remaining_orbs": "Orbs Restantes após resgate:",
            "shop.insufficient_label": "Saldo Insuficiente",
            "shop.missing_orbs_help": "Faltam {missing} Orbs para resgatar este crédito. Suas missões pendentes oferecem +{pending} Orbs ({count} missões disponíveis) para cobrir essa quantia!",
            "shop.btn_open_discord_shop": "Abrir Loja de Orbs no Discord para Resgatar ({qty}x)",
            "shop.toast_manual_guide": "Resgate {qty}x Crédito Nitro de 3 dias manualmente na loja para evitar bloqueio de captcha.",
            "shop.security_notice": "Proteção Anti-Ban Ativa: O Discord exige validação humana (hCaptcha) para resgates de crédito na loja. Abrir a loja oficial garante 100% de segurança contra restrições de conta.",
            "shop.sync_balance_title": "Sincronizar Meu Saldo de Orbs",
            "shop.sync_balance_desc": "Ajuste manualmente caso já tenha gastado Orbs na loja oficial do Discord ou queira alinhar com seu extrato real.",
            "shop.sync_balance_placeholder": "Digite seu saldo atual de Orbs...",
            "shop.btn_save_balance": "Salvar Saldo",
            "shop.btn_reset_balance": "Redefinir (Automático)",
            "shop.btn_reset_balance_tooltip": "Restaura o cálculo automático a partir das missões concluídas",
            "shop.btn_register_redeem": "Registrar Resgate (-{cost} Orbs)",
            "shop.toast_balance_saved": "Saldo de Orbs atualizado para {balance} Orbs!",
            "shop.toast_balance_reset": "Saldo de Orbs redefinido para detecção automática ({balance} Orbs)!",
            "shop.toast_redeem_registered": "Resgate de {qty}x Crédito Nitro registrado! -{cost} Orbs (Novo saldo: {balance} Orbs).",
            "shop.toast_insufficient_orbs": "Saldo insuficiente para registrar este resgate."
        },
        en: {
            "tabs.quests": "Quests",
            "top.search_placeholder": "Filter quests by name or publisher...",
            "top.clear_search": "Clear search",
            "top.theme_title": "Toggle Visual Theme",
            "top.refresh_title": "Refresh Quests",
            "top.close": "Close",
            "header.tooltip_idle": "Meowssion • Discord Quests",
            "header.tooltip_running": "Meowssion • Doing quest in background",
            "empty.no_quests": "No quests available at this moment",
            "empty.no_quests_sub": "Discord QuestsStore returned no active quests for this account or all current quests have expired.",
            "empty.open_discord_quests": "Open Discord Quests Tab",
            "empty.no_completed_quests": "No completed quests yet.",
            "empty.no_pending_quests": "Congratulations! All available quests have already been completed.",
            "quests.title": "Discord Quests",
            "quests.subtab_pending": "Pending",
            "quests.subtab_completed": "Completed",
            "quests.pending_count": "{count} pending",
            "quests.completed_count": "{count} completed",
            "quests.select_all": "Select All",
            "quests.deselect_all": "Deselect All",
            "quests.refresh": "Refresh List",
            "quests.start_selected": "Start Selected Quests ({count})",
            "quests.stop_execution": "Stop Execution",
            "quests.status_completed": "Completed",
            "quests.status_running": "In progress • {percent}%",
            "quests.status_enrolled": "Enrolled",
            "quests.status_idle": "Not started",
            "quests.reward": "Reward: {reward}",
            "quests.expires_in": "Expires in {time}",
            "quests.select_tooltip": "Select quest",
            "quests.already_completed_tooltip": "Quest already completed",
            "quests.auto_quest_label": "Auto-Quest",
            "quests.auto_quest_desc": "Checks every 10 minutes and automatically executes pending quests in the background",
            "quests.auto_quest_enabled": "Auto-Quest enabled! Automatic background verification started.",
            "quests.auto_quest_disabled": "Auto-Quest disabled.",
            "quests.toast_select_first": "Select at least one quest to start.",
            "quests.toast_all_done": "All selected quests are already completed!",
            "quests.toast_starting": "Starting {count} quest(s) in background...",
            "quests.toast_completed": "Quest completed: {name}!",
            "quests.toast_stopped": "Quest execution stopped.",
            "quests.toast_refreshed": "Quest list refreshed!",
            "quests.toast_app_id_error": "Could not resolve application ID for \"{name}\".",
            "quests.toast_execution_finished": "Quest execution completed.",
            "quests.toast_simulating_game": "Simulating game for \"{name}\". Please wait (~{minutes} min)...",
            "quests.getting_game_data": "Fetching public game data...",
            "quests.watching_video": "Watching video",
            "quests.simulating_game": "Simulating game",
            "quests.simulating_stream": "Simulating stream",
            "quests.toast_simulating_stream": "Simulating stream for \"{name}\". You must be in a voice call for it to count.",
            "quests.toast_starting_activity": "Starting activity for \"{name}\"...",
            "quests.activity_running": "Activity in progress",
            "theme.switched": "Theme switched to: {theme}",
            "top.lang_title": "Toggle Language (EN / PT)",
            "lang.switched": "Language switched to: {lang}",
            "time.expired": "Expired",
            "quests.toast_error": "Error executing quests: {error}",
            "quests.progress_init": "Quest {current}/{total}: Initializing {name}...",
            "quests.progress_enrolling": "Auto-enrolling quest \"{name}\"...",
            "tabs.orbs_shop": "Nitro Credit • Orbs",
            "orbs.earned_badge": "✦ {count} Orbs Earned",
            "orbs.pending_badge": "✦ +{count} Orbs Available",
            "orbs.earned_label": "Earned",
            "orbs.pending_label": "Available",
            "orbs.earned_tooltip": "Total Orbs accumulated from completed quests",
            "orbs.pending_tooltip": "Total Orbs available to earn from active quests",
            "shop.title": "Orbs Shop • Nitro Credit",
            "shop.subtitle": "Exchange your quest-earned Orbs for official Discord Nitro Credit with anti-ban protection.",
            "shop.stat_current_balance": "Current Orb Balance",
            "shop.stat_earned_total": "Earned Orbs",
            "shop.stat_pending_total": "Pending Orbs",
            "shop.stat_max_redeemable": "Redeemable Credit",
            "shop.balance_manual_tag": "Manual",
            "shop.balance_manual_tooltip": "Balance manually adjusted by user",
            "shop.balance_live_tag": "Synced",
            "shop.balance_live_tooltip": "Balance retrieved directly from Discord wallet",
            "shop.balance_calc_tag": "Calculated",
            "shop.balance_calc_tooltip": "Balance calculated from completed quests",
            "shop.exclusive_tag": "EXCLUSIVE FOR ORBS",
            "shop.days": "days of",
            "shop.nitro_card_title": "Nitro Credit (3 Days)",
            "shop.nitro_card_desc": "Adds 3 days of Nitro subscription to your Discord account credit balance. Can be stacked by redeeming multiple times to extend your subscription.",
            "shop.qty_selector_label": "Redemption quantity to simulate:",
            "shop.max_tooltip": "Set maximum quantity based on current balance",
            "shop.calc_selected": "Selected Quantity:",
            "shop.nitro_days_added": "+{days} days of Nitro",
            "shop.total_cost": "Total Cost:",
            "shop.remaining_orbs": "Remaining Orbs after redemption:",
            "shop.insufficient_label": "Insufficient Balance",
            "shop.missing_orbs_help": "You need {missing} more Orbs to redeem this credit. Your pending quests offer +{pending} Orbs ({count} quests available) to cover this amount!",
            "shop.btn_open_discord_shop": "Open Discord Orbs Shop to Redeem ({qty}x)",
            "shop.toast_manual_guide": "Redeem {qty}x 3-Day Nitro Credit manually in the shop to avoid captcha blocks.",
            "shop.security_notice": "Anti-Ban Protection Active: Discord requires human challenge validation (hCaptcha) for shop credit redemptions. Opening the official shop ensures 100% safety against account flags.",
            "shop.sync_balance_title": "Sync My Orb Balance",
            "shop.sync_balance_desc": "Adjust manually if you already spent Orbs in the official Discord shop or wish to match your real wallet statement.",
            "shop.sync_balance_placeholder": "Enter your current Orb balance...",
            "shop.btn_save_balance": "Save Balance",
            "shop.btn_reset_balance": "Reset (Automatic)",
            "shop.btn_reset_balance_tooltip": "Restores automatic calculation from completed quests",
            "shop.btn_register_redeem": "Register Redemption (-{cost} Orbs)",
            "shop.toast_balance_saved": "Orb balance updated to {balance} Orbs!",
            "shop.toast_balance_reset": "Orb balance reset to automatic detection ({balance} Orbs)!",
            "shop.toast_redeem_registered": "{qty}x Nitro Credit redemption registered! -{cost} Orbs (New balance: {balance} Orbs).",
            "shop.toast_insufficient_orbs": "Insufficient balance to register this redemption."
        }
    };
};
