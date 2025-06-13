import bezierEasing from "bezier-easing";

const bezierEasingInverse = (x1, y1, x2, y2) => bezierEasing(y1, x1, y2, x2);

export const linear = (t) => t;

export const sineIn = bezierEasing(0.13, 0, 0.39, 0);
export const quadIn = bezierEasing(0.11, 0, 0.5, 0);
export const cubicIn = bezierEasing(0.32, 0, 0.67, 0);
export const quartIn = bezierEasing(0.5, 0, 0.75, 0);
export const quintIn = bezierEasing(0.64, 0, 0.78, 0);
export const expoIn = bezierEasing(0.7, 0, 0.84, 0);
export const circIn = bezierEasing(0.55, 0, 1, 0.45);

export const sineOut = bezierEasing(0.61, 1, 0.87, 1);
export const quadOut = bezierEasing(0.5, 1, 0.89, 1);
export const cubicOut = bezierEasing(0.33, 1, 0.68, 1);
export const quartOut = bezierEasing(0.25, 1, 0.5, 1);
export const quintOut = bezierEasing(0.22, 1, 0.36, 1);
export const expoOut = bezierEasing(0.16, 1, 0.3, 1);
export const circOut = bezierEasing(0, 0.55, 0.45, 1);

export const sineInOut = bezierEasing(0.36, 0, 0.64, 1);
export const quadInOut = bezierEasing(0.44, 0, 0.56, 1);
export const cubicInOut = bezierEasing(0.66, 0, 0.34, 1);
export const quartInOut = bezierEasing(0.78, 0, 0.22, 1);
export const quintInOut = bezierEasing(0.86, 0, 0.14, 1);
export const expoInOut = bezierEasing(0.9, 0, 0.1, 1);
export const circInOut = bezierEasing(0.85, 0.09, 0.15, 0.91);

export const sineInOutInverse = bezierEasingInverse(0.36, 0, 0.64, 1);
export const quadInOutInverse = bezierEasingInverse(0.44, 0, 0.56, 1);
export const cubicInOutInverse = bezierEasingInverse(0.66, 0, 0.34, 1);
export const quartInOutInverse = bezierEasingInverse(0.78, 0, 0.22, 1);
export const quintInOutInverse = bezierEasingInverse(0.86, 0, 0.14, 1);
export const expoInOutInverse = bezierEasingInverse(0.9, 0, 0.1, 1);
export const circInOutInverse = bezierEasingInverse(0.85, 0.09, 0.15, 0.91);

export const sineOutIn = bezierEasing(0.64, 1, 0.36, 0);
export const quadOutIn = bezierEasing(0.56, 1, 0.44, 0);
export const cubicOutIn = bezierEasing(0.34, 1, 0.66, 0);
export const quartOutIn = bezierEasing(0.22, 1, 0.78, 0);
export const quintOutIn = bezierEasing(0.14, 1, 0.86, 0);
export const expoOutIn = bezierEasing(0.1, 1, 0.9, 0);
export const circOutIn = bezierEasing(0.15, 0.91, 0.85, 0.09);

export default {
  linear,

  sineIn,
  quadIn,
  cubicIn,
  quartIn,
  quintIn,
  expoIn,
  circIn,

  sineOut,
  quadOut,
  cubicOut,
  quartOut,
  quintOut,
  expoOut,
  circOut,

  sineInOut,
  quadInOut,
  cubicInOut,
  quartInOut,
  quintInOut,
  expoInOut,
  circInOut,

  sineInOutInverse,
  quadInOutInverse,
  cubicInOutInverse,
  quartInOutInverse,
  quintInOutInverse,
  expoInOutInverse,
  circInOutInverse,

  sineOutIn,
  quadOutIn,
  cubicOutIn,
  quartOutIn,
  quintOutIn,
  expoOutIn,
  circOutIn,
};
