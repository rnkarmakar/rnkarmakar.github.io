// Keep every engraved page in one portable SVG download.
export function exportScoreSvg(pages) {
  if (pages.length === 1) return pages[0].svg;
  const ns = 'http://www.w3.org/2000/svg';
  const parser = new DOMParser(), serializer = new XMLSerializer();
  const roots = pages.map(page => parser.parseFromString(page.svg, 'image/svg+xml').documentElement);
  const boxes = roots.map(svg => svg.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number));
  const width = Math.max(...boxes.map(box => box[2]));
  const height = boxes.reduce((sum, box) => sum + box[3], 0);
  const document = parser.parseFromString(`<svg xmlns="${ns}"/>`, 'image/svg+xml');
  const root = document.documentElement;
  root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const physical = /^(\d+(?:\.\d+)?)(.*)$/.exec(roots[0].getAttribute('width') ?? '');
  if (physical) {
    const scale = Number(physical[1]) / boxes[0][2];
    root.setAttribute('width', width * scale + physical[2]);
    root.setAttribute('height', height * scale + physical[2]);
  }
  let y = 0;
  roots.forEach((svg, index) => {
    // Separate namespaces for definitions such as glyphs and clip paths.
    const ids = new Map([...svg.querySelectorAll('[id]')].map(el => [el.id, `page-${index}-${el.id}`]));
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
      for (const attr of [...el.attributes]) {
        if (attr.name === 'id' && ids.has(attr.value)) attr.value = ids.get(attr.value);
        else attr.value = attr.value.replace(/url\(#([^)]+)\)|^#(.+)$/g,
          (match, urlId, hrefId) => ids.has(urlId ?? hrefId)
            ? (urlId ? `url(#${ids.get(urlId)})` : `#${ids.get(hrefId)}`) : match);
      }
    }
    svg.setAttribute('x', '0'); svg.setAttribute('y', String(y));
    svg.setAttribute('width', String(boxes[index][2]));
    svg.setAttribute('height', String(boxes[index][3]));
    root.append(document.importNode(svg, true));
    y += boxes[index][3];
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(root);
}
