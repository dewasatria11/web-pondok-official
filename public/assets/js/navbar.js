// Disable console logs for public users
(function () {
  console.log = function () { };
  console.warn = function () { };
  console.error = function () { };
  console.info = function () { };
  console.debug = function () { };
})();

(function () {
  const navs = document.querySelectorAll('[data-nav-root]');
  if (!navs.length) return;

  const ensureLayerStyles = () => {
    if (document.getElementById('nav-layer-styles')) return;
    const style = document.createElement('style');
    style.id = 'nav-layer-styles';
    style.textContent = `
      [data-nav-root] {
        z-index: 1300 !important;
      }
      [data-dropdown-menu] {
        z-index: 1310 !important;
      }
      [data-mobile-backdrop] {
        position: fixed !important;
        inset: 0 !important;
        z-index: 1400 !important;
        background: rgba(0, 0, 0, 0.55) !important;
        backdrop-filter: blur(1px);
      }
      [data-mobile-menu] {
        position: fixed !important;
        top: clamp(0.5rem, 2vw, 1rem) !important;
        bottom: clamp(0.5rem, 2vw, 1.25rem) !important;
        left: clamp(0.5rem, 4vw, 1.5rem) !important;
        right: auto !important;
        width: min(340px, calc(100vw - 2.5rem)) !important;
        max-width: 90vw !important;
        border-radius: 1.25rem !important;
        border: 1px solid rgba(15, 23, 42, 0.08) !important;
        z-index: 1410 !important;
        box-shadow: 0 25px 50px rgba(15, 23, 42, 0.2) !important;
      }
      @media (max-width: 420px) {
        [data-mobile-menu] {
          width: calc(100vw - 1.25rem) !important;
          left: 0.5rem !important;
        }
      }
    `;
    document.head?.appendChild(style);
  };
  ensureLayerStyles();

  const DESKTOP_ACTIVE_CLASSES = ['text-brand-700', 'font-semibold'];
  const MOBILE_EXTRA_ACTIVE_CLASSES = ['bg-brand-100'];
  const ACTIVE_CLASS_POOL = Array.from(
    new Set([...DESKTOP_ACTIVE_CLASSES, ...MOBILE_EXTRA_ACTIVE_CLASSES])
  );

  const normalizePath = (value) => {
    if (!value) return null;
    try {
      const url = new URL(value, window.location.origin);
      let path = url.pathname || '/';
      path = path.replace(/\/index\.html$/i, '/');
      if (path.endsWith('/') && path !== '/') {
        path = path.slice(0, -1);
      }
      path = path.replace(/\.html$/i, '');
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      if (!path) path = '/';
      return path || '/';
    } catch (error) {
      return null;
    }
  };

  const initActiveLinks = (nav, mobileMenu) => {
    const links = [
      ...nav.querySelectorAll('a[data-nav-link]'),
      ...(mobileMenu ? mobileMenu.querySelectorAll('a[data-nav-link]') : []),
    ];
    if (!links.length) return;

    const clearActive = () => {
      links.forEach((link) => {
        ACTIVE_CLASS_POOL.forEach((cls) => link.classList.remove(cls));
        link.removeAttribute('data-nav-active');
      });
    };

    const setActive = (link) => {
      DESKTOP_ACTIVE_CLASSES.forEach((cls) => link.classList.add(cls));
      if (mobileMenu && mobileMenu.contains(link)) {
        MOBILE_EXTRA_ACTIVE_CLASSES.forEach((cls) => link.classList.add(cls));
      }
      link.setAttribute('data-nav-active', 'true');
    };

    const applyActiveByPath = () => {
      const currentPath = normalizePath(window.location.pathname) || '/';
      clearActive();
      let matched = false;

      links.forEach((link) => {
        const targetPath = normalizePath(link.getAttribute('href'));
        if (targetPath && targetPath === currentPath) {
          setActive(link);
          matched = true;
        }
      });

      if (!matched && currentPath !== '/') {
        links.forEach((link) => {
          const targetPath = normalizePath(link.getAttribute('href'));
          if (!targetPath || targetPath === '/') return;
          if (currentPath.startsWith(targetPath)) {
            setActive(link);
            matched = true;
          }
        });
      }

      if (!matched) {
        links.forEach((link) => {
          const targetPath = normalizePath(link.getAttribute('href'));
          if (targetPath === '/') {
            setActive(link);
            matched = true;
          }
        });
      }
    };

    applyActiveByPath();

    links.forEach((link) => {
      link.addEventListener('click', () => {
        clearActive();
        setActive(link);
      });
    });
  };

  const CLOSE_CLASS = 'hidden';

  navs.forEach((nav) => {
    const dropdownButtons = nav.querySelectorAll('[data-dropdown-toggle]');

    dropdownButtons.forEach((btn) => {
      const targetId = btn.getAttribute('data-dropdown-toggle');
      if (!targetId) return;
      const menu = document.getElementById(targetId);
      if (!menu) return;
      const caret = btn.querySelector('[data-dropdown-caret]');
      menu.setAttribute('data-dropdown-menu', 'true');

      menu.style.zIndex = '1310';

      const closeDropdown = () => {
        if (menu.classList.contains(CLOSE_CLASS)) return;
        menu.classList.add(CLOSE_CLASS);
        btn.setAttribute('aria-expanded', 'false');
        caret?.classList.remove('rotate-180');
      };

      const openDropdown = () => {
        menu.classList.remove(CLOSE_CLASS);
        btn.setAttribute('aria-expanded', 'true');
        caret?.classList.add('rotate-180');
      };

      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        if (expanded) {
          closeDropdown();
        } else {
          openDropdown();
        }
      });

      document.addEventListener('click', (event) => {
        if (!menu.contains(event.target) && !btn.contains(event.target)) {
          closeDropdown();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeDropdown();
      });
    });

    const mobileToggle = nav.querySelector('[data-mobile-toggle]');
    const mobileMenuId = mobileToggle?.getAttribute('aria-controls');
    const mobileMenu =
      (mobileMenuId ? document.getElementById(mobileMenuId) : null) ||
      nav.querySelector('[data-mobile-menu]') ||
      document.querySelector('[data-mobile-menu]');
    const mobileBackdrop =
      nav.querySelector('[data-mobile-backdrop]') ||
      document.querySelector('[data-mobile-backdrop]');
    const mobileIcons = nav.querySelectorAll('[data-mobile-icon]');

    mobileMenu?.setAttribute('data-nav-compact', 'true');
    mobileBackdrop?.setAttribute('data-nav-compact', 'true');

    mobileMenu?.style && (mobileMenu.style.zIndex = '1410');
    mobileBackdrop?.style && (mobileBackdrop.style.zIndex = '1400');

    const isCompactMenu =
      mobileMenu?.getAttribute('data-nav-compact') === 'true';

    const setMobileIcons = (isOpen) => {
      mobileIcons.forEach((icon) => {
        const type = icon.getAttribute('data-mobile-icon');
        if (type === 'open') {
          icon.classList.toggle(CLOSE_CLASS, isOpen);
        } else if (type === 'close') {
          icon.classList.toggle(CLOSE_CLASS, !isOpen);
        }
      });
    };

    const updateOverlayPosition = () => {
      const scrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        0;
      if (isCompactMenu) return;
      const topValue = `${scrollY}px`;
      if (mobileMenu) {
        mobileMenu.style.top = topValue;
        mobileMenu.style.bottom = 'auto';
        mobileMenu.style.height = '100vh';
      }
      if (mobileBackdrop) {
        mobileBackdrop.style.top = topValue;
        mobileBackdrop.style.bottom = 'auto';
        mobileBackdrop.style.height = '100vh';
      }
    };

    const resetOverlayPosition = () => {
      if (isCompactMenu) return;
      if (mobileMenu) {
        mobileMenu.style.removeProperty('top');
        mobileMenu.style.removeProperty('bottom');
        mobileMenu.style.removeProperty('height');
      }
      if (mobileBackdrop) {
        mobileBackdrop.style.removeProperty('top');
        mobileBackdrop.style.removeProperty('bottom');
        mobileBackdrop.style.removeProperty('height');
      }
    };

    const closeMobileMenu = () => {
      mobileMenu?.classList.add(CLOSE_CLASS);
      mobileBackdrop?.classList.add(CLOSE_CLASS);
      document.body.classList.remove('overflow-hidden');
      resetOverlayPosition();
      mobileToggle?.setAttribute('aria-expanded', 'false');
      setMobileIcons(false);
    };

    const openMobileMenu = () => {
      if (!mobileMenu) {
        mobileToggle?.setAttribute('aria-expanded', 'false');
        setMobileIcons(false);
        return false;
      }
      updateOverlayPosition();
      mobileMenu.classList.remove(CLOSE_CLASS);
      mobileBackdrop?.classList.remove(CLOSE_CLASS);
      document.body.classList.add('overflow-hidden');
      mobileToggle?.setAttribute('aria-expanded', 'true');
      setMobileIcons(true);
      return true;
    };

    mobileToggle?.addEventListener('click', () => {
      const expanded = mobileToggle.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        closeMobileMenu();
      } else if (!openMobileMenu()) {
        closeMobileMenu();
      }
    });

    mobileBackdrop?.addEventListener('click', closeMobileMenu);

    const closeMobileElements = [
      ...nav.querySelectorAll('[data-close-mobile]'),
      ...(mobileMenu ? mobileMenu.querySelectorAll('[data-close-mobile]') : []),
    ];

    closeMobileElements.forEach((el) => {
      el.addEventListener('click', closeMobileMenu);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMobileMenu();
      }
    });

    initActiveLinks(nav, mobileMenu);
  });
})();

