import { spawn as spawnProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

export class StockfishTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StockfishTimeoutError';
  }
}

export class StockfishProcessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StockfishProcessError';
  }
}

function extractEvaluation(lines) {
  let latestEvaluation = null;

  for (const line of lines) {
    const depth = line.match(/(?:^|\s)depth\s+(\d+)/);
    const score = line.match(/(?:^|\s)score\s+(cp|mate)\s+(-?\d+)/);
    const multipv = line.match(/(?:^|\s)multipv\s+(\d+)/);
    if (!depth || !score || (multipv && Number(multipv[1]) !== 1)) continue;

    const evaluation = {
      depth: Number(depth[1]),
      score: {
        type: score[1] === 'cp' ? 'centipawns' : 'mate',
        value: Number(score[2]),
      },
    };

    const numericFields = {
      seldepth: /(?:^|\s)seldepth\s+(\d+)/,
      nodes: /(?:^|\s)nodes\s+(\d+)/,
      nps: /(?:^|\s)nps\s+(\d+)/,
      time: /(?:^|\s)time\s+(\d+)/,
    };
    for (const [field, pattern] of Object.entries(numericFields)) {
      const value = line.match(pattern);
      if (value) evaluation[field] = Number(value[1]);
    }

    const pv = line.match(/(?:^|\s)pv\s+(.+)$/);
    if (pv) evaluation.principalVariation = pv[1].trim().split(/\s+/);

    if (!latestEvaluation || evaluation.depth >= latestEvaluation.depth) {
      latestEvaluation = evaluation;
    }
  }

  return latestEvaluation;
}

/**
 * Manages one Stockfish process using its Universal Chess Interface (UCI).
 */
export class StockfishService {
  constructor({
    executablePath = process.env.STOCKFISH_PATH,
    commandTimeoutMs = 10000,
    analysisTimeoutMs = 30000,
    spawn = spawnProcess,
  } = {}) {
    if (typeof executablePath !== 'string' || executablePath.trim() === '') {
      throw new Error('STOCKFISH_PATH must point to the Stockfish executable.');
    }
    if (!Number.isInteger(commandTimeoutMs) || commandTimeoutMs < 1) {
      throw new Error('commandTimeoutMs must be a positive integer.');
    }
    if (!Number.isInteger(analysisTimeoutMs) || analysisTimeoutMs < 1) {
      throw new Error('analysisTimeoutMs must be a positive integer.');
    }

    this.executablePath = executablePath;
    this.commandTimeoutMs = commandTimeoutMs;
    this.analysisTimeoutMs = analysisTimeoutMs;
    this.spawnProcess = spawn;
    this.process = null;
    this.state = 'stopped';
    this.startPromise = null;
    this.waiters = [];
    this.lineBuffer = [];
    this.analysisLines = null;
    this.engineVersion = null;
    this.exitPromise = null;
    this.resolveExit = null;
    this.exitResult = null;
    this.analysisQueue = Promise.resolve();
    this.shutdownRequested = false;
    this.closePromise = null;
  }

  async start() {
    if (this.state === 'ready') return;
    if (this.startPromise) return this.startPromise;
    if (this.state !== 'stopped') {
      throw new Error(`Stockfish cannot start while in state "${this.state}".`);
    }

    this.state = 'starting';
    this.startPromise = this.initialize();
    return this.startPromise;
  }

