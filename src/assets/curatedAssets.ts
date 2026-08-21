import { registerAsset } from './manifest';

import shellUrl from './curated/embedded-00.avif';
import entranceUrl from './curated/embedded-01.avif';
import smoresUrl from './curated/embedded-02.webp';
import drakkenUrl from './curated/embedded-03.webp';
import westcatUrl from './curated/embedded-04.webp';
import orbitalUrl from './curated/embedded-05.webp';
import starsilkUrl from './curated/embedded-06.webp';
import dexterUrl from './curated/embedded-07.webp';
import turnaroundUrl from './curated/embedded-08.webp';

const URLS: Record<string, string> = {
  'embedded-00': shellUrl,
  'embedded-01': entranceUrl,
  'embedded-02': smoresUrl,
  'embedded-03': drakkenUrl,
  'embedded-04': westcatUrl,
  'embedded-05': orbitalUrl,
  'embedded-06': starsilkUrl,
  'embedded-07': dexterUrl,
  'embedded-08': turnaroundUrl,
};

let registered = false;

export function curatedUrl(id: string): string | undefined {
  return URLS[id];
}

const CREATOR = 'Museum of Me / Reliquary curated source';
const LICENSE = 'User-supplied curated raster; provenance recorded from THREEJS_CURATED.html.';

export function registerCuratedAssets(): void {
  if (registered) return;
  registered = true;
  registerAsset({
    id: 'embedded-00', title: 'museum-shell-background', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: shellUrl, sourceHash: 'df85ee01eaca6cd2b00c36a70a3f0490d98bc4aa75c7b6782b94749cbd677d2f',
    processedHash: 'df85ee01eaca6cd2b00c36a70a3f0490d98bc4aa75c7b6782b94749cbd677d2f',
    budgetKB: 29, streamingGroup: 'shell', attribution: 'CSS background for the museum shell',
  });
  registerAsset({
    id: 'embedded-01', title: 'entrance-background', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: entranceUrl, sourceHash: 'd62490ef9b64a76ddbf5057aa0573e036832464d0f5783f2216b997c5932dafa',
    processedHash: 'd62490ef9b64a76ddbf5057aa0573e036832464d0f5783f2216b997c5932dafa',
    budgetKB: 23, streamingGroup: 'shell', attribution: 'CSS background for the entry screen',
  });
  registerAsset({
    id: 'embedded-02', title: 'project-art-smores-katamari', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: smoresUrl, sourceHash: '4089e5e06e67ad93b0bb6565f0d3ac0c7df0eeef0fa9e83a1486b87d8de95935',
    processedHash: '4089e5e06e67ad93b0bb6565f0d3ac0c7df0eeef0fa9e83a1486b87d8de95935',
    budgetKB: 67, streamingGroup: 'shell', attribution: 'Primary wall artwork for S’mores’ Katamari',
  });
  registerAsset({
    id: 'embedded-03', title: 'project-art-drakken-sandbox', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: drakkenUrl, sourceHash: 'e89052531eb102161a4d0962ad4d7f88333dc073c07534b6d3a3ba250696bbf8',
    processedHash: 'e89052531eb102161a4d0962ad4d7f88333dc073c07534b6d3a3ba250696bbf8',
    budgetKB: 114, streamingGroup: 'shell', attribution: 'Primary wall artwork for Drakken Sandbox',
  });
  registerAsset({
    id: 'embedded-04', title: 'project-art-westcat-familiar', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: westcatUrl, sourceHash: '95681cd91529e8e274ea07ac00177e599bebcc1cee606a6eeda6198b18ee51bc',
    processedHash: '95681cd91529e8e274ea07ac00177e599bebcc1cee606a6eeda6198b18ee51bc',
    budgetKB: 79, streamingGroup: 'shell', attribution: 'Primary wall artwork for Westcat Familiar',
  });
  registerAsset({
    id: 'embedded-05', title: 'project-art-orbital-tomb', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: orbitalUrl, sourceHash: 'a9c40576c28cdd12980e94246c295034819607368bc940b55558ebe36908064b',
    processedHash: 'a9c40576c28cdd12980e94246c295034819607368bc940b55558ebe36908064b',
    budgetKB: 147, streamingGroup: 'shell', attribution: 'Primary wall artwork for Orbital Tomb',
  });
  registerAsset({
    id: 'embedded-06', title: 'project-art-starsilk-atlas', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: starsilkUrl, sourceHash: 'd81f736e578639da82996d9a89bf57581f00599516910b504f5f76b080723f94',
    processedHash: 'd81f736e578639da82996d9a89bf57581f00599516910b504f5f76b080723f94',
    budgetKB: 34, streamingGroup: 'shell', attribution: 'Primary wall artwork for Starsilk Atlas',
  });
  registerAsset({
    id: 'embedded-07', title: 'project-art-dexgpt', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: dexterUrl, sourceHash: 'e9f74cb4637533d763829e00a69c6fe90876a7854d68cc0c22365b36be17f712',
    processedHash: 'e9f74cb4637533d763829e00a69c6fe90876a7854d68cc0c22365b36be17f712',
    budgetKB: 113, streamingGroup: 'sanctuary', attribution: 'Primary wall artwork for DexGPT',
  });
  registerAsset({
    id: 'embedded-08', title: 'dexter-turnaround-reference', kind: 'texture',
    source: 'authentic:reliquary-curated', project: null, creator: CREATOR, license: LICENSE,
    url: turnaroundUrl, sourceHash: '3031932740c92d295afe88b1a7d842e2160af10114d90fe830f51e1f901654dc',
    processedHash: '3031932740c92d295afe88b1a7d842e2160af10114d90fe830f51e1f901654dc',
    budgetKB: 153, streamingGroup: 'sanctuary', attribution: 'Rear-sanctuary Dexter turnaround reference',
  });
}

export { shellUrl, entranceUrl, smoresUrl, drakkenUrl, westcatUrl, orbitalUrl, starsilkUrl, dexterUrl, turnaroundUrl };
