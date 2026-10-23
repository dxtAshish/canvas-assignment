import { h } from '../../../../utils/dom.js';
import { Chart, registerables } from 'chart.js';
import { chartDataApi } from '../../../../api/chartData.api.js';
import { CHART_PALETTE } from '../../config.js';

Chart.register(...registerables);

const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export function defaultChartContent(chartType) {
  return {
    chartType,
    title: chartType === 'bar' ? 'Sales by quarter' : 'Live visitors',
    source: chartType === 'bar' ? 'manual' : 'dynamic',
    dataset: chartType === 'bar' ? 'sales' : 'traffic',
    points: chartType === 'bar' ? 4 : 12,
    refreshSeconds: chartType === 'bar' ? 0 : 10,
    labels: chartType === 'bar' ? ['Q1', 'Q2', 'Q3', 'Q4'] : [],
    series: chartType === 'bar'
      ? [{ label: 'Revenue', color: CHART_PALETTE[0], data: [120, 150, 135, 180] }]
      : [{ label: 'Visitors', color: CHART_PALETTE[1], data: [] }],
  };
}

/** Builds Chart.js datasets by combining data values with the element's series styling. */
function toDatasets(content, seriesData) {
  return seriesData.map((series, i) => {
    const style = content.series[i] || {};
    const color = style.color || CHART_PALETTE[i % CHART_PALETTE.length];
    return {
      label: style.label || series.label || `Series ${i + 1}`,
      data: series.data,
      borderColor: color,
      backgroundColor: content.chartType === 'bar' ? hexToRgba(color, 0.85) : hexToRgba(color, 0.15),
      borderWidth: 2,
      borderRadius: content.chartType === 'bar' ? 4 : 0,
      fill: content.chartType === 'line',
      tension: 0.35,
      pointRadius: 2,
    };
  });
}

function buildOptions(content) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    plugins: {
      title: { display: Boolean(content.title), text: content.title, font: { size: 13, weight: '600' } },
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { beginAtZero: true, ticks: { font: { size: 11 } } },
    },
  };
}

export const chartElement = {
  label: 'Chart',

  defaults: (chartType = 'bar') => ({
    width: 440,
    height: 280,
    content: defaultChartContent(chartType),
  }),

  /**
   * Manual charts render the stored labels/series. Dynamic charts fetch freshly
   * generated data from the API and optionally poll on an interval.
   */
  mount(container, element, ctx) {
    const canvas = h('canvas', { role: 'img', 'aria-label': `${element.content.chartType} chart` });
    const status = h('span', { class: 'chart-element__status', hidden: true });
    container.append(h('div', { class: 'chart-element' }, canvas, status));

    let chart = null;
    let content = null;
    let dynamicData = null;
    let fetchKey = null;
    let timer = null;
    let inflight = null;

    function setStatus(text, isError = false) {
      status.hidden = !text;
      status.textContent = text || '';
      status.classList.toggle('is-error', isError);
    }

    function draw() {
      const data = content.source === 'dynamic'
        ? { labels: dynamicData?.labels || [], series: dynamicData?.series || [] }
        : { labels: content.labels, series: content.series };
      const chartData = { labels: data.labels, datasets: toDatasets(content, data.series) };

      if (chart && chart.config.type !== content.chartType) {
        chart.destroy();
        chart = null;
      }
      if (!chart) {
        chart = new Chart(canvas, { type: content.chartType, data: chartData, options: buildOptions(content) });
      } else {
        chart.data = chartData;
        chart.options = buildOptions(content);
        chart.update();
      }
    }

    async function fetchData() {
      inflight?.abort();
      inflight = new AbortController();
      if (!dynamicData) setStatus('Loading…');
      try {
        dynamicData = await chartDataApi.getDataset(content.dataset, content.points, { signal: inflight.signal });
        setStatus(content.refreshSeconds ? `Live · ${new Date().toLocaleTimeString()}` : '');
        draw();
      } catch (err) {
        if (err.name === 'AbortError') return;
        setStatus('Data unavailable — retrying', true);
      }
    }

    function schedule() {
      clearInterval(timer);
      timer = null;
      if (content.source === 'dynamic' && content.refreshSeconds > 0) {
        timer = setInterval(fetchData, content.refreshSeconds * 1000);
      }
    }

    function render(model) {
      const next = model.content;
      if (content && JSON.stringify(next) === JSON.stringify(content)) return;
      content = next;
      canvas.setAttribute('aria-label', `${content.chartType} chart${content.title ? `: ${content.title}` : ''}`);

      if (content.source === 'dynamic') {
        const key = `${content.dataset}|${content.points}|${content.refreshSeconds}`;
        if (key !== fetchKey) {
          fetchKey = key;
          dynamicData = null;
          fetchData();
          schedule();
        }
        if (dynamicData) draw();
        else if (!chart) draw();
      } else {
        fetchKey = null;
        clearInterval(timer);
        inflight?.abort();
        setStatus('');
        draw();
      }
    }
    render(element);

    return {
      update: render,
      refresh: () => (content.source === 'dynamic' ? fetchData() : undefined),
      destroy() {
        clearInterval(timer);
        inflight?.abort();
        chart?.destroy();
      },
    };
  },
};
