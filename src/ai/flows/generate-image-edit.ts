// The directive tells the Next.js runtime that this code should only be executed on the server side.
'use server';

/**
 * @fileOverview AI flow for editing images based on a base image, element images, highlights, annotations, and an optional custom prompt.
 *
 * - `generateImageEdit` - The main function to trigger the image editing flow.
 * - `GenerateImageEditInput` - Input type for the `generateImageEdit` function.
 * - `GenerateImageEditOutput` - Output type for the `generateImageEdit` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define schemas for the input and output data
const GenerateImageEditInputSchema = z.object({
  baseImage: z
    .string()
    .describe(
      "The base image to edit, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  elementImage1: z
    .string()
    .nullable()
    .describe(
      "The first element image to use for editing, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  elementImage2: z
    .string()
    .nullable()
    .describe(
      "The second element image to use for editing, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  elementImage3: z
    .string()
    .nullable()
    .describe(
      "The third element image to use for editing, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  highlights: z.string().describe('JSON string containing highlight information.'),
  annotations: z.string().describe('JSON string containing annotation information.'),
  customPrompt: z.string().optional().describe('Optional custom prompt to influence the image editing process.'),
});

const GenerateImageEditOutputSchema = z.object({
  editedImage: z.string().describe('The edited image as a data URI.'),
});

export type GenerateImageEditInput = z.infer<typeof GenerateImageEditInputSchema>;
export type GenerateImageEditOutput = z.infer<typeof GenerateImageEditOutputSchema>;

// Exported function to trigger the flow
export async function generateImageEdit(input: GenerateImageEditInput): Promise<GenerateImageEditOutput> {
  return generateImageEditFlow(input);
}

// Define the prompt
const imageEditPrompt = ai.definePrompt({
  name: 'imageEditPrompt',
  model: 'gemini-2.5-flash',
  input: {schema: GenerateImageEditInputSchema},
  output: {schema: GenerateImageEditOutputSchema},
  prompt: `You are an AI image editor. You will take a base image, and edit it based on highlights, annotations, and element images if provided. You will always return a data URL representing the final edited image.

Base Image: {{media url=baseImage}}

Highlights: {{{highlights}}}
Annotations: {{{annotations}}}

Element Image 1: {{#if elementImage1}}{{media url=elementImage1}}{{/if}}
Element Image 2: {{#if elementImage2}}{{media url=elementImage2}}{{/if}}
Element Image 3: {{#if elementImage3}}{{media url=elementImage3}}{{/if}}

{{#if customPrompt}}
Custom Prompt: {{{customPrompt}}}
{{/if}}
`,
});

// Define the flow
const generateImageEditFlow = ai.defineFlow(
  {
    name: 'generateImageEditFlow',
    inputSchema: GenerateImageEditInputSchema,
    outputSchema: GenerateImageEditOutputSchema,
  },
  async input => {
    const promptInput: any = {
      baseImage: input.baseImage,
      highlights: input.highlights,
      annotations: input.annotations,
    };

    if (input.elementImage1) {
      promptInput.elementImage1 = input.elementImage1;
    }
    if (input.elementImage2) {
      promptInput.elementImage2 = input.elementImage2;
    }
    if (input.elementImage3) {
      promptInput.elementImage3 = input.elementImage3;
    }

    if (input.customPrompt) {
      promptInput.customPrompt = input.customPrompt;
    }

    const {media} = await imageEditPrompt(promptInput);

    if (!media) {
      throw new Error('No edited image was generated.');
    }

    return {editedImage: media.url!};
  }
);
