/**
 * Site-wide constants. Single source for name, contact data, links and navigation.
 * Values in [square brackets] are placeholders and must be replaced before publishing.
 */
export const SITE = Object.freeze({
  name: '[Vorname Nachname]',
  role: '[z. B. Softwareentwickler / Student Informatik]',
  email: '[mail@beispiel.de]',
  linkedin: '[URL]',
  github: '[URL]',
  established: 'est. 2026',
  techNote: 'Gebaut mit Astro, gehostet auf GitHub Pages.',
});

/**
 * Main navigation. `role` decides the place in the header:
 * 'home' = logo lockup on the left, 'link' = middle, 'cta' = pill button on the right.
 */
export const NAV = Object.freeze([
  { label: 'Home', href: '/', role: 'home' },
  { label: 'Experience', href: '/experience', role: 'link' },
  { label: 'Projects', href: '/projects', role: 'link' },
  { label: 'Contact', href: '/contact', role: 'cta' },
]);

export const LEGAL_NAV = Object.freeze([
  { label: 'Impressum', href: '/impressum' },
  { label: 'Datenschutz', href: '/datenschutz' },
]);
