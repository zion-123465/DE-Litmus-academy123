import { useEffect, useState } from 'react';
import { apiFetch, parseSetting } from '../lib/api';

export interface SiteImages {
  hero_bg: string;
  cbt_spotlight: string;
  library_card: string;
  about_library: string;
}

export const DEFAULT_SITE_IMAGES: SiteImages = {
  hero_bg: '/images/hero.jpg',
  cbt_spotlight: '/images/cbt.jpg',
  library_card: '/images/library.jpg',
  about_library: '/images/library.jpg',
};

export const SITE_IMAGE_SLOTS: { key: keyof SiteImages; label: string; hint: string }[] = [
  { key: 'hero_bg', label: 'Homepage hero background', hint: 'Wide banner behind the headline (landscape works best)' },
  { key: 'cbt_spotlight', label: 'Homepage CBT spotlight photo', hint: 'Student taking a quiz (portrait or landscape)' },
  { key: 'library_card', label: 'Homepage library card background', hint: 'Bookshelves / study hall backdrop' },
  { key: 'about_library', label: 'About page photo', hint: 'Academy / library photo on the About page' },
];

export function useSiteImages() {
  const [images, setImages] = useState<SiteImages>(DEFAULT_SITE_IMAGES);

  useEffect(() => {
    let alive = true;
    apiFetch<any[]>('/api/settings')
      .then((rows) => {
        if (!alive) return;
        const row = rows.find((r) => r.key === 'site_images');
        if (row) {
          const p = parseSetting(row);
          if (p && typeof p === 'object') {
            setImages({ ...DEFAULT_SITE_IMAGES, ...p });
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return images;
}
