import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, it } from 'node:test';
import {
  StockfishService,
  StockfishTimeoutError,
} from './stockfishService.js';

class FakeStockfishProcess extends EventEmitter {
  constructor({ respondToGo = true, respondToStop = true } = {}) {
    super();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.stdin = {
      writable: true,
      write: (command) => this.handleCommand(command.trim()),
    };
    this.commands = [];
    this.respondToGo = respondToGo;
    this.respondToStop = respondToStop;
    this.killedSignals = [];
    this.activeSearches = 0;
    this.maxActiveSearches = 0;
  }

  handleCommand(command) {
    this.commands.push(command);
    if (command === 'uci') {
      setImmediate(() => this.stdout.write('uciok\n'));
    } else if (command === 'isready') {
      setImmediate(() => this.stdout.write('readyok\n'));
    } else if (command.startsWith('go depth ')) {
      this.activeSearches += 1;
      this.maxActiveSearches = Math.max(this.maxActiveSearches, this.activeSearches);
    } else if (command === 'stop') {
      if (this.respondToStop) {
        setImmediate(() => this.stdout.write('bestmove e2e4\n'));
      }
    }

    if (command.startsWith('go depth ') && this.respondToGo) {
      setTimeout(() => {
        this.stdout.write(
          'info depth 10 seldepth 12 score cp 23 nodes 100 nps 500 pv e2e4 e7e5\n',
        );
        this.stdout.write('bestmove e2e4 ponder e7e5\n');
        this.activeSearches -= 1;
      }, 10);
    } else if (command === 'quit') {
      setImmediate(() => this.emit('close', 0, null));
    }
  }

  kill(signal) {
    this.killedSignals.push(signal);
    setImmediate(() => this.emit('close', 0, null));
  }
}

describe('StockfishService', () => {
  it('serializes concurrent FEN analyses through one process', async () => {
    const child = new FakeStockfishProcess();
    const service = new StockfishService({
      executablePath: '/fake/stockfish',
      spawn: () => child,
      commandTimeoutMs: 1000,
      analysisTimeoutMs: 1000,
    });
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const results = await Promise.all([
      service.analyzePosition({ fen, depth: 10 }),
      service.analyzePosition({ fen, depth: 11 }),
    ]);

    assert.equal(results.length, 2);
    assert.deepEqual(results.map((result) => result.bestMove), ['e2e4', 'e2e4']);
    assert.equal(child.maxActiveSearches, 1);
    assert.equal(
      child.commands.filter((command) => command.startsWith('position fen ')).length,
      2,
    );
    assert.equal(await service.close().then((result) => result.code), 0);
  });

  it('stops a timed-out search before allowing the queue to continue', async () => {
    const child = new FakeStockfishProcess({ respondToGo: false });
    const service = new StockfishService({
      executablePath: '/fake/stockfish',
      spawn: () => child,
      commandTimeoutMs: 1000,
      analysisTimeoutMs: 20,
    });

    await assert.rejects(
      service.analyzePosition({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        depth: 10,
      }),
      StockfishTimeoutError,
    );
    assert.ok(child.commands.includes('stop'));
    assert.equal(service.state, 'ready');
    assert.equal(await service.close().then((result) => result.code), 0);
  });

  it('terminates the process when a timed-out search ignores stop', async () => {
    const child = new FakeStockfishProcess({
      respondToGo: false,
      respondToStop: false,
    });
    const service = new StockfishService({
      executablePath: '/fake/stockfish',
      spawn: () => child,
      commandTimeoutMs: 1000,
      analysisTimeoutMs: 20,
    });

    await assert.rejects(
      service.analyzePosition({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        depth: 10,
      }),
      StockfishTimeoutError,
    );
    assert.deepEqual(child.killedSignals, ['SIGTERM']);
    assert.deepEqual(service.exitResult, { code: 0, signal: null });
  });
});
