import type { ConfigDoc } from '../config/schema.ts';
import type { SetupMaintenanceMode } from './openai.ts';

export const MODEL_FREE_PRESET = 'no-model';
export const MODEL_FREE_PRESET_STATUS = 'supported';

export interface ModelFreePresetOptions {
  aknoPath: string;
  maintenance: SetupMaintenanceMode;
}

/**
 * Disable every model consumer explicitly. Provider definitions are deliberately absent from
 * this overlay: an existing endpoint can remain available for a later upgrade without any Akno
 * role being allowed to call it.
 */
export function modelFreePreset(options: ModelFreePresetOptions): ConfigDoc {
  const disabled = { id: null, enabled: false } as const;
  return {
    akno_path: options.aknoPath,
    models: {
      embedding: { ...disabled },
      reranker: { ...disabled },
      expansion: { ...disabled },
      derive: { ...disabled },
      answer: { ...disabled },
      vision: { ...disabled },
    },
    maintenance: {
      profile: options.maintenance,
      model: null,
    },
  };
}
