import type { Dataset } from '@/types/data';
import { newDataset } from './datasets';
import { uid } from './ids';

export const EXAMPLE_VALUES = '12, 8, 15, 7, 11, 10, 9, 14, 6, 13';

/** Example datasets for "Try example data". Built fresh each time so ids are unique. */
export function exampleDatasets(): Dataset[] {
  const twoGroups = newDataset({
    name: 'Example: daisies in mown vs unmown grass',
    kind: 'custom',
    source: 'example',
    description: 'Daisies counted in ten 1 m² quadrats in a mown lawn and ten in an unmown meadow.',
    columns: [
      { key: 'mown', label: 'Mown lawn', type: 'number' },
      { key: 'unmown', label: 'Unmown meadow', type: 'number' },
    ],
    valueColumn: 'mown',
  });
  const mown = [12, 15, 8, 17, 11, 14, 10, 13, 9, 16];
  const unmown = [7, 5, 9, 4, 8, 6, 10, 5, 7, 6];
  twoGroups.rows = mown.map((m, i) => ({ id: uid(), values: { mown: m, unmown: unmown[i] } }));

  const shells = newDataset({
    name: 'Example: limpet shell heights',
    kind: 'custom',
    source: 'example',
    description: 'Heights (mm) of 15 limpets measured on the middle shore.',
    columns: [{ key: 'height', label: 'Shell height', type: 'number', unit: 'mm' }],
    valueColumn: 'height',
  });
  shells.rows = [14.2, 16.8, 12.5, 18.1, 15.0, 13.7, 17.4, 15.9, 14.8, 16.2, 11.9, 15.5, 22.6, 14.1, 16.0].map((h) => ({
    id: uid(),
    values: { height: h },
  }));

  const peas = newDataset({
    name: 'Example: Mendel’s pea seeds',
    kind: 'frequency',
    source: 'example',
    description: 'Seed phenotypes from a dihybrid cross. Mendelian inheritance predicts a 9:3:3:1 ratio.',
    columns: [
      { key: 'category', label: 'Phenotype', type: 'text' },
      { key: 'observed', label: 'Observed', type: 'number' },
      { key: 'expected', label: 'Expected ratio', type: 'number' },
    ],
    valueColumn: 'observed',
  });
  peas.rows = [
    ['Round yellow', 315, 9],
    ['Round green', 108, 3],
    ['Wrinkled yellow', 101, 3],
    ['Wrinkled green', 32, 1],
  ].map(([category, observed, expected]) => ({ id: uid(), values: { category, observed, expected } }));

  const woodlice = newDataset({
    name: 'Example: woodlouse choice chamber',
    kind: 'frequency',
    source: 'example',
    description: 'Where 40 woodlice settled after 10 minutes in a choice chamber. With no preference, expect 1:1.',
    columns: [
      { key: 'category', label: 'Side', type: 'text' },
      { key: 'observed', label: 'Observed', type: 'number' },
      { key: 'expected', label: 'Expected ratio', type: 'number' },
    ],
    valueColumn: 'observed',
  });
  woodlice.rows = [
    ['Damp side', 29, 1],
    ['Dry side', 11, 1],
  ].map(([category, observed, expected]) => ({ id: uid(), values: { category, observed, expected } }));

  return [twoGroups, shells, peas, woodlice];
}
