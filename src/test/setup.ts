import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// ── React Flow (@xyflow/react) em jsdom ────────────────────────────────────
// O canvas do construtor de fluxo do bot (src/components/whatsapp/
// FlowCanvas.tsx) usa @xyflow/react, que pede 2 APIs de browser ausentes no
// jsdom: `ResizeObserver` (mede os nós) e `DOMMatrixReadOnly` (lê o
// transform do viewport). Stubs mínimos, só quando ausentes — nenhum teste
// existente depende da ausência. Sem layout real no jsdom os nós NÃO são
// medidos e as arestas do React Flow não chegam a ser desenhadas no DOM:
// por isso o FlowCanvas expõe também a lista textual `aria-label="Conexões do
// fluxo"` (mesmas arestas, `data-edge-*`), que é o que os testes de render
// asserem; a geometria em si é coberta pelas funções puras (flowCanvasModel).
if (typeof window !== "undefined") {
  if (!("ResizeObserver" in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error — stub de teste, jsdom não implementa ResizeObserver.
    window.ResizeObserver = ResizeObserverStub;
    globalThis.ResizeObserver = ResizeObserverStub;
  }
  if (!("DOMMatrixReadOnly" in window)) {
    class DOMMatrixReadOnlyStub {
      m22: number;
      constructor(transform?: string) {
        const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
        this.m22 = scale ? Number(scale) : 1;
      }
    }
    // @ts-expect-error — stub de teste, jsdom não implementa DOMMatrixReadOnly.
    window.DOMMatrixReadOnly = DOMMatrixReadOnlyStub;
    // @ts-expect-error — idem.
    globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyStub;
  }
}
