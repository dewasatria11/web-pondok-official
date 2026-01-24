/**
 * Multi-Step Wizard Form
 * Handles navigation, validation, localStorage, and Step 7 review generation
 */

(function () {
    'use strict';

    // ==================== Configuration ====================
    const WIZARD_CONFIG = {
        totalSteps: 7,
        localStorageKey: 'pendaftaran_draft',
        autoSaveDelay: 500, // ms
    };

    // ==================== State Management ====================
    const wizardState = {
        currentStep: 1,
        completedSteps: [],
        formData: {},
        editingFromStep7: false,
    };

    // ==================== DOM Elements ====================
    let elements = {};

    function initializeElements() {
        elements = {
            steps: document.querySelectorAll('.wizard-form-step'),
            sidebarItems: document.querySelectorAll('.wizard-step-item'),
            prevBtn: document.getElementById('wizard-prev-btn'),
            nextBtn: document.getElementById('wizard-next-btn'),
            backToReviewBtn: document.getElementById('wizard-back-to-review-btn'),
            submitBtn: document.getElementById('wizard-submit-btn'),
            confirmationCheckbox: document.getElementById('confirmation-checkbox'),
            reviewContent: document.getElementById('wizard-review-content'),
            form: document.getElementById('formPendaftar'),
        };
    }

    // ==================== Utility Functions ====================
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function getFormDataFromStep(stepNumber) {
        const stepElement = document.querySelector(`[data-wizard-step="${stepNumber}"]`);
        if (!stepElement) return {};

        const formData = {};
        const inputs = stepElement.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            if (input.type === 'file') {
                if (input.files && input.files[0]) {
                    formData[input.name] = {
                        name: input.files[0].name,
                        size: input.files[0].size,
                        type: input.files[0].type,
                    };
                }
            } else if (input.type === 'checkbox') {
                formData[input.name] = input.checked;
            } else if (input.type === 'radio') {
                if (input.checked) {
                    formData[input.name] = input.value;
                }
            } else {
                formData[input.name] = input.value;
            }
        });

        return formData;
    }

    function getAllFormData() {
        const allData = {};
        for (let i = 1; i <= WIZARD_CONFIG.totalSteps - 1; i++) {
            Object.assign(allData, getFormDataFromStep(i));
        }
        return allData;
    }

    // ==================== localStorage Functions ====================
    function saveToLocalStorage() {
        try {
            const dataToSave = {
                currentStep: wizardState.currentStep,
                completedSteps: wizardState.completedSteps,
                formData: getAllFormData(),
                timestamp: Date.now(),
            };
            localStorage.setItem(WIZARD_CONFIG.localStorageKey, JSON.stringify(dataToSave));
        } catch (error) {
            console.warn('[Wizard] Failed to save to localStorage:', error);
        }
    }

    const debouncedSave = debounce(saveToLocalStorage, WIZARD_CONFIG.autoSaveDelay);

    function loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(WIZARD_CONFIG.localStorageKey);
            if (!saved) return false;

            const data = JSON.parse(saved);
            if (!data || !data.formData) return false;

            // Restore form data
            Object.keys(data.formData).forEach(name => {
                const input = elements.form.querySelector(`[name="${name}"]`);
                if (!input) return;

                if (input.type === 'checkbox') {
                    input.checked = data.formData[name];
                } else if (input.type === 'radio') {
                    if (input.value === data.formData[name]) {
                        input.checked = true;
                    }
                } else if (input.type !== 'file') {
                    input.value = data.formData[name];
                }
            });

            // Restore wizard state
            if (data.completedSteps) {
                wizardState.completedSteps = data.completedSteps;
            }
            if (data.currentStep) {
                wizardState.currentStep = data.currentStep;
            }

            console.log('[Wizard] Data restored from localStorage');
            return true;
        } catch (error) {
            console.warn('[Wizard] Failed to load from localStorage:', error);
            return false;
        }
    }

    function clearLocalStorage() {
        try {
            localStorage.removeItem(WIZARD_CONFIG.localStorageKey);
            console.log('[Wizard] localStorage cleared');
        } catch (error) {
            console.warn('[Wizard] Failed to clear localStorage:', error);
        }
    }

    // ==================== Validation Functions ====================
    function validateStep(stepNumber) {
        const stepElement = document.querySelector(`[data-wizard-step="${stepNumber}"]`);
        if (!stepElement) return true;

        // Special Check for Gelombang (Step 1)
        if (stepNumber === 1) {
            const gelombangInput = document.getElementById('gelombangInput');
            if (gelombangInput && (!gelombangInput.value || gelombangInput.value.trim() === '')) {
                console.error('[Wizard] Gelombang is empty');
                alert('Sistem Gagal Memuat Data Gelombang Pendaftaran. Mohon Refresh Halaman atau Cek Koneksi Internet.');
                return false;
            }
        }

        const inputs = stepElement.querySelectorAll('input, select, textarea');
        let isValid = true;

        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.disabled) {
                if (input.type === 'checkbox') {
                    if (!input.checked) isValid = false;
                } else if (input.type === 'radio') {
                    const radioGroup = stepElement.querySelectorAll(`input[name="${input.name}"]`);
                    const anyChecked = Array.from(radioGroup).some(radio => radio.checked);
                    if (!anyChecked) isValid = false;
                } else if (input.type === 'file') {
                    if (!input.files || input.files.length === 0) isValid = false;
                } else {
                    if (!input.value || input.value.trim() === '') isValid = false;
                }

                // HTML5 validation
                if (!input.checkValidity()) {
                    isValid = false;
                }
            }
        });

        // Show validation messages
        if (!isValid) {
            const firstInvalid = stepElement.querySelector('input:invalid, select:invalid, textarea:invalid');
            if (firstInvalid) {
                firstInvalid.reportValidity();
                console.log('[Wizard] Validation failed on:', firstInvalid);

                // Show generic message
                try {
                    if (typeof toastr !== 'undefined') {
                        toastr.warning('Mohon lengkapi data yang wajib diisi sebelum melanjutkan.');
                    } else {
                        // Debounce alert to avoid spam
                        if (!window._wizardAlertShown) {
                            alert('Mohon lengkapi data yang wajib diisi.');
                            window._wizardAlertShown = true;
                            setTimeout(() => window._wizardAlertShown = false, 2000);
                        }
                    }
                } catch (e) { console.error(e); }
            }
        }

        return isValid;
    }

    // ==================== Step Navigation ====================
    function updateStepDisplay() {
        // Update step visibility
        elements.steps.forEach((step, index) => {
            const stepNum = index + 1;
            if (stepNum === wizardState.currentStep) {
                step.classList.add('active');
                step.classList.remove('hidden');
            } else {
                step.classList.remove('active');
                step.classList.add('hidden');
            }
        });

        // Update sidebar
        elements.sidebarItems.forEach((item, index) => {
            const stepNum = index + 1;
            item.classList.remove('active', 'completed');

            if (stepNum === wizardState.currentStep) {
                item.classList.add('active');
            } else if (wizardState.completedSteps.includes(stepNum)) {
                item.classList.add('completed');
            }

            // Update step number content
            const stepNumber = item.querySelector('.wizard-step-number');
            if (wizardState.completedSteps.includes(stepNum) && stepNum !== wizardState.currentStep) {
                stepNumber.innerHTML = '<i class="bi bi-check-lg"></i>';
            } else {
                stepNumber.textContent = stepNum;
            }
        });

        // Update buttons
        updateNavigationButtons();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateNavigationButtons() {
        const isFirstStep = wizardState.currentStep === 1;
        const isLastStep = wizardState.currentStep === WIZARD_CONFIG.totalSteps;

        // Previous button
        if (elements.prevBtn) {
            elements.prevBtn.disabled = isFirstStep;
            elements.prevBtn.style.display = isFirstStep ? 'none' : 'inline-flex';
        }

        // Next button
        if (elements.nextBtn) {
            elements.nextBtn.style.display = (isLastStep || wizardState.currentStep === WIZARD_CONFIG.totalSteps - 1) ? 'none' : 'inline-flex';
        }

        // Back to Review button
        if (elements.backToReviewBtn) {
            elements.backToReviewBtn.style.display = wizardState.editingFromStep7 && !isLastStep ? 'inline-flex' : 'none';
        }

        // Submit button
        if (elements.submitBtn) {
            elements.submitBtn.style.display = isLastStep ? 'inline-flex' : 'none';
        }

        // Update submit button state on Step 7
        if (isLastStep) {
            updateSubmitButtonState();
        }
    }

    function goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > WIZARD_CONFIG.totalSteps) return;
        if (stepNumber > wizardState.currentStep && !wizardState.completedSteps.includes(wizardState.currentStep)) {
            // Can't skip ahead without completing current step
            return;
        }

        wizardState.currentStep = stepNumber;
        updateStepDisplay();
        saveToLocalStorage();

        // If going to Step 7, generate review
        if (stepNumber === WIZARD_CONFIG.totalSteps) {
            generateReviewContent();
        }
    }

    function nextStep() {
        // Validate current step
        if (!validateStep(wizardState.currentStep)) {
            // Alert handled in validateStep?
            // Force alert just in case
            // alert('Mohon lengkapi data yang wajib.');
            return;
        }

        // Mark current step as completed
        if (!wizardState.completedSteps.includes(wizardState.currentStep)) {
            wizardState.completedSteps.push(wizardState.currentStep);
        }

        // Go to next step
        if (wizardState.currentStep < WIZARD_CONFIG.totalSteps) {
            goToStep(wizardState.currentStep + 1);
        }
    }

    function previousStep() {
        if (wizardState.currentStep > 1) {
            goToStep(wizardState.currentStep - 1);
        }
    }

    function backToReview() {
        wizardState.editingFromStep7 = false;
        goToStep(WIZARD_CONFIG.totalSteps);
    }

    // ==================== Step 7 Review Generation ====================
    function generateReviewContent() {
        if (!elements.reviewContent) return;

        const formData = getAllFormData();
        const sections = [
            {
                step: 1,
                title: 'Informasi Pendaftaran',
                icon: 'bi-info-circle',
                fields: [
                    { label: 'Gelombang', name: 'gelombang' },
                    { label: 'Jenjang Tujuan', name: 'rencanaTingkat' },
                    { label: 'Asrama', name: 'rencanaProgram' },
                ],
            },
            {
                step: 2,
                title: 'Data Pribadi',
                icon: 'bi-person',
                fields: [
                    { label: 'NIK', name: 'nikCalon' },
                    { label: 'NISN', name: 'nisn' },
                    { label: 'Nama Lengkap', name: 'namaLengkap' },
                    { label: 'Tempat Lahir', name: 'tempatLahir' },
                    { label: 'Tanggal Lahir', name: 'tanggalLahir' },
                    { label: 'Jenis Kelamin', name: 'jenisKelamin' },
                ],
            },
            {
                step: 3,
                title: 'Alamat',
                icon: 'bi-geo-alt',
                fields: [
                    { label: 'Alamat Jalan', name: 'alamatJalan' },
                    { label: 'Provinsi', name: 'provinsi' },
                    { label: 'Kota/Kabupaten', name: 'kota' },
                    { label: 'Kecamatan', name: 'kecamatan' },
                    { label: 'Desa/Kelurahan', name: 'desa' },
                ],
            },
            {
                step: 4,
                title: 'Pendidikan',
                icon: 'bi-book',
                fields: [
                    { label: 'Pendidikan Terakhir', name: 'ijazahFormalTerakhir' },
                    { label: 'Nama Sekolah Asal', name: 'namaSekolahAsal' },
                    { label: 'Nomor KIP', name: 'nomorKIP', optional: true },
                ],
            },
            {
                step: 5,
                title: 'Data Orang Tua',
                icon: 'bi-people',
                fields: [
                    { label: 'Nama Ayah', name: 'namaAyah' },
                    { label: 'NIK Ayah', name: 'nikAyah' },
                    { label: 'Status Ayah', name: 'statusAyah' },
                    { label: 'Pekerjaan Ayah', name: 'pekerjaanAyah' },
                    { label: 'Nama Ibu', name: 'namaIbu' },
                    { label: 'NIK Ibu', name: 'nikIbu' },
                    { label: 'Status Ibu', name: 'statusIbu' },
                    { label: 'Pekerjaan Ibu', name: 'pekerjaanIbu' },
                    { label: 'No. Telepon Orang Tua', name: 'teleponOrtu' },
                ],
            },
            {
                step: 6,
                title: 'Upload Berkas',
                icon: 'bi-file-earmark-arrow-up',
                fields: [
                    { label: 'Ijazah', name: 'fileIjazah', type: 'file' },
                    { label: 'Akta Kelahiran', name: 'fileAkta', type: 'file' },
                    { label: 'Pas Foto 3x4', name: 'fileFoto', type: 'file' },
                    { label: 'Kartu Keluarga', name: 'fileKK', type: 'file' },
                    { label: 'Kartu BPJS', name: 'fileBPJS', type: 'file', optional: true },
                ],
            },
        ];

        let html = '';

        sections.forEach(section => {
            html += `
        <div class="wizard-review-section">
          <div class="wizard-review-header">
            <div class="wizard-review-title">
              <i class="bi ${section.icon}"></i>
              <span>${section.step}. ${section.title}</span>
            </div>
            <button type="button" class="wizard-review-edit-btn" onclick="wizardEditSection(${section.step})">
              <i class="bi bi-pencil"></i>
              <span>Ubah</span>
            </button>
          </div>
          <div class="wizard-review-content">
      `;

            section.fields.forEach(field => {
                let value = formData[field.name];

                if (field.type === 'file' && value) {
                    value = `<i class="bi bi-check-circle-fill text-green-600"></i> ${value.name}`;
                } else if (!value || value === '') {
                    value = field.optional ? '<em class="text-gray-400">Tidak diisi</em>' : '<em class="text-red-500">Belum diisi</em>';
                }

                html += `
          <div class="wizard-review-item">
            <div class="wizard-review-label">${field.label}</div>
            <div class="wizard-review-value">${value}</div>
          </div>
        `;
            });

            html += `
          </div>
        </div>
      `;
        });

        elements.reviewContent.innerHTML = html;
    }

    // Make editSection function global
    window.wizardEditSection = function (stepNumber) {
        wizardState.editingFromStep7 = true;
        goToStep(stepNumber);
    };

    // ==================== Submit Button State ====================
    function updateSubmitButtonState() {
        if (!elements.submitBtn || !elements.confirmationCheckbox) return;

        const isCheckboxChecked = elements.confirmationCheckbox.checked;
        const isTurnstileValid = getTurnstileToken() !== '';

        elements.submitBtn.disabled = !isCheckboxChecked || !isTurnstileValid;
    }

    // ==================== Event Listeners ====================
    function attachEventListeners() {
        // Previous button
        if (elements.prevBtn) {
            elements.prevBtn.addEventListener('click', previousStep);
        }

        // Next button
        if (elements.nextBtn) {
            console.log('[Wizard] Next button found, attaching listener');
            elements.nextBtn.addEventListener('click', (e) => {
                console.log('[Wizard] Next button clicked');
                nextStep();
            });
        } else {
            console.error('[Wizard] FATAL: Next button element not found found during init');
            alert('Sistem Error: Tombol Next tidak terdeteksi script. Mohon refresh halaman.');
        }

        // Back to Review button
        if (elements.backToReviewBtn) {
            elements.backToReviewBtn.addEventListener('click', backToReview);
        }

        // Sidebar step items
        elements.sidebarItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                const stepNum = index + 1;
                // Only allow clicking on completed steps or current step
                if (wizardState.completedSteps.includes(stepNum) || stepNum === wizardState.currentStep) {
                    goToStep(stepNum);
                }
            });
        });

        // Form input auto-save
        if (elements.form) {
            elements.form.addEventListener('input', debouncedSave);
            elements.form.addEventListener('change', debouncedSave);
        }

        // Confirmation checkbox
        if (elements.confirmationCheckbox) {
            elements.confirmationCheckbox.addEventListener('change', updateSubmitButtonState);
        }

        // Turnstile callbacks (update submit button when turnstile succeeds)
        window.onTurnstileSuccess = function (token) {
            latestTurnstileToken = token;
            updateSubmitButtonState();
        };

        window.onTurnstileExpired = function () {
            latestTurnstileToken = '';
            updateSubmitButtonState();
        };

        window.onTurnstileError = function () {
            latestTurnstileToken = '';
            updateSubmitButtonState();
        };
    }

    // ==================== Initialization ====================
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        initializeElements();

        // Load saved data
        const hasRestoredData = loadFromLocalStorage();

        if (hasRestoredData) {
            console.log('[Wizard] Restored previous session');
            // Ask user if they want to continue
            const continueSession = confirm('Anda memiliki data pendaftaran yang belum selesai. Lanjutkan mengisi form?');
            if (!continueSession) {
                clearLocalStorage();
                wizardState.currentStep = 1;
                wizardState.completedSteps = [];
            }
        }

        // Attach event listeners
        attachEventListeners();

        // Initial display update
        updateStepDisplay();

        console.log('[Wizard] Initialized successfully');
    }

    // Start initialization
    init();

    // Expose functions globally for form submission
    window.wizardGetAllFormData = getAllFormData;
    window.wizardClearLocalStorage = clearLocalStorage;
})();
