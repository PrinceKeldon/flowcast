/**
 * Discovery Engine — minimal RSS 2.0 / Atom parser.
 *
 * Deliberately not a full XML parser or a dependency like
 * fast-xml-parser — both feed formats we actually consume (Reddit's
 * Atom search feed, Google News' RSS 2.0) have a flat, predictable
 * enough shape that a handful of targeted regexes cover it, matching
 * the same approach webExtract.ts takes for og-tags. If a future feed
 * needs real XML parsing (CDATA-heavy, deeply nested), that's a sign
 * to add a real parser rather than stretch this one.
 */

import { decodeEntities } from "./webExtract";

export interface FeedItem {
  title: string;
  link: string;
  publishedAt: string | null; // ISO string if parseable, else null
  snippet: string | null;
}

function stripCdata(text: string): string {
  const match = text.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return match ? match[1] : text;
}

function stripHtmlTags(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeEntities(stripCdata(match[1]).trim()) : null;
}

function extractSelfClosingAttr(block: string, tag: string, attr: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*/?>`, "i"));
  return match ? decodeEntities(match[1]) : null;
}

function toIsoOrNull(dateText: string | null): string | null {
  if (!dateText) return null;
  const parsed = new Date(dateText);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Parses RSS 2.0 <item> entries (Google News' shape). */
export function parseRss2(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemBlocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    if (!title || !link) continue;

    const rawDescription = extractTag(block, "description");
    items.push({
      title: stripHtmlTags(title),
      link: link.trim(),
      publishedAt: toIsoOrNull(extractTag(block, "pubDate")),
      snippet: rawDescription ? stripHtmlTags(rawDescription).slice(0, 240) : null,
    });
  }
  return items;
}

/** Parses Atom <entry> entries (Reddit's search.rss shape). */
export function parseAtom(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryBlocks = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ?? [];

  for (const block of entryBlocks) {
    const title = extractTag(block, "title");
    const link = extractSelfClosingAttr(block, "link", "href");
    if (!title || !link) continue;

    const rawContent = extractTag(block, "content") ?? extractTag(block, "summary");
    items.push({
      title: stripHtmlTags(title),
      link: link.trim(),
      publishedAt: toIsoOrNull(extractTag(block, "updated") ?? extractTag(block, "published")),
      snippet: rawContent ? stripHtmlTags(rawContent).slice(0, 240) : null,
    });
  }
  return items;
}
