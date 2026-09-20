export type CargoDataListener = () => void;

let revision = 0;
let batchDepth = 0;
let pending = false;
const listeners = new Set<CargoDataListener>();

function flush(): void {
  if (!pending) return;

  pending = false;
  revision += 1;

  for (const listener of [...listeners]) {
    listener();
  }
}

export function getCargoDataRevision(): number {
  return revision;
}

export function subscribeCargoData(listener: CargoDataListener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function invalidateCargoData(): void {
  pending = true;

  if (batchDepth === 0) {
    flush();
  }
}

export async function withCargoDataBatch<T>(
  work: () => Promise<T>
): Promise<T> {
  batchDepth += 1;

  try {
    return await work();
  } finally {
    batchDepth -= 1;

    if (batchDepth === 0) {
      flush();
    }
  }
}
