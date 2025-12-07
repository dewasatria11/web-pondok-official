/**
 * ==============================================
 * HERO CAROUSEL - JavaScript Controller
 * Al Ikhsan Beji - SMPDISS Style
 * ==============================================
 * 
 * Features:
 * - Auto-rotation every 6 seconds
 * - Manual navigation via arrows and dots
 * - Fade/slide animations for text and images
 * - IntersectionObserver for scroll-triggered animations
 * 
 * How to customize:
 * - Change AUTOPLAY_INTERVAL to adjust rotation speed
 * - Add/remove slides in HTML with data-slide attributes
 * - Images are in .hero-slide-image elements
 * - Text is in .hero-slide-text elements
 */

(function () {
    'use strict';

    // ================================
    // CONFIGURATION
    // ================================
    const AUTOPLAY_INTERVAL = 6000; // Auto-rotate every 6 seconds
    const TOTAL_SLIDES = 3; // Number of slides in the carousel

    // ================================
    // DOM ELEMENTS
    // ================================
    let heroSection = null;
    let slideTexts = null;
    let slideImages = null;
    let dots = null;
    let prevBtn = null;
    let nextBtn = null;

    // State
    let currentSlide = 0;
    let autoplayTimer = null;
    let isHeroVisible = false;

    /**
     * Initialize the hero carousel
     * Called when DOM is ready
     */
    function initHeroCarousel() {
        // Get DOM elements
        heroSection = document.querySelector('.hero-carousel');
        if (!heroSection) {
            console.log('[HERO_CAROUSEL] Hero section not found');
            return;
        }

        slideTexts = heroSection.querySelectorAll('.hero-slide-text');
        slideImages = heroSection.querySelectorAll('.hero-slide-image');
        dots = heroSection.querySelectorAll('.hero-dot');
        prevBtn = document.getElementById('heroPrev');
        nextBtn = document.getElementById('heroNext');

        if (slideTexts.length === 0 || slideImages.length === 0) {
            console.log('[HERO_CAROUSEL] No slides found');
            return;
        }

        console.log(`[HERO_CAROUSEL] Found ${slideTexts.length} slides`);

        // Set initial state - hide hero until visible
        heroSection.classList.add('hero-not-visible');

        // Bind navigation events
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                goToSlide(currentSlide - 1);
                resetAutoplay();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                goToSlide(currentSlide + 1);
                resetAutoplay();
            });
        }

        // Bind dot click events
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                goToSlide(index);
                resetAutoplay();
            });
        });

        // Setup IntersectionObserver for scroll reveal
        setupIntersectionObserver();

        console.log('[HERO_CAROUSEL] ✅ Carousel initialized');
    }

    /**
     * Go to a specific slide
     * @param {number} index - Slide index (0-based)
     */
    function goToSlide(index) {
        // Handle wrap-around
        if (index < 0) {
            index = TOTAL_SLIDES - 1;
        } else if (index >= TOTAL_SLIDES) {
            index = 0;
        }

        // Skip if same slide
        if (index === currentSlide) return;

        console.log(`[HERO_CAROUSEL] Switching to slide ${index + 1}`);

        // Remove active class from current slide elements
        slideTexts.forEach(text => text.classList.remove('hero-slide-text--active'));
        slideImages.forEach(img => img.classList.remove('hero-slide-image--active'));
        dots.forEach(dot => dot.classList.remove('hero-dot--active'));

        // Add active class to new slide elements
        const newTextSlide = heroSection.querySelector(`.hero-slide-text[data-slide="${index}"]`);
        const newImageSlide = heroSection.querySelector(`.hero-slide-image[data-slide="${index}"]`);
        const newDot = heroSection.querySelector(`.hero-dot[data-slide="${index}"]`);

        if (newTextSlide) newTextSlide.classList.add('hero-slide-text--active');
        if (newImageSlide) newImageSlide.classList.add('hero-slide-image--active');
        if (newDot) newDot.classList.add('hero-dot--active');

        currentSlide = index;
    }

    /**
     * Go to next slide
     */
    function nextSlide() {
        goToSlide(currentSlide + 1);
    }

    /**
     * Start autoplay timer
     */
    function startAutoplay() {
        if (autoplayTimer) return; // Already running

        autoplayTimer = setInterval(() => {
            nextSlide();
        }, AUTOPLAY_INTERVAL);

        console.log('[HERO_CAROUSEL] Autoplay started');
    }

    /**
     * Stop autoplay timer
     */
    function stopAutoplay() {
        if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
            console.log('[HERO_CAROUSEL] Autoplay stopped');
        }
    }

    /**
     * Reset autoplay timer (called after manual navigation)
     */
    function resetAutoplay() {
        stopAutoplay();
        if (isHeroVisible) {
            startAutoplay();
        }
    }

    /**
     * Setup IntersectionObserver for scroll reveal
     * Animations start only when hero enters viewport
     */
    function setupIntersectionObserver() {
        // Check for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            heroSection.classList.remove('hero-not-visible');
            heroSection.classList.add('hero-visible');
            isHeroVisible = true;
            startAutoplay();
            console.log('[HERO_CAROUSEL] Reduced motion - skipping scroll animations');
            return;
        }

        // Check if IntersectionObserver is supported
        if (!('IntersectionObserver' in window)) {
            heroSection.classList.remove('hero-not-visible');
            heroSection.classList.add('hero-visible');
            isHeroVisible = true;
            startAutoplay();
            console.log('[HERO_CAROUSEL] IntersectionObserver not supported - showing immediately');
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !isHeroVisible) {
                    // Hero entered viewport for the first time
                    isHeroVisible = true;
                    heroSection.classList.remove('hero-not-visible');
                    heroSection.classList.add('hero-visible');

                    // Start autoplay
                    startAutoplay();

                    console.log('[HERO_CAROUSEL] ✅ Hero visible - animations started');

                    // Stop observing after first trigger
                    observer.unobserve(heroSection);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        });

        observer.observe(heroSection);
        console.log('[HERO_CAROUSEL] IntersectionObserver set up');
    }

    /**
     * Pause autoplay when page is not visible
     */
    function handleVisibilityChange() {
        if (document.hidden) {
            stopAutoplay();
        } else if (isHeroVisible) {
            startAutoplay();
        }
    }

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ================================
    // INITIALIZE WHEN DOM READY
    // ================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeroCarousel);
    } else {
        // DOM already loaded
        initHeroCarousel();
    }

})();
