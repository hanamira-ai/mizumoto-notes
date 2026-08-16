/**
 * Converts Tiptap rich HTML content into clean, standard Markdown (.md)
 * Handles headings, bold/italic, Tiptap task lists, bullet lists, tables, and images.
 */

export function convertHtmlToMarkdown(html: string): string {
  if (!html || !html.trim()) {
    return '';
  }

  // If input is not HTML (e.g. plain text or already markdown), return cleaned
  if (!html.includes('<') && !html.includes('>')) {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // Inline formatting
    if (tagName === 'strong' || tagName === 'b') {
      const inner = Array.from(el.childNodes).map(processNode).join('');
      return inner.trim() ? `**${inner}**` : '';
    }

    if (tagName === 'em' || tagName === 'i') {
      const inner = Array.from(el.childNodes).map(processNode).join('');
      return inner.trim() ? `*${inner}*` : '';
    }

    if (tagName === 'code') {
      const inner = el.textContent || '';
      return inner ? `\`${inner}\`` : '';
    }

    if (tagName === 's' || tagName === 'strike' || tagName === 'del') {
      const inner = Array.from(el.childNodes).map(processNode).join('');
      return inner ? `~~${inner}~~` : '';
    }

    if (tagName === 'a') {
      const href = el.getAttribute('href') || '';
      const inner = Array.from(el.childNodes).map(processNode).join('');
      return `[${inner || href}](${href})`;
    }

    // Images
    if (tagName === 'img') {
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      const width = el.getAttribute('data-width') || el.getAttribute('width') || el.style.width || '';
      const cleanWidth = width && width !== '100%' ? `|${width}` : '';
      return `![${alt}${cleanWidth}](${src})`;
    }

    if (tagName === 'br') {
      return '\n';
    }

    if (tagName === 'hr') {
      return '\n\n---\n\n';
    }

    // Headings
    if (/^h[1-6]$/.test(tagName)) {
      const level = parseInt(tagName.charAt(1), 10);
      const prefix = '#'.repeat(level);
      const inner = Array.from(el.childNodes).map(processNode).join('').trim();
      return `\n\n${prefix} ${inner}\n\n`;
    }

    // Paragraphs
    if (tagName === 'p') {
      const inner = Array.from(el.childNodes).map(processNode).join('');
      return `\n${inner}\n`;
    }

    // Task List (Tiptap: <ul data-type="taskList">)
    if (tagName === 'ul' && el.getAttribute('data-type') === 'taskList') {
      const items: string[] = [];
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const itemEl = child as HTMLElement;
          const isChecked =
            itemEl.getAttribute('data-checked') === 'true' ||
            itemEl.querySelector('input[type="checkbox"]:checked') !== null;
          
          // Get text content excluding the label/checkbox element
          const contentEl = itemEl.querySelector('div') || itemEl;
          const innerText = Array.from(contentEl.childNodes)
            .filter((n) => (n as HTMLElement).tagName?.toLowerCase() !== 'label')
            .map(processNode)
            .join('')
            .trim();

          const checkMark = isChecked ? '[x]' : '[ ]';
          items.push(`- ${checkMark} ${innerText}`);
        }
      });
      return `\n${items.join('\n')}\n`;
    }

    // Standard Bullet List
    if (tagName === 'ul') {
      const items: string[] = [];
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const itemEl = child as HTMLElement;
          const innerText = Array.from(itemEl.childNodes).map(processNode).join('').trim();
          items.push(`- ${innerText}`);
        }
      });
      return `\n${items.join('\n')}\n`;
    }

    // Ordered List
    if (tagName === 'ol') {
      const items: string[] = [];
      let index = 1;
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const itemEl = child as HTMLElement;
          const innerText = Array.from(itemEl.childNodes).map(processNode).join('').trim();
          items.push(`${index++}. ${innerText}`);
        }
      });
      return `\n${items.join('\n')}\n`;
    }

    // Tables
    if (tagName === 'table') {
      const trs = Array.from(el.querySelectorAll('tr'));
      if (trs.length === 0) return '';

      const tableRows: string[][] = [];

      trs.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td'));
        const rowData = cells.map((cell) => {
          return Array.from(cell.childNodes)
            .map(processNode)
            .join('')
            .replace(/\|/g, '\\|')
            .replace(/\n+/g, ' ')
            .trim();
        });
        tableRows.push(rowData);
      });

      if (tableRows.length === 0) return '';

      // Determine max columns
      const colCount = Math.max(...tableRows.map((r) => r.length), 1);
      const normalizedRows = tableRows.map((row) => {
        const full = [...row];
        while (full.length < colCount) full.push('');
        return full;
      });

      const headerRow = normalizedRows[0];
      const sepRow = headerRow.map(() => '---');
      const dataRows = normalizedRows.slice(1);

      const headerMd = `| ${headerRow.map((c) => c || ' ').join(' | ')} |`;
      const sepMd = `| ${sepRow.join(' | ')} |`;
      const dataMd = dataRows.map((r) => `| ${r.map((c) => c || ' ').join(' | ')} |`).join('\n');

      return `\n\n${headerMd}\n${sepMd}${dataMd ? '\n' + dataMd : ''}\n\n`;
    }

    // Blockquote
    if (tagName === 'blockquote') {
      const inner = Array.from(el.childNodes).map(processNode).join('').trim();
      return `\n\n> ${inner.replace(/\n/g, '\n> ')}\n\n`;
    }

    // Default: Process children
    return Array.from(el.childNodes).map(processNode).join('');
  }

  let result = processNode(doc.body);

  // Normalize multiple blank lines to at most two
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}
