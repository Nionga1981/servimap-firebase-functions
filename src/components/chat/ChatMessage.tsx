import type { ChatMessage as ChatMessageType } from '@/types';
import { cn } from '@/lib/utils';
import { Bot, User, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DEFAULT_USER_AVATAR } from '@/lib/constants';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';
  const isProvider = message.sender === 'provider';
  const isSystem = message.sender === 'system';

  const alignment = isUser ? 'items-end' : 'items-start';
  const bubbleStyles = isUser
    ? 'bg-primary text-primary-foreground rounded-tr-none'
    : 'bg-secondary text-secondary-foreground rounded-tl-none';
  const systemBubbleStyles = 'bg-muted text-muted-foreground text-xs italic';

  const avatarSrc = isUser ? DEFAULT_USER_AVATAR : 'https://placehold.co/100x100.png?text=P';
  const avatarFallback = isUser ? 'U' : 'P';


  return (
    <div className={cn('flex flex-col gap-1 w-full', alignment)}>
      <div className={cn('flex gap-2 items-end', isUser ? 'flex-row-reverse' : 'flex-row')}>
        {!isSystem && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarSrc} alt={message.sender} data-ai-hint={isUser ? "user avatar" : "provider avatar"} />
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>
        )}
        <div
          className={cn(
            'max-w-[70%] p-3 rounded-xl shadow-md',
            isSystem ? systemBubbleStyles : bubbleStyles
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
      {message.isSafe === false && (
        <div className={cn("flex items-center gap-1 text-xs mt-1", isUser ? "justify-end mr-10" : "ml-10")}>
            <ShieldAlert className="h-3 w-3 text-destructive" />
            <span className="text-destructive">{message.safetyReason || "Potentially inappropriate content"}</span>
        </div>
      )}
       {message.isSafe === true && message.sender !== 'system' && ( // Optional: show "safe" indicator
        <div className={cn("flex items-center gap-1 text-xs mt-1", isUser ? "justify-end mr-10" : "ml-10")}>
            <ShieldCheck className="h-3 w-3 text-green-500" />
            <span className="text-green-500">Message checked</span>
        </div>
      )}
      {!isSystem && (
        <p className={cn('text-xs text-muted-foreground', isUser ? 'text-right mr-10' : 'ml-10')}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