(function () {
  "use strict";

  const API_URL = "/api/maintenance_status";
  const STYLE_ID = "maintenance-overlay-styles";
  const OVERLAY_ID = "globalMaintenanceOverlay";
  const POLL_INTERVAL = 5 * 60 * 1000;
  const DEFAULT_MESSAGE =
    "Assalamualaikum Wr. Wb. Saat ini situs sedang dalam perawatan singkat. Mohon berkenan kembali beberapa saat lagi.";

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      body.maintenance-locked { overflow: hidden !important; }
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background:
          radial-gradient(circle at top, rgba(26,83,25,0.88), rgba(6,24,11,0.95)),
          repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 12px);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(1.5rem, 3vw, 3rem);
        text-align: center;
      }
      #${OVERLAY_ID}::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: 0.18;
        background: radial-gradient(circle, rgba(255,255,255,0.22) 0, transparent 55%) top left / 220px 220px,
                    radial-gradient(circle, rgba(255,255,255,0.12) 0, transparent 60%) bottom right / 260px 260px;
        pointer-events: none;
      }
      #${OVERLAY_ID} .maintenance-card {
        max-width: 640px;
        width: 100%;
        background: rgba(255,255,255,0.08);
        border-radius: 24px;
        padding: clamp(1.5rem, 4vw, 2.75rem);
        backdrop-filter: blur(6px);
        box-shadow: 0 25px 70px rgba(0,0,0,0.35);
      }
      #${OVERLAY_ID} .maintenance-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(255,255,255,0.15);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 2.25rem;
        margin-bottom: 1rem;
      }
      #${OVERLAY_ID} .maintenance-basmalah {
        font-size: clamp(1rem, 3vw, 1.25rem);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.8);
        margin-bottom: 0.75rem;
      }
      #${OVERLAY_ID} h2 {
        font-size: clamp(1.5rem, 5vw, 2.25rem);
        margin-bottom: 0.75rem;
        font-weight: 700;
      }
      #${OVERLAY_ID} .maintenance-greeting {
        font-size: 1rem;
        letter-spacing: 0.02em;
        color: rgba(255,255,255,0.92);
        margin-bottom: 0.35rem;
      }
      #${OVERLAY_ID} p {
        margin-bottom: 0.5rem;
        line-height: 1.6;
        color: rgba(255,255,255,0.9);
      }
      #${OVERLAY_ID} .maintenance-meta {
        font-size: 0.9rem;
        color: rgba(255,255,255,0.7);
      }
      #${OVERLAY_ID} .maintenance-doa {
        font-size: 0.95rem;
        color: rgba(255,255,255,0.85);
        margin-top: 0.75rem;
        font-style: italic;
      }
      #${OVERLAY_ID} button {
        margin-top: 1rem;
        border-radius: 999px;
        padding-inline: 2rem;
        background: linear-gradient(135deg, #facc15, #f97316);
        border: none;
        color: #0d1b0f;
      }
    `;
    document.head?.appendChild(style);
  };

  const formatDatetime = (value) => {
    if (!value) return "Waktu tidak tersedia";
    try {
      return new Date(value).toLocaleString("id-ID", {
        dateStyle: "full",
        timeStyle: "short",
      });
    } catch (error) {
      return value;
    }
  };

  const getOverlayElements = () => {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      const card = document.createElement("div");
      card.className = "maintenance-card";

      const icon = document.createElement("div");
      icon.className = "maintenance-icon";
      icon.textContent = "🛠️";
      card.appendChild(icon);

      const basmalah = document.createElement("div");
      basmalah.className = "maintenance-basmalah";
      basmalah.textContent = "Bismillahirrahmanirrahim";
      card.appendChild(basmalah);

      const greeting = document.createElement("p");
      greeting.className = "maintenance-greeting";
      greeting.textContent = "Assalamualaikum Warahmatullahi Wabarakatuh";
      card.appendChild(greeting);

      const title = document.createElement("h2");
      title.textContent = "Sedang Perawatan Sistem";
      card.appendChild(title);

      const messageEl = document.createElement("p");
      messageEl.id = "maintenanceOverlayMessage";
      messageEl.textContent = DEFAULT_MESSAGE;
      card.appendChild(messageEl);

      const doaEl = document.createElement("p");
      doaEl.id = "maintenanceOverlayDoa";
      doaEl.className = "maintenance-doa";
      doaEl.textContent =
        "Kami berusaha menghadirkan pengalaman terbaik bagi para wali dan calon santri. Mohon doa agar proses ini dimudahkan Allah SWT.";
      card.appendChild(doaEl);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-light btn-lg fw-semibold shadow-sm";
      button.innerHTML =
        '<i class="bi bi-arrow-clockwise me-2"></i>Refresh';
      button.addEventListener("click", () => window.location.reload());
      card.appendChild(button);

      overlay.appendChild(card);
      document.body?.appendChild(overlay);
    }

    const messageEl =
      overlay.querySelector("#maintenanceOverlayMessage") ||
      overlay.querySelector("p");
    const doaEl =
      overlay.querySelector("#maintenanceOverlayDoa") ||
      overlay.querySelector(".maintenance-doa");
    return { overlay, messageEl, doaEl };
  };

  const showOverlay = (payload) => {
    const { overlay, messageEl, doaEl } = getOverlayElements();
    overlay.style.display = "flex";
    document.body?.classList.add("maintenance-locked");
    if (messageEl) {
      messageEl.textContent = payload.message || DEFAULT_MESSAGE;
    }
    if (doaEl) {
      doaEl.textContent =
        "Semoga Allah SWT memudahkan segala urusan dan memberikan kelancaran kepada kita semua.";
    }
  };

  const hideOverlay = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.style.display = "none";
    document.body?.classList.remove("maintenance-locked");
  };

  const applyStatus = (state) => {
    if (state && state.active) {
      showOverlay(state);
    } else {
      hideOverlay();
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Gagal mengambil status maintenance");
      }
      applyStatus(data.data || {});
    } catch (error) {
      console.warn("[MAINTENANCE] Tidak dapat memuat status:", error);
    }
  };

  const init = () => {
    if (!document.body || document.body.dataset.skipMaintenance === "true") {
      return;
    }
    ensureStyles();
    fetchStatus();
    setInterval(fetchStatus, POLL_INTERVAL);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
