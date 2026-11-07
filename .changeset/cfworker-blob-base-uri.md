---
'@modelcontextprotocol/client': patch
'@modelcontextprotocol/server': patch
---

The bundled `@cfworker/json-schema` validator no longer throws `TypeError: Invalid URL` at import time when the page is loaded from a `blob:` URL on a port-bearing origin (for example a dev server): its `initialBaseURI` is now computed from `location.href`, which is always a valid absolute URL, instead of `origin + pathname + search` — for `blob:` documents the pathname is itself an absolute URL, so the concatenation was invalid. Previously a View built with `@modelcontextprotocol/ext-apps` that a host rendered from a `blob:` URL died at module load and never sent `ui/initialize` (modelcontextprotocol/ext-apps#806). Sandboxed/`srcdoc` documents (opaque origin) still fall back to the default base URI, and all other documents resolve the same base as before.
