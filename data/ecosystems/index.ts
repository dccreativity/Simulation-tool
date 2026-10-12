import type { EcosystemDef, EcosystemId } from '@/types/ecosystem';
import { coastal } from './coastal';
import { desert } from './desert';
import { grassland } from './grassland';
import { pond } from './pond';
import { tropicalForest } from './tropical-forest';
import { urbanPark } from './urban-park';
import { wetland } from './wetland';
import { woodland } from './woodland';

/** Display order: the order used on the home page and for "Mission n of 8". */
export const ECOSYSTEMS: EcosystemDef[] = [grassland, woodland, pond, coastal, desert, wetland, urbanPark, tropicalForest];

export const ECOSYSTEM_IDS = ECOSYSTEMS.map((e) => e.id);

export function getEcosystem(id: string): EcosystemDef | undefined {
  return ECOSYSTEMS.find((e) => e.id === id);
}

export function isEcosystemId(id: string): id is EcosystemId {
  return ECOSYSTEMS.some((e) => e.id === id);
}

export const METHOD_LABELS = {
  quadrat: 'Quadrat',
  'line-transect': 'Line transect',
  'belt-transect': 'Belt transect',
} as const;
