'use server';

/**
 * @fileOverview This flow generates an initial image based on a simple prompt.
 *
 * - initialImageEdit - A function that handles the initial image generation process.
 * - InitialImageEditInput - The input type for the initialImageEdit function.
 * - InitialImageEditOutput - The return type for the initialImageEdit function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import wav from 'wav';

const InitialImageEditInputSchema = z.object({
  prompt: z.string().describe('A text prompt to generate an initial image.'),
});
export type InitialImageEditInput = z.infer<typeof InitialImageEditInputSchema>;

const InitialImageEditOutputSchema = z.object({
  image: z.string().describe('The generated image as a data URI.'),
});
export type InitialImageEditOutput = z.infer<typeof InitialImageEditOutputSchema>;

export async function initialImageEdit(input: InitialImageEditInput): Promise<InitialImageEditOutput> {
  return initialImageEditFlow(input);
}

const initialImageEditFlow = ai.defineFlow(
  {
    name: 'initialImageEditFlow',
    inputSchema: InitialImageEditInputSchema,
    outputSchema: InitialImageEditOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: input.prompt,
    });

    if (!media) {
      throw new Error('No image was generated.');
    }

    return {image: media.url!};
  }
);
