import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Guardia } from '@bomberos-usb/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GuardiaForm from '@/components/GuardiaForm';
import { generateGuardsReport } from '@/lib/reports';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw,
  Loader2,
  Clock,
  User,
  CheckCircle,
  XCircle,
  MapPin,
  Calendar,
  FileText
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const GuardiasPage = () => {
  const { isSupervisor, isAdmin, userData } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isSupervisor || isAdmin;
  const [activeTab] = useState(canManage ? 'gestion' : 'mis-guardias');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [guardiaAEditar, setGuardiaAEditar] = useState<Guardia | undefined>(undefined);
  const [obsDialogOpen, setObsDialogOpen] = useState<{ id: string, type: 'COMPLETAR' | 'INASISTENCIA', maxMinutos?: number } | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [minutosEfectivos, setMinutosEfectivos] = useState<number>(0);
  const [deleteGuardiaId, setDeleteGuardiaId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIndividualReportOpen, setIsIndividualReportOpen] = useState(false);
  const [selectedBomberoReport, setSelectedBomberoReport] = useState<string>('');

  // Obtener lista de usuarios para el reporte individual
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-reporte'],
    queryFn: () => api.get<any[]>('/usuarios'),
    enabled: canManage
  });
  
  // 1. Obtener guardias
  const { data: guardias, isLoading, isError, refetch } = useQuery({
    queryKey: ['guardias', activeTab, userData?.uid],
    queryFn: () => api.get<Guardia[]>(`/guardias?rel=${activeTab}`),
    staleTime: 5 * 60 * 1000,
  });

  // 2. Mutaciones
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/guardias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardias'] });
      setDeleteGuardiaId(null);
    },
    onError: (error: any) => setErrorMessage(error.message || 'Error al eliminar')
  });

  const updateEstadoMutation = useMutation({
    mutationFn: ({ id, type, obs, mins }: { id: string, type: 'COMPLETAR' | 'INASISTENCIA', obs: string, mins?: number }) => {
        const endpoint = type === 'COMPLETAR' ? 'completar' : 'inasistencia';
        return api.patch(`/guardias/${id}/${endpoint}`, { 
            observaciones: obs,
            minutosEfectivos: mins
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardias'] });
      setObsDialogOpen(null);
      setObservaciones('');
      setMinutosEfectivos(0);
    },
    onError: (error: any) => setErrorMessage(error.message || 'Error al actualizar estado')
  });

  const handleEdit = (guardia: Guardia) => {
    setGuardiaAEditar(guardia);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setGuardiaAEditar(undefined);
    setIsDialogOpen(true);
  };

  const handleUpdateEstado = (id: string, type: 'COMPLETAR' | 'INASISTENCIA', maxMins?: number) => {
    setObsDialogOpen({ id, type, maxMinutos: maxMins });
    if (type === 'COMPLETAR' && maxMins) {
        setMinutosEfectivos(maxMins);
    }
  };

  const handleDownloadGeneralReport = async () => {
    try {
        const res = await api.get<Guardia[]>(`/guardias?rel=gestion&limite=1000`);
        generateGuardsReport(res, { period: 'mensual' });
    } catch (error) {
        alert('Error al generar el reporte general');
    }
  };

  const handleDownloadIndividualReport = async () => {
    if (!selectedBomberoReport) return;
    try {
        const bombero = usuarios?.find(u => u.uid === selectedBomberoReport);
        const nombre = bombero ? bombero.nombre : 'Bombero';
        const res = await api.get<Guardia[]>(`/guardias?rel=gestion&bomberoId=${selectedBomberoReport}&limite=1000`);
        
        generateGuardsReport(res, { 
            period: 'mensual', 
            bomberoId: selectedBomberoReport,
            bomberoNombre: nombre
        });
        setIsIndividualReportOpen(false);
    } catch (error) {
        alert('Error al generar el reporte individual');
    }
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendiente</Badge>;
      case 'COMPLETADA': return <Badge variant="success">Completada</Badge>;
      case 'INASISTENCIA': return <Badge variant="destructive">Inasistencia</Badge>;
      case 'CANCELADA': return <Badge variant="secondary">Cancelada</Badge>;
      default: return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const renderTable = (data: Guardia[], emptyMessage: string) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-200">
            {activeTab === 'gestion' && <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bombero</th>}
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalles</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notas</th>
            <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={activeTab === 'gestion' ? 6 : 5} className="px-6 py-12 text-center text-slate-500 font-medium">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((guardia) => (
              <tr key={guardia.id} className="hover:bg-slate-50/50 transition-colors">
                {activeTab === 'gestion' && (
                  <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-full text-primary">
                              <User size={16} />
                          </div>
                          <span className="font-medium text-slate-900">{guardia.bomberoNombre}</span>
                      </div>
                  </td>
                )}
                <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                            {guardia.fecha ? format(new Date(guardia.fecha), "eeee d 'de' MMMM", { locale: es }) : '-'}
                        </span>
                        <span className="text-xs text-slate-500 capitalize">
                            {guardia.fecha ? format(new Date(guardia.fecha), "yyyy", { locale: es }) : ''}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Clock size={12} className="text-slate-400" />
                            <span className="font-semibold">{guardia.turno}</span>
                            <span className="text-slate-400">|</span>
                            <span>{guardia.minutosEfectivos && guardia.minutosEfectivos !== guardia.minutos 
                                ? `${guardia.minutosEfectivos} / ${guardia.minutos}` 
                                : guardia.minutos} min</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <MapPin size={12} className="text-slate-400" />
                            <span>{guardia.sede}</span>
                            {guardia.numeroParte && (
                                <>
                                    <span className="text-slate-300">•</span>
                                    <span>Parte: {guardia.numeroParte}</span>
                                </>
                            )}
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4">
                   {getStatusBadge(guardia.estado)}
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm max-w-[200px] truncate" title={guardia.observaciones}>
                    {guardia.observaciones || <span className="text-slate-300 italic">Sin notas</span>}
                </td>
                <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                        {canManage && guardia.estado === 'PENDIENTE' && (
                            <>
                                <Button 
                                    variant="outline" size="sm" className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-100"
                                    onClick={() => handleUpdateEstado(guardia.id!, 'COMPLETAR', guardia.minutos)}
                                >
                                    <CheckCircle size={14} className="mr-1" /> Completar
                                </Button>
                                <Button 
                                    variant="outline" size="sm" className="h-8 text-destructive hover:bg-destructive/5 border-destructive/10"
                                    onClick={() => handleUpdateEstado(guardia.id!, 'INASISTENCIA', guardia.minutos)}
                                >
                                    <XCircle size={14} className="mr-1" /> Inasistencia
                                </Button>
                            </>
                        )}
                        {canManage && (
                            <div className="flex gap-1 border-l pl-2 ml-1 border-slate-200">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(guardia)}>
                                    <Pencil size={14} className="text-slate-400" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteGuardiaId(guardia.id!)}>
                                    <Trash2 size={14} className="text-slate-400" />
                                </Button>
                            </div>
                        )}
                    </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="text-primary" />
            {canManage ? "Gestión de Guardias" : "Mis Guardias"}
          </h1>
          <p className="text-slate-500">
            {canManage 
              ? "Control y supervisión de los turnos de guardia del equipo." 
              : "Consulta tus próximos turnos y horario de servicio."}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-10">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </Button>

          {canManage && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 h-10 border-slate-200"
                onClick={handleDownloadGeneralReport}
                disabled={isLoading}
              >
                <FileText size={16} />
                Reporte General
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 h-10 border-slate-200"
                onClick={() => setIsIndividualReportOpen(true)}
                disabled={isLoading}
              >
                <User size={16} />
                Reporte por Bombero
              </Button>
              <Button className="flex-1 sm:flex-none gap-2 shadow-sm h-10" onClick={handleCreate}>
                  <Plus size={18} />
                  Programar Guardia
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
              <div className="p-12 text-center">
                  <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Cargando registros...</p>
              </div>
          ) : isError ? (
              <div className="p-12 text-center text-destructive bg-destructive/5">
                  <XCircle size={32} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Error al conectar con el servidor.</p>
                  <Button variant="link" onClick={() => refetch()}>Reintentar</Button>
              </div>
          ) : (
              renderTable(guardias || [], canManage ? "No hay guardias registradas en el sistema." : "No tienes guardias asignadas.")
          )}
      </div>

      {/* Dialogo para Crear/Editar */}
      <Dialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        title={guardiaAEditar ? "Editar Guardia" : "Programar Guardia"}
        description="Ingresa los detalles del turno y la sede correspondiente."
      >
        <GuardiaForm 
          guardia={guardiaAEditar}
          onSuccess={() => setIsDialogOpen(false)} 
          onCancel={() => setIsDialogOpen(false)} 
        />
      </Dialog>

      {/* Dialogo para Observaciones (Completar/Inasistencia) */}
      <Dialog
        open={!!obsDialogOpen}
        onOpenChange={(open) => !open && setObsDialogOpen(null)}
        title={obsDialogOpen?.type === 'COMPLETAR' ? "Completar Guardia" : "Registrar Inasistencia"}
        description="Puedes agregar una nota u observación sobre el cumplimiento de este turno."
      >
        <div className="space-y-4 py-2">
            {obsDialogOpen?.type === 'COMPLETAR' && (
                <div className="space-y-2">
                    <Label htmlFor="mins">Minutos cumplidos (Máx: {obsDialogOpen.maxMinutos})</Label>
                    <Input 
                        id="mins" 
                        type="number"
                        min={1}
                        max={obsDialogOpen.maxMinutos}
                        value={minutosEfectivos}
                        onChange={(e) => setMinutosEfectivos(Number(e.target.value))}
                    />
                    {(minutosEfectivos < 1 || (obsDialogOpen.maxMinutos && minutosEfectivos > obsDialogOpen.maxMinutos)) && (
                        <p className="text-xs text-destructive font-medium">
                            Coloque los minutos entre 1 y {obsDialogOpen.maxMinutos}
                        </p>
                    )}
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="obs">Observaciones (Opcional)</Label>
                <Input 
                    id="obs" 
                    placeholder={obsDialogOpen?.type === 'COMPLETAR' ? "Ej: Llegó 15 min tarde..." : "Ej: Problemas con el transporte..."} 
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    autoFocus={obsDialogOpen?.type !== 'COMPLETAR'}
                />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setObsDialogOpen(null)}>Cancelar</Button>
                <Button 
                    className={cn(obsDialogOpen?.type === 'COMPLETAR' ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive hover:bg-destructive/90')}
                    onClick={() => updateEstadoMutation.mutate({ 
                        id: obsDialogOpen!.id, 
                        type: obsDialogOpen!.type, 
                        obs: observaciones,
                        mins: obsDialogOpen?.type === 'COMPLETAR' ? minutosEfectivos : undefined
                    })}
                    disabled={
                        updateEstadoMutation.isPending || 
                        (obsDialogOpen?.type === 'COMPLETAR' && (minutosEfectivos < 1 || (obsDialogOpen.maxMinutos && minutosEfectivos > obsDialogOpen.maxMinutos)))
                    }
                >
                    {updateEstadoMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
                </Button>
            </div>
        </div>
      </Dialog>

      {/* Modal de Error */}
      <Dialog
        open={!!errorMessage}
        onOpenChange={(open) => !open && setErrorMessage(null)}
        title="Error en la operación"
      >
        <div className="space-y-4">
            <p className="text-slate-600">{errorMessage}</p>
            <div className="flex justify-end">
                <Button onClick={() => setErrorMessage(null)}>Aceptar</Button>
            </div>
        </div>
      </Dialog>

      {/* Modal Eliminar */}
      <Dialog
        open={!!deleteGuardiaId}
        onOpenChange={(open) => !open && setDeleteGuardiaId(null)}
        title="Eliminar Registro"
        description="Esta acción eliminará permanentemente la guardia del sistema."
      >
        <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteGuardiaId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteGuardiaId!)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Eliminar'}
            </Button>
        </div>
      </Dialog>

      {/* Modal: Selección de Bombero para Reporte Individual */}
      <Dialog
        open={isIndividualReportOpen}
        onOpenChange={setIsIndividualReportOpen}
        title="Generar Reporte Individual"
        description="Selecciona el bombero para generar su reporte mensual de guardias."
      >
        <div className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="bombero-reporte">Bombero</Label>
                <select 
                    id="bombero-reporte"
                    className="w-full px-4 py-2 bg-white border rounded-md focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                    value={selectedBomberoReport} 
                    onChange={(e) => setSelectedBomberoReport(e.target.value)}
                >
                    <option value="">Seleccionar bombero...</option>
                    {usuarios?.filter(u => u.rol !== 'ADMIN' && u.activo !== false).map(u => (
                        <option key={u.uid} value={u.uid}>{u.nombre}</option>
                    ))}
                </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsIndividualReportOpen(false)}>
                    Cancelar
                </Button>
                <Button onClick={handleDownloadIndividualReport} disabled={!selectedBomberoReport}>
                    Descargar Reporte
                </Button>
            </div>
        </div>
      </Dialog>
    </div>
  );
};

export default GuardiasPage;
