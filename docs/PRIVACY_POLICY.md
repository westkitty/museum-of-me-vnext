# Privacy and Sanitization Policy

## Rule

Nothing in the visitor-facing museum may expose private, operational, or sensitive material.
This is enforced by `npm run validate:privacy`, which scans **all** content data and exhibit source
and fails the build on a match.

## Categories that must never appear

| Category | Treatment |
|---|---|
| Credentials, API keys, tokens, SSH keys | Never present. Pattern-scanned. |
| Real IP addresses, hostnames, network topology | Replaced with synthetic examples. Pattern-scanned for RFC1918, CGNAT (100.64/10), and public literals. |
| Real personal names other than project naming already public | Removed. No second individual is named anywhere in visitor content. |
| Private file paths (`/Users/...`, home directories) | Never present in content. Pattern-scanned. |
| Real OSINT case data, targets, or investigation records | Exhibit 35 uses an entirely fictional investigation. |
| Housing, benefits, medical, legal, or banking records | Exhibit 21 uses an entirely fictional situation. |
| Real biometric or face data | Exhibit 35 uses synthetic generated faces only. |
| Private correspondence | Never present. |
| Debug dumps | Never shipped. |

## Specific exhibit rulings

- **E34 BigMac Backbone** — every address, hostname, volume name, share name and identifier shown is a
  synthetic example authored for the museum. No live credential, key, or operational configuration.
  The exhibit teaches the *architecture*; it does not document the deployment.
- **E35 Local Specialist Systems Lab** — face bay uses procedurally generated synthetic faces.
  Research bay uses a fabricated investigation about a fictional entity.
- **E21 Civic Support Studio** — the casefile assembled by visitors is fiction, authored for the museum.
- **E12 Rhetorical InDEX** — all sample statements are invented. No real dispute, publication, or
  person is analysed.
- **E17 Dex Voice Lab** — no microphone permission is requested. All samples are prerecorded and
  synthesised for the museum.

## No live services

The core visitor experience requires no AI inference, no cloud API, no map service, no backend,
and no network access beyond fetching the museum's own static files.

## Scanner

`scripts/validate-privacy.mjs` checks `data/**`, `src/content/**`, and `src/exhibits/**` for:
credential signatures, private-range and public IPv4 literals, `~/` and `/Users/` paths,
`.local`/`.internal` hostnames, and a denylist of personal identifiers. Exit code 1 on any hit.
