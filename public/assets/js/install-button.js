(function () {
  const BUTTON_SELECTOR = '[data-install-button]';
  const UNAVAILABLE_HINT =
    'Install tersedia ketika browser mendeteksi aplikasi dapat dipasang.';

  const setButtonsState = (buttons, available) => {
    buttons.forEach((button) => {
      // ALWAYS enable button, just change the appearance
      button.disabled = false;
      button.removeAttribute('aria-disabled');

      if (available) {
        button.removeAttribute('title');
        button.classList.remove('opacity-60');
      } else {
        // Show hint but keep button enabled
        if (button.dataset.installUnavailableText) {
          button.title = button.dataset.installUnavailableText;
        } else {
          button.title = UNAVAILABLE_HINT;
        }
        button.classList.add('opacity-60');
      }
    });
  };

  const setButtonsLoading = (buttons, isLoading) => {
    buttons.forEach((button) => {
      if (isLoading) {
        button.setAttribute('aria-busy', 'true');
      } else {
        button.removeAttribute('aria-busy');
      }
      button.classList.toggle('opacity-70', isLoading);
      button.classList.toggle('cursor-not-allowed', isLoading);
    });
  };

  const showInstallInfo = () => {
    const message = `
📱 Informasi Install PWA:

Aplikasi ini dapat diinstall sebagai Progressive Web App (PWA).

Kemungkinan penyebab tombol install tidak tersedia:
1. ✅ Aplikasi sudah terinstall di perangkat Anda
2. 🌐 Browser tidak mendukung PWA install (gunakan Chrome/Edge)
3. 📱 Pada iOS: Gunakan Safari, tap tombol Share → "Add to Home Screen"

Untuk install manual:
• Chrome/Edge Desktop: Klik ikon ⊕ di address bar
• Chrome Android: Menu (⋮) → "Install app" atau "Add to Home Screen"
• Safari iOS: Share button → "Add to Home Screen"
    `.trim();

    alert(message);
    console.log('[PWA Install] beforeinstallprompt event not available');
    console.log('[PWA Install] window.deferredPWAInstallPrompt:', window.deferredPWAInstallPrompt);
  };

  const initInstallButtons = () => {
    const buttons = Array.from(document.querySelectorAll(BUTTON_SELECTOR));
    if (!buttons.length) {
      console.log('[PWA Install] No install buttons found');
      return;
    }

    console.log(`[PWA Install] Found ${buttons.length} install button(s)`);

    const refreshButtons = () => {
      const available = Boolean(window.deferredPWAInstallPrompt);
      console.log('[PWA Install] Refresh buttons - available:', available);
      setButtonsState(buttons, available);
    };

    const handleClick = async (event) => {
      event.preventDefault();
      console.log('[PWA Install] Button clicked');

      const promptEvent = window.deferredPWAInstallPrompt;

      if (!promptEvent) {
        console.warn('[PWA Install] No install prompt available, showing info');
        showInstallInfo();
        refreshButtons();
        return;
      }

      console.log('[PWA Install] Showing install prompt');
      setButtonsLoading(buttons, true);

      try {
        promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        console.log('[PWA Install] User choice:', choiceResult.outcome);

        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA Install] User accepted the install prompt');
        } else {
          console.log('[PWA Install] User dismissed the install prompt');
        }
      } catch (error) {
        console.error('[PWA Install] Error showing prompt:', error);
        showInstallInfo();
      } finally {
        window.deferredPWAInstallPrompt = null;
        setButtonsLoading(buttons, false);
        refreshButtons();
      }
    };

    buttons.forEach((button) => {
      button.addEventListener('click', handleClick);
    });

    document.addEventListener('pwa-install-ready', () => {
      console.log('[PWA Install] pwa-install-ready event received');
      refreshButtons();
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA Install] App installed successfully');
      window.deferredPWAInstallPrompt = null;
      refreshButtons();
    });

    // Initial state
    refreshButtons();

    // Debug: Check after 2 seconds if event was received
    setTimeout(() => {
      if (!window.deferredPWAInstallPrompt) {
        console.warn('[PWA Install] beforeinstallprompt event not received after 2s');
        console.log('[PWA Install] Possible reasons:');
        console.log('  1. App is already installed');
        console.log('  2. Browser does not support PWA install');
        console.log('  3. PWA criteria not met (manifest, service worker, HTTPS)');
      }
    }, 2000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInstallButtons);
  } else {
    initInstallButtons();
  }
})();
