import { getEntry } from 'astro:content';

/**
 * Site-wide constants. Single place the pages and components read from.
 * navigation and the texts of the other pages stay here.
 * Values in [square brackets] are placeholders and must be replaced before publishing.
 * Only import this file in .astro frontmatter or server code, never in a client script.
 */
const siteEntry = await getEntry('site', 'site');
if (!siteEntry) throw new Error('src/content/site/site.md is missing');
const { home, ...general } = siteEntry.data;

/** name, role, email, linkedin, github, established, techNote */
export const SITE = Object.freeze(general);

/**
 * Photo of characters shared by the Experience and Contact cards on the homepage and
 * the header of the Contact page. Single source for all three.
 */
const CONTACT_IMAGE = Object.freeze({
  src: '/images/bonn_map.jpg',
  alt: 'Karte von Bonn',
});

/**
 * Main navigation. `role` decides the place in the header:
 * 'home' = logo lockup on the left, 'link' = middle, 'cta' = pill button on the right.
 * `card` holds label, text and background (`tone`) of the page's section on the homepage (not set for 'home'),
 * and optionally an `image` (photo of characters below the label).
 */
export const NAV = Object.freeze([
  { label: 'Home', href: '/', role: 'home' },
  {
    label: 'Erfahrung',
    href: '/experience',
    role: 'link',
    card: {
      label: 'Erfahrung',
      text: 'Erfahrhrungen vom Studium, Beruf.',
      tone: 'pure-white',
    },
  },
  {
    label: 'Projekte',
    href: '/projects',
    role: 'link',
    card: {
      label: 'Projekte',
      text: 'Auswahl an Projekten, die ich in meiner Freizeit entwickelt habe.',
      tone: 'parchment',
    },
  },
  {
    label: 'Kontakt',
    href: '/contact',
    role: 'cta',
    card: {
      label: 'Kontakt',
      text: 'Verbinde dich mit mir!',
      tone: 'pure-white',
      image: CONTACT_IMAGE,
    },
  },
]);

/**
 * Texts of the homepage (from site.md). `photo` is the portrait in public/images/ (shown as
 * ASCII Reveal in the About section), without it the page shows a placeholder.
 */
export const HOME = Object.freeze(home);

/**
 * Texts of the Experience page. `skills` are grouped, each item is shown as a tag.
 * `image` is shown next to the timeline.
 */
export const EXPERIENCE_PAGE = Object.freeze({
  metaTitle: 'Erfahrungen - Kraschewski',
  metaDescription: '[Ein Satz.]',
  label: 'Erfahrungen',
  heading: 'Meine Erfahrungen',
  text: 'Kurze Beschreibung meiner Erfahrungen',
  skills: Object.freeze([
    { group: 'Programmiersprachen', items: ['Java', 'Python', 'JavaScript', 'SQL'] },
    { group: 'Frameworks', items: ['Flask', 'Astra', 'Electron', 'tkinter'] },
    { group: 'Werkzeuge', items: ['Andriod Studio', 'VS Code', 'Claude'] },
    { group: 'Weitere', items: ['n8n', 'Power Automate', 'Unity'] },
  ]),
});

/**
 * Texts of the Projects overview and the detail pages.
 */
export const PROJECTS_PAGE = Object.freeze({
  metaTitle: 'Projekte - Kraschewski',
  metaDescription: '[Ein Satz.]',
  label: 'Projekte',
  heading: 'Meine Projekte ',
  text: 'Eigene Projekte',
  visit: 'Visit',
  live: 'Live',
  back: 'Zurück zu allen Projekten',
});

/**
 * Texts of the Contact page. The QR code encodes a mailto link to SITE.email.
 */
export const CONTACT_PAGE = Object.freeze({
  metaTitle: 'Kontakt - Kraschewski',
  metaDescription: '[Ein Satz.]',
  label: 'Kontakt',
  heading: 'Kontakt',
  text: 'Schreib mir!',
  image: CONTACT_IMAGE,
  qrCaption: 'Scannen',
  qrAlt: 'QR-Code E-Mail-Adresse',
});

export const LEGAL_NAV = Object.freeze([
  // { label: 'Impressum', href: '/impressum' },
  // { label: 'Datenschutz', href: '/datenschutz' },
]);
