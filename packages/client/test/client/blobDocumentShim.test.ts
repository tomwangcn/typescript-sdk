/**
 * Regression pin for the blob:-document import crash reported in
 * modelcontextprotocol/ext-apps#806.
 *
 * `@cfworker/json-schema`'s dereference module computes `initialBaseURI` at
 * import time. Before the patched dependency (patches/@cfworker__json-schema),
 * it evaluated `new URL(self.location.origin + self.location.pathname + location.search)`.
 * For a document loaded from a `blob:` URL, `location.pathname` is itself an
 * absolute URL (`blob:<origin>/<uuid>` inherits the creator origin), so the
 * concatenation is not a valid URL — and on origins that carry a port (any
 * dev server) the URL parser throws `TypeError: Invalid URL`. Because the
 * browser shim statically re-exports the cfWorker-backed default validator,
 * the throw happened at module evaluation: a View bundled with
 * `@modelcontextprotocol/ext-apps` died before `App.connect()`, and the host
 * only saw a View that never sent `ui/initialize`.
 *
 * The patch builds the base from `location.href` instead, which is always a
 * valid absolute URL (including for `blob:` documents) and is otherwise
 * equivalent to the old expression (`href` = `origin + pathname + search + hash`).
 *
 * Asserted against the real build output: the browser shim chunk inlines the
 * dependency, so only executing `dist/shimsBrowser.mjs` proves the published
 * artifact evaluates under these conditions.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { ensureBuilt } from '../helpers/ensureBuilt';

const pkgDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

interface ShimsBrowserModule {
    CORS_IS_POSSIBLE: boolean;
    DefaultJsonSchemaValidator: new () => {
        getValidator(schema: Record<string, unknown>): (input: unknown) => { valid: boolean };
    };
}

/** A `blob:` document created by an app on a port-bearing origin (any dev server). */
const BLOB_PORT_LOCATION = {
    origin: 'http://localhost:8080',
    pathname: 'http://localhost:8080/9f2c0c44-blob-uuid',
    search: '',
    href: 'blob:http://localhost:8080/9f2c0c44-blob-uuid'
};

/** A sandboxed/srcdoc document: opaque origin keeps the 'null' guard on the fallback. */
const SRCDOC_LOCATION = {
    origin: 'null',
    pathname: 'about:srcdoc',
    search: '',
    href: 'about:srcdoc'
};

describe('browser shim under non-standard document locations', () => {
    beforeAll(async () => {
        await ensureBuilt(pkgDir);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test.each([
        ['blob: document on a port-bearing origin', BLOB_PORT_LOCATION],
        ['srcdoc document with an opaque origin', SRCDOC_LOCATION]
    ])('evaluates and validates under a %s', async (_label, location) => {
        vi.stubGlobal('self', { location });
        vi.stubGlobal('location', location);

        const mod = (await import(path.join(pkgDir, 'dist', 'shimsBrowser.mjs'))) as unknown as ShimsBrowserModule;
        expect(mod.CORS_IS_POSSIBLE).toBe(true);

        const validator = new mod.DefaultJsonSchemaValidator();
        const validate = validator.getValidator({ type: 'integer' });
        expect(validate(7).valid).toBe(true);
        expect(validate('x').valid).toBe(false);
    });
});
