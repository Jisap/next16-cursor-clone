// POST localhost:3000/api/demo/blocking

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

export async function POST(req: Request) {
  const response = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: 'Write a vegetarian lasagna recipe for 4 people.',
    experimental_telemetry: {
      isEnabled: true,
      recordInputs: true,
      recordOutputs: true,
    }
  });

  return NextResponse.json(response);
}