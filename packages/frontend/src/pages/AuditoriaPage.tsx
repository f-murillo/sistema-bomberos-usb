import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { 
  History, 
  Trash2, 
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

const AuditoriaPage = () => {
  const [desde, setDesde] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteRange, setDeleteRange] = useState({ desde: '', hasta: '', label: '' });
  
  // Paginación
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);

  const queryClient = useQueryClient();

  // 1. Obtener logs (con caché de 5 minutos)
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['auditoria', desde, hasta, cursors[currentPage]],
    queryFn: async () => {
        const url = `/auditoria?desde=${desde}&hasta=${hasta}${cursors[currentPage] ? `&ultimoId=${cursors[currentPage]}` : ''}`;
        const res = await api.get<any[]>(url);
        return res;
    },
    staleTime: 5 * 60 * 1000, // Evita re-fetch al cambiar de pestaña por 5 minutos
  });

  const handleNextPage = () => {
    if (logs && logs.length === 20) {
      const lastId = logs[logs.length - 1].id;
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

  // Resetear paginación al cambiar filtros
  const resetPagination = () => {
    setCursors([null]);
    setCurrentPage(0);
  };

  // 2. Mutación para eliminar
  const deleteMutation = useMutation({
    mutationFn: (range: { desde: string, hasta: string }) => 
      api.post('/auditoria/eliminar', range),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditoria'] });
      setShowDeleteConfirm(false);
      resetPagination();
    },
    onError: (error: any) => {
      alert(error.message || 'Error al eliminar registros');
    }
  });

  const handleQuickFilter = (type: 'hoy' | 'semana' | 'mes') => {
    const now = new Date();
    resetPagination();
    if (type === 'hoy') {
      const today = format(now, 'yyyy-MM-dd');
      setDesde(today);
      setHasta(today);
    } else if (type === 'semana') {
      setDesde(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setHasta(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (type === 'mes') {
      setDesde(format(startOfMonth(now), 'yyyy-MM-dd'));
      setHasta(format(endOfMonth(now), 'yyyy-MM-dd'));
    }
  };

  const prepDelete = (type: 'dia' | 'semana' | 'mes') => {
    const now = new Date();
    let d = '', h = '', l = '';
    
    if (type === 'dia') {
      d = h = format(now, 'yyyy-MM-dd');
      l = 'hoy';
    } else if (type === 'semana') {
      d = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      h = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      l = 'esta semana';
    } else if (type === 'mes') {
      d = format(startOfMonth(now), 'yyyy-MM-dd');
      h = format(endOfMonth(now), 'yyyy-MM-dd');
      l = 'este mes';
    }
    
    setDeleteRange({ desde: d, hasta: h, label: l });
    setShowDeleteConfirm(true);
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'CREAR_USUARIO': 'Crear Usuario',
      'ACTUALIZAR_USUARIO': 'Editar Usuario',
      'ELIMINAR_USUARIO': 'Eliminar Usuario',
      'CAMBIAR_PASSWORD': 'Cambio Contraseña',
      'CREAR_GUARDIA': 'Programar Guardia',
      'ACTUALIZAR_GUARDIA': 'Editar Guardia',
      'ELIMINAR_GUARDIA': 'Eliminar Guardia',
      'INICIAR_GUARDIA': 'Iniciar Turno',
      'COMPLETAR_GUARDIA': 'Finalizar Turno',
      'CANCELAR_GUARDIA': 'Cancelar Guardia',
      'INASISTENCIA_GUARDIA': 'Marcar Inasistencia',
      'ELIMINAR_LOGS': 'Limpieza Logs'
    };
    return labels[action] || action;
  };

  const getActionDescription = (log: any) => {
    const { accion, detalles, coleccion } = log;
    
    if (accion === 'CREAR_USUARIO' && coleccion === 'usuarios') return `Se creó el usuario: ${detalles?.nombre || 'nuevo'}`;
    if (accion === 'ACTUALIZAR_USUARIO') return `Se actualizaron los datos del usuario`;
    if (accion === 'CAMBIAR_PASSWORD') return `Un usuario cambió su contraseña de acceso`;
    if (accion === 'CREAR_GUARDIA') return `Se programó una nueva guardia`;
    if (accion === 'ACTUALIZAR_GUARDIA') return `Se modificaron los detalles de la guardia`;
    if (accion === 'INICIAR_GUARDIA') return `Se marcó el inicio de la guardia`;
    if (accion === 'COMPLETAR_GUARDIA') return `Se completó la guardia satisfactoriamente`;
    if (accion === 'CANCELAR_GUARDIA') return `Se canceló la guardia programada`;
    if (accion === 'INASISTENCIA_GUARDIA') return `Se registró una inasistencia a la guardia`;
    if (accion === 'ELIMINAR_LOGS') return `Se eliminaron registros de auditoría antiguos`;
    if (accion === 'ELIMINAR_GUARDIA') return `Se eliminó permanentemente una guardia`;
    if (accion === 'ELIMINAR_USUARIO') return `Se eliminó un usuario del sistema`;
    
    return 'Acción realizada en el sistema';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <History className="text-primary" size={32} />
            Auditoría del Sistema
          </h1>
          <p className="text-slate-500">Registro histórico de acciones realizadas por los usuarios.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-6 items-end">
            <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Desde</label>
                <Input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); resetPagination(); }} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Hasta</label>
                <Input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); resetPagination(); }} />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <Button variant="secondary" size="sm" onClick={() => handleQuickFilter('hoy')}>Hoy</Button>
              <Button variant="secondary" size="sm" onClick={() => handleQuickFilter('semana')}>Esta Semana</Button>
              <Button variant="secondary" size="sm" onClick={() => handleQuickFilter('mes')}>Este Mes</Button>
            </div>

            <div className="lg:ml-auto flex flex-wrap gap-2 w-full lg:w-auto border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6 border-slate-200">
               <span className="text-xs font-bold uppercase text-slate-400 self-center mr-2 w-full lg:w-auto mb-2 lg:mb-0">Limpiar registros de:</span>
               <div className="flex flex-wrap gap-2">
                 <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-8 px-3" onClick={() => prepDelete('dia')}>Hoy</Button>
                 <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-8 px-3" onClick={() => prepDelete('semana')}>Semana</Button>
                 <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-8 px-3" onClick={() => prepDelete('mes')}>Mes</Button>
                 <div className="w-[1px] h-6 bg-slate-200 mx-1 hidden sm:block self-center" />
                 <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive border-destructive/20 hover:bg-red-50 h-8 px-3 font-semibold" 
                  onClick={() => {
                    setDeleteRange({ desde, hasta, label: 'el rango seleccionado' });
                    setShowDeleteConfirm(true);
                  }}
                >
                  Limpiar Selección
                </Button>
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Fecha y Hora</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Acción</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Colección</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Realizado por (UID)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Descripción del Evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-primary" size={32} />
                    <p className="mt-2 text-slate-500">Cargando registros...</p>
                  </td>
                </tr>
              ) : logs?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <History className="mx-auto text-slate-200 mb-2" size={48} />
                    <p className="text-slate-500">No hay registros para este rango de fechas.</p>
                  </td>
                </tr>
              ) : (
                logs?.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.accion.includes('ELIMINAR') || log.accion.includes('CANCELAR') || log.accion.includes('INASISTENCIA') ? 'bg-red-100 text-red-700' : 
                        log.accion.includes('CREAR') || log.accion.includes('INICIAR') || log.accion.includes('COMPLETAR') ? 'bg-green-100 text-green-700' : 
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {getActionLabel(log.accion)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 italic">
                      {log.coleccion}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono text-[11px]">
                      {log.realizadoPor}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                      {getActionDescription(log)}
                      <div className="text-[9px] text-slate-400 font-mono mt-1 opacity-50 overflow-hidden truncate max-w-[200px]">
                        ID: {log.documentoId}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
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
              disabled={!logs || logs.length < 20 || isLoading}
              className="h-8"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirmación de eliminación */}
      <Dialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="¿Eliminar registros?"
        description="Esta acción es permanente y no se puede deshacer."
      >
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          
          <p className="text-slate-600">
            Estás a punto de eliminar todos los registros de auditoría de <span className="font-bold text-slate-900">{deleteRange.label}</span> ({deleteRange.desde} al {deleteRange.hasta}).
          </p>
          
          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={() => deleteMutation.mutate({ desde: deleteRange.desde, hasta: deleteRange.hasta })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Trash2 className="mr-2" size={16} />}
              Sí, eliminar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AuditoriaPage;
