
import "@testing-library/jest-dom";

// Prevent jsdom crash on scrollIntoView (Vitest or Jest)
if (!window.HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    writable: true,
    value: () => {},
  });
}
