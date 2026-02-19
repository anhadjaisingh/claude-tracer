declare module '@xenova/transformers' {
  export interface FeatureExtractionPipeline {
    (text: string, options?: Record<string, unknown>): Promise<{ data: ArrayLike<number> }>;
  }

  export function pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ): Promise<FeatureExtractionPipeline>;
}
