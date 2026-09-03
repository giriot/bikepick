/**
 * AdSense configuration. The client ID is public (it ships in the page
 * source) — never a secret. Override via NEXT_PUBLIC_ADSENSE_CLIENT if the
 * account changes.
 */
export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-3546214661235122';

export const ADSENSE_JS_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
