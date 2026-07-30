/// <reference types="vite/client" />

// Injetadas via `define` em vite.config.ts a partir do HEAD do git no boot
// do dev server/build — ver comentário lá (incidente #3, Fatia 10 Fase D).
declare const __KORA_BUILD_COMMIT__: string;
declare const __KORA_BUILD_BRANCH__: string;
