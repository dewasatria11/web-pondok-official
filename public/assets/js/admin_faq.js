
// ==========================================
// FAQ Management (Separate File)
// ==========================================

async function uploadFaqCsv() {
    const fileInput = document.getElementById('faqCsvFile');
    const file = fileInput.files[0];

    if (!file) {
        if (typeof toastr !== 'undefined') toastr.warning('Silakan pilih file CSV terlebih dahulu');
        else alert('Silakan pilih file CSV terlebih dahulu');
        return;
    }

    const btn = document.getElementById('btnUploadFaq');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';

    try {
        // Convert to Base64
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = async function () {
            const base64String = reader.result; // Contains "data:text/csv;base64,..."

            try {
                // Ensure we hit the correct endpoint. 
                // Vercel rewrites /api/* to api/index.py if configured, or we might need to be explicit.
                // Based on api/index.py, it looks for ?action=admin_faq_upload or /api/admin_faq_upload
                const response = await fetch('/api/admin_faq_upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        file: base64String,
                        fileName: file.name
                    })
                });

                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    // If response is not JSON (e.g. 404 HTML page or 500 error page)
                    const text = await response.text();
                    console.error("Non-JSON response:", text);
                    throw new Error(`Server returned ${response.status} (${response.statusText}). Cek console untuk detail.`);
                }

                const result = await response.json();

                if (response.ok && result.ok) {
                    if (typeof toastr !== 'undefined') toastr.success(`Berhasil import FAQ! Deleted: ${result.deleted}, Inserted: ${result.inserted}`);
                    else alert(`Berhasil import FAQ! Deleted: ${result.deleted}, Inserted: ${result.inserted}`);

                    fileInput.value = ''; // Reset input
                } else {
                    throw new Error(result.error || 'Gagal upload');
                }
            } catch (error) {
                console.error('Upload error:', error);
                if (typeof toastr !== 'undefined') toastr.error('Gagal upload: ' + error.message);
                else alert('Gagal upload: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        };

        reader.onerror = function (error) {
            console.error('File reading error:', error);
            if (typeof toastr !== 'undefined') toastr.error('Gagal membaca file');
            else alert('Gagal membaca file');
            btn.disabled = false;
            btn.innerHTML = originalText;
        };

    } catch (error) {
        console.error('Error:', error);
        if (typeof toastr !== 'undefined') toastr.error('Terjadi kesalahan sistem');
        else alert('Terjadi kesalahan sistem');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Expose to window so onclick works
window.uploadFaqCsv = uploadFaqCsv;
