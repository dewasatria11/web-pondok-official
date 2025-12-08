"""
Unified Serverless Function Router
Handles all API endpoints to stay under Vercel's 12 function limit
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


class handler(BaseHTTPRequestHandler):
    def _route_request(self):
        """Route request to appropriate handler based on path or action parameter"""
        try:
            parsed = urlparse(self.path)
            path = parsed.path
            params = parse_qs(parsed.query)
            
            # Get action from query parameter or derive from path
            action = params.get('action', [''])[0]
            if not action:
                # Extract action from path: /api/index?... or /api/pendaftar_create
                if path.startswith('/api/'):
                    action = path.replace('/api/', '').split('?')[0]
                    if action == 'index' or action == '':
                        action = params.get('action', [''])[0]
            
            # Remove 'index' if present
            if action == 'index':
                action = ''
            
            print(f"Routing: {self.command} {path} -> action: {action}")
            
            # Route to appropriate handler
            if action == 'pendaftar_create':
                from lib.handlers.pendaftar_create import handler as PendaftarCreateHandler
                PendaftarCreateHandler.do_POST(self) if self.command == 'POST' else PendaftarCreateHandler.do_OPTIONS(self)
                
            elif action == 'pendaftar_list':
                from lib.handlers.pendaftar_list import handler as PendaftarListHandler
                PendaftarListHandler.do_GET(self) if self.command == 'GET' else PendaftarListHandler.do_OPTIONS(self)
                
            elif action == 'pendaftar_cek_status':
                from lib.handlers.pendaftar_cek_status import handler as CekStatusHandler
                CekStatusHandler.do_GET(self) if self.command == 'GET' else CekStatusHandler.do_OPTIONS(self)
                
            elif action == 'pendaftar_status':
                from lib.handlers.pendaftar_status import handler as StatusHandler
                # Use unbound method call pattern (consistent with other handlers)
                if self.command == 'PATCH':
                    StatusHandler.do_PATCH(self)
                else:
                    StatusHandler.do_OPTIONS(self)
                
            elif action == 'pendaftar_update_files':
                from lib.handlers.pendaftar_update_files import handler as UpdateFilesHandler
                UpdateFilesHandler.do_POST(self) if self.command == 'POST' else UpdateFilesHandler.do_OPTIONS(self)
                
            elif action == 'pendaftar_files_list':
                from lib.handlers.pendaftar_files_list import handler as FilesListHandler
                FilesListHandler.do_GET(self) if self.command == 'GET' else FilesListHandler.do_OPTIONS(self)
                
            elif action == 'pendaftar_download_zip':
                from lib.handlers.pendaftar_download_zip import handler as DownloadZipHandler
                DownloadZipHandler.do_GET(self) if self.command == 'GET' else DownloadZipHandler.do_OPTIONS(self)
                
            elif action == 'export_pendaftar_xlsx':
                from lib.handlers.export_pendaftar_xlsx import handler as ExportXLSXHandler
                ExportXLSXHandler.do_GET(self) if self.command == 'GET' else ExportXLSXHandler.do_OPTIONS(self)
                
            elif action == 'get_gelombang_list':
                from lib.handlers.gelombang_list import handler as GelombangListHandler
                GelombangListHandler.do_GET(self) if self.command == 'GET' else GelombangListHandler.do_OPTIONS(self)
                
            elif action == 'update_gelombang':
                from lib.handlers.gelombang_update import handler as GelombangUpdateHandler
                GelombangUpdateHandler.do_POST(self) if self.command == 'POST' else GelombangUpdateHandler.do_OPTIONS(self)
                
            elif action == 'set_gelombang_active':
                from lib.handlers.gelombang_set_active import handler as GelombangSetActiveHandler
                GelombangSetActiveHandler.do_POST(self) if self.command == 'POST' else GelombangSetActiveHandler.do_OPTIONS(self)
                
            elif action == 'gelombang_active':
                from lib.handlers.gelombang_active import handler as GelombangActiveHandler
                GelombangActiveHandler.do_GET(self) if self.command == 'GET' else GelombangActiveHandler.do_OPTIONS(self)
                
            elif action == 'upload_file':
                from lib.handlers.upload_file import handler as UploadHandler
                UploadHandler.do_POST(self) if self.command == 'POST' else UploadHandler.do_OPTIONS(self)
                
            elif action == 'pembayaran_list':
                from lib.handlers.pembayaran_list import handler as PembayaranListHandler
                PembayaranListHandler.do_GET(self) if self.command == 'GET' else PembayaranListHandler.do_OPTIONS(self)
                
            elif action == 'pembayaran_submit':
                from lib.handlers.pembayaran_submit import handler as PembayaranSubmitHandler
                PembayaranSubmitHandler.do_POST(self) if self.command == 'POST' else PembayaranSubmitHandler.do_OPTIONS(self)
                
            elif action == 'pembayaran_verify':
                from lib.handlers.pembayaran_verify import handler as PembayaranVerifyHandler
                PembayaranVerifyHandler.do_POST(self) if self.command == 'POST' else PembayaranVerifyHandler.do_OPTIONS(self)
                
            elif action == 'supa_proxy':
                from lib.handlers.supa_proxy import handler as SupaProxyHandler
                if self.command == 'POST':
                    SupaProxyHandler.do_POST(self)
                elif self.command == 'GET':
                    SupaProxyHandler.do_GET(self)
                else:
                    SupaProxyHandler.do_OPTIONS(self)
            
            elif action == 'hero_images_list':
                from lib.handlers.hero_images_list import handler as HeroImagesListHandler
                HeroImagesListHandler.do_GET(self) if self.command == 'GET' else HeroImagesListHandler.do_OPTIONS(self)
            
            elif action == 'hero_images_upload':
                from lib.handlers.hero_images_upload import handler as HeroImagesUploadHandler
                HeroImagesUploadHandler.do_POST(self) if self.command == 'POST' else HeroImagesUploadHandler.do_OPTIONS(self)
            
            elif action == 'hero_images_delete':
                from lib.handlers.hero_images_delete import handler as HeroImagesDeleteHandler
                HeroImagesDeleteHandler.do_DELETE(self) if self.command == 'DELETE' else HeroImagesDeleteHandler.do_OPTIONS(self)
            
            elif action == 'hero_images_update_order':
                from lib.handlers.hero_images_update_order import handler as HeroImagesUpdateOrderHandler
                HeroImagesUpdateOrderHandler.do_PUT(self) if self.command == 'PUT' else HeroImagesUpdateOrderHandler.do_OPTIONS(self)
            
            elif action == 'why_section_list':
                from lib.handlers.why_section_list import handler as WhySectionListHandler
                if self.command == 'GET':
                    WhySectionListHandler.do_GET(self)
                else:
                    WhySectionListHandler.do_OPTIONS(self)
            
            elif action == 'why_section_update':
                from lib.handlers.why_section_update import handler as WhySectionUpdateHandler
                if self.command == 'POST':
                    WhySectionUpdateHandler.do_POST(self)
                else:
                    WhySectionUpdateHandler.do_OPTIONS(self)

            elif action == 'locales':
                from lib.handlers.locales import handler as LocalesHandler
                if self.command == 'GET':
                    LocalesHandler.do_GET(self)
                else:
                    LocalesHandler.do_OPTIONS(self)

            elif action == 'sections_upsert':
                from lib.handlers.sections_upsert import handler as SectionsUpsertHandler
                if self.command == 'POST':
                    SectionsUpsertHandler.do_POST(self)
                else:
                    SectionsUpsertHandler.do_OPTIONS(self)

            elif action == 'alur_steps':
                from lib.handlers.alur_steps import handler as AlurStepsHandler
                if self.command == 'GET':
                    AlurStepsHandler.do_GET(self)
                elif self.command == 'POST':
                    AlurStepsHandler.do_POST(self)
                elif self.command == 'PUT':
                    AlurStepsHandler.do_PUT(self)
                elif self.command == 'DELETE':
                    AlurStepsHandler.do_DELETE(self)
                else:
                    AlurStepsHandler.do_OPTIONS(self)

            elif action == 'syarat_items':
                from lib.handlers.syarat_items import handler as SyaratItemsHandler
                if self.command == 'GET':
                    SyaratItemsHandler.do_GET(self)
                elif self.command == 'POST':
                    SyaratItemsHandler.do_POST(self)
                elif self.command == 'PUT':
                    SyaratItemsHandler.do_PUT(self)
                elif self.command == 'DELETE':
                    SyaratItemsHandler.do_DELETE(self)
                else:
                    SyaratItemsHandler.do_OPTIONS(self)

            elif action == 'biaya_items':
                from lib.handlers.biaya_items import handler as BiayaItemsHandler
                if self.command == 'GET':
                    BiayaItemsHandler.do_GET(self)
                elif self.command == 'POST':
                    BiayaItemsHandler.do_POST(self)
                elif self.command == 'PUT':
                    BiayaItemsHandler.do_PUT(self)
                elif self.command == 'DELETE':
                    BiayaItemsHandler.do_DELETE(self)
                else:
                    BiayaItemsHandler.do_OPTIONS(self)

            elif action == 'brosur_items':
                from lib.handlers.brosur_items import handler as BrosurItemsHandler
                if self.command == 'GET':
                    BrosurItemsHandler.do_GET(self)
                elif self.command == 'POST':
                    BrosurItemsHandler.do_POST(self)
                elif self.command == 'PUT':
                    BrosurItemsHandler.do_PUT(self)
                elif self.command == 'DELETE':
                    BrosurItemsHandler.do_DELETE(self)
                else:
                    BrosurItemsHandler.do_OPTIONS(self)

            elif action == 'brosur_upload':
                from lib.handlers.brosur_upload import handler as BrosurUploadHandler
                if self.command == 'POST':
                    BrosurUploadHandler.do_POST(self)
                else:
                    BrosurUploadHandler.do_OPTIONS(self)

            elif action == 'kontak_items':
                from lib.handlers.kontak_items import handler as KontakItemsHandler
                if self.command == 'GET':
                    KontakItemsHandler.do_GET(self)
                elif self.command == 'POST':
                    KontakItemsHandler.do_POST(self)
                elif self.command == 'PUT':
                    KontakItemsHandler.do_PUT(self)
                elif self.command == 'DELETE':
                    KontakItemsHandler.do_DELETE(self)
                else:
                    KontakItemsHandler.do_OPTIONS(self)

            elif action == 'kontak_settings':
                from lib.handlers.kontak_settings import handler as KontakSettingsHandler
                if self.command == 'GET':
                    KontakSettingsHandler.do_GET(self)
                elif self.command == 'POST':
                    KontakSettingsHandler.do_POST(self)
                else:
                    KontakSettingsHandler.do_OPTIONS(self)

            elif action == 'maintenance_status':
                from lib.handlers.maintenance_status import handler as MaintenanceStatusHandler
                if self.command == 'GET':
                    MaintenanceStatusHandler.do_GET(self)
                elif self.command == 'POST':
                    MaintenanceStatusHandler.do_POST(self)
                else:
                    MaintenanceStatusHandler.do_OPTIONS(self)

            elif action == 'berita_items':
                from lib.handlers.berita_items import handler as BeritaItemsHandler
                if self.command == 'GET':
                    BeritaItemsHandler.do_GET(self)
                elif self.command == 'POST':
                    BeritaItemsHandler.do_POST(self)
                elif self.command == 'PUT':
                    BeritaItemsHandler.do_PUT(self)
                elif self.command == 'DELETE':
                    BeritaItemsHandler.do_DELETE(self)
                else:
                    BeritaItemsHandler.do_OPTIONS(self)

            elif action == 'admin_faq_upload':
                from lib.handlers.admin_faq import handler as AdminFaqHandler
                if self.command == 'POST':
                    AdminFaqHandler.do_POST(self)
                else:
                    AdminFaqHandler.do_OPTIONS(self)

            elif action == 'chat_search':
                from lib.handlers.public_chat import handler as PublicChatHandler
                if self.command == 'POST':
                    PublicChatHandler.do_POST(self)
                else:
                    PublicChatHandler.do_OPTIONS(self)

            elif action == 'payment_settings':
                from lib.handlers.payment_settings import handler as PaymentSettingsHandler
                if self.command == 'GET':
                    PaymentSettingsHandler.do_GET(self)
                elif self.command == 'POST':
                    PaymentSettingsHandler.do_POST(self)
                else:
                    PaymentSettingsHandler.do_OPTIONS(self)

            elif action == 'admin_users':
                from lib.handlers.admin_users import handler as AdminUsersHandler
                if self.command == 'GET':
                    AdminUsersHandler.do_GET(self)
                elif self.command == 'POST':
                    AdminUsersHandler.do_POST(self)
                elif self.command == 'DELETE':
                    AdminUsersHandler.do_DELETE(self)
                else:
                    AdminUsersHandler.do_OPTIONS(self)



                    
            else:
                # Default response for unknown actions
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(
                    f'{{"ok": false, "error": "Unknown action: {action}"}}'.encode()
                )
                
        except Exception as e:
            print(f"Router error: {e}")
            import traceback
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(
                f'{{"ok": false, "error": "Router error: {str(e)}"}}'.encode()
            )
    
    def do_GET(self):
        self._route_request()
    
    def do_POST(self):
        self._route_request()
    
    def do_PATCH(self):
        self._route_request()
    
    def do_DELETE(self):
        self._route_request()
    
    def do_PUT(self):
        self._route_request()
    
    def do_OPTIONS(self):
        self._route_request()
