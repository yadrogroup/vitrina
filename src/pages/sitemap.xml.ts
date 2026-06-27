import type { APIRoute } from 'astro';
import { getProducts } from '../lib/catalog';
import { absoluteUrl } from '../lib/seo';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const INFO_PAGES = [
  '/delivery/',
  '/services/',
  '/showroom/',
  '/about/',
  '/contacts/',
  '/faq/',
  '/care/',
  '/warranty/',
  '/returns/',
  '/privacy/',
  '/offer/',
];

export const GET: APIRoute = () => {
  const staticPaths = ['/', '/catalog/', '/search/', '/cart/', ...INFO_PAGES];
  const productPaths = getProducts().map((product) => `/product/${product.slug}/`);
  const urls = [...staticPaths, ...productPaths];
  const lastmod = new Date().toISOString().slice(0, 10);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (path) => `  <url>
    <loc>${xmlEscape(absoluteUrl(path))}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
