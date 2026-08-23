"use strict";

(() => {
  const storageKey = "commandCenterTheme";
  const root = document.documentElement;
  const colorScheme = document.querySelector('meta[name="color-scheme"]');

  function storedTheme() {
    try {
      return localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
    } catch (_error) {
      return "light";
    }
  }

  function updateButton(theme) {
    const button = document.querySelector("#theme-toggle");
    if (!button) return;
    const dark = theme === "dark";
    const action = dark ? "claro" : "oscuro";
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", `Cambiar a modo ${action}`);
    button.title = `Cambiar a modo ${action}`;
    button.querySelector(".theme-toggle-label").textContent = dark ? "Claro" : "Oscuro";
  }

  function applyTheme(theme, persist = false) {
    const nextTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    colorScheme.content = nextTheme;
    updateButton(nextTheme);
    if (persist) {
      try { localStorage.setItem(storageKey, nextTheme); } catch (_error) { /* Storage may be unavailable. */ }
      window.dispatchEvent(new CustomEvent("command-center-themechange", { detail: { theme: nextTheme } }));
    }
    return nextTheme;
  }

  const initialTheme = applyTheme(storedTheme());
  window.commandCenterTheme = {
    get: () => root.dataset.theme || initialTheme,
    set: (theme) => applyTheme(theme, true),
    toggle: () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true),
  };

  document.addEventListener("DOMContentLoaded", () => {
    updateButton(root.dataset.theme);
    document.querySelector("#theme-toggle")?.addEventListener("click", window.commandCenterTheme.toggle);
  }, { once: true });
})();
