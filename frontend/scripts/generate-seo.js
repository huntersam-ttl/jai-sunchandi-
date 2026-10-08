const fs = require("fs");
const path = require("path");

const configured = (process.env.REACT_APP_SITE_URL || "").trim().replace(/\/+$/, "");
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !configured) {
  console.error("REACT_APP_SITE_URL is required for a production build");
  process.exit(1);
}

if (!configured) {
  console.log("Skipping public SEO files: REACT_APP_SITE_URL is not configured.");
  process.exit(0);
}

const routes = ["/", "/rates", "/catalogue", "/custom-order", "/repair", "/order-status", "/about", "/contact"];
const outputDir = path.resolve(__dirname, "..", "build");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>${configured}${route}</loc></url>`).join("\n")}\n</urlset>\n`;
const robots = `User-agent: *\nDisallow: /admin\nDisallow: /api\nSitemap: ${configured}/sitemap.xml\n`;

fs.writeFileSync(path.join(outputDir, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(outputDir, "robots.txt"), robots);
console.log(`Generated sitemap.xml and robots.txt for ${configured}`);
