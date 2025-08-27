// The directive tells the Next.js runtime that this code should only be executed on the server side.
'use server';

/**
 * @fileOverview AI flow for editing images based on a base image, an annotated image, and element images.
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
  annotatedImage: z
    .string()
    .optional()
    .describe(
      "The annotated image (base image with highlights and text), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  elementImages: z
    .array(z.object({name: z.string(), url: z.string()}))
    .max(3)
    .optional()
    .describe(
      "up to three 'element' images that might be incorporated into the edit"
    ),
  customPrompt: z.string().optional().describe('Optional custom prompt to influence the image editing process.'),
});

const GenerateImageEditOutputSchema = z.object({
  editedImage: z.string().describe('The edited image as a data URI.'),
});

export type GenerateImageEditInput = z.infer<typeof GenerateImageEditInputSchema>;
export type GenerateImageEditOutput = z.infer<typeof GenerateImageEditOutputSchema>;

// Exported function to trigger the flow
export async function generateImageEdit(apiKey: string, input: GenerateImageEditInput): Promise<GenerateImageEditOutput> {
  return generateImageEditFlow(input, {context: {apiKey}});
}

// Define the prompt
const imageEditPrompt = ai.definePrompt({
  name: 'imageEditPrompt',
  model: 'googleai/gemini-2.5-flash-image-preview',
  config: {responseModalities: ['TEXT', 'IMAGE']},
  input: {schema: GenerateImageEditInputSchema},
  prompt: `You are an AI image editor. You will take a base image, and edit it based on an annotated version of the image which includes highlights and text. You may also be provided with element images. You will always return a data URL representing the final edited image.

  Try to keep photorealistic scene consistency - when adding or changing parts of the picture, always match the lighting and make it look seamless and photorealistic.

Base Image: {{media url=baseImage}}
{{#if annotatedImage}}
=== Annotations

The user has provided annotations to the image using simple highlighter and text tools. These annotations may circle, highlight, or otherwise mark edits for the original image. DO NOT keep any of the annotations directly, but use them to guide your final output.

Annotated Image: {{media url=annotatedImage}}
{{/if}}

{{#if elementImages.length}}
=== Element Images

The user has provided additional "element" images that might be referenced in the prompt or annotations.
{{#each elementImages}}
{{{this.name}}}: {{media url=this.url}}
{{/each}}
{{/if}}

{{#if customPrompt}}
=== Custom Prompt

The user has provided an additional custom prompt to guide the image edit:

{{{customPrompt}}}
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
  async (input, {context}) => {
    if (!context?.apiKey) throw new Error("Must supply an API key.");

    if (!input.annotatedImage && !input.customPrompt) {
      throw new Error('Please provide either an annotated image or a custom prompt.');
    }
    
    const {media} = await imageEditPrompt(input, {config: {apiKey: context.apiKey}});

    return {editedImage: media?.url || ''};
  }
);
