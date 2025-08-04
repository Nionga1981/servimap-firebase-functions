/**
 * ChatBubble - Material Design 3 Chat Bubble Component for ServiMap
 * 
 * Componente de mensaje de chat con múltiples tipos: texto, imagen, archivo, cotización,
 * ubicación, audio. Incluye estados de entrega, reacciones y acciones contextuales.
 * 
 * @component
 * @example
 * <ChatBubble
 *   message={{
 *     id: "123",
 *     type: "text",
 *     content: "Hola, necesito un plomero",
 *     timestamp: new Date(),
 *     sender: { id: "user1", name: "Juan", avatar: "/avatar.jpg" },
 *     status: "delivered"
 *   }}
 *   isOwn={false}
 *   onReaction={(emoji) => addReaction("123", emoji)}
 * />
 */

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle,
  Download,
  Play,
  Pause,
  MapPin,
  FileText,
  Image as ImageIcon,
  Mic,
  DollarSign,
  Reply,
  MoreVertical,
  Copy,
  Trash2,
  Edit,
  Heart,
  ThumbsUp,
  Smile,
  X,
  ExternalLink
} from 'lucide-react';

interface MessageSender {
  id: string;
  name: string;
  avatar?: string;
  role?: 'client' | 'provider' | 'admin';
}

interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted?: boolean;
}

interface BaseMessage {
  id: string;
  timestamp: Date;
  sender: MessageSender;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: MessageReaction[];
  replyTo?: string;
  edited?: boolean;
  editedAt?: Date;
}

interface TextMessage extends BaseMessage {
  type: 'text';
  content: string;
}

interface ImageMessage extends BaseMessage {
  type: 'image';
  imageUrl: string;
  caption?: string;
  thumbnailUrl?: string;
}

interface FileMessage extends BaseMessage {
  type: 'file';
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

interface AudioMessage extends BaseMessage {
  type: 'audio';
  audioUrl: string;
  duration: number;
  waveform?: number[];
}

interface LocationMessage extends BaseMessage {
  type: 'location';
  latitude: number;
  longitude: number;
  address?: string;
  mapUrl?: string;
}

interface QuotationMessage extends BaseMessage {
  type: 'quotation';
  quotation: {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    validUntil?: Date;
    items?: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  };
}

type Message = TextMessage | ImageMessage | FileMessage | AudioMessage | LocationMessage | QuotationMessage;

interface ChatBubbleProps {
  /** Datos del mensaje */
  message: Message;
  /** Si el mensaje es propio del usuario actual */
  isOwn: boolean;
  /** Si mostrar el avatar del remitente */
  showAvatar?: boolean;
  /** Si mostrar el timestamp */
  showTimestamp?: boolean;
  /** Si es parte de un grupo de mensajes consecutivos */
  isGrouped?: boolean;
  /** Posición en el grupo (first, middle, last, single) */
  groupPosition?: 'first' | 'middle' | 'last' | 'single';
  /** Callback para agregar reacción */
  onReaction?: (emoji: string) => void;
  /** Callback para responder mensaje */
  onReply?: () => void;
  /** Callback para editar mensaje */
  onEdit?: () => void;
  /** Callback para eliminar mensaje */
  onDelete?: () => void;
  /** Callback para copiar mensaje */
  onCopy?: () => void;
  /** Callback para reenviar mensaje */
  onForward?: () => void;
  /** Clase CSS adicional */
  className?: string;
}

// Formatear timestamp
const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  return date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Formatear tamaño de archivo
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Componente de estado del mensaje
const MessageStatus: React.FC<{ status: Message['status'] }> = ({ status }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-[var(--color-primary-60)]" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-error" />;
      default:
        return null;
    }
  };

  return <span className="inline-flex">{getStatusIcon()}</span>;
};

