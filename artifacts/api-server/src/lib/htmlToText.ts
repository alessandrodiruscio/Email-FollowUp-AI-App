/**
 * Extract plain text from HTML content
 * Strips all HTML tags and converts common entities
 */
export function htmlToPlainText(html: string): string {
  // Decode HTML entities
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };

  let text = html;

  // Replace common block elements with newlines
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<\/blockquote>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n");

  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode entities
  Object.entries(entities).forEach(([entity, char]) => {
    text = text.split(entity).join(char);
  });

  // Clean up multiple consecutive newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace
  text = text.trim();

  return text;
}
