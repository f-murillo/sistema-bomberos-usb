import React, { useState, useEffect } from 'react';
import { Bell, Check, Info, AlertTriangle, CheckCircle, Settings, X as CloseIcon } from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import type { Notificacion, TipoNotificacion } from '@bomberos-usb/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const NotificationBell: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [recienLeidas, setRecienLeidas] = useState<string[]>([]);

  // Manejar apertura/cierre para marcar todas como leídas visualmente
  useEffect(() => {
    if (isOpen) {
        // Capturar las que están sin leer actualmente para resaltarlas
        const unreadIds = notificaciones.filter(n => !n.leida && n.id).map(n => n.id!);
        if (unreadIds.length > 0) {
            setRecienLeidas(unreadIds);
            // Marcar todas como leídas en el servidor
            api.patch('/notificaciones/leida').catch(err => {
                console.error("Error al marcar todas como leídas:", err);
            });
        }
    } else {
        // Al cerrar, limpiamos el resaltado temporal
        setRecienLeidas([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!userData?.uid) return;

    // Escuchar notificaciones en tiempo real desde Firestore
    const q = query(
      collection(db, 'notificaciones'),
      where('usuarioId', '==', userData.uid),
      orderBy('fechaCreacion', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convertir timestamp a Date
        fechaCreacion: doc.data().fechaCreacion?.toDate ? doc.data().fechaCreacion.toDate() : doc.data().fechaCreacion
      })) as Notificacion[];
      
      setNotificaciones(docs);
      setUnreadCount(docs.filter(n => !n.leida).length);
    });

    return () => unsubscribe();
  }, [userData?.uid]);

  const marcarComoLeida = async (id: string) => {
    try {
      await api.patch(`/notificaciones/${id}/leida`);
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  };

  const eliminarNotificacion = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Evitar navegar al hacer clic en la X
    try {
      await api.delete(`/notificaciones/${id}`);
    } catch (error) {
      console.error("Error al eliminar notificación:", error);
    }
  };

  const confirmEliminarTodas = async () => {
    try {
      await api.delete('/notificaciones');
      setIsConfirmOpen(false);
    } catch (error) {
      console.error("Error al eliminar todas las notificaciones:", error);
    }
  };

  const getIcon = (tipo?: TipoNotificacion) => {
    switch (tipo) {
      case 'ALERTA': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'EXITO': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'SISTEMA': return <Settings className="h-4 w-4 text-slate-500" />;
      default: return <Info className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white border-2 border-white shadow-md animate-pulse z-20"
            style={{ backgroundColor: '#ef4444' }}
          >
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[90]" 
            onClick={() => setIsOpen(false)} 
          />
          <div className={cn(
            "absolute right-0 mt-2 w-80 max-h-[450px] overflow-hidden flex flex-col rounded-lg bg-white shadow-2xl border border-slate-200 z-[100] animate-in fade-in zoom-in duration-200",
            "origin-top-right lg:left-0 lg:right-auto lg:origin-top-left"
          )}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-slate-800">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              {notificaciones.length > 0 && (
                <button 
                  onClick={() => setIsConfirmOpen(true)}
                  className="text-[10px] text-destructive hover:underline font-medium"
                >
                  Eliminar todas
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-50 overflow-y-auto flex-1">
              {notificaciones.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No tienes notificaciones nuevas</p>
                </div>
              ) : (
                notificaciones.map((notif) => {
                  const esRecienLeida = recienLeidas.includes(notif.id!);
                  
                  return (
                  <div 
                    key={notif.id}
                    className={cn(
                      "p-3 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer group relative",
                      esRecienLeida ? "bg-slate-50/80 border-l-4 border-primary/40 -ml-[1px]" : (!notif.leida ? "bg-blue-50/30" : "")
                    )}
                    onClick={() => {
                      if (!notif.leida && notif.id) marcarComoLeida(notif.id);
                      if (notif.link) {
                        navigate(notif.link);
                      }
                      setIsOpen(false);
                    }}
                  >
                    <div className="mt-0.5 shrink-0">
                      {getIcon(notif.tipo)}
                    </div>
                    <div className="flex-1 space-y-1 pr-6">
                      <p className={cn(
                        "text-xs font-medium leading-tight",
                        !notif.leida ? "text-slate-900" : "text-slate-600"
                      )}>
                        {notif.titulo}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {notif.mensaje}
                      </p>
                      {notif.fechaCreacion && (
                        <p className="text-[10px] text-slate-400 pt-1">
                          {formatDistanceToNow(new Date(notif.fechaCreacion), { 
                            addSuffix: true,
                            locale: es 
                          })}
                        </p>
                      )}
                    </div>
                    
                    {/* Botón X para eliminar individual */}
                    <button
                      onClick={(e) => eliminarNotificacion(e, notif.id!)}
                      className="absolute right-2 top-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-400 transition-all"
                      title="Eliminar"
                    >
                      <CloseIcon className="h-3 w-3" />
                      <span className="sr-only">Eliminar</span>
                    </button>

                    {!notif.leida && (
                      <div className="absolute right-2 bottom-3 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })
            )}
          </div>
            
            <div className="p-2 border-t border-slate-100 bg-slate-50/50">
              <button 
                className="w-full text-center text-[11px] text-slate-500 hover:text-primary font-medium py-1 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Cerrar panel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal de Confirmación para eliminar todas */}
      <Dialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Eliminar todas las notificaciones"
        description="¿Estás seguro de que deseas eliminar todas tus notificaciones? Esta acción no se puede deshacer."
      >
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmEliminarTodas}>
            Eliminar definitivamente
          </Button>
        </div>
      </Dialog>
    </div>
  );
};

export default NotificationBell;
