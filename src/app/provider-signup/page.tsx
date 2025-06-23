import { ProviderSignupForm } from '@/components/provider/ProviderSignupForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';

export default function ProviderSignupPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center gap-2">
            <UserPlus className="h-7 w-7" />
            Conviértete en Proveedor
          </CardTitle>
          <CardDescription>
            Únete a nuestra red de profesionales. Completa tu perfil para empezar a ofrecer tus servicios.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <ProviderSignupForm />
        </CardContent>
      </Card>
    </div>
  );
}
