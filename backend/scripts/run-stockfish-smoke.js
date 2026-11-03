import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StockfishService } from '../src/services/stockfishService.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDirectory, '../.env') });

const stockfish = new StockfishService();

try {
  await stockfish.start();
  console.log('Stockfish UCI initialisation succeeded.');

  const analysis = await stockfish.analyzePosition({
    moves: ['e2e4', 'e7e5'],
    depth: 10,
  });
  console.log('Analysis result:', JSON.stringify(analysis, null, 2));
} catch (error) {
  console.error('Stockfish test failed:', error.message);
  process.exitCode = 1;
} finally {
  try {
    const exit = await stockfish.close();
    console.log(`Stockfish exited cleanly (code ${exit?.code ?? 'unknown'}).`);
  } catch (error) {
    console.error('Stockfish shutdown failed:', error.message);
    process.exitCode = 1;
  }
}
