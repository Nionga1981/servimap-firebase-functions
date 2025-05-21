
import { MapDisplay } from '@/components/client/MapDisplay';

export default function HomePage() {
  return (
    // El AdBanner superior ha sido eliminado para el nuevo diseño.
    // El MapDisplay ahora ocupará más espacio y contendrá la nueva UI inferior.
    <div className="h-[calc(100vh-var(--header-height,64px))]">
      <MapDisplay />
    </div>
  );
}
