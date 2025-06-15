// src/components/client/DynamicMapLoader.tsx
"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const DynamicMapDisplayComponent = dynamic(() => import('@/components/client/MapDisplay').then(mod => mod.MapDisplay), {
  ssr: false, // Map components often rely on window or other browser APIs
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-background">
      <Skeleton className="w-full h-full" />
      <p className="absolute text-muted-foreground z-10">Loading Map...</p>
    </div>
  ),
});

export default function DynamicMapLoader() {
  // This component ensures that the DynamicMapDisplayComponent can fill the height
  // provided by its parent in page.tsx
  return (
    <div className="h-full w-full">
      <DynamicMapDisplayComponent />
    </div>
  );
}
