/* Browser-driving harness for the scenario tests, over the Chrome DevTools protocol.
 *
 * No Playwright or Puppeteer: Chrome is already on the machine, and driving it directly
 * keeps the test dependencies at zero. launchChrome() starts a headless instance if one
 * is not already listening, so `npm run test:flows` works from a cold start. */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DBG = process.env.DEVTOOLS || 'http://127.0.0.1:9222';
const j = async (p, m = 'GET') => (await fetch(DBG + p, { method: m })).json();

const CHROME = process.env.CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : 'google-chrome');

let child = null;
let profile = null;

/** Starts headless Chrome unless something is already on the debug port. */
export async function launchChrome() {
  try {
    await fetch(DBG + '/json/version');
    return false; /* already running — leave it alone */
  } catch { /* not running */ }

  profile = join(tmpdir(), 'aarunya-qa-' + Date.now());
  child = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + new URL(DBG).port,
    '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--window-size=1440,1000', 'about:blank',
  ], { stdio: 'ignore', detached: false });

  for (let i = 0; i < 60; i++) {
    try { await fetch(DBG + '/json/version'); return true; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Chrome did not start. Set CHROME_PATH if it is not at ${CHROME}.`);
}

export function stopChrome() {
  if (child) { try { child.kill() } catch {} child = null; }
  if (profile) { try { rmSync(profile, { recursive: true, force: true }) } catch {} profile = null; }
}

export async function openTab(url = 'about:blank', { width = 1440, height = 1000 } = {}) {
  const t = await j('/json/new?' + encodeURIComponent(url), 'PUT');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });

  let id = 0;
  const waiters = new Map();
  let errors = [];
  let netErrors = [];

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiters.has(m.id)) {
      const w = waiters.get(m.id); waiters.delete(m.id);
      m.error ? w.rej(new Error(JSON.stringify(m.error))) : w.res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push('EXCEPTION ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 150));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 150));
    } else if (m.method === 'Network.responseReceived') {
      const r = m.params.response;
      if (r.status >= 400 && r.url.includes('/api/')) {
        netErrors.push(`${r.status} ${r.url.replace(/^https?:\/\/[^/]+/, '')}`);
      }
    }
  };

  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; waiters.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => waiters.has(i) && (waiters.delete(i), rej(new Error('timeout ' + method))), 30000);
  });

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });

  const api = {
    send,
    ev: async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value,
    pause: (ms) => new Promise(r => setTimeout(r, ms)),
    get errors() { return errors; },
    get netErrors() { return netErrors; },
    clear() { errors = []; netErrors = []; },

    async goto(u, settle = 2600) { await send('Page.navigate', { url: u }); await api.pause(settle); },
    async route(path, settle = 1800) {
      await api.ev(`history.pushState({},'','${path}');dispatchEvent(new PopStateEvent('popstate'))`);
      await api.pause(settle);
    },
    async text() { return (await api.ev('document.body.innerText')) || ''; },
    async has(re) { return new RegExp(re, 'i').test(await api.text()); },
    async wait(expr, label, ms = 15000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (await api.ev(expr)) return true; await api.pause(200); }
      throw new Error('wait failed: ' + label);
    },
    async click(text, { exact = false, nth = 'first' } = {}) {
      return api.ev(`(()=>{const els=[...document.querySelectorAll('button,a')].filter(x=>{
        const t=(x.textContent||'').trim();
        return ${exact ? `t===${JSON.stringify(text)}` : `new RegExp(${JSON.stringify(text)},'i').test(t)`};});
        const el=${JSON.stringify(nth)}==='last'?els[els.length-1]:els[0];
        el&&el.click(); return !!el})()`);
    },
    async setInput(sel, value, which = 'first') {
      return api.ev(`(()=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
        const els=[...document.querySelectorAll(${JSON.stringify(sel)})];
        const el=${JSON.stringify(which)}==='last'?els[els.length-1]:els[0];
        if(!el)return false; d.call(el,${JSON.stringify(value)});
        el.dispatchEvent(new Event('input',{bubbles:true})); return true})()`);
    },
    async setSelectByText(match, { nth = 0 } = {}) {
      return api.ev(`(()=>{const sels=[...document.querySelectorAll('select')]
        .filter(x=>[...x.options].some(o=>new RegExp(${JSON.stringify(match)},'i').test(o.textContent)));
        const s=sels[${nth}]; if(!s)return false;
        const o=[...s.options].find(o=>new RegExp(${JSON.stringify(match)},'i').test(o.textContent));
        Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set.call(s,o.value);
        s.dispatchEvent(new Event('change',{bubbles:true})); return o.textContent.trim()})()`);
    },
    async type(sel, text) {
      await api.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;e.focus();return true})()`);
      await send('Input.insertText', { text });
    },
    async shot(dir, name) {
      mkdirSync(dir, { recursive: true });
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${dir}/${name}.png`, Buffer.from(data, 'base64'));
    },
    async close() { ws.close(); try { await j('/json/close/' + t.id) } catch {} },
  };
  return api;
}

/* ---- reporting ---- */
export const results = [];
export function check(scenario, name, pass, detail = '') {
  results.push({ scenario, name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
export function scenario(title) { console.log(`\n── ${title} ──`); return title; }
export function summary() {
  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length} checks, ${failed.length} failed`);
  if (failed.length) {
    console.log('\nFAILURES');
    for (const f of failed) console.log(`  · [${f.scenario}] ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
  }
  return failed.length;
}
