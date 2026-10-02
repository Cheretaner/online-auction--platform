import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const TELEGRAM_HTML_TAGS = [
  "a", "b", "blockquote", "br", "code", "del", "em", "i", "pre", "s", "strong", "u",
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td",
];

/** Render model-authored GFM as the safe HTML subset Telegram accepts. */
export function formatAiAnswerForTelegram(markdown: string): string {
  const rendered = marked.parse(markdown, { async: false, gfm: true, breaks: true });
  const safeHtml = sanitizeHtml(rendered, {
    allowedTags: TELEGRAM_HTML_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "tg"],
    disallowedTagsMode: "discard",
  });

  return safeHtml
    .replace(/<h[1-6]>/gi, "<b>")
    .replace(/<\/h[1-6]>/gi, "</b>\n\n")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<ul>|<ol>|<\/ul>|<\/ol>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<table>|<thead>|<tbody>|<\/table>|<\/thead>|<\/tbody>/gi, "\n")
    .replace(/<tr>/gi, "")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<th>/gi, "")
    .replace(/<\/th>/gi, " | ")
    .replace(/<td>/gi, "")
    .replace(/<\/td>/gi, " | ")
    .replace(/(?:\n[\t ]*){3,}/g, "\n\n")
    .trim();
}
