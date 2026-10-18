// G94 / CT4 — flags do catálogo (fonte e escrita) como estado REATIVO: troca no card de Configurações
// (mesma aba, via CustomEvent) ou em outra aba (via `storage`) reflete na tela sem recarregar.
// Mesmo molde de `useSupabaseTasksWriteFlag.ts`. As chaves/semântica vivem em `config/flags.ts`
// (default LOCAL; só "supabase" liga a nuvem; escrita opt-in, só "true").
import { useCallback, useEffect, useState } from "react";
import {
  CATALOG_DATA_SOURCE_KEY,
  CATALOG_WRITE_FLAG_KEY,
  getCatalogDataSource,
  getCatalogWriteEnabled,
  setCatalogDataSource,
  setCatalogWriteEnabled,
  type DataSource,
} from "@/config/flags";

export const CATALOG_SOURCE_EVENT = "kora:catalog-source-changed";

function notify() {
  try {
    window.dispatchEvent(new CustomEvent(CATALOG_SOURCE_EVENT));
  } catch {
    /* ignore */
  }
}

export function useCatalogSource(): {
  dataSource: DataSource;
  writeEnabled: boolean;
  setDataSource: (source: DataSource) => void;
  setWriteEnabled: (value: boolean) => void;
} {
  const [dataSource, setDataSourceState] = useState<DataSource>(() => getCatalogDataSource());
  const [writeEnabled, setWriteEnabledState] = useState<boolean>(() => getCatalogWriteEnabled());

  useEffect(() => {
    const sync = () => {
      setDataSourceState(getCatalogDataSource());
      setWriteEnabledState(getCatalogWriteEnabled());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === CATALOG_DATA_SOURCE_KEY || event.key === CATALOG_WRITE_FLAG_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CATALOG_SOURCE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CATALOG_SOURCE_EVENT, sync);
    };
  }, []);

  const setDataSource = useCallback((source: DataSource) => {
    setCatalogDataSource(source);
    setDataSourceState(source);
    notify();
  }, []);

  const setWriteEnabled = useCallback((value: boolean) => {
    setCatalogWriteEnabled(value);
    setWriteEnabledState(value);
    notify();
  }, []);

  return { dataSource, writeEnabled, setDataSource, setWriteEnabled };
}
