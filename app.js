(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = 'saldo-dashboard-state-v1';
  const TYPE_LABELS = {
    purchase: 'Compra',
    withdrawal: 'Retiro',
    transfer: 'Transferencia',
    income: 'Ingreso'
  };
  const TYPE_ICONS = {
    purchase: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0M8.5 12h.01M15.5 12h.01"/></svg>',
    withdrawal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/></svg>',
    transfer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6m3.5-3.5L6 16l3.5 3.5"/></svg>',
    income: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V9M7.5 13.5 12 9l4.5 4.5M5 5h14"/></svg>'
  };
  const CATEGORY_COLORS = {
    Alimentación: '#69bd8c',
    Comida: '#69bd8c',
    Hogar: '#b69bd8',
    Servicios: '#69aabd',
    Efectivo: '#e3ad64',
    Transferencias: '#8b83c7',
    Compras: '#e98c70',
    Transporte: '#5ca9a0',
    Salud: '#cf7d9f',
    Ingresos: '#65b288',
    Sueldo: '#65b288',
    Otros: '#9ca9a1'
  };
  const PALETTE = ['#69bd8c', '#8b83c7', '#e3ad64', '#69aabd', '#e98c70', '#5ca9a0', '#cf7d9f'];

  function dateDaysAgo(days, hour = 12, minute = 0) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  }

  function dateInputValue(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function defaultEmailAlerts() {
    return { email: '', enabled: false, types: ['purchase', 'withdrawal', 'transfer', 'income'] };
  }

  function createSeedState() {
    return {
      openingBalance: 3500,
      currency: 'USD',
      emailAlerts: defaultEmailAlerts(),
      transactions: [
        { id: 'demo-1', title: 'Supermercado Verde', category: 'Alimentación', kind: 'purchase', amount: -84.25, date: dateDaysAgo(0, 10, 14), source: 'demo' },
        { id: 'demo-2', title: 'Nómina · octubre', category: 'Sueldo', kind: 'income', amount: 2450, date: dateDaysAgo(0, 8, 32), source: 'demo' },
        { id: 'demo-3', title: 'Transferencia a María', category: 'Transferencias', kind: 'transfer', amount: -120, date: dateDaysAgo(1, 15, 45), source: 'demo' },
        { id: 'demo-4', title: 'Café Nómada', category: 'Alimentación', kind: 'purchase', amount: -6.4, date: dateDaysAgo(1, 12, 8), source: 'demo' },
        { id: 'demo-5', title: 'Retiro en cajero', category: 'Efectivo', kind: 'withdrawal', amount: -60, date: dateDaysAgo(2, 9, 30), source: 'demo' },
        { id: 'demo-6', title: 'Mercado Verde', category: 'Alimentación', kind: 'purchase', amount: -43.7, date: dateDaysAgo(3, 20, 12), source: 'demo' },
        { id: 'demo-7', title: 'Internet hogar', category: 'Servicios', kind: 'purchase', amount: -55, date: dateDaysAgo(4, 15, 25), source: 'demo' },
        { id: 'demo-8', title: 'Transferencia recibida', category: 'Transferencias', kind: 'income', amount: 350, date: dateDaysAgo(5, 11, 0), source: 'demo' }
      ],
      smsHistory: []
    };
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return createSeedState();
      const value = JSON.parse(stored);
      if (!value || !Array.isArray(value.transactions)) return createSeedState();
      return {
        openingBalance: Number.isFinite(Number(value.openingBalance)) ? Number(value.openingBalance) : 0,
        currency: typeof value.currency === 'string' ? value.currency : 'USD',
        transactions: value.transactions.filter(item => item && Number.isFinite(Number(item.amount)) && TYPE_LABELS[item.kind]),
        smsHistory: Array.isArray(value.smsHistory) ? value.smsHistory : [],
        emailAlerts: {
          email: typeof value.emailAlerts?.email === 'string' ? value.emailAlerts.email : '',
          enabled: Boolean(value.emailAlerts?.enabled),
          types: Array.isArray(value.emailAlerts?.types) ? value.emailAlerts.types.filter(type => TYPE_LABELS[type]) : defaultEmailAlerts().types
        }
      };
    } catch (error) {
      return createSeedState();
    }
  }

  let state = loadState();
  let activeFilter = 'all';
  let activeView = 'overview';
  let balanceHidden = false;
  let previousFocus = null;

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast('No se pudo guardar en este navegador.', 'error');
    }
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function formatterOptions(options = {}) {
    const safeCurrency = /^[A-Z]{3}$/.test(state.currency) ? state.currency : 'USD';
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: safeCurrency, ...options });
  }

  function formatCurrency(amount) {
    try {
      return formatterOptions({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount) || 0);
    } catch (error) {
      return `$${(Number(amount) || 0).toFixed(2)}`;
    }
  }

  function formatSigned(amount) {
    const number = Number(amount) || 0;
    if (number > 0) return `+${formatCurrency(number)}`;
    if (number < 0) return `−${formatCurrency(Math.abs(number))}`;
    return formatCurrency(0);
  }

  function currencySymbol() {
    try {
      return formatterOptions().formatToParts(0).find(part => part.type === 'currency')?.value || '$';
    } catch (error) {
      return '$';
    }
  }

  function compactCurrency(amount) {
    try {
      return new Intl.NumberFormat('es-US', {
        style: 'currency', currency: state.currency, notation: 'compact', maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return `$${Math.round(amount)}`;
    }
  }

  function allTransactionsNewestFirst() {
    return [...state.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  function sumAmounts(transactions) {
    return transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }

  function getCurrentMonthTransactions() {
    const now = new Date();
    return state.transactions.filter(transaction => {
      const date = new Date(transaction.date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
  }

  function getBalance() {
    return Number(state.openingBalance || 0) + sumAmounts(state.transactions);
  }

  function sameLocalDay(first, second) {
    return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
  }

  function formatTransactionDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    const now = new Date();
    const time = new Intl.DateTimeFormat('es-US', { hour: '2-digit', minute: '2-digit' }).format(date);
    if (sameLocalDay(date, now)) return `Hoy, ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameLocalDay(date, yesterday)) return `Ayer, ${time}`;
    const dateLabel = new Intl.DateTimeFormat('es-US', { day: '2-digit', month: 'short' }).format(date).replace('.', '');
    return `${dateLabel}, ${time}`;
  }

  function getSourceLabel(source) {
    if (source === 'sms') return 'SMS';
    if (source === 'manual') return 'Manual';
    return 'Ejemplo';
  }

  function transactionRow(transaction) {
    const kind = TYPE_LABELS[transaction.kind] ? transaction.kind : 'purchase';
    const title = escapeHTML(transaction.title || TYPE_LABELS[kind]);
    const category = escapeHTML(transaction.category || 'Otros');
    const source = transaction.source || 'manual';
    const sourceClass = source === 'sms' ? 'source-sms' : '';
    const signedClass = Number(transaction.amount) >= 0 ? 'amount-positive' : 'amount-negative';
    return `<tr>
      <td><div class="txn-main"><span class="txn-icon txn-icon-${kind}">${TYPE_ICONS[kind]}</span><span class="txn-description"><strong title="${title}">${title}</strong><small>${category}</small></span></div></td>
      <td><span class="type-badge type-badge-${kind}">${TYPE_LABELS[kind]}</span></td>
      <td class="date-cell">${escapeHTML(formatTransactionDate(transaction.date))}</td>
      <td><span class="source-badge ${sourceClass}">${getSourceLabel(source)}</span></td>
      <td class="amount-cell ${signedClass}">${formatSigned(transaction.amount)}</td>
    </tr>`;
  }

  function renderTransactionTable(targetId, transactions, emptyId) {
    const body = document.getElementById(targetId);
    if (!body) return;
    body.innerHTML = transactions.map(transactionRow).join('');
    if (emptyId) {
      const empty = document.getElementById(emptyId);
      if (empty) empty.classList.toggle('hidden', transactions.length > 0);
    }
  }

  function renderDashboard() {
    const monthTransactions = getCurrentMonthTransactions();
    const incomeTransactions = monthTransactions.filter(transaction => Number(transaction.amount) > 0);
    const expenseTransactions = monthTransactions.filter(transaction => Number(transaction.amount) < 0);
    const income = sumAmounts(incomeTransactions);
    const expenses = Math.abs(sumAmounts(expenseTransactions));
    const totalBalance = getBalance();
    const monthCount = monthTransactions.length;

    $('#balanceValue').textContent = balanceHidden ? '••••••' : formatCurrency(totalBalance);
    $('#balanceIncome').textContent = formatCurrency(income);
    $('#balanceExpenses').textContent = formatCurrency(expenses);
    $('#metricIncome').textContent = formatCurrency(income);
    $('#metricExpenses').textContent = formatCurrency(expenses);
    $('#metricTransactions').textContent = String(monthCount).padStart(2, '0');
    $('#currencyLabel').textContent = state.currency;
    $('#demoNotice').classList.toggle('is-hidden', !state.transactions.some(transaction => transaction.source === 'demo'));

    const now = new Date();
    const dateLabel = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    $('#todayLabel').textContent = dateLabel.toLocaleUpperCase('es');

    const recent = allTransactionsNewestFirst().slice(0, 5);
    renderTransactionTable('recentTransactionRows', recent, 'recentEmpty');
    $('#recentTransactionRows').closest('.table-scroll').classList.toggle('hidden', recent.length === 0);
    renderWeeklyChart();
    renderCategories(expenseTransactions);
  }

  function renderWeeklyChart() {
    const container = $('#weeklyChart');
    const today = new Date();
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      date.setHours(0, 0, 0, 0);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const transactions = state.transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate.getFullYear() === date.getFullYear() && transactionDate.getMonth() === date.getMonth() && transactionDate.getDate() === date.getDate();
      });
      const income = transactions.reduce((sum, transaction) => sum + Math.max(0, Number(transaction.amount)), 0);
      const expense = transactions.reduce((sum, transaction) => sum + Math.abs(Math.min(0, Number(transaction.amount))), 0);
      const dayLabel = new Intl.DateTimeFormat('es-US', { weekday: 'short' }).format(date).replace('.', '').slice(0, 3);
      days.push({ date, key, dayLabel, income, expense, isToday: sameLocalDay(date, today) });
    }

    const maxValue = Math.max(0, ...days.map(day => Math.max(day.income, day.expense)));
    const scaleMax = maxValue === 0 ? 100 : Math.ceil(maxValue / 100) * 100;
    const ticks = [scaleMax, scaleMax / 2, 0];
    const net = days.reduce((sum, day) => sum + day.income - day.expense, 0);
    $('#chartTotal').textContent = formatSigned(net);
    const yAxis = `<div class="chart-y-axis">${ticks.map(value => `<span>${value === 0 ? '0' : escapeHTML(compactCurrency(value))}</span>`).join('')}</div>`;
    const lines = '<div class="chart-lines"><span></span><span></span><span></span></div>';
    const columns = days.map(day => {
      const incomeHeight = day.income > 0 ? Math.max(4, (day.income / scaleMax) * 100) : 2;
      const expenseHeight = day.expense > 0 ? Math.max(4, (day.expense / scaleMax) * 100) : 2;
      return `<div class="chart-column ${day.isToday ? 'is-today' : ''}" title="${escapeHTML(formatTransactionDate(day.date.toISOString()))}">
        <div class="chart-bars"><span class="chart-bar chart-bar-income" style="height:${incomeHeight}%" title="Ingresos: ${escapeHTML(formatCurrency(day.income))}"></span><span class="chart-bar chart-bar-expense" style="height:${expenseHeight}%" title="Gastos: ${escapeHTML(formatCurrency(day.expense))}"></span></div>
        <span class="chart-day">${escapeHTML(day.dayLabel)}</span>
      </div>`;
    }).join('');
    container.innerHTML = `<div class="chart-layout">${yAxis}<div class="chart-plot">${lines}${columns}</div></div>`;
  }

  function getCategoryColor(category, index) {
    return CATEGORY_COLORS[category] || PALETTE[index % PALETTE.length];
  }

  function renderCategories(expenseTransactions) {
    const container = $('#categoryContent');
    const totals = new Map();
    expenseTransactions.forEach(transaction => {
      const category = transaction.category || 'Otros';
      totals.set(category, (totals.get(category) || 0) + Math.abs(Number(transaction.amount)));
    });
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const overall = sorted.reduce((sum, item) => sum + item[1], 0);
    if (!overall) {
      container.innerHTML = '<div class="category-empty"><span>＋</span><p>Tus gastos por categoría aparecerán cuando registres un movimiento.</p></div>';
      return;
    }

    let categories = sorted;
    if (sorted.length > 4) {
      const top = sorted.slice(0, 3);
      const others = sorted.slice(3).reduce((sum, item) => sum + item[1], 0);
      categories = [...top, ['Otros', others]];
    }
    let offset = 0;
    const stops = categories.map(([category, amount], index) => {
      const start = offset;
      offset += (amount / overall) * 100;
      return `${getCategoryColor(category, index)} ${start.toFixed(2)}% ${offset.toFixed(2)}%`;
    }).join(', ');
    const legend = categories.map(([category, amount], index) => `
      <div class="category-item"><i class="category-dot" style="background:${getCategoryColor(category, index)}"></i><div class="category-item-copy"><span title="${escapeHTML(category)}">${escapeHTML(category)}</span><strong>${escapeHTML(formatCurrency(amount))}</strong></div></div>`).join('');
    container.innerHTML = `<div class="category-layout"><div class="donut-chart" style="--donut:conic-gradient(${stops})"><div class="donut-hole"><small>GASTOS</small><strong>${escapeHTML(formatCurrency(overall))}</strong></div></div><div class="category-legend">${legend}</div></div>`;
  }

  function renderTransactionsView() {
    const transactions = allTransactionsNewestFirst();
    const filtered = transactions.filter(transaction => {
      const matchesType = activeFilter === 'all' || transaction.kind === activeFilter;
      const query = ($('#transactionSearch')?.value || '').trim().toLocaleLowerCase('es');
      const matchesSearch = !query || `${transaction.title || ''} ${transaction.category || ''} ${transaction.kind || ''} ${getSourceLabel(transaction.source)}`.toLocaleLowerCase('es').includes(query);
      return matchesType && matchesSearch;
    });
    renderTransactionTable('allTransactionRows', filtered, 'allEmpty');
    $('#allTransactionRows').closest('.table-scroll').classList.toggle('hidden', filtered.length === 0);
    $('#allCount').textContent = String(transactions.length);
    $('#transactionsBalance').textContent = balanceHidden ? '••••••' : formatCurrency(getBalance());
    const monthTransactions = getCurrentMonthTransactions();
    $('#transactionsIncome').textContent = formatCurrency(sumAmounts(monthTransactions.filter(item => Number(item.amount) > 0)));
    $('#transactionsExpenses').textContent = formatCurrency(Math.abs(sumAmounts(monthTransactions.filter(item => Number(item.amount) < 0))));
    $$('.filter-tab').forEach(button => {
      const isActive = button.dataset.filter === activeFilter;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });
  }

  function renderSmsHistory() {
    const history = [...state.smsHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    $('#smsHistoryCount').textContent = String(history.length);
    const container = $('#smsHistoryList');
    if (!history.length) {
      container.innerHTML = '<div class="sms-empty"><span class="sms-empty-icon">✉</span><strong>No has importado mensajes todavía</strong><p>Pega un SMS de tu banco y aquí verás el texto procesado y el movimiento que se añadió.</p></div>';
      return;
    }
    container.innerHTML = history.map(message => `<div class="sms-history-item">
      <span class="sms-history-symbol">${TYPE_LABELS[message.kind] === 'Ingreso' ? '↑' : '↗'}</span>
      <span class="sms-history-copy"><strong>${escapeHTML(message.title || TYPE_LABELS[message.kind] || 'Mensaje bancario')}</strong><small>${escapeHTML(formatTransactionDate(message.date))} · ${escapeHTML(message.raw || '')}</small></span>
      <span class="sms-history-amount ${Number(message.amount) < 0 ? 'amount-negative' : ''}">${formatSigned(message.amount)}</span>
    </div>`).join('');
  }

  function renderSettings() {
    $('#openingBalanceInput').value = Number(state.openingBalance || 0).toFixed(2);
    $('#currencySelect').value = state.currency;
    $('#settingsCurrencyMark').textContent = currencySymbol();
    $('#settingsSaved').textContent = '';
    const emailAlerts = state.emailAlerts || defaultEmailAlerts();
    $('#notificationEmail').value = emailAlerts.email || '';
    $('#emailAlertsEnabled').checked = Boolean(emailAlerts.enabled);
    $$('input[name="emailType"]').forEach(input => { input.checked = emailAlerts.types.includes(input.value); });
    $('#emailAlertStatus').textContent = emailAlerts.enabled
      ? 'Preferencia activa, pero no se enviarán correos hasta conectar un proveedor seguro.'
      : 'El prototipo todavía no envía correos. Se necesita conectar un proveedor seguro.';
  }

  function renderAll() {
    renderDashboard();
    renderTransactionsView();
    renderSmsHistory();
    if (activeView === 'settings') renderSettings();
  }

  const VIEW_LABELS = { overview: 'Resumen', transactions: 'Movimientos', sms: 'Mensajes SMS', settings: 'Configuración' };
  function goToView(viewName) {
    if (!VIEW_LABELS[viewName]) return;
    activeView = viewName;
    $$('.view').forEach(section => {
      const isCurrent = section.dataset.viewPanel === viewName;
      section.hidden = !isCurrent;
      section.classList.toggle('is-visible', isCurrent);
    });
    $$('.nav-link').forEach(link => link.classList.toggle('is-active', link.dataset.view === viewName));
    $('#breadcrumbCurrent').textContent = VIEW_LABELS[viewName];
    if (viewName === 'settings') renderSettings();
    if (viewName === 'transactions') renderTransactionsView();
    if (viewName === 'sms') renderSmsHistory();
    $('#sidebar').classList.remove('is-open');
    $('#sidebarScrim').classList.remove('is-visible');
    if (window.innerWidth < 900) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showToast(message, type = 'success') {
    const region = $('#toastRegion');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'is-error' : ''}`;
    toast.innerHTML = `<span class="toast-icon">${type === 'error' ? '!' : '✓'}</span><span>${escapeHTML(message)}</span>`;
    region.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 3800);
  }

  function openModal(content) {
    previousFocus = document.activeElement;
    $('#modalPanel').innerHTML = content;
    $('#modalBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => {
      const firstControl = $('#modalPanel input, #modalPanel select, #modalPanel textarea, #modalPanel button');
      (firstControl || $('#modalPanel')).focus();
    }, 20);
  }

  function closeModal() {
    $('#modalBackdrop').hidden = true;
    document.body.style.overflow = '';
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  function modalHeader(kicker, title, description = '') {
    return `<div class="modal-header"><div><p class="panel-kicker">${escapeHTML(kicker)}</p><h2 id="modalTitle">${escapeHTML(title)}</h2>${description ? `<p>${escapeHTML(description)}</p>` : ''}</div><button class="modal-close" type="button" data-close-modal aria-label="Cerrar"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>`;
  }

  function openTransactionModal() {
    const today = dateInputValue();
    openModal(`${modalHeader('REGISTRO MANUAL', 'Nuevo movimiento', 'Anota una compra, retiro, transferencia o ingreso para actualizar tu balance.')}
      <form class="modal-form" id="transactionForm">
        <div class="form-field"><label class="field-label" for="transactionKind">Tipo de movimiento</label><select id="transactionKind" name="kind" required><option value="purchase">Compra / gasto</option><option value="withdrawal">Retiro de efectivo</option><option value="transfer">Transferencia enviada</option><option value="income">Ingreso recibido</option></select></div>
        <div class="form-field"><label class="field-label" for="transactionTitle">Descripción</label><input id="transactionTitle" name="title" type="text" maxlength="60" placeholder="Ej. Supermercado, cajero, nómina" required></div>
        <div class="form-row">
          <div class="form-field"><label class="field-label" for="transactionAmount">Monto</label><div class="amount-field-wrap"><span>${escapeHTML(currencySymbol())}</span><input id="transactionAmount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00" required></div></div>
          <div class="form-field"><label class="field-label" for="transactionCategory">Categoría</label><input id="transactionCategory" name="category" type="text" maxlength="30" placeholder="Ej. Alimentación" value="Otros"></div>
        </div>
        <div class="form-field"><label class="field-label" for="transactionDate">Fecha</label><input id="transactionDate" name="date" type="date" value="${today}" required></div>
        <p class="modal-helper"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5"/><path d="M10 9v4M10 6.5h.01"/></svg>Los gastos reducen el balance; los ingresos lo aumentan.</p>
        <div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">Guardar movimiento</button></div>
      </form>`);
  }

  const SMS_EXAMPLES = {
    purchase: 'Compra aprobada por $42.80 en Mercado Verde. Saldo disponible $5,930.65.',
    withdrawal: 'Retiro de efectivo por $60.00 en Cajero Centro.',
    transfer: 'Transferiste $125.00 a Maria Lopez.',
    income: 'Recibiste una transferencia de $500.00.'
  };

  function openSmsModal() {
    openModal(`${modalHeader('IMPORTAR NOTIFICACIÓN', 'Pega el mensaje SMS', 'Detectaremos el tipo de movimiento y el monto. Revisa la vista previa antes de añadirlo.')}
      <form class="modal-form" id="smsForm">
        <div class="form-field"><label class="field-label" for="smsText">Texto del mensaje</label><textarea id="smsText" name="smsText" maxlength="1000" placeholder="Ej. Compra aprobada por $25.90 en Tienda Central..." required></textarea></div>
        <div class="sms-example-row"><p class="sms-example-label">PRUEBA CON UN EJEMPLO</p><button class="example-chip" type="button" data-sms-example="purchase">Compra</button><button class="example-chip" type="button" data-sms-example="withdrawal">Retiro</button><button class="example-chip" type="button" data-sms-example="transfer">Transferencia</button><button class="example-chip" type="button" data-sms-example="income">Ingreso</button></div>
        <div id="smsParsePreview" class="sms-parse-preview"><span class="sms-preview-icon">i</span><span class="sms-preview-copy"><strong>La vista previa aparecerá aquí</strong><span>El mensaje no se guardará hasta que confirmes.</span></span></div>
        <p class="modal-helper"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 16 5v4.4c0 3.7-2.5 6.5-6 8.1-3.5-1.6-6-4.4-6-8.1V5l6-2.5Z"/><path d="m7.4 9.8 1.7 1.7 3.6-3.7"/></svg>No compartas números completos de tarjeta, contraseñas ni códigos de seguridad.</p>
        <div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancelar</button><button class="button button-primary" id="importSmsSubmit" type="submit" disabled>Registrar movimiento</button></div>
      </form>`);
  }

  function openIntegrationGuide() {
    openModal(`${modalHeader('CONEXIÓN Y PRIVACIDAD', 'Automatizar la lectura de SMS', 'La versión actual es un prototipo local: no está conectada a un banco ni a tu número de teléfono.')}
      <div class="modal-copy"><p>Una página web abierta en el navegador no puede leer la bandeja de SMS del celular ni confirmar el saldo de una cuenta por sí sola.</p><div class="guide-callout"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5.5c0 4.6-3.4 8.1-8 9.8-4.6-1.7-8-5.2-8-9.8V6l8-3Z"/><path d="m8.7 12 2.1 2.1 4.6-4.7"/></svg><span><strong>Para hacerlo automáticamente</strong>, hay que conectar un servicio compatible mediante una app móvil o una API bancaria/SMS, con autorización, un backend seguro y validaciones contra duplicados.</span></div><ul><li>Por ahora, pega la notificación aquí y saldo intentará extraer el tipo y el monto.</li><li>El balance de esta página se calcula con el saldo inicial y los movimientos registrados; no es una consulta bancaria en tiempo real.</li><li>No introduzcas PIN, claves, códigos de un solo uso ni datos completos de tarjeta.</li></ul></div>
      <div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Entendido</button><button class="button button-primary" type="button" data-modal-action="open-sms">Pegar un SMS</button></div>`);
  }

  function openEmailIntegrationGuide() {
    openModal(`${modalHeader('AVISOS POR CORREO', 'Conectar el envío de alertas', 'Tus preferencias pueden guardarse aquí, pero todavía no sale ningún correo desde este prototipo.')}
      <div class="modal-copy"><p>El navegador no debe enviar correos directamente ni guardar claves de un proveedor. Para activar avisos automáticos se necesita un servicio de correo transaccional y un endpoint seguro en el servidor.</p><div class="guide-callout"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5.5c0 4.6-3.4 8.1-8 9.8-4.6-1.7-8-5.2-8-9.8V6l8-3Z"/><path d="m8.7 12 2.1 2.1 4.6-4.7"/></svg><span><strong>Configuración requerida:</strong> conectar un proveedor de correo con la clave guardada solo en el servidor, verificar la dirección destinataria y enviar el aviso después de registrar cada movimiento.</span></div><ul><li>La dirección y los tipos de aviso que elijas se guardan en este navegador.</li><li>Las alertas no se enviarán hasta que exista una conexión segura de correo.</li><li>No compartas contraseñas de email ni claves de API en esta página.</li></ul></div>
      <div class="modal-actions"><button class="button button-primary" type="button" data-close-modal>Entendido</button></div>`);
  }

  function openConfirmation(kind) {
    if (kind === 'clear-examples') {
      openModal(`${modalHeader('EMPEZAR CON TUS DATOS', 'Quitar movimientos de ejemplo', 'Solo se borrarán los ejemplos. Tus movimientos manuales y SMS importados se conservarán.')}
        <div class="modal-copy"><p>El saldo inicial se pondrá en cero. Después puedes establecer tu saldo real de partida desde Configuración.</p></div>
        <div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="button" data-modal-action="clear-examples">Empezar de cero</button></div>`);
    } else {
      openModal(`${modalHeader('RESTABLECER PROTOTIPO', '¿Borrar los datos guardados?', 'Se eliminarán los movimientos, ajustes, preferencias de correo y mensajes SMS guardados en este navegador.')}
        <div class="modal-copy"><p>Se cargarán de nuevo los datos de demostración. Esta acción no se puede deshacer.</p></div>
        <div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancelar</button><button class="button button-danger-outline" type="button" data-modal-action="reset-demo">Restablecer datos</button></div>`);
    }
  }

  function parseAmount(raw) {
    let value = String(raw).trim().replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(/[.,]+$/, '');
    if (!value) return NaN;
    const lastDot = value.lastIndexOf('.');
    const lastComma = value.lastIndexOf(',');
    if (lastDot !== -1 && lastComma !== -1) {
      const decimalSeparator = lastDot > lastComma ? '.' : ',';
      const groupingSeparator = decimalSeparator === '.' ? ',' : '.';
      value = value.split(groupingSeparator).join('');
      if (decimalSeparator === ',') value = value.replace(',', '.');
    } else if (lastDot !== -1 || lastComma !== -1) {
      const separator = lastDot !== -1 ? '.' : ',';
      const lastIndex = value.lastIndexOf(separator);
      const decimals = value.length - lastIndex - 1;
      if (decimals === 2 || decimals === 1) {
        value = value.slice(0, lastIndex).split(separator).join('') + '.' + value.slice(lastIndex + 1);
      } else {
        value = value.split(separator).join('');
      }
    }
    return Number.parseFloat(value);
  }

  function extractAmount(text) {
    const currencyMatch = text.match(/(?:RD\s?\$|US\s?\$|[$€£]|\b(?:USD|MXN|COP|DOP|EUR|ARS|CLP)\b)\s*([0-9][0-9.,]*)/i);
    if (currencyMatch) {
      const parsed = parseAmount(currencyMatch[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
    const contextualMatch = text.match(/\b(?:por|de|monto(?:\s+de)?|total(?:\s+de)?|amount(?:\s+of)?|retiraste|transferiste|enviaste|compra\s+de)\s+(?:RD\s?\$|US\s?\$|[$€£])?\s*([0-9][0-9.,]*)/i);
    if (contextualMatch) {
      const parsed = parseAmount(contextualMatch[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
    const currencyAfterMatch = text.match(/([0-9][0-9.,]*)\s*(?:USD|MXN|COP|DOP|EUR|ARS|CLP)\b/i);
    if (currencyAfterMatch) return parseAmount(currencyAfterMatch[1]);
    return NaN;
  }

  function cleanEntity(value) {
    return String(value || '')
      .replace(/\s+(?:por|de|con tarjeta|saldo disponible|saldo|balance|ref(?:erencia)?|autorizaci[oó]n)\b.*$/i, '')
      .replace(/\s+[$€£].*$/, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s:–—-]+|[\s:–—-]+$/g, '')
      .trim()
      .slice(0, 45);
  }

  function parseSms(rawText) {
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!text) return { error: 'Pega el texto de una notificación para comenzar.' };
    const amount = extractAmount(text);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'No encontramos un monto. Asegúrate de que el SMS incluya una cantidad, por ejemplo $25.90.' };

    const incoming = /\b(recibiste|recibi[oó]|recibido|dep[oó]sito|abon[oó]|abono|cr[eé]dito|ingreso|received|credited|transferencia\s+recibid[ao])\b/i.test(text);
    const purchase = /\b(compra|compraste|consumo|purchase|card\s+purchase)\b/i.test(text);
    const withdrawal = /\b(retiro|retiraste|retir[oó]|cajero|atm|withdrawal|cash\s+withdrawal)\b/i.test(text);
    const transfer = /\b(transferencia|transferiste|transferir|enviaste|env[ií]o|transfer|sent\s+to)\b/i.test(text);
    let kind;
    if (incoming) kind = 'income';
    else if (purchase) kind = 'purchase';
    else if (withdrawal) kind = 'withdrawal';
    else if (transfer) kind = 'transfer';
    else return { error: 'No pudimos identificar si es una compra, retiro, transferencia o ingreso. Revisa el mensaje.' };

    let title = '';
    let category = '';
    if (kind === 'purchase') {
      const match = text.match(/\b(?:en|at|comercio|merchant)\s+([^.;\n]+)/i);
      const merchant = match ? cleanEntity(match[1]) : '';
      title = merchant || 'Compra con tarjeta';
      category = 'Compras';
    } else if (kind === 'withdrawal') {
      const match = text.match(/\b(?:en|from|at)\s+([^.;\n]+)/i);
      const place = match ? cleanEntity(match[1]) : '';
      title = place ? `Retiro · ${place}` : 'Retiro de efectivo';
      category = 'Efectivo';
    } else if (kind === 'transfer') {
      const match = text.match(/\b(?:transferencia|transferiste|transferir|enviaste|env[ií]o|transfer)\b.*?\b(?:a|para|to)\s+([^.;,\n]+)/i);
      const recipient = match ? cleanEntity(match[1]) : '';
      title = recipient ? `Transferencia a ${recipient}` : 'Transferencia enviada';
      category = 'Transferencias';
    } else {
      title = /transferencia/i.test(text) ? 'Transferencia recibida' : 'Ingreso recibido';
      category = /transferencia/i.test(text) ? 'Transferencias' : 'Ingresos';
    }

    const signedAmount = kind === 'income' ? amount : -amount;
    return { kind, amount: signedAmount, title, category, raw: text };
  }

  function updateSmsPreview() {
    const textarea = $('#smsText');
    const preview = $('#smsParsePreview');
    const submit = $('#importSmsSubmit');
    if (!textarea || !preview || !submit) return;
    const parsed = parseSms(textarea.value);
    if (parsed.error) {
      const hasText = textarea.value.trim().length > 0;
      preview.className = `sms-parse-preview ${hasText ? 'is-invalid' : ''}`;
      preview.innerHTML = `<span class="sms-preview-icon">${hasText ? '!' : 'i'}</span><span class="sms-preview-copy"><strong>${hasText ? 'No se pudo leer el mensaje' : 'La vista previa aparecerá aquí'}</strong><span>${escapeHTML(hasText ? parsed.error : 'El mensaje no se guardará hasta que confirmes.')}</span></span>`;
      submit.disabled = true;
      return;
    }
    preview.className = 'sms-parse-preview is-valid';
    preview.innerHTML = `<span class="sms-preview-icon">✓</span><span class="sms-preview-copy"><strong>${TYPE_LABELS[parsed.kind]} · ${escapeHTML(parsed.title)}</strong><span>${escapeHTML(formatSigned(parsed.amount))} se ${parsed.amount < 0 ? 'restará' : 'sumará'} a tu balance.</span></span>`;
    submit.disabled = false;
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function notifyMovementSaved(transaction, defaultMessage) {
    const settings = state.emailAlerts || defaultEmailAlerts();
    const shouldNotify = settings.enabled && settings.types.includes(transaction.kind);
    if (!shouldNotify) {
      showToast(defaultMessage);
      return;
    }
    const destination = settings.email ? ` a ${settings.email}` : '';
    showToast(`${defaultMessage} No se envió el correo${destination}: falta conectar el servicio de envío.`, 'error');
  }

  function importSmsMessage(rawText) {
    const parsed = parseSms(rawText);
    if (parsed.error) {
      showToast(parsed.error, 'error');
      return false;
    }
    const normalized = parsed.raw.toLocaleLowerCase('es');
    if (state.smsHistory.some(message => String(message.raw || '').toLocaleLowerCase('es') === normalized)) {
      showToast('Ese mensaje ya se había importado.', 'error');
      return false;
    }
    const date = new Date().toISOString();
    const transaction = {
      id: createId('sms'),
      title: parsed.title,
      category: parsed.category,
      kind: parsed.kind,
      amount: parsed.amount,
      date,
      source: 'sms'
    };
    state.transactions.push(transaction);
    state.smsHistory.push({ id: transaction.id, raw: parsed.raw, title: parsed.title, kind: parsed.kind, amount: parsed.amount, date });
    persistState();
    renderAll();
    notifyMovementSaved(transaction, 'SMS procesado; el balance ya está actualizado.');
    return true;
  }

  function handleManualTransaction(form) {
    const formData = new FormData(form);
    const kind = String(formData.get('kind'));
    const amountInput = Number(formData.get('amount'));
    const date = String(formData.get('date'));
    if (!TYPE_LABELS[kind] || !Number.isFinite(amountInput) || amountInput <= 0 || !date) {
      showToast('Revisa el tipo, el monto y la fecha.', 'error');
      return false;
    }
    const amount = kind === 'income' ? amountInput : -amountInput;
    const dateObject = new Date(`${date}T12:00:00`);
    const transaction = {
      id: createId('manual'),
      title: String(formData.get('title') || '').trim(),
      category: String(formData.get('category') || '').trim() || 'Otros',
      kind,
      amount,
      date: dateObject.toISOString(),
      source: 'manual'
    };
    state.transactions.push(transaction);
    persistState();
    renderAll();
    notifyMovementSaved(transaction, 'Movimiento guardado y balance actualizado.');
    return true;
  }

  function clearExamples() {
    state.transactions = state.transactions.filter(transaction => transaction.source !== 'demo');
    state.openingBalance = 0;
    persistState();
    renderAll();
    showToast('Listo. Configura tu saldo inicial en Ajustes.');
  }

  function resetDemoData() {
    state = createSeedState();
    activeFilter = 'all';
    persistState();
    renderAll();
    showToast('Se cargaron de nuevo los datos de demostración.');
  }

  // Navegación entre secciones.
  document.addEventListener('click', event => {
    const viewControl = event.target.closest('[data-view]');
    if (viewControl) {
      event.preventDefault();
      goToView(viewControl.dataset.view);
      return;
    }
    const actionControl = event.target.closest('[data-action]');
    if (actionControl) {
      const action = actionControl.dataset.action;
      if (action === 'add-transaction') openTransactionModal();
      if (action === 'import-sms') openSmsModal();
    }
  });

  $$('.filter-tab').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    renderTransactionsView();
  }));

  $('#globalSearch').addEventListener('input', event => {
    const query = event.target.value.trim();
    if (query && activeView !== 'transactions') goToView('transactions');
    if (activeView === 'transactions') {
      $('#transactionSearch').value = query;
      renderTransactionsView();
    }
  });
  $('#transactionSearch').addEventListener('input', renderTransactionsView);
  $('#transactionSearch').addEventListener('input', event => { $('#globalSearch').value = event.target.value; });

  document.addEventListener('keydown', event => {
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (event.key === '/' && !isTyping && !$('#modalBackdrop').hidden) return;
    if (event.key === '/' && !isTyping) {
      event.preventDefault();
      $('#globalSearch').focus();
    }
    if (event.key === 'Escape' && !$('#modalBackdrop').hidden) closeModal();
  });

  $('#mobileMenu').addEventListener('click', () => {
    $('#sidebar').classList.add('is-open');
    $('#sidebarScrim').classList.add('is-visible');
  });
  $('#sidebarScrim').addEventListener('click', () => {
    $('#sidebar').classList.remove('is-open');
    $('#sidebarScrim').classList.remove('is-visible');
  });

  $('#toggleBalance').addEventListener('click', () => {
    balanceHidden = !balanceHidden;
    renderDashboard();
    renderTransactionsView();
    const button = $('#toggleBalance');
    button.setAttribute('aria-label', balanceHidden ? 'Mostrar balance' : 'Ocultar balance');
    button.title = balanceHidden ? 'Mostrar balance' : 'Ocultar balance';
    button.innerHTML = balanceHidden
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3 21 21"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.9A9.8 9.8 0 0 1 12 5.7c6.1 0 9.5 6.3 9.5 6.3a16 16 0 0 1-2.4 3.1M6.2 6.3C3.8 8 2.5 12 2.5 12s3.4 6.3 9.5 6.3c1.1 0 2.1-.2 3-.6"/></svg>'
      : '<svg class="eye-open" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
  });

  $('#connectSms').addEventListener('click', openIntegrationGuide);
  $('#helpButton').addEventListener('click', openIntegrationGuide);
  $('#smsLearnMore').addEventListener('click', openIntegrationGuide);
  $('#settingsIntegration').addEventListener('click', openIntegrationGuide);
  $('#emailLearnMore').addEventListener('click', openEmailIntegrationGuide);
  $('#accountSwitcher').addEventListener('click', () => showToast('Esta vista usa una cuenta de ejemplo.'));
  $('#profileMenu').addEventListener('click', () => goToView('settings'));
  $('#clearDemoData').addEventListener('click', () => openConfirmation('clear-examples'));
  $('#resetDemo').addEventListener('click', () => openConfirmation('reset-demo'));

  $('#settingsForm').addEventListener('submit', event => {
    event.preventDefault();
    const openingBalance = Number($('#openingBalanceInput').value);
    const currency = $('#currencySelect').value;
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      showToast('El saldo inicial debe ser cero o mayor.', 'error');
      return;
    }
    state.openingBalance = openingBalance;
    state.currency = currency;
    persistState();
    renderAll();
    $('#settingsSaved').textContent = 'Cambios guardados';
    showToast('Ajustes guardados.');
  });
  $('#emailSettingsForm').addEventListener('submit', event => {
    event.preventDefault();
    const email = $('#notificationEmail').value.trim();
    const enabled = $('#emailAlertsEnabled').checked;
    const types = $$('input[name="emailType"]:checked').map(input => input.value);
    if (enabled && !email) {
      showToast('Escribe el correo donde quieres recibir los avisos.', 'error');
      $('#notificationEmail').focus();
      return;
    }
    if (enabled && !types.length) {
      showToast('Selecciona al menos un tipo de movimiento.', 'error');
      return;
    }
    state.emailAlerts = { email, enabled, types };
    persistState();
    $('#emailAlertStatus').textContent = enabled
      ? 'Preferencias guardadas. No se enviarán mensajes hasta conectar un proveedor de correo.'
      : 'Preferencias guardadas localmente. Los avisos por correo están desactivados.';
    showToast(enabled
      ? 'Preferencias guardadas; el envío de correo sigue sin conectar.'
      : 'Preferencias de correo guardadas.');
  });
  $('#currencySelect').addEventListener('change', event => {
    const selectedCurrency = event.target.value;
    try {
      $('#settingsCurrencyMark').textContent = new Intl.NumberFormat('es-US', { style: 'currency', currency: selectedCurrency }).formatToParts(0).find(part => part.type === 'currency')?.value || '$';
    } catch (error) {
      $('#settingsCurrencyMark').textContent = '$';
    }
  });

  $('#modalBackdrop').addEventListener('click', event => {
    if (event.target === $('#modalBackdrop')) closeModal();
  });
  $('#modalPanel').addEventListener('click', event => {
    if (event.target.closest('[data-close-modal]')) {
      closeModal();
      return;
    }
    const exampleButton = event.target.closest('[data-sms-example]');
    if (exampleButton) {
      $('#smsText').value = SMS_EXAMPLES[exampleButton.dataset.smsExample] || '';
      updateSmsPreview();
      $('#smsText').focus();
      return;
    }
    const modalAction = event.target.closest('[data-modal-action]')?.dataset.modalAction;
    if (modalAction === 'open-sms') {
      closeModal();
      openSmsModal();
    } else if (modalAction === 'clear-examples') {
      closeModal();
      clearExamples();
    } else if (modalAction === 'reset-demo') {
      closeModal();
      resetDemoData();
    }
  });
  $('#modalPanel').addEventListener('input', event => {
    if (event.target.id === 'smsText') updateSmsPreview();
  });
  $('#modalPanel').addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.id === 'transactionForm') {
      if (handleManualTransaction(event.target)) closeModal();
    } else if (event.target.id === 'smsForm') {
      const imported = importSmsMessage($('#smsText').value);
      if (imported) closeModal();
    }
  });

  // Atajo de teclado para abrir la búsqueda.
  $('#globalSearch').addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.target.value = '';
      if (activeView === 'transactions') {
        $('#transactionSearch').value = '';
        renderTransactionsView();
      }
      event.target.blur();
    }
  });

  renderAll();
})();
