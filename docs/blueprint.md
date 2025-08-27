# **App Name**: Magic Markup

## Core Features:

- Image Upload: Upload a base image and add up to 3 additional "element" images which are referenced by number (default) or name (user customizable).
- Image Highlighting: Highlight portions of uploaded images, using a selection of 4 colors.
- Image Annotation: Annotate images with text using a 'marker' style font in the same 4 colors as highlighting.
- Selection Refinement: Allow for selecting, deleting, and undo/redo for highlights and annotations.
- Prompt Input: Allows the user to provide an optional custom prompt, and intelligently includes that prompt as a tool during image processing and generation
- AI Image Editing: Use the gemini-2.5-flash-image-preview model to edit the images based on highlights, annotations and prompts.
- Image Output & Sharing: Displays the generated image to the user, and allows users to choose to save or copy the final result.
- Copy to clipboard: Raw image of final output can be copied to clipboard

## Style Guidelines:

- Primary color: A subdued violet (#9467A5) which is bold, yet recedes, allowing full attention to the visual content
- Background color: An even more subdued, near-neutral violet at low saturation (#E9E5EB)
- Accent color: A strong pink (#D35898) for clear visual contrast
- Body and headline font: 'Inter', a neutral sans-serif suited for both headlines and body text
- Code font: 'Source Code Pro' for annotations, special input fields and instructions
- Simple, clear icons to represent image editing functions.
- Subtle transitions and animations to provide feedback during image processing.