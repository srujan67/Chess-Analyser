import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, '../../.env') });
dotenv.config();

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_TIMEOUT_MS = 20000;
export const GEMINI_MAX_OUTPUT_TOKENS = 700;

export class GeminiConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeminiConfigurationError';
  }
}

let client;

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new GeminiConfigurationError('GEMINI_API_KEY is not configured.');
  }

  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: GEMINI_TIMEOUT_MS,
        retryOptions: { attempts: 0 },
      },
    });
  }
  return client;
}
