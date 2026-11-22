#!/usr/bin/env node
/*
 * Serveur MCP Monitorank (stdio, sans dépendance).
 * - Appels API en LECTURE SEULE (aucune création/suppression possible).
 * - Journal local des modifications SEO pour mesurer leur effet.
 * Clé API : variable MONITORANK_API_KEY, sinon ~/.monitorank-mcp/config.json
 * (enregistrable via l'outil monitorank_set_api_key).
 */
'use strict';

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const SERVER_NAME = 'monitorank';
const SERVER_VERSION = '0.3.0';
const API_BASE = process.env.MONITORANK_API_BASE || 'https://api.monitorank.com/';
const DATA_DIR = process.env.MONITORANK_DATA_DIR || path.join(os.homedir(), '.monitorank-mcp');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PROJECT_DIR = cleanEnv('CLAUDE_PROJECT_DIR') || process.cwd();
const PROJECT_JOURNAL = path.join(PROJECT_DIR, '.monitorank', 'journal.json');

function cleanEnv(name) {
  const v = (process.env[name] || '').trim();
  return v && !v.startsWith('${') ? v : '';
}

/*
 * Emplacement du journal (la clé API, elle, reste toujours hors projet) :
 * 1. MONITORANK_JOURNAL_FILE si défini ;
 * 2. <projet>/.monitorank/journal.json s'il existe déjà, ou si on tourne dans
 *    Claude Code cloud (CLAUDE_CODE_REMOTE) ou si MONITORANK_JOURNAL_IN_PROJECT=1 :
 *    le journal est alors versionné avec le dépôt et survit aux sessions éphémères ;
 * 3. sinon ~/.monitorank-mcp/journal.json (comportement local historique).
 */
function resolveJournal() {
  const explicit = cleanEnv('MONITORANK_JOURNAL_FILE');
  if (explicit) return { file: path.resolve(PROJECT_DIR, explicit), scope: 'env' };
  const remote = /^(1|true)$/i.test(cleanEnv('CLAUDE_CODE_REMOTE'));
  const optIn = /^(1|true)$/i.test(cleanEnv('MONITORANK_JOURNAL_IN_PROJECT'));
  if (fs.existsSync(PROJECT_JOURNAL) || remote || optIn) return { file: PROJECT_JOURNAL, scope: 'project' };
  return { file: path.join(DATA_DIR, 'journal.json'), scope: 'home' };
}
const JOURNAL = resolveJournal();
const JOURNAL_FILE = JOURNAL.file;

// ---------------------------------------------------------------- stockage local
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function writeJson(file, value, mode) {
  ensureDir();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: mode || 0o600 });
}
function getConfig() { return readJson(CONFIG_FILE, {}); }
const PROJECT_CONFIG = path.join(PROJECT_DIR, '.monitorank', 'config.json');
/** Site par défaut : <projet>/.monitorank/config.json > MONITORANK_DEFAULT_SITE > ~/.monitorank-mcp/config.json. */
function getDefaultSite() {
  const proj = (readJson(PROJECT_CONFIG, {}).default_site || '').trim();
  return proj || cleanEnv('MONITORANK_DEFAULT_SITE') || (getConfig().default_site || '').trim() || null;
}
function getApiKey() {
  const env = cleanEnv('MONITORANK_API_KEY');
  if (env) return env;
  return (getConfig().api_key || '').trim();
}

