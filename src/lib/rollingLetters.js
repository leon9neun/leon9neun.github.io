const START_OFFSET_PERCENT = Object.freeze({ top: -500, bottom: 500 });
const DURATION_MS = 600;
const STAGGER_EACH_S = 0.08;
const MAX_STAGGER_TOTAL_S = 1.2;
// close to GSAP "power4.out"
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Delay of every letter in ms, depending on where the wave starts.
 * The gap between two letters is 0.08s, but the whole wave never takes longer than 1.2s.
 * @param {number} count - number of letters
 * @param {'start' | 'center' | 'end' | 'random'} from
 * @returns {number[]}
 */
export function getStaggerDelays(count, from) {
  if (count < 2) return Array.from({ length: count }, () => 0);

  const eachMs = Math.min(STAGGER_EACH_S, MAX_STAGGER_TOTAL_S / (count - 1)) * 1000;
  const indexes = Array.from({ length: count }, (_, index) => index);
  const center = (count - 1) / 2;

  let ranks;
  if (from === 'end') {
    ranks = indexes.map((index) => count - 1 - index);
  } else if (from === 'center') {
    ranks = indexes.map((index) => Math.abs(index - center));
  } else if (from === 'random') {
    ranks = [...indexes].sort(() => Math.random() - 0.5);
  } else {
    ranks = indexes;
  }

  return ranks.map((rank) => rank * eachMs);
}

/**
 * Replaces the text of the element by one span per letter. Words stay together, so the
 * text still wraps between words. Screen readers get the plain text, the letters are hidden.
 * @param {HTMLElement} element
 * @returns {HTMLElement[]} the letter elements
 */
function splitLetters(element) {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const letters = [];

  const plainText = document.createElement('span');
  plainText.className = 'visually-hidden';
  plainText.textContent = text;

  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');

  text.split(' ').forEach((word, wordIndex, words) => {
    const wordElement = document.createElement('span');
    wordElement.dataset.rollWord = '';
    [...word].forEach((character) => {
      const letter = document.createElement('span');
      letter.dataset.rollChar = '';
      letter.textContent = character;
      wordElement.append(letter);
      letters.push(letter);
    });
    visual.append(wordElement);
    if (wordIndex < words.length - 1) visual.append(' ');
  });

  element.replaceChildren(plainText, visual);
  return letters;
}

/**
 * Rolling Letters: every letter slides in from above (or below), one after the other.
 * Splits the text and starts the animation right away.
 * @param {HTMLElement} element - the heading
 * @param {{ startFrom?: 'top' | 'bottom', staggerFrom?: 'start' | 'center' | 'end' | 'random' }} [options]
 * @returns {Promise<void>} resolves when the last letter has arrived
 */
export async function rollLetters(element, { startFrom = 'top', staggerFrom = 'start' } = {}) {
  const letters = splitLetters(element);
  const delays = getStaggerDelays(letters.length, staggerFrom);
  const offset = START_OFFSET_PERCENT[startFrom] ?? START_OFFSET_PERCENT.top;

  const animations = letters.map((letter, index) =>
    letter.animate(
      [{ transform: `translateY(${offset}%)` }, { transform: 'translateY(0)' }],
      { duration: DURATION_MS, delay: delays[index], easing: EASING, fill: 'backwards' },
    ),
  );

  await Promise.all(animations.map((animation) => animation.finished));
}
