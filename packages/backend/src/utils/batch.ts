import { db } from "../config/firebase";

/**
 * Firebase limita cada WriteBatch a 500 operaciones (o 10 MiB).
 * Un batch que supere ese límite falla en commit() con INVALID_ARGUMENT
 * y no se escribe nada. Por eso toda escritura masiva pasa por aquí.
 */
export const LIMITE_BATCH = 500;

type Batch = ReturnType<typeof db.batch>;
type Ref = Parameters<Batch["delete"]>[0];
type Doc = { ref: Ref };

const aplicarEnChunks = async (
  docs: Doc[],
  aplicar: (batch: Batch, doc: Doc) => void
): Promise<void> => {
  for (let i = 0; i < docs.length; i += LIMITE_BATCH) {
    const batch = db.batch();
    docs.slice(i, i + LIMITE_BATCH).forEach((doc) => aplicar(batch, doc));
    await batch.commit();
  }
};

/**
 * Elimina documentos troceándolos en batches de hasta 500 operaciones.
 * Usar SIEMPRE que se borre más de un documento.
 */
export const eliminarEnChunks = (docs: Doc[]): Promise<void> =>
  aplicarEnChunks(docs, (batch, doc) => {
    batch.delete(doc.ref);
  });

/**
 * Aplica el mismo update a todos los documentos, en batches de hasta 500 operaciones.
 */
export const actualizarEnChunks = (
  docs: Doc[],
  data: Record<string, unknown>
): Promise<void> =>
  aplicarEnChunks(docs, (batch, doc) => {
    batch.update(doc.ref, data);
  });
