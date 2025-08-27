# Magic Markup: AI-Powered Image Editor

Magic Markup is an open-source, AI-powered image editing application that demonstrates how to build a rich, interactive user experience around generative AI. Users can upload a base image, draw highlights, add text annotations, and provide a natural language prompt to guide the AI in generating a new version of the image.

This project is built with a modern web stack, including **Next.js**, **React**, **TypeScript**, and **Tailwind CSS**. Its core AI functionality is powered by **Google's Genkit** and the **Gemini family of models**.

## Key Features

- **In-Canvas Annotations**: Directly draw highlights and type text onto the base image to specify areas for editing.
- **Prompt-Based Generation**: Use natural language prompts to describe the desired changes.
- **Element Composition**: Upload up to three additional "element" images that can be referenced in your prompt and incorporated into the final result.
- **Client-Side History**: Session history is stored in the browser's local storage, so you can refresh the page and resume your work.
- **"Keep Editing" Workflow**: Use a generated image as the new base image for further edits, allowing for iterative creation.
- **Secure API Key Storage**: Your Google AI API key is stored securely on your device in local storage.

## Getting Started

To run Magic Markup locally, you'll need Node.js and npm installed.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mbleigh/magic-markup.git
    cd magic-markup
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Get a Google AI API Key:**
    -   Visit [Google AI Studio](https://ai.studio/apikey) to create an API key.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will start the Next.js application on `http://localhost:9002`.

5.  **Set Your API Key:**
    -   Open the app in your browser.
    -   Click the key icon in the top-right corner and paste your Google AI API key.

You're now ready to start editing images!

## Code Structure

The project is organized into several key directories within the `src/` folder:

-   `src/app/`: The main Next.js application routes and pages.
-   `src/components/`: Contains all React components, broken down into UI elements (`ui/`) and feature-specific components.
-   `src/hooks/`: Home to the powerful `useMagicMarkup.ts` custom hook, which encapsulates the majority of the application's client-side logic.
-   `src/lib/`: Utility functions, type definitions, and canvas helpers.
-   `src/ai/`: The heart of the generative AI functionality, containing all Genkit-related code.

### The Genkit AI Flow

The core AI logic resides in `src/ai/flows/generate-image-edit.ts`. This file defines a Genkit "flow," which is a server-side function that orchestrates the call to the AI model.

Here's how it works:

1.  **`generateImageEdit` Function**: This is the main exported function that the client-side code calls. It acts as the entry point to the Genkit flow.
2.  **Zod Schemas**: The flow uses `zod` to define strong schemas for its input (`GenerateImageEditInputSchema`) and output (`GenerateImageEditOutputSchema`). This ensures type safety and provides a clear contract between the client and the AI backend.
3.  **`ai.definePrompt`**: This Genkit function creates a reusable, strongly-typed prompt template. It defines which model to use (`gemini-2.5-flash-image-preview`) and constructs the prompt sent to the Gemini model, dynamically including the base image, annotated image, element images, and custom text prompt using Handlebars syntax (`{{media url=...}}`).
4.  **`ai.defineFlow`**: This function wraps the prompt and the core logic into a `flow`. It takes the client's input, calls the `imageEditPrompt`, and processes the response. It's responsible for handling the API key and ensuring all required inputs are present before calling the model.

By encapsulating the AI logic in a Genkit flow, we cleanly separate the server-side AI processing from the client-side UI, making the application more organized, scalable, and maintainable.
