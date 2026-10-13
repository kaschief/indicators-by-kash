// Drawing objects recorded the way TradingView keeps them: each kind has a count limit from
// indicator(), and creating past the limit deletes the oldest live object of that kind.

import { isNa, PineRuntimeError } from './values.mjs';

const DEFAULT_LIMITS = { line: 50, box: 50, label: 50, polyline: 50, table: 1000, linefill: 1000 };
const MAX_LIMITS = { line: 500, box: 500, label: 500, polyline: 100 };
const LIMIT_KEYS = { line: 'max_lines_count', box: 'max_boxes_count', label: 'max_labels_count', polyline: 'max_polylines_count' };

export class DrawingStore {
  constructor() {
    this.all = { line: [], box: [], label: [], table: [], polyline: [], linefill: [] };
    this.liveCount = { line: 0, box: 0, label: 0, table: 0, polyline: 0, linefill: 0 };
    this.head = { line: 0, box: 0, label: 0, table: 0, polyline: 0, linefill: 0 };
    this.sequence = 0;
  }
  limit(ctx, kind) {
    const key = LIMIT_KEYS[kind];
    const declared = key ? ctx.declaration?.[key] : undefined;
    return Math.min(declared ?? DEFAULT_LIMITS[kind], MAX_LIMITS[kind] ?? Infinity);
  }
  add(ctx, kind, object) {
    object.__drawing = kind;
    object.id = ++this.sequence;
    object.createdBar = ctx.i;
    object.createdTime = ctx.bars.time[ctx.i];
    object.deleted = false;
    this.all[kind].push(object);
    this.liveCount[kind]++;
    if (this.liveCount[kind] > this.limit(ctx, kind)) {
      const list = this.all[kind];
      while (list[this.head[kind]].deleted) this.head[kind]++;
      const oldest = list[this.head[kind]];
      this.remove(oldest);
      oldest.garbageCollected = true;
    }
    this.compact(kind);
    return object;
  }
  remove(object) {
    if (isNa(object) || object.deleted) return;
    object.deleted = true;
    this.liveCount[object.__drawing]--;
  }
  compact(kind) {
    const list = this.all[kind];
    if (list.length < 4 * this.liveCount[kind] + 2000) return;
    this.all[kind] = list.filter(item => !item.deleted);
    this.head[kind] = 0;
  }
  live(kind) { return this.all[kind].filter(item => !item.deleted); }
}

function storeOf(ctx) {
  if (!ctx.drawings) throw new PineRuntimeError('drawings are not available in this context');
  return ctx.drawings;
}

function point(value) {
  if (isNa(value)) return NaN;
  return value;
}

