import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI({apiKey: false})],
  model: 'googleai/gemini-2.5-flash',
});
