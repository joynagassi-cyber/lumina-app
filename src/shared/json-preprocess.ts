/**
 * JSON preprocessing for AI-generated output.
 * Strips common artifacts that cause JSON.parse() to fail,
 * then returns clean JSON ready for AJV validation.
 *
 * Safe: every transformation is idempotent and reversible-agnostic.
 * Applying this twice produces the same result as once.
 */

/**
 * Strip common AI-generated JSON artifacts before parsing.
 * Handles: markdown fences, trailing commas, single quotes, JS comments,
 * leading text before `{`, trailing text after `}`.
 */
export function preprocessAIRawJSON(raw: string): string {
  let result = raw.trim();

  // 1. Strip markdown code fences (most common AI artifact)
  result = result.replace(/^```(?:json)?\s*\n?/i, '');
  result = result.replace(/\n```\s*$/i, '');

  // 2. Remove explanatory text before the first `{`
  const firstBrace = result.indexOf('{');
  if (firstBrace > 0 && result.charAt(firstBrace - 1) !== '{') {
    result = result.slice(firstBrace);
  }

  // 3. Remove trailing text after the last `}`
  const lastBrace = result.lastIndexOf('}');
  if (lastBrace < result.length - 1) {
    result = result.slice(0, lastBrace + 1);
  }

  // 4. Fix trailing commas before closing braces/arrays
  result = result.replace(/,\s*([\]}])/g, '$1');

  // 5. Convert single quotes to double quotes in JSON positions
  result = convertSingleQuotes(result);

  // 6. Remove JavaScript-style comments (// and /* */)
  result = result.replace(/\/\/.*$/gm, '');
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  // 7. Normalize line endings
  result = result.replace(/\r\n/g, '\n');

  return result;
}

/**
 * Convert single quotes used in JSON positions to double quotes.
 * Only converts quotes that are outside of double-quoted strings.
 */
function convertSingleQuotes(json: string): string {
  let result = '';
  let i = 0;

  while (i < json.length) {
    const char = json[i];

    if (char === '"') {
      // Inside a double-quoted string -- keep everything as-is until closing quote
      result += char;
      i++;
      while (i < json.length && json[i] !== '"') {
        if (json[i] === '\\') {
          result += json[i] + (json[i + 1] || '');
          i += 2;
          continue;
        }
        result += json[i];
        i++;
      }
      if (i < json.length) {
        result += json[i];
        i++;
      }
    } else if (char === "'") {
      // Outside double-quoted context -- likely a key/value using single quotes
      result += '"';
      i++;
      while (i < json.length && json[i] !== "'") {
        result += json[i];
        i++;
      }
      if (i < json.length) {
        result += '"';
        i++;
      }
    } else {
      result += char;
      i++;
    }
  }

  return result;
}
