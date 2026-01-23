-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.alur_pendaftaran_steps (
  id integer NOT NULL DEFAULT nextval('alur_pendaftaran_steps_id_seq'::regclass),
  title text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title_en text NOT NULL DEFAULT ''::text,
  description_en text NOT NULL DEFAULT ''::text,
  CONSTRAINT alur_pendaftaran_steps_pkey PRIMARY KEY (id)
);
CREATE TABLE public.berita (
  id bigint NOT NULL DEFAULT nextval('berita_id_seq'::regclass),
  title_id text NOT NULL,
  title_en text NOT NULL,
  content_id text NOT NULL,
  content_en text NOT NULL,
  image_url text,
  is_published boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  published_date date,
  CONSTRAINT berita_pkey PRIMARY KEY (id)
);
CREATE TABLE public.biaya_items (
  id integer NOT NULL DEFAULT nextval('biaya_items_id_seq'::regclass),
  label text NOT NULL,
  amount text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  label_en text NOT NULL DEFAULT ''::text,
  amount_en text NOT NULL DEFAULT ''::text,
  CONSTRAINT biaya_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.brosur_items (
  id integer NOT NULL DEFAULT nextval('brosur_items_id_seq'::regclass),
  title text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  button_label text NOT NULL DEFAULT 'Unduh PDF'::text,
  button_url text NOT NULL,
  icon_class text NOT NULL DEFAULT 'bi bi-file-earmark-arrow-down'::text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title_en text NOT NULL DEFAULT ''::text,
  description_en text NOT NULL DEFAULT ''::text,
  button_label_en text NOT NULL DEFAULT 'Download PDF'::text,
  file_path text,
  file_mime text,
  file_size bigint,
  CONSTRAINT brosur_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.gelombang (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nama text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  tahun_ajaran text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  urutan smallint NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ditutup'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  nama_en text,
  CONSTRAINT gelombang_pkey PRIMARY KEY (id)
);
CREATE TABLE public.hero_carousel_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slide_order integer NOT NULL DEFAULT 1 CHECK (slide_order >= 1 AND slide_order <= 3),
  image_url text NOT NULL,
  alt_text character varying DEFAULT 'Santri Al Ikhsan Beji'::character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hero_carousel_images_pkey PRIMARY KEY (id)
);
CREATE TABLE public.hero_images (
  id bigint NOT NULL DEFAULT nextval('hero_images_id_seq'::regclass),
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slide_order integer NOT NULL DEFAULT 1,
  alt_text character varying DEFAULT 'Santri Al Ikhsan Beji'::character varying,
  CONSTRAINT hero_images_pkey PRIMARY KEY (id)
);
CREATE TABLE public.kontak_items (
  id integer NOT NULL DEFAULT nextval('kontak_items_id_seq'::regclass),
  title text NOT NULL,
  value text NOT NULL,
  item_type text NOT NULL DEFAULT 'info'::text,
  link_url text,
  icon_class text NOT NULL DEFAULT 'bi bi-info-circle'::text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title_en text NOT NULL DEFAULT ''::text,
  value_en text NOT NULL DEFAULT ''::text,
  CONSTRAINT kontak_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.kontak_settings (
  id integer NOT NULL DEFAULT nextval('kontak_settings_id_seq'::regclass),
  map_embed_url text NOT NULL DEFAULT 'https://www.google.com/maps/embed?pb='::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kontak_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.maintenance_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  message text,
  updated_by text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_settings (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  bank_name text DEFAULT 'Bank BRI'::text,
  bank_account text DEFAULT '1234-5678-9012'::text,
  bank_holder text DEFAULT 'Yayasan Al Ikhsan Beji'::text,
  nominal numeric DEFAULT 250000,
  qris_image_url text,
  qris_nominal numeric DEFAULT 250000,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by text,
  qris_data text,
  CONSTRAINT payment_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pembayaran (
  id bigint NOT NULL DEFAULT nextval('pembayaran_id_seq'::regclass),
  nisn character varying NOT NULL CHECK (nisn::text ~ '^\d{10}$'::text),
  nik character varying CHECK (nik IS NULL OR nik::text ~ '^\d{16}$'::text),
  nama_lengkap character varying NOT NULL,
  jumlah numeric NOT NULL DEFAULT 500000.00 CHECK (jumlah > 0::numeric),
  metode_pembayaran character varying DEFAULT 'Transfer Bank BRI'::character varying,
  bukti_pembayaran text NOT NULL,
  status_pembayaran character varying DEFAULT 'PENDING'::character varying CHECK (status_pembayaran::text = ANY (ARRAY['PENDING'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying]::text[])),
  catatan_admin text,
  verified_by character varying,
  tanggal_verifikasi timestamp with time zone,
  tanggal_upload timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pembayaran_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pembayaran_nisn FOREIGN KEY (nisn) REFERENCES public.pendaftar(nisn)
);
CREATE TABLE public.pendaftar (
  id bigint NOT NULL DEFAULT nextval('pendaftar_id_seq'::regclass),
  nisn character varying NOT NULL UNIQUE CHECK (nisn::text ~ '^\d{10}$'::text),
  nikcalon character varying NOT NULL CHECK (nikcalon::text ~ '^\d{16}$'::text),
  namalengkap character varying NOT NULL,
  tempatlahir character varying,
  provinsitempatlahir character varying,
  tanggallahir date,
  jeniskelamin character varying CHECK (jeniskelamin::text = ANY (ARRAY['L'::character varying, 'P'::character varying]::text[])),
  emailcalon character varying,
  telepon_orang_tua character varying,
  alamatjalan text,
  desa character varying,
  kecamatan character varying,
  kotakabupaten character varying,
  kabkota character varying,
  provinsi character varying,
  ijazahformalterakhir character varying,
  sekolahdomisili character varying,
  rencanatingkat character varying,
  rencanaprogram character varying,
  rencanakelas character varying,
  namaayah character varying,
  nikayah character varying,
  statusayah character varying,
  pekerjaanayah character varying,
  namaibu character varying,
  nikibu character varying,
  statusibu character varying,
  pekerjaanibu character varying,
  file_ijazah text,
  file_kk text,
  file_akta text,
  file_foto text,
  statusberkas character varying DEFAULT 'PENDING'::character varying CHECK (statusberkas::text = ANY (ARRAY['PENDING'::character varying, 'REVISI'::character varying, 'DITERIMA'::character varying, 'DITOLAK'::character varying]::text[])),
  alasan text,
  deskripsistatus text,
  verifiedby character varying,
  verifiedat timestamp with time zone,
  createdat timestamp with time zone DEFAULT now(),
  updatedat timestamp with time zone DEFAULT now(),
  file_bpjs text,
  gelombang text,
  CONSTRAINT pendaftar_pkey PRIMARY KEY (id)
);
CREATE TABLE public.section_translations (
  section_id uuid NOT NULL,
  locale text NOT NULL CHECK (locale = ANY (ARRAY['id'::text, 'en'::text])),
  title text,
  body text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT section_translations_pkey PRIMARY KEY (section_id, locale),
  CONSTRAINT section_translations_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id)
);
CREATE TABLE public.sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (length(slug) > 0),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.syarat_pendaftaran_items (
  id integer NOT NULL DEFAULT nextval('syarat_pendaftaran_items_id_seq'::regclass),
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  name_en text NOT NULL DEFAULT ''::text,
  CONSTRAINT syarat_pendaftaran_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.system_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL,
  latency_ms integer NOT NULL,
  modules jsonb NOT NULL,
  CONSTRAINT system_metrics_pkey PRIMARY KEY (id)
);
CREATE TABLE public.why_section (
  id integer NOT NULL DEFAULT nextval('why_section_id_seq'::regclass),
  title text NOT NULL DEFAULT 'Mengapa Memilih Pondok Pesantren Al Ikhsan Beji?'::text,
  subtitle text,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  title_en text NOT NULL DEFAULT 'Why Choose Al Ikhsan Islamic Boarding School?'::text,
  subtitle_en text,
  content_en text NOT NULL DEFAULT 'Join Al Ikhsan Islamic Boarding School to experience an integrated Islamic education that shapes students with noble character. Our proven tahfidz programme guides santri to memorise the Qur''an with tartil while understanding its meaning. With round-the-clock mentoring we nurture disciplined, devout, and courteous students. Comfortable dormitories complete with a mosque, classrooms, library, and sports facilities support an optimal learning environment.'::text,
  CONSTRAINT why_section_pkey PRIMARY KEY (id)
);