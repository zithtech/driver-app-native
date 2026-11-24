import { Dimensions, Platform, useWindowDimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

export const hS = (size: number) =>
  (width / guidelineBaseWidth) * size;

export const vS = (size: number) =>
  (height / guidelineBaseHeight) * size;

export const mS = (size: number, factor = 0.5) =>
  size + (Math.min(hS(size), vS(size)) - size) * factor;

// Lowercase aliases for convenience
export const s = hS;
export const vs = vS;
export const ms = mS;
export const mvs = (size: number, factor = 0.5) =>
  size + (vS(size) - size) * factor;

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/* ================= REACTIVE RESPONSIVE HOOK ================= */

export type DeviceTier = 'small' | 'medium' | 'large';

export const useResponsive = () => {
  const { width: w, height: h, fontScale } = useWindowDimensions();

  const isSmallWidth = w < 375;
  const isSmallHeight = h < 720;
  const isSmallDevice = isSmallWidth || isSmallHeight;
  const isTablet = w >= 600;
  const isLargeDevice = w > 430 || h > 880;
  const isMediumDevice = !isSmallDevice && !isLargeDevice;

  const deviceTier: DeviceTier = isSmallDevice ? 'small' : isLargeDevice ? 'large' : 'medium';

  // Reactive horizontal scale
  const rs = (size: number) => (w / guidelineBaseWidth) * size;

  // Reactive vertical scale
  const rvs = (size: number) => (h / guidelineBaseHeight) * size;

  // Reactive moderate scale (with dampening factor)
  const rms = (size: number, factor = 0.5) => size + (rs(size) - size) * factor;

  // Clamped scale: prevents shrinking below minFactor or expanding above maxFactor
  const cs = (size: number, minFactor = 0.85, maxFactor = 1.25) => {
    const scaled = rs(size);
    return Math.min(Math.max(scaled, size * minFactor), size * maxFactor);
  };

  // Device-tier selector helper
  const selectByDevice = <T>(options: { small: T; medium: T; large?: T }): T => {
    if (isSmallDevice) return options.small;
    if (isLargeDevice && options.large !== undefined) return options.large;
    return options.medium;
  };

  return {
    width: w,
    height: h,
    fontScale,
    deviceTier,
    isSmallDevice,
    isMediumDevice,
    isLargeDevice,
    isTablet,
    rs,
    rvs,
    rms,
    cs,
    selectByDevice,
  };
};
