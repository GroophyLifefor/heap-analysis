/**
 * Renders rows as a plain aligned text table -- no color, no box-drawing
 * characters, just padded columns, so it stays readable piped into a file
 * or another tool. `columns` is `{ key, header, align }[]`, `align` is
 * `'left'` (default) or `'right'` (numbers).
 */
export function renderTable(rows, columns) {
  const widths = columns.map((col) =>
    Math.max(col.header.length, ...rows.map((row) => String(row[col.key]).length)),
  );

  const renderRow = (cells) =>
    cells
      .map((cell, i) => {
        const text = String(cell);
        const pad = ' '.repeat(widths[i] - text.length);
        return columns[i].align === 'right' ? pad + text : text + pad;
      })
      .join('  ');

  const lines = [renderRow(columns.map((col) => col.header))];
  for (const row of rows) lines.push(renderRow(columns.map((col) => row[col.key])));
  return lines.join('\n');
}
