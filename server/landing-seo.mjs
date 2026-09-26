// The deployment origin is explicit so local builds never advertise a guessed domain.
export function landingSeo(siteUrl) {
 let origin;
 if (siteUrl) {
  const url = new URL(siteUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('PUBLIC_SITE_URL must be an HTTP(S) site URL without credentials');
  origin = url.origin + '/';
 }
 return {
  name: 'labrica-landing-seo',
  transformIndexHtml(_html, context) {
   if (!origin || !['/', '/index.html'].includes(context.path)) return;
   return [
    {tag:'link',attrs:{rel:'canonical',href:origin},injectTo:'head'},
    {tag:'meta',attrs:{property:'og:url',content:origin},injectTo:'head'},
   ];
  },
  generateBundle() {
   this.emitFile({type:'asset',fileName:'robots.txt',source:`User-agent: *\nAllow: /\nDisallow: /api/\n${origin?`Sitemap: ${origin}sitemap.xml\n`:''}`});
   if (origin) this.emitFile({type:'asset',fileName:'sitemap.xml',source:`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}</loc></url></urlset>\n`});
  },
 };
}
