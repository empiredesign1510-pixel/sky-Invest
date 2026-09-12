import agent_feedHandler from '../server/agent-feed.js';
import agent_runHandler from '../server/agent-run.js';
import analyzeHandler from '../server/analyze.js';
import backtestHandler from '../server/backtest.js';
import contextHandler from '../server/context.js';
import correlationHandler from '../server/correlation.js';
import crypto_analyzeHandler from '../server/crypto-analyze.js';
import crypto_historyHandler from '../server/crypto-history.js';
import cryptoHandler from '../server/crypto.js';
import derivativesHandler from '../server/derivatives.js';
import eventsHandler from '../server/events.js';
import healthHandler from '../server/health.js';
import macroHandler from '../server/macro.js';
import multi_analyzeHandler from '../server/multi-analyze.js';
import onchainHandler from '../server/onchain.js';
import orderflowHandler from '../server/orderflow.js';
import quotesHandler from '../server/quotes.js';
import regimeHandler from '../server/regime.js';
import searchHandler from '../server/search.js';

const routes = {
  'agent-feed': agent_feedHandler,
  'agent-run': agent_runHandler,
  'analyze': analyzeHandler,
  'backtest': backtestHandler,
  'context': contextHandler,
  'correlation': correlationHandler,
  'crypto-analyze': crypto_analyzeHandler,
  'crypto-history': crypto_historyHandler,
  'crypto': cryptoHandler,
  'derivatives': derivativesHandler,
  'events': eventsHandler,
  'health': healthHandler,
  'macro': macroHandler,
  'multi-analyze': multi_analyzeHandler,
  'onchain': onchainHandler,
  'orderflow': orderflowHandler,
  'quotes': quotesHandler,
  'regime': regimeHandler,
  'search': searchHandler
};

export default async function handler(req, res) {
  try {
    const u = new URL(req.url, 'http://localhost');
    const route = String(u.searchParams.get('route') || '').trim();
    const fn = routes[route];

    if (!fn) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        ok: false,
        error: 'API route tidak ditemukan.',
        route
      }));
    }

    return await fn(req, res);
  } catch (e) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({
        ok: false,
        error: e?.message || 'Internal API gateway error'
      }));
    }
  }
}
