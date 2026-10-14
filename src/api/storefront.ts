/* Home page content. Becomes GET /api/admin/storefront-content plus PUT /banners,
   PUT /offers and PUT /announcements — and, on the public side, the single
   GET /api/storefront the store reads so these edits show up there. */
import { db, mutate, reply } from './mock/store';
import type { Banners, Offer } from '@/data/types';

export interface StorefrontContent {
  banners: Banners;
  offers: Offer[];
  announcements: string[];
}

/** Where an offer banner's button can point, and the matching shop URL. */
export const OFFER_LINKS: [Offer['match'], string, string][] = [
  ['sale', '/shop?sale=1', 'All sale items'],
  ['u500', '/shop?price=u500', 'Under ₹500'],
  ['500-1000', '/shop?price=500-1000', '₹500 – ₹1,000'],
  ['o1000', '/shop?price=o1000', 'Above ₹1,000'],
];

/** The artwork that ships with the store, for "Restore original". */
export const DEFAULT_IMAGES = {
  heroDesktop: '/assets/aarunya-hero-pastel.jpg',
  personalised: '/assets/personalised-banner.jpg',
  personalisedMobile: '/assets/personalised-gift-box-v2.jpg',
  offers: ['/assets/offer-festive-sale.jpg', '/assets/offer-little-gifts.jpg'],
};

export const storefront = {
  content: (): Promise<StorefrontContent> => {
    const d = db();
    return reply({ banners: d.banners, offers: d.offers, announcements: d.announcements });
  },

  save: (content: StorefrontContent): Promise<void> =>
    reply(
      mutate((dd) => {
        dd.banners = content.banners;
        dd.offers = content.offers;
        /* Blank rows are dropped rather than shown as gaps in the marquee. */
        dd.announcements = content.announcements.map((x) => x.trim()).filter(Boolean);
      }),
    ),
};
