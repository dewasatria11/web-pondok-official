// Disable console logs for public users
(function () {
    console.log = function () { };
    console.warn = function () { };
    console.error = function () { };
    console.info = function () { };
    console.debug = function () { };
})();

/**
 * ==============================================
 * SCROLL REVEAL ANIMATIONS - JavaScript Controller
 * Pondok Pesantren Al Ikhsan Beji
 * ==============================================
 * 
 * Menggunakan IntersectionObserver untuk mendeteksi saat elemen
 * masuk ke viewport dan menambahkan class "reveal-active".
 * 
 * Cara kerja:
 * 1. Observer mencari semua elemen dengan class "reveal"
 * 2. Saat elemen terlihat 15% di viewport, class "reveal-active" ditambahkan
 * 3. Animasi CSS transition akan berjalan otomatis
 * 4. Observer berhenti mengamati setelah animasi selesai (once: true)
 */

(function () {
    'use strict';

    // Konfigurasi observer
    const CONFIG = {
        // Threshold: berapa persen elemen harus terlihat sebelum trigger (0.15 = 15%)
        threshold: 0.15,
        // Root margin: area tambahan di sekitar viewport (negatif = trigger lebih awal)
        rootMargin: '0px 0px -50px 0px'
    };

    /**
     * Inisialisasi scroll reveal animations
     * Dipanggil saat DOM sudah siap
     */
    function initScrollReveal() {
        // Cek apakah browser mendukung IntersectionObserver
        if (!('IntersectionObserver' in window)) {
            // Fallback: langsung tampilkan semua elemen tanpa animasi
            showAllElements();
            console.log('[SCROLL_REVEAL] IntersectionObserver not supported, showing all elements');
            return;
        }

        // Cek preferensi reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            showAllElements();
            console.log('[SCROLL_REVEAL] Reduced motion enabled, skipping animations');
            return;
        }

        // Ambil semua elemen yang memiliki class "reveal"
        const revealElements = document.querySelectorAll('.reveal');

        if (revealElements.length === 0) {
            console.log('[SCROLL_REVEAL] No reveal elements found');
            return;
        }

        console.log(`[SCROLL_REVEAL] Found ${revealElements.length} elements to animate`);

        // Buat IntersectionObserver
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                // Jika elemen terlihat di viewport
                if (entry.isIntersecting) {
                    // Tambahkan class reveal-active untuk trigger animasi
                    entry.target.classList.add('reveal-active');

                    // Berhenti mengamati elemen ini (animasi hanya sekali)
                    observer.unobserve(entry.target);

                    // Debug log (bisa dihapus di production)
                    // console.log('[SCROLL_REVEAL] Revealed:', entry.target);
                }
            });
        }, {
            threshold: CONFIG.threshold,
            rootMargin: CONFIG.rootMargin
        });

        // Observe semua elemen reveal
        revealElements.forEach(element => {
            observer.observe(element);
        });

        // Log untuk debugging
        console.log('[SCROLL_REVEAL] ✅ Observer initialized');
    }

    /**
     * Fallback: tampilkan semua elemen langsung tanpa animasi
     * Digunakan saat IntersectionObserver tidak didukung
     * atau saat reduced motion aktif
     */
    function showAllElements() {
        const revealElements = document.querySelectorAll('.reveal');
        revealElements.forEach(element => {
            element.classList.add('reveal-active');
        });
    }

    /**
     * Re-initialize untuk dynamic content
     * Panggil fungsi ini jika ada konten baru yang ditambahkan ke halaman
     * Contoh: setelah AJAX load, setelah render komponen baru, dll
     */
    function refreshScrollReveal() {
        initScrollReveal();
    }

    // Expose ke global scope untuk digunakan oleh script lain
    window.refreshScrollReveal = refreshScrollReveal;

    // Jalankan saat DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollReveal);
    } else {
        // DOM already loaded
        initScrollReveal();
    }

    // Re-initialize saat bahasa berubah (i18n support)
    window.addEventListener('i18n:languageChanged', () => {
        // Delay sedikit untuk memastikan DOM sudah update
        setTimeout(refreshScrollReveal, 100);
    });

    /**
     * ==============================================
     * HERO SECTION ANIMATIONS (SMPDISS Style)
     * ==============================================
     * Animasi entrance untuk hero section menggunakan IntersectionObserver
     * Elemen dengan class "fade-up" dan "fade-in" akan dianimasikan
     * saat hero section masuk ke viewport
     */
    function initHeroAnimations() {
        const heroSection = document.querySelector('.hero-smpdiss');
        const fadeUpElements = document.querySelectorAll('.hero-smpdiss .fade-up');
        const fadeInElements = document.querySelectorAll('.hero-smpdiss .fade-in');

        const allHeroElements = [...fadeUpElements, ...fadeInElements];

        if (allHeroElements.length === 0) {
            console.log('[HERO_ANIM] No hero animation elements found');
            return;
        }

        // Cek preferensi reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            allHeroElements.forEach(item => item.classList.add('active'));
            console.log('[HERO_ANIM] Reduced motion enabled, showing all elements immediately');
            return;
        }

        console.log(`[HERO_ANIM] Found ${allHeroElements.length} hero elements to animate`);

        // Menggunakan IntersectionObserver untuk trigger animasi saat hero terlihat
        if ('IntersectionObserver' in window) {
            const heroObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Animate semua hero elements dengan staggered timing
                        allHeroElements.forEach((element, index) => {
                            setTimeout(() => {
                                element.classList.add('active');
                            }, index * 100); // 100ms delay antar elemen
                        });

                        // Hentikan observasi setelah animasi berjalan
                        heroObserver.unobserve(entry.target);
                        console.log('[HERO_ANIM] ✅ Hero animations triggered');
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });

            // Observe hero section
            if (heroSection) {
                heroObserver.observe(heroSection);
                console.log('[HERO_ANIM] ✅ Hero observer initialized');
            }
        } else {
            // Fallback: langsung animate jika IntersectionObserver tidak tersedia
            allHeroElements.forEach((element, index) => {
                setTimeout(() => {
                    element.classList.add('active');
                }, 200 + (index * 100));
            });
            console.log('[HERO_ANIM] ✅ Hero animations (fallback) initialized');
        }
    }

    // Jalankan hero animations saat DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeroAnimations);
    } else {
        // DOM already loaded, small delay for CSS to load
        setTimeout(initHeroAnimations, 100);
    }

})();

