import { RouteErrorPage } from './features/listing/RouteErrorPage';
import { StoryListPage } from './features/listing/StoryListPage';
import { useListing } from './features/listing/ListingProvider';
import { ItemDetailPage } from './features/detail/ItemDetailPage';

export function App() {
  const { route } = useListing();
  if (route.type === 'item') return <ItemDetailPage id={route.id} />;
  if (route.type === 'list') return <StoryListPage />;
  return <RouteErrorPage />;
}
