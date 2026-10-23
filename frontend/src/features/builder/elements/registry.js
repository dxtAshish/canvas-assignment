import { textElement } from './text/textElement.js';
import { imageElement } from './image/imageElement.js';
import { chartElement } from './chart/chartElement.js';

/**
 * Element type registry. Adding a new element type only requires implementing
 * { label, defaults(), mount(container, element, ctx) -> { update, destroy } }
 * and registering it here (plus its inspector fields and server schema).
 */
export const elementTypes = {
  text: textElement,
  image: imageElement,
  chart: chartElement,
};
