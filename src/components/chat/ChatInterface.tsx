"use client";

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, MessageCircle } from 'lucide-react';
import { chatGuard, type ChatGuardOutput } from '@/ai/flows/chat-guard'; // Importar el flujo GenAI

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    { id: '1', sender: 'provider', text: '¡Hola! ¿Cómo puedo ayudarte con tu plomería hoy?', timestamp: Date.now() - 60000 },
    { id: '2', sender: 'user', text: 'Tengo un grifo que gotea en mi cocina.', timestamp: Date.now() - 30000 },
    { id: '3', sender: 'system', text: 'Este es un mensaje del sistema para demostración.', timestamp: Date.now() - 10000 },
  ]);
  const [inputValue, setInputValue] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isCheckingMessage, setIsCheckingMessage] = useState(false);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === '') return;

    setIsCheckingMessage(true);
    let guardResult: ChatGuardOutput | null = null;
    try {
      guardResult = await chatGuard({ message: inputValue });
    } catch (error) {
      console.error("Error del guardián de chat:", error);
      // Opcionalmente, mostrar un toast al usuario
    }
    setIsCheckingMessage(false);

    const newMessage: ChatMessageType = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue,
      timestamp: Date.now(),
      isSafe: guardResult?.isSafe,
      safetyReason: guardResult?.isSafe === false ? guardResult.reason : undefined,
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInputValue('');

    // Simular una respuesta del proveedor
    if (guardResult?.isSafe !== false) { // Solo responder si el mensaje es seguro
      setTimeout(() => {
        const providerResponse: ChatMessageType = {
          id: Date.now().toString() + '-provider',
          sender: 'provider',
          text: `De acuerdo, un grifo que gotea. ¿Puedes darme más detalles o enviar una foto?`,
          timestamp: Date.now(),
        };
        setMessages((prevMessages) => [...prevMessages, providerResponse]);
      }, 1500);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl flex flex-col h-[calc(100vh-10rem)] max-h-[700px]">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessageCircle className="text-primary" /> Chat con Proveedor
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow p-0">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input
            type="text"
            placeholder={isCheckingMessage ? "Verificando mensaje..." : "Escribe tu mensaje..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-grow"
            disabled={isCheckingMessage}
          />
          <Button type="submit" size="icon" disabled={!inputValue.trim() || isCheckingMessage}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Enviar mensaje</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
