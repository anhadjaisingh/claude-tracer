import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMS = 384;

export class EmbeddingEngine {
  private extractor: FeatureExtractionPipeline | null = null;
  private ready = false;

  /** Load model -- call once at server startup */
  async init(): Promise<void> {
    this.extractor = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true,
    });
    this.ready = true;
  }

  /** Whether the model is loaded and ready */
  isReady(): boolean {
    return this.ready;
  }

  /** Embed a single text string -> Float32Array (384 dims) */
  async embed(text: string): Promise<Float32Array> {
    if (!this.extractor) {
      throw new Error('EmbeddingEngine not initialized. Call init() first.');
    }

    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return new Float32Array(output.data as Float32Array);
  }

  /** Batch embed for efficiency */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.extractor) {
      throw new Error('EmbeddingEngine not initialized. Call init() first.');
    }

    const results: Float32Array[] = [];
    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }
    return results;
  }

  /** Expected embedding dimensions */
  static get dims(): number {
    return EMBEDDING_DIMS;
  }
}
