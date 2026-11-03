import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import { getGeminiClient } from '../src/services/geminiConfig.js';
import {
  CoachProviderError,
  CoachResponseError,
  explainMove,
} from '../src/services/chessCoachService.js';

function sanitizeDiagnosticText(value) {
  if (typeof value !== 'string') return undefined;

  let sanitized = value;
  const secrets = Object.entries(process.env)
    .filter(([name, secret]) =>
      /(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/i.test(name) && secret?.trim())
    .map(([, secret]) => secret);
  for (const secret of secrets) {
    if (secret?.trim()) sanitized = sanitized.split(secret).join('[REDACTED]');
  }

  return sanitized
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED_API_KEY]')
    .replace(/\bAQ\.[0-9A-Za-z._-]{8,}\b/g, '[REDACTED_API_KEY]')
    .replace(/(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;"']+/gi, '$1[REDACTED]')
    .replace(/(x-goog-api-key\s*[:=]\s*)[^\s,;"']+/gi, '$1[REDACTED]')
    .replace(/\bprojects\/[A-Za-z0-9._:-]+\b/gi, 'projects/[REDACTED]')
    .replace(/\b(?:project(?:[_\s-]?(?:id|number))?|consumer(?:[_\s-]?id)?)\s*[:=]\s*["']?[A-Za-z0-9._:-]+["']?/gi, '[REDACTED_PROJECT]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_IDENTIFIER]')
    .slice(0, 1000);
}

function safeProviderDetails(details) {
  return details
    .slice(0, 5)
    .map(({ type, reason, domain, message }) => ({
      ...(type ? { type: sanitizeDiagnosticText(type) } : {}),
      ...(reason ? { reason: sanitizeDiagnosticText(reason) } : {}),
      ...(domain ? { domain: sanitizeDiagnosticText(domain) } : {}),
      ...(message ? { message: sanitizeDiagnosticText(message) } : {}),
    }));
}

try {
  if (!process.env.GEMINI_API_KEY) {
    console.log('Skipped Gemini integration: GEMINI_API_KEY is not configured.');
    process.exitCode = 0;
  } else {
    getGeminiClient();
    const requestedGameId = process.env.COACH_TEST_GAME_ID;
    const [rows] = await pool.query(
      `SELECT ga.game_id AS gameId, ga.id AS analysisId, ma.move_id AS moveId
       FROM game_analyses AS ga
       INNER JOIN move_analyses AS ma ON ma.analysis_id = ga.id
       WHERE ma.classification IN ('inaccuracy', 'mistake', 'blunder')
         AND (? IS NULL OR ga.game_id = ?)
       ORDER BY ga.completed_at DESC, ga.id DESC, ma.move_id ASC
       LIMIT 1`,
      [requestedGameId ?? null, requestedGameId ?? null],
    );
    assert.ok(rows.length > 0, 'A saved analysis with an explainable move is required.');

    const explanation = await explainMove({
      gameId: String(rows[0].gameId),
      analysisId: String(rows[0].analysisId),
      moveId: String(rows[0].moveId),
    });
    assert.deepEqual(
      Object.keys(explanation?.explanation ?? {}).sort(),
      [
        'headline',
        'whatHappened',
        'whyItWasProblematic',
        'betterIdea',
        'coachingTip',
        'roast',
      ].sort(),
    );
    assert.ok(['inaccuracy', 'mistake', 'blunder'].includes(explanation.classification));
    console.log(JSON.stringify({
      status: 'passed',
      engineMove: explanation.bestMove,
      classification: explanation.classification,
      explanation: explanation.explanation,
    }, null, 2));
  }
} catch (error) {
  console.error('Gemini integration failed. Check Gemini configuration, quota, and saved analysis data.');
  if (error instanceof CoachProviderError) {
    console.error(JSON.stringify({
      providerCategory: error.kind,
      ...(error.status ? { status: error.status } : {}),
      ...(error.providerErrorName
        ? { providerErrorName: sanitizeDiagnosticText(error.providerErrorName) }
        : {}),
      ...(error.providerCode !== null
        ? {
          providerCode: typeof error.providerCode === 'string'
            ? sanitizeDiagnosticText(error.providerCode)
            : error.providerCode,
        }
        : {}),
      ...(error.providerStatus
        ? { providerStatus: sanitizeDiagnosticText(error.providerStatus) }
        : {}),
      ...(error.providerMessage
        ? { providerMessage: sanitizeDiagnosticText(error.providerMessage) }
        : {}),
      ...(error.providerDetails?.length
        ? { providerDetails: safeProviderDetails(error.providerDetails) }
        : {}),
      ...(error.providerCauseCategory
        ? { providerCauseCategory: error.providerCauseCategory }
        : {}),
    }));
  } else if (error instanceof CoachResponseError) {
    console.error('Safe provider category: invalid structured response.');
  } else {
    const status = Number(error?.status ?? error?.statusCode);
    console.error(JSON.stringify({
      errorType: error?.name ?? 'UnknownError',
      ...(Number.isInteger(status) && status > 0 ? { status } : {}),
    }));
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