export function registerDrawings({ fn, variable }) {
  const remove = () => (ctx, [object]) => { storeOf(ctx).remove(object); return NaN; };
  const getter = key => (ctx, [object]) => (isNa(object) ? NaN : object[key]);
  const setter = (...keys) => (ctx, [object, ...values]) => {
    if (isNa(object)) return NaN;
    keys.forEach((key, index) => { object[key] = values[index]; });
    return NaN;
  };
  const all = kind => ctx => storeOf(ctx).live(kind);

  // chart.point
  fn('chart.point.new', ['time', 'index', 'price'], (ctx, [time, index, price]) => ({ __drawing: 'chartpoint', time, index, price }));
  fn('chart.point.from_time', ['time', 'price'], (ctx, [time, price]) => ({ __drawing: 'chartpoint', time, index: NaN, price }));
  fn('chart.point.from_index', ['index', 'price'], (ctx, [index, price]) => ({ __drawing: 'chartpoint', time: NaN, index, price }));
  fn('chart.point.now', ['price'], (ctx, [price]) => ({ __drawing: 'chartpoint', time: ctx.bars.time[ctx.i], index: ctx.i, price }));
  fn('chart.point.copy', ['id'], (ctx, [p]) => ({ ...p }));

  // line
  fn('line.new', ['x1', 'y1', 'x2', 'y2', 'xloc', 'extend', 'color', 'style', 'width', 'force_overlay'], (ctx, args, named) => {
    let [x1, y1, x2, y2, xloc = 'xloc.bar_index', extend = 'extend.none', color, style = 'line.style_solid', width = 1] = args;
    if (x1 && typeof x1 === 'object' && x1.__drawing === 'chartpoint') {
      const first = x1;
      const second = y1;
      xloc = x2 ?? named.xloc ?? 'xloc.bar_index';
      extend = y2 ?? named.extend ?? 'extend.none';
      [x1, y1, x2, y2] = xloc === 'xloc.bar_time' ? [first.time, first.price, second.time, second.price] : [first.index, first.price, second.index, second.price];
    }
    return storeOf(ctx).add(ctx, 'line', { x1, y1, x2, y2, xloc, extend, color, style, width, ...named });
  });
  fn('line.delete', ['id'], remove('line'));
  fn('line.copy', ['id'], (ctx, [object]) => storeOf(ctx).add(ctx, 'line', { ...object }));
  for (const key of ['x1', 'x2', 'y1', 'y2', 'color', 'style', 'width', 'extend']) fn(`line.set_${key}`, ['id', key], setter(key));
  fn('line.set_xy1', ['id', 'x', 'y'], setter('x1', 'y1'));
  fn('line.set_xy2', ['id', 'x', 'y'], setter('x2', 'y2'));
  fn('line.set_xloc', ['id', 'x1', 'x2', 'xloc'], setter('x1', 'x2', 'xloc'));
  fn('line.set_first_point', ['id', 'point'], (ctx, [object, p]) => { if (!isNa(object)) Object.assign(object, { x1: object.xloc === 'xloc.bar_time' ? p.time : p.index, y1: p.price }); return NaN; });
  fn('line.set_second_point', ['id', 'point'], (ctx, [object, p]) => { if (!isNa(object)) Object.assign(object, { x2: object.xloc === 'xloc.bar_time' ? p.time : p.index, y2: p.price }); return NaN; });
  for (const key of ['x1', 'x2', 'y1', 'y2']) fn(`line.get_${key}`, ['id'], getter(key));
  fn('line.get_price', ['id', 'x'], (ctx, [object, x]) => {
    if (isNa(object)) return NaN;
    if (object.x2 === object.x1) return object.y1;
    return object.y1 + (object.y2 - object.y1) * (x - object.x1) / (object.x2 - object.x1);
  });
  variable('line.all', all('line'));

  // box
  fn('box.new', ['left', 'top', 'right', 'bottom', 'border_color', 'border_width', 'border_style', 'extend', 'xloc', 'bgcolor', 'text'], (ctx, args, named) => {
    let [left, top, right, bottom, border_color, border_width = 1, border_style = 'line.style_solid', extend = 'extend.none', xloc = 'xloc.bar_index', bgcolor, text = ''] = args;
    if (left && typeof left === 'object' && left.__drawing === 'chartpoint') {
      const first = left;
      const second = top;
      xloc = named.xloc ?? 'xloc.bar_index';
      [left, top, right, bottom] = xloc === 'xloc.bar_time' ? [first.time, first.price, second.time, second.price] : [first.index, first.price, second.index, second.price];
      border_color = named.border_color;
      bgcolor = named.bgcolor;
    }
    return storeOf(ctx).add(ctx, 'box', { left, top, right, bottom, border_color, border_width, border_style, extend, xloc, bgcolor, text, ...named, ...{ xloc } });
  });
  fn('box.delete', ['id'], remove('box'));
  fn('box.copy', ['id'], (ctx, [object]) => storeOf(ctx).add(ctx, 'box', { ...object }));
  for (const key of ['left', 'right', 'top', 'bottom', 'bgcolor', 'border_color', 'border_width', 'border_style', 'extend', 'text', 'text_color', 'text_size', 'text_halign', 'text_valign', 'text_wrap', 'text_font_family', 'text_formatting']) {
    fn(`box.set_${key}`, ['id', key], setter(key));
  }
  fn('box.set_lefttop', ['id', 'left', 'top'], setter('left', 'top'));
  fn('box.set_rightbottom', ['id', 'right', 'bottom'], setter('right', 'bottom'));
  fn('box.set_xloc', ['id', 'left', 'right', 'xloc'], setter('left', 'right', 'xloc'));
  fn('box.set_top_left_point', ['id', 'point'], (ctx, [object, p]) => { if (!isNa(object)) Object.assign(object, { left: object.xloc === 'xloc.bar_time' ? p.time : p.index, top: p.price }); return NaN; });
  fn('box.set_bottom_right_point', ['id', 'point'], (ctx, [object, p]) => { if (!isNa(object)) Object.assign(object, { right: object.xloc === 'xloc.bar_time' ? p.time : p.index, bottom: p.price }); return NaN; });
  for (const key of ['left', 'right', 'top', 'bottom']) fn(`box.get_${key}`, ['id'], getter(key));
  variable('box.all', all('box'));

  // label
  fn('label.new', ['x', 'y', 'text', 'xloc', 'yloc', 'color', 'style', 'textcolor', 'size', 'textalign', 'tooltip', 'text_font_family', 'force_overlay'], (ctx, args, named) => {
    let [x, y, text = '', xloc = 'xloc.bar_index', yloc = 'yloc.price', color, style = 'label.style_label_down', textcolor, size = 'size.normal', textalign = 'text.align_center', tooltip] = args;
    if (x && typeof x === 'object' && x.__drawing === 'chartpoint') {
      const p = x;
      text = y ?? named.text ?? '';
      xloc = args[3] ?? named.xloc ?? 'xloc.bar_index';
      x = xloc === 'xloc.bar_time' ? p.time : p.index;
      y = p.price;
    }
    return storeOf(ctx).add(ctx, 'label', { ...named, x, y, text, xloc, yloc, color, style, textcolor, size, textalign, tooltip });
  });
  fn('label.delete', ['id'], remove('label'));
  fn('label.copy', ['id'], (ctx, [object]) => storeOf(ctx).add(ctx, 'label', { ...object }));
  for (const key of ['x', 'y', 'text', 'color', 'textcolor', 'size', 'style', 'tooltip', 'xloc', 'yloc', 'textalign', 'text_font_family', 'text_formatting']) fn(`label.set_${key}`, ['id', key], setter(key));
  fn('label.set_xy', ['id', 'x', 'y'], setter('x', 'y'));
  fn('label.set_point', ['id', 'point'], (ctx, [object, p]) => { if (!isNa(object)) Object.assign(object, { x: object.xloc === 'xloc.bar_time' ? p.time : p.index, y: p.price }); return NaN; });
  for (const key of ['x', 'y', 'text']) fn(`label.get_${key}`, ['id'], getter(key));
  variable('label.all', all('label'));

  // polyline and linefill
  fn('polyline.new', ['points', 'curved', 'closed', 'xloc', 'line_color', 'fill_color', 'line_style', 'line_width', 'force_overlay'], (ctx, [points, curved = false, closed = false, xloc = 'xloc.bar_index', line_color, fill_color, line_style, line_width = 1], named) => {
    if (!isNa(points) && points.length > 10000) throw new PineRuntimeError('polyline.new: more than 10000 points');
    return storeOf(ctx).add(ctx, 'polyline', { points: isNa(points) ? [] : points.map(point), curved, closed, xloc, line_color, fill_color, line_style, line_width, ...named });
  });
  fn('polyline.delete', ['id'], remove('polyline'));
  variable('polyline.all', all('polyline'));
  fn('linefill.new', ['line1', 'line2', 'color'], (ctx, [line1, line2, color]) => storeOf(ctx).add(ctx, 'linefill', { line1, line2, color }));
  fn('linefill.delete', ['id'], remove('linefill'));
  fn('linefill.set_color', ['id', 'color'], setter('color'));
  fn('linefill.get_line1', ['id'], getter('line1'));
  fn('linefill.get_line2', ['id'], getter('line2'));

  // table
  fn('table.new', ['position', 'columns', 'rows', 'bgcolor', 'frame_color', 'frame_width', 'border_color', 'border_width', 'force_overlay'], (ctx, [position, columns, rows], named) =>
    storeOf(ctx).add(ctx, 'table', { position, columns, rows, cells: new Map(), ...named }));
  const CELL_PARAMS = ['table_id', 'column', 'row', 'text', 'width', 'height', 'text_color', 'text_halign', 'text_valign', 'text_size', 'bgcolor', 'tooltip', 'text_font_family', 'text_formatting'];
  fn('table.cell', CELL_PARAMS, (ctx, args, named) => {
    const [tbl, column, row, text = ''] = args;
    if (isNa(tbl)) return NaN;
    if (column < 0 || column >= tbl.columns || row < 0 || row >= tbl.rows) throw new PineRuntimeError(`table.cell (${column}, ${row}) is outside a ${tbl.columns}x${tbl.rows} table`);
    const styling = Object.fromEntries(CELL_PARAMS.slice(4).map((key, index) => [key, args[index + 4]]).filter(([, value]) => value !== undefined));
    tbl.cells.set(`${column},${row}`, { text, ...styling, ...named });
    return NaN;
  });
  const cellSetter = key => (ctx, [tbl, column, row, value]) => {
    if (isNa(tbl)) return NaN;
    const cell = tbl.cells.get(`${column},${row}`) ?? {};
    cell[key] = value;
    tbl.cells.set(`${column},${row}`, cell);
    return NaN;
  };
  for (const key of ['text', 'text_color', 'bgcolor', 'text_size', 'text_halign', 'text_valign', 'tooltip', 'width', 'height', 'text_font_family', 'text_formatting']) fn(`table.cell_set_${key}`, ['table_id', 'column', 'row', key], cellSetter(key));
  fn('table.delete', ['table_id'], remove('table'));
  fn('table.clear', ['table_id', 'start_column', 'start_row', 'end_column', 'end_row'], (ctx, [tbl]) => { if (!isNa(tbl)) tbl.cells.clear(); return NaN; });
  fn('table.merge_cells', ['table_id', 'start_column', 'start_row', 'end_column', 'end_row'], () => NaN);
  for (const key of ['position', 'bgcolor', 'frame_color', 'frame_width', 'border_color', 'border_width']) fn(`table.set_${key}`, ['table_id', key], setter(key));
  variable('table.all', all('table'));
}
