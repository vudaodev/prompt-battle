/**
 * Turn raw agent output into safe, renderable HTML.
 * Prototype-grade enforcement of the "HTML/CSS only" rule (design doc §6).
 * In production this runs server-side; here it is best-effort client-side.
 */
export function prepareHtml(raw: string): string {
  return sanitize(extract(raw));
}

/** Strip markdown fences and grab the HTML document if one is present. */
function extract(raw: string): string {
  let s = raw.trim();

  // Remove a leading ```html / ``` fence and trailing ``` if the model added them.
  const fence = s.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();

  // If there is a full document or a body, keep from the first meaningful tag.
  const docStart = s.search(/<!doctype html|<html[\s>]/i);
  if (docStart > 0) s = s.slice(docStart);

  return s.trim();
}

/** Remove scripts, inline event handlers, and javascript: URLs. */
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}
