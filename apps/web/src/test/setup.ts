import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no DragEvent, so fireEvent.drag* would fall back to Event and drop the pointer position.
const view = document.defaultView;
if (view && !Reflect.has(view, "DragEvent")) {
  class DragEvent extends view.MouseEvent {
    dataTransfer: DataTransfer | null;

    constructor(type: string, init: DragEventInit = {}) {
      super(type, init);
      this.dataTransfer = init.dataTransfer ?? null;
    }
  }
  Object.defineProperty(view, "DragEvent", { configurable: true, writable: true, value: DragEvent });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
