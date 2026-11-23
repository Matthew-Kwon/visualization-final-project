const tip = d3.select('#tooltip');
const pct = d3.format('.1%');
const pct0 = d3.format('.0%');
const num = d3.format(',');

function showTip(event, html) {
  tip.classed('hidden', false).html(html)
    .style('left', (event.pageX + 14) + 'px')
    .style('top', (event.pageY - 10) + 'px');
}
function hideTip() { tip.classed('hidden', true); }

d3.json('data/steam_agg.json').then(data => {
  const { meta, labels, edges, overall, hist, games } = data;
  games.forEach(g => {
    g.total = d3.sum(g.n);
    g.rate = d3.sum(g.r) / g.total;
  });
  d3.select('#m-rows').text(num(meta.rows));
  d3.select('#m-overall').text(pct(meta.overall_rate));

  const edgeLabel = i => edges[i] === null ? 'max' : (edges[i] + ' h');
  const binRate = (g, lo, hi) => {
    let n = 0, r = 0;
    for (let i = lo; i < hi; i++) { n += g.n[i]; r += g.r[i]; }
    return { n, r, rate: n ? r / n : NaN };
  };

  drawHist();
  const rateChart = drawRate();
  const rank = drawRank();

  function drawHist() {
    const W = 860, H = 260, m = { t: 20, r: 20, b: 40, l: 60 };
    const svg = d3.select('#hist').append('svg').attr('viewBox', [0, 0, W, H]).attr('width', '100%');
    const bins = hist.counts.map((c, i) => ({ x0: hist.edges[i], x1: hist.edges[i + 1], c }));
    const x = d3.scaleLog().domain([1, 1000]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.c)]).nice().range([H - m.b, m.t]);
    svg.append('g').attr('class', 'axis gridline').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(d3.format('~s')));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).tickValues([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]).tickFormat(d3.format('~g')));
    svg.append('text').attr('class', 'annot').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end')
      .text('Hours played at review (log scale; under 1 h grouped at 1 h)');
    svg.append('g').selectAll('rect').data(bins).join('rect')
      .attr('class', 'bar').attr('x', d => x(d.x0) + 0.5).attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
      .attr('y', d => y(d.c)).attr('height', d => y(0) - y(d.c))
      .on('mousemove', function (e, d) {
        d3.select(this).classed('hl', true);
        showTip(e, `<b>${d3.format('.1f')(d.x0)}–${d3.format('.1f')(d.x1)} h</b><br>${num(d.c)} reviews`);
      })
      .on('mouseleave', function () { d3.select(this).classed('hl', false); hideTip(); });
    const mx = x(meta.median_hours);
    svg.append('line').attr('x1', mx).attr('x2', mx).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', '#222').attr('stroke-dasharray', '4 3');
    svg.append('text').attr('class', 'annot').attr('x', mx + 6).attr('y', m.t + 10).text(`median review: ${meta.median_hours} h`);
  }

  function drawRate() {
    const W = 860, H = 280, m = { t: 24, r: 20, b: 40, l: 60 };
    const svg = d3.select('#rate').append('svg').attr('viewBox', [0, 0, W, H]).attr('width', '100%');
    const x = d3.scaleBand().domain(labels).range([m.l, W - m.r]).padding(0.18);
    const y = d3.scaleLinear().domain([0.5, 1]).range([H - m.b, m.t]);
    svg.append('g').attr('class', 'axis gridline').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(pct0));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x));
    svg.append('text').attr('class', 'annot').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').text('Hours played at review');
    svg.append('text').attr('class', 'annot').attr('x', m.l).attr('y', m.t - 10).text('Axis starts at 50%');
    const bars = svg.append('g').selectAll('rect').data(overall.map((d, i) => ({ ...d, i }))).join('rect')
      .attr('class', 'bar').attr('x', d => x(d.label)).attr('width', x.bandwidth())
      .attr('y', d => y(d.rec / d.n)).attr('height', d => y(0.5) - y(d.rec / d.n))
      .style('cursor', 'pointer')
      .on('mousemove', (e, d) => showTip(e, `<b>${d.label} h</b><br>${pct(d.rec / d.n)} recommend<br>${num(d.n)} reviews`))
      .on('mouseleave', hideTip)
      .on('click', (e, d) => { rank.setWindow(d.i, d.i + 1); document.getElementById('s3').scrollIntoView({ behavior: 'smooth' }); });
    svg.append('g').selectAll('text').data(overall).join('text').attr('class', 'annot').attr('text-anchor', 'middle')
      .attr('x', d => x(d.label) + x.bandwidth() / 2).attr('y', d => y(d.rec / d.n) - 4).text(d => pct0(d.rec / d.n));
    const oy = y(meta.overall_rate);
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', oy).attr('y2', oy).attr('stroke', '#c2410c').attr('stroke-dasharray', '5 4').attr('stroke-width', 1.5);
    svg.append('text').attr('class', 'annot').attr('x', x(labels[0])).attr('y', oy - 6).attr('fill', '#c2410c')
      .text(`Steam-style overall rate: ${pct(meta.overall_rate)}`);
    return {
      highlight(lo, hi) { bars.classed('sel', d => d.i >= lo && d.i < hi); }
    };
  }

  function drawRank() {
    const TOP = 15, W = 860, BH = 26, m = { t: 30, r: 60, b: 10, l: 250 };
    const H = m.t + TOP * BH + m.b;
    const svg = d3.select('#rank').append('svg').attr('viewBox', [0, 0, W, H]).attr('width', '100%');
    const x = d3.scaleLinear().domain([0, 1]).range([m.l, W - m.r]);
    svg.append('g').attr('class', 'axis gridline').attr('transform', `translate(0,${m.t})`)
      .call(d3.axisTop(x).ticks(5).tickSize(-(TOP * BH)).tickFormat(pct0));
    const g = svg.append('g');
    const empty = svg.append('text').attr('class', 'annot').attr('x', W / 2).attr('y', H / 2).attr('text-anchor', 'middle');
    const lo = d3.select('#lo'), hi = d3.select('#hi'), minn = d3.select('#minn'), order = d3.select('#order'), find = d3.select('#find');
    d3.select('#titles').selectAll('option').data(games).join('option').attr('value', d => d.t);

    function setWindow(a, b) { lo.property('value', a); hi.property('value', b); update(); }
    lo.on('input', () => { if (+lo.property('value') >= +hi.property('value')) hi.property('value', +lo.property('value') + 1); update(); });
    hi.on('input', () => { if (+hi.property('value') <= +lo.property('value')) lo.property('value', +hi.property('value') - 1); update(); });
    minn.on('input', update);
    order.on('change', update);
    find.on('input', update);
    d3.selectAll('.presets button').on('click', function () { setWindow(+this.dataset.lo, +this.dataset.hi); });

    function update() {
      const a = +lo.property('value'), b = +hi.property('value'), mn = +minn.property('value'), ord = order.property('value');
      const q = find.property('value').trim().toLowerCase();
      d3.select('#lo-label').text(edgeLabel(a));
      d3.select('#hi-label').text(edgeLabel(b));
      d3.select('#minn-label').text(mn);
      d3.selectAll('.presets button').classed('on', function () { return +this.dataset.lo === a && +this.dataset.hi === b; });
      rateChart.highlight(a, b);
      const elig = games.map(gm => ({ ...binRate(gm, a, b), g: gm })).filter(d => d.n >= mn);
      elig.forEach(d => { d.diff = d.rate - d.g.rate; });
      const sorters = {
        top: (p, q2) => d3.descending(p.rate, q2.rate) || d3.descending(p.n, q2.n),
        bottom: (p, q2) => d3.ascending(p.rate, q2.rate) || d3.descending(p.n, q2.n),
        gain: (p, q2) => d3.descending(p.diff, q2.diff),
        loss: (p, q2) => d3.ascending(p.diff, q2.diff)
      };
      elig.sort(sorters[ord]);
      elig.forEach((d, i) => { d.rank = i + 1; });
      let shown = elig.slice(0, TOP);
      let found = null;
      if (q) {
        found = elig.find(d => d.g.t.toLowerCase() === q) || elig.find(d => d.g.t.toLowerCase().includes(q));
        if (found && !shown.includes(found)) shown = [...shown.slice(0, TOP - 1), found];
      }
      const notFoundMsg = q && !found ? ` "${find.property('value')}" has fewer than ${mn} reviews in this window (or is not in the ${num(games.length)} games kept).` : '';
      const foundMsg = found ? ` ${found.g.t} ranks #${found.rank} with ${pct(found.rate)} (all hours: ${pct(found.g.rate)}).` : '';
      d3.select('#rank-status').text(`${num(elig.length)} games have at least ${mn} reviews between ${edgeLabel(a)} and ${edgeLabel(b)}.${foundMsg}${notFoundMsg}`);
      empty.text(elig.length ? '' : 'No game has enough reviews in this window. Lower the minimum or widen the window.');

      const yPos = (d, i) => m.t + i * BH;
      const t = svg.transition().duration(750).ease(d3.easeCubicInOut);
      g.selectAll('g.r').data(shown, d => d.g.id).join(
        enter => {
          const e = enter.append('g').attr('class', 'r').attr('transform', (d, i) => `translate(0,${H + 10})`).style('opacity', 0);
          e.append('rect').attr('class', 'rbar').attr('x', x(0)).attr('y', 3).attr('height', BH - 6).attr('width', 0);
          e.append('line').attr('class', 'tick-all').attr('y1', 1).attr('y2', BH - 1);
          e.append('text').attr('class', 'rlabel').attr('x', m.l - 8).attr('y', BH / 2 + 4).attr('text-anchor', 'end');
          e.append('text').attr('class', 'rval').attr('y', BH / 2 + 4).attr('text-anchor', 'end');
          return e;
        },
        update => update,
        exit => exit.transition(t).style('opacity', 0).attr('transform', `translate(0,${H + 10})`).remove()
      )
        .on('mousemove', (e, d) => showTip(e, `<b>${d.g.t}</b><br>#${d.rank} in this window<br>${edgeLabel(a)}–${edgeLabel(b)}: ${pct(d.rate)} (${num(d.r)} of ${num(d.n)})<br>All hours: ${pct(d.g.rate)} (${num(d.g.total)} reviews)<br>Difference: ${d.diff >= 0 ? '+' : ''}${d3.format('.1f')(d.diff * 100)} pts`))
        .on('mouseleave', hideTip)
        .call(sel => {
          sel.transition(t).style('opacity', 1).attr('transform', (d, i) => `translate(0,${yPos(d, i)})`);
          sel.select('rect').classed('found', d => d === found).transition(t).attr('width', d => x(d.rate) - x(0));
          sel.select('line').transition(t).attr('x1', d => x(d.g.rate)).attr('x2', d => x(d.g.rate));
          sel.select('.rlabel').classed('found', d => d === found).text(d => `${d.rank}. ${d.g.t.length > 32 ? d.g.t.slice(0, 31) + '…' : d.g.t}`);
          sel.select('.rval').text(d => pct0(d.rate)).transition(t).attr('x', d => Math.max(x(d.rate) - 5, x(0) + 30));
        });
    }
    update();
    return { setWindow };
  }
});
