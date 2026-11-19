import { showCollectionPage } from './ui/CollectionPage';

const params = new URLSearchParams(window.location.search);
const exhibit = params.get('exhibit');

if (exhibit !== null || params.get('view') === 'collection') {
  showCollectionPage(exhibit);
} else {
  void import('./main').then(({ startMuseum }) => startMuseum()).catch((error: unknown) => {
    console.error('[museum] 3D startup failed', error);
    showCollectionPage(params.get('guide'), true);
  });
}
