import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bikepick.IN — Compare Smart. Buy Better.',
    short_name: 'Bikepick',
    description: 'India’s structured two-wheeler comparison and buying platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0D12',
    theme_color: '#0B0D12',
    lang: 'en-IN',
    categories: ['shopping', 'automotive'],
    icons: [
      { src: '/icon.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
      { src: '/brand/bikepick-mark.png', sizes: '256x256', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
