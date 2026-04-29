import { Request, Response } from "express";
import { db } from "../../config/firebase";
import { registrarAuditoria } from "../../utils/auditoria";

export const obtenerLogs = async (req: Request, res: Response) => {
  try {
    const { desde, hasta, ultimoId } = req.query;
    const pageSize = 20;
    
    let query: any = db.collection("auditoria").orderBy("timestamp", "desc");

    if (desde) {
      const desdeFecha = new Date(`${desde}T00:00:00`);
      query = query.where("timestamp", ">=", desdeFecha);
    }
    if (hasta) {
      const hastaFecha = new Date(`${hasta}T23:59:59.999`);
      query = query.where("timestamp", "<=", hastaFecha);
    }

    // Paginación basada en cursor
    if (ultimoId) {
      const lastDoc = await db.collection("auditoria").doc(ultimoId as string).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.limit(pageSize).get();
    
    const logs = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp,
      };
    });

    res.status(200).json(logs);
  } catch (error: any) {
    console.error("Error al obtener logs de auditoría:", error);
    res.status(500).json({ message: "Error al obtener los registros de auditoría" });
  }
};

export const eliminarLogs = async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.body;
    if (!desde || !hasta) {
      return res.status(400).json({ message: "Debe especificar un rango de fechas (desde, hasta)" });
    }

    const start = new Date(`${desde}T00:00:00`);
    const end = new Date(`${hasta}T23:59:59.999`);

    const snapshot = await db.collection("auditoria")
      .where("timestamp", ">=", start)
      .where("timestamp", "<=", end)
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ message: "No se encontraron logs en el rango especificado", eliminados: 0 });
    }

    // Firebase Batch tiene un límite de 500 operaciones
    const chunks = [];
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
      chunks.push(docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    const adminId = (req as any).user?.uid || "SISTEMA";
    await registrarAuditoria('ELIMINAR_LOGS', 'auditoria', 'varios', adminId, { desde, hasta, cantidad: snapshot.size });

    res.status(200).json({ 
      message: `Se eliminaron ${snapshot.size} registros exitosamente`, 
      eliminados: snapshot.size 
    });
  } catch (error: any) {
    console.error("Error al eliminar logs de auditoría:", error);
    res.status(500).json({ message: "Error al intentar eliminar los registros" });
  }
};
