/**
 * Removes the ids Astro adds to Markdown headings.
 * Several project cards show the same headings (Problem, Idee, ...) on one page,
 * so the ids would repeat, which is invalid HTML. Nothing links to these headings.
 * @param {string} html - rendered Markdown
 * @returns {string}
 */
export function stripHeadingIds(html) {
  return html.replace(/(<h[1-6])\s+id="[^"]*"/g, '$1');
}
