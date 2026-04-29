import { Request, Response } from "express";
import { NotificacionService } from "./notificaciones.service";

export const getMisNotificaciones = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.uid;
    if (!usuarioId) {
      return res.status(401).json({ message: "No autorizado" });
    }
    
    const notificaciones = await NotificacionService.obtenerDeUsuario(usuarioId);
    res.status(200).json(notificaciones);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener notificaciones" });
  }
};

export const marcarLeida = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await NotificacionService.marcarComoLeida(id);
    res.status(200).json({ message: "Notificación marcada como leída" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar notificación" });
  }
};

export const eliminarNotificacion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await NotificacionService.eliminar(id);
    res.status(200).json({ message: "Notificación eliminada" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar notificación" });
  }
};

export const eliminarTodasLasNotificaciones = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.uid;
    if (!usuarioId) {
      return res.status(401).json({ message: "No autorizado" });
    }
    
    await NotificacionService.eliminarTodas(usuarioId);
    res.status(200).json({ message: "Todas las notificaciones eliminadas" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar las notificaciones" });
  }
};

export const marcarTodasLeidas = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).user?.uid;
    if (!usuarioId) {
      return res.status(401).json({ message: "No autorizado" });
    }
    
    await NotificacionService.marcarTodasComoLeidas(usuarioId);
    res.status(200).json({ message: "Todas las notificaciones marcadas como leídas" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar notificaciones" });
  }
};
