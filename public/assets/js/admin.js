/* =========================================================
   admin.js — clean & structured
   - Guard login, sidebar toggle, tab switch
   - Pendaftar (list, detail modal, verifikasi)
   - Pembayaran (list, detail modal, verifikasi)
   - Export CSV
   ========================================================= */

(() => {
  "use strict";

  /* =========================
     0) UTIL & GLOBAL STATE
     ========================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const exists = (el) => !!el;
  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const capitalize = (value = "") =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  const toInteger = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  // Global state (dipakai lintas modul)
  let allPendaftarData = []; // cache pendaftar untuk detail
  let currentPembayaranData = null; // data pembayaran yang sedang dilihat
  let pembayaranAutoRefreshInterval = null;
  let alurStepsData = [];
  let syaratItemsData = [];
  let biayaItemsData = [];
  let brosurItemsData = [];
  let kontakItemsData = [];
  let kontakSettingsData = null;
  let maintenanceState = {
    active: false,
    message: "",
    updated_at: null,
    updated_by: "",
  };
  const ALUR_LANGS = ["id", "en"];
  const ALUR_LABEL = {
    id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
    en: { name: "English", flag: "🇬🇧" },
  };
  let alurActiveLang = "id";
  const SYARAT_LANGS = ["id", "en"];
  const SYARAT_LABEL = {
    id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
    en: { name: "English", flag: "🇬🇧" },
  };
  let syaratActiveLang = "id";
  const BIAYA_LANGS = ["id", "en"];
  const BIAYA_LABEL = {
    id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
    en: { name: "English", flag: "🇬🇧" },
  };
  let biayaActiveLang = "id";
  const BROSUR_LANGS = ["id", "en"];
  const BROSUR_LABEL = {
    id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
    en: { name: "English", flag: "🇬🇧" },
  };
  let brosurActiveLang = "id";
  const KONTAK_LANGS = ["id", "en"];
  const KONTAK_LABEL = {
    id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
    en: { name: "English", flag: "🇬🇧" },
  };
  let kontakActiveLang = "id";

  // Pagination state untuk pendaftar
  let currentPage = 1;
  let pageSize = 10; // WAJIB 10 data per halaman
  let totalData = 0;

  const CACHE_DURATION = 30_000; // (opsi, saat ingin cache) 30s
  const AUTO_REFRESH_INTERVAL = 30_000; // auto refresh pembayaran tiap 30s
  const MOBILE_BREAKPOINT = 992; // breakpoint untuk mode mobile/tablet

  const PAGE_TITLES = {
    pendaftar: "Data Pendaftar",
    pembayaran: "Data Pembayaran",
    profil: "Profil Yayasan",
    prestasi: "Prestasi",
    berita: "Berita",
    gelombang: "Kelola Gelombang",
    hero: "Hero Slider",
    why: "Why Section",
    alur: "Alur Pendaftaran",
    syarat: "Syarat Pendaftaran",
    biaya: "Biaya Pendaftaran",
    brosur: "Brosur",
    kontak: "Kontak",
    maintenance: "Mode Maintenance",
  };
  const INFORMASI_ENDPOINTS = {
    alur: "/api/alur_steps",
    syarat: "/api/syarat_items",
    biaya: "/api/biaya_items",
    brosur: "/api/brosur_items",
    kontak: "/api/kontak_items",
    kontakSettings: "/api/kontak_settings",
    berita: "/api/berita_items",
  };

  const formatIDDate = (d) =>
    d ? new Date(d).toLocaleDateString("id-ID") : "Belum ada data";

  const formatIDDatetime = (d) =>
    d ? new Date(d).toLocaleString("id-ID") : "-";

  const rupiah = (n) => "Rp " + parseFloat(n || 0).toLocaleString("id-ID");

  const badge = (text, cls) => `<span class="badge bg-${cls}">${text}</span>`;

  const normalizeDigits = (value = "") =>
    String(value || "").replace(/\D/g, "");

  const dedupeList = (list = []) => {
    const seen = new Set();
    const result = [];
    list
      .map((item) => (item === null || item === undefined ? "" : String(item).trim()))
      .filter(Boolean)
      .forEach((item) => {
        if (seen.has(item)) return;
        seen.add(item);
        result.push(item);
      });
    return result;
  };

  /**
   * Safe Toastr wrapper to prevent "Cannot read properties of undefined" errors
   * Checks for full Toastr initialization (toastr.options must exist)
   */
  const safeToastr = {
    success: (message) => {
      try {
        if (typeof toastr !== 'undefined' && toastr.success && toastr.options) {
          toastr.success(message);
        } else {
          alert('✅ ' + message);
        }
      } catch (error) {
        console.warn('[TOASTR] Error in success notification, using alert:', error);
        alert('✅ ' + message);
      }
    },
    error: (message) => {
      try {
        if (typeof toastr !== 'undefined' && toastr.error && toastr.options) {
          toastr.error(message);
        } else {
          alert('❌ ' + message);
        }
      } catch (error) {
        console.warn('[TOASTR] Error in error notification, using alert:', error);
        alert('❌ ' + message);
      }
    },
    warning: (message) => {
      try {
        if (typeof toastr !== 'undefined' && toastr.warning && toastr.options) {
          toastr.warning(message);
        } else {
          alert('⚠️ ' + message);
        }
      } catch (error) {
        console.warn('[TOASTR] Error in warning notification, using alert:', error);
        alert('⚠️ ' + message);
      }
    },
    info: (message) => {
      try {
        if (typeof toastr !== 'undefined' && toastr.info && toastr.options) {
          toastr.info(message);
        } else {
          alert('ℹ️ ' + message);
        }
      } catch (error) {
        console.warn('[TOASTR] Error in info notification, using alert:', error);
        alert('ℹ️ ' + message);
      }
    }
  };

  const jsonRequest = async (url, { method = "GET", body, headers } = {}) => {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error(`Response tidak valid (${response.status})`);
    }

    if (result && result.ok) {
      return result;
    }

    const message =
      (result && result.error) ||
      `Permintaan gagal (${response.status})`;
    throw new Error(message);
  };

  const setButtonLoading = (button, isLoading, loadingText = "Menyimpan...") => {
    if (!button) return;
    if (isLoading) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.innerHTML;
      }
      button.disabled = true;
      button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${loadingText}`;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  };

  const renderLoadingRow = (tbody, colSpan, message = "Memuat...") => {
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" class="text-center text-muted py-4">
          <span class="spinner-border spinner-border-sm text-primary me-2"></span>${message}
        </td>
      </tr>
    `;
  };

  const renderEmptyRow = (tbody, colSpan, message = "Belum ada data") => {
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" class="text-center text-muted py-4">
          <i class="bi bi-info-circle me-2"></i>${message}
        </td>
      </tr>
    `;
  };

  /* =========================
     1) LOGIN GUARD & HEADER
     ========================= */
  // guard login (jalan seawal mungkin)
  if (localStorage.getItem("isAdminLoggedIn") !== "true") {
    window.location.href = "/login.html";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const adminEmail = localStorage.getItem("adminEmail") || "Admin";
    const adminEmailEl = $("#adminEmail");
    if (adminEmailEl) adminEmailEl.textContent = adminEmail;

    const logoutBtn = $("#logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (event) => {
        event.preventDefault();
        localStorage.removeItem("isAdminLoggedIn");
        localStorage.removeItem("adminEmail");
        localStorage.removeItem("loginTimestamp");
        alert(
          "✅ Anda telah logout.\n\nSilakan login kembali untuk mengakses admin panel."
        );
        window.location.href = "/login.html";
      });
    }

    const navLinks = $$(".sidebar .nav-link");
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (isMobileViewport()) {
          closeSidebar();
        }
      });
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!isMobileViewport()) {
          closeSidebar();
        }
      }, 200);
    });
  });

  /* =========================
     2) SIDEBAR & TABS
     ========================= */
  function isMobileViewport() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  function setSidebarState(shouldShow) {
    const sidebar = $("#sidebar");
    const overlay = $(".sidebar-overlay");
    if (!sidebar || !overlay) return;

    if (shouldShow) {
      sidebar.classList.add("show");
      overlay.classList.add("show");
      document.body.style.overflow = "hidden";
    } else {
      sidebar.classList.remove("show");
      overlay.classList.remove("show");
      document.body.style.overflow = "";
    }
  }

  function toggleSidebar(force) {
    const sidebar = $("#sidebar");
    if (!sidebar) return;

    const shouldShow =
      typeof force === "boolean"
        ? force
        : !sidebar.classList.contains("show");

    setSidebarState(shouldShow);
  }

  function closeSidebar() {
    setSidebarState(false);
  }

  function openSidebar() {
    setSidebarState(true);
  }

  function switchTab(tab) {
    // Sembunyikan semua konten tab
    $$(".tab-content").forEach((el) => (el.style.display = "none"));
    // Hapus active dari semua nav
    $$(".sidebar .nav-link").forEach((el) => el.classList.remove("active"));

    // Tampilkan tab terpilih
    const pane = document.getElementById(`tab-${tab}`);
    if (pane) pane.style.display = "block";

    // Set nav aktif
    const nav = document.querySelector(`[data-tab="${tab}"]`);
    if (nav) nav.classList.add("active");

    // Ubah judul halaman
    const title = $("#pageTitle");
    if (title) title.textContent = PAGE_TITLES[tab] || "Panel";

    // Hentikan auto refresh saat pindah dari pembayaran
    if (pembayaranAutoRefreshInterval) {
      clearInterval(pembayaranAutoRefreshInterval);
      pembayaranAutoRefreshInterval = null;
    }

    // Auto-load jika tab tertentu
    if (tab === "pembayaran") {
      loadPembayaran();
      // aktifkan auto refresh
      pembayaranAutoRefreshInterval = setInterval(
        loadPembayaran,
        AUTO_REFRESH_INTERVAL
      );
    } else if (tab === "pendaftar") {
      loadPendaftar();
    } else if (tab === "statistik") {
      console.log("[STATISTIK] Opening statistik tab, refreshing charts for visible layout");
      // Pastikan data terload saat tab dibuka supaya Chart.js mendapatkan lebar yang benar
      loadStatistikData(true);
      if (allPendaftarData.length === 0) {
        console.log("[STATISTIK] No cached data, loading pendaftar...");
        loadPendaftar();
      }
      setTimeout(() => {
        renderCachedChartsIfVisible();
        scheduleStatChartResize();
      }, 50);
      // Reapply angka terakhir kalau sudah ada cache
      applyLatestStatNumbers();
    } else if (tab === "gelombang") {
      // Load gelombang data
      loadGelombangData();
    } else if (tab === "hero") {
      // Load hero images
      loadHeroImages();
      // Initialize upload form if not already initialized
      setTimeout(() => {
        initHeroUpload();
      }, 100);
    } else if (tab === "why") {
      // Load Why Section data
      loadWhySectionData();
    } else if (tab === "alur") {
      loadAlurSteps(true);
    } else if (tab === "syarat") {
      loadSyaratItems(true);
    } else if (tab === "biaya") {
      loadBiayaItems(true);
    } else if (tab === "brosur") {
      loadBrosurItems(true);
    } else if (tab === "kontak") {
      loadKontakItems(true);
      loadKontakSettings();
    } else if (tab === "maintenance") {
      loadMaintenanceStatus();
    } else if (tab === "berita") {
      loadBeritaItems(true);
    } else if (tab === "payment-settings") {
      loadPaymentSettings();
    }

    // Tutup sidebar di mobile
    if (isMobileViewport()) {
      closeSidebar();
    }
  }

  // expose agar bisa dipakai dari HTML
  window.toggleSidebar = toggleSidebar;
  window.switchTab = switchTab;
  window.loadPendaftar = loadPendaftar; // needed for inline event handlers (e.g., modal refresh buttons)

  /* =========================
     3) PENDAFTAR
     ========================= */
  // Cache untuk statistik - jangan fetch ulang terus
  let cachedAllDataForStats = null;
  let cachedVerifiedPayments = null;
  let lastStatsFetchTime = 0;
  const STATS_CACHE_DURATION = 60000; // 1 menit
  let latestStatChartData = null;
  let latestStatNumbers = null;
  let statCharts = {
    asrama: null,
    gender: null,
    province: null,
  };

  const isStatistikTabVisible = () => {
    const tab = document.getElementById("tab-statistik");
    return !!tab && tab.style.display !== "none";
  };

  function scheduleStatChartResize() {
    if (!isStatistikTabVisible()) return;
    requestAnimationFrame(() => {
      if (!window.__chartStore) return;
      Object.values(window.__chartStore).forEach((chart) => {
        if (chart && typeof chart.resize === "function") {
          chart.resize();
          chart.update("resize");
        }
      });
    });
  }

  // Pastikan grafik ikut menyesuaikan saat window diubah ukurannya (desktop)
  window.addEventListener("resize", () => {
    scheduleStatChartResize();
  });

  function invalidateStatisticsCache() {
    cachedAllDataForStats = null;
    cachedVerifiedPayments = null;
    lastStatsFetchTime = 0;
  }

  const PENDAFTAR_STATUS_CLASSES = {
    pending: "warning",
    revisi: "info",
    diterima: "success",
    ditolak: "danger",
  };

  const PENDAFTAR_STATUS_LABELS = {
    pending: "Pending",
    revisi: "Perlu Revisi",
    diterima: "Diterima",
    ditolak: "Ditolak",
  };

  const normalizeStatusValue = (status) =>
    (status || "pending").toString().trim().toLowerCase();

  function renderPendaftarStatusBadge(status) {
    const normalized = normalizeStatusValue(status);
    const cls = PENDAFTAR_STATUS_CLASSES[normalized] || "secondary";
    const label =
      PENDAFTAR_STATUS_LABELS[normalized] ||
      capitalize(normalized || "Tidak diketahui");
    return `<span class="badge status-badge bg-${cls}" data-status="${normalized}">${label}</span>`;
  }

  function renderPendaftarActions(id, status) {
    const normalized = normalizeStatusValue(status);
    if (normalized === "pending" || normalized === "revisi") {
      return `
        <button class="btn btn-sm btn-success" onclick="openVerifikasiModal(${id}, 'diterima')" title="Terima">
          <i class="bi bi-check-circle"></i>
        </button>
        <button class="btn btn-sm btn-info" onclick="openVerifikasiModal(${id}, 'revisi')" title="Revisi">
          <i class="bi bi-arrow-repeat"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="openVerifikasiModal(${id}, 'ditolak')" title="Tolak">
          <i class="bi bi-x-circle"></i>
        </button>
      `;
    }
    return `<span class="badge bg-secondary">Selesai</span>`;
  }

  function updatePendaftarRowStatus(pendaftarId, newStatus) {
    if (!pendaftarId) return;
    const normalized = normalizeStatusValue(newStatus);
    const numericId = Number(pendaftarId);

    if (!Number.isNaN(numericId)) {
      const target = allPendaftarData.find(
        (item) => Number(item.id) === numericId
      );
      if (target) {
        target.status = normalized;
        target.statusberkas = normalized.toUpperCase();
      }
    }

    const row = document.querySelector(
      `tr[data-pendaftar-id="${pendaftarId}"]`
    );
    if (!row) return;

    const statusCell = row.querySelector(".pendaftar-status-cell");
    if (statusCell) {
      statusCell.innerHTML = renderPendaftarStatusBadge(normalized);
    }

    const actionsCell = row.querySelector(".pendaftar-actions-cell");
    if (actionsCell) {
      actionsCell.innerHTML = renderPendaftarActions(pendaftarId, normalized);
    }
  }

  async function loadPendaftar() {
    try {
      console.log('[PENDAFTAR] 📊 Loading page', currentPage, '(pageSize:', pageSize, ')');

      // Show loading state in table
      const tbody = $("#pendaftarTable");
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Memuat data...</td></tr>';
      }

      // Fetch pendaftar data dengan pagination - WITH TIMEOUT
      const url = `/api/pendaftar_list?page=${currentPage}&pageSize=${pageSize}`;
      console.log('[PENDAFTAR] → API:', url);

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!r.ok) {
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }

        const result = await r.json();

        if (!(result.success && result.data)) {
          console.error("[PENDAFTAR] ❌ Failed to fetch data:", result);
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">❌ Gagal memuat data. Silakan refresh halaman.</td></tr>';
          }
          return;
        }

        console.log('[PENDAFTAR] ✅ Data loaded:', result.data.length, 'items');

        // Update total data dan pagination info
        totalData = result.total || result.data.length;
        console.log('[PENDAFTAR] Page:', currentPage, '| Page Size:', pageSize, '| Total:', totalData);

        allPendaftarData = result.data; // simpan untuk detail

        // ✅ RENDER TABEL DULU (PRIORITY)
        console.log('[PENDAFTAR] 📋 Rendering table...');
        if (tbody) {
          // Calculate starting number based on current page
          const startNum = (currentPage - 1) * pageSize;

          tbody.innerHTML = result.data
            .map((item, i) => {
              const normalizedStatus = normalizeStatusValue(item.status);
              return `
                <tr data-pendaftar-id="${item.id}">
                  <td>${startNum + i + 1}</td>
                  <td><strong>${item.nisn || item.nikcalon || item.nik || "-"
                }</strong></td>
                  <td>${item.nama}</td>
                  <td class="pendaftar-status-cell">${renderPendaftarStatusBadge(
                  normalizedStatus
                )}</td>
                  <td>${formatIDDate(item.createdat)}</td>
                  <td class="pendaftar-actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="lihatDetail(${item.id
                })" title="Lihat Detail & Berkas">
                      <i class="bi bi-eye"></i>
                    </button>
                    ${renderPendaftarActions(item.id, normalizedStatus)}
                  </td>
                </tr>
              `;
            })
            .join("");

          console.log('[PENDAFTAR] ✅ Table rendered successfully');
        }

        // Update pagination controls
        updatePaginationUI();

        // ✅ LOAD STATISTIK SECARA TERPISAH (NON-BLOCKING)
        // Jangan tunggu statistik selesai, biar tabel sudah bisa diklik
        setTimeout(() => {
          console.log('[PENDAFTAR] 📊 Loading statistics in background...');
          loadStatistikData();
        }, 100);

      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          console.error("[PENDAFTAR] ⏱️ Request timeout setelah 10 detik");
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-warning">⏱️ Request timeout. Server terlalu lambat. Silakan coba lagi.</td></tr>';
          }
        } else {
          console.error("[PENDAFTAR] ❌ Fetch error:", fetchError);
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">❌ Error: ' + fetchError.message + '</td></tr>';
          }
        }
        return;
      }
    } catch (e) {
      console.error("[PENDAFTAR] ❌ Unexpected error:", e);
      // tbody already declared in outer try block
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">❌ Terjadi kesalahan: ' + e.message + '</td></tr>';
      }
    }
  }

  // Fungsi terpisah untuk load statistik (non-blocking)
  async function loadStatistikData(forceRefresh = false) {
    try {
      const now = Date.now();
      const hasCache = cachedAllDataForStats && cachedVerifiedPayments;
      const cacheFresh = hasCache && (now - lastStatsFetchTime < STATS_CACHE_DURATION);

      // Gunakan cache jika masih valid
      if (cacheFresh && !forceRefresh) {
        console.log('[STATISTIK] Using cached data');
        calculateAndUpdateStatistics(cachedAllDataForStats, cachedVerifiedPayments);
        scheduleStatChartResize();
        return;
      }

      if (forceRefresh && hasCache) {
        console.log('[STATISTIK] Using cached data (force refresh for visible tab)');
        calculateAndUpdateStatistics(cachedAllDataForStats, cachedVerifiedPayments);
        scheduleStatChartResize();
        if (cacheFresh) {
          return;
        }
      }

      console.log('[STATISTIK] Fetching fresh data' + (forceRefresh ? ' (forced refresh)' : '') + '...');

      // Fetch ALL data untuk statistik (tanpa pagination)
      const rAll = await fetch("/api/pendaftar_list?page=1&pageSize=1000");
      const resultAll = await rAll.json();
      const allDataForStats = resultAll.success && resultAll.data ? resultAll.data : [];

      // Fetch pembayaran data untuk sinkronisasi statistik
      const rPembayaran = await fetch("/api/pembayaran_list");
      const pembayaranResult = await rPembayaran.json();

      // Create map of verified payments by NISN/NIK
      const verifiedPayments = new Map();
      if (pembayaranResult.success && pembayaranResult.data) {
        pembayaranResult.data.forEach(p => {
          if ((p.status || "PENDING").toUpperCase() === "VERIFIED") {
            const identifiers = [p.nisn, p.nik, p.nikcalon].filter(Boolean);
            identifiers.forEach(key => {
              if (key) verifiedPayments.set(key, true);
            });
          }
        });
      }

      // Cache hasil
      cachedAllDataForStats = allDataForStats;
      cachedVerifiedPayments = verifiedPayments;
      lastStatsFetchTime = Date.now();

      // Calculate dan update statistik
      calculateAndUpdateStatistics(allDataForStats, verifiedPayments);
      scheduleStatChartResize();
      renderCachedChartsIfVisible();

    } catch (error) {
      console.error('[STATISTIK] Error loading statistics:', error);
      // Jangan throw error, biar tabel tetap bisa dipakai
    }
  }

  // Fungsi untuk calculate dan update statistik
  function calculateAndUpdateStatistics(allDataForStats, verifiedPayments) {
    console.log('[STATISTIK] Calculating statistics...');
    // Chart instances (persist across updates)
    if (!window.__chartStore) {
      window.__chartStore = {
        asrama: null,
        gender: null,
      };
    }

    // Helper function to check if payment is verified
    const hasVerifiedPayment = (d) => {
      const identifiers = [
        d.nisn,
        d.nikcalon,
        d.nik
      ].filter(Boolean);

      // Check if any identifier matches verified payments
      const isVerified = identifiers.some(key => verifiedPayments.has(key));

      // Debug logging for first few items
      if (window.debugStatistik && identifiers.length > 0) {
        console.log("[MATCH DEBUG]", {
          nama: d.nama,
          identifiers,
          isVerified,
          hasInMap: identifiers.map(id => ({ id, exists: verifiedPayments.has(id) }))
        });
      }

      return isVerified;
    };

    // Kartu statistik
    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    // Debug: Check data structure and field mapping
    console.log("[STATISTIK] 🔍 Data structure analysis:");
    console.log("[STATISTIK]   → Total pendaftar (ALL DATA):", allDataForStats.length);

    if (allDataForStats.length > 0) {
      const sample = allDataForStats[0];
      console.log("[STATISTIK]   → Sample pendaftar fields:", Object.keys(sample));
      console.log("[STATISTIK]   → Sample status values:", allDataForStats.map(d => d.status).slice(0, 5));
      console.log("[STATISTIK]   → Sample rencana_program values:", allDataForStats.map(d => d.rencana_program || d.rencanaprogram).slice(0, 5));
      console.log("[STATISTIK]   → Sample rencanatingkat values:", allDataForStats.map(d => d.rencanatingkat).slice(0, 5));
    }

    // Total count = all pendaftar (dari total API, bukan hanya halaman saat ini)
    setText("totalCount", totalData);
    console.log("[STATISTIK] ✅ Set totalCount to:", totalData);

    // Status counts (gunakan ALL DATA untuk statistik yang akurat)
    const pendingCount = allDataForStats.filter((d) => d.status === "pending").length;
    const revisiCount = allDataForStats.filter((d) => d.status === "revisi").length;
    const diterimaCount = allDataForStats.filter((d) => d.status === "diterima").length;
    const ditolakCount = allDataForStats.filter((d) => d.status === "ditolak").length;

    setText("pendingCount", pendingCount);
    setText("revisiCount", revisiCount);
    setText("diterimaCount", diterimaCount);
    setText("ditolakCount", ditolakCount);

    console.log("[STATISTIK] ✅ Status counts set:");
    console.log("[STATISTIK]   → Pending:", pendingCount);
    console.log("[STATISTIK]   → Revisi:", revisiCount);
    console.log("[STATISTIK]   → Diterima:", diterimaCount);
    console.log("[STATISTIK]   → Ditolak:", ditolakCount);

    // Breakdown program/jenjang
    const getRencanaProgram = (d) => {
      const program = d.rencana_program || d.rencanaProgram || d.rencanakelas || d.rencanaprogram || "";
      return program.trim(); // Trim whitespace
    };

    const getJenjang = (d) => {
      const jenjang = d.rencanatingkat || d.rencanaTingkat || "";
      return jenjang.trim(); // Trim whitespace
    };

    const getProvinsi = (d) => {
      const candidates = [
        d.provinsi,
        d.provinsitempatlahir,
        d.provinsiDomisili,
        d.provinsiAlamat,
      ].map((v) => (v || "").toString().trim());
      const prov = candidates.find(Boolean);
      if (!prov) return "";
      return prov
        .replace(/(provinsi|prov\.?|propinsi)/i, "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^dk i jakarta$/i, "DKI Jakarta")
        .replace(/^dki jakarta$/i, "DKI Jakarta")
        .replace(/^kep\.? bangka belitung$/i, "Kepulauan Bangka Belitung")
        .replace(/^kep\.? riau$/i, "Kepulauan Riau");
    };

    // REVISI: Gunakan SEMUA pendaftar untuk statistik, bukan hanya yang verified
    const allPendaftar = allDataForStats; // Gunakan SEMUA data untuk statistik (bukan hanya halaman saat ini)

    console.log("[STATISTIK] ========================================");
    console.log("[STATISTIK] Total pendaftar (ALL DATA):", allDataForStats.length);
    console.log("[STATISTIK] Menggunakan SEMUA pendaftar untuk statistik (bukan hanya verified)");
    console.log("[STATISTIK] Verified payments map size:", verifiedPayments.size);
    console.log("[STATISTIK] Pendaftar dengan pembayaran VERIFIED:", allDataForStats.filter(hasVerifiedPayment).length);

    // Debug: Log sample data for statistics verification
    if (allPendaftar.length > 0) {
      console.log("[STATISTIK] Sample pendaftar pertama:", {
        nama: allPendaftar[0].nama,
        nisn: allPendaftar[0].nisn,
        nik: allPendaftar[0].nik,
        nikcalon: allPendaftar[0].nikcalon,
        rencana_program: getRencanaProgram(allPendaftar[0]),
        rencanatingkat: getJenjang(allPendaftar[0]),
        jeniskelamin: allPendaftar[0].jeniskelamin
      });
    }

    console.log("[STATISTIK] ========================================");
    console.log("💡 Tip: Statistik sekarang menggunakan SEMUA pendaftar (bukan hanya verified)");

    // REVISI: Hitung SEMUA pendaftar untuk breakdown statistics
    console.log("[STATISTIK] 🔍 Calculating breakdown statistics...");
    console.log("[STATISTIK]   → Total pendaftar count:", allPendaftar.length);

    const putraIndukMts = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putra Induk" && jenjang === "MTs";
        return isMatch;
      }
    ).length;
    const putraIndukMa = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putra Induk" && jenjang === "MA";
        return isMatch;
      }
    ).length;
    const putraIndukKuliah = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putra Induk" && jenjang === "Kuliah";
        return isMatch;
      }
    ).length;
    const putraIndukTotal = putraIndukMts + putraIndukMa + putraIndukKuliah;

    const putraTahfidzMts = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putra Tahfidz" && jenjang === "MTs";
        return isMatch;
      }
    ).length;
    const putraTahfidzMa = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putra Tahfidz" && jenjang === "MA";
        return isMatch;
      }
    ).length;
    const putraTahfidzKuliah = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putra Tahfidz" && jenjang === "Kuliah";
        return isMatch;
      }
    ).length;
    const putraTahfidzTotal =
      putraTahfidzMts + putraTahfidzMa + putraTahfidzKuliah;

    const putriMts = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putri" && jenjang === "MTs";
        return isMatch;
      }
    ).length;
    const putriMa = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putri" && jenjang === "MA";
        return isMatch;
      }
    ).length;
    const putriKuliah = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isMatch = program === "Asrama Putri" && jenjang === "Kuliah";
        return isMatch;
      }
    ).length;
    const putriTotal = putriMts + putriMa + putriKuliah;

    const hanyaSekolahMtsL = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isGenderMatch = (d.jeniskelamin && d.jeniskelamin.trim().toUpperCase() === "L") || (d.jenisKelamin && d.jenisKelamin.trim().toUpperCase() === "L");
        const isMatch = program === "Hanya Sekolah" && jenjang === "MTs" && isGenderMatch;
        return isMatch;
      }
    ).length;
    const hanyaSekolahMtsP = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isGenderMatch = (d.jeniskelamin && d.jeniskelamin.trim().toUpperCase() === "P") || (d.jenisKelamin && d.jenisKelamin.trim().toUpperCase() === "P");
        const isMatch = program === "Hanya Sekolah" && jenjang === "MTs" && isGenderMatch;
        return isMatch;
      }
    ).length;
    const hanyaSekolahMaL = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isGenderMatch = (d.jeniskelamin && d.jeniskelamin.trim().toUpperCase() === "L") || (d.jenisKelamin && d.jenisKelamin.trim().toUpperCase() === "L");
        const isMatch = program === "Hanya Sekolah" && jenjang === "MA" && isGenderMatch;
        return isMatch;
      }
    ).length;
    const hanyaSekolahMaP = allPendaftar.filter(
      (d) => {
        const program = getRencanaProgram(d);
        const jenjang = getJenjang(d);
        const isGenderMatch = (d.jeniskelamin && d.jeniskelamin.trim().toUpperCase() === "P") || (d.jenisKelamin && d.jenisKelamin.trim().toUpperCase() === "P");
        const isMatch = program === "Hanya Sekolah" && jenjang === "MA" && isGenderMatch;
        return isMatch;
      }
    ).length;
    const hanyaSekolahMtsTotal = hanyaSekolahMtsL + hanyaSekolahMtsP;
    const hanyaSekolahMaTotal = hanyaSekolahMaL + hanyaSekolahMaP;
    const hanyaSekolahTotal = hanyaSekolahMtsTotal + hanyaSekolahMaTotal;
    const totalAsrama = putraIndukTotal + putraTahfidzTotal + putriTotal;

    // Gender aggregasi semua pendaftar
    const totalGenderL = allPendaftar.filter((d) => {
      const g = (d.jeniskelamin || d.jenisKelamin || "").trim().toUpperCase();
      return g === "L";
    }).length;
    const totalGenderP = allPendaftar.filter((d) => {
      const g = (d.jeniskelamin || d.jenisKelamin || "").trim().toUpperCase();
      return g === "P";
    }).length;

    // Distribusi provinsi
    const provinceCounts = new Map();
    allPendaftar.forEach((d) => {
      const prov = getProvinsi(d);
      if (!prov) return;
      provinceCounts.set(prov, (provinceCounts.get(prov) || 0) + 1);
    });

    const sortedProvince = Array.from(provinceCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    const topProvince = sortedProvince.slice(0, 10); // tampilkan 10 teratas
    const provinceLabels = topProvince.map(([name]) => name);
    const provinceData = topProvince.map(([, count]) => count);

    // Debug: Log calculated statistics (SEMUA PENDAFTAR)
    console.log("[STATISTIK] Hasil perhitungan (SEMUA PENDAFTAR):");
    console.log("Asrama Putra Induk:", { MTs: putraIndukMts, MA: putraIndukMa, Kuliah: putraIndukKuliah, Total: putraIndukTotal });
    console.log("Asrama Putra Tahfidz:", { MTs: putraTahfidzMts, MA: putraTahfidzMa, Kuliah: putraTahfidzKuliah, Total: putraTahfidzTotal });
    console.log("Asrama Putri:", { MTs: putriMts, MA: putriMa, Kuliah: putriKuliah, Total: putriTotal });
    console.log("Hanya Sekolah:", {
      MTs_L: hanyaSekolahMtsL,
      MTs_P: hanyaSekolahMtsP,
      MA_L: hanyaSekolahMaL,
      MA_P: hanyaSekolahMaP,
      Total_MTs: hanyaSekolahMtsTotal,
      Total_MA: hanyaSekolahMaTotal,
      Total: hanyaSekolahTotal,
      Asrama: totalAsrama
    });
    console.log("Gender (total):", { L: totalGenderL, P: totalGenderP });
    console.log("[STATISTIK] ========================================");

    // Simpan payload grafik agar bisa dirender ulang saat tab terlihat
    latestStatChartData = {
      asrama: {
        data: [totalAsrama, hanyaSekolahTotal],
        labels: ["Asrama", "Non Asrama"],
        colors: ["#4caf50", "#ff9800"],
        title: "Asrama vs Non Asrama",
      },
      gender: {
        data: [totalGenderL, totalGenderP],
        labels: ["Laki-laki", "Perempuan"],
        colors: ["#2196f3", "#e91e63"],
        title: "Komposisi Gender",
      },
      province: {
        data: provinceData,
        labels: provinceLabels,
        title: "Asal Provinsi Teratas",
      },
    };

    // Pasang ke DOM
    const mapSet = (m) =>
      Object.entries(m).forEach(([id, val]) => setText(id, val));
    const statMap = {
      putraIndukMts,
      putraIndukMa,
      putraIndukKuliah,
      putraIndukTotal,
      putraTahfidzMts,
      putraTahfidzMa,
      putraTahfidzKuliah,
      putraTahfidzTotal,
      putriMts,
      putriMa,
      putriKuliah,
      putriTotal,
      hanyaSekolahMtsL,
      hanyaSekolahMtsP,
      hanyaSekolahMaL,
      hanyaSekolahMaP,
      hanyaSekolahMtsTotal,
      hanyaSekolahMaTotal,
      // Insight provinsi
      totalProvinsi: provinceCounts.size || 0,
    };

    mapSet(statMap);
    latestStatNumbers = { ...statMap };

    const upd = $("#updateTimePendaftar");
    if (upd)
      upd.textContent = `Data update: ${new Date().toLocaleTimeString(
        "id-ID"
      )}`;

    const upd2 = $("#updateTimeStatistik");
    if (upd2)
      upd2.textContent = `Data update: ${new Date().toLocaleTimeString(
        "id-ID"
      )}`;

    // Render charts (hanya jika tab terlihat)
    renderCachedChartsIfVisible();
  }

  function renderCachedChartsIfVisible() {
    if (!isStatistikTabVisible()) return;
    if (!latestStatChartData) return;

    // Pastikan angka terakhir juga diterapkan ulang
    applyLatestStatNumbers();
    // Pastikan konteks kanvas sudah ada (kadang tertunda rendernya)
    const provCanvas = document.getElementById("chartProvince");
    if (!provCanvas) {
      setTimeout(renderCachedChartsIfVisible, 100);
      return;
    }

    // Render charts
    const renderPie = (ctx, data, labels, colors, chartKey, title) => {
      if (!ctx) return null;

      // Destroy old chart to avoid zero-width artifacts when tab sebelumnya hidden
      if (statCharts[chartKey]) {
        statCharts[chartKey].destroy();
        statCharts[chartKey] = null;
      }

      statCharts[chartKey] = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            title: {
              display: true,
              text: title,
            },
          },
        },
      });
      return statCharts[chartKey];
    };

    const renderBar = (ctx, data, labels, chartKey, title) => {
      if (!ctx) return null;

      if (statCharts[chartKey]) {
        statCharts[chartKey].destroy();
        statCharts[chartKey] = null;
      }

      statCharts[chartKey] = new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Jumlah Pendaftar",
              data,
              backgroundColor: "#3b82f6",
              borderRadius: 6,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              beginAtZero: true,
              ticks: { precision: 0 },
            },
          },
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: title,
            },
          },
        },
      });

      return statCharts[chartKey];
    };

    const asramaCtx = document.getElementById("chartAsrama")?.getContext("2d");
    const genderCtx = document.getElementById("chartGender")?.getContext("2d");
    const provCtx = document.getElementById("chartProvince")?.getContext("2d");

    window.__chartStore.asrama = renderPie(
      asramaCtx,
      latestStatChartData.asrama.data,
      latestStatChartData.asrama.labels,
      latestStatChartData.asrama.colors,
      "asrama",
      latestStatChartData.asrama.title
    );

    window.__chartStore.gender = renderPie(
      genderCtx,
      latestStatChartData.gender.data,
      latestStatChartData.gender.labels,
      latestStatChartData.gender.colors,
      "gender",
      latestStatChartData.gender.title
    );

    if (latestStatChartData.province.labels.length > 0) {
      window.__chartStore.province = renderBar(
        provCtx,
        latestStatChartData.province.data,
        latestStatChartData.province.labels,
        "province",
        latestStatChartData.province.title
      );
      updateProvinceTopList(latestStatChartData.province.labels, latestStatChartData.province.data);
    } else if (provCtx) {
      provCtx.canvas.parentElement.innerHTML = '<div class="text-muted text-center py-4">Belum ada data provinsi</div>';
      updateProvinceTopList([], []);
    }

    console.log('[STATISTIK] ✅ Statistics updated successfully');
    scheduleStatChartResize();
  }

  function updateProvinceTopList(labels, data) {
    const list = document.getElementById("provinceTopList");
    if (!list) return;
    if (!labels || labels.length === 0) {
      list.innerHTML = '<li class="list-group-item text-muted">Belum ada data provinsi</li>';
      return;
    }
    list.innerHTML = labels
      .map((name, idx) => {
        const count = data[idx] || 0;
        return `<li class="list-group-item d-flex justify-content-between align-items-center">
          <span>${idx + 1}. ${name}</span>
          <span class="badge bg-primary rounded-pill">${count}</span>
        </li>`;
      })
      .join("");
  }

  function applyLatestStatNumbers() {
    if (!latestStatNumbers) return;
    Object.entries(latestStatNumbers).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }

  /* =========================
     3.1) PAGINATION FUNCTIONS
     ========================= */
  function updatePaginationUI() {
    const totalPages = Math.ceil(totalData / pageSize);
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalData);

    // Update pagination info text
    const paginationInfo = $("#paginationInfo");
    if (paginationInfo) {
      paginationInfo.textContent = `Menampilkan ${startIndex} - ${endIndex} dari ${totalData} data`;
    }

    // Update page info
    const pageInfo = $("#pageInfo");
    if (pageInfo) {
      pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;
    }

    // Update button states
    const btnPrev = $("#btnPrevPage");
    const btnNext = $("#btnNextPage");

    if (btnPrev) {
      btnPrev.disabled = currentPage === 1;
    }

    if (btnNext) {
      btnNext.disabled = currentPage >= totalPages;
    }

    console.log('[PAGINATION] UI Updated:', { currentPage, totalPages, startIndex, endIndex, totalData });
  }

  function nextPage() {
    const totalPages = Math.ceil(totalData / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      console.log('[PAGINATION] Next page:', currentPage);
      loadPendaftar();
    }
  }

  function previousPage() {
    if (currentPage > 1) {
      currentPage--;
      console.log('[PAGINATION] Previous page:', currentPage);
      loadPendaftar();
    }
  }

  // Expose pagination functions
  window.nextPage = nextPage;
  window.previousPage = previousPage;

  async function updateStatus(id, status) {
    if (!confirm(`Yakin mengubah status menjadi "${status}"?`)) return;
    try {
      const r = await fetch("/api/pendaftar_status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const result = await r.json();
      if (result.success) {
        alert("Status berhasil diupdate!");
        loadPendaftar();
      } else {
        alert("Error: " + (result.error || "Gagal update"));
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  async function lihatDetail(id) {
    try {
      const pendaftar = allPendaftarData.find((p) => p.id === id);
      if (!pendaftar) return alert("Data tidak ditemukan");

      // Payment status lookup
      let paymentStatus = "Belum Ada";
      let paymentBadgeClass = "secondary";
      try {
        const r = await fetch("/api/pembayaran_list");
        const result = await r.json();
        if (r.ok && result.data) {
          const identifiers = dedupeList([
            pendaftar.nisn,
            pendaftar.nikcalon,
            pendaftar.nik,
            normalizeDigits(pendaftar.nisn),
            normalizeDigits(pendaftar.nikcalon),
            normalizeDigits(pendaftar.nik),
          ]);

          const payment = result.data.find((p) => {
            const paymentIdentifiers = dedupeList([
              p.nisn,
              p.nik,
              p.nikcalon,
              normalizeDigits(p.nisn),
              normalizeDigits(p.nik),
              normalizeDigits(p.nikcalon),
            ]);
            return paymentIdentifiers.some((id) => identifiers.includes(id));
          });

          if (payment) {
            const raw = (payment.status || "PENDING").toUpperCase();
            paymentStatus =
              raw === "VERIFIED"
                ? "Verified"
                : raw === "REJECTED"
                  ? "Rejected"
                  : "Pending";
            paymentBadgeClass =
              raw === "VERIFIED"
                ? "success"
                : raw === "REJECTED"
                  ? "danger"
                  : "warning";
          }
        }
      } catch (e) {
        console.error("fetch pembayaran error:", e);
      }

      // Detail content (diringkas dari punyamu)
      let html = `
        <div class="row g-3">
          <div class="col-12"><h6 class="bg-success text-white p-2 rounded">
            <i class="bi bi-card-checklist"></i> Data Registrasi
          </h6></div>
          <div class="col-md-6"><strong>Gelombang:</strong><br><span class="badge bg-info text-dark">${pendaftar.gelombang || "-"}</span></div>
          <div class="col-md-6"><strong>Tanggal Daftar:</strong><br>${formatIDDatetime(
        pendaftar.createdat
      )}</div>
          <div class="col-md-6"><strong>Status Berkas:</strong><br>${badge(
        pendaftar.statusberkas || "PENDING",
        pendaftar.statusberkas === "PENDING"
          ? "warning"
          : pendaftar.statusberkas === "REVISI"
            ? "info"
            : pendaftar.statusberkas === "DITERIMA"
              ? "success"
              : "danger"
      )}</div>
          <div class="col-md-6"><strong>Status Pembayaran:</strong><br>${badge(
        paymentStatus,
        paymentBadgeClass
      )}</div>
          <div class="col-md-12"><strong>Alasan/Catatan:</strong><br>${pendaftar.alasan || "-"
        }</div>

          <div class="col-12 mt-3"><h6 class="bg-success text-white p-2 rounded">
            <i class="bi bi-person"></i> Data Calon Siswa
          </h6></div>
          <div class="col-md-6"><strong>NISN:</strong><br><span class="badge bg-primary">${pendaftar.nisn || pendaftar.nikcalon || pendaftar.nik || "-"
        }</span></div>
          <div class="col-md-6"><strong>NIK:</strong><br>${pendaftar.nikcalon || pendaftar.nik || "-"
        }</div>
          <div class="col-md-12"><strong>Nama Lengkap:</strong><br><span class="fs-5 text-primary">${pendaftar.namalengkap || "-"
        }</span></div>
          <div class="col-md-6"><strong>Tempat Lahir:</strong><br>${pendaftar.tempatlahir || "-"
        }${pendaftar.provinsitempatlahir
          ? ", " + pendaftar.provinsitempatlahir
          : ""
        }</div>
          <div class="col-md-6"><strong>Tanggal Lahir:</strong><br>${pendaftar.tanggallahir || "-"
        }</div>
          <div class="col-md-6"><strong>Jenis Kelamin:</strong><br>${pendaftar.jeniskelamin === "L"
          ? "Laki-laki"
          : pendaftar.jeniskelamin === "P"
            ? "Perempuan"
            : "-"
        }</div>
          <div class="col-md-6"><strong>Telepon Orang Tua:</strong><br>${pendaftar.telepon_orang_tua
          ? `<a href="https://wa.me/62${pendaftar.telepon_orang_tua.replace(
            /^0/,
            ""
          )}" target="_blank">
                   <i class="bi bi-whatsapp text-success"></i> ${pendaftar.telepon_orang_tua
          }
                 </a>`
          : "-"
        }</div>

          <div class="col-12 mt-3"><h6 class="bg-success text-white p-2 rounded">
            <i class="bi bi-geo-alt"></i> Alamat Lengkap
          </h6></div>
          <div class="col-md-12"><strong>Alamat Jalan:</strong><br>${pendaftar.alamatjalan || "-"
        }</div>
          <div class="col-md-6"><strong>Desa/Kelurahan:</strong><br>${pendaftar.desa || "-"
        }</div>
          <div class="col-md-6"><strong>Kecamatan:</strong><br>${pendaftar.kecamatan || "-"
        }</div>
          <div class="col-md-6"><strong>Kabupaten/Kota:</strong><br>${pendaftar.kotakabupaten || pendaftar.kabkota || "-"
        }</div>
          <div class="col-md-6"><strong>Provinsi:</strong><br>${pendaftar.provinsi || "-"
        }</div>

          <div class="col-12 mt-3"><h6 class="bg-success text-white p-2 rounded">
            <i class="bi bi-mortarboard"></i> Pendidikan & Rencana
          </h6></div>
          <div class="col-md-6"><strong>Ijazah Formal Terakhir:</strong><br>${pendaftar.ijazahformalterakhir || "-"
        }</div>
          <div class="col-md-6"><strong>Rencana Tingkat:</strong><br>${pendaftar.rencanatingkat || "-"
        }</div>
          <div class="col-md-6"><strong>Rencana Program:</strong><br>${pendaftar.rencanaprogram || "-"
        }</div>

          <div class="col-12 mt-3"><h6 class="bg-success text-white p-2 rounded">
            <i class="bi bi-people"></i> Data Orang Tua
          </h6></div>
          <div class="col-md-6"><strong>Nama Ayah:</strong><br>${pendaftar.namaayah || "-"
        }</div>
          <div class="col-md-6"><strong>NIK Ayah:</strong><br>${pendaftar.nikayah || "-"
        }</div>
          <div class="col-md-6"><strong>Status Ayah:</strong><br>${badge(
          pendaftar.statusayah || "-",
          pendaftar.statusayah === "Hidup" ? "success" : "secondary"
        )}</div>
          <div class="col-md-6"><strong>Pekerjaan Ayah:</strong><br>${pendaftar.pekerjaanayah || "-"
        }</div>
          <div class="col-md-6"><strong>Nama Ibu:</strong><br>${pendaftar.namaibu || "-"
        }</div>
          <div class="col-md-6"><strong>NIK Ibu:</strong><br>${pendaftar.nikibu || "-"
        }</div>
          <div class="col-md-6"><strong>Status Ibu:</strong><br>${badge(
          pendaftar.statusibu || "-",
          pendaftar.statusibu === "Hidup" ? "success" : "secondary"
        )}</div>
          <div class="col-md-6"><strong>Pekerjaan Ibu:</strong><br>${pendaftar.pekerjaanibu || "-"
        }</div>

          <div class="col-12 mt-3"><h6 class="bg-success text-white p-2 rounded">
            <i class="bi bi-file-earmark-arrow-up"></i> Berkas Upload
          </h6></div>
      `;

      // files
      const files = [
        { key: "file_ijazah", label: "Scan Ijazah", icon: "file-pdf" },
        { key: "file_akta", label: "Scan Akta Kelahiran", icon: "file-pdf" },
        { key: "file_foto", label: "Pas Foto 3x4", icon: "image" },
        { key: "file_kk", label: "Foto Kartu Keluarga", icon: "card-image" },
        { key: "file_bpjs", label: "Kartu BPJS (Opsional)", icon: "file-pdf" },
      ];
      let hasFiles = false;
      files.forEach((f) => {
        const url = pendaftar[f.key];
        if (url) {
          hasFiles = true;
          html += `
            <div class="col-md-6">
              <div class="card border-success">
                <div class="card-body">
                  <h6 class="card-title"><i class="bi bi-${f.icon} text-success"></i> ${f.label}</h6>
                  <a href="${url}" target="_blank" class="btn btn-sm btn-success">
                    <i class="bi bi-download"></i> Download / Lihat
                  </a>
                </div>
              </div>
            </div>`;
        }
      });
      if (!hasFiles) {
        html += `
          <div class="col-12">
            <div class="alert alert-info">
              <i class="bi bi-info-circle"></i> Tidak ada berkas yang diupload
            </div>
          </div>`;
      }
      html += `</div>`;

      // tampilkan modal
      const detailContent = $("#detailContent");
      if (detailContent) detailContent.innerHTML = html;
      const modalEl = $("#detailModal");
      if (modalEl)
        (
          bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl)
        ).show();
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  function openVerifikasiModal(id, status) {
    const idEl = $("#verifikasi-id");
    const stEl = $("#verifikasi-status");
    if (idEl) idEl.value = id;
    if (stEl) stEl.value = status;

    const statusText = {
      diterima: "Diterima",
      revisi: "Perlu Revisi",
      ditolak: "Ditolak",
    };
    const statusColors = {
      diterima: "success",
      revisi: "info",
      ditolak: "danger",
    };

    const title = $("#verifikasiModalTitle");
    if (title) title.textContent = `Verifikasi: ${statusText[status]}`;

    const display = $("#verifikasi-status-display");
    if (display) {
      display.value = statusText[status];
      display.className = `form-control bg-${statusColors[status]} text-white`;
    }

    const catatanLabel = $("#catatanLabel");
    const catatanInput = $("#verifikasi-catatan");
    if (catatanLabel && catatanInput) {
      if (status === "revisi") {
        catatanLabel.textContent = "Catatan Revisi";
        catatanInput.placeholder = "Jelaskan apa yang perlu direvisi...";
      } else if (status === "ditolak") {
        catatanLabel.textContent = "Alasan Penolakan";
        catatanInput.placeholder = "Jelaskan alasan penolakan...";
      } else {
        catatanLabel.textContent = "Catatan";
        catatanInput.placeholder = "Tambahkan catatan (opsional)...";
      }
      catatanInput.value = "";
    }

    const btnConfirm = $("#btnConfirmVerifikasi");
    if (btnConfirm) {
      btnConfirm.className = `btn btn-${statusColors[status]}`;
      btnConfirm.textContent = statusText[status];
    }

    const modalEl = $("#verifikasiModal");
    if (modalEl)
      (
        bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl)
      ).show();
  }

  // 📱 MODAL WHATSAPP - Anti Popup Blocker! (Pendaftaran)
  function showWhatsAppModal(nama, nisn, phone, waLink) {
    // Hapus modal lama jika ada
    const oldModal = document.getElementById('whatsappNotifModal');
    if (oldModal) oldModal.remove();

    // Buat modal baru
    const modalHTML = `
      <div class="modal fade" id="whatsappNotifModal" tabindex="-1" aria-labelledby="whatsappNotifModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title" id="whatsappNotifModalLabel">
                <i class="bi bi-check-circle-fill me-2"></i>Verifikasi Pendaftaran Berhasil!
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body text-center py-4">
              <div class="mb-3">
                <i class="bi bi-whatsapp text-success" style="font-size: 4rem;"></i>
              </div>
              <h6 class="fw-bold mb-3">Kirim Notifikasi WhatsApp</h6>
              <div class="alert alert-info mb-3">
                <small>
                  <strong>Kepada:</strong> ${nama}<br>
                  <strong>NISN:</strong> ${nisn}<br>
                  <strong>Nomor:</strong> ${phone}
                </small>
              </div>
              <p class="text-muted small mb-4">
                Klik tombol di bawah untuk membuka WhatsApp dan mengirim notifikasi verifikasi pendaftaran kepada siswa.
              </p>
              
              <!-- BUTTON UTAMA - Direct user click = No popup blocker! -->
              <a href="${waLink}" 
                 target="_blank" 
                 class="btn btn-success btn-lg w-100 mb-2"
                 onclick="this.classList.add('disabled'); this.innerHTML='<i class=\\'bi bi-check2\\'></i> WhatsApp Terbuka...'; setTimeout(() => { const modal = bootstrap.Modal.getInstance(document.getElementById('whatsappNotifModal')); if (modal) modal.hide(); window.loadPendaftar(); }, 1500);">
                <i class="bi bi-whatsapp me-2"></i>
                Buka WhatsApp & Kirim Notifikasi
              </a>
              
              <button type="button" class="btn btn-outline-secondary w-100" data-bs-dismiss="modal" onclick="window.loadPendaftar();">
                <i class="bi bi-x-circle me-2"></i>Skip, Nanti Saja
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append ke body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Show modal
    const modalEl = document.getElementById('whatsappNotifModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Cleanup saat modal ditutup
    modalEl.addEventListener('hidden.bs.modal', function () {
      modalEl.remove();
    });
  }

  // 📱 MODAL WHATSAPP - Anti Popup Blocker! (Pembayaran)
  function showWhatsAppModalPembayaran(nama, nisn, phone, waLink) {
    // Hapus modal lama jika ada
    const oldModal = document.getElementById('whatsappNotifModalPembayaran');
    if (oldModal) oldModal.remove();

    // Buat modal baru
    const modalHTML = `
      <div class="modal fade" id="whatsappNotifModalPembayaran" tabindex="-1" aria-labelledby="whatsappNotifModalPembayaranLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title" id="whatsappNotifModalPembayaranLabel">
                <i class="bi bi-check-circle-fill me-2"></i>Pembayaran Terverifikasi!
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body text-center py-4">
              <div class="mb-3">
                <i class="bi bi-whatsapp text-success" style="font-size: 4rem;"></i>
              </div>
              <h6 class="fw-bold mb-3">🎉 Proses Pendaftaran Selesai!</h6>
              <div class="alert alert-success mb-3">
                <small>
                  <strong>Kepada:</strong> ${nama}<br>
                  <strong>NISN:</strong> ${nisn}<br>
                  <strong>Nomor:</strong> ${phone}
                </small>
              </div>
              <p class="text-muted small mb-4">
                Klik tombol di bawah untuk membuka WhatsApp dan mengirim notifikasi bahwa pembayaran telah terverifikasi.
              </p>
              
              <!-- BUTTON UTAMA - Direct user click = No popup blocker! -->
              <a href="${waLink}" 
                 target="_blank" 
                 class="btn btn-success btn-lg w-100 mb-2"
                 onclick="this.classList.add('disabled'); this.innerHTML='<i class=\\'bi bi-check2\\'></i> WhatsApp Terbuka...'; setTimeout(() => { const modal = bootstrap.Modal.getInstance(document.getElementById('whatsappNotifModalPembayaran')); if (modal) modal.hide(); window.loadPembayaran(); }, 1500);">
                <i class="bi bi-whatsapp me-2"></i>
                Buka WhatsApp & Kirim Notifikasi
              </a>
              
              <button type="button" class="btn btn-outline-secondary w-100" data-bs-dismiss="modal" onclick="window.loadPembayaran();">
                <i class="bi bi-x-circle me-2"></i>Skip, Nanti Saja
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Append ke body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Show modal
    const modalEl = document.getElementById('whatsappNotifModalPembayaran');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Cleanup saat modal ditutup
    modalEl.addEventListener('hidden.bs.modal', function () {
      modalEl.remove();
    });
  }

  async function confirmVerifikasi() {
    const id = $("#verifikasi-id")?.value;
    const status = $("#verifikasi-status")?.value;
    const catatan = $("#verifikasi-catatan")?.value;
    const adminEmail = localStorage.getItem("adminEmail") || "admin";
    try {
      const r = await fetch("/api/pendaftar_status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: parseInt(id, 10),
          status,
          alasan: catatan || null,
          verifiedBy: adminEmail,
        }),
      });
      const result = await r.json();
      if (result.success) {
        const modal = bootstrap.Modal.getInstance($("#verifikasiModal"));
        if (modal) modal.hide();

        updatePendaftarRowStatus(id, status);

        invalidateStatisticsCache();
        loadPendaftar();

        // 📱 WHATSAPP MANUAL - Tampilkan modal konfirmasi (ANTI POPUP BLOCKER!)
        if (status.toUpperCase() === 'DITERIMA' && result.pendaftar) {
          const { nama, nisn, telepon } = result.pendaftar;

          console.log('[VERIFIKASI] Pendaftar data received:', result.pendaftar);
          console.log('[VERIFIKASI] Phone number:', telepon);

          if (telepon && nama) {
            // Format nomor telepon (hapus karakter non-digit)
            let phone = telepon.replace(/\D/g, '');

            // Tambah 62 jika dimulai dengan 0
            if (phone.startsWith('0')) {
              phone = '62' + phone.substring(1);
            }

            // Template pesan WhatsApp
            const message = encodeURIComponent(
              `Assalamualaikum Wr. Wb.

✅ *Pendaftaran PPDSB Telah DIVERIFIKASI*

• Nama Siswa: *${nama}*
• NISN: ${nisn}

🎉 *Selamat!* Berkas pendaftaran Anda telah diverifikasi dan diterima.

📌 *Langkah Selanjutnya:*
Silakan lakukan pembayaran untuk menyelesaikan proses pendaftaran.

Cek status dan lakukan pembayaran melalui:
https://www.alikhsan-beji.app/cek-status.html

Jazakumullahu khairan,
*PONDOK PESANTREN AL IKHSAN BEJI*`
            );

            const waWeb = `https://wa.me/${phone}?text=${message}`;

            console.log('[VERIFIKASI] Preparing WhatsApp for:', nama, phone);

            // Tampilkan modal WhatsApp (100% tidak kena popup blocker!)
            showWhatsAppModal(nama, nisn, phone, waWeb);
          } else {
            console.warn('[VERIFIKASI] No phone number available for:', nama);
            alert('⚠️ Nomor telepon tidak tersedia. Silakan hubungi manual.');
          }
        } else {
          alert(`✅ Status berhasil diubah menjadi "${status}"!`);
        }
      } else {
        alert("Error: " + (result.error || "Gagal mengubah status"));
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  /* =========================
     DOWNLOAD FOTO ZIP
     ========================= */

  /**
   * Helper function to create slug from name
   */
  function slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')        // Replace spaces with -
      .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
      .replace(/\-\-+/g, '-')      // Replace multiple - with single -
      .replace(/^-+/, '')          // Trim - from start of text
      .replace(/-+$/, '');         // Trim - from end of text
  }

  // expose
  window.lihatDetail = lihatDetail;
  window.openVerifikasiModal = openVerifikasiModal;
  window.confirmVerifikasi = confirmVerifikasi;
  window.updateStatus = updateStatus;

  /* =========================
     4) EXPORT CSV PENDAFTAR
     ========================= */
  /**
   * Export to Excel (.xlsx) via Server-side API
   * Data from v_pendaftar_export view, sorted by rencana_program A-Z
   */
  function exportToExcel() {
    try {
      // Trigger server-side Excel download (no notification, direct download)
      console.log('[EXCEL] Starting export...');
      window.location.href = '/api/export_pendaftar_xlsx';
      console.log('[EXCEL] ✓ Export initiated via server');
    } catch (error) {
      console.error('[EXCEL] Error:', error);
      alert('❌ Error export Excel: ' + error.message);
    }
  }
  window.exportToExcel = exportToExcel;

  /**
   * Download ALL files from ALL pendaftar as ZIP
   */
  async function downloadAllZip(filters = {}) {
    try {
      // Build query string
      const params = new URLSearchParams();

      if (filters.status) {
        params.append('status', filters.status);
      }

      if (filters.date_from) {
        params.append('date_from', filters.date_from);
      }

      if (filters.date_to) {
        params.append('date_to', filters.date_to);
      }

      if (filters.only) {
        params.append('only', filters.only);
      }

      const queryString = params.toString();
      const url = `/api/pendaftar_download_zip${queryString ? '?' + queryString : ''}`;

      // Fetch ZIP generation endpoint (silent, no notification)
      console.log('[ZIP] Requesting:', url);
      console.log('[ZIP] ⏳ Generating ZIP file...');

      const response = await fetch(url);
      const result = await response.json();

      console.log('[ZIP] Response:', result);

      if (!result.ok || !result.download_url) {
        throw new Error(result.error || result.message || 'Gagal membuat file ZIP');
      }

      // Success - log details and start download
      console.log('[ZIP] ✓ ZIP ready:', result.filename, `(${result.size_mb} MB)`);
      console.log('[ZIP] ✓ Total files:', result.success_count, '/', result.total_files);
      console.log('[ZIP] ✓ Download URL:', result.download_url);
      console.log('[ZIP] ✓ Expires in:', result.expires_in);

      // Redirect to signed download URL (silent download)
      window.location.href = result.download_url;

      console.log('[ZIP] ✓ Download initiated via storage URL');
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      alert('❌ Error: ' + error.message);
    }
  }
  window.downloadAllZip = downloadAllZip;

  /* =========================
     5) PEMBAYARAN
     ========================= */
  // Track if pembayaran has been loaded at least once
  let pembayaranLoadedOnce = false;

  function refreshDataAfterPaymentChange() {
    invalidateStatisticsCache();
    loadPembayaran();
    loadPendaftar();
  }

  async function fetchPendaftarContactByIdentifier(identifier) {
    const candidates = dedupeList([
      identifier,
      normalizeDigits(identifier),
      currentPembayaranData?.nisn,
      normalizeDigits(currentPembayaranData?.nisn),
      currentPembayaranData?.nik,
      normalizeDigits(currentPembayaranData?.nik),
      currentPembayaranData?.nikcalon,
      normalizeDigits(currentPembayaranData?.nikcalon),
    ]);

    if (candidates.length === 0) {
      return null;
    }

    // Coba pakai endpoint cek status (mendukung NISN/NIK setelah normalisasi)
    for (const candidate of candidates) {
      const digits = normalizeDigits(candidate);
      if (!digits || (digits.length !== 10 && digits.length !== 16)) continue;
      try {
        const res = await fetch(`/api/pendaftar_cek_status?nisn=${encodeURIComponent(digits)}`);
        const json = await res.json();
        if (res.ok && json.ok && json.data) {
          const phone =
            json.data.telepon_orang_tua ||
            json.data.telepon ||
            "";
          if (phone) {
            return {
              nama: json.data.nama || json.data.namalengkap || "",
              nisn: json.data.nisn || digits,
              telepon: phone,
            };
          }
        }
      } catch (lookupErr) {
        console.warn("[PEMBAYARAN] cek status lookup error:", lookupErr);
      }
    }

    // Fallback: iterate daftar pendaftar per halaman (max 50 data per request)
    try {
      const pageSize = 50;
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const res = await fetch(`/api/pendaftar_list?page=${page}&pageSize=${pageSize}`);
        const json = await res.json();
        if (!res.ok || !json.success) break;

        const dataRows = json.data || [];
        const match = dataRows.find((item) => {
          const rowIdentifiers = dedupeList([
            item.nisn,
            item.nikcalon,
            item.nik,
            normalizeDigits(item.nisn),
            normalizeDigits(item.nikcalon),
            normalizeDigits(item.nik),
          ]);
          return rowIdentifiers.some((id) => candidates.includes(id));
        });

        if (match) {
          return {
            nama: match.nama || match.namalengkap || match.nama_lengkap || "",
            nisn:
              match.nisn ||
              normalizeDigits(match.nikcalon) ||
              candidates[0],
            telepon:
              match.telepon_orang_tua ||
              match.no_hp ||
              match.nomorhportu ||
              "",
          };
        }

        const totalItems =
          json.total ||
          dataRows.length + (page - 1) * pageSize;
        totalPages = Math.max(
          totalPages,
          Math.max(1, Math.ceil(totalItems / pageSize))
        );
        if (dataRows.length < pageSize) {
          break;
        }
        page += 1;
      }
    } catch (fallbackErr) {
      console.warn("[PEMBAYARAN] Fallback pendaftar lookup error:", fallbackErr);
    }

    return null;
  }

  async function loadPembayaran() {
    try {
      console.log('[PEMBAYARAN] 💳 Loading payment data...');

      // Show loading state
      const tbody = $("#pembayaranTableBody");
      if (tbody && !pembayaranLoadedOnce) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Memuat data pembayaran...</td></tr>';
      }

      const r = await fetch("/api/pembayaran_list");
      const result = await r.json();

      pembayaranLoadedOnce = true;
      console.log('[PEMBAYARAN] ✅ Data loaded:', result.data?.length || 0, 'items');

      if (!(result.success && result.data)) return;

      // Tabel (tbody already declared above)
      if (tbody) {
        tbody.innerHTML = result.data
          .map((item, i) => {
            const raw = (item.status || "PENDING").toUpperCase();
            const cls =
              raw === "VERIFIED"
                ? "success"
                : raw === "REJECTED"
                  ? "danger"
                  : "warning";
            return `
            <tr>
              <td>${i + 1}</td>
              <td>${item.nisn || item.nik || "-"}</td>
              <td>${item.nama_lengkap || "-"}</td>
              <td>${rupiah(item.jumlah)}</td>
              <td>${badge(
              raw === "VERIFIED"
                ? "Verified"
                : raw === "REJECTED"
                  ? "Rejected"
                  : "Pending",
              cls
            )}</td>
              <td>${formatIDDate(item.tanggal_upload)}</td>
              <td>
                <button class="btn btn-sm btn-success" onclick="loadPembayaranDetail('${item.nisn || item.nik
              }')">Lihat Detail</button>
              </td>
            </tr>
          `;
          })
          .join("");
      }

      // Statistik
      const totalPending = result.data.filter(
        (p) => (p.status || "PENDING").toUpperCase() === "PENDING"
      ).length;
      const totalVerified = result.data.filter(
        (p) => (p.status || "PENDING").toUpperCase() === "VERIFIED"
      ).length;
      const totalRejected = result.data.filter(
        (p) => (p.status || "PENDING").toUpperCase() === "REJECTED"
      ).length;
      const totalRevenue = result.data
        .filter((p) => (p.status || "PENDING").toUpperCase() === "VERIFIED")
        .reduce((sum, p) => sum + (parseFloat(p.jumlah) || 0), 0);

      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      set("statPending", totalPending);
      set("statVerified", totalVerified);
      set("statRejected", totalRejected);
      set("statRevenue", rupiah(totalRevenue));

      const upd = $("#updateTimePembayaran");
      if (upd)
        upd.textContent = `Data update: ${new Date().toLocaleTimeString(
          "id-ID"
        )}`;
    } catch (e) {
      console.error("loadPembayaran error:", e);
    }
  }

  function viewPembayaranDetail(payment) {
    currentPembayaranData = payment;

    const setText = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    setText("detail-nisn", payment.nisn || payment.nik || "-");
    setText("detail-nama-lengkap", payment.nama_lengkap || "-");
    setText("detail-jumlah", rupiah(payment.jumlah));
    setText("detail-metode", payment.metode_pembayaran || "-");
    setText("detail-tanggal-upload", formatIDDatetime(payment.tanggal_upload));
    setText(
      "detail-tanggal-verifikasi",
      formatIDDatetime(payment.tanggal_verifikasi)
    );
    setText("detail-verified-by", payment.verified_by || "-");
    setText("detail-catatan-admin", payment.catatan_admin || "-");

    const raw = (payment.status || "PENDING").toUpperCase();
    const cls =
      raw === "VERIFIED"
        ? "success"
        : raw === "REJECTED"
          ? "danger"
          : "warning";
    const txt =
      raw === "VERIFIED"
        ? "Verified"
        : raw === "REJECTED"
          ? "Rejected"
          : "Pending";
    const statusEl = $("#detail-status");
    if (statusEl) statusEl.innerHTML = badge(txt, cls);

    const img = $("#detail-bukti-img");
    if (img) {
      if (payment.bukti_pembayaran) {
        img.src = payment.bukti_pembayaran;
        img.style.display = "block";
      } else {
        img.style.display = "none";
      }
    }

    const btnVerify = $("#btnVerifyPayment");
    const btnReject = $("#btnRejectPayment");
    if (btnVerify && btnReject) {
      if (raw === "PENDING") {
        btnVerify.style.display = "inline-block";
        btnReject.style.display = "inline-block";
      } else {
        btnVerify.style.display = "none";
        btnReject.style.display = "none";
      }
    }

    const modalEl = $("#detailPembayaranModal");
    if (modalEl)
      (
        bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl)
      ).show();
  }

  function openVerifikasiPembayaran(status) {
    if (!currentPembayaranData) {
      alert(
        "⚠️ Data pembayaran tidak ditemukan. Silakan buka detail pembayaran terlebih dahulu."
      );
      return;
    }
    $("#verify-nisn").value =
      currentPembayaranData.nisn || currentPembayaranData.nik;
    $("#verify-status").value = status;
    $("#verify-catatan").value = "";

    const title =
      status === "VERIFIED" ? "Terima Pembayaran" : "Tolak Pembayaran";
    const cls = status === "VERIFIED" ? "alert-success" : "alert-danger";
    const text =
      status === "VERIFIED"
        ? `Apakah Anda yakin ingin MENERIMA pembayaran dari <strong>${currentPembayaranData.nama_lengkap}</strong>?`
        : `Apakah Anda yakin ingin MENOLAK pembayaran dari <strong>${currentPembayaranData.nama_lengkap}</strong>?`;

    $("#verifikasiPembayaranTitle").textContent = title;
    const alertBox = $("#verify-alert");
    if (alertBox) {
      alertBox.className = "alert " + cls;
      alertBox.innerHTML = text;
      alertBox.style.display = "";
    }

    // tutup modal detail jika sedang terbuka
    const detailModalEl = $("#detailPembayaranModal");
    if (detailModalEl) {
      const inst = bootstrap.Modal.getInstance(detailModalEl);
      if (inst) inst.hide();
    }

    const verifyEl = $("#verifikasiPembayaranModal");
    if (verifyEl)
      (
        bootstrap.Modal.getInstance(verifyEl) || new bootstrap.Modal(verifyEl)
      ).show();
  }

  async function confirmVerifikasiPembayaran() {
    const identifierInput = $("#verify-nisn").value;
    const status = $("#verify-status").value;
    const catatan = $("#verify-catatan").value;
    const btn = $("#btnConfirmVerifyPayment");

    try {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Proses...';

      const r = await fetch("/api/pembayaran_verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nisn: identifierInput,
          status,
          catatan_admin: catatan,
          verified_by: localStorage.getItem("adminEmail") || "admin",
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Gagal verifikasi");

      // tutup modal verifikasi & detail
      const vModal = bootstrap.Modal.getInstance(
        $("#verifikasiPembayaranModal")
      );
      if (vModal) vModal.hide();
      const dModal = bootstrap.Modal.getInstance($("#detailPembayaranModal"));
      if (dModal) dModal.hide();

      refreshDataAfterPaymentChange();

      if (status === "VERIFIED") {
        try {
          const lookupIdentifier =
            currentPembayaranData?.nisn ||
            currentPembayaranData?.nik ||
            currentPembayaranData?.nikcalon ||
            identifierInput;

          const contact = await fetchPendaftarContactByIdentifier(
            lookupIdentifier
          );

          if (contact && contact.telepon) {
            let phone = normalizeDigits(contact.telepon);
            if (phone.startsWith("0")) {
              phone = "62" + phone.substring(1);
            } else if (!phone.startsWith("62")) {
              phone = "62" + phone;
            }

            const namaLengkap =
              contact.nama ||
              currentPembayaranData?.nama_lengkap ||
              "-";
            const nisnDisplay =
              contact.nisn ||
              currentPembayaranData?.nisn ||
              currentPembayaranData?.nik ||
              lookupIdentifier;

            const message = encodeURIComponent(
              `Assalamualaikum Wr. Wb.

✅ *Pembayaran telah TERVERIFIKASI*

• Nama Siswa: *${namaLengkap}*
• NISN: ${nisnDisplay}
• Jumlah: ${rupiah(currentPembayaranData?.jumlah)}

🎉 *Proses pendaftaran telah SELESAI!*
Kami akan menghubungi Anda kembali untuk informasi lebih lanjut.

Jazakumullahu khairan,
*PONDOK PESANTREN AL IKHSAN BEJI*`
            );

            const waWeb = `https://wa.me/${phone}?text=${message}`;

            showWhatsAppModalPembayaran(
              namaLengkap,
              nisnDisplay,
              phone,
              waWeb
            );
          } else {
            alert("✅ Pembayaran berhasil diverifikasi!");
          }
        } catch (err) {
          console.error("WA notify error:", err);
          alert("✅ Pembayaran berhasil diverifikasi!");
        }
      } else {
        alert(`✅ Pembayaran berhasil di${status.toLowerCase()}!`);
      }
    } catch (e) {
      console.error("verify error:", e);
      alert("❌ Error: " + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = "Konfirmasi";
    }
  }

  async function loadPembayaranDetail(nisn) {
    try {
      const r = await fetch("/api/pembayaran_list");
      const result = await r.json();
      if (result.success && result.data) {
        const payment = result.data.find(
          (p) => (p.nisn || p.nik) === nisn
        );
        if (payment) {
          currentPembayaranData = payment;
          viewPembayaranDetail(payment);
        } else {
          alert("Pembayaran tidak ditemukan.");
        }
      }
    } catch (e) {
      console.error("loadPembayaranDetail error:", e);
    }
  }

  // expose pembayaran fns
  window.loadPembayaran = loadPembayaran;
  window.viewPembayaranDetail = viewPembayaranDetail;
  window.openVerifikasiPembayaran = openVerifikasiPembayaran;
  window.confirmVerifikasiPembayaran = confirmVerifikasiPembayaran;
  window.loadPembayaranDetail = loadPembayaranDetail;

  /* =========================
     6) MODAL CLEANUP HANDLERS
     ========================= */
  document.addEventListener("DOMContentLoaded", () => {
    const detailPembayaranModal = $("#detailPembayaranModal");
    if (detailPembayaranModal) {
      detailPembayaranModal.addEventListener("hidden.bs.modal", () => {
        const img = $("#detail-bukti-img");
        if (img) img.src = "";
        const verifyCatatan = $("#verify-catatan");
        if (verifyCatatan) verifyCatatan.value = "";
      });
    }

    const verifikasiPembayaranModal = $("#verifikasiPembayaranModal");
    if (verifikasiPembayaranModal) {
      verifikasiPembayaranModal.addEventListener("hidden.bs.modal", () => {
        const verifyCatatan = $("#verify-catatan");
        if (verifyCatatan) verifyCatatan.value = "";
        const verifyAlert = $("#verify-alert");
        if (verifyAlert) {
          verifyAlert.className = "alert";
          verifyAlert.textContent = "";
          verifyAlert.style.display = "none";
        }
      });
    }

    const detailModal = $("#detailModal");
    if (detailModal) {
      detailModal.addEventListener("hidden.bs.modal", () => {
        const detailContent = $("#detailContent");
        if (detailContent) detailContent.innerHTML = "";
      });
    }

    const verifikasiModal = $("#verifikasiModal");
    if (verifikasiModal) {
      verifikasiModal.addEventListener("hidden.bs.modal", () => {
        const verifikasiCatatan = $("#verifikasi-catatan");
        if (verifikasiCatatan) verifikasiCatatan.value = "";
      });
    }
  });

  /* =========================
     7) GELOMBANG MANAGEMENT
     ========================= */
  let currentGelombangData = [];

  /**
   * Load gelombang data from API endpoint and render forms
   */
  async function loadGelombangData(forceRefresh = false) {
    const container = document.getElementById('gelombangContainer');
    if (!container) {
      console.error('[GELOMBANG] ❌ Container #gelombangContainer not found!');
      return;
    }

    console.log('[GELOMBANG] ========================================');
    console.log('[GELOMBANG] 📊 Loading gelombang data', forceRefresh ? '(FORCE REFRESH)' : '(normal load)');
    console.log('[GELOMBANG] ========================================');

    // Show loading state
    container.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
          <span class="visually-hidden">Memuat...</span>
        </div>
        <p class="text-muted mt-3"><i class="bi bi-arrow-repeat"></i> ${forceRefresh ? 'Memperbarui' : 'Memuat'} data gelombang...</p>
      </div>
    `;

    try {
      // Fetch gelombang data from API endpoint
      const cacheBuster = forceRefresh ? `?_t=${Date.now()}` : '';
      const url = `/api/get_gelombang_list${cacheBuster}`;

      console.log('[GELOMBANG] Step 1: Fetching from', url);
      const response = await fetch(url);

      console.log('[GELOMBANG] Step 2: Response received');
      console.log('[GELOMBANG]   → Status:', response.status, response.statusText);
      console.log('[GELOMBANG]   → Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GELOMBANG] ❌ HTTP Error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[GELOMBANG] Step 3: JSON parsed successfully');
      console.log('[GELOMBANG]   → Result:', result);

      if (!result.ok) {
        console.error('[GELOMBANG] ❌ API returned ok=false');
        throw new Error(result.error || 'API returned ok=false');
      }

      if (!result.data || !Array.isArray(result.data)) {
        console.error('[GELOMBANG] ❌ Invalid data format:', result);
        throw new Error('Invalid data format: expected array');
      }

      if (result.data.length === 0) {
        console.warn('[GELOMBANG] ⚠️ No gelombang data found');
        throw new Error('No gelombang data found in database');
      }

      console.log('[GELOMBANG] Step 4: Data validation passed');
      console.log('[GELOMBANG]   → Count:', result.data.length, 'gelombang');
      console.log('[GELOMBANG]   → Data:');
      console.table(result.data);

      // Count active gelombang
      const activeCount = result.data.filter(g => g.is_active === true).length;
      console.log('[GELOMBANG]   → Active count:', activeCount);

      if (activeCount === 0) {
        console.warn('[GELOMBANG] ⚠️ WARNING: No active gelombang!');
      } else if (activeCount > 1) {
        console.error('[GELOMBANG] ❌ ERROR: Multiple active gelombang!', activeCount);
      } else {
        const activeGelombang = result.data.find(g => g.is_active === true);
        console.log('[GELOMBANG]   ✅ Active:', activeGelombang.nama, '(ID', activeGelombang.id + ')');
      }

      console.log('[GELOMBANG] Step 5: Storing data and rendering...');
      currentGelombangData = result.data;
      renderGelombangForms(result.data);

      console.log('[GELOMBANG] ========================================');
      console.log('[GELOMBANG] ✅ SUCCESS: Data loaded and rendered!');
      console.log('[GELOMBANG] ========================================');

    } catch (error) {
      console.log('[GELOMBANG] ========================================');
      console.error('[GELOMBANG] ❌ ERROR loading data:', error);
      console.error('[GELOMBANG] ❌ Error message:', error.message);
      console.error('[GELOMBANG] ❌ Error stack:', error.stack);
      console.log('[GELOMBANG] ========================================');

      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle"></i> 
          <strong>Gagal memuat data gelombang:</strong> ${error.message}
          <hr>
          <p class="mb-2"><small>Buka Console (F12) untuk detail error.</small></p>
          <button class="btn btn-sm btn-danger" onclick="loadGelombangData(true)">
            <i class="bi bi-arrow-repeat"></i> Coba Lagi
          </button>
        </div>
      `;
    }
  }

  /**
   * Render gelombang forms with status-based styling
   */
  function renderGelombangForms(gelombangList) {
    const container = document.getElementById('gelombangContainer');
    if (!container) {
      console.error('[GELOMBANG] ❌ renderGelombangForms: Container not found!');
      return;
    }

    console.log('[GELOMBANG] ----------------------------------------');
    console.log('[GELOMBANG] 🎨 RENDERING gelombang forms');
    console.log('[GELOMBANG] ----------------------------------------');
    console.log('[GELOMBANG] Input data:', gelombangList);

    if (!gelombangList || gelombangList.length === 0) {
      console.error('[GELOMBANG] ❌ No data to render!');
      container.innerHTML = '<div class="alert alert-warning">Tidak ada data gelombang</div>';
      return;
    }

    const formsHTML = gelombangList.map((gelombang, index) => {
      // Use is_active from database as source of truth
      const isActive = gelombang.is_active === true;

      // Map is_active to UI colors
      let statusColor, statusBadge, borderColor, buttonHTML;

      if (isActive) {
        statusColor = 'success';  // Green
        statusBadge = 'Aktif';
        borderColor = 'success';
        buttonHTML = `
          <button type="button" class="btn btn-secondary btn-sm" disabled>
            <i class="bi bi-check-circle-fill"></i> Gelombang Aktif
          </button>
        `;
      } else {
        statusColor = 'secondary'; // Gray
        statusBadge = 'Ditutup';
        borderColor = 'secondary';
        buttonHTML = `
          <button type="button" class="btn btn-success btn-sm" onclick="setGelombangActive(${gelombang.id})">
            <i class="bi bi-check-circle"></i> Jadikan Aktif
          </button>
        `;
      }

      console.log(`[GELOMBANG] ${gelombang.nama}:`, {
        id: gelombang.id,
        is_active: isActive,
        badge: statusBadge,
        borderColor: borderColor,
        button: isActive ? 'DISABLED (Aktif)' : 'ENABLED (Jadikan Aktif)'
      });

      return `
        <div class="card mb-3 border-${borderColor}">
          <div class="card-header bg-${borderColor} bg-opacity-10 d-flex justify-content-between align-items-center">
            <h6 class="mb-0">
              <i class="bi bi-${index + 1}-circle"></i> ${gelombang.nama}
            </h6>
            <span class="badge bg-${statusColor}">${statusBadge}</span>
          </div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label"><i class="bi bi-calendar-event"></i> Tanggal Mulai</label>
                <input type="date" class="form-control" id="start_date_${gelombang.id}" 
                       value="${gelombang.start_date}" required>
              </div>
              <div class="col-md-6">
                <label class="form-label"><i class="bi bi-calendar-x"></i> Tanggal Akhir</label>
                <input type="date" class="form-control" id="end_date_${gelombang.id}" 
                       value="${gelombang.end_date}" required>
              </div>
              <div class="col-md-12">
                <label class="form-label"><i class="bi bi-book"></i> Tahun Ajaran</label>
                <input type="text" class="form-control" id="tahun_ajaran_${gelombang.id}" 
                       value="${gelombang.tahun_ajaran}" placeholder="2026/2027" required>
              </div>
            </div>
            <div class="d-flex gap-2 mt-3 flex-wrap">
              <button type="button" class="btn btn-outline-primary btn-sm" onclick="updateGelombang(${gelombang.id})">
                <i class="bi bi-save"></i> Simpan Perubahan
              </button>
              ${buttonHTML}
            </div>
          </div>
        </div>
      `;
    }).join('');

    console.log('[GELOMBANG] Setting container.innerHTML with', gelombangList.length, 'forms');
    container.innerHTML = formsHTML;

    console.log('[GELOMBANG] ----------------------------------------');
    console.log('[GELOMBANG] ✅ RENDER COMPLETE!');
    console.log('[GELOMBANG] ----------------------------------------');
  }

  /**
   * Update gelombang data (FAST - no full reload)
   */
  async function updateGelombang(id) {
    // Ensure ID is a number
    id = parseInt(id, 10);

    const startDate = document.getElementById(`start_date_${id}`).value;
    const endDate = document.getElementById(`end_date_${id}`).value;
    const tahunAjaran = document.getElementById(`tahun_ajaran_${id}`).value;

    // Validate
    if (!startDate || !endDate || !tahunAjaran) {
      safeToastr.error('Semua field harus diisi!');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      safeToastr.error('Tanggal mulai harus lebih kecil atau sama dengan tanggal akhir!');
      return;
    }

    console.log('[GELOMBANG] Updating gelombang:', id, { startDate, endDate, tahunAjaran });

    // Find the button and show minimal loading state
    const button = event.target.closest('button');
    const originalHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-check-circle"></i> Menyimpan...';

    try {
      const response = await fetch('/api/update_gelombang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id,
          start_date: startDate,
          end_date: endDate,
          tahun_ajaran: tahunAjaran
        })
      });

      const result = await response.json();

      console.log('[GELOMBANG] Update response:', result);

      if (!result.ok) {
        throw new Error(result.error || 'Gagal mengupdate gelombang');
      }

      // Update local data cache
      const gelombangIndex = currentGelombangData.findIndex(g => g.id === id);
      if (gelombangIndex !== -1) {
        currentGelombangData[gelombangIndex].start_date = startDate;
        currentGelombangData[gelombangIndex].end_date = endDate;
        currentGelombangData[gelombangIndex].tahun_ajaran = tahunAjaran;
      }

      // Success notification (FAST)
      safeToastr.success('✓ Perubahan berhasil disimpan!');

      // Restore button immediately
      button.disabled = false;
      button.innerHTML = originalHTML;

      // Visual feedback: quick pulse animation
      const card = button.closest('.card');
      if (card) {
        card.style.animation = 'pulse 0.5s ease-in-out';
        setTimeout(() => {
          card.style.animation = '';
        }, 500);
      }

    } catch (error) {
      console.error('[GELOMBANG] Error updating:', error);
      safeToastr.error(`✗ Gagal menyimpan: ${error.message}`);

      // Restore button
      button.disabled = false;
      button.innerHTML = originalHTML;
    }
  }
  window.updateGelombang = updateGelombang;

  /**
   * Set gelombang as active using API endpoint
   * INSTANT UI UPDATE: Button langsung berubah tanpa delay
   */
  async function setGelombangActive(id) {
    // Ensure ID is a number (convert from string if needed)
    id = parseInt(id, 10);

    // Validation
    if (!id || isNaN(id)) {
      console.error('[GELOMBANG] ❌ Invalid ID:', id);
      alert('Error: ID gelombang tidak valid');
      return;
    }

    // Confirmation dialog
    if (!confirm(`Jadikan Gelombang ${id} aktif?\n\nGelombang lain akan otomatis dinonaktifkan.`)) {
      console.log('[GELOMBANG] ⏹️ User cancelled activation');
      return;
    }

    console.log('[GELOMBANG] ========================================');
    console.log('[GELOMBANG] 🚀 START: Activating Gelombang', id);
    console.log('[GELOMBANG] ========================================');

    // Show loading overlay to prevent multiple clicks
    const container = document.getElementById('gelombangContainer');
    const originalContent = container ? container.innerHTML : '';
    if (container) {
      container.style.opacity = '0.6';
      container.style.pointerEvents = 'none';
    }

    try {
      console.log('[GELOMBANG] Step 1: Calling API /api/set_gelombang_active');
      console.log('[GELOMBANG]   → Request payload:', { id: id });

      // Call API endpoint to set gelombang active
      const response = await fetch('/api/set_gelombang_active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: id })
      });

      console.log('[GELOMBANG]   → Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GELOMBANG] ❌ HTTP Error Response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[GELOMBANG] Step 2: API Response received:', result);

      // Check if result has proper structure
      if (result.ok === false) {
        console.error('[GELOMBANG] ❌ API returned ok=false:', result);
        throw new Error(result.error || result.message || 'Failed to activate gelombang');
      }

      // SUCCESS: If result.ok is true OR if response.ok is true (backend succeeded)
      console.log('[GELOMBANG] ✅ Step 2 SUCCESS - API call completed');
      console.log('[GELOMBANG]   → Activated:', result.data || result);

      // Step 3: Broadcast to other tabs via localStorage
      console.log('[GELOMBANG] Step 3: Broadcasting to other tabs via localStorage');
      const updatePayload = {
        timestamp: Date.now(),
        activeId: id,
        action: 'gelombang_activated',
        source: 'admin'
      };

      // Remove old value first (ensures storage event fires in other tabs)
      localStorage.removeItem('gelombang_update');

      // Wait a bit then set new value
      await new Promise(resolve => setTimeout(resolve, 50));
      localStorage.setItem('gelombang_update', JSON.stringify(updatePayload));
      console.log('[GELOMBANG]   ✅ Broadcast sent:', updatePayload);

      // Step 4: Trigger custom event for same-window sync
      console.log('[GELOMBANG] Step 4: Dispatching custom event');
      window.dispatchEvent(new CustomEvent('gelombangUpdated', {
        detail: updatePayload
      }));
      console.log('[GELOMBANG]   ✅ Custom event dispatched');

      // Step 5: RELOAD data from database to ensure UI is accurate
      console.log('[GELOMBANG] Step 5: Reloading data from database (force refresh)');
      console.log('[GELOMBANG]   → Calling loadGelombangData(true)...');

      try {
        await loadGelombangData(true);
        console.log('[GELOMBANG]   ✅ Data reloaded successfully');

        // Verify UI was updated
        const updatedContainer = document.getElementById('gelombangContainer');
        if (updatedContainer) {
          console.log('[GELOMBANG]   → Container content length:', updatedContainer.innerHTML.length);
          console.log('[GELOMBANG]   → Container has gelombang cards:', updatedContainer.querySelectorAll('.card').length);
        }
      } catch (reloadError) {
        console.error('[GELOMBANG]   ❌ Failed to reload data:', reloadError);
        throw reloadError; // Re-throw to trigger error handling
      }

      console.log('[GELOMBANG] ========================================');
      console.log('[GELOMBANG] ✅ SUCCESS: Gelombang', id, 'is now ACTIVE');
      console.log('[GELOMBANG] ========================================');

      // Restore container interaction (loadGelombangData will update content)
      if (container) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
      }

      // Optional: success notification (disabled to avoid third-party issues)
      // Intentionally no toast/alert to keep UX quiet and avoid library errors

      // No need for location.reload() - loadGelombangData(true) already refreshed the UI
      console.log('[GELOMBANG] ✅ UI updated successfully - staying on Gelombang tab');

      // Final verification - check if UI actually updated
      setTimeout(() => {
        const finalContainer = document.getElementById('gelombangContainer');
        if (finalContainer) {
          const activeCards = finalContainer.querySelectorAll('.border-success');
          const inactiveCards = finalContainer.querySelectorAll('.border-secondary');
          console.log('[GELOMBANG] 🔍 Final verification:');
          console.log('[GELOMBANG]   → Active cards (green border):', activeCards.length);
          console.log('[GELOMBANG]   → Inactive cards (gray border):', inactiveCards.length);

          if (activeCards.length === 1) {
            console.log('[GELOMBANG] ✅ UI refresh successful - exactly 1 active gelombang');
          } else {
            console.warn('[GELOMBANG] ⚠️ UI refresh may have failed - unexpected active count:', activeCards.length);
          }
        }
      }, 1000);

      // Enforce a secondary refresh to be extra safe
      setTimeout(async () => {
        try {
          await loadGelombangData(true);
          console.log('[GELOMBANG] 🔁 Forced secondary refresh (success path) completed');
        } catch (e2) {
          console.warn('[GELOMBANG] ⚠️ Secondary refresh (success path) failed');
        }
      }, 800);

    } catch (error) {
      console.log('[GELOMBANG] ========================================');
      console.error('[GELOMBANG] ❌ ERROR during activation:', error);
      console.error('[GELOMBANG] ❌ Error message:', error.message);
      console.error('[GELOMBANG] ❌ Error stack:', error.stack);
      console.log('[GELOMBANG] ========================================');

      // Restore container interaction on error
      if (container) {
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';
      }

      // Silent mode: do not show error toast/alert; rely on auto-refresh fallback

      // Rollback: Force reload from database
      console.log('[GELOMBANG] 🔄 Rollback: Reloading data from database...');
      try {
        await loadGelombangData(true);
        console.log('[GELOMBANG]   ✅ Rollback complete');
      } catch (rollbackError) {
        console.error('[GELOMBANG]   ❌ Rollback failed:', rollbackError);

        // Last resort: manual page refresh
        console.log('[GELOMBANG] 🔄 Last resort: Manual page refresh in 1.5 seconds...');
        setTimeout(() => {
          console.log('[GELOMBANG] 🔄 Refreshing page...');
          location.reload();
        }, 1500);
      }

      // Enforce a second refresh attempt to make sure UI updates
      setTimeout(async () => {
        try {
          await loadGelombangData(true);
          console.log('[GELOMBANG] 🔁 Forced secondary refresh completed');
        } catch (e2) {
          console.warn('[GELOMBANG] ⚠️ Secondary refresh failed');
        }
      }, 800);
    }
  }

  /**
   * Helper: Extract gelombang ID from card element
   */
  function extractIdFromCard(card) {
    const button = card.querySelector('button[onclick*="setGelombangActive"]');
    if (button) {
      const match = button.getAttribute('onclick').match(/setGelombangActive\((\d+)\)/);
      return match ? parseInt(match[1], 10) : null;
    }
    return null;
  }

  // Expose gelombang functions
  window.loadGelombangData = loadGelombangData;
  window.setGelombangActive = setGelombangActive;

  /* =========================
     8) HERO SLIDER MANAGEMENT
     ========================= */

  /**
   * Load and display hero images
   */
  async function loadHeroImages() {
    try {
      console.log('[HERO] Loading hero images...');

      const container = $('#heroImagesContainer');
      if (!container) {
        console.warn('[HERO] Container not found');
        return;
      }

      // Show loading
      container.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted mt-3">Memuat hero images...</p>
        </div>
      `;

      const response = await fetch('/api/hero_images_list');
      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Failed to load hero images');
      }

      const heroImages = result.data || [];
      console.log('[HERO] Loaded', heroImages.length, 'images');

      // Update count
      const countEl = $('#heroImageCount');
      if (countEl) {
        countEl.textContent = heroImages.length;
      }

      if (heroImages.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5">
            <i class="bi bi-images text-muted" style="font-size: 3rem;"></i>
            <p class="text-muted mt-3">Belum ada hero images. Upload gambar pertama Anda!</p>
          </div>
        `;
        return;
      }

      // Render hero images grid with fade-in animation
      // Add CSS for fade-in animation if not already added
      if (!document.getElementById('heroImagesAnimationStyle')) {
        const style = document.createElement('style');
        style.id = 'heroImagesAnimationStyle';
        style.textContent = `
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `;
        document.head.appendChild(style);
      }

      let html = '<div class="row g-3">';

      heroImages.forEach((image, index) => {
        html += `
          <div class="col-md-4" data-image-id="${image.id}" style="animation: fadeInUp 0.4s ease-out ${index * 0.1}s both;">
            <div class="card h-100 shadow-sm">
              <div class="position-relative">
                <img src="${image.image_url}" class="card-img-top" alt="Slider Image ${index + 1}" style="height: 200px; object-fit: cover;">
                <!-- NO OVERLAY - Images display full opacity in slider -->
                <div class="position-absolute top-0 end-0 m-2">
                  <span class="badge bg-primary">Slide ${index + 1}</span>
                </div>
              </div>
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <small class="text-muted">
                    <i class="bi bi-clock"></i> Order: ${image.display_order}
                  </small>
                  <span class="badge ${image.is_active ? 'bg-success' : 'bg-secondary'}">
                    ${image.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-primary flex-fill" onclick="window.open('${image.image_url}', '_blank')">
                    <i class="bi bi-eye"></i> View
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteHeroImage(${image.id}, '${image.image_url}', event)">
                    <i class="bi bi-trash"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      });

      html += '</div>';

      // Smooth update: fade out old content, then fade in new content
      container.style.opacity = '0.5';
      container.style.transition = 'opacity 0.2s';

      setTimeout(() => {
        container.innerHTML = html;
        container.style.opacity = '1';
        console.log('[HERO] ✅ Images rendered');
      }, 150);

    } catch (error) {
      console.error('[HERO] Error:', error);
      const container = $('#heroImagesContainer');
      if (container) {
        container.innerHTML = `
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle"></i> Error: ${error.message}
          </div>
        `;
      }
    }
  }

  /**
   * Handle hero image upload form
   */
  function initHeroUpload() {
    try {
      console.log('[HERO] Initializing upload form...');

      const form = document.getElementById('heroUploadForm');
      const input = document.getElementById('heroImageInput');
      const preview = document.getElementById('heroImagePreview');
      const previewImg = document.getElementById('heroPreviewImg');

      if (!form) {
        console.warn('[HERO] Upload form not found in DOM');
        return;
      }

      if (!input) {
        console.warn('[HERO] Upload input not found in DOM');
        return;
      }

      // Check if already initialized to prevent duplicate listeners
      if (form.dataset.initialized === 'true') {
        console.log('[HERO] Form already initialized, skipping');
        return;
      }

      // Image preview on file select
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
          if (preview) preview.style.display = 'none';
          return;
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert('❌ File terlalu besar! Maksimal 5 MB.');
          input.value = '';
          if (preview) preview.style.display = 'none';
          return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (event) => {
          if (previewImg) previewImg.src = event.target.result;
          if (preview) preview.style.display = 'block';
        };
        reader.onerror = (error) => {
          console.error('[HERO] Error reading file:', error);
          alert('❌ Error membaca file gambar');
        };
        reader.readAsDataURL(file);
      });

      // Handle form submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const file = input.files[0];
        if (!file) {
          alert('❌ Pilih gambar terlebih dahulu!');
          return;
        }

        const btn = document.getElementById('btnUploadHero');
        let originalText = '<i class="bi bi-upload"></i> Upload Gambar';

        try {
          if (btn) {
            originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Uploading...';
          }

          console.log('[HERO] Uploading image:', file.name, 'Size:', file.size, 'bytes');

          // Validate file type
          if (!file.type.startsWith('image/')) {
            throw new Error('File harus berupa gambar');
          }

          // Convert to base64
          console.log('[HERO] Converting to base64...');
          const base64 = await fileToBase64(file);
          console.log('[HERO] Base64 conversion complete, length:', base64.length);

          // Upload to API
          console.log('[HERO] Uploading to API...');
          const response = await fetch('/api/hero_images_upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image_base64: base64,
              filename: file.name
            })
          });

          const result = await response.json();

          if (!result.ok) {
            throw new Error(result.error || 'Upload failed');
          }

          console.log('[HERO] ✅ Upload successful');

          // Reset form immediately for better UX
          form.reset();
          if (preview) preview.style.display = 'none';

          // Restore button state
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
          }

          // Reload images immediately (without waiting for notification)
          await loadHeroImages();

          // Scroll to images container to show the new image
          const container = document.getElementById('heroImagesContainer');
          if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }

          // Show success notification after UI update
          safeToastr.success('✅ Hero image berhasil diupload dan ditambahkan!');

        } catch (error) {
          console.error('[HERO] Upload error:', error);
          console.error('[HERO] Error stack:', error.stack);

          const errorMsg = error.message || 'Unknown error';
          alert('❌ Error upload: ' + errorMsg);

          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
          }
        }
      });

      // Mark as initialized
      form.dataset.initialized = 'true';
      console.log('[HERO] ✅ Upload form initialized successfully');

    } catch (error) {
      console.error('[HERO] Error in initHeroUpload:', error);
      console.error('[HERO] Error stack:', error.stack);
    }
  }

  /**
   * Delete hero image
   */
  async function deleteHeroImage(imageId, imageUrl, event = null) {
    if (!confirm('⚠️ Apakah Anda yakin ingin menghapus hero image ini?\n\nGambar akan langsung terhapus dari slider.')) {
      return;
    }

    // Find the image card element for immediate UI update
    const imageCard = event?.target?.closest?.('.col-md-4') ||
      document.querySelector(`[data-image-id="${imageId}"]`);

    // Store reference for animation
    let cardElement = imageCard;

    try {
      console.log('[HERO] Deleting image ID:', imageId);

      // Start fade-out animation immediately (optimistic UI update)
      if (cardElement) {
        cardElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        cardElement.style.opacity = '0';
        cardElement.style.transform = 'scale(0.9)';
      }

      const response = await fetch(`/api/hero_images_delete?id=${imageId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Delete failed');
      }

      console.log('[HERO] ✅ Image deleted');

      // Remove element from DOM after animation
      if (cardElement) {
        setTimeout(() => {
          if (cardElement && cardElement.parentNode) {
            cardElement.remove();
          }
        }, 300);
      }

      // Reload images to sync with server and update counts
      await loadHeroImages();

      // Show success notification
      safeToastr.success('✅ Hero image berhasil dihapus!');

    } catch (error) {
      console.error('[HERO] Delete error:', error);

      // Revert animation on error
      if (cardElement) {
        cardElement.style.transition = 'opacity 0.3s ease-in, transform 0.3s ease-in';
        cardElement.style.opacity = '1';
        cardElement.style.transform = 'scale(1)';
      }

      safeToastr.error('❌ Error delete: ' + error.message);

      // Reload images on error to ensure consistency
      await loadHeroImages();
    }
  }

  /**
   * Reset hero upload form
   */
  function resetHeroForm() {
    const form = $('#heroUploadForm');
    const preview = $('#heroImagePreview');

    if (form) {
      form.reset();
    }

    if (preview) {
      preview.style.display = 'none';
    }
  }

  /**
   * Helper: Convert file to base64
   */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // Expose hero functions
  window.loadHeroImages = loadHeroImages;
  window.deleteHeroImage = deleteHeroImage;
  window.resetHeroForm = resetHeroForm;

  /* =========================
     9) HERO CAROUSEL MANAGEMENT
     (Gambar Santri PNG di Hero Section)
     ========================= */

  /**
   * Load hero carousel images from Supabase
   */
  async function loadHeroCarouselImages() {
    try {
      console.log('[HERO_CAROUSEL] Loading hero carousel images...');

      const container = document.getElementById('heroCarouselImagesContainer');
      if (!container) {
        console.warn('[HERO_CAROUSEL] Container not found');
        return;
      }

      // Show loading
      container.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted mt-3">Memuat gambar santri...</p>
        </div>
      `;

      // Check if Supabase client is available
      if (typeof window.supabase === 'undefined') {
        throw new Error('Supabase client tidak tersedia');
      }

      // Fetch from Supabase table
      const { data: heroImages, error } = await window.supabase
        .from('hero_images')
        .select('*')
        .order('slide_order', { ascending: true });

      if (error) {
        throw error;
      }

      console.log('[HERO_CAROUSEL] Loaded', heroImages?.length || 0, 'images');

      // Update count
      const countEl = document.getElementById('heroCarouselImageCount');
      if (countEl) {
        countEl.textContent = heroImages?.length || 0;
      }

      if (!heroImages || heroImages.length === 0) {
        container.innerHTML = `
          <div class="text-center py-5">
            <i class="bi bi-person-bounding-box text-muted" style="font-size: 3rem;"></i>
            <p class="text-muted mt-3">Belum ada gambar santri. Upload gambar pertama!</p>
          </div>
        `;
        return;
      }

      // Render hero carousel images grid
      let html = '<div class="row g-3">';

      heroImages.forEach((image, index) => {
        const statusBadge = image.is_active
          ? '<span class="badge bg-success">Active</span>'
          : '<span class="badge bg-secondary">Inactive</span>';

        html += `
          <div class="col-md-4" data-carousel-id="${image.id}">
            <div class="card h-100 shadow-sm border-${image.is_active ? 'success' : 'secondary'}">
              <div class="position-relative" style="background: linear-gradient(135deg, #0d9463, #065f46); border-radius: 8px 8px 0 0; padding: 20px;">
                <img src="${image.image_url}" class="card-img-top" alt="${image.alt_text || 'Santri'}" 
                  style="height: 200px; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">
                <div class="position-absolute top-0 start-0 m-2">
                  <span class="badge bg-primary">Slide ${image.slide_order}</span>
                </div>
                <div class="position-absolute top-0 end-0 m-2">
                  ${statusBadge}
                </div>
              </div>
              <div class="card-body">
                <p class="card-text small text-muted mb-2">
                  <i class="bi bi-tag"></i> ${image.alt_text || 'Santri Al Ikhsan Beji'}
                </p>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-primary flex-fill" onclick="window.open('${image.image_url}', '_blank')">
                    <i class="bi bi-eye"></i> View
                  </button>
                  <button class="btn btn-sm btn-outline-warning" onclick="toggleHeroCarouselActive('${image.id}', ${!image.is_active})">
                    <i class="bi bi-${image.is_active ? 'eye-slash' : 'eye'}"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="deleteHeroCarouselImage('${image.id}', '${image.image_url}')">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      });

      html += '</div>';
      container.innerHTML = html;
      console.log('[HERO_CAROUSEL] ✅ Images rendered');

    } catch (error) {
      console.error('[HERO_CAROUSEL] Error:', error);
      const container = document.getElementById('heroCarouselImagesContainer');
      if (container) {
        container.innerHTML = `
          <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle"></i> Error: ${error.message}
          </div>
        `;
      }
    }
  }

  /**
   * Initialize hero carousel upload form
   */
  function initHeroCarouselUpload() {
    try {
      console.log('[HERO_CAROUSEL] Initializing upload form...');

      const form = document.getElementById('heroCarouselUploadForm');
      const input = document.getElementById('heroCarouselImageInput');
      const preview = document.getElementById('heroCarouselImagePreview');

      if (!form || !input) {
        console.warn('[HERO_CAROUSEL] Form elements not found');
        return;
      }

      if (form.dataset.initialized === 'true') {
        console.log('[HERO_CAROUSEL] Form already initialized');
        return;
      }

      // Image preview
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
          preview.innerHTML = `
            <div class="text-muted">
              <i class="bi bi-image" style="font-size: 3rem;"></i>
              <p class="mb-0 mt-2">Pilih gambar untuk melihat preview</p>
            </div>
          `;
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          alert('❌ File terlalu besar! Maksimal 5 MB.');
          input.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          preview.innerHTML = `
            <img src="${event.target.result}" class="img-fluid rounded" style="max-height: 200px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));">
          `;
        };
        reader.readAsDataURL(file);
      });

      // Form submit
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const file = input.files[0];
        if (!file) {
          alert('❌ Pilih gambar terlebih dahulu!');
          return;
        }

        const slideOrder = document.getElementById('heroCarouselSlideOrder').value;
        const altText = document.getElementById('heroCarouselAltText').value || 'Santri Al Ikhsan Beji';
        const btn = document.getElementById('btnUploadHeroCarousel');
        const originalText = btn.innerHTML;

        try {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Uploading...';

          // Check if Supabase client is available
          if (typeof window.supabase === 'undefined') {
            throw new Error('Supabase client tidak tersedia');
          }

          // Generate unique filename
          const timestamp = Date.now();
          const ext = file.name.split('.').pop();
          const filename = `santri_${slideOrder}_${timestamp}.${ext}`;

          console.log('[HERO_CAROUSEL] Uploading:', filename);

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await window.supabase.storage
            .from('hero-images')
            .upload(`carousel/${filename}`, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            throw uploadError;
          }

          // Get public URL
          const { data: urlData } = window.supabase.storage
            .from('hero-images')
            .getPublicUrl(`carousel/${filename}`);

          const imageUrl = urlData.publicUrl;
          console.log('[HERO_CAROUSEL] Image URL:', imageUrl);

          // Check if slide order already exists
          const { data: existing } = await window.supabase
            .from('hero_images')
            .select('id')
            .eq('slide_order', parseInt(slideOrder))
            .single();

          if (existing) {
            // Update existing record
            const { error: updateError } = await window.supabase
              .from('hero_images')
              .update({
                image_url: imageUrl,
                alt_text: altText,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);

            if (updateError) throw updateError;
            console.log('[HERO_CAROUSEL] Updated existing slide', slideOrder);
          } else {
            // Insert new record
            const { error: insertError } = await window.supabase
              .from('hero_images')
              .insert({
                slide_order: parseInt(slideOrder),
                image_url: imageUrl,
                alt_text: altText,
                is_active: true
              });

            if (insertError) throw insertError;
            console.log('[HERO_CAROUSEL] Inserted new slide', slideOrder);
          }

          // Reset form and reload
          form.reset();
          preview.innerHTML = `
            <div class="text-muted">
              <i class="bi bi-image" style="font-size: 3rem;"></i>
              <p class="mb-0 mt-2">Pilih gambar untuk melihat preview</p>
            </div>
          `;

          await loadHeroCarouselImages();
          safeToastr.success('✅ Gambar santri berhasil diupload!');

        } catch (error) {
          console.error('[HERO_CAROUSEL] Upload error:', error);
          alert('❌ Error upload: ' + error.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });

      form.dataset.initialized = 'true';
      console.log('[HERO_CAROUSEL] ✅ Upload form initialized');

    } catch (error) {
      console.error('[HERO_CAROUSEL] Init error:', error);
    }
  }

  /**
   * Delete hero carousel image
   */
  async function deleteHeroCarouselImage(imageId, imageUrl) {
    if (!confirm('⚠️ Hapus gambar santri ini dari hero carousel?')) {
      return;
    }

    try {
      console.log('[HERO_CAROUSEL] Deleting:', imageId);

      // Delete from database
      const { error } = await window.supabase
        .from('hero_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      // Also try to delete from storage (extract path from URL)
      try {
        const urlPath = new URL(imageUrl).pathname;
        const storagePath = urlPath.split('/hero-images/')[1];
        if (storagePath) {
          await window.supabase.storage.from('hero-images').remove([storagePath]);
        }
      } catch (storageError) {
        console.warn('[HERO_CAROUSEL] Storage cleanup failed:', storageError);
      }

      await loadHeroCarouselImages();
      safeToastr.success('✅ Gambar santri berhasil dihapus!');

    } catch (error) {
      console.error('[HERO_CAROUSEL] Delete error:', error);
      alert('❌ Error delete: ' + error.message);
    }
  }

  /**
   * Toggle hero carousel image active status
   */
  async function toggleHeroCarouselActive(imageId, isActive) {
    try {
      const { error } = await window.supabase
        .from('hero_images')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', imageId);

      if (error) throw error;

      await loadHeroCarouselImages();
      safeToastr.success(isActive ? '✅ Gambar diaktifkan!' : '⏸️ Gambar dinonaktifkan!');

    } catch (error) {
      console.error('[HERO_CAROUSEL] Toggle error:', error);
      alert('❌ Error: ' + error.message);
    }
  }

  /**
   * Reset hero carousel form
   */
  function resetHeroCarouselForm() {
    const form = document.getElementById('heroCarouselUploadForm');
    const preview = document.getElementById('heroCarouselImagePreview');

    if (form) form.reset();
    if (preview) {
      preview.innerHTML = `
        <div class="text-muted">
          <i class="bi bi-image" style="font-size: 3rem;"></i>
          <p class="mb-0 mt-2">Pilih gambar untuk melihat preview</p>
        </div>
      `;
    }
  }

  // Expose hero carousel functions
  window.loadHeroCarouselImages = loadHeroCarouselImages;
  window.deleteHeroCarouselImage = deleteHeroCarouselImage;
  window.toggleHeroCarouselActive = toggleHeroCarouselActive;
  window.resetHeroCarouselForm = resetHeroCarouselForm;

  // Initialize on tab switch
  const originalSwitchTab = window.switchTab;
  window.switchTab = function (tabName) {
    if (typeof originalSwitchTab === 'function') {
      originalSwitchTab(tabName);
    }
    if (tabName === 'hero-carousel') {
      loadHeroCarouselImages();
      initHeroCarouselUpload();
    }
  };

  /* =========================
     10) WHY SECTION MANAGEMENT
     ========================= */

  const WHY_SECTION_LANGS = ['id', 'en'];
  const WHY_SECTION_LABEL = {
    id: { name: 'Bahasa Indonesia', flag: '🇮🇩' },
    en: { name: 'English', flag: '🇬🇧' }
  };
  let whySectionActiveLang = 'id';

  const toLangFieldId = (field, lang) =>
    `why${field.charAt(0).toUpperCase()}${field.slice(1)}_${lang}`;

  const getWhyInput = (field, lang) =>
    document.getElementById(toLangFieldId(field, lang));

  const normalizeWhyField = (data, key) => {
    const result = { id: '', en: '' };
    const value = data?.[key];

    if (value && typeof value === 'object') {
      if (typeof value.id === 'string') result.id = value.id;
      if (typeof value.en === 'string') result.en = value.en;
    } else if (typeof value === 'string') {
      result.id = value;
    }

    const idKeyCandidates = [`${key}_id`, `${key}Id`];
    const enKeyCandidates = [`${key}_en`, `${key}En`];

    idKeyCandidates.forEach((candidate) => {
      if (typeof data?.[candidate] === 'string') {
        result.id = data[candidate];
      }
    });

    enKeyCandidates.forEach((candidate) => {
      if (typeof data?.[candidate] === 'string') {
        result.en = data[candidate];
      }
    });

    return result;
  };

  const setWhySectionActiveLang = (lang) => {
    if (!WHY_SECTION_LANGS.includes(lang)) return;
    whySectionActiveLang = lang;

    document
      .querySelectorAll('[data-why-lang-button]')
      .forEach((button) => {
        const isActive = button.dataset.whyLangButton === lang;
        button.classList.toggle('active', isActive);
        button.classList.toggle('btn-warning', isActive);
        button.classList.toggle('btn-outline-warning', !isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });

    document
      .querySelectorAll('[data-why-lang-pane]')
      .forEach((pane) => {
        pane.classList.toggle(
          'd-none',
          pane.dataset.whyLangPane !== lang
        );
      });

    updateWhyPreview();
  };

  const collectWhySectionValues = () =>
    WHY_SECTION_LANGS.reduce((acc, lang) => {
      acc[lang] = {
        title: (getWhyInput('title', lang)?.value || '').trim(),
        subtitle: (getWhyInput('subtitle', lang)?.value || '').trim(),
        content: (getWhyInput('content', lang)?.value || '').trim()
      };
      return acc;
    }, {});

  /**
   * Load Why Section data and populate form
   */
  async function loadWhySectionData() {
    try {
      console.log('[WHY_SECTION] Loading Why Section data...');

      const response = await fetch('/api/why_section_list');
      const result = await response.json();

      if (!result.ok || !result.data) {
        console.error('[WHY_SECTION] Failed to load data');
        safeToastr.error('Gagal memuat data Why Section');
        return;
      }

      const data = result.data || {};

      const titleData = normalizeWhyField(data, 'title');
      const subtitleData = normalizeWhyField(data, 'subtitle');
      const contentData = normalizeWhyField(data, 'content');

      WHY_SECTION_LANGS.forEach((lang) => {
        const titleInput = getWhyInput('title', lang);
        const subtitleInput = getWhyInput('subtitle', lang);
        const contentInput = getWhyInput('content', lang);

        if (titleInput) titleInput.value = titleData[lang] || '';
        if (subtitleInput) subtitleInput.value = subtitleData[lang] || '';
        if (contentInput) contentInput.value = contentData[lang] || '';
      });

      // Always show Indonesian first
      setWhySectionActiveLang('id');
      updateWhyPreview();

      console.log('[WHY_SECTION] ✅ Data loaded successfully');
    } catch (error) {
      console.error('[WHY_SECTION] Error loading data:', error);
      safeToastr.error('Error: ' + error.message);
    }
  }

  /**
   * Update preview of Why Section
   */
  function updateWhyPreview() {
    const preview = document.getElementById('whyPreview');
    if (!preview) return;

    const activeLang = whySectionActiveLang || 'id';
    const inputs = collectWhySectionValues();
    const data = inputs[activeLang] || { title: '', subtitle: '', content: '' };
    const label = WHY_SECTION_LABEL[activeLang];

    if (!data.title && !data.content) {
      preview.innerHTML =
        '<p class="text-muted text-center mb-0">Preview akan muncul setelah mengisi form</p>';
      return;
    }

    const subtitleHtml = data.subtitle
      ? `<p class="text-muted mb-4">${data.subtitle}</p>`
      : '';
    const contentHtml = data.content
      ? `<p class="text-muted mb-0" style="white-space: pre-line;">${data.content}</p>`
      : '<p class="text-muted mb-0 fst-italic">Konten belum diisi.</p>';

    preview.innerHTML = `
      <div class="text-start">
        <div class="d-flex align-items-center gap-2 mb-3">
          <span class="fs-4">${label?.flag || ''}</span>
          <span class="fw-semibold">${label?.name || ''}</span>
        </div>
        <h2 class="h3 mb-3">${data.title || 'Judul'}</h2>
        ${subtitleHtml}
        ${contentHtml}
      </div>
    `;
  }

  /**
   * Save Why Section data
   */
  async function saveWhySection(event) {
    if (event) {
      event.preventDefault();
    }

    try {
      const btnSave = document.getElementById('btnSaveWhy');
      const values = collectWhySectionValues();

      const missingLangs = WHY_SECTION_LANGS.filter(
        (lang) => !values[lang].title || !values[lang].content
      );

      if (missingLangs.length) {
        const missingLabels = missingLangs
          .map((lang) => WHY_SECTION_LABEL[lang]?.name || lang)
          .join(', ');
        safeToastr.warning(
          `Judul dan konten wajib diisi untuk bahasa: ${missingLabels}`
        );
        return;
      }

      const payload = {
        title: values.id.title,
        subtitle: values.id.subtitle,
        content: values.id.content,
        title_en: values.en.title,
        subtitle_en: values.en.subtitle,
        content_en: values.en.content,
        translations: {
          title: {
            id: values.id.title,
            en: values.en.title
          },
          subtitle: {
            id: values.id.subtitle,
            en: values.en.subtitle
          },
          content: {
            id: values.id.content,
            en: values.en.content
          }
        }
      };

      const originalText = btnSave ? btnSave.innerHTML : '';
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML =
          '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
      }

      console.log('[WHY_SECTION] Saving data...', payload);

      const response = await fetch('/api/why_section_update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Gagal menyimpan data');
      }

      console.log('[WHY_SECTION] ✅ Data saved successfully');

      safeToastr.success('✅ Why Section berhasil disimpan!');

      updateWhyPreview();

      localStorage.setItem(
        'why_section_update',
        JSON.stringify({
          timestamp: Date.now(),
          action: 'updated'
        })
      );

      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
      }
    } catch (error) {
      console.error('[WHY_SECTION] Error saving:', error);

      safeToastr.error('❌ Error: ' + error.message);

      const btnSave = document.getElementById('btnSaveWhy');
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML =
          '<i class="bi bi-save"></i> Simpan Perubahan';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    WHY_SECTION_LANGS.forEach((lang) => {
      ['title', 'subtitle', 'content'].forEach((field) => {
        const input = getWhyInput(field, lang);
        if (input) {
          input.addEventListener('input', updateWhyPreview);
        }
      });
    });

    document
      .querySelectorAll('[data-why-lang-button]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          setWhySectionActiveLang(button.dataset.whyLangButton);
        });
      });

    setWhySectionActiveLang('id');
  });

  window.loadWhySectionData = loadWhySectionData;
  window.saveWhySection = saveWhySection;
  window.updateWhyPreview = updateWhyPreview;

  /* =========================
     8) INFORMASI PAGES (Alur, Syarat, Biaya, Brosur, Kontak)
     ========================= */
  const sortByOrderIndex = (list = []) =>
    [...list].sort(
      (a, b) => toInteger(a?.order_index, 0) - toInteger(b?.order_index, 0)
    );

  const parseId = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  async function persistInformasiOrder(endpointKey, list, successMessage, reloadFn) {
    const endpoint = INFORMASI_ENDPOINTS[endpointKey];
    if (!endpoint) return;

    const payload = {
      items: list.map((item, idx) => ({
        id: item.id,
        order_index: idx + 1,
      })),
    };

    try {
      await jsonRequest(endpoint, { method: "PUT", body: payload });
      if (successMessage) {
        safeToastr.success(successMessage);
      }
      const storageMap = {
        alur: "alur_steps_update",
        syarat: "syarat_items_update",
        biaya: "biaya_items_update",
        brosur: "brosur_items_update",
        kontak: "kontak_items_update",
      };
      const storageKey = storageMap[endpointKey];
      if (storageKey) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            timestamp: Date.now(),
            action: "reordered",
          })
        );
      }
    } catch (error) {
      console.error(`[${endpointKey.toUpperCase()}][ORDER] Error:`, error);
      safeToastr.error(error.message || "Gagal memperbarui urutan");
    } finally {
      if (typeof reloadFn === "function") {
        await reloadFn(false);
      }
    }
  }

  /* ---------- Alur Pendaftaran ---------- */
  const getAlurInput = (field, lang) =>
    document.getElementById(`alur${capitalize(field)}_${lang}`);

  const resolveAlurField = (record = {}, field, lang) => {
    const normalizedLang = lang === "en" ? "en" : "id";
    const translations =
      (record.translations && record.translations[field]) || null;

    if (normalizedLang === "id") {
      const direct = record[field];
      if (typeof direct === "string" && direct.trim()) return direct.trim();
    } else {
      const explicit = record[`${field}_${normalizedLang}`];
      if (typeof explicit === "string" && explicit.trim()) {
        return explicit.trim();
      }
    }

    if (translations && typeof translations === "object") {
      const candidate = translations[normalizedLang];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    if (normalizedLang === "en") {
      const fallback = record[field];
      if (typeof fallback === "string" && fallback.trim()) {
        return fallback.trim();
      }
    } else {
      const fallback = record[`${field}_en`];
      if (typeof fallback === "string" && fallback.trim()) {
        return fallback.trim();
      }
    }

    return "";
  };

  const normalizeAlurRecord = (record = {}) => ({
    ...record,
    title: resolveAlurField(record, "title", "id"),
    description: resolveAlurField(record, "description", "id"),
    title_en: resolveAlurField(record, "title", "en"),
    description_en: resolveAlurField(record, "description", "en"),
  });

  const collectAlurFormValues = () =>
    ALUR_LANGS.reduce((acc, lang) => {
      acc[lang] = {
        title: (getAlurInput("title", lang)?.value || "").trim(),
        description: (getAlurInput("description", lang)?.value || "").trim(),
      };
      return acc;
    }, {});

  function setAlurActiveLang(lang) {
    if (!ALUR_LANGS.includes(lang)) return;
    alurActiveLang = lang;

    document
      .querySelectorAll("[data-alur-lang-button]")
      .forEach((button) => {
        const isActive = button.dataset.alurLangButton === lang;
        button.classList.toggle("active", isActive);
        button.classList.toggle("btn-success", isActive);
        button.classList.toggle("btn-outline-success", !isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });

    document
      .querySelectorAll("[data-alur-lang-pane]")
      .forEach((pane) => {
        pane.classList.toggle(
          "d-none",
          pane.dataset.alurLangPane !== lang
        );
      });
  }

  function resetAlurForm() {
    const form = $("#alurForm");
    if (form) form.reset();
    const idField = $("#alurId");
    if (idField) idField.value = "";
    ALUR_LANGS.forEach((lang) => {
      const titleInput = getAlurInput("title", lang);
      if (titleInput) titleInput.value = "";
      const descInput = getAlurInput("description", lang);
      if (descInput) descInput.value = "";
    });
    const btn = $("#btnSaveAlur");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Simpan Langkah';
    setAlurActiveLang("id");
  }

  function populateAlurForm(item) {
    if (!item) return;
    const idField = $("#alurId");
    if (idField) idField.value = item.id;
    const normalized = normalizeAlurRecord(item);
    ALUR_LANGS.forEach((lang) => {
      const titleField = getAlurInput("title", lang);
      if (titleField)
        titleField.value =
          normalized[lang === "en" ? "title_en" : "title"] || "";
      const descField = getAlurInput("description", lang);
      if (descField)
        descField.value =
          normalized[lang === "en" ? "description_en" : "description"] || "";
    });
    const btn = $("#btnSaveAlur");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Update Langkah';
    const activeInput = getAlurInput("title", alurActiveLang);
    (activeInput || getAlurInput("title", "id"))?.focus();
  }

  async function loadAlurSteps(showToast = false) {
    const tbody = $("#alurTableBody");
    if (tbody) renderLoadingRow(tbody, 4, "Memuat data alur...");

    try {
      const result = await jsonRequest(INFORMASI_ENDPOINTS.alur);
      alurStepsData = sortByOrderIndex(
        (result.data || []).map((item) => normalizeAlurRecord(item))
      );
      renderAlurSteps();
      if (showToast) {
        safeToastr.success("Data alur pendaftaran dimuat");
      }
    } catch (error) {
      console.error("[ALUR] Load error:", error);
      if (tbody) {
        renderEmptyRow(tbody, 4, "Gagal memuat data alur");
      }
      safeToastr.error(error.message || "Gagal memuat data alur");
    }
  }

  function renderAlurSteps() {
    const tbody = $("#alurTableBody");
    if (!tbody) return;

    if (!alurStepsData.length) {
      renderEmptyRow(
        tbody,
        4,
        "Belum ada langkah alur. Tambahkan langkah baru melalui form."
      );
      return;
    }

    const rows = alurStepsData
      .map((item, index) => {
        const orderNumber = index + 1;
        const disableUp = index === 0 ? "disabled" : "";
        const disableDown =
          index === alurStepsData.length - 1 ? "disabled" : "";

        return `
          <tr data-id="${item.id}">
            <td>
              <span class="badge bg-primary">${orderNumber}</span>
              <div class="btn-group btn-group-sm ms-2">
                <button type="button" class="btn btn-outline-secondary" onclick="moveAlurStep(${item.id}, 'up')" ${disableUp}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary" onclick="moveAlurStep(${item.id}, 'down')" ${disableDown}>
                  <i class="bi bi-arrow-down"></i>
                </button>
              </div>
            </td>
            <td>
              <strong>${escapeHtml(item.title || "")}</strong>
              ${item.title_en && item.title_en !== item.title
            ? `<div class="text-muted small"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.title_en)}</div>`
            : ""
          }
            </td>
            <td>
              ${escapeHtml(item.description || "")}
              ${item.description_en &&
            item.description_en !== item.description
            ? `<div class="text-muted small mt-1"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.description_en)}</div>`
            : ""
          }
            </td>
            <td>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-warning" onclick="editAlurStep(${item.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-danger" onclick="deleteAlurStep(${item.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.innerHTML = rows;
  }

  async function handleAlurSubmit(event) {
    event.preventDefault();

    const idValue = $("#alurId")?.value;
    const id = parseId(idValue);
    const values = collectAlurFormValues();

    const missing = ALUR_LANGS.filter(
      (lang) => !values[lang].title || !values[lang].description
    );

    if (missing.length) {
      const label = missing
        .map((lang) => ALUR_LABEL[lang]?.name || lang.toUpperCase())
        .join(", ");
      safeToastr.warning(
        `Judul dan deskripsi wajib diisi untuk bahasa: ${label}`
      );
      return;
    }

    const btn = $("#btnSaveAlur");
    setButtonLoading(btn, true, id ? "Mengupdate..." : "Menyimpan...");

    try {
      const payload = {
        title: values.id.title,
        description: values.id.description,
        title_en: values.en.title,
        description_en: values.en.description,
      };
      let message = "Langkah alur ditambahkan";
      if (id) {
        payload.id = id;
        message = "Langkah alur diperbarui";
        await jsonRequest(INFORMASI_ENDPOINTS.alur, {
          method: "PUT",
          body: payload,
        });
      } else {
        await jsonRequest(INFORMASI_ENDPOINTS.alur, {
          method: "POST",
          body: payload,
        });
      }

      safeToastr.success(message);
      localStorage.setItem(
        "alur_steps_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: id ? "updated" : "created",
          id: id || null,
        })
      );
      resetAlurForm();
      await loadAlurSteps(false);
    } catch (error) {
      console.error("[ALUR] Save error:", error);
      safeToastr.error(error.message || "Gagal menyimpan langkah alur");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  function editAlurStep(id) {
    const item = alurStepsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) {
      safeToastr.warning("Data tidak ditemukan");
      return;
    }
    populateAlurForm(item);
  }

  async function deleteAlurStep(id) {
    const item = alurStepsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) return;

    if (
      !confirm(
        `Hapus langkah "${item.title}"?\nTindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }

    try {
      await jsonRequest(INFORMASI_ENDPOINTS.alur, {
        method: "DELETE",
        body: { id: item.id },
      });
      safeToastr.success("Langkah alur dihapus");
      localStorage.setItem(
        "alur_steps_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: "deleted",
          id: item.id,
        })
      );
      resetAlurForm();
      await loadAlurSteps(false);
    } catch (error) {
      console.error("[ALUR] Delete error:", error);
      safeToastr.error(error.message || "Gagal menghapus langkah alur");
    }
  }

  function moveAlurStep(id, direction) {
    const index = alurStepsData.findIndex(
      (row) => Number(row.id) === Number(id)
    );
    if (index === -1) return;

    const delta = direction === "up" ? -1 : 1;
    const newIndex = index + delta;

    if (newIndex < 0 || newIndex >= alurStepsData.length) {
      return;
    }

    const updated = [...alurStepsData];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    updated.forEach((item, idx) => {
      item.order_index = idx + 1;
    });
    alurStepsData = updated;
    renderAlurSteps();
    persistInformasiOrder(
      "alur",
      updated,
      "Urutan alur diperbarui",
      loadAlurSteps
    );
  }

  /* ---------- Syarat Pendaftaran ---------- */
  const getSyaratInput = (lang) =>
    document.getElementById(`syaratName_${lang}`);

  const resolveSyaratName = (record = {}, lang) => {
    const normalizedLang = lang === "en" ? "en" : "id";
    if (normalizedLang === "en") {
      const enVal = record.name_en;
      if (typeof enVal === "string" && enVal.trim()) {
        return enVal.trim();
      }
    }
    const base = record.name;
    if (typeof base === "string" && base.trim()) {
      return base.trim();
    }
    if (normalizedLang === "id") {
      const fallback = record.name_en;
      if (typeof fallback === "string" && fallback.trim()) {
        return fallback.trim();
      }
    } else {
      const fallback = record.name;
      if (typeof fallback === "string" && fallback.trim()) {
        return fallback.trim();
      }
    }
    return "";
  };

  const normalizeSyaratRecord = (record = {}) => ({
    ...record,
    name: resolveSyaratName(record, "id"),
    name_en: resolveSyaratName(record, "en"),
  });

  const collectSyaratValues = () =>
    SYARAT_LANGS.reduce((acc, lang) => {
      acc[lang] = {
        name: (getSyaratInput(lang)?.value || "").trim(),
      };
      return acc;
    }, {});

  function setSyaratActiveLang(lang) {
    if (!SYARAT_LANGS.includes(lang)) return;
    syaratActiveLang = lang;
    document
      .querySelectorAll("[data-syarat-lang-button]")
      .forEach((button) => {
        const isActive = button.dataset.syaratLangButton === lang;
        button.classList.toggle("active", isActive);
        button.classList.toggle("btn-success", isActive);
        button.classList.toggle("btn-outline-success", !isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    document
      .querySelectorAll("[data-syarat-lang-pane]")
      .forEach((pane) => {
        pane.classList.toggle(
          "d-none",
          pane.dataset.syaratLangPane !== lang
        );
      });
  }

  function resetSyaratForm() {
    const form = $("#syaratForm");
    if (form) form.reset();
    const idField = $("#syaratId");
    if (idField) idField.value = "";
    SYARAT_LANGS.forEach((lang) => {
      const input = getSyaratInput(lang);
      if (input) input.value = "";
    });
    const btn = $("#btnSaveSyarat");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Simpan Syarat';
    setSyaratActiveLang("id");
  }

  function populateSyaratForm(item) {
    const normalized = normalizeSyaratRecord(item);
    const idField = $("#syaratId");
    if (idField) idField.value = item.id;
    SYARAT_LANGS.forEach((lang) => {
      const input = getSyaratInput(lang);
      if (input)
        input.value =
          normalized[lang === "en" ? "name_en" : "name"] || "";
    });
    const btn = $("#btnSaveSyarat");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Update Syarat';
    setSyaratActiveLang("id");
    getSyaratInput("id")?.focus();
  }

  async function loadSyaratItems(showToast = false) {
    const tbody = $("#syaratTableBody");
    if (tbody) renderLoadingRow(tbody, 3, "Memuat data syarat...");

    try {
      const result = await jsonRequest(INFORMASI_ENDPOINTS.syarat);
      syaratItemsData = sortByOrderIndex(
        (result.data || []).map((item) => normalizeSyaratRecord(item))
      );
      renderSyaratItems();
      if (showToast) {
        safeToastr.success("Data syarat dimuat");
      }
    } catch (error) {
      console.error("[SYARAT] Load error:", error);
      if (tbody) renderEmptyRow(tbody, 3, "Gagal memuat data syarat");
      safeToastr.error(error.message || "Gagal memuat data syarat");
    }
  }

  function renderSyaratItems() {
    const tbody = $("#syaratTableBody");
    if (!tbody) return;

    if (!syaratItemsData.length) {
      renderEmptyRow(
        tbody,
        3,
        "Belum ada syarat. Tambahkan persyaratan melalui form."
      );
      return;
    }

    const rows = syaratItemsData
      .map((item, index) => {
        const orderNumber = index + 1;
        const disableUp = index === 0 ? "disabled" : "";
        const disableDown =
          index === syaratItemsData.length - 1 ? "disabled" : "";
        return `
          <tr data-id="${item.id}">
            <td>
              <span class="badge bg-success">${orderNumber}</span>
              <div class="btn-group btn-group-sm ms-2">
                <button type="button" class="btn btn-outline-secondary" onclick="moveSyaratItem(${item.id}, 'up')" ${disableUp}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary" onclick="moveSyaratItem(${item.id}, 'down')" ${disableDown}>
                  <i class="bi bi-arrow-down"></i>
                </button>
              </div>
            </td>
            <td>
              <strong>${escapeHtml(item.name || "")}</strong>
              ${item.name_en && item.name_en !== item.name
            ? `<div class="text-muted small"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.name_en)}</div>`
            : ""
          }
            </td>
            <td>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-warning" onclick="editSyaratItem(${item.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-danger" onclick="deleteSyaratItem(${item.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.innerHTML = rows;
  }

  async function handleSyaratSubmit(event) {
    event.preventDefault();

    const id = parseId($("#syaratId")?.value);
    const values = collectSyaratValues();
    const missing = SYARAT_LANGS.filter((lang) => !values[lang].name);

    if (missing.length) {
      const label = missing
        .map((lang) => SYARAT_LABEL[lang]?.name || lang.toUpperCase())
        .join(", ");
      safeToastr.warning(
        `Nama syarat wajib diisi untuk bahasa: ${label}`
      );
      return;
    }

    const btn = $("#btnSaveSyarat");
    setButtonLoading(btn, true, id ? "Mengupdate..." : "Menyimpan...");

    try {
      const payload = {
        name: values.id.name,
        name_en: values.en.name,
      };
      let message = "Syarat ditambahkan";
      if (id) {
        payload.id = id;
        message = "Syarat diperbarui";
        await jsonRequest(INFORMASI_ENDPOINTS.syarat, {
          method: "PUT",
          body: payload,
        });
      } else {
        await jsonRequest(INFORMASI_ENDPOINTS.syarat, {
          method: "POST",
          body: payload,
        });
      }
      safeToastr.success(message);
      localStorage.setItem(
        "syarat_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: id ? "updated" : "created",
          id: id || null,
        })
      );
      resetSyaratForm();
      await loadSyaratItems(false);
    } catch (error) {
      console.error("[SYARAT] Save error:", error);
      safeToastr.error(error.message || "Gagal menyimpan syarat");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  function editSyaratItem(id) {
    const item = syaratItemsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) {
      safeToastr.warning("Data tidak ditemukan");
      return;
    }
    populateSyaratForm(item);
  }

  async function deleteSyaratItem(id) {
    const item = syaratItemsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) return;

    if (
      !confirm(
        `Hapus syarat "${item.name}"?\nTindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }

    try {
      await jsonRequest(INFORMASI_ENDPOINTS.syarat, {
        method: "DELETE",
        body: { id: item.id },
      });
      safeToastr.success("Syarat dihapus");
      localStorage.setItem(
        "syarat_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: "deleted",
          id: item.id,
        })
      );
      resetSyaratForm();
      await loadSyaratItems(false);
    } catch (error) {
      console.error("[SYARAT] Delete error:", error);
      safeToastr.error(error.message || "Gagal menghapus syarat");
    }
  }

  function moveSyaratItem(id, direction) {
    const index = syaratItemsData.findIndex(
      (row) => Number(row.id) === Number(id)
    );
    if (index === -1) return;

    const delta = direction === "up" ? -1 : 1;
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= syaratItemsData.length) return;

    const updated = [...syaratItemsData];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    updated.forEach((item, idx) => {
      item.order_index = idx + 1;
    });
    syaratItemsData = updated;
    renderSyaratItems();
    persistInformasiOrder(
      "syarat",
      updated,
      "Urutan syarat diperbarui",
      loadSyaratItems
    );
  }

  /* ---------- Biaya ---------- */
  const getBiayaInput = (field, lang) =>
    document.getElementById(`biaya${capitalize(field)}_${lang}`);

  const resolveBiayaField = (record = {}, field, lang) => {
    const normalizedLang = lang === "en" ? "en" : "id";
    const key = field === "label" ? "label" : "amount";
    if (normalizedLang === "en") {
      const value = record[`${key}_en`];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    const fallback = record[key];
    if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
    if (normalizedLang === "id") {
      const alt = record[`${key}_en`];
      if (typeof alt === "string" && alt.trim()) return alt.trim();
    } else {
      const alt = record[key];
      if (typeof alt === "string" && alt.trim()) return alt.trim();
    }
    return "";
  };

  const normalizeBiayaRecord = (record = {}) => ({
    ...record,
    label: resolveBiayaField(record, "label", "id"),
    amount: resolveBiayaField(record, "amount", "id"),
    label_en: resolveBiayaField(record, "label", "en"),
    amount_en: resolveBiayaField(record, "amount", "en"),
  });

  const collectBiayaValues = () =>
    BIAYA_LANGS.reduce((acc, lang) => {
      acc[lang] = {
        label: (getBiayaInput("label", lang)?.value || "").trim(),
        amount: (getBiayaInput("amount", lang)?.value || "").trim(),
      };
      return acc;
    }, {});

  function setBiayaActiveLang(lang) {
    if (!BIAYA_LANGS.includes(lang)) return;
    biayaActiveLang = lang;
    document
      .querySelectorAll("[data-biaya-lang-button]")
      .forEach((button) => {
        const isActive = button.dataset.biayaLangButton === lang;
        button.classList.toggle("active", isActive);
        button.classList.toggle("btn-success", isActive);
        button.classList.toggle("btn-outline-success", !isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    document
      .querySelectorAll("[data-biaya-lang-pane]")
      .forEach((pane) => {
        pane.classList.toggle(
          "d-none",
          pane.dataset.biayaLangPane !== lang
        );
      });
  }

  function resetBiayaForm() {
    const form = $("#biayaForm");
    if (form) form.reset();
    const idField = $("#biayaId");
    if (idField) idField.value = "";
    BIAYA_LANGS.forEach((lang) => {
      const labelField = getBiayaInput("label", lang);
      if (labelField) labelField.value = "";
      const amountField = getBiayaInput("amount", lang);
      if (amountField) amountField.value = "";
    });
    const btn = $("#btnSaveBiaya");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Simpan Biaya';
    setBiayaActiveLang("id");
  }

  function populateBiayaForm(item) {
    const normalized = normalizeBiayaRecord(item);
    const idField = $("#biayaId");
    if (idField) idField.value = item.id;
    BIAYA_LANGS.forEach((lang) => {
      const labelField = getBiayaInput("label", lang);
      if (labelField)
        labelField.value =
          normalized[lang === "en" ? "label_en" : "label"] || "";
      const amountField = getBiayaInput("amount", lang);
      if (amountField)
        amountField.value =
          normalized[lang === "en" ? "amount_en" : "amount"] || "";
    });
    const btn = $("#btnSaveBiaya");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Update Biaya';
    setBiayaActiveLang("id");
    getBiayaInput("label", "id")?.focus();
  }

  async function loadBiayaItems(showToast = false) {
    const tbody = $("#biayaTableBody");
    if (tbody) renderLoadingRow(tbody, 4, "Memuat data biaya...");

    try {
      const result = await jsonRequest(INFORMASI_ENDPOINTS.biaya);
      biayaItemsData = sortByOrderIndex(
        (result.data || []).map((item) => normalizeBiayaRecord(item))
      );
      renderBiayaItems();
      if (showToast) {
        safeToastr.success("Data biaya dimuat");
      }
    } catch (error) {
      console.error("[BIAYA] Load error:", error);
      if (tbody) renderEmptyRow(tbody, 4, "Gagal memuat data biaya");
      safeToastr.error(error.message || "Gagal memuat data biaya");
    }
  }

  function renderBiayaItems() {
    const tbody = $("#biayaTableBody");
    if (!tbody) return;

    if (!biayaItemsData.length) {
      renderEmptyRow(
        tbody,
        4,
        "Belum ada data biaya. Tambahkan melalui form."
      );
      return;
    }

    const rows = biayaItemsData
      .map((item, index) => {
        const orderNumber = index + 1;
        const disableUp = index === 0 ? "disabled" : "";
        const disableDown =
          index === biayaItemsData.length - 1 ? "disabled" : "";
        return `
          <tr data-id="${item.id}">
            <td>
              <span class="badge bg-info">${orderNumber}</span>
              <div class="btn-group btn-group-sm ms-2">
                <button type="button" class="btn btn-outline-secondary" onclick="moveBiayaItem(${item.id}, 'up')" ${disableUp}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary" onclick="moveBiayaItem(${item.id}, 'down')" ${disableDown}>
                  <i class="bi bi-arrow-down"></i>
                </button>
              </div>
            </td>
            <td>
              <div class="fw-semibold">${escapeHtml(item.label || "")}</div>
              ${item.label_en && item.label_en !== item.label
            ? `<div class="text-muted small"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.label_en)}</div>`
            : ""
          }
            </td>
            <td>
              <div>${escapeHtml(item.amount || "")}</div>
              ${item.amount_en && item.amount_en !== item.amount
            ? `<div class="text-muted small"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.amount_en)}</div>`
            : ""
          }
            </td>
            <td>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-warning" onclick="editBiayaItem(${item.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-danger" onclick="deleteBiayaItem(${item.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.innerHTML = rows;
  }

  async function handleBiayaSubmit(event) {
    event.preventDefault();

    const id = parseId($("#biayaId")?.value);
    const values = collectBiayaValues();
    const missing = BIAYA_LANGS.filter(
      (lang) => !values[lang].label || !values[lang].amount
    );

    if (missing.length) {
      const label = missing
        .map((lang) => BIAYA_LABEL[lang]?.name || lang.toUpperCase())
        .join(", ");
      safeToastr.warning(
        `Keterangan dan nominal wajib diisi untuk bahasa: ${label}`
      );
      return;
    }

    const btn = $("#btnSaveBiaya");
    setButtonLoading(btn, true, id ? "Mengupdate..." : "Menyimpan...");

    try {
      const payload = {
        label: values.id.label,
        amount: values.id.amount,
        label_en: values.en.label,
        amount_en: values.en.amount,
      };
      let message = "Biaya ditambahkan";
      if (id) {
        payload.id = id;
        message = "Biaya diperbarui";
        await jsonRequest(INFORMASI_ENDPOINTS.biaya, {
          method: "PUT",
          body: payload,
        });
      } else {
        await jsonRequest(INFORMASI_ENDPOINTS.biaya, {
          method: "POST",
          body: payload,
        });
      }
      safeToastr.success(message);
      localStorage.setItem(
        "biaya_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: id ? "updated" : "created",
          id: id || null,
        })
      );
      resetBiayaForm();
      await loadBiayaItems(false);
    } catch (error) {
      console.error("[BIAYA] Save error:", error);
      safeToastr.error(error.message || "Gagal menyimpan data biaya");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  function editBiayaItem(id) {
    const item = biayaItemsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) {
      safeToastr.warning("Data tidak ditemukan");
      return;
    }
    populateBiayaForm(item);
  }

  async function deleteBiayaItem(id) {
    const item = biayaItemsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) return;

    if (
      !confirm(
        `Hapus data biaya "${item.label}"?\nTindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }

    try {
      await jsonRequest(INFORMASI_ENDPOINTS.biaya, {
        method: "DELETE",
        body: { id: item.id },
      });
      safeToastr.success("Data biaya dihapus");
      localStorage.setItem(
        "biaya_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: "deleted",
          id: item.id,
        })
      );
      resetBiayaForm();
      await loadBiayaItems(false);
    } catch (error) {
      console.error("[BIAYA] Delete error:", error);
      safeToastr.error(error.message || "Gagal menghapus data biaya");
    }
  }

  function moveBiayaItem(id, direction) {
    const index = biayaItemsData.findIndex(
      (row) => Number(row.id) === Number(id)
    );
    if (index === -1) return;

    const delta = direction === "up" ? -1 : 1;
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= biayaItemsData.length) return;

    const updated = [...biayaItemsData];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    updated.forEach((item, idx) => {
      item.order_index = idx + 1;
    });
    biayaItemsData = updated;
    renderBiayaItems();
    persistInformasiOrder(
      "biaya",
      updated,
      "Urutan biaya diperbarui",
      loadBiayaItems
    );
  }

  /* ---------- Brosur ---------- */
  const getBrosurInput = (field, lang) =>
    document.getElementById(`brosur${capitalize(field)}_${lang}`);

  const resolveBrosurField = (record = {}, field, lang) => {
    const normalizedLang = lang === "en" ? "en" : "id";
    if (normalizedLang === "en") {
      const value = record[`${field}_en`];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    const base = record[field];
    if (typeof base === "string" && base.trim()) return base.trim();
    if (normalizedLang === "id") {
      const fallback = record[`${field}_en`];
      if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
    } else {
      const fallback = record[field];
      if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
    }
    return "";
  };

  const normalizeBrosurRecord = (record = {}) => ({
    ...record,
    title: resolveBrosurField(record, "title", "id"),
    description: resolveBrosurField(record, "description", "id"),
    button_label: resolveBrosurField(record, "button_label", "id"),
    title_en: resolveBrosurField(record, "title", "en"),
    description_en: resolveBrosurField(record, "description", "en"),
    button_label_en: resolveBrosurField(record, "button_label", "en"),
  });

  const setBrosurUploadHelp = (text) => {
    const helpEl = $("#brosurUploadHelp");
    if (helpEl) helpEl.textContent = text;
  };

  const formatBytes = (bytes = 0) => {
    if (!bytes || Number.isNaN(bytes)) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return `${size.toFixed(size >= 10 || size === Math.floor(size) ? 0 : 1)} ${units[unit]}`;
  };

  const collectBrosurValues = () =>
    BROSUR_LANGS.reduce((acc, lang) => {
      acc[lang] = {
        title: (getBrosurInput("title", lang)?.value || "").trim(),
        description: (getBrosurInput("description", lang)?.value || "").trim(),
        button_label: (getBrosurInput("buttonLabel", lang)?.value || "").trim(),
      };
      return acc;
    }, {});

  function setBrosurActiveLang(lang) {
    if (!BROSUR_LANGS.includes(lang)) return;
    brosurActiveLang = lang;
    document
      .querySelectorAll("[data-brosur-lang-button]")
      .forEach((button) => {
        const isActive = button.dataset.brosurLangButton === lang;
        button.classList.toggle("active", isActive);
        button.classList.toggle("btn-success", isActive);
        button.classList.toggle("btn-outline-success", !isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    document
      .querySelectorAll("[data-brosur-lang-pane]")
      .forEach((pane) => {
        pane.classList.toggle(
          "d-none",
          pane.dataset.brosurLangPane !== lang
        );
      });
  }

  function resetBrosurForm() {
    const form = $("#brosurForm");
    if (form) form.reset();
    const idField = $("#brosurId");
    if (idField) idField.value = "";
    const filePathField = $("#brosurFilePath");
    const fileSizeField = $("#brosurFileSize");
    const fileMimeField = $("#brosurFileMime");
    const fileInput = $("#brosurFile");
    if (filePathField) filePathField.value = "";
    if (fileSizeField) fileSizeField.value = "";
    if (fileMimeField) fileMimeField.value = "application/pdf";
    if (fileInput) fileInput.value = "";
    BROSUR_LANGS.forEach((lang) => {
      const titleField = getBrosurInput("title", lang);
      if (titleField) titleField.value = "";
      const descField = getBrosurInput("description", lang);
      if (descField) descField.value = "";
      const buttonField = getBrosurInput("buttonLabel", lang);
      if (buttonField) {
        buttonField.value =
          lang === "en" ? "Download PDF" : "Unduh PDF";
      }
    });
    const iconField = $("#brosurIconClass");
    if (iconField) iconField.value = "bi bi-file-earmark-arrow-down";
    const urlField = $("#brosurButtonUrl");
    if (urlField) urlField.value = "";
    const btn = $("#btnSaveBrosur");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Simpan Brosur';
    setBrosurUploadHelp("Unggah file PDF (maks 8MB). URL unduhan akan diisi otomatis setelah upload.");
    setBrosurActiveLang("id");
  }

  function populateBrosurForm(item) {
    const normalized = normalizeBrosurRecord(item);
    const idField = $("#brosurId");
    if (idField) idField.value = item.id;
    BROSUR_LANGS.forEach((lang) => {
      const titleField = getBrosurInput("title", lang);
      if (titleField)
        titleField.value =
          normalized[lang === "en" ? "title_en" : "title"] || "";
      const descField = getBrosurInput("description", lang);
      if (descField)
        descField.value =
          normalized[lang === "en" ? "description_en" : "description"] || "";
      const buttonField = getBrosurInput("buttonLabel", lang);
      if (buttonField)
        buttonField.value =
          normalized[lang === "en" ? "button_label_en" : "button_label"] ||
          (lang === "en" ? "Download PDF" : "Unduh PDF");
    });
    const urlField = $("#brosurButtonUrl");
    if (urlField) urlField.value = item.button_url || "";
    const filePathField = $("#brosurFilePath");
    if (filePathField) filePathField.value = item.file_path || "";
    const fileSizeField = $("#brosurFileSize");
    if (fileSizeField) fileSizeField.value = item.file_size || "";
    const fileMimeField = $("#brosurFileMime");
    if (fileMimeField) fileMimeField.value = item.file_mime || "application/pdf";
    const fileName = (item.file_path || "").split("/").pop() || "";
    if (fileName) {
      setBrosurUploadHelp(`File tersimpan: ${fileName}${item.file_size ? ` (${formatBytes(item.file_size)})` : ""}`);
    } else {
      setBrosurUploadHelp("Unggah file PDF (maks 8MB). URL unduhan akan diisi otomatis setelah upload.");
    }
    const iconField = $("#brosurIconClass");
    if (iconField) iconField.value = item.icon_class || "bi bi-file-earmark-arrow-down";
    const btn = $("#btnSaveBrosur");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Update Brosur';
    setBrosurActiveLang("id");
    getBrosurInput("title", "id")?.focus();
  }

  async function loadBrosurItems(showToast = false) {
    const tbody = $("#brosurTableBody");
    if (tbody) renderLoadingRow(tbody, 4, "Memuat data brosur...");

    try {
      const result = await jsonRequest(INFORMASI_ENDPOINTS.brosur);
      brosurItemsData = sortByOrderIndex(
        (result.data || []).map((item) => normalizeBrosurRecord(item))
      );
      renderBrosurItems();
      if (showToast) {
        safeToastr.success("Data brosur dimuat");
      }
    } catch (error) {
      console.error("[BROSUR] Load error:", error);
      if (tbody) renderEmptyRow(tbody, 4, "Gagal memuat data brosur");
      safeToastr.error(error.message || "Gagal memuat data brosur");
    }
  }

  function renderBrosurItems() {
    const tbody = $("#brosurTableBody");
    if (!tbody) return;

    if (!brosurItemsData.length) {
      renderEmptyRow(
        tbody,
        4,
        "Belum ada brosur. Tambahkan brosur melalui form."
      );
      return;
    }

    const rows = brosurItemsData
      .map((item, index) => {
        const orderNumber = index + 1;
        const disableUp = index === 0 ? "disabled" : "";
        const disableDown =
          index === brosurItemsData.length - 1 ? "disabled" : "";
        const url = escapeHtml(item.button_url || "");
        return `
          <tr data-id="${item.id}">
            <td>
              <span class="badge bg-secondary">${orderNumber}</span>
              <div class="btn-group btn-group-sm ms-2">
                <button type="button" class="btn btn-outline-secondary" onclick="moveBrosurItem(${item.id}, 'up')" ${disableUp}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary" onclick="moveBrosurItem(${item.id}, 'down')" ${disableDown}>
                  <i class="bi bi-arrow-down"></i>
                </button>
              </div>
            </td>
            <td>
              <div class="fw-semibold">${escapeHtml(item.title || "")}</div>
              ${item.title_en && item.title_en !== item.title
            ? `<div class="text-muted small"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.title_en)}</div>`
            : ""
          }
              <div class="text-muted small mt-1">
                ${escapeHtml(item.description || "")}
                ${item.description_en &&
            item.description_en !== item.description
            ? `<div><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.description_en)}</div>`
            : ""
          }
              </div>
            </td>
            <td>
              <span class="d-block text-truncate" style="max-width: 220px;" title="${url}">${url}</span>
            </td>
            <td>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-warning" onclick="editBrosurItem(${item.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-danger" onclick="deleteBrosurItem(${item.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.innerHTML = rows;
  }

  async function handleBrosurSubmit(event) {
    event.preventDefault();

    const id = parseId($("#brosurId")?.value);
    const values = collectBrosurValues();
    const buttonUrl = ($("#brosurButtonUrl")?.value || "").trim();
    const filePath = ($("#brosurFilePath")?.value || "").trim();
    const fileSize = parseInt($("#brosurFileSize")?.value || "0", 10) || null;
    const fileMime = ($("#brosurFileMime")?.value || "").trim() || "application/pdf";
    const iconClass = ($("#brosurIconClass")?.value || "").trim();

    const missing = BROSUR_LANGS.filter(
      (lang) =>
        !values[lang].title ||
        !values[lang].description ||
        !values[lang].button_label
    );

    if (missing.length || !buttonUrl) {
      if (!buttonUrl) {
        safeToastr.warning("URL unduhan wajib diisi");
      } else {
        const label = missing
          .map((lang) => BROSUR_LABEL[lang]?.name || lang.toUpperCase())
          .join(", ");
        safeToastr.warning(
          `Judul, deskripsi, dan label tombol wajib diisi untuk bahasa: ${label}`
        );
      }
      return;
    }

    const btn = $("#btnSaveBrosur");
    setButtonLoading(btn, true, id ? "Mengupdate..." : "Menyimpan...");

    try {
      const payload = {
        title: values.id.title,
        description: values.id.description,
        button_label: values.id.button_label || "Unduh PDF",
        title_en: values.en.title,
        description_en: values.en.description,
        button_label_en: values.en.button_label || "Download PDF",
        button_url: buttonUrl,
        file_path: filePath || null,
        file_size: fileSize,
        file_mime: fileMime || null,
        icon_class: iconClass || "bi bi-file-earmark-arrow-down",
      };
      let message = "Brosur ditambahkan";
      if (id) {
        payload.id = id;
        message = "Brosur diperbarui";
        await jsonRequest(INFORMASI_ENDPOINTS.brosur, {
          method: "PUT",
          body: payload,
        });
      } else {
        await jsonRequest(INFORMASI_ENDPOINTS.brosur, {
          method: "POST",
          body: payload,
        });
      }
      safeToastr.success(message);
      localStorage.setItem(
        "brosur_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: id ? "updated" : "created",
          id: id || null,
        })
      );
      resetBrosurForm();
      await loadBrosurItems(false);
    } catch (error) {
      console.error("[BROSUR] Save error:", error);
      safeToastr.error(error.message || "Gagal menyimpan brosur");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  function editBrosurItem(id) {
    const item = brosurItemsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) {
      safeToastr.warning("Data tidak ditemukan");
      return;
    }
    populateBrosurForm(item);
  }

  async function deleteBrosurItem(id) {
    const item = brosurItemsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) return;

    if (
      !confirm(
        `Hapus brosur "${item.title}"?\nTindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }

    try {
      await jsonRequest(INFORMASI_ENDPOINTS.brosur, {
        method: "DELETE",
        body: { id: item.id },
      });
      safeToastr.success("Brosur dihapus");
      localStorage.setItem(
        "brosur_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: "deleted",
          id: item.id,
        })
      );
      resetBrosurForm();
      await loadBrosurItems(false);
    } catch (error) {
      console.error("[BROSUR] Delete error:", error);
      safeToastr.error(error.message || "Gagal menghapus brosur");
    }
  }

  function moveBrosurItem(id, direction) {
    const index = brosurItemsData.findIndex(
      (row) => Number(row.id) === Number(id)
    );
    if (index === -1) return;

    const delta = direction === "up" ? -1 : 1;
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= brosurItemsData.length) return;

    const updated = [...brosurItemsData];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    updated.forEach((item, idx) => {
      item.order_index = idx + 1;
    });
    brosurItemsData = updated;
    renderBrosurItems();
    persistInformasiOrder(
      "brosur",
      updated,
      "Urutan brosur diperbarui",
      loadBrosurItems
    );
  }

  async function handleBrosurFileChange(event) {
    const input = event?.target || document.getElementById("brosurFile");
    const file = input?.files?.[0];
    if (!file) {
      setBrosurUploadHelp("Unggah file PDF (maks 8MB). URL unduhan akan diisi otomatis setelah upload.");
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      safeToastr.warning("Hanya file PDF yang diperbolehkan");
      input.value = "";
      return;
    }
    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      safeToastr.warning("Ukuran PDF maksimal 8MB");
      input.value = "";
      return;
    }

    try {
      setBrosurUploadHelp(`Mengunggah ${file.name} (${formatBytes(file.size)})...`);
      input.disabled = true;
      const base64 = await fileToBase64(file);
      const result = await jsonRequest("/api/brosur_upload", {
        method: "POST",
        body: {
          file: base64,
          fileName: file.name,
        },
      });

      $("#brosurButtonUrl")?.setAttribute("value", result.url || "");
      const urlField = $("#brosurButtonUrl");
      if (urlField) urlField.value = result.url || "";
      const pathField = $("#brosurFilePath");
      if (pathField) pathField.value = result.path || "";
      const sizeField = $("#brosurFileSize");
      if (sizeField) sizeField.value = result.size || file.size || "";
      const mimeField = $("#brosurFileMime");
      if (mimeField) mimeField.value = result.mime || "application/pdf";

      setBrosurUploadHelp(`File tersimpan: ${file.name} (${formatBytes(result.size || file.size)})`);
      safeToastr.success("PDF berhasil diupload, URL sudah diisi otomatis.");
    } catch (error) {
      console.error("[BROSUR] Upload error:", error);
      safeToastr.error(error.message || "Gagal upload brosur");
      input.value = "";
      $("#brosurButtonUrl")?.setAttribute("value", "");
      const urlField = $("#brosurButtonUrl");
      if (urlField) urlField.value = "";
      $("#brosurFilePath")?.setAttribute("value", "");
      $("#brosurFileSize")?.setAttribute("value", "");
      const mimeField = $("#brosurFileMime");
      if (mimeField) mimeField.value = "application/pdf";
      setBrosurUploadHelp("Unggah file PDF (maks 8MB). URL unduhan akan diisi otomatis setelah upload.");
    } finally {
      if (input) input.disabled = false;
    }
  }

  /* ---------- Kontak ---------- */
  const getKontakInput = (field, lang) =>
    document.getElementById(`kontak${capitalize(field)}_${lang}`);

  const resolveKontakField = (record = {}, field, lang) => {
    const normalizedLang = lang === "en" ? "en" : "id";
    if (normalizedLang === "en") {
      const value = record[`${field}_en`];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    const base = record[field];
    if (typeof base === "string" && base.trim()) return base.trim();
    if (normalizedLang === "id") {
      const fallback = record[`${field}_en`];
      if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
    } else {
      const fallback = record[field];
      if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
    }
    return "";
  };

  const normalizeKontakRecord = (record = {}) => ({
    ...record,
    title: resolveKontakField(record, "title", "id"),
    value: resolveKontakField(record, "value", "id"),
    title_en: resolveKontakField(record, "title", "en"),
    value_en: resolveKontakField(record, "value", "en"),
  });

  const collectKontakValues = () =>
    KONTAK_LANGS.reduce((acc, lang) => {
      acc[lang] = {
        title: (getKontakInput("title", lang)?.value || "").trim(),
        value: (getKontakInput("value", lang)?.value || "").trim(),
      };
      return acc;
    }, {});

  function setKontakActiveLang(lang) {
    if (!KONTAK_LANGS.includes(lang)) return;
    kontakActiveLang = lang;
    document
      .querySelectorAll("[data-kontak-lang-button]")
      .forEach((button) => {
        const isActive = button.dataset.kontakLangButton === lang;
        button.classList.toggle("active", isActive);
        button.classList.toggle("btn-success", isActive);
        button.classList.toggle("btn-outline-success", !isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    document
      .querySelectorAll("[data-kontak-lang-pane]")
      .forEach((pane) => {
        pane.classList.toggle(
          "d-none",
          pane.dataset.kontakLangPane !== lang
        );
      });
  }

  function resetKontakForm() {
    const form = $("#kontakForm");
    if (form) form.reset();
    const idField = $("#kontakId");
    if (idField) idField.value = "";
    KONTAK_LANGS.forEach((lang) => {
      const titleField = getKontakInput("title", lang);
      if (titleField) titleField.value = "";
      const valueField = getKontakInput("value", lang);
      if (valueField) valueField.value = "";
    });
    const typeSelect = $("#kontakType");
    if (typeSelect) typeSelect.value = "info";
    const linkField = $("#kontakLinkUrl");
    if (linkField) linkField.value = "";
    const iconField = $("#kontakIconClass");
    if (iconField) iconField.value = "bi bi-info-circle";
    const btn = $("#btnSaveKontak");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Simpan Kontak';
    setKontakActiveLang("id");
  }

  function populateKontakForm(item) {
    const normalized = normalizeKontakRecord(item);
    const idField = $("#kontakId");
    if (idField) idField.value = item.id;
    KONTAK_LANGS.forEach((lang) => {
      const titleField = getKontakInput("title", lang);
      if (titleField)
        titleField.value =
          normalized[lang === "en" ? "title_en" : "title"] || "";
      const valueField = getKontakInput("value", lang);
      if (valueField)
        valueField.value =
          normalized[lang === "en" ? "value_en" : "value"] || "";
    });
    const typeField = $("#kontakType");
    if (typeField) typeField.value = item.item_type || "info";
    const linkField = $("#kontakLinkUrl");
    if (linkField) linkField.value = item.link_url || "";
    const iconField = $("#kontakIconClass");
    if (iconField) iconField.value = item.icon_class || "bi bi-info-circle";
    const btn = $("#btnSaveKontak");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Update Kontak';
    setKontakActiveLang("id");
    getKontakInput("title", "id")?.focus();
  }

  async function loadKontakItems(showToast = false) {
    const tbody = $("#kontakTableBody");
    if (tbody) renderLoadingRow(tbody, 4, "Memuat data kontak...");

    try {
      const result = await jsonRequest(INFORMASI_ENDPOINTS.kontak);
      kontakItemsData = sortByOrderIndex(
        (result.data || []).map((item) => normalizeKontakRecord(item))
      );
      renderKontakItems();
      if (showToast) {
        safeToastr.success("Data kontak dimuat");
      }
    } catch (error) {
      console.error("[KONTAK] Load error:", error);
      if (tbody) renderEmptyRow(tbody, 4, "Gagal memuat data kontak");
      safeToastr.error(error.message || "Gagal memuat data kontak");
    }
  }

  function renderKontakItems() {
    const tbody = $("#kontakTableBody");
    if (!tbody) return;

    if (!kontakItemsData.length) {
      renderEmptyRow(
        tbody,
        4,
        "Belum ada data kontak. Tambahkan kontak melalui form."
      );
      return;
    }

    const rows = kontakItemsData
      .map((item, index) => {
        const orderNumber = index + 1;
        const disableUp = index === 0 ? "disabled" : "";
        const disableDown =
          index === kontakItemsData.length - 1 ? "disabled" : "";
        return `
          <tr data-id="${item.id}">
            <td>
              <span class="badge bg-dark">${orderNumber}</span>
              <div class="btn-group btn-group-sm ms-2">
                <button type="button" class="btn btn-outline-secondary" onclick="moveKontakItem(${item.id}, 'up')" ${disableUp}>
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button type="button" class="btn btn-outline-secondary" onclick="moveKontakItem(${item.id}, 'down')" ${disableDown}>
                  <i class="bi bi-arrow-down"></i>
                </button>
              </div>
            </td>
            <td>
              <div class="fw-semibold">${escapeHtml(item.title || "")}</div>
              ${item.title_en && item.title_en !== item.title
            ? `<div class="text-muted small"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.title_en)}</div>`
            : ""
          }
              <div class="text-muted small">${escapeHtml(item.item_type || "info")}</div>
            </td>
            <td>
              <div>${escapeHtml(item.value || "")}</div>
              ${item.value_en && item.value_en !== item.value
            ? `<div class="text-muted small"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.value_en)}</div>`
            : ""
          }
              ${item.link_url
            ? `<div class="small text-muted text-truncate" style="max-width:220px;" title="${escapeHtml(item.link_url)}">${escapeHtml(item.link_url)}</div>`
            : ""
          }
            </td>
            <td>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-warning" onclick="editKontakItem(${item.id})">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-danger" onclick="deleteKontakItem(${item.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.innerHTML = rows;
  }

  async function handleKontakSubmit(event) {
    event.preventDefault();

    const id = parseId($("#kontakId")?.value);
    const values = collectKontakValues();
    const itemType = ($("#kontakType")?.value || "info").trim() || "info";
    const linkUrl = ($("#kontakLinkUrl")?.value || "").trim();
    const iconClass = ($("#kontakIconClass")?.value || "").trim();

    const missing = KONTAK_LANGS.filter(
      (lang) => !values[lang].title || !values[lang].value
    );

    if (missing.length) {
      const label = missing
        .map((lang) => KONTAK_LABEL[lang]?.name || lang.toUpperCase())
        .join(", ");
      safeToastr.warning(
        `Judul dan nilai kontak wajib diisi untuk bahasa: ${label}`
      );
      return;
    }

    const btn = $("#btnSaveKontak");
    setButtonLoading(btn, true, id ? "Mengupdate..." : "Menyimpan...");

    try {
      const payload = {
        title: values.id.title,
        value: values.id.value,
        title_en: values.en.title,
        value_en: values.en.value,
        item_type: itemType,
        link_url: linkUrl || null,
        icon_class: iconClass || "bi bi-info-circle",
      };
      let message = "Kontak ditambahkan";
      if (id) {
        payload.id = id;
        message = "Kontak diperbarui";
        await jsonRequest(INFORMASI_ENDPOINTS.kontak, {
          method: "PUT",
          body: payload,
        });
      } else {
        await jsonRequest(INFORMASI_ENDPOINTS.kontak, {
          method: "POST",
          body: payload,
        });
      }
      safeToastr.success(message);
      localStorage.setItem(
        "kontak_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: id ? "updated" : "created",
          id: id || null,
        })
      );
      resetKontakForm();
      await loadKontakItems(false);
    } catch (error) {
      console.error("[KONTAK] Save error:", error);
      safeToastr.error(error.message || "Gagal menyimpan data kontak");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  function editKontakItem(id) {
    const item = kontakItemsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) {
      safeToastr.warning("Data tidak ditemukan");
      return;
    }
    populateKontakForm(item);
  }

  async function deleteKontakItem(id) {
    const item = kontakItemsData.find(
      (row) => Number(row.id) === Number(id)
    );
    if (!item) return;

    if (
      !confirm(
        `Hapus kontak "${item.title}"?\nTindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }

    try {
      await jsonRequest(INFORMASI_ENDPOINTS.kontak, {
        method: "DELETE",
        body: { id: item.id },
      });
      safeToastr.success("Kontak dihapus");
      localStorage.setItem(
        "kontak_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: "deleted",
          id: item.id,
        })
      );
      resetKontakForm();
      await loadKontakItems(false);
    } catch (error) {
      console.error("[KONTAK] Delete error:", error);
      safeToastr.error(error.message || "Gagal menghapus kontak");
    }
  }

  function moveKontakItem(id, direction) {
    const index = kontakItemsData.findIndex(
      (row) => Number(row.id) === Number(id)
    );
    if (index === -1) return;

    const delta = direction === "up" ? -1 : 1;
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= kontakItemsData.length) return;

    const updated = [...kontakItemsData];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    updated.forEach((item, idx) => {
      item.order_index = idx + 1;
    });
    kontakItemsData = updated;
    renderKontakItems();
    persistInformasiOrder(
      "kontak",
      updated,
      "Urutan kontak diperbarui",
      loadKontakItems
    );
  }

  /* ---------- Kontak Settings (Map) ---------- */
  async function loadKontakSettings() {
    try {
      const result = await jsonRequest(INFORMASI_ENDPOINTS.kontakSettings);
      kontakSettingsData = result.data || {};
      const mapField = $("#kontakMapUrl");
      if (mapField && kontakSettingsData.map_embed_url) {
        mapField.value = kontakSettingsData.map_embed_url;
      }
    } catch (error) {
      console.error("[KONTAK_SETTINGS] Load error:", error);
      safeToastr.error(error.message || "Gagal memuat pengaturan kontak");
    }
  }

  async function handleKontakSettingsSubmit(event) {
    event.preventDefault();

    const mapUrl = ($("#kontakMapUrl")?.value || "").trim();
    if (!mapUrl) {
      safeToastr.warning("URL embed Google Maps wajib diisi");
      return;
    }

    const btn = $("#btnSaveKontakSettings");
    setButtonLoading(btn, true, "Menyimpan...");

    try {
      await jsonRequest(INFORMASI_ENDPOINTS.kontakSettings, {
        method: "POST",
        body: { map_embed_url: mapUrl },
      });
      safeToastr.success("Pengaturan peta tersimpan");
      await loadKontakSettings();
    } catch (error) {
      console.error("[KONTAK_SETTINGS] Save error:", error);
      safeToastr.error(error.message || "Gagal menyimpan pengaturan kontak");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  /* =========================
     9) MODE MAINTENANCE
     ========================= */
  const MAINTENANCE_API = "/api/maintenance_status";

  function normalizeMaintenanceState(state = {}) {
    return {
      active: Boolean(state.active),
      message: state.message || "",
      updated_at: state.updated_at || state.updatedAt || null,
      updated_by: state.updated_by || state.updatedBy || "",
    };
  }

  function defaultMaintenanceMessage() {
    return "Situs sedang menjalani perawatan sistem. Silakan coba kembali beberapa saat lagi.";
  }

  function updateMaintenanceUI(nextState = maintenanceState) {
    maintenanceState = normalizeMaintenanceState(nextState);

    const badge = $("#maintenanceStatusBadge");
    if (badge) {
      const badgeClass = maintenanceState.active ? "bg-danger" : "bg-success";
      const badgeIcon = maintenanceState.active
        ? "bi-exclamation-octagon-fill"
        : "bi-check-circle-fill";
      const badgeText = maintenanceState.active
        ? "Maintenance Aktif"
        : "Situs Normal";
      badge.className = `badge ${badgeClass}`;
      badge.innerHTML = `<i class="bi ${badgeIcon} me-1"></i>${badgeText}`;
    }

    const summary = $("#maintenanceStatusSummary");
    if (summary) {
      summary.textContent = maintenanceState.active
        ? "Pengunjung tidak dapat mengakses form pendaftaran & pembayaran."
        : "Seluruh halaman publik berjalan normal.";
    }

    const alert = $("#maintenanceActiveAlert");
    if (alert) {
      alert.classList.toggle("d-none", !maintenanceState.active);
    }

    const alertMessage = $("#maintenanceActiveMessagePreview");
    const previewText = maintenanceState.message || defaultMaintenanceMessage();
    if (alertMessage) alertMessage.textContent = previewText;

    const preview = $("#maintenancePreviewMessage");
    if (preview) preview.textContent = previewText;

    const toggle = $("#maintenanceToggle");
    if (toggle) {
      toggle.checked = maintenanceState.active;
    }

    const textarea = $("#maintenanceMessageInput");
    if (textarea && textarea.value.trim() !== maintenanceState.message.trim()) {
      textarea.value = maintenanceState.message;
    }

  }

  function setMaintenanceControlsDisabled(state) {
    ["maintenanceToggle", "maintenanceMessageInput"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = state;
    });
  }

  async function loadMaintenanceStatus(showToast = false) {
    const badge = $("#maintenanceStatusBadge");
    if (badge) {
      badge.className = "badge bg-secondary";
      badge.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Memuat...';
    }

    setMaintenanceControlsDisabled(true);
    try {
      const response = await fetch(MAINTENANCE_API, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Gagal mengambil status maintenance");
      }
      updateMaintenanceUI(result.data);
      if (showToast) {
        safeToastr.success("Status maintenance terbaru dimuat");
      }
    } catch (error) {
      console.error("[MAINTENANCE] Load error:", error);
      safeToastr.error(error.message || "Tidak dapat memuat status maintenance");
      const summary = $("#maintenanceStatusSummary");
      if (summary) {
        summary.textContent =
          "Gagal memuat status. Silakan coba lagi dengan tombol muat ulang.";
      }
    } finally {
      setMaintenanceControlsDisabled(false);
    }
  }

  async function saveMaintenanceSettings(event) {
    if (event) event.preventDefault();

    const toggle = $("#maintenanceToggle");
    const messageInput = $("#maintenanceMessageInput");
    const btn = $("#maintenanceSaveBtn");
    if (!toggle || !messageInput || !btn) return;

    const payload = {
      active: toggle.checked,
      message: messageInput.value.trim(),
      updatedBy: localStorage.getItem("adminEmail") || "Admin",
    };

    setButtonLoading(btn, true, "Menyimpan...");
    setMaintenanceControlsDisabled(true);
    try {
      const response = await fetch(MAINTENANCE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Gagal menyimpan pengaturan");
      }
      updateMaintenanceUI(result.data);
      safeToastr.success("Mode maintenance berhasil diperbarui");
    } catch (error) {
      console.error("[MAINTENANCE] Save error:", error);
      safeToastr.error(error.message || "Gagal menyimpan mode maintenance");
    } finally {
      setButtonLoading(btn, false);
      setMaintenanceControlsDisabled(false);
    }
  }

  function resetMaintenanceForm() {
    updateMaintenanceUI(maintenanceState);
    safeToastr.info("Form maintenance dikembalikan ke nilai terakhir");
  }

  function handleMaintenanceMessageInput(event) {
    const preview = $("#maintenancePreviewMessage");
    const alertPreview = $("#maintenanceActiveMessagePreview");
    const text = (event?.target?.value || "").trim() || defaultMaintenanceMessage();
    if (preview) preview.textContent = text;
    if (alertPreview) alertPreview.textContent = text;
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#alurForm")?.addEventListener("submit", handleAlurSubmit);
    $("#btnResetAlur")?.addEventListener("click", resetAlurForm);
    document
      .querySelectorAll("[data-alur-lang-button]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          setAlurActiveLang(button.dataset.alurLangButton)
        );
      });
    setAlurActiveLang("id");

    $("#syaratForm")?.addEventListener("submit", handleSyaratSubmit);
    $("#btnResetSyarat")?.addEventListener("click", resetSyaratForm);
    document
      .querySelectorAll("[data-syarat-lang-button]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          setSyaratActiveLang(button.dataset.syaratLangButton)
        );
      });
    setSyaratActiveLang("id");

    $("#biayaForm")?.addEventListener("submit", handleBiayaSubmit);
    $("#btnResetBiaya")?.addEventListener("click", resetBiayaForm);
    document
      .querySelectorAll("[data-biaya-lang-button]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          setBiayaActiveLang(button.dataset.biayaLangButton)
        );
      });
    setBiayaActiveLang("id");

    $("#brosurForm")?.addEventListener("submit", handleBrosurSubmit);
    $("#btnResetBrosur")?.addEventListener("click", resetBrosurForm);
    document
      .querySelectorAll("[data-brosur-lang-button]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          setBrosurActiveLang(button.dataset.brosurLangButton)
        );
      });
    $("#brosurFile")?.addEventListener("change", handleBrosurFileChange);
    setBrosurActiveLang("id");

    $("#kontakForm")?.addEventListener("submit", handleKontakSubmit);
    $("#btnResetKontak")?.addEventListener("click", resetKontakForm);
    document
      .querySelectorAll("[data-kontak-lang-button]")
      .forEach((button) => {
        button.addEventListener("click", () =>
          setKontakActiveLang(button.dataset.kontakLangButton)
        );
      });
    setKontakActiveLang("id");

    $("#kontakSettingsForm")?.addEventListener("submit", handleKontakSettingsSubmit);

    $("#maintenanceForm")?.addEventListener("submit", saveMaintenanceSettings);
    $("#maintenanceResetBtn")?.addEventListener("click", resetMaintenanceForm);
    $("#maintenanceRefreshBtn")?.addEventListener("click", () =>
      loadMaintenanceStatus(true)
    );
    $("#maintenanceMessageInput")?.addEventListener(
      "input",
      handleMaintenanceMessageInput
    );
    if ($("#tab-maintenance")) {
      updateMaintenanceUI(maintenanceState);
      loadMaintenanceStatus();
    }

    // Berita form setup
    setupBeritaLangSwitch();
    setupBeritaFormHandlers();
  });

  // Expose functions for inline handlers
  window.loadAlurSteps = loadAlurSteps;
  window.editAlurStep = editAlurStep;
  window.deleteAlurStep = deleteAlurStep;
  window.moveAlurStep = moveAlurStep;

  window.loadSyaratItems = loadSyaratItems;
  window.editSyaratItem = editSyaratItem;
  window.deleteSyaratItem = deleteSyaratItem;
  window.moveSyaratItem = moveSyaratItem;

  window.loadBiayaItems = loadBiayaItems;
  window.editBiayaItem = editBiayaItem;
  window.deleteBiayaItem = deleteBiayaItem;
  window.moveBiayaItem = moveBiayaItem;

  window.loadBrosurItems = loadBrosurItems;
  window.editBrosurItem = editBrosurItem;
  window.deleteBrosurItem = deleteBrosurItem;
  window.moveBrosurItem = moveBrosurItem;

  window.loadKontakItems = loadKontakItems;
  window.editKontakItem = editKontakItem;
  window.deleteKontakItem = deleteKontakItem;
  window.moveKontakItem = moveKontakItem;
  window.loadKontakSettings = loadKontakSettings;

  /* =========================
     8.5) BERITA MANAGEMENT
     ========================= */
  let beritaItemsData = [];
  const BERITA_LANGS = ["id", "en"];
  const BERITA_LABEL = {
    id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
    en: { name: "English", flag: "🇬🇧" },
  };
  let beritaActiveLang = "id";

  function getBeritaInput(field, lang) {
    const id = `berita${capitalize(field)}_${lang}`;
    return $(`#${id}`);
  }

  function getBeritaPaneEl(lang) {
    return $(`.berita-lang-pane[data-berita-lang-pane="${lang}"]`);
  }

  function setBeritaActiveLang(lang) {
    beritaActiveLang = lang;
    BERITA_LANGS.forEach((l) => {
      const pane = getBeritaPaneEl(l);
      const btn = $(`[data-berita-lang-button="${l}"]`);
      if (pane) {
        pane.classList.toggle("d-none", l !== lang);
      }
      if (btn) {
        btn.classList.toggle("active", l === lang);
        btn.classList.toggle("btn-success", l === lang);
        btn.classList.toggle("btn-outline-success", l !== lang);
      }
    });
  }

  function collectBeritaValues() {
    const result = {};
    BERITA_LANGS.forEach((lang) => {
      const titleVal = (getBeritaInput("title", lang)?.value || "").trim();
      const contentVal = (getBeritaInput("content", lang)?.value || "").trim();
      result[lang] = { title: titleVal, content: contentVal };
    });
    return result;
  }

  function normalizeBeritaRecord(item) {
    return {
      id: item.id || null,
      title: item.title_id || "",
      title_en: item.title_en || "",
      content: item.content_id || "",
      content_en: item.content_en || "",
      image_url: item.image_url || "",
      is_published: Boolean(item.is_published),
      published_date: item.published_date || null,
      order_index: item.order_index || 0,
    };
  }

  function setupBeritaLangSwitch() {
    $$("[data-berita-lang-button]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lang = btn.dataset.beritaLangButton;
        if (lang && BERITA_LANGS.includes(lang)) {
          setBeritaActiveLang(lang);
        }
      });
    });
  }

  function setupBeritaFormHandlers() {
    const form = $("#beritaForm");
    if (form) {
      form.addEventListener("submit", handleBeritaSubmit);
    }

    const btnReset = $("#btnResetBerita");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        resetBeritaForm();
        safeToastr.info("Form direset");
      });
    }

    // Image file input handler
    const fileInput = $("#beritaImageFile");
    if (fileInput) {
      fileInput.addEventListener("change", handleBeritaImageSelect);
    }
  }

  function handleBeritaImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) {
      console.log("[BERITA] No file selected");
      return;
    }

    console.log("[BERITA] File selected:", file.name, "Size:", file.size, "Type:", file.type);

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      safeToastr.error("Ukuran file terlalu besar. Maksimal 2MB");
      event.target.value = "";
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      safeToastr.error("File harus berupa gambar (JPG, PNG, WebP)");
      event.target.value = "";
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImg = $("#beritaPreviewImg");
      const previewDiv = $("#beritaImagePreview");
      if (previewImg && previewDiv) {
        previewImg.src = e.target.result;
        previewDiv.style.display = "block";
        console.log("[BERITA] Preview shown");
      } else {
        console.error("[BERITA] Preview elements not found");
      }
    };
    reader.onerror = (error) => {
      console.error("[BERITA] FileReader error:", error);
      safeToastr.error("Gagal membaca file gambar");
    };
    reader.readAsDataURL(file);
  }

  function clearBeritaImage() {
    const fileInput = $("#beritaImageFile");
    const urlInput = $("#beritaImageUrl");
    const previewDiv = $("#beritaImagePreview");

    if (fileInput) fileInput.value = "";
    if (urlInput) urlInput.value = "";
    if (previewDiv) previewDiv.style.display = "none";

    safeToastr.info("Gambar dihapus");
  }

  window.clearBeritaImage = clearBeritaImage;

  function resetBeritaForm() {
    const form = $("#beritaForm");
    if (form) form.reset();
    const id = $("#beritaId");
    if (id) id.value = "";
    BERITA_LANGS.forEach((lang) => {
      const titleField = getBeritaInput("title", lang);
      if (titleField) titleField.value = "";
      const contentField = getBeritaInput("content", lang);
      if (contentField) contentField.value = "";
    });
    const imgField = $("#beritaImageUrl");
    if (imgField) imgField.value = "";
    const fileInput = $("#beritaImageFile");
    if (fileInput) fileInput.value = "";
    const previewDiv = $("#beritaImagePreview");
    if (previewDiv) previewDiv.style.display = "none";
    const pubField = $("#beritaIsPublished");
    if (pubField) pubField.checked = false;
    const dateField = $("#beritaPublishedDate");
    if (dateField) dateField.value = "";
    const btn = $("#btnSaveBerita");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Simpan Berita';
    setBeritaActiveLang("id");
  }

  async function loadBeritaItems(showToast = false) {
    const tbody = $("#beritaTableBody");
    if (tbody) renderLoadingRow(tbody, 5, "Memuat data berita...");

    try {
      const result = await jsonRequest(INFORMASI_ENDPOINTS.berita);
      beritaItemsData = sortByOrderIndex(
        (result.data || []).map((item) => normalizeBeritaRecord(item))
      );
      renderBeritaItems();
      if (showToast) {
        safeToastr.success("Data berita dimuat");
      }
    } catch (error) {
      console.error("[BERITA] Load error:", error);
      if (tbody) renderEmptyRow(tbody, 5, "Gagal memuat data berita");
      safeToastr.error(error.message || "Gagal memuat data berita");
    }
  }

  function renderBeritaItems() {
    const tbody = $("#beritaTableBody");
    if (!tbody) return;

    if (!beritaItemsData.length) {
      renderEmptyRow(
        tbody,
        5,
        "Belum ada data berita. Tambahkan berita melalui form."
      );
      return;
    }

    const formatDateForTable = (dateStr) => {
      if (!dateStr) return '<span class="text-muted">-</span>';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '<span class="text-muted">-</span>';
        return date.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } catch {
        return '<span class="text-muted">-</span>';
      }
    };

    const rows = beritaItemsData
      .map((item, index) => {
        const orderNumber = index + 1;
        const disableUp = index === 0 ? "disabled" : "";
        const disableDown =
          index === beritaItemsData.length - 1 ? "disabled" : "";
        const statusBadge = item.is_published
          ? '<span class="badge bg-success">Published</span>'
          : '<span class="badge bg-secondary">Draft</span>';
        const titleDisplay = escapeHtml(item.title || item.title_en || "");
        const titleEnDisplay =
          item.title_en && item.title_en !== item.title
            ? `<div class="text-muted small"><span aria-hidden="true">🇬🇧</span> ${escapeHtml(item.title_en)}</div>`
            : "";
        const publishedDate = formatDateForTable(item.published_date);
        return `
              <tr data-id="${item.id}">
                <td>
                  <span class="badge bg-dark">${orderNumber}</span>
                  <div class="btn-group btn-group-sm ms-2">
                    <button type="button" class="btn btn-outline-secondary" onclick="moveBeritaItem(${item.id}, 'up')" ${disableUp}>
                      <i class="bi bi-arrow-up"></i>
                    </button>
                    <button type="button" class="btn btn-outline-secondary" onclick="moveBeritaItem(${item.id}, 'down')" ${disableDown}>
                      <i class="bi bi-arrow-down"></i>
                    </button>
                  </div>
                </td>
                <td>
                  <div class="fw-semibold">${titleDisplay}</div>
                  ${titleEnDisplay}
                  ${item.image_url
            ? `<div class="small text-muted mt-1"><i class="bi bi-image"></i> Dengan gambar</div>`
            : ""
          }
                </td>
                <td>
                  <div class="small">${publishedDate}</div>
                  ${item.published_date ? '' : '<div class="text-muted small">(auto)</div>'}
                </td>
                <td>${statusBadge}</td>
                <td>
                  <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-warning" onclick="editBeritaItem(${item.id})">
                    <i class="bi bi-pencil"></i> <span>Edit</span>
                  </button>
                    <button type="button" class="btn btn-danger" onclick="deleteBeritaItem(${item.id})">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `;
      })
      .join("");

    tbody.innerHTML = rows;
  }

  async function uploadBeritaImage(file) {
    if (!file) {
      console.warn("[BERITA] No file provided for upload");
      return null;
    }

    try {
      // Check if Supabase client is available
      if (typeof window.supabase === "undefined") {
        console.error("[BERITA] Supabase client not available");
        throw new Error("Supabase client tidak tersedia. Pastikan halaman sudah selesai dimuat.");
      }

      console.log("[BERITA] Starting upload...");
      console.log("[BERITA] File:", file.name, "Size:", file.size, "Type:", file.type);

      const fileExt = file.name.split(".").pop();
      const fileName = `berita_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `berita/${fileName}`;

      console.log("[BERITA] Upload path:", filePath);

      // Upload to Supabase Storage (hero-images bucket)
      const { data: uploadData, error: uploadError } = await window.supabase.storage
        .from("hero-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("[BERITA] Upload error:", uploadError);

        // More specific error messages
        if (uploadError.message?.includes("Bucket not found")) {
          throw new Error("Bucket 'hero-images' tidak ditemukan. Pastikan bucket sudah dibuat di Supabase.");
        } else if (uploadError.message?.includes("new row violates row-level security")) {
          throw new Error("Akses ditolak. Periksa RLS policy untuk bucket 'hero-images'.");
        } else {
          throw new Error(`Upload gagal: ${uploadError.message || "Unknown error"}`);
        }
      }

      console.log("[BERITA] Upload data:", uploadData);

      // Get public URL
      const { data: urlData } = window.supabase.storage
        .from("hero-images")
        .getPublicUrl(filePath);

      console.log("[BERITA] URL data:", urlData);

      if (!urlData?.publicUrl) {
        console.error("[BERITA] No public URL returned");
        throw new Error("Gagal mendapatkan URL gambar");
      }

      const publicUrl = urlData.publicUrl;
      console.log("[BERITA] ✅ Upload success! Public URL:", publicUrl);

      return publicUrl;
    } catch (error) {
      console.error("[BERITA] Upload error:", error);
      throw error;
    }
  }

  async function handleBeritaSubmit(event) {
    event.preventDefault();

    const id = parseId($("#beritaId")?.value);
    const values = collectBeritaValues();
    const isPublished = $("#beritaIsPublished")?.checked || false;
    const publishedDate = ($("#beritaPublishedDate")?.value || "").trim() || null;

    const missing = BERITA_LANGS.filter(
      (lang) => !values[lang].title || !values[lang].content
    );

    if (missing.length) {
      const label = missing
        .map((lang) => BERITA_LABEL[lang]?.name || lang.toUpperCase())
        .join(", ");
      safeToastr.warning(
        `Judul dan konten berita wajib diisi untuk bahasa: ${label}`
      );
      return;
    }

    const btn = $("#btnSaveBerita");
    setButtonLoading(btn, true, id ? "Mengupdate..." : "Menyimpan...");

    try {
      let imageUrl = ($("#beritaImageUrl")?.value || "").trim() || null;

      // Check if there's a new image file to upload
      const fileInput = $("#beritaImageFile");
      const file = fileInput?.files?.[0];

      if (file) {
        setButtonLoading(btn, true, "Mengupload gambar...");
        try {
          imageUrl = await uploadBeritaImage(file);
          console.log("[BERITA] Image uploaded, URL:", imageUrl);

          // Store URL in hidden field for future edits
          const urlInput = $("#beritaImageUrl");
          if (urlInput) {
            urlInput.value = imageUrl;
            console.log("[BERITA] URL stored in hidden field");
          }

          // Update preview with uploaded image URL
          const previewImg = $("#beritaPreviewImg");
          const previewDiv = $("#beritaImagePreview");
          if (previewImg && previewDiv && imageUrl) {
            previewImg.src = imageUrl;
            previewDiv.style.display = "block";
            console.log("[BERITA] Preview updated with uploaded URL");
          } else {
            console.warn("[BERITA] Preview elements not found or no URL");
          }
        } catch (uploadError) {
          console.error("[BERITA] Upload failed:", uploadError);
          setButtonLoading(btn, false);
          safeToastr.error(uploadError.message || "Gagal mengupload gambar");
          return; // Stop submission if upload fails
        }
      }

      setButtonLoading(btn, true, id ? "Mengupdate..." : "Menyimpan...");

      const payload = {
        title_id: values.id.title,
        content_id: values.id.content,
        title_en: values.en.title,
        content_en: values.en.content,
        image_url: imageUrl,
        is_published: isPublished,
        published_date: publishedDate,
      };

      let message = "Berita ditambahkan";
      if (id) {
        payload.id = id;
        message = "Berita diperbarui";
        await jsonRequest(INFORMASI_ENDPOINTS.berita, {
          method: "PUT",
          body: payload,
        });
      } else {
        await jsonRequest(INFORMASI_ENDPOINTS.berita, {
          method: "POST",
          body: payload,
        });
      }
      safeToastr.success(message);
      localStorage.setItem(
        "berita_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: id ? "updated" : "created",
          id: id || null,
        })
      );
      await loadBeritaItems();

      // Keep preview if image was uploaded
      if (imageUrl) {
        const previewImg = $("#beritaPreviewImg");
        const previewDiv = $("#beritaImagePreview");
        if (previewImg && previewDiv) {
          previewImg.src = imageUrl;
          previewDiv.style.display = "block";
        }
      }

      resetBeritaForm();
    } catch (error) {
      console.error("[BERITA] Submit error:", error);
      safeToastr.error(error.message || "Gagal menyimpan berita");
    } finally {
      setButtonLoading(btn, false);
    }
  }

  function editBeritaItem(id) {
    const item = beritaItemsData.find((x) => x.id === id);
    if (!item) {
      safeToastr.error("Berita tidak ditemukan");
      return;
    }
    const idField = $("#beritaId");
    if (idField) idField.value = item.id;
    BERITA_LANGS.forEach((lang) => {
      const normalized = normalizeBeritaRecord(item);
      const titleField = getBeritaInput("title", lang);
      if (titleField)
        titleField.value =
          normalized[lang === "en" ? "title_en" : "title"] || "";
      const contentField = getBeritaInput("content", lang);
      if (contentField)
        contentField.value =
          normalized[lang === "en" ? "content_en" : "content"] || "";
    });

    // Handle image
    const imgField = $("#beritaImageUrl");
    if (imgField) imgField.value = item.image_url || "";

    // Show existing image preview
    if (item.image_url) {
      const previewImg = $("#beritaPreviewImg");
      const previewDiv = $("#beritaImagePreview");
      if (previewImg && previewDiv) {
        previewImg.src = item.image_url;
        previewDiv.style.display = "block";
      }
    }

    const pubField = $("#beritaIsPublished");
    if (pubField) pubField.checked = Boolean(item.is_published);
    const dateField = $("#beritaPublishedDate");
    if (dateField) {
      // Format date untuk input[type="date"] (YYYY-MM-DD)
      if (item.published_date) {
        const date = new Date(item.published_date);
        if (!isNaN(date.getTime())) {
          dateField.value = date.toISOString().split('T')[0];
        } else {
          dateField.value = "";
        }
      } else {
        dateField.value = "";
      }
    }
    const btn = $("#btnSaveBerita");
    if (btn) btn.innerHTML = '<i class="bi bi-save"></i> Update Berita';
    setBeritaActiveLang("id");
    getBeritaInput("title", "id")?.focus();
  }

  async function deleteBeritaItem(id) {
    const item = beritaItemsData.find((x) => x.id === id);
    if (!item) {
      safeToastr.error("Berita tidak ditemukan");
      return;
    }
    if (
      !confirm(
        `Hapus berita "${item.title || item.title_en}"?\n\nTindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }
    try {
      await jsonRequest(INFORMASI_ENDPOINTS.berita, {
        method: "DELETE",
        body: { id },
      });
      safeToastr.success("Berita dihapus");
      localStorage.setItem(
        "berita_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: "deleted",
          id: id,
        })
      );
      await loadBeritaItems();
      resetBeritaForm();
    } catch (error) {
      console.error("[BERITA] Delete error:", error);
      safeToastr.error(error.message || "Gagal menghapus berita");
    }
  }

  async function moveBeritaItem(id, direction) {
    const index = beritaItemsData.findIndex((x) => x.id === id);
    if (index === -1) {
      safeToastr.error("Berita tidak ditemukan");
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= beritaItemsData.length) {
      return;
    }
    const temp = beritaItemsData[index];
    beritaItemsData[index] = beritaItemsData[targetIndex];
    beritaItemsData[targetIndex] = temp;
    beritaItemsData.forEach((item, idx) => {
      item.order_index = idx + 1;
    });
    const items = beritaItemsData.map((item) => ({
      id: item.id,
      order_index: item.order_index,
    }));
    try {
      await jsonRequest(INFORMASI_ENDPOINTS.berita, {
        method: "PUT",
        body: { items },
      });
      localStorage.setItem(
        "berita_items_update",
        JSON.stringify({
          timestamp: Date.now(),
          action: "reordered",
        })
      );
      renderBeritaItems();
    } catch (error) {
      console.error("[BERITA] Move error:", error);
      safeToastr.error("Gagal mengubah urutan berita");
      await loadBeritaItems();
    }
  }

  window.loadBeritaItems = loadBeritaItems;
  window.editBeritaItem = editBeritaItem;
  window.deleteBeritaItem = deleteBeritaItem;
  window.moveBeritaItem = moveBeritaItem;

  /* =========================
     15) PAYMENT SETTINGS
     ========================= */
  async function loadPaymentSettings() {
    try {
      const result = await jsonRequest("/api/payment_settings");
      if (result.ok && result.data) {
        const d = result.data;
        const bankNameEl = $("#payment-bank-name");
        if (bankNameEl) bankNameEl.value = d.bank_name || "";

        const bankAccEl = $("#payment-bank-account");
        if (bankAccEl) bankAccEl.value = d.bank_account || "";

        const bankHolderEl = $("#payment-bank-holder");
        if (bankHolderEl) bankHolderEl.value = d.bank_holder || "";

        const nominalEl = $("#payment-nominal");
        if (nominalEl) nominalEl.value = d.nominal || "";

        const qrisDataEl = $("#payment-qris-data");
        if (qrisDataEl) qrisDataEl.value = d.qris_data || "";

        const qrisNominalEl = $("#payment-qris-nominal");
        if (qrisNominalEl) qrisNominalEl.value = d.qris_nominal || "";

        const preview = $("#payment-qris-preview");
        const noneMsg = $("#payment-qris-none");
        const statusOk = $("#qris-data-status");
        const statusMissing = $("#qris-data-missing");

        if (preview && noneMsg) {
          if (d.qris_image_url) {
            preview.src = d.qris_image_url;
            preview.style.display = "block";
            noneMsg.style.display = "none";

            // Check data status
            if (d.qris_data) {
              if (statusOk) statusOk.style.display = "block";
              if (statusMissing) statusMissing.style.display = "none";
            } else {
              if (statusOk) statusOk.style.display = "none";
              if (statusMissing) statusMissing.style.display = "block";
            }
          } else {
            preview.style.display = "none";
            noneMsg.style.display = "block";
            if (statusOk) statusOk.style.display = "none";
            if (statusMissing) statusMissing.style.display = "none";
          }
        }
      }
    } catch (e) {
      console.error("Error loading payment settings:", e);
      safeToastr.error("Gagal memuat pengaturan pembayaran");
    }
  }

  async function savePaymentSettings() {
    const btn = document.querySelector("button[onclick='savePaymentSettings()']");
    setButtonLoading(btn, true);

    try {
      const payload = {
        bank_name: $("#payment-bank-name")?.value,
        bank_account: $("#payment-bank-account")?.value,
        bank_holder: $("#payment-bank-holder")?.value,
        nominal: toInteger($("#payment-nominal")?.value),
        qris_nominal: toInteger($("#payment-qris-nominal")?.value),
        qris_data: $("#payment-qris-data")?.value,
      };

      // Handle QRIS upload if file selected
      const fileInput = $("#payment-qris-file");
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        // Convert to base64 for simplicity (assuming small image)
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        payload.qris_image_url = base64;
      }

      const result = await jsonRequest("/api/payment_settings", {
        method: "POST",
        body: payload
      });

      if (result.ok) {
        safeToastr.success("Pengaturan pembayaran berhasil disimpan");
        loadPaymentSettings(); // Reload to show updated data/image
        // Clear file input
        if (fileInput) fileInput.value = "";
      }
    } catch (e) {
      console.error("Error saving payment settings:", e);
      safeToastr.error("Gagal menyimpan pengaturan: " + e.message);
    } finally {
      setButtonLoading(btn, false, "Simpan Perubahan");
    }
  }

  // Expose functions
  window.loadPaymentSettings = loadPaymentSettings;
  window.savePaymentSettings = savePaymentSettings;
  console.log("[ADMIN] Payment settings functions registered");

  // QRIS Preview & Auto-Scan Handler
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "payment-qris-file") {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target.result;

          // 1. Show Preview
          const preview = document.getElementById("payment-qris-preview");
          const noneMsg = document.getElementById("payment-qris-none");
          if (preview && noneMsg) {
            preview.src = result;
            preview.style.display = "block";
            noneMsg.style.display = "none";
          }

          // 2. Auto-Scan QR Code
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            const qrisDataInput = document.getElementById("payment-qris-data");
            const statusOk = document.getElementById("qris-data-status");
            const statusMissing = document.getElementById("qris-data-missing");

            if (code && qrisDataInput) {
              console.log("[QRIS] Auto-scan success:", code.data);
              qrisDataInput.value = code.data;
              if (typeof safeToastr !== 'undefined') {
                safeToastr.success("QRIS berhasil discan otomatis!");
              }

              // Show OK status
              if (statusOk) statusOk.style.display = "block";
              if (statusMissing) statusMissing.style.display = "none";

              // Highlight the input to show it changed
              qrisDataInput.style.borderColor = "#198754";
              qrisDataInput.style.backgroundColor = "#f8fffb";
              setTimeout(() => {
                qrisDataInput.style.borderColor = "";
                qrisDataInput.style.backgroundColor = "";
              }, 2000);
            } else {
              console.warn("[QRIS] No QR code found in image");
              if (typeof safeToastr !== 'undefined') {
                safeToastr.warning("QR Code tidak terdeteksi otomatis. Gambar akan disimpan sebagai statis.");
              }
              // Clear data if any
              if (qrisDataInput) qrisDataInput.value = "";

              // Show Missing status
              if (statusOk) statusOk.style.display = "none";
              if (statusMissing) statusMissing.style.display = "block";
            }
          };
          img.src = result;
        };
        reader.readAsDataURL(file);
      }
    }
  });

  /* =========================
     9) INIT
     ========================= */
  document.addEventListener("DOMContentLoaded", () => {
    console.log("[ADMIN] 🚀 Page loaded - initializing...");

    // ✅ ONLY load active tab (pendaftar)
    // Other tabs will lazy-load when clicked via switchTab()
    console.log("[ADMIN] 📊 Loading initial data: Pendaftar only");
    loadPendaftar();

    // ❌ REMOVED: loadPembayaran() - will lazy load on tab switch
    console.log("[ADMIN] ✅ Initial load complete (lazy loading enabled for other tabs)");
  });
})();
