// src/app/page.tsx
import DynamicMapLoader from '@/components/client/DynamicMapLoader';

export default function HomePage() {
  return (
    <div className="h-[calc(100vh-var(--header-height,64px))]"> {/* Ensure MapDisplay has height context */}
      <DynamicMapLoader />
    </div>
  );
}
