import { ChatInterface } from '@/components/chat/ChatInterface';
import { ChatGuardDemo } from '@/components/chat/ChatGuardDemo';
import { Separator } from '@/components/ui/separator';

export default function ChatPage() {
  return (
    <div className="container mx-auto py-8 space-y-12">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-primary text-center">Chat Interface Demo</h1>
        <p className="text-muted-foreground text-center mb-8">
          This is a mock-up of the real-time chat. Messages are checked by AI before sending.
        </p>
        <ChatInterface />
      </div>

      <Separator className="my-12" />
      
      <div>
        <h1 className="text-3xl font-bold mb-2 text-primary text-center">AI Chat Guard Test</h1>
        <p className="text-muted-foreground text-center mb-8">
          Use this tool to test the AI's ability to flag inappropriate messages independently.
        </p>
        <ChatGuardDemo />
      </div>
    </div>
  );
}