  async initialize() {
    try {
      this.process = this.spawnProcess(this.executablePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.exitPromise = new Promise((resolve) => {
        this.resolveExit = resolve;
      });

      const stdout = createInterface({ input: this.process.stdout });
      stdout.on('line', (line) => this.handleLine(line.trim()));
      this.process.on('error', (error) => {
        this.state = 'failed';
        this.rejectWaiters(new StockfishProcessError(
          `Stockfish process error: ${error.message}`,
        ));
      });
      this.process.on('close', (code, signal) => {
        this.exitResult = { code, signal };
        this.state = this.state === 'closing' ? 'stopped' : 'failed';
        this.rejectWaiters(
          new StockfishProcessError(
            `Stockfish exited unexpectedly (code ${code ?? 'unknown'}).`,
          ),
        );
        this.resolveExit(this.exitResult);
      });

      const uciReady = this.waitForLine(
        (line) => line === 'uciok',
        this.commandTimeoutMs,
        'uciok',
      );
      this.writeCommand('uci');
      await uciReady;

      const ready = this.waitForLine(
        (line) => line === 'readyok',
        this.commandTimeoutMs,
        'readyok',
      );
      this.writeCommand('isready');
      await ready;
      this.state = 'ready';
    } catch (error) {
      this.state = 'failed';
      if (this.process && !this.exitResult) {
        this.process.kill('SIGTERM');
      }
      throw error;
    }
  }

  analyzePosition({
    fen,
    moves = [],
    depth = 10,
    timeoutMs = this.analysisTimeoutMs,
  } = {}) {
    if (this.shutdownRequested) {
      return Promise.reject(new Error('Stockfish is shutting down.'));
    }
    if (fen !== undefined && (typeof fen !== 'string' || fen.trim() === '')) {
      return Promise.reject(new Error('FEN must be a non-empty string.'));
    }
    if (
      !Array.isArray(moves) ||
      moves.some((move) => typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(move))
    ) {
      return Promise.reject(new Error('Moves must be valid UCI move strings.'));
    }
    if (!Number.isInteger(depth) || depth < 1 || depth > 99) {
      return Promise.reject(new Error('Analysis depth must be an integer from 1 to 99.'));
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
      return Promise.reject(new Error('timeoutMs must be a positive integer.'));
    }

    const queuedAnalysis = this.analysisQueue.then(() =>
      this.runAnalysis({ fen, moves, depth, timeoutMs }),
    );
    this.analysisQueue = queuedAnalysis.catch(() => {});
    return queuedAnalysis;
  }

  async runAnalysis({ fen, moves, depth, timeoutMs }) {
    await this.start();
    if (this.state !== 'ready') {
      throw new StockfishProcessError('Stockfish is not available for analysis.');
    }

    this.analysisLines = [];
    const position = fen
      ? `position fen ${fen}`
      : moves.length > 0
        ? `position startpos moves ${moves.join(' ')}`
        : 'position startpos';
    const bestMoveWait = this.waitForLine(
      (line) => line.startsWith('bestmove '),
      timeoutMs,
      'bestmove',
    );

    try {
      this.writeCommand(position);
      this.writeCommand(`go depth ${depth}`);

      let bestMoveLine;
      try {
        bestMoveLine = await bestMoveWait;
      } catch (error) {
        if (!(error instanceof StockfishTimeoutError)) throw error;

        this.writeCommand('stop');
        try {
          await this.waitForLine(
            (line) => line.startsWith('bestmove '),
            2000,
            'bestmove after stop',
          );
        } catch (stopError) {
          if (!(stopError instanceof StockfishTimeoutError)) throw stopError;
          this.state = 'failed';
          await this.terminateProcess();
        }
        throw error;
      }

      const bestMove = bestMoveLine.match(/^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/);
      if (!bestMove) {
        throw new Error(`Could not parse Stockfish response: ${bestMoveLine}`);
      }

      const result = {
        bestMove: bestMove[1],
        evaluation: extractEvaluation(this.analysisLines),
      };
      if (bestMove[2]) result.ponder = bestMove[2];
      return result;
    } finally {
      this.analysisLines = null;
    }
  }

  close() {
    if (this.closePromise) return this.closePromise;
    this.shutdownRequested = true;
    this.closePromise = this.closeAfterQueuedAnalyses();
    return this.closePromise;
  }

  async closeAfterQueuedAnalyses() {
    await this.analysisQueue;
    if (!this.process || this.exitResult) return this.exitResult;
    if (this.state !== 'closing') this.state = 'closing';

    if (this.process.stdin.writable) {
      this.process.stdin.write('quit\n');
    }

    try {
      return await this.waitForExit(this.commandTimeoutMs);
    } catch (error) {
      if (!(error instanceof StockfishTimeoutError)) throw error;
      return this.terminateProcess();
    }
  }

  async terminateProcess() {
    if (!this.process || this.exitResult) return this.exitResult;
    this.process.kill('SIGTERM');
    try {
      return await this.waitForExit(2000);
    } catch (signalError) {
      if (!(signalError instanceof StockfishTimeoutError)) throw signalError;
      this.process.kill('SIGKILL');
      return this.waitForExit(2000);
    }
  }

  getEngineVersion() {
    return this.engineVersion;
  }

  handleLine(line) {
    if (!line) return;
    if (line.startsWith('id name ')) {
      this.engineVersion = line.slice('id name '.length).trim();
    }
    if (this.analysisLines && line.startsWith('info ')) {
      this.analysisLines.push(line);
    }

    const waiterIndex = this.waiters.findIndex((waiter) => waiter.matches(line));
    if (waiterIndex >= 0) {
      const [waiter] = this.waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(line);
      return;
    }

    this.lineBuffer.push(line);
    if (this.lineBuffer.length > 100) this.lineBuffer.shift();
  }

  waitForLine(matches, timeoutMs, description) {
    const bufferedIndex = this.lineBuffer.findIndex(matches);
    if (bufferedIndex >= 0) {
      return Promise.resolve(this.lineBuffer.splice(bufferedIndex, 1)[0]);
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        matches,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
          reject(new StockfishTimeoutError(
            `Timed out after ${timeoutMs}ms waiting for Stockfish ${description}.`,
          ));
        }, timeoutMs),
      };
      waiter.timer.unref?.();
      this.waiters.push(waiter);
    });
  }

  waitForExit(timeoutMs) {
    if (this.exitResult) return Promise.resolve(this.exitResult);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new StockfishTimeoutError(
          `Timed out after ${timeoutMs}ms waiting for Stockfish to exit.`,
        ));
      }, timeoutMs);
      timer.unref?.();

      this.exitPromise.then((result) => {
        clearTimeout(timer);
        resolve(result);
      });
    });
  }

  writeCommand(command) {
    if (!this.process?.stdin?.writable) {
      throw new Error('Stockfish stdin is not available.');
    }
    this.process.stdin.write(`${command}\n`);
  }

  rejectWaiters(error) {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.waiters = [];
  }
}

let sharedStockfishService;

export function getStockfishService() {
  if (!sharedStockfishService) {
    sharedStockfishService = new StockfishService();
  }
  return sharedStockfishService;
}

export async function closeStockfishService() {
  if (!sharedStockfishService) return null;
  const service = sharedStockfishService;
  sharedStockfishService = undefined;
  return service.close();
}

export default StockfishService;
