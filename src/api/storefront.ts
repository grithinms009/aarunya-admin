/* Home page content — GET/PUT /api/admin/storefront-content, which the store reads
   through GET /api/storefront so admin edits show up there. */
import { req } from './client';
import type { Banners, Offer } from '@/data/types';

export interface StorefrontContent {
  banners: Banners;
  offers: Offer[];
  announcements: string[];
}

export const storefront = {
  content: () => req<StorefrontContent>('/admin/storefront-content'),

  save: async (content: StorefrontContent): Promise<void> => {
    await req('/admin/storefront-content', { method: 'PUT', body: content });
  },
};
