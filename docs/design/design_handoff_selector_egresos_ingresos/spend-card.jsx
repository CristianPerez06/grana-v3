// ════════════════════════════════════════════════════════════════
// SpendCard — tarjeta "En qué se fue / De dónde vino" con selector
// Egresos / Ingresos + toggle ARS / USD. variant: 'pill' | 'underline'
// ════════════════════════════════════════════════════════════════
const { useState } = React;

const GREEN = ['#0E9E6E', '#16B981', '#4FC79A', '#86D9B8'];
const MULTI = ['#10B981', '#2A8F7B', '#3A6B8A', '#B56A5A', '#8C7AA0'];

const SC_DATA = {
  egresos: {
    sub: 'Gastos de mayo · no incluye tarjeta sin pagar',
    palette: MULTI,
    color: '#0B1A2B',
    ARS: {
      label: 'Gastado', amount: '$ 854K', count: 'en 8 categorías',
      rows: [
        { emoji: '🛒', name: 'Supermercado',    cap: '40% · 8 movimientos',            amt: '$ 341K', pct: 40 },
        { emoji: '🛋️', name: 'Hogar',            cap: '25% · cuotas Sofá Sofías',       amt: '$ 213K', pct: 25 },
        { emoji: '🍷', name: 'Comida y bebida',  cap: '15% · 14 movimientos',           amt: '$ 128K', pct: 15 },
        { emoji: '🎧', name: 'Suscripciones',    cap: '11% · 3 recurrentes',            amt: '$ 94K',  pct: 11 },
        { emoji: '',   name: '+ 4 categorías más', cap: '9% · transporte, salud, otros', amt: '$ 78K',  pct: 9 },
      ],
    },
    USD: {
      label: 'Gastado', amount: 'US$ 712', count: 'en 3 categorías',
      rows: [
        { emoji: '🎧', name: 'Suscripciones', cap: '57% · 4 recurrentes',   amt: 'US$ 406', pct: 57 },
        { emoji: '✈️', name: 'Viajes',        cap: '28% · 2 movimientos',   amt: 'US$ 199', pct: 28 },
        { emoji: '💻', name: 'Software',      cap: '15% · 5 movimientos',   amt: 'US$ 107', pct: 15 },
      ],
    },
  },
  ingresos: {
    sub: 'Ingresos de mayo · acreditados',
    palette: GREEN,
    color: '#0E9E6E',
    ARS: {
      label: 'Ingresó', amount: '$ 2,38M', count: 'en 4 categorías',
      rows: [
        { emoji: '💼', name: 'Sueldo',     cap: '58% · Banco Galicia', amt: '$ 1.380K', pct: 58 },
        { emoji: '💻', name: 'Freelance',  cap: '27% · 3 cobros',      amt: '$ 640K',   pct: 27 },
        { emoji: '💳', name: 'Reintegros', cap: '9% · 5 movimientos',  amt: '$ 210K',   pct: 9 },
        { emoji: '📈', name: 'Intereses',  cap: '6% · plazo fijo',     amt: '$ 150K',   pct: 6 },
      ],
    },
    USD: {
      label: 'Ingresó', amount: 'US$ 1.480', count: 'en 2 categorías',
      rows: [
        { emoji: '💻', name: 'Freelance',  cap: '81% · 2 cobros',           amt: 'US$ 1.200', pct: 81 },
        { emoji: '📈', name: 'Intereses',  cap: '19% · caja de ahorro USD', amt: 'US$ 280',   pct: 19 },
      ],
    },
  },
};

function conicFrom(rows, palette) {
  let acc = 0;
  const stops = rows.map((r, i) => {
    const start = acc; acc += r.pct;
    return `${palette[i % palette.length]} ${start}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function SpendCard({ variant = 'pill' }) {
  const [mode, setMode] = useState('egresos');
  const [cur, setCur] = useState('ARS');

  const m = SC_DATA[mode];
  const d = m[cur];
  const palette = m.palette;
  const accent = m.color;

  const Tabs = (
    <div className={`mode-tabs mt-${variant}`}>
      {['egresos', 'ingresos'].map((k) => {
        const on = mode === k;
        const c = SC_DATA[k].color;
        return (
          <button
            key={k}
            className={on ? 'on' : ''}
            onClick={() => setMode(k)}
            style={on ? (variant === 'pill'
              ? { background: c, color: '#fff' }
              : { color: c, '--bar': c }) : undefined}
          >
            {k === 'egresos' ? 'Egresos' : 'Ingresos'}
          </button>
        );
      })}
    </div>
  );

  return (
    <section className="card spend-card">
      <div className="spend-head">
        <div className="spend-head-left">
          {Tabs}
          <div className="spend-sub">{m.sub}</div>
        </div>
        <div className="seg cur-seg">
          {['ARS', 'USD'].map((k) => (
            <button key={k} className={cur === k ? 'on' : ''} onClick={() => setCur(k)}>{k}</button>
          ))}
        </div>
      </div>

      <div className="spend-body" key={mode + cur}>
        <div className="donut-wrap">
          <div className="donut" style={{ background: conicFrom(d.rows, palette) }}></div>
          <div className="donut-center">
            <div className="eyebrow dc-eyebrow" style={{ color: accent }}>{d.label}</div>
            <div className="dc-amount tnum">{d.amount}</div>
            <div className="dc-sub tnum">{d.count}</div>
          </div>
        </div>

        <div className="ranking">
          {d.rows.map((r, i) => (
            <div className="rank-row" key={r.name}>
              <div className="rank-left">
                <span className="dot" style={{ background: palette[i % palette.length] }}></span>
                <span className="rank-emoji" style={r.emoji ? undefined : { opacity: 0, width: 0 }}>{r.emoji || '·'}</span>
                <div>
                  <div className="rank-name">{r.name}</div>
                  <div className="rank-cap tnum">{r.cap}</div>
                </div>
              </div>
              <div></div>
              <div className="rank-amt tnum">{r.amt}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.SpendCard = SpendCard;
