'use strict';
/* Static client only. Source JSON is read as-is; all analysis metrics come from the full graphs. */
const $ = selector => document.querySelector(selector);
const MAX_NODES = 350, MAX_EDGES = 1200, LIST_SIZE = 24;
const PALETTE = ['#81d6c2', '#d9b880', '#aaa5eb', '#8abbe8', '#dd98a5', '#a6c98a', '#b8ac9d', '#8fc6d0'];
const color = id => PALETTE[((id % PALETTE.length) + PALETTE.length) % PALETTE.length];
const fmt = (value, decimals = 0) => Number.isFinite(value)
  ? value.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  : 'Hesaplanmadı';
const state = {
  year: 2015, data: null, index: null, graph: null, sequence: 0, page: 0,
  selected: null, pending: new Map()
};
const DEFAULT_ROTATION = { x: -0.28, y: -0.32 };
const FOCUS_ZOOM = 1.65;
const byStrength = (a, b) => b.strength - a.strength || a.tag.localeCompare(b.tag, 'en');
const el = (tag, text, className) => {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
};
function jsonFile(path) {
  if (!state.pending.has(path)) {
    const pending = fetch(path).then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).catch(error => { state.pending.delete(path); throw error; });
    state.pending.set(path, pending);
  }
  return state.pending.get(path);
}
function makeIndex(data) {
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.communities)) {
    throw new Error('Beklenen ağ veri alanları bulunamadı.');
  }
  const nodes = new Map(data.nodes.map(n => [n.tag, n]));
  const communities = new Map(data.communities.map(c => [c.community, c]));
  const adjacent = new Map(data.nodes.map(n => [n.tag, []]));
  for (const edge of data.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) throw new Error('Kenarın etiketi bulunamadı.');
    adjacent.get(edge.source).push({ tag: edge.target, edge });
    adjacent.get(edge.target).push({ tag: edge.source, edge });
  }
  return { nodes, communities, adjacent, ranked: [...data.nodes].sort(byStrength) };
}
function controls(enabled) {
  $('#search').disabled = !enabled;
  $('#search-form button').disabled = !enabled;
  $('#community').disabled = !enabled;
  $('#reset').disabled = !enabled;
}
function message(text) {
  $('#search-message').textContent = text;
  $('#search-message').hidden = !text;
}
function emptyDetail() {
  const section = el('div', undefined, 'detail-intro');
  section.append(el('p', 'SEÇİLİ ETİKET / TAM AĞ ÖLÇÜLERİ', 'eyebrow'),
    el('h3', 'Bir bağlantıdan başlayın.'),
    el('p', 'Bir düğüme dokunun veya etiketi arayın. Topluluğunu, bağlantı çeşitliliğini ve köprü adaylığını birlikte okuyun.'),
    el('div', String(state.year).slice(-2), 'detail-number'),
    el('p', 'Grafiğe alternatif olarak aşağıdaki etiket listesini klavyeyle kullanabilirsiniz.', 'detail-hint'));
  $('#detail').replaceChildren(section);
  state.selected = null;
  scheduleGraphDraw();
}
async function loadYear(year) {
  const sequence = ++state.sequence;
  if (state.year !== year && state.graph) {
    animateCamera({
      rotationX: DEFAULT_ROTATION.x, rotationY: DEFAULT_ROTATION.y,
      zoom: 1, panX: 0, panY: 0
    });
  }
  state.year = year;
  controls(false);
  message('');
  $('#workspace').setAttribute('aria-busy', 'true');
  $('#graph-overlay').hidden = false;
  $('.loader').hidden = false;
  $('#retry').hidden = true;
  $('#load-message').textContent = year + ' etiketleri ve bağlantıları hazırlanıyor…';
  $('#counts').textContent = year + ' verisi yükleniyor…';
  document.querySelectorAll('[data-year]').forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.year) === year));
  });
  try {
    const data = await jsonFile('data/' + year + '.json');
    if (sequence !== state.sequence) return false;
    state.data = data;
    state.index = makeIndex(data);
    $('#community').replaceChildren(new Option('Tüm topluluklar', 'all'),
      ...data.communities.map(c => new Option(c.community + ' · ' + c.name + ' (' + c.size + ')', String(c.community))));
    $('#search').value = '';
    $('#list-search').value = '';
    $('#tags').replaceChildren();
    state.page = 0;
    emptyDetail();
    renderGraph();
    controls(true);
    $('#workspace').setAttribute('aria-busy', 'false');
    $('#graph-overlay').hidden = true;
    return true;
  } catch (error) {
    if (sequence !== state.sequence) return false;
    $('.loader').hidden = true;
    $('#retry').hidden = false;
    $('#load-message').textContent = 'Ağ yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin. Yerel kullanımda dosyaları HTTP sunucusu üzerinden açın.';
    $('#counts').textContent = year + ' verisi açılamadı.';
    $('#workspace').setAttribute('aria-busy', 'false');
    console.error('Ağ yükleme hatası:', error);
    return false;
  }
}
function visibleSubset(focus) {
  const filter = $('#community').value;
  let nodes;
  if (focus) {
    const neighbors = new Set(state.index.adjacent.get(focus).map(n => n.tag));
    nodes = [state.index.nodes.get(focus),
      ...state.index.ranked.filter(n => n.tag !== focus && neighbors.has(n.tag)).slice(0, MAX_NODES - 1)];
  } else {
    nodes = state.index.ranked.filter(n => filter === 'all' || n.community === Number(filter)).slice(0, MAX_NODES);
  }
  const ids = new Set(nodes.map(n => n.tag));
  const edges = state.data.edges.filter(e => ids.has(e.source) && ids.has(e.target))
    .sort((a, b) => {
      const priority = e => focus && (e.source === focus || e.target === focus) ? 1 : 0;
      return priority(b) - priority(a) || b.weight - a.weight;
    }).slice(0, MAX_EDGES);
  return { nodes, edges };
}
function graphHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function makeNodeSprites() {
  return PALETTE.map(tint => {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const ctx = sprite.getContext('2d');
    const gradient = ctx.createRadialGradient(20, 18, 3, 32, 32, 31);
    gradient.addColorStop(0, '#f0fff8');
    gradient.addColorStop(.24, tint);
    gradient.addColorStop(1, '#213943');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 31, 0, Math.PI * 2);
    ctx.fill();
    return sprite;
  });
}
function initializeGraph() {
  const container = $('#network');
  const canvas = document.createElement('canvas');
  canvas.className = 'network-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.replaceChildren(canvas);
  const graph = state.graph = {
    canvas, context: canvas.getContext('2d'), nodes: [], edges: [], nodeMap: new Map(),
    rotationX: DEFAULT_ROTATION.x, rotationY: DEFAULT_ROTATION.y, zoom: 1, panX: 0, panY: 0,
    width: 0, height: 0, hovered: null, dragging: null, focus: null, animationFrame: 0,
    drawFrame: 0, sprites: makeNodeSprites()
  };
  if (!graph.context) throw new Error('Tarayıcı 2B tuval çizimini desteklemiyor.');

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    graph.dragging = { x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (graph.dragging) {
      cancelCameraAnimation(graph);
      const dx = event.clientX - graph.dragging.x, dy = event.clientY - graph.dragging.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) graph.dragging.moved = true;
      graph.rotationY += dx * .007;
      graph.rotationX = Math.max(-1.35, Math.min(1.35, graph.rotationX + dy * .007));
      graph.dragging.x = event.clientX;
      graph.dragging.y = event.clientY;
      scheduleGraphDraw();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
    const hovered = hit ? hit.node.tag : null;
    if (graph.hovered === hovered) return;
    graph.hovered = hovered;
    canvas.classList.toggle('is-hovering-node', Boolean(hit));
    scheduleGraphDraw();
  });
  const finishPointer = event => {
    if (!graph.dragging) return;
    const moved = graph.dragging.moved;
    graph.dragging = null;
    canvas.classList.remove('is-dragging');
    if (!moved) {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
      if (hit) selectNode(hit.node.tag);
      else emptyDetail();
    }
  };
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', () => {
    graph.dragging = null;
    canvas.classList.remove('is-dragging');
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const zoom = Math.max(.55, Math.min(3.2, graph.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
    animateCamera({ zoom }, 180);
  }, { passive: false });
  return graph;
}
function cancelCameraAnimation(graph = state.graph) {
  if (!graph || !graph.animationFrame) return;
  cancelAnimationFrame(graph.animationFrame);
  graph.animationFrame = 0;
}
function scheduleGraphDraw() {
  const graph = state.graph;
  if (!graph || graph.drawFrame) return;
  graph.drawFrame = requestAnimationFrame(() => {
    graph.drawFrame = 0;
    drawGraph();
  });
}
function animateCamera(target, duration = 460) {
  const graph = state.graph;
  if (!graph) return;
  cancelCameraAnimation(graph);
  const from = {
    rotationX: graph.rotationX, rotationY: graph.rotationY, zoom: graph.zoom,
    panX: graph.panX, panY: graph.panY
  };
  const start = performance.now();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const time = reduceMotion ? 0 : duration;
  function frame(now) {
    const progress = time ? Math.min(1, (now - start) / time) : 1;
    const eased = progress < .5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    for (const key of Object.keys(from)) {
      const end = target[key] === undefined ? from[key] : target[key];
      graph[key] = from[key] + (end - from[key]) * eased;
    }
    scheduleGraphDraw();
    if (progress < 1) graph.animationFrame = requestAnimationFrame(frame);
    else graph.animationFrame = 0;
  }
  graph.animationFrame = requestAnimationFrame(frame);
}
function resizeGraph() {
  if (!state.graph) return;
  const { canvas, context } = state.graph;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  if (!rect.width || !rect.height) return;
  if (state.graph.width === rect.width && state.graph.height === rect.height &&
      canvas.width === Math.round(rect.width * ratio) && canvas.height === Math.round(rect.height * ratio)) return;
  state.graph.width = rect.width;
  state.graph.height = rect.height;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  scheduleGraphDraw();
}
function projectNode(item, width, height) {
  const graph = state.graph;
  const cosY = Math.cos(graph.rotationY), sinY = Math.sin(graph.rotationY);
  const cosX = Math.cos(graph.rotationX), sinX = Math.sin(graph.rotationX);
  const x0 = item.unitX * width, y0 = item.unitY * height;
  const z0 = item.depth * Math.min(width, height);
  const x = x0 * cosY + z0 * sinY;
  const z1 = -x0 * sinY + z0 * cosY;
  const y = y0 * cosX - z1 * sinX;
  const z = y0 * sinX + z1 * cosX;
  const focal = Math.min(width, height) * 1.72;
  const perspective = focal / (focal - z);
  return {
    x: width / 2 + x * perspective * graph.zoom + graph.panX,
    y: height / 2 + y * perspective * graph.zoom + graph.panY,
    z, perspective
  };
}
function hitTest(x, y) {
  if (!state.graph) return null;
  let closest = null, closestDistance = Infinity;
  for (let i = state.graph.nodes.length - 1; i >= 0; i--) {
    const item = state.graph.nodes[i];
    if (!item.screen) continue;
    const distance = Math.hypot(x - item.screen.x, y - item.screen.y);
    if (distance <= Math.max(item.screen.radius + 5, 9) && distance < closestDistance) {
      closest = item;
      closestDistance = distance;
    }
  }
  return closest;
}
function drawGraph() {
  const graph = state.graph;
  if (!graph || !graph.context || !graph.width || !graph.height) return;
  const { context: ctx, width, height } = graph;
  ctx.clearRect(0, 0, width, height);
  const centerX = width / 2, centerY = height / 2;
  const radius = Math.min(width, height);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.strokeStyle = 'rgba(126, 179, 173, 0.075)';
  ctx.lineWidth = 1;
  for (const ratio of [.2, .38, .56]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * ratio, radius * ratio * .31, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const positions = new Map();
  let minZ = Infinity, maxZ = -Infinity;
  const cosY = Math.cos(graph.rotationY), sinY = Math.sin(graph.rotationY);
  const cosX = Math.cos(graph.rotationX), sinX = Math.sin(graph.rotationX);
  const focal = Math.min(width, height) * 1.72;
  for (const item of graph.nodes) {
    const x0 = item.unitX * width, y0 = item.unitY * height;
    const z0 = item.depth * Math.min(width, height);
    const x = x0 * cosY + z0 * sinY;
    const z1 = -x0 * sinY + z0 * cosY;
    const y = y0 * cosX - z1 * sinX;
    const z = y0 * sinX + z1 * cosX;
    const perspective = focal / (focal - z);
    const screen = {
      x: width / 2 + x * perspective * graph.zoom + graph.panX,
      y: height / 2 + y * perspective * graph.zoom + graph.panY,
      z, perspective
    };
    item.screen = screen;
    positions.set(item.node.tag, screen);
    minZ = Math.min(minZ, screen.z);
    maxZ = Math.max(maxZ, screen.z);
  }
  const depthOpacity = z => .48 + .52 * (maxZ === minZ ? .5 : (z - minZ) / (maxZ - minZ));
  const selected = state.selected;
  const neighbors = selected && state.index ? new Set(state.index.adjacent.get(selected).map(item => item.tag)) : null;
  const orderedEdges = [...graph.edges].sort((a, b) =>
    ((positions.get(a.source)?.z || 0) + (positions.get(a.target)?.z || 0)) -
    ((positions.get(b.source)?.z || 0) + (positions.get(b.target)?.z || 0)));
  for (const edge of orderedEdges) {
    const source = positions.get(edge.source), target = positions.get(edge.target);
    if (!source || !target) continue;
    const connected = selected && (edge.source === selected || edge.target === selected);
    const faded = selected && !connected;
    const alpha = faded ? .018 : connected ? .76 : .07 + Math.min(.25, Math.log1p(edge.weight) * .045);
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.strokeStyle = connected ? 'rgba(166, 242, 207, ' + alpha + ')' : 'rgba(124, 163, 165, ' + alpha + ')';
    ctx.lineWidth = connected ? 1.1 + Math.min(1.6, Math.log1p(edge.weight) * .28) : .45 + Math.min(1.2, Math.log1p(edge.weight) * .2);
    ctx.stroke();
  }

  const orderedNodes = [...graph.nodes].sort((a, b) => a.screen.z - b.screen.z);
  for (const item of orderedNodes) {
    const point = item.screen, node = item.node;
    const isSelected = node.tag === selected;
    const connected = selected && neighbors.has(node.tag);
    const opacity = (selected && !isSelected && !connected ? .2 : 1) * depthOpacity(point.z);
    const nodeRadius = (2.1 + Math.min(7, Math.log1p(Math.max(0, node.strength)) * .82)) *
      point.perspective * graph.zoom * (isSelected ? 1.35 : 1);
    point.radius = nodeRadius;
    ctx.globalAlpha = opacity;
    if (isSelected || graph.hovered === node.tag) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, nodeRadius * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(166, 242, 207, .13)';
      ctx.fill();
    }
    const sprite = graph.sprites[((node.community % graph.sprites.length) + graph.sprites.length) % graph.sprites.length];
    ctx.drawImage(sprite, point.x - nodeRadius, point.y - nodeRadius, nodeRadius * 2, nodeRadius * 2);
    ctx.beginPath();
    ctx.arc(point.x, point.y, nodeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected ? '#e5fff1' : 'rgba(225, 251, 240, .52)';
    ctx.lineWidth = isSelected ? 1.8 : .65;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const labelCandidates = orderedNodes
    .filter(item => item.showLabel || item.node.tag === selected || item.node.tag === graph.hovered)
    .sort((a, b) => Number(b.node.tag === selected) - Number(a.node.tag === selected) ||
      b.node.strength - a.node.strength);
  const occupied = [];
  for (const item of labelCandidates) {
    const point = item.screen;
    const isSelected = item.node.tag === selected;
    const fontSize = isSelected ? 12 : 10;
    const labelWidth = item.node.tag.length * fontSize * .62 + 12;
    const box = [point.x - labelWidth / 2, point.y - point.radius - 19,
      point.x + labelWidth / 2, point.y - point.radius - 2];
    if (!isSelected && occupied.some(other =>
      box[0] < other[2] && box[2] > other[0] && box[1] < other[3] && box[3] > other[1])) continue;
    occupied.push(box);
    ctx.globalAlpha = depthOpacity(point.z);
    ctx.font = (isSelected ? '600 ' : '400 ') + fontSize + 'px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = isSelected ? '#e8fff3' : '#d8e8e4';
    ctx.shadowColor = '#071317';
    ctx.shadowBlur = 5;
    ctx.fillText(item.node.tag, point.x, point.y - point.radius - 4);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}
function renderGraph(focus = null) {
  if (!state.index) return;
  const { nodes, edges } = visibleSubset(focus);
  const graph = state.graph || initializeGraph();
  const allNodes = state.data.nodes;
  const minX = Math.min(...allNodes.map(n => n.x)), maxX = Math.max(...allNodes.map(n => n.x));
  const minY = Math.min(...allNodes.map(n => n.y)), maxY = Math.max(...allNodes.map(n => n.y));
  const width = Math.max(1, maxX - minX), height = Math.max(1, maxY - minY);
  const labelTags = new Set([...nodes].sort(byStrength).slice(0, focus ? 8 : 6).map(n => n.tag));
  if (focus) labelTags.add(focus);
  graph.nodes = nodes.map(node => {
    const hash = graphHash(node.tag);
    const communityPhase = node.community * 2.399963;
    const depth = (Math.sin(communityPhase) * .68 + Math.sin(communityPhase * .43) * .32) * .82 * .31 +
      (((hash % 10000) / 9999) - .5) * .82 * .2;
    return {
      node,
      unitX: ((node.x - minX) / width - .5) * .82,
      unitY: ((node.y - minY) / height - .5) * .82,
      depth, showLabel: labelTags.has(node.tag), screen: null
    };
  });
  graph.nodeMap = new Map(graph.nodes.map(item => [item.node.tag, item]));
  graph.edges = edges;
  graph.focus = focus;
  if (!graph.width || !graph.height) resizeGraph();
  else scheduleGraphDraw();
  $('#counts').textContent = state.year + ' tam ağ: ' + fmt(state.data.nodes.length) + ' düğüm / ' +
    fmt(state.data.edges.length) + ' kenar. Ekranda: ' + fmt(nodes.length) + ' düğüm / ' + fmt(edges.length) + ' kenar.';
  $('#view-year').textContent = state.year;
  $('#view-mode').textContent = focus ? focus + ' ve komşuları' : $('#community').value === 'all' ? 'En güçlü 350 etiket' : 'Topluluk alt kümesi';
  $('#network').dataset.visibleNodes = nodes.length;
  $('#network').dataset.visibleEdges = edges.length;
  $('#network').setAttribute('aria-label', state.year + ' 3B ağı, gösterilen alt küme ' + nodes.length +
    ' etiket ve ' + edges.length + ' kenar. Sürükleyerek döndürülebilir. Metinsel alternatif aşağıdaki etiket listesinde.');
  drawLegend(nodes);
  renderInventory();
  if (focus) selectNode(focus);
}
function selectNode(tag) {
  const node = state.index.nodes.get(tag);
  if (!node || !state.graph || !state.graph.nodeMap.has(tag)) return;
  state.selected = tag;
  const graph = state.graph, item = graph.nodeMap.get(tag);
  const targetZoom = Math.max(graph.zoom, FOCUS_ZOOM);
  const currentZoom = graph.zoom, currentPanX = graph.panX, currentPanY = graph.panY;
  graph.zoom = targetZoom;
  graph.panX = 0;
  graph.panY = 0;
  const targetPoint = projectNode(item, graph.width, graph.height);
  graph.zoom = currentZoom;
  graph.panX = currentPanX;
  graph.panY = currentPanY;
  animateCamera({
    zoom: targetZoom,
    panX: graph.width / 2 - targetPoint.x,
    panY: graph.height / 2 - targetPoint.y
  }, 620);
  const aside = $('#detail');
  aside.classList.remove('detail-enter');
  aside.replaceChildren();
  aside.append(el('p', state.year + ' · TAM AĞ ÖLÇÜLERİ', 'eyebrow'), el('h3', tag));
  const community = state.index.communities.get(node.community);
  aside.append(el('p', 'Topluluk ' + node.community + ' / ' + (community ? community.name : 'Adlandırılmadı'), 'detail-community'));
  const metrics = el('dl', undefined, 'node-metrics');
  for (const [label, value, definition] of [
    ['Derece', fmt(node.degree), 'Kaç farklı etiketle bağlantısı var?'],
    ['Güç', fmt(node.strength), 'Komşularıyla toplam birliktelik ağırlığı.'],
    ['Katılım P', fmt(node.participation, 3), 'Gücü farklı topluluklara ne kadar dağılıyor?']
  ]) {
    const row = el('div'); row.append(el('dt', label), el('dd', value), el('dd', definition, 'metric-definition')); metrics.append(row);
  }
  aside.append(metrics);
  let note = node.bridge_eligible
    ? 'Ana köprü aday eşiğini karşılıyor: derece ≥10 ve güç ≥20. Katılımı, bağlantı hacmiyle birlikte değerlendirin.'
    : 'Ana köprü aday eşiğini karşılamıyor. Yüksek katılım, düşük bağlantı hacminde tek başına önem göstermez.';
  if (state.year === 2025 && tag === 'http') note = 'Hacim eşiğine duyarlı aday: güç 20 ile sınırda. Derece ≥20 ve güç ≥50 filtresinden çıkıyor.';
  aside.append(el('p', note, 'detail-note'));
  const extra = el('details', undefined, 'extra-metrics');
  extra.append(el('summary', 'Diğer merkeziyet ölçüleri'));
  const dl = el('dl');
  for (const [label, value, precision] of [['Betweenness', node.betweenness, 4], ['Closeness', node.closeness, 3], ['PageRank', node.pagerank, 5]]) {
    dl.append(el('dt', label), el('dd', fmt(value, precision)));
  }
  extra.append(dl); aside.append(extra);
  const source = el('a', 'Stack Overflow etiket sayfası ↗', 'detail-source');
  source.href = 'https://stackoverflow.com/questions/tagged/' + encodeURIComponent(tag);
  source.target = '_blank'; source.rel = 'noopener'; aside.append(source);
  aside.classList.add('detail-enter');
}
function focusTag(tag) {
  if (!state.index) return;
  const normalized = tag.trim().toLowerCase();
  if (!normalized) { resetView(); return; }
  if (!state.index.nodes.has(normalized)) {
    message('“' + tag.trim() + '” etiketi ' + state.year + ' penceresinde bulunmuyor. Başka bir etiket veya yıl deneyin.');
    return;
  }
  message('');
  $('#community').value = 'all';
  $('#search').value = normalized;
  renderGraph(normalized);
}
function resetView() {
  if (!state.index) return;
  $('#search').value = ''; $('#list-search').value = ''; $('#community').value = 'all';
  if (state.graph) {
    animateCamera({
      rotationX: DEFAULT_ROTATION.x, rotationY: DEFAULT_ROTATION.y,
      zoom: 1, panX: 0, panY: 0
    });
  }
  state.page = 0; message(''); emptyDetail(); renderGraph();
}
function drawLegend(nodes) {
  const ids = new Set(nodes.map(n => n.community));
  const communities = state.data.communities.filter(c => ids.has(c.community));
  $('#legend').replaceChildren(...communities.map(c => {
    const span = el('span');
    span.style.setProperty('--c', color(c.community));
    const dot = el('i'); dot.setAttribute('aria-hidden', 'true');
    span.append(dot, document.createTextNode(c.community + ' · ' + c.name));
    return span;
  }));
}
function renderInventory() {
  if (!state.index) return;
  const query = $('#list-search').value.trim().toLowerCase();
  const filter = $('#community').value;
  const candidates = state.index.ranked.filter(n =>
    (!query || n.tag.includes(query)) && (filter === 'all' || n.community === Number(filter)));
  const totalPages = Math.max(1, Math.ceil(candidates.length / LIST_SIZE));
  state.page = Math.max(0, Math.min(state.page, totalPages - 1));
  const start = state.page * LIST_SIZE;
  const list = $('#tag-list');
  list.replaceChildren(...candidates.slice(start, start + LIST_SIZE).map(n => {
    const button = el('button'); button.type = 'button';
    button.append(el('strong', n.tag), el('small', 'Derece ' + fmt(n.degree) + ' · Güç ' + fmt(n.strength)));
    button.setAttribute('aria-label', n.tag + ' etiketini ağda aç');
    button.onclick = () => focusTag(n.tag);
    return button;
  }));
  if (!candidates.length) list.append(el('p', 'Bu listede eşleşen etiket yok.', 'caption'));
  $('#list-count').textContent = fmt(candidates.length) + ' etiket · güç sırasıyla · ' + state.year;
  $('#list-page').textContent = (candidates.length ? start + 1 : 0) + '–' + Math.min(start + LIST_SIZE, candidates.length) + ' / ' + fmt(candidates.length);
  $('#list-prev').disabled = state.page === 0;
  $('#list-next').disabled = state.page >= totalPages - 1;
}
async function drawSankey() {
  const status = $('#sankey-status');
  status.hidden = false;
  status.textContent = 'Topluluk akışları yükleniyor…';
  try {
    const data = await jsonFile('data/comparison.json');
    if (data.links.reduce((sum, l) => sum + l.value, 0) !== data.common) throw new Error('Akış toplamı ortak etiket sayısıyla eşleşmiyor.');
    $('#common-count').textContent = fmt(data.common);
    $('#new-count').textContent = fmt(data.new);
    $('#absent-count').textContent = fmt(data.absent);
    const graph = d3.sankey().nodeWidth(13).nodePadding(24).extent([[245, 28], [995, 505]])({
      nodes: data.nodes.map(n => ({ ...n })), links: data.links.map(l => ({ ...l }))
    });
    const svg = d3.select('#sankey');
    svg.selectAll('g').remove();
    const links = svg.append('g').selectAll('path').data(graph.links).join('path')
      .attr('d', d3.sankeyLinkHorizontal()).attr('fill', 'none')
      .attr('stroke', d => color(d.source.community)).attr('stroke-opacity', .25)
      .attr('stroke-width', d => Math.max(1, d.width));
    links.append('title').text(d => d.source.name + ' → ' + d.target.name + ': ' + d.value + ' ortak etiket');
    links.on('pointerenter', function () {
      links.attr('stroke-opacity', .07);
      d3.select(this).attr('stroke-opacity', .8);
    }).on('pointerleave', () => links.attr('stroke-opacity', .25));
    svg.append('g').selectAll('rect').data(graph.nodes).join('rect')
      .attr('x', d => d.x0).attr('y', d => d.y0).attr('width', d => d.x1 - d.x0)
      .attr('height', d => Math.max(1, d.y1 - d.y0)).attr('fill', d => color(d.community)).attr('rx', 2);
    const labels = svg.append('g').selectAll('text').data(graph.nodes).join('text')
      .attr('x', d => d.x0 < 600 ? d.x0 - 14 : d.x1 + 14)
      .attr('y', d => (d.y0 + d.y1) / 2 - 3)
      .attr('text-anchor', d => d.x0 < 600 ? 'end' : 'start')
      .attr('fill', '#d8e7e2').attr('font-family', 'Segoe UI, Arial, sans-serif').attr('font-size', 14);
    labels.append('tspan').text(d => d.name.replace(/^(2015|2025)\s+/, ''));
    labels.append('tspan').attr('x', d => d.x0 < 600 ? d.x0 - 14 : d.x1 + 14)
      .attr('dy', 18).attr('fill', '#a0b6b8').attr('font-family', 'Consolas, monospace').attr('font-size', 10)
      .text(d => fmt(d.value) + ' ortak etiket');
    const table = el('table');
    table.append(el('caption', 'Ortak etiketlerin 2015 topluluklarından 2025 topluluklarına dağılımı', 'sr-only'));
    const head = el('thead'), hr = el('tr');
    for (const title of ['2015 topluluğu', '2025 topluluğu', 'Etiket']) { const th = el('th', title); th.scope = 'col'; hr.append(th); }
    head.append(hr); table.append(head);
    const body = el('tbody');
    for (const flow of [...data.links].sort((a, b) => b.value - a.value)) {
      const row = el('tr');
      row.append(el('td', data.nodes[flow.source].name.replace(/^2015\s+/, '')),
        el('td', data.nodes[flow.target].name.replace(/^2025\s+/, '')), el('td', fmt(flow.value)));
      body.append(row);
    }
    table.append(body); $('#flow-table').replaceChildren(table);
    $('#flow-total').textContent = data.links.length + ' akış / ' + fmt(data.common) + ' etiket';
    status.hidden = true;
  } catch (error) {
    status.replaceChildren(document.createTextNode('Topluluk akışları yüklenemedi. '));
    const retry = el('button', 'Yeniden dene', 'text-link'); retry.type = 'button'; retry.onclick = drawSankey; status.append(retry);
    console.error('Sankey yükleme hatası:', error);
  }
}
document.querySelectorAll('[data-year]').forEach(button => button.onclick = () => loadYear(Number(button.dataset.year)));
$('#search-form').onsubmit = event => { event.preventDefault(); focusTag($('#search').value); };
$('#search').oninput = () => {
  if (!state.index) return;
  const query = $('#search').value.trim().toLowerCase();
  const suggestions = state.index.ranked.filter(n => !query || n.tag.includes(query)).slice(0, 20);
  $('#tags').replaceChildren(...suggestions.map(n => new Option(n.tag, n.tag)));
};
$('#search').onchange = () => {
  if (state.index && state.index.nodes.has($('#search').value.trim().toLowerCase())) focusTag($('#search').value);
};
$('#community').onchange = () => {
  $('#search').value = ''; $('#list-search').value = ''; state.page = 0; message(''); emptyDetail(); renderGraph();
};
$('#reset').onclick = resetView;
$('#retry').onclick = () => loadYear(state.year);
$('#list-search').oninput = () => { state.page = 0; renderInventory(); };
$('#list-prev').onclick = () => { state.page--; renderInventory(); };
$('#list-next').onclick = () => { state.page++; renderInventory(); };
$('#fit').onclick = () => {
  if (!state.graph) return;
  animateCamera({
    rotationX: DEFAULT_ROTATION.x, rotationY: DEFAULT_ROTATION.y,
    zoom: 1, panX: 0, panY: 0
  });
};
function zoom(factor) {
  if (!state.graph) return;
  const graph = state.graph;
  animateCamera({ zoom: Math.max(.55, Math.min(3.2, graph.zoom * factor)) }, 220);
}
$('#zoom-in').onclick = () => zoom(1.35);
$('#zoom-out').onclick = () => zoom(1 / 1.35);
document.querySelectorAll('[data-explore-tag]').forEach(button => button.onclick = async () => {
  if (!state.index || state.year !== 2025) { if (!await loadYear(2025)) return; }
  focusTag(button.dataset.exploreTag);
  $('#explore').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
const mobileFlows = matchMedia('(max-width: 580px)');
function flowBreakpoint() { $('#flow-details').open = mobileFlows.matches; }
mobileFlows.addEventListener('change', flowBreakpoint);
flowBreakpoint();
let sizeTimer;
new ResizeObserver(() => {
  clearTimeout(sizeTimer);
  sizeTimer = setTimeout(resizeGraph, 80);
}).observe($('#network'));
emptyDetail();
loadYear(2015);
drawSankey();
