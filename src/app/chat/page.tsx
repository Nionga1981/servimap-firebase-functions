import { ChatInterface } from '@/components/chat/ChatInterface';
import { ChatGuardDemo } from '@/components/chat/ChatGuardDemo';
import { Separator } from '@/components/ui/separator';

export default function ChatPage() {
  return (
    <div className="container mx-auto py-8 space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-4 text-primary text-center">Demo de Interfaz de Chat</h1>
        <p className="text-muted-foreground text-center mb-8">
          Esta es una maqueta del chat en tiempo real. Los mensajes son revisados por IA antes de enviarse.
        </p>
        <ChatInterface />
      </div>

      <Separator className="my-12" />
      
      <div>
        <h1 className="text-3xl font-bold mb-4 text-primary text-center">Prueba del Guardián de Chat IA</h1>
        <p className="text-muted-foreground text-center mb-8">
          Usa esta herramienta para probar la habilidad de la IA para marcar mensajes inapropiados de forma independiente.
        </p>
        <ChatGuardDemo />
      </div>
    </div>
  );
}
