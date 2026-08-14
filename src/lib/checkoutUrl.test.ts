import { describe, expect, it } from 'vitest';
import { checkoutSuccessUrl } from './checkoutUrl';

describe('checkoutSuccessUrl', () => {
  it('returns the plain success URL when no bypass query is configured', () => {
    expect(checkoutSuccessUrl('https://audiorepeat.vercel.app')).toBe(
      'https://audiorepeat.vercel.app/checkout/success',
    );
  });

  it('returns the plain success URL for an empty bypass query', () => {
    expect(checkoutSuccessUrl('https://audiorepeat.vercel.app', '')).toBe(
      'https://audiorepeat.vercel.app/checkout/success',
    );
  });

  it('returns the plain success URL for whitespace-only bypass query', () => {
    expect(checkoutSuccessUrl('https://audiorepeat.vercel.app', '   ')).toBe(
      'https://audiorepeat.vercel.app/checkout/success',
    );
  });

  it('appends the bypass query when configured', () => {
    expect(
      checkoutSuccessUrl('https://audiorepeat-a42f239jv-xyro7.vercel.app', 'x-vercel-protection-bypass=secret'),
    ).toBe(
      'https://audiorepeat-a42f239jv-xyro7.vercel.app/checkout/success?x-vercel-protection-bypass=secret',
    );
  });

  it('strips a leading ? from the configured query to avoid a malformed URL', () => {
    expect(
      checkoutSuccessUrl('https://audiorepeat.vercel.app', '?x-vercel-protection-bypass=secret'),
    ).toBe('https://audiorepeat.vercel.app/checkout/success?x-vercel-protection-bypass=secret');
  });

  it('never produces a double ? even when the query already has an ampersand param', () => {
    const url = checkoutSuccessUrl('https://audiorepeat.vercel.app', 'x-vercel-protection-bypass=secret');
    expect(url.includes('??')).toBe(false);
    expect(url).toBe(
      'https://audiorepeat.vercel.app/checkout/success?x-vercel-protection-bypass=secret',
    );
  });

  it('production behavior is unchanged: no bypass → identical to the base path', () => {
    const plain = checkoutSuccessUrl('https://audiorepeat.vercel.app', undefined);
    const withProdValue = checkoutSuccessUrl('https://audiorepeat.vercel.app', 'production');
    expect(plain).toBe('https://audiorepeat.vercel.app/checkout/success');
    // A non-empty stray value must still produce a well-formed URL, never a duplicate ?.
    expect(withProdValue.includes('??')).toBe(false);
  });
});
