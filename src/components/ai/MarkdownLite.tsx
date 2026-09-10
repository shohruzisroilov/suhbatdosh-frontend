import React, { useMemo } from 'react';

/**
 * The small subset of Markdown a chat reply actually uses.
 *
 * A full parser would be another dependency shipped to every user on Uzbek mobile data
 * for something the AI partner emits maybe once a session — it speaks in conversational
 * sentences, not documents. This covers what does show up: emphasis, inline code, the
 * occasional fenced block, lists, headings and links.
 *
 * Everything is built as React elements rather than an HTML string, so a reply can
 * never inject markup into the page no matter what the model returns.
 */

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; lang: string | null; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'p', text: paragraph.join('\n') });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      flushParagraph();
      const lang = fence[1] || null;
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      blocks.push({ kind: 'code', lang, text: body.join('\n') });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: 'h', level: heading[1].length, text: heading[2] });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      const body = [quote[1]];
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) {
        body.push(lines[i + 1].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: body.join('\n') });
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''));
        i++;
      }
      i--;
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      i--;
      blocks.push({ kind: 'ol', items });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

/**
 * Inline emphasis, code and links.
 *
 * One pass with a single alternation rather than nested replacements, so a `**` inside
 * a code span is left alone instead of being turned into bold markup.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${n++}`;

    if (token.startsWith('`')) {
      out.push(<code key={key} className="md-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const label = token.slice(1, token.indexOf(']'));
      const href = match[6];
      out.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="md-link">
          {label}
        </a>
      );
    }

    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function MarkdownLite({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);

  return (
    <div className="md">
      {blocks.map((block, i) => {
        const key = `b${i}`;
        switch (block.kind) {
          case 'h': {
            const Tag = (['h3', 'h3', 'h4', 'h5'][block.level - 1] || 'h5') as any;
            return <Tag key={key} className="md-h">{renderInline(block.text, key)}</Tag>;
          }
          case 'ul':
            return (
              <ul key={key} className="md-list">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="md-list">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'quote':
            return <blockquote key={key} className="md-quote">{renderInline(block.text, key)}</blockquote>;
          case 'code':
            return (
              <pre key={key} className="md-pre">
                <code>{block.text}</code>
              </pre>
            );
          default:
            return <p key={key} className="md-p">{renderInline(block.text, key)}</p>;
        }
      })}
    </div>
  );
}
