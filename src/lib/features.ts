// Features switched off for the closed alpha (#32).

/**
 * The Dragon Wardrobe (shop and cosmetics) is hidden until original art (#20):
 * placeholder hats and scarves on Ember were misleading. Golden Scales,
 * owned items and what's equipped all stay in the save, untouched, ready for
 * when it returns. Development and test builds accept `__emberWardrobe`
 * (true) so browser tests keep covering it; production builds compile the
 * override out and keep it hidden.
 */
export function wardrobeEnabled(): boolean {
  if (import.meta.env.DEV) {
    const override = (globalThis as { __emberWardrobe?: unknown }).__emberWardrobe;
    if (typeof override === 'boolean') return override;
  }
  return false;
}
