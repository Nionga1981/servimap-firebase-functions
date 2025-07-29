// src/ai/flows/chat-guard.ts
// Disabled for static export - server actions not supported

// Mock exports for build compatibility
export type ChatGuardInput = {
  message: string;
};

export type ChatGuardOutput = {
  isSafe: boolean;
  reason: string;
};

export async function chatGuard(input: ChatGuardInput): Promise<ChatGuardOutput> {
  // Mock implementation for static export
  return {
    isSafe: true,
    reason: 'Chat guard disabled for static export'
  };
}

/*
// Original server-side implementation disabled
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Commented out server-side implementation for static export

// const ChatGuardInputSchema = z.object({
//   message: z.string().describe('The message to be checked for inappropriate content.'),
// });
// export type ChatGuardInput = z.infer<typeof ChatGuardInputSchema>;

// const ChatGuardOutputSchema = z.object({
//   isSafe: z.boolean().describe('Whether the message is safe or not.'),
//   reason: z.string().describe('The reason why the message is considered unsafe, if applicable.'),
// });
// export type ChatGuardOutput = z.infer<typeof ChatGuardOutputSchema>;

// export async function chatGuard(input: ChatGuardInput): Promise<ChatGuardOutput> {
//   return chatGuardFlow(input);
// }

// const prompt = ai.definePrompt({
//   name: 'chatGuardPrompt',
//   input: {schema: ChatGuardInputSchema},
//   output: {schema: ChatGuardOutputSchema},
//   prompt: `You are a chat guard AI agent that determines whether a message is safe or not. A safe message is one that does not contain any inappropriate content, such as hate speech, harassment, sexually explicit content, or dangerous content. If the message is not safe, you must provide a reason why.

// Message: {{{message}}}`,
//   config: {
//     safetySettings: [
//       {
//         category: 'HARM_CATEGORY_HATE_SPEECH',
//         threshold: 'BLOCK_MEDIUM_AND_ABOVE',
//       },
//       {
//         category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
//         threshold: 'BLOCK_MEDIUM_AND_ABOVE',
//       },
//       {
//         category: 'HARM_CATEGORY_HARASSMENT',
//         threshold: 'BLOCK_MEDIUM_AND_ABOVE',
//       },
//       {
//         category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
//         threshold: 'BLOCK_MEDIUM_AND_ABOVE',
//       },
//     ],
//   },
// });

// const chatGuardFlow = ai.defineFlow(
//   {
//     name: 'chatGuardFlow',
//     inputSchema: ChatGuardInputSchema,
//     outputSchema: ChatGuardOutputSchema,
//   },
//   async input => {
//     const {output} = await prompt(input);
//     return output!;
//   }
// );
*/
