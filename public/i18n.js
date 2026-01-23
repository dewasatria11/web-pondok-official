// Disable console logs for public users
(function () {
  console.log = function () { };
  console.warn = function () { };
  console.error = function () { };
  console.info = function () { };
  console.debug = function () { };
})();

(() => {
  const SUPPORTED = ["id", "en"];
  const FALLBACK = "id";
  const PLACEHOLDER_RE = /\{\{\s*([^{}\s]+)\s*\}\}/g;

  let activeLang = FALLBACK;
  let flatDict = {};

  const norm = (lang) => (lang || "").toLowerCase().slice(0, 2);

  const initialLang = () => {
    const queryLang = new URLSearchParams(location.search).get("lang");
    const candidates = [
      norm(queryLang),
      norm(localStorage.getItem("lang")),
      norm(navigator.language),
      FALLBACK
    ];
    const matched = candidates.find((code) => SUPPORTED.includes(code));
    return matched || FALLBACK;
  };

  const flattenDict = (value, prefix = "", target = {}) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.entries(value).forEach(([key, child]) => {
        const nextKey = prefix ? `${prefix}.${key}` : key;
        flattenDict(child, nextKey, target);
      });
    } else if (prefix) {
      target[prefix] = value;
    }
    return target;
  };

  const interpolate = (template, replacements = {}) => {
    if (typeof template !== "string" || !replacements) return template;
    return template.replace(PLACEHOLDER_RE, (match, token) => {
      const placeholder = token.trim();
      return Object.prototype.hasOwnProperty.call(replacements, placeholder)
        ? String(replacements[placeholder])
        : match;
    });
  };

  const translate = (key, replacements) => {
    if (!flatDict || typeof flatDict !== "object") return key;
    const value = flatDict[key];
    if (value === undefined || value === null) return key;
    if (typeof value === "string") return interpolate(value, replacements);
    if (Array.isArray(value)) {
      return value
        .map((item) =>
          typeof item === "string" ? interpolate(item, replacements) : item
        )
        .join("");
    }
    return value;
  };

  const applyTranslations = (root = document) => {
    if (!root || !flatDict) return;
    const scope = root.nodeType === Node.DOCUMENT_NODE ? root : root;

    scope.querySelectorAll?.("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (!key) return;

      const translated = translate(key);
      if (
        typeof translated === "string" &&
        translated !== key &&
        el.dataset.i18nSkipText === undefined
      ) {
        if (el.tagName.toLowerCase() === "title") {
          document.title = translated;
        } else {
          el.textContent = translated;
        }
      }

      const attrTokens = (el.dataset.i18nAttr || "")
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);

      attrTokens.forEach((attr) => {
        const attrKey = `${key}.${attr}`;
        const attrValue = translate(attrKey);
        if (typeof attrValue === "string" && attrValue !== attrKey) {
          el.setAttribute(attr, attrValue);
        } else if (typeof translated === "string" && translated !== key) {
          el.setAttribute(attr, translated);
        }
      });
    });

    scope.querySelectorAll?.("[data-i18n-html]").forEach((el) => {
      const key = el.dataset.i18nHtml;
      if (!key) return;
      const html = translate(key);
      if (typeof html === "string" && html !== key) {
        el.innerHTML = html;
      }
    });
  };

  const loadDict = async (lang) => {
    const response = await fetch(`/locales/${lang}.json?v=${Date.now()}`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`i18n load failed: ${lang}`);
    return response.json();
  };

  const setLang = async (lang) => {
    const nextLang = SUPPORTED.includes(lang) ? lang : FALLBACK;
    activeLang = nextLang;
    document.documentElement.lang = nextLang;
    localStorage.setItem("lang", nextLang);

    try {
      let dict = {};
      try {
        dict = await loadDict(nextLang);
      } catch (e) {
        console.error("Failed to load dictionary", e);
      }

      // EMERGENCY FALLBACKS - Hardcoded to ensure these always appear
      const CRITICAL_DEFAULTS = {
        id: {
          "label.document.ijazah": "Foto Ijazah Terakhir",
          "label.document.akta": "Foto Akta Kelahiran",
          "label.document.kk": "Foto Kartu Keluarga",
          "form.security.botProtection": "Keamanan data: Verifikasi ini melindungi formulir dari bot."
        },
        en: {
          "label.document.ijazah": "Last Diploma Photo",
          "label.document.akta": "Birth Certificate Photo",
          "label.document.kk": "Family Card Photo",
          "form.security.botProtection": "Data Security: This verification protects the form from bots."
        }
      };

      const defaults = CRITICAL_DEFAULTS[nextLang] || CRITICAL_DEFAULTS[FALLBACK];
      flatDict = { ...flattenDict(dict), ...defaults }; // Defaults override collisions if needed, or vice versa. Here defaults are backup.
      // Actually, let's make defaults OVERRIDE for now to be 100% sure the verified text shows up
      flatDict = { ...flatDict, ...defaults };

      applyTranslations(document);
      window.dispatchEvent(
        new CustomEvent("i18n:languageChanged", {
          detail: { lang: nextLang }
        })
      );
    } catch (error) {
      console.error(error);
      if (nextLang !== FALLBACK) {
        setLang(FALLBACK);
      }
    }
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-setlang]");
    if (!button) return;
    event.preventDefault();
    const nextLang = button.dataset.setlang;
    const url = new URL(location.href);
    url.searchParams.set("lang", nextLang);
    history.replaceState({}, "", url);
    setLang(nextLang);
  });

  window.__ = (key, replacements) => translate(key, replacements);
  window.__lang = () => activeLang;
  window.__applyTranslations = applyTranslations;
  window.i18nSetLang = setLang;

  setLang(initialLang());
})();
