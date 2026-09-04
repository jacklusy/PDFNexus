/**
 * Characters that must not appear raw inside an inline JSON-LD <script>:
 * `<` (could terminate the script tag from within a string value) and
 * U+2028/U+2029 (valid JSON, but line terminators in JS — they corrupt the
 * block, which search engines then silently ignore rather than report).
 *
 * Built via the RegExp constructor so the escapes stay as ASCII sequences in
 * source; a raw U+2028 inside a regex literal is a syntax error.
 */
const JSON_LD_UNSAFE = new RegExp('[<\\u2028\\u2029]', 'g');

function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    JSON_LD_UNSAFE,
    (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeJsonLd(data) }}
    />
  );
}
