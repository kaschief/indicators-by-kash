// Reads Parallax's per-profile drawing handles (SlotState) as what the chart shows.

import { edge, isLive } from '../../../tests/runtime/scenario.mjs';

const CURRENT_KEYS = ['fillUp', 'fillLo', 'innH', 'innL', 'outH', 'outL'];
const FORECAST_KEYS = ['forecastFillUp', 'forecastFillLo', 'forecastInnH', 'forecastInnL', 'forecastOutH', 'forecastOutL'];

function describe(result, objects) {
  const live = objects.filter(isLive);
  if (!live.length) return null;
  const first = live[0];
  const [leftKey, rightKey] = first.__drawing === 'box' ? ['left', 'right'] : ['x1', 'x2'];
  return { objects: live, left: edge(result, first, leftKey), right: edge(result, first, rightKey), xloc: first.xloc };
}

// What a profile's slot currently shows: its live zones/lines and its forecast, if any.
export function profileView(result, slotVariable) {
  const slot = result.global(slotVariable);
  return {
    current: describe(result, CURRENT_KEYS.map(key => slot[key])),
    forecast: describe(result, FORECAST_KEYS.map(key => slot[key])),
    fibLines: slot.fibLines.filter(isLive),
    liquidityDepthLines: slot.liquidityDepthLines.filter(isLive),
  };
}
