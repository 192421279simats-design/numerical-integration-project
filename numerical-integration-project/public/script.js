/* ── Constants ── */
const API_BASE = 'http://127.0.0.1:5000';

const SAMPLES = {
  urban: [
    { label: 'Road density', values: '12, 18, 25, 30, 28, 35, 40, 38, 42, 45', step: '1' },
    { label: 'Population', values: '100, 150, 220, 310, 400, 480, 530, 590, 650, 700', step: '5' },
    { label: 'Infrastructure', values: '5, 8, 14, 20, 18, 25, 30, 27, 35, 40', step: '2' },
  ],
  finance: [
    { label: 'Quarterly ROI', values: '2.5, 3.1, 2.8, 4.2, 5.0, 4.7, 6.1, 5.8, 7.2, 8.0', step: '1' },
    { label: 'Stock growth', values: '100, 108, 115, 112, 125, 138, 145, 152, 160, 175', step: '3' },
    { label: 'Yield curve', values: '1.5, 2.0, 2.5, 3.0, 3.2, 3.5, 3.8, 4.0, 4.1, 4.3', step: '0.5' },
  ],
};

/* Chart state */
let integrationChart = null;
const chartState = { urban: null, finance: null };

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  initSamples();
  initChart();
  checkBackendHealth();
  animateStats();
});

/* ── Sample data chips ── */
function initSamples() {
  ['urban', 'finance'].forEach(mod => {
    const container = document.getElementById(`samples-${mod}`);
    SAMPLES[mod].forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'sample-chip';
      chip.textContent = s.label;
      chip.title = s.values;
      chip.addEventListener('click', () => {
        document.getElementById(`input-${mod}`).value = s.values;
        document.getElementById(`step-${mod}`).value  = s.step;
      });
      container.appendChild(chip);
    });
  });
}

/* ── Chart ── */
function initChart() {
  const ctx = document.getElementById('integrationChart').getContext('2d');
  integrationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Urban — Input Values',
          data: [],
          borderColor: '#c94f1e',
          backgroundColor: 'rgba(201,79,30,0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#c94f1e',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Urban — Cumulative Area',
          data: [],
          borderColor: '#e8a020',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 2,
          tension: 0.35,
        },
        {
          label: 'Finance — Input Values',
          data: [],
          borderColor: '#1a6b8a',
          backgroundColor: 'rgba(26,107,138,0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#1a6b8a',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
        },
        {
          label: 'Finance — Cumulative Area',
          data: [],
          borderColor: '#0fa3b1',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 2,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0b0c10',
          titleFont: { family: 'DM Mono', size: 11 },
          bodyFont:  { family: 'DM Mono', size: 11 },
          padding: 12,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { family: 'DM Mono', size: 10 }, color: '#6b6f7a' },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { family: 'DM Mono', size: 10 }, color: '#6b6f7a' },
        },
      },
    },
  });
}

function updateChart(module, values, cumulative) {
  chartState[module] = { values, cumulative };

  // Build unified label set based on largest dataset
  const allValues = Object.values(chartState)
    .filter(Boolean)
    .map(s => s.values.length);
  const maxLen = Math.max(...allValues, 0);
  const labels = Array.from({ length: maxLen }, (_, i) => `t${i}`);

  integrationChart.data.labels = labels;

  if (module === 'urban') {
    integrationChart.data.datasets[0].data = values;
    integrationChart.data.datasets[1].data = cumulative;
  } else {
    integrationChart.data.datasets[2].data = values;
    integrationChart.data.datasets[3].data = cumulative;
  }

  integrationChart.update('active');
}

/* ── Health check ── */
async function checkBackendHealth() {
  const indicator = document.getElementById('backend-status');
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      indicator.textContent = '● API Connected';
      indicator.style.color = '#2ecc71';
    } else throw new Error();
  } catch {
    indicator.textContent = '● API Offline — start Flask server';
    indicator.style.color = '#c94f1e';
  }
}

/* ── Core calculation ── */
async function calculate(module) {
  const btn      = document.getElementById(`btn-${module}`);
  const inputEl  = document.getElementById(`input-${module}`);
  const stepEl   = document.getElementById(`step-${module}`);
  const resultEl = document.getElementById(`results-${module}`);
  const errorEl  = document.getElementById(`error-${module}`);

  // Reset
  errorEl.classList.remove('visible');
  resultEl.classList.remove('visible');

  const rawInput = inputEl.value.trim();
  if (!rawInput) {
    showError(errorEl, 'Please enter at least 2 comma-separated numeric values.');
    return;
  }

  const step = parseFloat(stepEl.value) || 1.0;

  // Loading state
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/integrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rawInput, step, module }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(errorEl, data.error || 'Calculation failed.');
      return;
    }

    // Render results
    renderResults(module, data);
    updateChart(module, data.input_values, data.cumulative);

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      showError(errorEl, 'Request timed out. Is the Flask server running at port 5000?');
    } else if (err.message.includes('fetch')) {
      showError(errorEl, 'Cannot connect to API. Run: python app.py');
    } else {
      showError(errorEl, `Error: ${err.message}`);
    }
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function renderResults(module, data) {
  document.getElementById(`trap-${module}`).textContent    = data.trapezoidal.toLocaleString();
  document.getElementById(`simp-${module}`).textContent    = data.simpsons.toLocaleString();
  document.getElementById(`pts-${module}`).textContent     = `${data.input_values.length} pts`;
  document.getElementById(`mean-${module}`).textContent    = `μ = ${data.mean_value}`;
  document.getElementById(`range-${module}`).textContent   = `[${data.min_value}, ${data.max_value}]`;
  document.getElementById(`results-${module}`).classList.add('visible');
}

function showError(el, msg) {
  el.textContent = '⚠ ' + msg;
  el.classList.add('visible');
}

/* ── Animated counters ── */
function animateStats() {
  const targets = { 'stat-methods': 2, 'stat-accuracy': 98, 'stat-modules': 2 };
  Object.entries(targets).forEach(([id, end]) => {
    const el = document.getElementById(id);
    if (!el) return;
    let start = 0;
    const step = end / 40;
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      el.textContent = Math.floor(start) + (id === 'stat-accuracy' ? '%' : '');
      if (start >= end) clearInterval(timer);
    }, 30);
  });
}

/* ── Smooth scroll helper ── */
function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
