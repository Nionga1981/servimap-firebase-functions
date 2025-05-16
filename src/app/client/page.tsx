import { MapDisplay } from '@/components/client/MapDisplay';

export default function ClientPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-primary">Find Local Services</h1>
      <MapDisplay />
      {/* Future sections for browsing categories, featured providers, etc. */}
    </div>
  );
}
