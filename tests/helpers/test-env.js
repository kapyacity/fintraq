import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.resolve(__dirname, '../../index.html');

// Read and extract core logic blocks from index.html
const htmlContent = fs.readFileSync(indexPath, 'utf8');

// Extract Block 1: Data model, dates, income, loans (lines ~560-938)
const b1StartMarker = '/* ---------------- Data model ---------------- */';
const b1EndMarker = 'function renderLoans()';
const b1StartIndex = htmlContent.indexOf(b1StartMarker);
const b1EndIndex = htmlContent.indexOf(b1EndMarker);

if (b1StartIndex === -1 || b1EndIndex === -1) {
  throw new Error('Could not locate Data Model code block in index.html');
}

const block1Code = htmlContent.slice(b1StartIndex, b1EndIndex);

// Extract Block 2: P2P reconciliation & sync payload (lines ~1599-1677)
const b2StartMarker = 'function reconcileStates(local, remote)';
const b2EndMarker = 'function closeExistingPeer()';
const b2StartIndex = htmlContent.indexOf(b2StartMarker);
const b2EndIndex = htmlContent.indexOf(b2EndMarker);

if (b2StartIndex === -1 || b2EndIndex === -1) {
  throw new Error('Could not locate Sync code block in index.html');
}

const block2Code = htmlContent.slice(b2StartIndex, b2EndIndex);

// Extract Block 3: Google Sheets Audit Sync Engine
const b3StartMarker = '/* ---------------- Google Sheets Audit Sync Engine ---------------- */';
const b3EndMarker = '/* ---------------- P2P WebRTC Auto-Sync Engine (PeerJS + BroadcastChannel) ---------------- */';
const b3StartIndex = htmlContent.indexOf(b3StartMarker);
const b3EndIndex = htmlContent.indexOf(b3EndMarker);

if (b3StartIndex === -1 || b3EndIndex === -1) {
  throw new Error('Could not locate Google Sheets code block in index.html');
}

const block3Code = htmlContent.slice(b3StartIndex, b3EndIndex);

// Extract Block 4: Expense logging functions
const expStartMarker = 'function saveExpense()';
const expEndMarker = '/* ---------------- Charts (native SVG/CSS) ---------------- */';
const expStartIndex = htmlContent.indexOf(expStartMarker);
const expEndIndex = htmlContent.indexOf(expEndMarker);
const expenseCode = (expStartIndex !== -1 && expEndIndex !== -1)
  ? htmlContent.slice(expStartIndex, expEndIndex)
  : '';

// Bridge code to capture closure variables and export them onto globalThis.__fintraq
const bridgeCode = `
globalThis.__fintraq = {
  CATS,
  IC,
  DEFAULT_SUBS,
  KEY,
  DEFAULT_RATIO,
  PRESETS,
  state,
  blankState,
  load,
  subKey,
  subBudget,
  setSubBudget,
  spentSub,
  catAllocated,
  toggleCat,
  applyRatioToBudgets,
  save,
  monthKey,
  startOfDay,
  startOfWeekMon,
  startOfMonth,
  endOfMonth,
  fmt,
  checkMonthReset,
  spentByCat,
  totalSpent,
  vmDate,
  vmStart,
  vmEnd,
  vmIsCurrent,
  vmLabel,
  earliestMonthDate,
  setViewMonth,
  shiftMonth,
  jumpToCurrent,
  weeksOfMonth,
  getMonthlyIncome,
  openIncomeModal,
  onIncAmt,
  saveIncome,
  delIncome,
  openLoanModal,
  saveLoan,
  payLoanEMI,
  delLoan,
  openFundModal,
  saveFund,
  openDepositModal,
  handleDepositSubmit,
  depositFund,
  openWithdrawModal,
  handleWithdrawSubmit,
  withdrawFund,
  openFundHistoryModal,
  delFund,
  getFundProgress,
  reconcileStates,
  createSyncPayload,
  saveExpense,
  delExpense,
  getGSheetUrl,
  saveGSheetConfig,
  renderGSheetUI,
  sendToGoogleSheet,
  flushPendingSheetSync,
  testGSheetConnection,
  syncAllToGoogleSheet
};
`;

const combinedCode = `${block1Code}\n\n${expenseCode}\n\n${block2Code}\n\n${block3Code}\n\n${bridgeCode}`;
const compiledScript = new vm.Script(combinedCode, { filename: 'fintraq-core.vm.js' });

