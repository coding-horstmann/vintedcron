/**
 * Amazon URL-Generatoren
 * Generiert Such-URLs für Amazon.de
 */

/**
 * Generiert eine URL zur Amazon-Suche in der Kategorie "Bücher"
 * Zeigt aktuelle Angebote bei Amazon.de für den gegebenen Titel
 */
export const getAmazonSearchUrl = (title: string): string => {
  // encodeURIComponent kodiert Umlaute (ä, ü, ö) und Sonderzeichen korrekt
  const encodedTitle = encodeURIComponent(title);
  // i=stripbooks = Kategorie "Bücher" bei Amazon.de
  return `https://www.amazon.de/s?k=${encodedTitle}&i=stripbooks`;
};

