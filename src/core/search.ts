import MiniSearch from 'minisearch';
import type {
  AnyBlock,
  SearchEngine,
  SearchOptions,
  SearchResult,
} from '@/types';
import { isUserBlock, isAgentBlock, isToolBlock, isMcpBlock } from '@/types';

interface IndexedBlock {
  id: string;
  type: string;
  content: string;
  toolName?: string;
}

/**
 * MiniSearch-based block search engine
 */
export class BlockSearch implements SearchEngine {
  private miniSearch: MiniSearch<IndexedBlock>;
  private blockTypes: Map<string, string> = new Map();

  constructor() {
    this.miniSearch = new MiniSearch<IndexedBlock>({
      fields: ['content', 'toolName'],
      storeFields: ['id', 'type'],
      searchOptions: {
        boost: { toolName: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  index(blocks: AnyBlock[]): void {
    const documents = blocks.map(block => this.blockToDocument(block));
    this.miniSearch.addAll(documents);
    blocks.forEach(b => this.blockTypes.set(b.id, b.type));
  }

  addBlock(block: AnyBlock): void {
    const document = this.blockToDocument(block);
    this.miniSearch.add(document);
    this.blockTypes.set(block.id, block.type);
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const { limit = 20, types } = options;

    let results = this.miniSearch.search(query).slice(0, limit * 2);

    // Filter by type if specified
    if (types && types.length > 0) {
      results = results.filter(r => {
        const blockType = this.blockTypes.get(r.id);
        return blockType && (types as string[]).includes(blockType);
      });
    }

    return results.slice(0, limit).map(r => ({
      blockId: r.id,
      score: r.score,
      matches: r.match
        ? Object.entries(r.match).map(([field, terms]) => ({
            field,
            snippet: Array.from(terms as unknown as Iterable<string>).join(', '),
          }))
        : undefined,
    }));
  }

  clear(): void {
    this.miniSearch.removeAll();
    this.blockTypes.clear();
  }

  private blockToDocument(block: AnyBlock): IndexedBlock {
    const doc: IndexedBlock = {
      id: block.id,
      type: block.type,
      content: this.extractContent(block),
    };

    if (isToolBlock(block)) {
      doc.toolName = block.toolName;
    }

    if (isMcpBlock(block)) {
      doc.toolName = `${block.serverName}:${block.method}`;
    }

    return doc;
  }

  private extractContent(block: AnyBlock): string {
    if (isUserBlock(block)) {
      return block.content;
    }
    if (isAgentBlock(block)) {
      return [block.content, block.thinking].filter(Boolean).join(' ');
    }
    if (isToolBlock(block) || isMcpBlock(block)) {
      return [
        JSON.stringify(block.input),
        typeof block.output === 'string'
          ? block.output
          : JSON.stringify(block.output),
      ].join(' ');
    }
    return '';
  }
}