/**
 * Creates an isolated test execution sandbox for FinTraQ.
 * @param {Object} [initialStateOverrides]
 * @returns {Object} Test context containing core functions, state, and spies
 */
export function createTestContext(initialStateOverrides = null) {
  const storage = {};
  if (initialStateOverrides) {
    storage['fintraq_v1'] = JSON.stringify(initialStateOverrides);
  }

  const toasts = [];
  const elements = new Map();
  const fetchCalls = [];
  const mockNavigator = {
    onLine: true
  };
  const mockFetch = (url, opts) => {
    fetchCalls.push({ url, opts });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });
  };
  let renders = 0;
  let syncBroadcasts = 0;
  const closeModalCalls = [];
  const openModalCalls = [];

  function getOrCreateElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        textContent: '',
        innerHTML: '',
        style: {},
        classList: {
          contains: () => false,
          add: () => {},
          remove: () => {},
          toggle: () => {}
        },
        focus: () => {}
      });
    }
    return elements.get(id);
  }

  const mockLocalStorage = {
    getItem: (key) => (key in storage ? storage[key] : null),
    setItem: (key, value) => {
      storage[key] = String(value);
    },
    removeItem: (key) => {
      delete storage[key];
    },
    clear: () => {
      for (const k of Object.keys(storage)) {
        delete storage[k];
      }
    }
  };

  const mockDocument = {
    getElementById: (id) => getOrCreateElement(id),
    querySelectorAll: () => []
  };

  const windowListeners = new Map();
  const mockWindow = {
    addEventListener: (event, handler) => {
      if (!windowListeners.has(event)) windowListeners.set(event, []);
      windowListeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
      if (!windowListeners.has(event)) return;
      windowListeners.set(event, windowListeners.get(event).filter(h => h !== handler));
    },
    dispatchEvent: (event) => {
      const type = typeof event === 'string' ? event : event?.type;
      const handlers = windowListeners.get(type) || [];
      handlers.forEach(h => h(event));
    }
  };

  let vmContext = null;
  const sandbox = {
    // Globals
    console,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    JSON,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    curCat: 'needs',

    // Browser mocks
    localStorage: mockLocalStorage,
    document: mockDocument,
    window: mockWindow,
    navigator: mockNavigator,
    fetch: mockFetch,

    // UI and app spies
    toast: (msg) => {
      toasts.push(msg);
    },
    render: () => {
      renders++;
      if (vmContext && vmContext.__fintraq) {
        const f = vmContext.__fintraq;
        const now = new Date();
        const m = f.getMonthlyIncome(f.startOfMonth(now), f.endOfMonth(now));
        if (f.state.salary !== m.total) {
          f.state.salary = m.total;
          f.applyRatioToBudgets();
        }
      }
    },
    broadcastSync: () => {
      syncBroadcasts++;
    },
    closeModal: (id) => {
      closeModalCalls.push(id);
    },
    openModal: (id) => {
      openModalCalls.push(id);
    },
    confirm: () => true,
    escapeHtml: (str) => String(str),

    // Stubs for non-core UI renderers called by setters/nav
    renderCatBudgets: () => {},
    renderMonthNav: () => {},
    renderExpenses: () => {},
    renderCharts: () => {},
    renderLoans: () => {},
    renderIncomes: () => {},
    renderFunds: () => {},
    renderFundHistory: () => {},
    renderGSheetUI: () => {}
  };

  vmContext = vm.createContext(sandbox);
  compiledScript.runInContext(vmContext);

  const exports = vmContext.__fintraq;

  // If overrides were passed and load() didn't pick up some fields, merge them
  if (initialStateOverrides) {
    Object.assign(exports.state, initialStateOverrides);
  }

  return {
    ...exports,
    toasts,
    fetchCalls,
    navigator: mockNavigator,
    get renders() {
      return renders;
    },
    get syncBroadcasts() {
      return syncBroadcasts;
    },
    closeModalCalls,
    openModalCalls,
    localStorage: mockLocalStorage,
    document: mockDocument,
    render: () => {
      sandbox.render();
    },
    setElement: (id, props) => {
      const el = getOrCreateElement(id);
      Object.assign(el, props);
      return el;
    },
    resetSpies: () => {
      toasts.length = 0;
      fetchCalls.length = 0;
      renders = 0;
      syncBroadcasts = 0;
      closeModalCalls.length = 0;
      openModalCalls.length = 0;
    }
  };
}
