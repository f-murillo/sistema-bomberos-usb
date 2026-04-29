import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Guardia, Usuario } from '@bomberos-usb/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import GuardiaForm from '@/components/GuardiaForm';
import { 
  Calendar, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw,
  Loader2,
  Clock,
  User,
  CheckCircle,
  FileText,
  Download
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateGuardsReport } from '@/lib/reports';

const GuardiasPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [guardiaAEditar, setGuardiaAEditar] = useState<Guardia | undefined>(undefined);
  const [confirmGuardiaId, setConfirmGuardiaId] = useState<string | null>(null);
  const [deleteGuardiaId, setDeleteGuardiaId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isSupervisor, isAdmin, userData } = useAuth();
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar la hora cada minuto para que los avisos de "tiempo cumplido" sean exactos
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Paginación
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);

  // 1. Obtener todas las guardias con caché y paginación
  const { data: guardias, isLoading, isError, refetch } = useQuery({
    queryKey: ['guardias', cursors[currentPage]],
    queryFn: () => api.get<Guardia[]>(`/guardias?${cursors[currentPage] ? `ultimoId=${cursors[currentPage]}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });

  const handleNextPage = () => {
    if (guardias && guardias.length === 20) {
      const lastId = guardias[guardias.length - 1].id;
      if (!cursors.includes(lastId)) {
        setCursors([...cursors, lastId]);
      }
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const resetPagination = () => {
    setCursors([null]);
    setCurrentPage(0);
  };

  // 2. Mutación para eliminar
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/guardias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardias'] });
      resetPagination();
    },
    onError: (error: any) => {
      setErrorMessage(error.message || 'Error al eliminar la guardia');
    }
  });

  const iniciarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/guardias/${id}/iniciar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardias'] });
      resetPagination();
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.message || error.message || 'Error al iniciar la guardia');
    }
  });

  // 4. Mutación para completar (por el bombero)
  const completarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/guardias/${id}/completar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardias'] });
      resetPagination();
    },
    onError: (error: any) => {
      setErrorMessage(error.response?.data?.message || error.message || 'Error al completar la guardia');
    }
  });

  const handleIniciar = (id: string) => {
    iniciarMutation.mutate(id);
  };

  const handleCompletar = (id: string) => {
    if (canManage) {
        setConfirmGuardiaId(id);
    } else {
        completarMutation.mutate(id);
    }
  };

  const confirmCompletar = () => {
    if (confirmGuardiaId) {
        completarMutation.mutate(confirmGuardiaId);
        setConfirmGuardiaId(null);
    }
  };

  const handleEdit = (guardia: Guardia) => {
    setGuardiaAEditar(guardia);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setGuardiaAEditar(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = (guardia: Guardia) => {
    if (guardia.id) {
        setDeleteGuardiaId(guardia.id);
    }
  };

  const confirmDelete = () => {
    if (deleteGuardiaId) {
        deleteMutation.mutate(deleteGuardiaId);
        setDeleteGuardiaId(null);
    }
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE': return <Badge variant="outline">Pendiente</Badge>;
      case 'EN_CURSO': return <Badge variant="default" className="bg-blue-500 text-white border-none animate-pulse">En curso</Badge>;
      case 'COMPLETADA': return <Badge variant="success">Completada</Badge>;
      case 'INASISTENCIA': return <Badge variant="destructive">Inasistencia</Badge>;
      case 'CANCELADA': return <Badge variant="secondary">Cancelada</Badge>;
      default: return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const canManage = isSupervisor;
  const isManagementView = isAdmin || isSupervisor; 
  
  const title = isManagementView ? "Gestión de Guardias" : "Mis Guardias";
  const subtitle = isManagementView 
    ? "Visualiza y coordina los turnos de guardia del equipo." 
    : "Consulta tus próximos turnos y horario de servicio.";

  const totalCols = isManagementView ? 6 : 5;

  const proximasGuardias = guardias?.filter(g => g.estado === 'PENDIENTE' || g.estado === 'EN_CURSO') || [];
  const historialGuardias = guardias?.filter(g => g.estado !== 'PENDIENTE' && g.estado !== 'EN_CURSO')
    .sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()) || [];

  const renderTable = (data: Guardia[], emptyMessage: string, showActions: boolean = true) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[700px] lg:min-w-0">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-200">
            {isManagementView && <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bombero</th>}
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Horario</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Observaciones</th>
            {showActions && <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={showActions ? totalCols : totalCols - 1} className="px-6 py-12 text-center text-slate-500 font-medium">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((guardia) => {
              const fechaInicio = new Date(guardia.fechaInicio);
              const fechaFin = new Date(guardia.fechaFin);
              
              // Deshabilitar botón de inicio si falta más de 10 min
              const esMuyTemprano = currentTime.getTime() < (fechaInicio.getTime() - 10 * 60 * 1000);
              const esDuenio = guardia.bomberoId === userData?.uid;
              const yaTermino = currentTime.getTime() > fechaFin.getTime();

              return (
              <tr key={guardia.id} className="hover:bg-slate-50/50 transition-colors">
                {isManagementView && (
                  <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-full text-primary">
                              <User size={16} />
                          </div>
                          <span className="font-medium text-slate-900">{guardia.bomberoNombre || 'Cargando...'}</span>
                      </div>
                  </td>
                )}
                <td className="px-6 py-4 text-slate-600">
                    {guardia.fechaInicio ? format(new Date(guardia.fechaInicio), "eeee d 'de' MMMM", { locale: es }) : '-'}
                </td>
                <td className="px-6 py-4 text-slate-600">
                    <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        {guardia.fechaInicio && guardia.fechaFin ? (
                            <span>
                                {format(new Date(guardia.fechaInicio), "HH:mm")} - {format(new Date(guardia.fechaFin), "HH:mm")}
                            </span>
                        ) : '-'}
                    </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-start gap-1">
                    {getStatusBadge(guardia.estado)}
                    {guardia.estado === 'EN_CURSO' && yaTermino && (
                      <span className="text-[10px] font-bold text-destructive animate-pulse flex items-center gap-1">
                         ⚠️ Tiempo cumplido
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm max-w-[200px] truncate" title={guardia.observaciones}>
                    {guardia.observaciones || <span className="text-slate-300 italic">Sin observaciones</span>}
                </td>
                {showActions && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {/* ACCIÓN DE INICIAR (Solo si está Pendiente) */}
                      {guardia.estado === 'PENDIENTE' && (esDuenio || canManage) && (
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-8 text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100"
                            onClick={() => handleIniciar(guardia.id!)}
                            disabled={iniciarMutation.isPending || esMuyTemprano}
                            title={esMuyTemprano ? "Aún no es la hora de inicio" : "Marcar inicio de guardia"}
                        >
                            {iniciarMutation.isPending && iniciarMutation.variables === guardia.id ? (
                                <Loader2 size={14} className="animate-spin mr-1" />
                            ) : null}
                            Iniciar Guardia
                        </Button>
                      )}

                      {/* ACCIÓN DE COMPLETAR (Si está En Curso o Pendiente para Supervisor) */}
                      {(guardia.estado === 'EN_CURSO' || (guardia.estado === 'PENDIENTE' && canManage)) && (esDuenio || canManage) && (
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-8 text-xs font-semibold bg-green-50 text-green-600 hover:bg-green-100 border-green-100"
                            onClick={() => handleCompletar(guardia.id!)}
                            disabled={completarMutation.isPending}
                        >
                            {completarMutation.isPending && completarMutation.variables === guardia.id ? (
                                <Loader2 size={14} className="animate-spin mr-1" />
                            ) : null}
                            Marcar como completa
                        </Button>
                      )}
                      
                      {canManage && (
                        <div className="flex gap-1 ml-2 border-l pl-2 border-slate-200">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-primary"
                            onClick={() => handleEdit(guardia)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-destructive"
                            onClick={() => handleDelete(guardia)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm sm:text-base text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="flex-1 sm:flex-none gap-2 h-10">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Actualizar
          </Button>

          {canManage && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateGuardsReport(guardias || [], 'semanal')} 
                className="flex-1 sm:flex-none gap-2 h-10 border-blue-200 hover:bg-blue-50 text-blue-700"
                disabled={isLoading}
              >
                <FileText size={16} />
                Reporte Semanal
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => generateGuardsReport(guardias || [], 'mensual')} 
                className="flex-1 sm:flex-none gap-2 h-10 border-indigo-200 hover:bg-indigo-50 text-indigo-700"
                disabled={isLoading}
              >
                <FileText size={16} />
                Reporte Mensual
              </Button>
              
              <Button className="flex-1 sm:flex-none flex items-center justify-center gap-2 shadow-sm h-10" onClick={handleCreate}>
                <Plus size={18} />
                Nueva Guardia
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setGuardiaAEditar(undefined);
        }}
        title={guardiaAEditar ? "Editar Guardia" : "Programar Nueva Guardia"}
        description={guardiaAEditar ? "Modifica los detalles del turno." : "Asigna un nuevo turno de guardia a un bombero."}
      >
        <GuardiaForm 
          guardia={guardiaAEditar}
          onSuccess={() => {
            setIsDialogOpen(false);
            setGuardiaAEditar(undefined);
          }} 
          onCancel={() => {
            setIsDialogOpen(false);
            setGuardiaAEditar(undefined);
          }} 
        />
      </Dialog>

      {/* SECCIÓN 1: PRÓXIMOS TURNOS */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                Próximos Turnos Programados
            </h3>
        </div>
        
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
            <p className="text-slate-500">Cargando cronograma...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-destructive bg-destructive/5">
            Error al cargar las guardias. Por favor, intenta de nuevo.
          </div>
        ) : (
          renderTable(proximasGuardias, "No tienes guardias pendientes actualmente.")
        )}
      </div>

      {/* SECCIÓN 2: HISTORIAL (Solo si hay datos o no está cargando) */}
      {!isLoading && !isError && historialGuardias.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden opacity-90">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <CheckCircle size={18} className="text-slate-500" />
                  Historial de Actividad
              </h3>
          </div>
          {renderTable(historialGuardias, "No hay historial registrado.", isManagementView)}
        </div>
      )}

      {/* Paginación */}
      {!isLoading && !isError && (guardias?.length === 20 || currentPage > 0) && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm mt-4">
          <div className="text-sm text-slate-500">
            Página <span className="font-bold text-slate-900">{currentPage + 1}</span>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevPage} 
              disabled={currentPage === 0 || isLoading}
              className="h-8"
            >
              Anterior
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNextPage} 
              disabled={!guardias || guardias.length < 20 || isLoading}
              className="h-8"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Completar */}
      <Dialog
        open={!!confirmGuardiaId}
        onOpenChange={(open) => !open && setConfirmGuardiaId(null)}
        title="Confirmar Finalización"
        description="¿Confirmas que has terminado este turno de guardia? Esta acción cambiará el estado a Completada."
      >
        <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setConfirmGuardiaId(null)}>
                Cancelar
            </Button>
            <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={confirmCompletar}>
                Sí, completar guardia
            </Button>
        </div>
      </Dialog>

      {/* Modal de Alerta / Error */}
      <Dialog
        open={!!errorMessage}
        onOpenChange={(open) => !open && setErrorMessage(null)}
        title="Atención"
      >
        <div className="space-y-4">
            <p className="text-slate-600">{errorMessage}</p>
            <div className="flex justify-end pt-2">
                <Button onClick={() => setErrorMessage(null)}>
                    Aceptar
                </Button>
            </div>
        </div>
      </Dialog>

      {/* Modal de Confirmación para Eliminar */}
      <Dialog
        open={!!deleteGuardiaId}
        onOpenChange={(open) => !open && setDeleteGuardiaId(null)}
        title="Eliminar Guardia"
        description="¿Estás seguro de que deseas eliminar esta guardia? Esta acción no se puede deshacer."
      >
        <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteGuardiaId(null)}>
                Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
                Eliminar definitivamente
            </Button>
        </div>
      </Dialog>
    </div>
  );
};

export default GuardiasPage;
