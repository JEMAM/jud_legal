/**
 * Unescapes standard and non-standard HTML entities (including those missing trailing semicolons,
 * numeric entities, double-escaped entities, and non-breaking spaces).
 */
export function unescapeHtml(html: string): string {
  if (!html) return "";
  let text = html;

  // Unescape double-escaped ampersands first (e.g. &amp;iacute; -> &iacute;)
  text = text.replace(/&amp;/gi, "&");

  // Handle numeric entities (decimal and hex)
  text = text.replace(/&#(\d+);?/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  text = text.replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // Portuguese & standard HTML named entities (with optional trailing semicolon)
  const entities: [RegExp, string][] = [
    [/&nbsp;?/gi, " "],
    [/&ordm;?/gi, "º"],
    [/&ordf;?/gi, "ª"],
    [/&deg;?/gi, "°"],

    // Acute accents
    [/&Aacute;?/g, "Á"],
    [/&aacute;?/g, "á"],
    [/&Eacute;?/g, "É"],
    [/&eacute;?/g, "é"],
    [/&Iacute;?/g, "Í"],
    [/&iacute;?/g, "í"],
    [/&Oacute;?/g, "Ó"],
    [/&oacute;?/g, "ó"],
    [/&Uacute;?/g, "Ú"],
    [/&uacute;?/g, "ú"],

    // Tilde
    [/&Atilde;?/g, "Ã"],
    [/&atilde;?/g, "ã"],
    [/&Otilde;?/g, "Õ"],
    [/&otilde;?/g, "õ"],

    // Circumflex
    [/&Acirc;?/g, "Â"],
    [/&acirc;?/g, "â"],
    [/&Ecirc;?/g, "Ê"],
    [/&ecirc;?/g, "ê"],
    [/&Ocirc;?/g, "Ô"],
    [/&ocirc;?/g, "ô"],

    // Cedilla
    [/&Ccedil;?/g, "Ç"],
    [/&ccedil;?/g, "ç"],

    // Grave accent
    [/&Agrave;?/g, "À"],
    [/&agrave;?/g, "à"],

    // Umlaut / diaeresis
    [/&Auml;?/g, "Ä"],
    [/&auml;?/g, "ä"],
    [/&Euml;?/g, "Ë"],
    [/&euml;?/g, "ë"],
    [/&Iuml;?/g, "Ï"],
    [/&iuml;?/g, "ï"],
    [/&Ouml;?/g, "Ö"],
    [/&ouml;?/g, "ö"],
    [/&Uuml;?/g, "Ü"],
    [/&uuml;?/g, "ü"],

    // Quotes and symbols
    [/&quot;?/gi, '"'],
    [/&apos;?/gi, "'"],
    [/&lt;?/gi, "<"],
    [/&gt;?/gi, ">"],
  ];

  for (const [regex, replacement] of entities) {
    text = text.replace(regex, replacement);
  }

  return text;
}

/**
 * Cleans HTML content from publication texts:
 * - Strips script/style tags
 * - Converts block elements (<p>, <br>, <div>, <tr>) to linebreaks
 * - Strips HTML tags
 * - Unescapes HTML entities (handling entities missing semicolons)
 * - Normalizes whitespace per line
 */
export function cleanPublicationText(html: string): string {
  if (!html) return "";

  if (html.includes("Processo sigiloso")) {
    return "⚠️ CONTEÚDO BLOQUEADO: Processo corre em Segredo de Justiça.";
  }

  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Convert block/linebreak tags to newlines
  text = text.replace(/<(p|br|br\s*\/|div|\/p|\/div|tr|\/tr)>/gi, "\n");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Unescape HTML entities
  text = unescapeHtml(text);

  // Normalize linebreaks and whitespace
  const lines = text
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return lines.join("\n");
}
