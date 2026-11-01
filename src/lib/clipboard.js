/**
 * Copies text to the clipboard.
 * @param {string} text
 * @returns {Promise<boolean>} true on success
 */
export async function copyToClipboard(text) {
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