// ---------------------------------------------------------------- périodes
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseDate(s) {
  const m = String(s).trim().match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!m) throw new Error(`Date invalide « ${s} » (attendu AAAA-MM-JJ)`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Accepte AAAAMMJJ-AAAAMMJJ, AAAA-MM-JJ..AAAA-MM-JJ, last_N, last_week, last_month, current_month, current_year, last_year. */
function normalizePeriod(input) {
  if (!input) throw new Error('Paramètre « period » requis');
  const p = String(input).trim();
  if (/^\d{8}-\d{8}$/.test(p)) return p;
  const range = p.match(/^(\d{4}-?\d{2}-?\d{2})\s*(?:\.\.|\/|_| au | to |,)\s*(\d{4}-?\d{2}-?\d{2})$/);
  if (range) return `${ymd(parseDate(range[1]))}-${ymd(parseDate(range[2]))}`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastN = p.match(/^last_(\d+)$/);
  if (lastN) return `${ymd(addDays(today, -Number(lastN[1])))}-${ymd(today)}`;
  switch (p) {
    case 'last_week': { const dow = (today.getDay() + 6) % 7; const mon = addDays(today, -dow - 7); return `${ymd(mon)}-${ymd(addDays(mon, 6))}`; }
    case 'last_month': { const s = new Date(today.getFullYear(), today.getMonth() - 1, 1); const e = new Date(today.getFullYear(), today.getMonth(), 0); return `${ymd(s)}-${ymd(e)}`; }
    case 'last_3_month': return `${ymd(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()))}-${ymd(today)}`;
    case 'last_12_month': return `${ymd(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()))}-${ymd(today)}`;
    case 'current_month': return `${ymd(new Date(today.getFullYear(), today.getMonth(), 1))}-${ymd(today)}`;
    case 'current_year': return `${ymd(new Date(today.getFullYear(), 0, 1))}-${ymd(today)}`;
    case 'last_year': return `${today.getFullYear() - 1}0101-${today.getFullYear() - 1}1231`;
    default: throw new Error(`Période non reconnue « ${p} ». Formats : 20260101-20260131, 2026-01-01..2026-01-31, last_30, last_month…`);
  }
}

// ---------------------------------------------------------------- appel API
const READ_ACTIONS = {
  project: ['list'],
  entity: ['list', 'get', 'typeList'],
  query: ['list', 'status'],
  rank: ['get'],
  location: ['search'],
  version: ['list'],
  statistics: ['get'],
  aio: ['get'],
  filter: ['list'],
  group: ['list'],
  audit: ['list', 'query', 'ranks'],
  account: ['resources'],
  google: ['update'],
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http:') ? require('http') : https;
    const req = client.get(url, { headers: { 'User-Agent': `${SERVER_NAME}-mcp/${SERVER_VERSION}` }, timeout: 60000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(new Error('Délai dépassé (60 s) en appelant Monitorank')));
    req.on('error', reject);
  });
}

async function callApi(module, action, params) {
  if (!READ_ACTIONS[module] || !READ_ACTIONS[module].includes(action)) {
    throw new Error(`Action non autorisée : ${module}/${action}. Ce plugin est en lecture seule.`);
  }
  const key = getApiKey();
  if (!key) {
    throw new Error("Aucune clé API Monitorank configurée. Récupérez-la dans Monitorank > menu API, puis utilisez l'outil monitorank_set_api_key (ou définissez MONITORANK_API_KEY).");
  }
  const qs = new URLSearchParams({ key, module, action });
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const { status, body } = await httpGet(`${API_BASE}?${qs.toString()}`);
  let json;
  try { json = JSON.parse(body); } catch (_) {
    throw new Error(`Réponse non JSON de Monitorank (HTTP ${status}) : ${body.slice(0, 300)}`);
  }
  if (json.result === false) throw new Error(`Monitorank : ${json.error || 'erreur inconnue'}`);
  return json;
}

// ---------------------------------------------------------------- outils
const S = (props, required) => ({ type: 'object', properties: props, required: required || [], additionalProperties: false });
const PERIOD = { type: 'string', description: "Période : 20260101-20260131, 2026-01-01..2026-01-31, ou last_7 / last_30 / last_90 / last_month / current_month…" };

