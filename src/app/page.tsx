// src/app/page.tsx
import { MapDisplay } from '@/components/client/MapDisplay';

export default function HomePage() {
  return (
    <div className="h-[calc(100vh-var(--header-height,64px))]"> {/* Ensure MapDisplay has height context */}
      <MapDisplay />
    </div>
  );
}
