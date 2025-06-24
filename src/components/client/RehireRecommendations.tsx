// src/components/client/RehireRecommendations.tsx
import Link from 'next/link';
import { getRehireRecommendations } from '@/services/recommendationService';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Repeat, ArrowRight } from 'lucide-react';
import { SERVICE_CATEGORIES } from '@/lib/constants';

// In a real app, this would come from the user's session
const CURRENT_USER_ID = "currentUserDemoId";

export async function RehireRecommendations() {
  const recommendations = await getRehireRecommendations(CURRENT_USER_ID);

  if (recommendations.length === 0) {
    return null; // Don't render anything if there are no recommendations
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Repeat className="text-primary" />
        Sugerencias para ti
      </h2>
      <p className="text-muted-foreground">
        Basado en tus servicios anteriores, quizás necesites ayuda de nuevo con esto.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recommendations.map(({ id, provider, categoria, mensaje }) => {
          if (!provider) return null;
          const categoryInfo = SERVICE_CATEGORIES.find(c => c.id === categoria);

          return (
            <Card key={id} className="flex flex-col h-full shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border">
                    <AvatarImage src={provider.avatarUrl} alt={provider.name} data-ai-hint={provider.dataAiHint} />
                    <AvatarFallback>{provider.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    {categoryInfo && (
                        <Badge variant="secondary" className="mt-1">{categoryInfo.name}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">{mensaje}</p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/provider-profile/${provider.id}`}>
                    Agendar de nuevo <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
