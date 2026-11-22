import { registerAsset } from './manifest';
import coffeeUrl from './npc/island-coffee.glb';
import robotheadUrl from './npc/island-robothead.glb';
import carrotKidUrl from './npc/island-carrot-kid.glb';
import cactusboyUrl from './npc/island-cactusboy.glb';
import froggyUrl from './npc/island-froggy.glb';
import eyewizardUrl from './npc/island-eyewizard.glb';
import goldfishBagPersonUrl from './npc/island-goldfish-bag-person.glb';

let registered = false;

export function registerIslandVisitorAssets(): void {
  if (registered) return;
  registered = true;
  registerAsset({
    id: 'island-coffee', title: 'Coffee', kind: 'glb', source: 'external',
    project: null, creator: 'Polygonal Mind', license: 'CC0-1.0 (100 Avatars Round 1)',
    url: coffeeUrl, sourceHash: 'ade705150ce7f189c986d96b9589849e3c9499d029fbba8c8832c121ca83929d',
    processedHash: '0c306972ce8eec5f46b19307d4f415edb0a3bafa25bdc74cfe0e39fd3d9f30c6',
    budgetKB: 253, streamingGroup: 'exterior-npc',
    attribution: 'Polygonal Mind — 100 Avatars Round 1 (CC0).',
  });
  registerAsset({
    id: 'island-robothead', title: 'Robothead', kind: 'glb', source: 'external',
    project: null, creator: 'Polygonal Mind', license: 'CC0-1.0 (100 Avatars Round 1)',
    url: robotheadUrl, sourceHash: '15786458aaa1175bb700204daf9d8616ee132d01a866688bd311e38eb91bdf26',
    processedHash: 'd73aba74cc49c862b4e760dc45505acfe6bc130854dd405f595de6b16840214f',
    budgetKB: 296, streamingGroup: 'exterior-npc',
    attribution: 'Polygonal Mind — 100 Avatars Round 1 (CC0).',
  });
  registerAsset({
    id: 'island-carrot-kid', title: 'Carrot Kid', kind: 'glb', source: 'external',
    project: null, creator: 'Polygonal Mind', license: 'CC0-1.0 (100 Avatars Round 1)',
    url: carrotKidUrl, sourceHash: '10927784ea46d900b48e6217bfffaaa713076f20dc853d8c1b1f5c39f86c248e',
    processedHash: '1a16aed6c9461bf39a7d35dc7902e66d7d3d25383211340d5ecc70e5973eab90',
    budgetKB: 377, streamingGroup: 'exterior-npc',
    attribution: 'Polygonal Mind — 100 Avatars Round 1 (CC0).',
  });
  registerAsset({
    id: 'island-cactusboy', title: 'Cactusboy', kind: 'glb', source: 'external',
    project: null, creator: 'Polygonal Mind', license: 'CC0-1.0 (100 Avatars Round 1)',
    url: cactusboyUrl, sourceHash: 'b1d82952025aa4fe3a34f4054280cd52e498f1f43ee82b44822106f0b11f1011',
    processedHash: '4a7d43a713064aea53eafd1afb864dabe70459602d4ee37b48d297a1d19e6e62',
    budgetKB: 403, streamingGroup: 'exterior-npc',
    attribution: 'Polygonal Mind — 100 Avatars Round 1 (CC0).',
  });
  registerAsset({
    id: 'island-froggy', title: 'Froggy', kind: 'glb', source: 'external',
    project: null, creator: 'Polygonal Mind', license: 'CC0-1.0 (100 Avatars Round 1)',
    url: froggyUrl, sourceHash: '73159840f0940ddb7a69ce979c3b136eb5e16f47a42ad7005678e95690758281',
    processedHash: '08580e8e6a19d74b61cde46b0d9508a40efd33c6f7c9be65c1b21c20b201ce42',
    budgetKB: 926, streamingGroup: 'exterior-npc',
    attribution: 'Polygonal Mind — 100 Avatars Round 1 (CC0).',
  });
  registerAsset({
    id: 'island-eyewizard', title: 'Eyewizard', kind: 'glb', source: 'external',
    project: null, creator: 'Polygonal Mind', license: 'CC0-1.0 (100 Avatars Round 2)',
    url: eyewizardUrl, sourceHash: 'dd33100848a47837cd621c8a45de751f44b3e5692d27d69b2733554567b87cb7',
    processedHash: '77589f22ff93e2b0e9d6e117c5e29685dba72a559e7489543b9247c0ee8ccef2',
    budgetKB: 367, streamingGroup: 'exterior-npc',
    attribution: 'Polygonal Mind — 100 Avatars Round 2 (CC0).',
  });
  registerAsset({
    id: 'island-goldfish-bag-person', title: 'Goldfish Bag Person', kind: 'glb', source: 'external',
    project: null, creator: 'Polygonal Mind', license: 'CC0-1.0 (100 Avatars Round 2)',
    url: goldfishBagPersonUrl, sourceHash: '77ea9e37504e8b8fd2ac0615bbe182b4f05f7ad3599e0f9b7747e049e0edd704',
    processedHash: 'fd1aaf5e0aa51482ed706b944fee7aecb00cd30bdc54848da463a950fb3eb51e',
    budgetKB: 615, streamingGroup: 'exterior-npc',
    attribution: 'Polygonal Mind — 100 Avatars Round 2 (CC0).',
  });
}
