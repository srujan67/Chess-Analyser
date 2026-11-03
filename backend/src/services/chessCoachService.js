import { getGameById } from './gameService.js';
import { getMoveAnalysisContext } from './gameAnalysisRepository.js';
import { reconstructGamePositions } from './positionReconstruction.js';
import {
  getGeminiClient,
  getGeminiModel,
  GEMINI_MAX_OUTPUT_TOKENS,
} from './geminiConfig.js';
import {
  buildCoachInput,
  COACH_PERSONALITY_INSTRUCTIONS,
  COACH_RESPONSE_SCHEMA,
  validateCoachResponse,
} from './chessCoachPrompt.js';

const EXPLAINABLE_CLASSIFICATIONS = new Set(['inaccuracy', 'mistake', 'blunder']);

export class UnsupportedMoveClassificationError extends Error {
  constructor() {
    super('Only inaccuracies, mistakes, and blunders can be explained.');
    this.name = 'UnsupportedMoveClassificationError';
  }
}

export class CoachProviderError extends Error {
  constructor(
    kind = 'provider',
    {
      status = null,
      providerErrorName = null,
      providerCauseCategory = null,
      providerCode = null,
      providerStatus = null,
      providerMessage = null,
      providerDetails = [],
    } = {},
  ) {
    super('The chess coach provider could not complete the request.');
    this.name = 'CoachProviderError';
    this.kind = kind;
    this.status = status;
    this.providerErrorName = providerErrorName;
    this.providerCauseCategory = providerCauseCategory;
    this.providerCode = providerCode;
    this.providerStatus = providerStatus;
    this.providerMessage = providerMessage;
    this.providerDetails = providerDetails;
  }
}

export class CoachResponseError extends Error {
  constructor() {
    super('The chess coach returned an invalid response.');
    this.name = 'CoachResponseError';
  }
}

function parseProviderError(error) {
  if (error?.name === 'GeminiConfigurationError') throw error;

  const status = Number(error?.status ?? error?.statusCode ?? error?.code);
  const providerCauseCategory = classifyProviderCause(error?.message);
  const providerError = getProviderErrorPayload(error);
  const providerDetails = Array.isArray(providerError?.details)
    ? providerError.details.map((detail) => ({
      type: typeof detail?.['@type'] === 'string' ? detail['@type'] : null,
      reason: typeof detail?.reason === 'string'
        ? detail.reason
        : typeof detail?.metadata?.reason === 'string'
          ? detail.metadata.reason
          : null,
      domain: typeof detail?.domain === 'string' ? detail.domain : null,
      message: typeof detail?.message === 'string' ? detail.message : null,
    }))
    : [];
  const providerDiagnostics = {
    providerCode: providerError?.code ?? (typeof error?.code === 'string' ? error.code : null),
    providerStatus: typeof providerError?.status === 'string' ? providerError.status : null,
    providerMessage: typeof providerError?.message === 'string'
      ? providerError.message
      : typeof error?.message === 'string'
        ? error.message
        : null,
    providerDetails,
  };
  if (
    status === 408 ||
    status === 504 ||
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError'
  ) {
    throw new CoachProviderError('timeout', {
      status,
      providerErrorName: error?.name,
      providerCauseCategory,
      ...providerDiagnostics,
    });
  }
  if (status === 429 || error?.name === 'ResourceExhausted') {
    throw new CoachProviderError('quota', {
      status,
      providerErrorName: error?.name,
      providerCauseCategory,
      ...providerDiagnostics,
    });
  }
  throw new CoachProviderError('provider', {
    status,
    providerErrorName: error?.name,
    providerCauseCategory,
    ...providerDiagnostics,
  });
}

function classifyProviderCause(message) {
  if (typeof message !== 'string') return 'unclassified';
  if (/free tier is not available for this project|project unavailable|set up billing/i.test(message)) {
    return 'project_billing';
  }
  if (/api_key_invalid|api key not valid|invalid api key/i.test(message)) {
    return 'invalid_api_key';
  }
  if (/permission_denied|not enabled for|has not been used/i.test(message)) {
    return 'provider_access';
  }
  if (/unknown name|cannot find field|unrecognized field/i.test(message)) {
    return 'unsupported_request_field';
  }
  if (/invalid argument|invalid value/i.test(message)) {
    return 'invalid_request_value';
  }
  if (/api.?key|permission|authentication|forbidden/i.test(message)) return 'authentication';
  if (/response.?format|schema|json schema/i.test(message)) return 'structured_output';
  if (/generation.?config|max.?output.?tokens/i.test(message)) return 'generation_config';
  if (/model.{0,40}(invalid|unsupported|not found|not available)/i.test(message)) return 'model';
  if (/interaction|invalid request|request body/i.test(message)) return 'request';
  return 'unclassified';
}

