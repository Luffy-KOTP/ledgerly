import type { MetadataRoute } from 'next'
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return ['', '/submit', '/track', '/signup', '/apply-lawyer', '/login', '/legal/terms', '/legal/privacy', '/legal/refunds', '/legal/cookies'].map((p) => ({ url: `${base}${p}` }))
}
