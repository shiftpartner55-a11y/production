/*
 * Shiftingpartner runtime configuration  (public_html/assets/js/config.js)
 * ---------------------------------------------------------------------------
 * Everything here is PUBLIC by design. Never put secrets (service-role keys,
 * Google credentials, Apps Script shared secret) in this file.
 *
 *  supabaseUrl      (blog only) Supabase > Project Settings > API > Project URL
 *  supabaseAnonKey  Supabase > Project Settings > API > anon / publishable key (safe: protected by RLS)
 *  appsScriptUrl    Google Apps Script web app URL (ends in /exec). If set, forms post
 *                   straight to Google Sheets (see google-apps-script/Code.gs).
 *  googleMapsApiKey Optional. Browser key restricted to your domain with "Places API" enabled.
 *                   Enables address autocomplete on the consultation form.
 */
window.SP_CONFIG = {
  supabaseUrl: 'https://mvkhjykvlopmsapxziyx.supabase.co',
  supabaseAnonKey: 'sb_publishable_t-PW84t-FZ31yDNU0zo0RA_f26dKhoX',
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxpVhSTSfzt3yX52H_qgaxYA7BuE7b5y-WyWTf72VtfRPkZsr5Gim0iiHUxjCtPiV-p/exec',   // Google Apps Script web app URL (…/exec) — simplest way to send leads to Google Sheets
  googleMapsApiKey: '',
  siteUrl: 'https://shiftingpartner.com',
  phone: '+917892115167',
  phoneDisplay: '+91 78921 15167',
  whatsapp: '917892115167',
  whatsappMessage: 'Hello Shiftingpartner, I am interested in your household relocation services. Please share more details.',
  email: 'contact@shiftingpartner.com',
  blogPageSize: 9
};