// Componente de reacciones
const MessageReactions: React.FC<{ 
  reactions: MessageReaction[];
  onReactionClick: (emoji: string) => void;
}> = ({ reactions, onReactionClick }) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((reaction, index) => (
        <button
          key={index}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors",
            reaction.hasReacted 
              ? "bg-[var(--color-primary-60)]/20 text-[var(--color-primary-60)]"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
          onClick={() => onReactionClick(reaction.emoji)}
        >
          <span>{reaction.emoji}</span>
          <span className="font-medium">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
};

// Componente para mensaje de texto
const TextBubble: React.FC<{ message: TextMessage; isOwn: boolean }> = ({ message, isOwn }) => (
  <div className="space-y-1">
    <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
      {message.content}
    </p>
    {message.edited && (
      <p className="text-xs text-gray-500 italic">editado</p>
    )}
  </div>
);

// Componente para mensaje de imagen
const ImageBubble: React.FC<{ message: ImageMessage }> = ({ message }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg overflow-hidden max-w-xs">
        {!imageError ? (
          <img
            src={message.thumbnailUrl || message.imageUrl}
            alt="Imagen enviada"
            className={cn(
              "w-full h-auto transition-opacity duration-200",
              isLoading && "opacity-0"
            )}
            onLoad={() => setIsLoading(false)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
        )}
        
        {isLoading && !imageError && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
      </div>
      
      {message.caption && (
        <p className="text-sm">{message.caption}</p>
      )}
    </div>
  );
};

// Componente para mensaje de archivo
const FileBubble: React.FC<{ message: FileMessage }> = ({ message }) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg max-w-xs">
    <div className="flex-shrink-0 w-10 h-10 bg-[var(--color-primary-60)] rounded-lg flex items-center justify-center">
      <FileText className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate">{message.fileName}</p>
      <p className="text-xs text-gray-500">{formatFileSize(message.fileSize)}</p>
    </div>
    <button className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-full transition-colors">
      <Download className="w-4 h-4 text-gray-600" />
    </button>
  </div>
);

// Componente para mensaje de audio
const AudioBubble: React.FC<{ message: AudioMessage }> = ({ message }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg max-w-xs">
      <button
        className="flex-shrink-0 w-10 h-10 bg-[var(--color-primary-60)] rounded-full flex items-center justify-center"
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 text-white" />
        ) : (
          <Play className="w-5 h-5 text-white ml-0.5" />
        )}
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Mic className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">
            {Math.floor(message.duration / 60)}:{(message.duration % 60).toString().padStart(2, '0')}
          </span>
        </div>
        {/* Placeholder para waveform */}
        <div className="flex items-center gap-1 h-6">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="w-1 bg-gray-300 rounded-full"
              style={{ height: `${Math.random() * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Componente para mensaje de ubicación
const LocationBubble: React.FC<{ message: LocationMessage }> = ({ message }) => (
  <div className="space-y-2">
    <div className="relative w-64 h-32 bg-gray-200 rounded-lg overflow-hidden">
      {/* Placeholder para mapa */}
      <div className="w-full h-full flex items-center justify-center">
        <MapPin className="w-8 h-8 text-gray-400" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg" />
      </div>
    </div>
    {message.address && (
      <p className="text-sm text-gray-600">{message.address}</p>
    )}
    <button className="text-[var(--color-primary-60)] text-sm font-medium flex items-center gap-1">
      <ExternalLink className="w-4 h-4" />
      Ver en mapa
    </button>
  </div>
);

// Componente para mensaje de cotización
const QuotationBubble: React.FC<{ message: QuotationMessage }> = ({ message }) => (
  <div className="border border-[var(--color-outline-variant)] rounded-lg p-4 max-w-sm bg-[var(--color-surface-container-lowest)]">
    <div className="flex items-start gap-3 mb-3">
      <div className="w-8 h-8 bg-[var(--color-primary-60)] rounded-lg flex items-center justify-center flex-shrink-0">
        <DollarSign className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-base mb-1">{message.quotation.title}</h4>
        <p className="text-sm text-gray-600 line-clamp-2">{message.quotation.description}</p>
      </div>
    </div>
    
    <div className="space-y-2">
      {message.quotation.items && message.quotation.items.length > 0 && (
        <div className="space-y-1">
          {message.quotation.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>{item.name} x{item.quantity}</span>
              <span>${item.price.toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-1 mt-2" />
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <span className="font-semibold text-lg text-[var(--color-primary-60)]">
          ${message.quotation.price.toLocaleString()} {message.quotation.currency}
        </span>
        {message.quotation.validUntil && (
          <span className="text-xs text-gray-500">
            Válida hasta {formatTimestamp(message.quotation.validUntil)}
          </span>
        )}
      </div>
    </div>
  </div>
);

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  isOwn,
  showAvatar = true,
  showTimestamp = true,
  isGrouped = false,
  groupPosition = 'single',
  onReaction,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onForward,
  className
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Renderizar contenido según el tipo de mensaje
  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return <TextBubble message={message} isOwn={isOwn} />;
      case 'image':
        return <ImageBubble message={message} />;
      case 'file':
        return <FileBubble message={message} />;
      case 'audio':
        return <AudioBubble message={message} />;
      case 'location':
        return <LocationBubble message={message} />;
      case 'quotation':
        return <QuotationBubble message={message} />;
      default:
        return <div>Tipo de mensaje no soportado</div>;
    }
  };

  // Estilos del bubble según posición en grupo
  const getBubbleStyles = () => {
    const baseStyles = "max-w-xs md:max-w-md p-3 shadow-sm";
    const ownStyles = "bg-[var(--color-primary-60)] text-white";
    const otherStyles = "bg-white border border-[var(--color-outline-variant)]";
    
    let roundingStyles = "rounded-2xl";
    
    if (isGrouped && groupPosition !== 'single') {
      if (isOwn) {
        switch (groupPosition) {
          case 'first':
            roundingStyles = "rounded-2xl rounded-br-md";
            break;
          case 'middle':
            roundingStyles = "rounded-l-2xl rounded-r-md";
            break;
          case 'last':
            roundingStyles = "rounded-2xl rounded-tr-md";
            break;
        }
      } else {
        switch (groupPosition) {
          case 'first':
            roundingStyles = "rounded-2xl rounded-bl-md";
            break;
          case 'middle':
            roundingStyles = "rounded-r-2xl rounded-l-md";
            break;
          case 'last':
            roundingStyles = "rounded-2xl rounded-tl-md";
            break;
        }
      }
    }

    return cn(
      baseStyles,
      isOwn ? ownStyles : otherStyles,
      roundingStyles
    );
  };

  const commonReactions = ['👍', '❤️', '😊', '😂', '😮', '😢'];

  return (
    <div className={cn(
      "flex gap-3 group",
      isOwn ? "flex-row-reverse" : "flex-row",
      className
    )}>
      {/* Avatar */}
      {showAvatar && !isOwn && (!isGrouped || groupPosition === 'last' || groupPosition === 'single') && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
            {message.sender.avatar ? (
              <img
                src={message.sender.avatar}
                alt={message.sender.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--color-primary-90)] text-[var(--color-primary-60)] text-sm font-semibold">
                {message.sender.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spacer cuando no se muestra avatar */}
      {showAvatar && !isOwn && isGrouped && groupPosition !== 'last' && groupPosition !== 'single' && (
        <div className="w-8" />
      )}

      {/* Contenido del mensaje */}
      <div className="flex-1 min-w-0">
        {/* Nombre del remitente */}
        {!isOwn && showAvatar && (!isGrouped || groupPosition === 'first' || groupPosition === 'single') && (
          <div className="mb-1">
            <span className="text-sm font-medium text-gray-700">
              {message.sender.name}
            </span>
            {message.sender.role === 'provider' && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Prestador
              </span>
            )}
          </div>
        )}

        {/* Bubble del mensaje */}
        <div className="relative">
          <div
            ref={bubbleRef}
            className={getBubbleStyles()}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
          >
            {renderMessageContent()}
            
            {/* Timestamp y estado */}
            <div className={cn(
              "flex items-center gap-1 mt-2 text-xs",
              isOwn ? "text-white/70 justify-end" : "text-gray-500"
            )}>
              {showTimestamp && (
                <span>{formatTimestamp(message.timestamp)}</span>
              )}
              {isOwn && <MessageStatus status={message.status} />}
            </div>
          </div>

          {/* Acciones rápidas */}
          {showActions && (
            <div className={cn(
              "absolute top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
              isOwn ? "-left-20" : "-right-20"
            )}>
              {/* Reacciones rápidas */}
              <div className="flex bg-white rounded-full shadow-lg border border-gray-200 p-1">
                {commonReactions.slice(0, 3).map((emoji) => (
                  <button
                    key={emoji}
                    className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded-full text-sm transition-colors"
                    onClick={() => onReaction?.(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                >
                  <Smile className="w-3 h-3 text-gray-600" />
                </button>
              </div>

              {/* Menú de acciones */}
              <div className="bg-white rounded-full shadow-lg border border-gray-200 p-1">
                <button
                  className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                  onClick={() => setShowActions(false)}
                >
                  <MoreVertical className="w-3 h-3 text-gray-600" />
                </button>
              </div>
            </div>
          )}

          {/* Selector de reacciones expandido */}
          {showReactionPicker && (
            <div className="absolute top-10 right-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-10">
              <div className="flex gap-1">
                {commonReactions.map((emoji) => (
                  <button
                    key={emoji}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-lg transition-colors"
                    onClick={() => {
                      onReaction?.(emoji);
                      setShowReactionPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reacciones */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={cn("mt-1", isOwn ? "flex justify-end" : "")}>
            <MessageReactions 
              reactions={message.reactions}
              onReactionClick={(emoji) => onReaction?.(emoji)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;