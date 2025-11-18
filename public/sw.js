const CACHE_NAME = 'ppdsb-pwa-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/alur-pendaftaran.html',
  '/admin.html',
  '/biaya.html',
  '/brosur.html',
  '/cek-status.html',
  '/daftar.html',
  '/kontak.html',
  '/login.html',
  '/pembayaran.html',
  '/syarat-pendaftaran.html',
  '/offline.html',
  '/assets/css/tailwind.css',
  '/assets/js/navbar.js',
  '/assets/js/pwa.js',
  '/i18n.js',
  '/locales/id.json',
  '/locales/en.json',
  '/favicon.ico',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/logo-bimi.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
    return;
  }

  // 🚫 Jangan cache request API supaya data admin (pendaftar/pembayaran/etc) selalu real-time
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkOnly(event.request));
    return;
  }

  if (isHtmlRequest(event.request)) {
    event.respondWith(handleHtmlRequest(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const freshResponse = await fetch(request);
    cache.put(request, freshResponse.clone());
    return freshResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    return cachedResponse || cache.match('/offline.html');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const freshResponse = await fetch(request);
    cache.put(request, freshResponse.clone());
    return freshResponse;
  } catch (error) {
    return isHtmlRequest(request) ? cache.match('/offline.html') : Response.error();
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return Response.error();
  }
}

/* ===== Maintenance-aware HTML handling ===== */
const MAINTENANCE_API = '/api/maintenance_status';
const MAINTENANCE_CACHE_TTL = 60 * 1000; // 1 menit
let maintenanceState = {
  active: false,
  message: '',
  updated_at: null,
  updated_by: '',
};
let maintenanceLastCheck = 0;

async function getMaintenanceState() {
  const now = Date.now();
  if (now - maintenanceLastCheck < MAINTENANCE_CACHE_TTL) {
    return maintenanceState;
  }

  try {
    const res = await fetch(MAINTENANCE_API, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok) {
      maintenanceState = {
        active: Boolean(data.data?.active),
        message: data.data?.message || '',
        updated_at: data.data?.updated_at || null,
        updated_by: data.data?.updated_by || '',
      };
    }
  } catch (error) {
    // Biarkan state sebelumnya (fail open)
  } finally {
    maintenanceLastCheck = now;
  }

  return maintenanceState;
}

function maintenancePageHTML(state) {
  const message =
    state.message ||
    'Assalamualaikum Wr. Wb. Situs sedang dalam perawatan singkat. Mohon berkenan kembali beberapa saat lagi.';
  const updatedBy = state.updated_by ? `Admin: ${state.updated_by}` : 'Admin sedang mempersiapkan layanan terbaik.';
  const updatedAt = state.updated_at
    ? new Date(state.updated_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })
    : 'Waktu pembaruan tidak tersedia';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sedang Perawatan Sistem</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(1.5rem, 4vw, 4rem);
      background:
        radial-gradient(circle at top, rgba(26,83,25,0.92), rgba(6,24,11,0.97)),
        repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 12px);
      color: #f7f7f7;
      text-align: center;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      opacity: 0.2;
      background:
        radial-gradient(circle, rgba(255,255,255,0.18) 0, transparent 55%) top left / 200px 200px,
        radial-gradient(circle, rgba(255,255,255,0.1) 0, transparent 60%) bottom right / 260px 260px;
      pointer-events: none;
    }
    .card {
      position: relative;
      max-width: 720px;
      width: 100%;
      padding: clamp(1.5rem, 5vw, 3rem);
      border-radius: 30px;
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(8px);
      box-shadow: 0 25px 60px rgba(0,0,0,0.35);
      overflow: hidden;
    }
    .card::after {
      content: '';
      position: absolute;
      inset: 10%;
      border-radius: 26px;
      border: 1px solid rgba(255,255,255,0.12);
      pointer-events: none;
    }
    .icon {
      width: 90px;
      height: 90px;
      margin: 0 auto 1rem;
      border-radius: 50%;
      background: rgba(255,255,255,0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
    }
    h1 {
      font-size: clamp(1.8rem, 5vw, 2.6rem);
      margin: 0.5rem 0 0.75rem;
    }
    .basmalah {
      letter-spacing: 0.3em;
      font-size: 0.85rem;
      text-transform: uppercase;
      color: rgba(255,255,255,0.75);
      margin-bottom: 0.75rem;
    }
    .salam {
      margin: 0;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
    }
    .message {
      margin: 1rem 0;
      line-height: 1.8;
      font-size: 1.05rem;
      color: rgba(255,255,255,0.92);
    }
    .meta {
      font-size: 0.95rem;
      color: rgba(255,255,255,0.75);
      margin-bottom: 0.5rem;
    }
    .doa {
      font-style: italic;
      color: rgba(255,255,255,0.85);
      margin-top: 1rem;
    }
    .button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
      padding: 0.85rem 2.25rem;
      border-radius: 999px;
      border: none;
      background: linear-gradient(135deg, #facc15, #f97316);
      color: #0d1b0f;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card" role="alert">
    <div class="icon">🛠️</div>
    <div class="basmalah">Bismillahirrahmanirrahim</div>
    <p class="salam">Assalamualaikum Warahmatullahi Wabarakatuh</p>
    <h1>Situs Sedang Dalam Perawatan</h1>
    <p class="message">${escapeHtml(message)}</p>
    <p class="meta">${escapeHtml(updatedBy)}</p>
    <p class="meta">${escapeHtml(updatedAt)}</p>
    <p class="doa">Semoga Allah SWT memudahkan segala urusan dan memberikan kelancaran bagi kita semua. Terima kasih atas pengertian Anda.</p>
    <button class="button" onclick="location.reload()">
      <span>Segarkan Halaman</span>
    </button>
  </div>
</body>
</html>`;
}

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MAINTENANCE_BYPASS_PATHS = [
  '/admin',
  '/admin.html',
  '/login',
  '/login.html',
  '/admin/index.html',
  '/login/index.html',
];
const MAINTENANCE_BYPASS_PARAM = 'preview';
const MAINTENANCE_BYPASS_TOKEN = 'admin';

async function handleHtmlRequest(request) {
  const url = new URL(request.url);
  const hasBypassToken =
    url.searchParams.get(MAINTENANCE_BYPASS_PARAM) === MAINTENANCE_BYPASS_TOKEN;

  if (
    hasBypassToken ||
    MAINTENANCE_BYPASS_PATHS.some((path) => url.pathname.startsWith(path))
  ) {
    return networkFirst(request);
  }

  const state = await getMaintenanceState();
  if (state.active) {
    return new Response(maintenancePageHTML(state), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return networkFirst(request);
}