const TOOLS = [
  {
    name: 'monitorank_set_api_key',
    description: "Enregistre la clé API Monitorank sur cet ordinateur (fichier privé ~/.monitorank-mcp/config.json). Optionnellement, mémorise le site suivi par défaut.",
    inputSchema: S({
      api_key: { type: 'string', description: 'Clé API (Monitorank > menu API)' },
      default_site: { type: 'string', description: 'Domaine suivi par défaut, ex. depannage-traceur-lyon.fr' },
    }, ['api_key']),
    handler: async (a) => {
      const cfg = getConfig();
      cfg.api_key = a.api_key.trim();
      if (a.default_site) cfg.default_site = a.default_site.trim();
      writeJson(CONFIG_FILE, cfg);
      const res = await callApi('account', 'resources', {}).catch((e) => ({ error: e.message }));
      return { saved: true, default_site: getDefaultSite(), key_check: res.error ? `Échec du test : ${res.error}` : 'Clé valide', resources: res.data };
    },
  },
  {
    name: 'monitorank_status',
    description: "Indique si une clé API est configurée, le site par défaut et les ressources restantes du compte.",
    inputSchema: S({}),
    handler: async () => {
      const cfg = getConfig();
      const hasKey = Boolean(getApiKey());
      const out = { api_key_configured: hasKey, default_site: getDefaultSite(), journal_file: JOURNAL_FILE, journal_scope: JOURNAL.scope };
      if (hasKey) out.resources = (await callApi('account', 'resources', {})).data;
      return out;
    },
  },
  {
    name: 'monitorank_list_projects',
    description: 'Liste les projets Monitorank (id_project, nom).',
    inputSchema: S({}),
    handler: async () => callApi('project', 'list', {}),
  },
  {
    name: 'monitorank_list_sites',
    description: 'Liste les sites suivis (id_entity, URL, type : Mes sites / Concurrents…).',
    inputSchema: S({ id_project: { type: 'integer' }, id_entity: { type: 'integer' } }),
    handler: async (a) => callApi('entity', 'list', a),
  },
  {
    name: 'monitorank_site_positions',
    description: "Positions Google d'un site sur tous ses mots-clés pour une période (méthode entity/get). Donner soit url (domaine), soit id_entity. Si rien n'est donné, utilise le site par défaut.",
    inputSchema: S({
      url: { type: 'string', description: 'Domaine, ex. depannage-traceur-lyon.fr' },
      id_entity: { type: 'integer' },
      period: PERIOD,
      id_group: { type: 'string', description: 'Groupe(s) de mots-clés, séparés par des virgules' },
      id_filter: { type: 'integer' },
    }, ['period']),
    handler: async (a) => {
      const params = { period: normalizePeriod(a.period), id_group: a.id_group, id_filter: a.id_filter };
      if (a.id_entity) params.id_entity = a.id_entity;
      else params.url = a.url || getDefaultSite();
      if (!params.id_entity && !params.url) throw new Error('Indiquez url ou id_entity (aucun site par défaut enregistré).');
      return callApi('entity', 'get', params);
    },
  },
  {
    name: 'monitorank_site_statistics',
    description: "Statistiques agrégées d'un site sur une période (visibilité, répartition des positions…), méthode statistics/get.",
    inputSchema: S({ id_entity: { type: 'integer' }, period: PERIOD, id_group: { type: 'string' } }, ['id_entity', 'period']),
    handler: async (a) => callApi('statistics', 'get', { ...a, period: normalizePeriod(a.period) }),
  },
  {
    name: 'monitorank_list_keywords',
    description: 'Liste les mots-clés suivis (id_query, mot-clé, moteur, appareil, groupe). volume_historical=true ajoute 12 mois de volumes de recherche.',
    inputSchema: S({ id_project: { type: 'integer' }, volume_historical: { type: 'boolean' } }),
    handler: async (a) => callApi('query', 'list', { id_project: a.id_project, volume_historical: a.volume_historical ? 'true' : undefined }),
  },
  {
    name: 'monitorank_keyword_history',
    description: "Historique jour par jour des positions d'un mot-clé (rank/get) pour tous les sites suivis sur ce mot-clé.",
    inputSchema: S({ id_query: { type: 'integer' }, period: PERIOD }, ['id_query', 'period']),
    handler: async (a) => callApi('rank', 'get', { id_query: a.id_query, period: normalizePeriod(a.period) }),
  },
  {
    name: 'monitorank_list_groups',
    description: 'Liste les groupes de mots-clés d’un projet.',
    inputSchema: S({ id_project: { type: 'integer' } }),
    handler: async (a) => callApi('group', 'list', a),
  },
  {
    name: 'monitorank_list_filters',
    description: 'Liste les filtres enregistrés.',
    inputSchema: S({}),
    handler: async () => callApi('filter', 'list', {}),
  },
  {
    name: 'monitorank_ai_overview',
    description: "Présence dans les AI Overviews Google (aio/get). ATTENTION : coûte 1 unité par mot-clé. Donner id_project ou id_entity.",
    inputSchema: S({ id_project: { type: 'integer' }, id_entity: { type: 'integer' }, period: PERIOD, id_group: { type: 'string' } }, ['period']),
    handler: async (a) => {
      if (!a.id_project && !a.id_entity) throw new Error('id_project ou id_entity requis');
      return callApi('aio', 'get', { ...a, period: normalizePeriod(a.period) });
    },
  },
  {
    name: 'monitorank_google_updates',
    description: "Liste des mises à jour d'algorithme Google annoncées (utile pour ne pas confondre l'effet d'un update avec celui d'une modification SEO).",
    inputSchema: S({}),
    handler: async () => callApi('google', 'update', {}),
  },
  {
    name: 'monitorank_read',
    description: "Appel générique en lecture seule pour les méthodes non couvertes par les autres outils (ex. audit/ranks, location/search, version/list, query/status). Les écritures/suppressions sont refusées.",
    inputSchema: S({
      module: { type: 'string', enum: Object.keys(READ_ACTIONS) },
      action: { type: 'string' },
      params: { type: 'object', description: 'Paramètres supplémentaires (period est normalisée automatiquement)', additionalProperties: true },
    }, ['module', 'action']),
    handler: async (a) => {
      const params = { ...(a.params || {}) };
      if (params.period) params.period = normalizePeriod(params.period);
      delete params.key; delete params.module; delete params.action;
      return callApi(a.module, a.action, params);
    },
  },
  // ------------------------------------------------ journal SEO local
  {
    name: 'seo_journal_add',
    description: "Ajoute une modification SEO au journal local (date, page, nature du changement, mots-clés visés) pour en mesurer l'effet ensuite.",
    inputSchema: S({
      date: { type: 'string', description: 'Date de mise en ligne AAAA-MM-JJ' },
      site: { type: 'string', description: 'Domaine (défaut : site par défaut)' },
      page: { type: 'string', description: 'URL ou chemin de la page modifiée ("tout le site" si global)' },
      type: { type: 'string', description: 'Catégorie : title/meta, contenu, maillage interne, nouvelle page, technique, netlinking, fiche Google Business, autre' },
      description: { type: 'string', description: 'Ce qui a été fait, en une ou deux phrases' },
      keywords: { type: 'array', items: { type: 'string' }, description: 'Mots-clés visés' },
    }, ['date', 'description']),
    handler: async (a) => {
      ymd(parseDate(a.date));
      const j = readJson(JOURNAL_FILE, []);
      const id = j.reduce((m, e) => Math.max(m, e.id || 0), 0) + 1;
      const entry = { id, date: a.date, site: a.site || getDefaultSite(), page: a.page || null, type: a.type || null, description: a.description, keywords: a.keywords || [], created_at: new Date().toISOString() };
      j.push(entry);
      writeJson(JOURNAL_FILE, j, JOURNAL.scope === 'home' ? 0o600 : 0o644);
      return { added: entry, total: j.length, journal_file: JOURNAL_FILE, ...(JOURNAL.scope === 'project' ? { reminder: 'Journal versionné dans le projet : committer et pousser .monitorank/journal.json pour le conserver.' } : {}) };
    },
  },
  {
    name: 'seo_journal_list',
    description: 'Liste les modifications SEO enregistrées (filtrables par site et par dates).',
    inputSchema: S({ site: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } }),
    handler: async (a) => {
      let j = readJson(JOURNAL_FILE, []);
      if (a.site) j = j.filter((e) => !e.site || e.site.includes(a.site));
      if (a.from) j = j.filter((e) => ymd(parseDate(e.date)) >= ymd(parseDate(a.from)));
      if (a.to) j = j.filter((e) => ymd(parseDate(e.date)) <= ymd(parseDate(a.to)));
      return { entries: j.sort((x, y) => x.date.localeCompare(y.date)) };
    },
  },
  {
    name: 'seo_journal_remove',
    description: 'Supprime une entrée du journal SEO local par son id.',
    inputSchema: S({ id: { type: 'integer' } }, ['id']),
    handler: async (a) => {
      const j = readJson(JOURNAL_FILE, []);
      const next = j.filter((e) => e.id !== a.id);
      if (next.length === j.length) throw new Error(`Aucune entrée avec l'id ${a.id}`);
      writeJson(JOURNAL_FILE, next, JOURNAL.scope === 'home' ? 0o600 : 0o644);
      return { removed: a.id, total: next.length };
    },
  },
  {
    name: 'seo_periods_around',
    description: "Calcule deux périodes comparables avant/après une date de modification (en excluant quelques jours de transition), prêtes pour monitorank_site_positions.",
    inputSchema: S({
      date: { type: 'string', description: 'Date de la modification AAAA-MM-JJ' },
      days: { type: 'integer', description: 'Longueur de chaque période (défaut 14)' },
      gap: { type: 'integer', description: 'Jours exclus après la modification, temps que Google réindexe (défaut 3)' },
    }, ['date']),
    handler: async (a) => {
      const d = parseDate(a.date);
      const days = a.days || 14; const gap = a.gap === undefined ? 3 : a.gap;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const before = `${ymd(addDays(d, -days))}-${ymd(addDays(d, -1))}`;
      const aStart = addDays(d, gap); let aEnd = addDays(aStart, days - 1);
      const truncated = aEnd > today; if (truncated) aEnd = today;
      const afterDays = Math.round((aEnd - aStart) / 86400000) + 1;
      return { before, after: aStart > today ? null : `${ymd(aStart)}-${ymd(aEnd)}`, after_days_available: Math.max(0, afterDays), after_truncated: truncated };
    },
  },
];
const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

// ---------------------------------------------------------------- JSON-RPC / MCP
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function fail(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    switch (method) {
      case 'initialize':
        return reply(id, {
          protocolVersion: (params && params.protocolVersion) || '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          instructions: "Outils Monitorank en lecture seule (positions Google, historique par mot-clé, statistiques, updates Google) et journal local des modifications SEO.",
        });
      case 'ping': return reply(id, {});
      case 'tools/list':
        return reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case 'tools/call': {
        const tool = TOOL_MAP[params && params.name];
        if (!tool) return fail(id, -32602, `Outil inconnu : ${params && params.name}`);
        try {
          const out = await tool.handler((params && params.arguments) || {});
          return reply(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
        } catch (e) {
          return reply(id, { content: [{ type: 'text', text: `Erreur : ${e.message}` }], isError: true });
        }
      }
      default:
        if (isRequest) return fail(id, -32601, `Méthode non prise en charge : ${method}`);
    }
  } catch (e) {
    if (isRequest) fail(id, -32603, e.message);
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch (_) { return fail(null, -32700, 'JSON invalide'); }
  if (Array.isArray(msg)) msg.forEach(handle); else handle(msg);
});
rl.on('close', () => process.exit(0));
