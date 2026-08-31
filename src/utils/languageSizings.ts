import i18n from '../i18n/i18n';
import { ms } from '../lib/scale';

/**
 * Returns the current language code.
 */
const getLang = () => i18n.language || 'en';

/**
 * Returns a language-aware scaled font size.
 * Tamil (ta) gets a more aggressive reduction (0.82) because Tamil
 * characters are significantly wider/denser than Latin or Devanagari.
 * Hindi (hi) gets a mild reduction (0.93).
 * @param size The original size (unscaled)
 * @param factor Optional moderate scaling factor for ms()
 * @returns The final scaled font size
 */
export const getLanguageScaledSize = (size: number, factor = 0.5): number => {
    const lang = getLang();
    const baseScaled = ms(size, factor);
    if (lang === 'ta') return baseScaled * 0.82;
    if (lang === 'hi') return baseScaled * 0.93;
    return baseScaled;
};

/**
 * Returns a language-aware line height factor.
 * Tamil characters often need more vertical space.
 * @param lineHeight Original line height
 * @returns Adjusted line height
 */
export const getLanguageLineHeight = (lineHeight: number): number => {
    const lang = getLang();
    if (lang === 'ta') return lineHeight * 1.15;
    if (lang === 'hi') return lineHeight * 1.05;
    return lineHeight;
};

/**
 * Returns a compacted horizontal padding value for Tamil.
 * Tamil text needs tighter containers so labels don't overflow.
 * @param padding The original padding value (already scaled)
 * @returns Adjusted padding
 */
export const getLanguageCompactPadding = (padding: number): number => {
    const lang = getLang();
    if (lang === 'ta') return padding * 0.8;
    return padding;
};

/**
 * Returns true if the current language is Tamil.
 */
export const isTamilLanguage = (): boolean => getLang() === 'ta';
