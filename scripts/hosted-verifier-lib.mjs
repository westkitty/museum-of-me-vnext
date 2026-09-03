const HASHED_ASSET = /\/assets\/[^/?#]+-[A-Za-z0-9_-]+\.(?:js|css)$/;

function requireHeader(response, name, predicate, description, errors) {
  const value = response.headers.get(name) ?? '';
  if (!predicate(value)) errors.push(`${description}: ${name}=${JSON.stringify(value)}`);
}

export function normaliseHostedUrl(value) {
  const url = new URL(value);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('hosted verification requires HTTPS (HTTP is allowed only for localhost)');
  }
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

export function releaseAssetRefs(html) {
  const refs = [];
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/gi)) {
    if (!refs.includes(match[1])) refs.push(match[1]);
  }
  return refs;
}

export async function verifyHosted(value, fetchImpl = globalThis.fetch) {
  const errors = [];
  const checks = [];
  let base;

  try {
    base = normaliseHostedUrl(value);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)], checks };
  }

  let shell;
  try {
    shell = await fetchImpl(base, { redirect: 'follow', cache: 'no-store' });
  } catch (error) {
    return { ok: false, errors: [`shell request failed: ${error instanceof Error ? error.message : String(error)}`], checks };
  }

  if (!shell.ok) {
    errors.push(`shell returned HTTP ${shell.status}`);
    return { ok: false, errors, checks };
  }
  checks.push(`shell ${shell.status}`);

  requireHeader(
    shell,
    'cache-control',
    (value) => /max-age=0/i.test(value) && /must-revalidate/i.test(value),
    'HTML shell is not configured to revalidate',
    errors,
  );
  requireHeader(
    shell,
    'x-content-type-options',
    (value) => value.toLowerCase() === 'nosniff',
    'missing MIME-sniffing protection',
    errors,
  );
  requireHeader(
    shell,
    'x-frame-options',
    (value) => value.toUpperCase() === 'DENY',
    'missing frame denial',
    errors,
  );
  requireHeader(
    shell,
    'content-security-policy',
    (value) => value.includes("default-src 'self'") && value.includes("frame-ancestors 'none'"),
    'hosted CSP does not match the release boundary',
    errors,
  );

  const html = await shell.text();
  for (const mount of ['museum-canvas', 'ui-root', 'a11y-root']) {
    if (!html.includes(`id="${mount}"`) && !html.includes(`id='${mount}'`)) {
      errors.push(`HTML shell is missing #${mount}`);
    }
  }

  const refs = releaseAssetRefs(html);
  const js = refs.filter((ref) => /\.js(?:$|[?#])/.test(ref));
  const css = refs.filter((ref) => /\.css(?:$|[?#])/.test(ref));
  if (js.length === 0) errors.push('HTML shell references no JavaScript asset');
  if (css.length === 0) errors.push('HTML shell references no CSS asset');

  for (const ref of refs) {
    const assetUrl = new URL(ref, base);
    if (assetUrl.origin !== base.origin) {
      errors.push(`cross-origin release asset: ${assetUrl.href}`);
      continue;
    }
    if (!HASHED_ASSET.test(assetUrl.pathname)) {
      errors.push(`release asset is not content-hashed: ${assetUrl.pathname}`);
    }

    let response;
    try {
      response = await fetchImpl(assetUrl, { redirect: 'follow', cache: 'no-store' });
    } catch (error) {
      errors.push(`asset request failed for ${assetUrl.pathname}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (!response.ok) {
      errors.push(`asset ${assetUrl.pathname} returned HTTP ${response.status}`);
      continue;
    }
    const cacheControl = response.headers.get('cache-control') ?? '';
    if (!/max-age=31536000/i.test(cacheControl) || !/immutable/i.test(cacheControl)) {
      errors.push(`asset cache policy is not immutable for ${assetUrl.pathname}: ${JSON.stringify(cacheControl)}`);
    }
  }

  if (refs.length > 0) checks.push(`${refs.length} same-origin hashed JS/CSS assets reachable`);
  if (errors.length === 0) checks.push('hosted cache/security headers match release policy');

  return { ok: errors.length === 0, errors, checks };
}
