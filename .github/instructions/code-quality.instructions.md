---
applyTo: "**/*.{js,html}"
description: "Use when changing URL handling, navigation, generated markup, external data rendering, or any trust boundary in JavaScript or HTML."
---

# Secure Code Quality Conventions

## Trust Boundaries

- Treat annual JSON fields, browser storage, URL query or fragment values, remote responses, and user-supplied text as untrusted until they have been validated for their destination context.
- Prefer DOM text APIs for visible content. When existing generated markup requires string HTML, escape every untrusted text value with `HtmlSafety.escapeHtml` before insertion.
- Do not concatenate untrusted input into markup, selectors, script content, CSS, or navigation destinations.

## URL Validation And Encoding

- Never secure a destination by removing or replacing suspicious substrings, or by relying on `includes`, `startsWith`, regular-expression protocol checks, or deny lists. Parse the complete value with `URL`, enforce an explicit protocol or origin allowlist, and reject invalid input rather than repairing it.
- For application-data links interpolated into generated markup, reuse `src/js/services/html-safety.js`: use `HtmlSafety.safeHttpUrl` for external HTTP(S) links, `HtmlSafety.safeMailtoUrl` for email destinations, and `HtmlSafety.safeTelephoneUrl` for phone destinations. Extend that service and its tests when a new allowed destination type is required.
- Validate a URL before it is written into an HTML attribute, opened, redirected to, fetched, cached, or reported. Where an internal link is required, additionally require the expected origin and path shape.
- Keep encoding contextual: use `URL` and `URLSearchParams` to construct URLs, and `encodeURIComponent` only for individual path or query values when a structured API is not practical. Do not encode an entire URL to make it safe.
- HTML escaping and URL encoding solve different problems. Encoding query values does not validate a scheme, and escaping markup delimiters does not make a `javascript:`, `data:`, or otherwise disallowed destination safe.
- Avoid decoding an input for inspection and then using an unchecked original or reconstructed value. Validate the exact normalized destination that the browser will consume.

## Rendering And Navigation

- Prefer setting text content and validated element properties over emitting HTML strings. For property assignment, set a parsed and allowlisted URL value without HTML entity encoding; reserve the `HtmlSafety` destination helpers for markup strings. When existing controllers build markup, keep text escaping and destination validation visibly adjacent to the interpolation site.
- Do not use `innerHTML` with raw external or stored data, even when the current dataset appears maintained or trusted.
- Do not pass raw query strings, URL fragments, referrers, or destination values into analytics. Only a separately reviewed, fixed campaign tuple from an app-published inbound link may be allowlisted and mapped to GA campaign fields; reject arbitrary campaign values and retain the remaining privacy boundary in the JavaScript instructions.

## Structured Markup Processing

- Never sanitize, remove, or rewrite HTML comments, tags, attributes, scripts, styles, or other multi-character markup constructs with regular-expression or substring replacement. A one-pass replacement can join surrounding fragments into a new dangerous construct, and repeated replacement remains an error-prone HTML parser substitute.
- Process HTML with the repository's established parser or DOM APIs and operate on complete parsed nodes or tokens. For generated text or attributes, use destination-specific validation and contextual encoding instead of deleting suspicious syntax. If parsed input is malformed, ambiguous, or leaves a forbidden construct after processing, reject it or fail the build rather than repairing and emitting it.
- Before adding markup normalization or sanitization, search for the existing semantic owner and review sibling build-time and browser-time paths. Do not introduce a second ad hoc sanitizer when a parser, `HtmlSafety`, or another established boundary already owns the operation.

## Dynamic Regular Expressions

- Prefer exact string comparisons or `includes` when regex behavior is unnecessary. When untrusted or computed text must become a literal part of a `RegExp`, escape the complete JavaScript metacharacter set, including backslash, through an established helper or the canonical `/[.*+?^${}()|[\]\\]/g` replacement. Never use a partial character set based only on the current input format.
- Keep `regexp-safety/complete-escaping` enabled for every JavaScript file. Extend its focused configuration test when another safe construction is intentionally supported; do not disable or bypass the rule at a call site.

## Regression Coverage

- Add or update focused tests whenever code introduces or changes URL parsing, link generation, generated markup, redirects, storage-to-DOM output, or external-data rendering.
- Exercise accepted inputs and rejected hostile inputs, including disallowed schemes (`javascript:` and `data:`), malformed URLs, markup/attribute delimiters, encoded components, and control-character or whitespace injection where relevant.
- For markup removal or normalization, include hostile cases where deleting one complete token, tag, or substring could join retained fragments into a new comment opener, tag, closing delimiter, protocol, or executable construct. Assert that processing either produces structurally safe output or fails closed.
- Assert the trust-boundary outcome rather than a complete generated string: accepted fixture values remain usable, hostile tags and destinations cannot execute or navigate, and encoding is correct for its context. Do not couple these checks to unrelated static copy or wrapper markup.
- When a regular-expression assertion verifies that dangerous HTML tags were escaped or rejected, make the tag match case-insensitive, use a tag-name boundary, and include mixed-case hostile input. Prefer structured DOM assertions when the test needs to inspect general HTML rather than one specific forbidden tag, and use the minimum stable markup fragment needed for a Node-only security check.
- Keep reusable sanitization logic in a service with unit coverage, and add browser coverage when the value reaches rendered output or an interactive navigation workflow.
