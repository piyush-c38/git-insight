/** Diagnostic logging for embedding pipeline profiling (no behavior changes). */

export type EmbeddingBatchDiag = {
  batchIndex: number;
  inputCount: number;
  modelInvocation: 'extractor(texts)' | 'extractor(text)';
  outputDims: string;
  modelInferenceMs: number;
  tensorConversionMs: number;
  tensorTolistMs: number;
  tensorSliceMs: number;
  validationMs: number;
  workerTotalMs: number;
  conversionPath: 'tolist' | 'slice' | 'unknown';
};

export function logWorkerBatchDiag(diag: EmbeddingBatchDiag): void {
  console.log('[embed-diag] ── worker batch', diag.batchIndex, '──');
  console.log('[embed-diag] Batch input count:', diag.inputCount);
  console.log('[embed-diag] Model invocation:', diag.modelInvocation);
  console.log('[embed-diag] Output tensor shape (dims):', diag.outputDims);
  console.log('[embed-diag] Model inference time:', `${diag.modelInferenceMs.toFixed(1)} ms`);
  console.log('[embed-diag] Tensor conversion time (used):', `${diag.tensorConversionMs.toFixed(1)} ms`);
  console.log('[embed-diag] tensor.tolist() time (probe only):', `${diag.tensorTolistMs.toFixed(1)} ms`);
  console.log('[embed-diag] tensor slice conversion time (probe only):', `${diag.tensorSliceMs.toFixed(1)} ms`);
  console.log('[embed-diag] Conversion path used:', diag.conversionPath);
  console.log('[embed-diag] Validation time:', `${diag.validationMs.toFixed(1)} ms`);
  console.log('[embed-diag] Worker embedTexts total:', `${diag.workerTotalMs.toFixed(1)} ms`);

  const accounted =
    diag.modelInferenceMs +
    diag.tensorConversionMs +
    diag.validationMs;
  const unaccounted = Math.max(0, diag.workerTotalMs - accounted);
  console.log('[embed-diag] Unaccounted in worker:', `${unaccounted.toFixed(1)} ms`);

  if (diag.inputCount > 0) {
    const inferPerText = diag.modelInferenceMs / diag.inputCount;
    console.log('[embed-diag] Model inference per text:', `${inferPerText.toFixed(1)} ms`);
    if (diag.inputCount > 1 && inferPerText > 400) {
      console.warn(
        '[embed-diag] WARNING: High per-text inference time suggests sequential processing inside the model'
      );
    }
    if (diag.outputDims.match(/^\[1,/) && diag.inputCount > 1) {
      console.warn(
        '[embed-diag] WARNING: Output batch dimension is 1 but input count > 1 — model may not be batching'
      );
    }
  }
}

export function logPoolBatchDiag(options: {
  batchIndex: number;
  textsSent: number;
  workerRoundTripMs: number;
  recordAssemblyMs: number;
  configuredBatchSize: number;
}): void {
  console.log('[embed-diag] ── pool batch', options.batchIndex, '──');
  console.log('[embed-diag] Pool configured batch size:', options.configuredBatchSize);
  console.log('[embed-diag] Texts sent to worker:', options.textsSent);
  console.log('[embed-diag] Worker round-trip (postMessage + inference + reply):', `${options.workerRoundTripMs.toFixed(1)} ms`);
  console.log('[embed-diag] Record assembly time:', `${options.recordAssemblyMs.toFixed(1)} ms`);
  const messagingEstimate = Math.max(0, options.workerRoundTripMs - options.recordAssemblyMs);
  console.log('[embed-diag] Estimated worker+messaging overhead in round-trip:', `${messagingEstimate.toFixed(1)} ms`);
}
