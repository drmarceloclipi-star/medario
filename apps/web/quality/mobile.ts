export const MOBILE_VIEWPORTS = [360, 390, 412, 430] as const;

export type LayoutMetrics = {
  scrollWidth: number;
  viewportWidth: number;
};

export function hasHorizontalOverflow({ scrollWidth, viewportWidth }: LayoutMetrics) {
  return scrollWidth > viewportWidth;
}

export function isSupportedMobileViewport(width: number) {
  return MOBILE_VIEWPORTS.includes(width as (typeof MOBILE_VIEWPORTS)[number]);
}
