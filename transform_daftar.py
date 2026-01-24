import re
import os

# Paths
INPUT_FILE = '/Users/dewasatriaaa/Downloads/KULIAH/PROJECT CODE/pendaftaran-web/public/daftar.html.backup'
OUTPUT_FILE = '/Users/dewasatriaaa/Downloads/KULIAH/PROJECT CODE/pendaftaran-web/public/daftar_wizard.html'

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def transform_html(content):
    # 1. Inject CSS
    css_injection = """  <link rel="stylesheet" href="/assets/css/tailwind.css?v=12" />
  <!-- Wizard Styles -->
  <link rel="stylesheet" href="/assets/css/wizard-form.css" />"""
    content = content.replace('<link rel="stylesheet" href="/assets/css/tailwind.css?v=12" />', css_injection)

    # 2. Inject JS (before body end)
    js_injection = """  <!-- Wizard Script -->
  <script src="/assets/js/wizard-form.js"></script>
</body>"""
    content = content.replace('</body>', js_injection)

    # 3. Extract Form Content
    form_pattern = re.compile(r'(<form id="formPendaftar"[^>]*>)(.*?)(</form>)', re.DOTALL)
    match = form_pattern.search(content)
    
    if not match:
        print("Error: Could not find formPendaftar")
        return content

    form_start_tag = match.group(1)
    form_inner_html = match.group(2)
    form_end_tag = match.group(3)

    # 4. Split Form Sections using data-i18n markers
    # We find the marker, then back up to the nearest <div class="col-span-full mt-4">
    
    # helper: find index of start of the wrapper div for a given marker
    def find_section_start(html, marker):
        marker_idx = html.find(marker)
        if marker_idx == -1: return -1
        # Find the div before this marker. 
        # The structure is consistently: <div class="col-span-full mt-4">\n<h5...marker...
        wrapper_start = html.rfind('<div class="col-span-full mt-4">', 0, marker_idx)
        return wrapper_start

    # Markers
    m_personal = 'data-i18n="form.sections.personal"'
    m_address = 'data-i18n="form.sections.address"'
    m_education = 'data-i18n="form.sections.education"'
    m_parents = 'data-i18n="form.sections.parents"'
    m_upload = 'data-i18n="form.documents.title"' # text span
    
    # Split points
    idx_s2 = find_section_start(form_inner_html, m_personal)
    idx_s3 = find_section_start(form_inner_html, m_address)
    idx_s4 = find_section_start(form_inner_html, m_education)
    idx_s5 = find_section_start(form_inner_html, m_parents)
    
    # For upload, the marker is inside an <i> tag sometimes or text
    idx_s6 = find_section_start(form_inner_html, m_upload)
    if idx_s6 == -1:
        # fallback try finding the i tag
        idx_s6 = find_section_start(form_inner_html, 'bi-file-earmark-arrow-up')

    # Validate indices
    print(f"Split indices: S2={idx_s2}, S3={idx_s3}, S4={idx_s4}, S5={idx_s5}, S6={idx_s6}")
    
    if any(i == -1 for i in [idx_s2, idx_s3, idx_s4, idx_s5, idx_s6]):
         print("Error: Could not find one or more section markers")
         return content

    # Extract Content
    step1_content = form_inner_html[:idx_s2]
    step2_content_full = form_inner_html[idx_s2:idx_s3]
    step3_content_full = form_inner_html[idx_s3:idx_s4]
    step4_content_full = form_inner_html[idx_s4:idx_s5]
    step5_content_full = form_inner_html[idx_s5:idx_s6]
    
    # Step 6 goes until Turnstile. 
    # Find turnstile wrapper.
    turnstile_marker = '<div id="turnstileWidget"'
    # Wrapper is usually <div class="mt-4"> or similar. Let's look for known turnstile structure.
    # Or simpler: cut at the first <div class="mt-4"> after the last file input
    # Let's find turnstile index
    idx_turnstile = form_inner_html.find(turnstile_marker)
    # Back up to wrapper
    idx_turnstile_wrapper = form_inner_html.rfind('<div class="mt-4">', idx_s6, idx_turnstile)
    if idx_turnstile_wrapper == -1: idx_turnstile_wrapper = idx_turnstile
    
    step6_content_full = form_inner_html[idx_s6:idx_turnstile_wrapper]

    # Helper to remove the header div from content
    def remove_header(html):
        # The header is the first thing in the content: <div class="col-span-full mt-4">...</div>
        # Find the first closing div
        end_div = html.find('</div>')
        # We need to find the matching closing div for the opening wrapper.
        # Since it's <div...><h5...>...</h5></div>
        # Let's use regex to match the first div block
        pattern = re.compile(r'^\s*<div class="col-span-full mt-4">.*?</div>', re.DOTALL)
        return pattern.sub('', html, count=1)

    step2_content = remove_header(step2_content_full)
    step3_content = remove_header(step3_content_full)
    step4_content = remove_header(step4_content_full)
    step5_content = remove_header(step5_content_full)
    step6_content = remove_header(step6_content_full)

    # 5. Construct New Form Structure
    
    sidebar_html = """
      <!-- WIZARD SIDEBAR NAVIGATION -->
      <aside class="wizard-sidebar">
        <h3 class="wizard-sidebar-title">Langkah Pendaftaran</h3>
        <ul class="wizard-steps">
          <li class="wizard-step-item active" data-step="1">
            <div class="wizard-step-number">1</div>
            <div class="wizard-step-content">
              <div class="wizard-step-title">Informasi Pendaftaran</div>
              <div class="wizard-step-subtitle">Gelombang & Program</div>
            </div>
          </li>
          <li class="wizard-step-item" data-step="2">
            <div class="wizard-step-number">2</div>
            <div class="wizard-step-content">
              <div class="wizard-step-title">Data Pribadi</div>
              <div class="wizard-step-subtitle">Identitas Calon Siswa</div>
            </div>
          </li>
          <li class="wizard-step-item" data-step="3">
            <div class="wizard-step-number">3</div>
            <div class="wizard-step-content">
              <div class="wizard-step-title">Alamat</div>
              <div class="wizard-step-subtitle">Tempat Tinggal</div>
            </div>
          </li>
          <li class="wizard-step-item" data-step="4">
            <div class="wizard-step-number">4</div>
            <div class="wizard-step-content">
              <div class="wizard-step-title">Pendidikan</div>
              <div class="wizard-step-subtitle">Riwayat Pendidikan</div>
            </div>
          </li>
          <li class="wizard-step-item" data-step="5">
            <div class="wizard-step-number">5</div>
            <div class="wizard-step-content">
              <div class="wizard-step-title">Data Orang Tua</div>
              <div class="wizard-step-subtitle">Informasi Orang Tua/Wali</div>
            </div>
          </li>
          <li class="wizard-step-item" data-step="6">
            <div class="wizard-step-number">6</div>
            <div class="wizard-step-content">
              <div class="wizard-step-title">Upload Berkas</div>
              <div class="wizard-step-subtitle">Dokumen Pendaftaran</div>
            </div>
          </li>
          <li class="wizard-step-item" data-step="7">
            <div class="wizard-step-number">7</div>
            <div class="wizard-step-content">
              <div class="wizard-step-title">Finalisasi</div>
              <div class="wizard-step-subtitle">Review & Submit</div>
            </div>
          </li>
        </ul>
      </aside>
    """

    # New Fields for Step 4
    new_education_fields = """
            <div class="col-md-6">
              <label class="form-label">
                <span>Nama Sekolah Asal</span>
                <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" name="namaSekolahAsal" required />
            </div>

            <div class="col-md-6">
              <label class="form-label">
                <span>Nomor KIP</span>
                <span class="text-muted">(Opsional)</span>
              </label>
              <input type="text" class="form-control" name="nomorKIP" />
              <small class="text-muted">Kosongkan jika tidak memiliki</small>
            </div>
    """
    
    # Append new fields to Step 4 content 
    # Find the last div close
    step4_content_modified = step4_content + new_education_fields

    step7_html = """
            <!-- STEP 7: Finalisasi -->
            <div class="wizard-form-step" data-wizard-step="7">
                <div class="wizard-step-header">
                  <h2>Step 7: Finalisasi & Review</h2>
                  <p>Periksa kembali semua data sebelum mengirim pendaftaran</p>
                </div>

                <!-- Review Content -->
                <div id="wizard-review-content"></div>

                <!-- Turnstile Verification -->
                <div class="wizard-turnstile-container">
                  <div class="wizard-turnstile-title">
                    <i class="bi bi-shield-check"></i>
                    <span>Verifikasi Keamanan</span>
                  </div>
                  <p class="text-sm text-gray-600 mb-2">
                    Verifikasi ini melindungi formulir dari bot.
                  </p>
                  <div id="turnstileWidget" class="cf-turnstile" 
                    data-sitekey="0x4AAAAAACDDkC6MDnS8Ozbo" 
                    data-theme="light"
                    data-callback="onTurnstileSuccess" 
                    data-expired-callback="onTurnstileExpired"
                    data-timeout-callback="onTurnstileExpired" 
                    data-error-callback="onTurnstileError"
                    data-refresh-expired="auto" 
                    data-refresh-timeout="auto">
                  </div>
                </div>

                <!-- Confirmation Checkbox -->
                <div class="wizard-confirmation">
                  <div class="wizard-confirmation-title">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    <span>Konfirmasi Akhir</span>
                  </div>
                  <div class="wizard-confirmation-text">
                    <p><strong>Seluruh data yang saya isikan adalah BENAR.</strong></p>
                    <p>Bersedia menerima konsekuensi jika ditemukan ketidaksesuaian.</p>
                  </div>
                  <div class="wizard-confirmation-checkbox">
                    <input type="checkbox" id="confirmation-checkbox" required />
                    <label for="confirmation-checkbox">
                      Saya telah membaca, memahami, dan menyetujui pernyataan di atas.
                    </label>
                  </div>
                </div>
            </div>
    """

    nav_buttons = """
            <!-- Navigation Buttons -->
            <div class="wizard-navigation">
              <div class="wizard-nav-group">
                <button type="button" id="wizard-prev-btn" class="wizard-btn wizard-btn-secondary">
                  <i class="bi bi-arrow-left"></i>
                  <span>Sebelumnya</span>
                </button>
              </div>
              <div class="wizard-nav-group">
                <button type="button" id="wizard-back-to-review-btn" class="wizard-btn wizard-btn-link" style="display:none;">
                  <i class="bi bi-arrow-return-left"></i>
                  <span>Kembali ke Review</span>
                </button>
                <button type="button" id="wizard-next-btn" class="wizard-btn wizard-btn-primary">
                  <span>Selanjutnya</span>
                  <i class="bi bi-arrow-right"></i>
                </button>
                <button type="button" id="wizard-submit-btn" class="wizard-btn wizard-btn-primary" style="display:none;" onclick="submitFinal()">
                  <i class="bi bi-send"></i>
                  <span>Kirim Pendaftaran</span>
                </button>
              </div>
            </div>
    """

    # Assemble Wizard Content
    wizard_content = f"""
    <div class="wizard-container">
      {sidebar_html}
      <div class="wizard-content">
        <div class="wizard-content-inner">
          {form_start_tag}
            <!-- STEP 1 -->
            <div class="wizard-form-step active" data-wizard-step="1">
              <div class="wizard-step-header">
                <h2>Step 1: Informasi Pendaftaran</h2>
                <p>Pilih gelombang pendaftaran, jenjang, dan program asrama</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {step1_content}
              </div>
            </div>

            <!-- STEP 2 -->
            <div class="wizard-form-step" data-wizard-step="2">
              <div class="wizard-step-header">
                <h2>Step 2: Data Pribadi</h2>
                <p>Isi data identitas calon siswa</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {step2_content}
              </div>
            </div>
            
            <!-- STEP 3 -->
            <div class="wizard-form-step" data-wizard-step="3">
              <div class="wizard-step-header">
                <h2>Step 3: Alamat</h2>
                <p>Isi alamat lengkap tempat tinggal</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {step3_content}
              </div>
            </div>

            <!-- STEP 4 -->
            <div class="wizard-form-step" data-wizard-step="4">
              <div class="wizard-step-header">
                <h2>Step 4: Pendidikan</h2>
                <p>Riwayat pendidikan terakhir</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {step4_content_modified}
              </div>
            </div>

            <!-- STEP 5 -->
            <div class="wizard-form-step" data-wizard-step="5">
              <div class="wizard-step-header">
                <h2>Step 5: Data Orang Tua</h2>
                <p>Informasi Ayah dan Ibu</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {step5_content}
              </div>
            </div>

            <!-- STEP 6 -->
            <div class="wizard-form-step" data-wizard-step="6">
              <div class="wizard-step-header">
                <h2>Step 6: Upload Berkas</h2>
                <p>Upload dokumen pendaftaran</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {step6_content}
              </div>
            </div>

            {step7_html}
            {nav_buttons}
          {form_end_tag}
        </div>
      </div>
    </div>
    """

    # Replace old main container with new wizard content
    # Look for <main ... > ... </main>
    main_pattern = re.compile(r'<main[^>]*>.*?</main>', re.DOTALL)
    new_main = f"""<main class="flex-1 container mx-auto px-4 py-8">
    {wizard_content}
    </main>"""
    
    final_content = main_pattern.sub(new_main, content)
    
    return final_content

def main():
    print(f"Reading from {INPUT_FILE}...")
    try:
        content = read_file(INPUT_FILE)
    except FileNotFoundError:
        print(f"Error: File not found: {INPUT_FILE}")
        return

    print("Transforming content...")
    new_content = transform_html(content)
    
    print(f"Writing to {OUTPUT_FILE}...")
    write_file(OUTPUT_FILE, new_content)
    print("Done! Transformation complete.")

if __name__ == "__main__":
    main()
