/**
 * Amazon URL-Generatoren
 * Generiert Such-URLs für Amazon.de
 */

/**
 * Generiert eine URL zur Amazon-Suche
 * Zeigt aktuelle Angebote bei Amazon.de für den gegebenen Titel
 */
export const getAmazonSearchUrl = (title: string): string => {
  // encodeURIComponent kodiert Umlaute (ä, ü, ö) und Sonderzeichen korrekt
  const encodedTitle = encodeURIComponent(title);
  return `https://www.amazon.de/s?k=${encodedTitle}`;
};

