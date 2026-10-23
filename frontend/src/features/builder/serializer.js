import { uid } from './config.js';

/** API layout -> client document (adds client keys used for selection/rendering). */
export function fromApi(dashboard) {
  return {
    settings: {
      name: dashboard.name,
      description: dashboard.description,
      canvasWidth: dashboard.canvasWidth,
      backgroundColor: dashboard.backgroundColor,
    },
    sections: dashboard.sections.map((s) => ({
      id: uid('s'),
      title: s.title,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      zIndex: s.zIndex,
      backgroundColor: s.backgroundColor,
      elements: s.elements.map((el) => ({
        id: uid('e'),
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        zIndex: el.zIndex,
        content: el.content,
      })),
    })),
  };
}

/** Client document -> PUT /layout payload (client keys are stripped). */
export function toApi(doc, version) {
  return {
    version,
    settings: { ...doc.settings, name: doc.settings.name.trim(), description: doc.settings.description.trim() },
    sections: doc.sections.map(({ id, elements, ...section }) => ({
      ...section,
      elements: elements.map(({ id: _id, ...element }) => element),
    })),
  };
}

/** Resolves a server error path like "sections.2.elements.0.content" to a client id. */
export function idFromErrorPath(doc, field) {
  const match = /^sections\.(\d+)(?:\.elements\.(\d+))?/.exec(field || '');
  if (!match) return null;
  const section = doc.sections[Number(match[1])];
  if (!section) return null;
  if (match[2] === undefined) return section.id;
  return section.elements[Number(match[2])]?.id ?? section.id;
}
