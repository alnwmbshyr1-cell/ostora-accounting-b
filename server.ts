import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FLUTTER_DIR = path.join(__dirname, 'flutter_app');
const ASSETS_IMG_DIR = path.join(__dirname, 'src', 'assets', 'images');

interface FlutterFileEntry {
  path: string;
  content: string;
}

const BINARY_EXT_RE = /\.(png|jpe?g|webp|gif|ico|jar|jks|keystore)$/i;

function collectFlutterFiles(dir: string, baseDir: string): FlutterFileEntry[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: FlutterFileEntry[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFlutterFiles(fullPath, baseDir));
    } else if (!BINARY_EXT_RE.test(entry.name)) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath, 'utf-8');
      results.push({ path: relPath, content });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function collectFlutterRawFiles(dir: string, baseDir: string): { path: string; data: Buffer }[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: { path: string; data: Buffer }[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFlutterRawFiles(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ path: relPath, data: fs.readFileSync(fullPath) });
    }
  }
  return results;
}

async function startServer() {
  const app = express();
  const port = 3000;
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/flutter-files', (_req, res) => {
    try {
      const files = collectFlutterFiles(FLUTTER_DIR, FLUTTER_DIR);
      res.json({
        packageName: 'com.ostora.accounting',
        version: '1.0.0+1',
        developer: 'Ostora Systems',
        files,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/download-flutter-zip', async (_req, res) => {
    try {
      const zip = new JSZip();
      const root = zip.folder('ostora_accounting_flutter');
      const files = collectFlutterRawFiles(FLUTTER_DIR, FLUTTER_DIR);
      for (const file of files) {
        root?.file(file.path, file.data);
      }

      // Include generated Play Store visual assets in the ZIP
      if (fs.existsSync(ASSETS_IMG_DIR)) {
        const imgs = fs.readdirSync(ASSETS_IMG_DIR);
        for (const img of imgs) {
          const buf = fs.readFileSync(path.join(ASSETS_IMG_DIR, img));
          if (img.includes('ostora_app_icon')) {
            root?.file('play_store/app_icon_512.jpg', buf);
          } else if (img.includes('ostora_feature_graphic')) {
            root?.file('play_store/feature_graphic_1024x500.jpg', buf);
          }
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="ostora_accounting_flutter_aab_ready.zip"');
      res.send(zipBuffer);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  const ALLOWED_FX = new Set([
    'SAR', 'YER', 'EGP', 'AED', 'USD', 'EUR', 'GBP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'TRY', 'IQD', 'JPY',
  ]);
  const FALLBACK_SAR_RATES: Record<string, number> = {
    SAR: 1, AED: 1.0211, USD: 3.75, EUR: 3.96, GBP: 4.74, EGP: 0.076,
    YER: 0.015, KWD: 12.2, QAR: 1.03, BHD: 9.95, OMR: 9.74, JOD: 5.29, TRY: 0.109,
    IQD: 0.00286, JPY: 0.025,
  };

  app.get('/api/exchange-rates', async (req, res) => {
    const rawBase = String(req.query.base ?? 'SAR').toUpperCase();
    const base = ALLOWED_FX.has(rawBase) ? rawBase : 'SAR';
    const baseSar = FALLBACK_SAR_RATES[base] ?? 1;

    const buildFallback = () => {
      const rates: Record<string, number> = {};
      for (const code of ALLOWED_FX) {
        rates[code] = code === base ? 1 : Number(((FALLBACK_SAR_RATES[code] ?? 1) / baseSar).toFixed(4));
      }
      return rates;
    };

    try {
      const upstream = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!upstream.ok) {
        res.json({ base, rates: buildFallback(), updatedAt: new Date().toISOString(), source: 'fallback' });
        return;
      }
      const data = (await upstream.json()) as {
        result?: string;
        time_last_update_utc?: string;
        rates?: Record<string, number>;
      };
      if (data.result !== 'success' || !data.rates) {
        res.json({ base, rates: buildFallback(), updatedAt: new Date().toISOString(), source: 'fallback' });
        return;
      }
      const convertedToBase: Record<string, number> = {};
      for (const code of ALLOWED_FX) {
        if (code === base) {
          convertedToBase[code] = 1;
        } else {
          const perBase = data.rates[code];
          convertedToBase[code] =
            typeof perBase === 'number' && perBase > 0
              ? Number((1 / perBase).toFixed(4))
              : Number(((FALLBACK_SAR_RATES[code] ?? 1) / baseSar).toFixed(4));
        }
      }
      res.json({
        base,
        rates: convertedToBase,
        updatedAt: new Date().toISOString(),
        source: 'live',
      });
    } catch {
      res.json({ base, rates: buildFallback(), updatedAt: new Date().toISOString(), source: 'fallback' });
    }
  });

  app.get('/api/client-meta', (req, res) => {
    const fwd = req.headers['x-forwarded-for'];
    const ip = Array.isArray(fwd)
      ? fwd[0]
      : typeof fwd === 'string' && fwd.length > 0
      ? fwd.split(',')[0].trim()
      : req.socket?.remoteAddress || req.ip || 'unknown';
    res.json({
      ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 180),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/ai/analytics', async (req, res) => {
    const rawKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!rawKey || rawKey === 'MY_GEMINI_API_KEY') {
      res.json({
        enabled: false,
        message: 'AI غير مفعل',
        forecast: null,
        summaryAr: '',
        summaryEn: '',
        actionItems: [],
      });
      return;
    }

    try {
      const payload = (req.body && typeof req.body === 'object' ? req.body : {}) as {
        currency?: string;
        isArabic?: boolean;
        last3MonthsRevenue?: { monthKey: string; total: number }[];
        monthlyRevenue?: number;
        monthlyExpenses?: number;
        netProfit?: number;
        overdueCustomersCount?: number;
        lowStockCount?: number;
      };

      const ai = new GoogleGenAI({
        apiKey: rawKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const prompt = `You are a senior ERP financial analyst. Given ONLY the real company metrics below, return strict JSON (no markdown) with:
{
  "forecast6m": [{"monthLabel": "M+1", "projectedRevenue": number}, ... 6 items],
  "summaryAr": "concise 2-sentence Arabic executive insight",
  "summaryEn": "concise 2-sentence English executive insight",
  "actionItems": [{"titleAr": string, "titleEn": string, "priority": "high"|"medium"|"low"}]
}
Metrics: ${JSON.stringify({
        currency: payload.currency || 'SAR',
        last3MonthsRevenue: payload.last3MonthsRevenue || [],
        monthlyRevenue: payload.monthlyRevenue || 0,
        monthlyExpenses: payload.monthlyExpenses || 0,
        netProfit: payload.netProfit || 0,
        overdueCustomersCount: payload.overdueCustomersCount || 0,
        lowStockCount: payload.lowStockCount || 0,
      })}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });

      const text = (response.text || '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      const forecast = Array.isArray(parsed.forecast6m) ? parsed.forecast6m.slice(0, 6) : null;

      res.json({
        enabled: true,
        model: 'gemini-4-hydrogen',
        forecast,
        summaryAr: typeof parsed.summaryAr === 'string' ? parsed.summaryAr : '',
        summaryEn: typeof parsed.summaryEn === 'string' ? parsed.summaryEn : '',
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.slice(0, 5) : [],
      });
    } catch (err) {
      res.status(502).json({
        enabled: false,
        message: 'AI غير مفعل',
        error: String(err),
        forecast: null,
        actionItems: [],
      });
    }
  });

  app.post('/api/subscriptions/checkout', async (req, res) => {
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    const { planId, billingCycle, customerEmail } = (req.body || {}) as {
      planId?: string;
      billingCycle?: 'monthly' | 'yearly';
      customerEmail?: string;
    };

    const planPricesHalalas: Record<string, { monthly: number; yearly: number; name: string }> = {
      basic: { monthly: 9900, yearly: 95000, name: 'Ostora ERP Basic' },
      pro: { monthly: 24900, yearly: 239000, name: 'Ostora ERP Pro' },
      enterprise: { monthly: 59900, yearly: 575000, name: 'Ostora ERP Enterprise' },
    };
    const chosen = planPricesHalalas[String(planId || '')];
    if (!chosen) {
      res.status(400).json({ configured: Boolean(stripeKey), error: 'Invalid subscription plan' });
      return;
    }

    if (!stripeKey || stripeKey.startsWith('MY_')) {
      res.json({
        configured: false,
        messageAr: 'بوابة الدفع Stripe غير مفعلة في الخادم حالياً (STRIPE_SECRET_KEY غير مضبوط).',
        messageEn: 'Stripe checkout is not configured on the server yet (STRIPE_SECRET_KEY missing).',
      });
      return;
    }

    try {
      const origin = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const unitAmount = billingCycle === 'yearly' ? chosen.yearly : chosen.monthly;
      const body = new URLSearchParams({
        mode: 'payment',
        success_url: `${origin}/?subscription=success&plan=${encodeURIComponent(String(planId))}`,
        cancel_url: `${origin}/?subscription=cancelled`,
        'line_items[0][price_data][currency]': 'sar',
        'line_items[0][price_data][product_data][name]': chosen.name,
        'line_items[0][price_data][unit_amount]': String(unitAmount),
        'line_items[0][quantity]': '1',
      });
      if (customerEmail) {
        body.set('customer_email', customerEmail);
      }
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      const session = (await stripeRes.json()) as { url?: string; error?: { message?: string } };
      if (!stripeRes.ok || !session.url) {
        res.status(502).json({
          configured: true,
          error: session.error?.message || 'Stripe checkout session creation failed',
        });
        return;
      }
      res.json({ configured: true, checkoutUrl: session.url });
    } catch (err) {
      res.status(500).json({ configured: true, error: String(err) });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // Vite 8 injects /@vite/client and attempts a WebSocket on port 24678 even when hmr/ws are false.
    // Make wsTransport.connect() resolve immediately so no WebSocket opens and transport.send() stays valid.
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) return next();
        const patchedCode = result.code
          .replace(
            'async connect({ onMessage, onDisconnection }) {',
            'async connect() { return; }, async _disabledConnect({ onMessage, onDisconnection }) {',
          )
          .replace(
            'ws.send(JSON.stringify(data));',
            'if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));',
          );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.send(patchedCode);
      } catch {
        next();
      }
    });

    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Ostora Accounting server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