function getProviderErrorPayload(error) {
  if (error?.error && typeof error.error === 'object') {
    return error.error.error && typeof error.error.error === 'object'
      ? error.error.error
      : error.error;
  }
  if (typeof error?.body === 'string') {
    try {
      const body = JSON.parse(error.body);
      return body?.error && typeof body.error === 'object' ? body.error : body;
    } catch {
      return {};
    }
  }
  return {};
}

function asFiniteNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new CoachResponseError();
  }
  return number;
}

function buildEvidence(context, game) {
  const reconstructed = reconstructGamePositions(game);
  const move = reconstructed.moves.find(
    (candidate) => String(candidate.moveId) === String(context.moveId),
  );
  if (
    !move ||
    move.plyNumber !== Number(context.plyNumber) ||
    move.san !== context.playedSan
  ) {
    throw new CoachResponseError();
  }

  const engineMetadata = context.engineMetadata ?? {};
  const beforeMetadata = engineMetadata.before ?? {};
  const afterMetadata = engineMetadata.after ?? {};
  const principalVariation = context.principalVariation;
  if (
    !Array.isArray(principalVariation) ||
    principalVariation.some((token) => typeof token !== 'string')
  ) {
    throw new CoachResponseError();
  }

  return {
    playerColor: move.sideToMove === 'w' ? 'White' : 'Black',
    moveNumber: Math.ceil(move.plyNumber / 2),
    playedSan: move.san,
    positionBeforeFen: move.fenBefore,
    bestMoveUci: context.bestMove,
    bestMoveSan: context.bestMoveSan,
    evaluationBefore: {
      value: asFiniteNumber(context.evaluationBefore),
      type: context.evaluationBeforeType,
      perspective: 'White',
      searchDepth: beforeMetadata.depth ?? context.searchDepth,
    },
    evaluationAfter: {
      value: asFiniteNumber(context.evaluationAfter),
      type: context.evaluationAfterType,
      perspective: 'White',
      searchDepth: afterMetadata.depth ?? context.searchDepth,
    },
    centipawnLoss: context.centipawnLoss === null
      ? null
      : asFiniteNumber(context.centipawnLoss),
    classification: context.classification,
    principalVariation,
  };
}

function authoritativeEngineFacts(context, evidence) {
  return {
    playerColor: evidence.playerColor,
    moveNumber: evidence.moveNumber,
    playedSan: evidence.playedSan,
    bestMove: context.bestMove,
    bestMoveSan: context.bestMoveSan,
    classification: context.classification,
    centipawnLoss: evidence.centipawnLoss,
    evaluationBefore: evidence.evaluationBefore,
    evaluationAfter: evidence.evaluationAfter,
    principalVariation: evidence.principalVariation,
    engineVersion: context.engineVersion,
    searchDepth: context.searchDepth,
  };
}

export function createChessCoachService({
  database,
  moveContextLoader = getMoveAnalysisContext,
  gameLoader = getGameById,
  geminiClientProvider = getGeminiClient,
  modelProvider = getGeminiModel,
} = {}) {
  return {
    async explainMove({ gameId, analysisId, moveId }) {
      const context = await moveContextLoader(
        { gameId, analysisId, moveId },
        database,
      );
      if (!context) return null;
      if (!EXPLAINABLE_CLASSIFICATIONS.has(context.classification)) {
        throw new UnsupportedMoveClassificationError();
      }

      const game = await gameLoader(gameId, database);
      if (!game) return null;

      const evidence = buildEvidence(context, game);
      const input = buildCoachInput(evidence);
      const client = geminiClientProvider();
      let interaction;
      try {
        interaction = await client.interactions.create({
          model: modelProvider(),
          input: `${COACH_PERSONALITY_INSTRUCTIONS}\n\n${input}`,
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: COACH_RESPONSE_SCHEMA,
          },
          generation_config: {
            max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS,
          },
        });
      } catch (error) {
        parseProviderError(error);
      }

      if (interaction?.status !== 'completed' || typeof interaction.output_text !== 'string') {
        throw new CoachResponseError();
      }

      let generated;
      try {
        generated = JSON.parse(interaction.output_text);
        generated = validateCoachResponse(generated);
      } catch {
        throw new CoachResponseError();
      }

      return {
        ...authoritativeEngineFacts(context, evidence),
        explanation: generated,
      };
    },
  };
}

const chessCoachService = createChessCoachService();
export const explainMove = chessCoachService.explainMove;
