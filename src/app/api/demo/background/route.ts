// POST localhost:3000/api/demo/blocking

import { inngest } from '@/inngest/client';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';


export async function POST(req: Request) {
  await inngest.send({
    name: "demo/generate",
    data: {},
  })

  return NextResponse.json({status: "started"});
}