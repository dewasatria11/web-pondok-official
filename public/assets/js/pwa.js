(function () {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.info('Service worker terdaftar:', registration.scope);
        try {
          registration.update();
        } catch (e) { }
      })
      .catch((error) => {
        console.error('Gagal mendaftarkan service worker', error);
      });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.deferredPWAInstallPrompt = event;
    document.dispatchEvent(new CustomEvent('pwa-install-ready'));
  });

  window.addEventListener('appinstalled', () => {
    window.deferredPWAInstallPrompt = null;
    console.info('Aplikasi PPDSB berhasil di-install.');
  });
})();
