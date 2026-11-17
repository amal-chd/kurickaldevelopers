import { useEffect } from 'react';

// Lightweight per-route SEO for the SPA: title, description, canonical,
// Open Graph / Twitter cards and optional JSON-LD. Restores the previous
// values on unmount so in-app pages keep the default title.
const SITE = 'Task Pilot';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}

export function useSeo(opts: { title: string; description: string; path?: string; jsonLd?: object }) {
  useEffect(() => {
    const prevTitle = document.title;
    const title = opts.title.includes(SITE) ? opts.title : `${opts.title} | ${SITE}`;
    document.title = title;
    const url = `${window.location.origin}${opts.path ?? window.location.pathname}`;
    setMeta('name', 'description', opts.description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', opts.description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', `${window.location.origin}/logo.png`);
    setMeta('property', 'og:site_name', SITE);
    setMeta('name', 'twitter:card', 'summary');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', opts.description);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = url;

    let ld: HTMLScriptElement | null = null;
    if (opts.jsonLd) {
      ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.text = JSON.stringify(opts.jsonLd);
      document.head.appendChild(ld);
    }
    return () => { document.title = prevTitle; ld?.remove(); };
  }, [opts.title, opts.description, opts.path]); // eslint-disable-line react-hooks/exhaustive-deps
}
