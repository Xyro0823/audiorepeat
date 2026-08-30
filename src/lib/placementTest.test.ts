import { describe, expect, it } from 'vitest';
import { hasPlacementBank, placementLevelForScore } from './placementTest';

describe('placement test rules', () => {
  it('only enables automatic placement when every CEFR bank exists', () => {
    expect(hasPlacementBank({ es: { A1: 1, A2: 1, B1: 1, B2: 1, C1: 1, C2: 1 } }, 'es')).toBe(true);
    expect(hasPlacementBank({ es: { A1: 1, A2: 1, B1: 1 } }, 'es')).toBe(false);
  });

  it('maps the ten-question score conservatively to a CEFR level', () => {
    expect(placementLevelForScore(0)).toBe('A1');
    expect(placementLevelForScore(3)).toBe('A2');
    expect(placementLevelForScore(5)).toBe('B1');
    expect(placementLevelForScore(7)).toBe('B2');
    expect(placementLevelForScore(9)).toBe('C1');
    expect(placementLevelForScore(10)).toBe('C2');
  });
});
