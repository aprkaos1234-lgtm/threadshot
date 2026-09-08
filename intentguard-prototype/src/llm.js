'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const { CostLedger } = require('./cost');
const { estimateTokens } = require('./tokens');

/*
 * Thin wrapper over the Anthropic Messages API.
 *
 * Two things matter here beyond "call the model":
 *
 * 1. Every call is priced and attributed to a stage (spec §27). An experiment
 *    that can't say what it cost can't answer §30's question about whether the
 *    accuracy difference is worth the complexity.
 * 2. Structured output is enforced with output_config.format + a JSON schema,
 *    so the pipeline never parses prose (spec §15).
 */

const DEFAULT_MODEL = 'claude-opus-5';

class LLM {
  /**
   * @param {object} opts
   *   model      default model id
   *   ledger     CostLedger instance
   *   dryRun     when true, no API call is made; a stub is returned and the
   *              would-be token cost is still estimated. Used by `estimate`.
   */
  constructor(opts = {}) {
    this.model = opts.model || DEFAULT_MODEL;
    this.ledger = opts.ledger || new CostLedger(null);
    this.dryRun = !!opts.dryRun;
    this.verbose = opts.verbose !== false;
    this.client = this.dryRun ? null : new Anthropic();
  }

  static hasCredentials() {
    return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  }

  /**
   * One structured call. Returns { data, usage, raw }.
   *
   * @param {object} req
   *   stage      cost-ledger bucket, e.g. "classification"
   *   system     system prompt (string) — cached when large
   *   user       user message text
   *   schema     JSON schema the response must satisfy
   *   model      override
   *   effort     low|medium|high|xhigh|max
   *   maxTokens  output cap
   */
  async structured(req) {
    const model = req.model || this.model;
    const maxTokens = req.maxTokens || 16000;

    if (this.dryRun) {
      const inTok = estimateTokens((req.system || '') + (req.user || ''));
      const outTok = Math.min(maxTokens, Math.ceil(inTok * 0.4));
      this.ledger.record({
        model, stage: req.stage,
        usage: { input_tokens: inTok, output_tokens: outTok },
        meta: { dryRun: true },
      });
      return { data: null, usage: { input_tokens: inTok, output_tokens: outTok }, dryRun: true };
    }

    const system = req.system
      // Cache the (stable) instruction prefix; the per-call payload goes in the
      // user turn so the cache actually hits across a batch of calls.
      ? [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }]
      : undefined;

    const params = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: req.user }],
      thinking: { type: 'adaptive' },
      output_config: {
        effort: req.effort || 'high',
        format: { type: 'json_schema', schema: req.schema },
      },
    };
    if (system) params.system = system;

    const message = await this._withRetry(async () => {
      // Streaming keeps large max_tokens from tripping the HTTP timeout.
      const stream = await this.client.messages.stream(params);
      return stream.finalMessage();
    }, req.stage);

    if (message.stop_reason === 'refusal') {
      const d = message.stop_details || {};
      throw new Error(
        'Model declined this request (' + (d.category || 'unspecified') + '): ' +
        (d.explanation || '') + ' [stage=' + req.stage + ']');
    }

    this.ledger.record({ model, stage: req.stage, usage: message.usage || {} });

    const text = (message.content || [])
      .filter((b) => b.type === 'text').map((b) => b.text).join('');
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('structured output was not valid JSON at stage=' + req.stage +
        ' (stop_reason=' + message.stop_reason + '): ' + text.slice(0, 400));
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('stage=' + req.stage + ' hit max_tokens (' + maxTokens +
        '). Reduce the batch size or raise maxTokens — a truncated response ' +
        'would silently drop requirements.');
    }
    return { data, usage: message.usage, raw: message };
  }

  async _withRetry(fn, stage) {
    const MAX = 5;
    let delay = 2000;
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const retryable =
          err instanceof Anthropic.RateLimitError ||
          err instanceof Anthropic.APIConnectionError ||
          (err instanceof Anthropic.APIError && err.status >= 500);
        if (!retryable || attempt >= MAX) throw err;
        if (this.verbose) {
          process.stderr.write('  [' + stage + '] retry ' + attempt + '/' + (MAX - 1) +
            ' after ' + (delay / 1000) + 's — ' + (err.message || err) + '\n');
        }
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }
}

/** Split a list into batches whose estimated token size stays under a budget. */
function batchByTokens(items, textOf, maxTokensPerBatch, maxItemsPerBatch) {
  const batches = [];
  let cur = [];
  let curTokens = 0;
  for (const it of items) {
    const t = estimateTokens(textOf(it));
    if (cur.length && (curTokens + t > maxTokensPerBatch || cur.length >= maxItemsPerBatch)) {
      batches.push(cur); cur = []; curTokens = 0;
    }
    cur.push(it);
    curTokens += t;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

module.exports = { LLM, DEFAULT_MODEL, batchByTokens };
