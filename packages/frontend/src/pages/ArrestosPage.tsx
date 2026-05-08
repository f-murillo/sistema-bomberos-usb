import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { 
  ShieldAlert, 
  History, 
  Plus, 
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit2,
  Trash2,
  ListTodo,
  User as UserIcon,
  Info,
  FileText,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import { generateArrestosReport, generateArrestosExcel } from '@/lib/reports';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Arresto, Usuario } from '@bomberos-usb/shared';
import ArrestoForm from '@/components/ArrestoForm';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select-simple';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ArrestosPage = () => {
  const { userData, isSupervisor, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);
  
  if (isAdmin) return null;
  const [activeTab, setActiveTab] = useState<'recibidos' | 'asignados' | 'global'>('recibidos');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState<'INFRACCION' | 'PAGO'>('PAGO');
  const [selectedArresto, setSelectedArresto] = useState<Arresto | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [notasRevision, setNotasRevision] = useState('');
  const [isIndividualReportOpen, setIsIndividualReportOpen] = useState(false);
  const [isGeneralReportOpen, setIsGeneralReportOpen] = useState(false);
  const [selectedBomberoReport, setSelectedBomberoReport] = useState<string>('');

  // Resetear página al cambiar de pestaña
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  // Obtener lista de usuarios para el reporte individual
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-reporte'],
    queryFn: () => api.get<any[]>('/usuarios'),
    enabled: isSupervisor || isAdmin
  });

  // 1. Obtener historial según el tab activo y página
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['arrestos', activeTab, page, userData?.uid],
    queryFn: () => {
        let url = `/arrestos?page=${page}&limit=${limit}`;
        if (activeTab === 'recibidos') url += '&relacion=recibidos';
        if (activeTab === 'asignados') url += '&relacion=asignados';
        if (activeTab === 'global') url += '&relacion=todo';
        return api.get<{ items: Arresto[], totalItems: number, totalPages: number, currentPage: number }>(url);
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de caché fresca
    placeholderData: (prev) => prev,
  });

  const historial = data?.items || [];
  const totalPages = data?.totalPages || 1;

  // 2. Obtener datos actualizados del usuario (para el balance)
  const { data: userProfile } = useQuery({
    queryKey: ['profile', userData?.uid],
    queryFn: () => api.get<Usuario>(`/usuarios/${userData?.uid}`),
    enabled: !!userData?.uid
  });

  // 3. Mutación para revisar
  const reviewMutation = useMutation({
    mutationFn: ({ id, estado, notas }: { id: string, estado: 'PAGADO' | 'RECHAZADO', notas: string }) => 
        api.patch(`/arrestos/${id}/revisar`, { estado, notasRevision: notas }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['arrestos'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        setIsReviewOpen(false);
        setSelectedArresto(null);
        setNotasRevision('');
    }
  });

  // 4. Mutación para eliminar
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/arrestos/${id}`),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['arrestos'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  });

  const balance = userProfile?.minutosArresto ?? userData?.minutosArresto ?? 0;
  const horasCompletas = Math.floor(balance / 60);
  const minutosRestantes = balance % 60;

  const handleDownloadGeneralReport = async () => {
    try {
        // Buscamos TODOS los arrestos del mes para el reporte (limit=1000)
        const res = await api.get<{items: Arresto[]}>(`/arrestos?relacion=todo&limit=1000`);
        
        // Parcheamos nombres faltantes usando la lista de usuarios cargada
        const patchedItems = res.items.map(item => {
            if (!item.bomberoNombre || item.bomberoNombre === 'Sin Nombre' || item.bomberoNombre === 'Bombero') {
                const user = usuarios?.find(u => u.uid === item.bomberoId);
                if (user) return { ...item, bomberoNombre: user.nombre };
            }
            return item;
        });

        generateArrestosReport(patchedItems, { period: 'mensual' });
    } catch (error) {
        alert('Error al generar el reporte general');
    }
  };

  const handleDownloadGeneralExcel = async () => {
    try {
        const res = await api.get<{items: Arresto[]}>(`/arrestos?relacion=todo&limit=1000`);
        const patchedItems = res.items.map(item => {
            if (!item.bomberoNombre || item.bomberoNombre === 'Sin Nombre' || item.bomberoNombre === 'Bombero') {
                const user = usuarios?.find(u => u.uid === item.bomberoId);
                if (user) return { ...item, bomberoNombre: user.nombre };
            }
            return item;
        });
        generateArrestosExcel(patchedItems, { period: 'mensual' });
    } catch (error) {
        alert('Error al generar el reporte Excel');
    }
  };

  const handleDownloadIndividualReport = async () => {
    if (!selectedBomberoReport) return;
    try {
        const bombero = usuarios?.find(u => u.uid === selectedBomberoReport);
        const nombre = bombero ? bombero.nombre : 'Bombero';
        const res = await api.get<{items: Arresto[]}>(`/arrestos?relacion=todo&bomberoId=${selectedBomberoReport}&limit=1000`);
        
        const patchedItems = res.items.map(item => ({
            ...item,
            bomberoNombre: item.bomberoNombre && item.bomberoNombre !== 'Sin Nombre' ? item.bomberoNombre : nombre
        }));

        generateArrestosReport(patchedItems, { 
            period: 'mensual', 
            bomberoId: selectedBomberoReport,
            bomberoNombre: nombre
        });
        setIsIndividualReportOpen(false);
    } catch (error) {
        alert('Error al generar el reporte individual');
    }
  };

  const handleDownloadIndividualExcel = async () => {
    if (!selectedBomberoReport) return;
    try {
        const bombero = usuarios?.find(u => u.uid === selectedBomberoReport);
        const nombre = bombero ? bombero.nombre : 'Bombero';
        const res = await api.get<{items: Arresto[]}>(`/arrestos?relacion=todo&bomberoId=${selectedBomberoReport}&limit=1000`);
        
        const patchedItems = res.items.map(item => ({
            ...item,
            bomberoNombre: item.bomberoNombre && item.bomberoNombre !== 'Sin Nombre' ? item.bomberoNombre : nombre
        }));

        generateArrestosExcel(patchedItems, { 
            period: 'mensual', 
            bomberoId: selectedBomberoReport,
            bomberoNombre: nombre
        });
        setIsIndividualReportOpen(false);
    } catch (error) {
        alert('Error al generar el reporte Excel');
    }
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Pagado</Badge>;
      case 'RECHAZADO':
        return <Badge variant="destructive">Rechazado</Badge>;
      case 'PENDIENTE_VALIDACION':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Por Validar</Badge>;
      case 'PENDIENTE_PAGO':
      default:
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Pendiente</Badge>;
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este arresto? Esto restaurará los minutos al balance del bombero.')) {
        deleteMutation.mutate(id);
    }
  };

  const renderTable = (items: Arresto[]) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
            <thead>
            <tr className="bg-slate-50 border-b">
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Fecha</th>
                {(activeTab === 'global' || activeTab === 'asignados') && <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Bombero</th>}
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Minutos</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Motivo</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-right">Acciones</th>
            </tr>
            </thead>
            <tbody className="divide-y">
            {items.map((arresto) => (
                <tr key={arresto.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {arresto.fechaRegistro ? format(new Date(arresto.fechaRegistro), 'dd/MM/yyyy HH:mm', { locale: es }) : '---'}
                    </td>
                    {(activeTab === 'global' || activeTab === 'asignados') && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {arresto.bomberoNombre || 'Bombero'}
                        </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            {arresto.tipo === 'INFRACCION' ? (
                            <>
                                <ArrowUpCircle size={16} className="text-red-500" />
                                <span className="text-sm font-medium text-red-600">Infracción</span>
                            </>
                            ) : (
                            <>
                                <ArrowDownCircle size={16} className="text-emerald-500" />
                                <span className="text-sm font-medium text-emerald-600">Pago</span>
                            </>
                            )}
                        </div>
                    </td>
                    <td className={cn("px-6 py-4 whitespace-nowrap text-sm font-medium", 
                        arresto.tipo === 'INFRACCION' ? 'text-red-600' : 'text-emerald-600'
                    )}>
                        {arresto.tipo === 'INFRACCION' ? `+${arresto.minutos || 0}` : `-${(arresto.minutos || 0) * (arresto.pagoDoble ? 2 : 1)}`} min
                        {arresto.pagoDoble && (
                            <span className="text-[10px] block opacity-80 font-normal">
                                (Doble: {arresto.minutos || 0} x 2)
                            </span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={arresto.tipo === 'INFRACCION' ? arresto.motivo || arresto.falta : arresto.observaciones}>
                        {arresto.tipo === 'INFRACCION' ? (arresto.motivo || arresto.falta) : arresto.observaciones}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(arresto.estado)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => { setSelectedArresto(arresto); setIsDetailsOpen(true); }}
                            className="text-slate-500 border-slate-200 hover:bg-slate-50"
                        >
                            Ver Detalles
                        </Button>



                        {/* Acción de Revisión (Supervisores en Tab Global) */}
                        {activeTab === 'global' && arresto.estado === 'PENDIENTE_VALIDACION' && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => { setSelectedArresto(arresto); setIsReviewOpen(true); }}
                                className="text-primary"
                            >
                                Validar
                            </Button>
                        )}

                        {/* Acciones de Edición/Eliminación (Solo en Asignados y si no está pagado) */}
                        {activeTab === 'asignados' && arresto.estado === 'PENDIENTE_PAGO' && (
                            <>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => { setSelectedArresto(arresto); setIsEditOpen(true); }}
                                    className="text-slate-500 hover:text-primary"
                                >
                                    <Edit2 size={16} />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleDelete(arresto.id!)}
                                    className="text-slate-500 hover:text-red-600"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </>
                        )}
                        

                    </td>
                </tr>
            ))}
            </tbody>
        </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header & Balance */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="text-primary" />
            Control de Horas y Arrestos
          </h1>
          <p className="text-slate-500">Gestión de penalizaciones y cumplimiento de horas extras.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {(isSupervisor || isAdmin) && (
            <>
                <Button 
                    variant="outline" 
                    onClick={() => setIsGeneralReportOpen(true)}
                    title="Reporte mensual consolidado"
                >
                    <FileText size={16} className="mr-2" />
                    Reporte General
                </Button>
                <Button 
                    variant="outline" 
                    onClick={() => setIsIndividualReportOpen(true)}
                    title="Reporte mensual de un bombero específico"
                >
                    <UserIcon size={16} className="mr-2" />
                    Reportes por Bombero
                </Button>
            </>
          )}

          <Button onClick={() => { setSelectedArresto(null); setFormType('INFRACCION'); setIsFormOpen(true); }} variant={(isSupervisor || isAdmin) ? "default" : "outline"}>
            <Plus size={20} className="mr-2" />
            Asignar Arresto
          </Button>
          
          <Button onClick={() => { setSelectedArresto(null); setFormType('PAGO'); setIsFormOpen(true); }}>
            <ArrowDownCircle size={20} className="mr-2" />
            Reportar Pago
          </Button>
        </div>
      </div>

      {/* Balance Card */}
      {!isAdmin && (
        <Card className="bg-primary/5 border-primary/10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Clock size={120} className="text-primary" />
          </div>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-col items-center justify-center min-w-[5rem] min-h-[5rem] shrink-0">
                <span className="text-3xl font-bold text-primary">{horasCompletas}h {minutosRestantes}m</span>
                <span className="text-xs text-slate-400">({balance} min)</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Tus Horas de Arresto Pendientes</h3>
                <p className="text-slate-600 max-w-md">
                  Minutos que debes cubrir para estar al día. 
                  Reporta tus actividades extras para que sean descontadas tras la validación.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de Listado */}
      <Tabs defaultValue="recibidos" onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid md:grid-cols-3 mb-4">
          <TabsTrigger value="recibidos" className="flex items-center gap-2">
            <ArrowDownCircle size={14} />
            Mis Arrestos (Recibidos)
          </TabsTrigger>
          <TabsTrigger value="asignados" className="flex items-center gap-2">
            <ArrowUpCircle size={14} />
            Arrestos Asignados
          </TabsTrigger>
          {(isSupervisor || isAdmin) && (
            <TabsTrigger value="global" className="flex items-center gap-2">
              <ListTodo size={14} />
              Gestión Global
            </TabsTrigger>
          )}
        </TabsList>

        <Card>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-500">
                        <RefreshCw className="mx-auto mb-4 animate-spin opacity-20" size={48} />
                        Cargando historial...
                    </div>
                ) : !historial || historial.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <History size={48} className="mx-auto mb-4 opacity-20" />
                        No hay registros en esta categoría.
                    </div>
                ) : (
                    <>
                        <div className={cn("transition-opacity duration-200", isPlaceholderData ? "opacity-50" : "opacity-100")}>
                            {renderTable([...historial].sort((a, b) => {
                                const timeA = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
                                const timeB = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
                                return timeB - timeA;
                            }))}
                        </div>
                        
                        {/* Controles de Paginación */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t">
                                <p className="text-sm text-slate-500">
                                    Página <span className="font-medium text-slate-900">{page}</span> de <span className="font-medium text-slate-900">{totalPages}</span>
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1 || isLoading}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages || isLoading}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
      </Tabs>

      {/* Modal: Formulario Registro */}
      <Dialog 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen}
        title={formType === 'INFRACCION' ? 'Asignar Arresto' : 'Reportar Pago de Horas'}
        description={formType === 'INFRACCION' ? 'Ingresa los detalles de la penalización.' : 'Cuéntanos qué actividad realizaste para cubrir tus horas.'}
      >
        <ArrestoForm 
            tipo={formType} 
            initialData={selectedArresto || undefined}
            onSuccess={() => { 
                setIsFormOpen(false); 
                queryClient.invalidateQueries({ queryKey: ['arrestos'] });
                queryClient.invalidateQueries({ queryKey: ['profile'] });
            }} 
            onCancel={() => setIsFormOpen(false)} 
        />
      </Dialog>

      {/* Modal: Editar Arresto */}
      <Dialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Editar Arresto Asignado"
        description="Puedes corregir los detalles, pero no puedes cambiar a qué bombero fue asignado."
      >
        {selectedArresto && (
            <ArrestoForm 
                tipo="INFRACCION"
                initialData={selectedArresto}
                onSuccess={() => { 
                    setIsEditOpen(false); 
                    queryClient.invalidateQueries({ queryKey: ['arrestos'] });
                }}
                onCancel={() => setIsEditOpen(false)} 
            />
        )}
      </Dialog>

      {/* Modal: Revisión de Pago */}
      <Dialog
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        title="Validación de Pago"
        description="Verifica si la actividad realizada justifica el descuento de horas."
      >
        {selectedArresto && (
            <div className="space-y-4 py-4">
                <div className="bg-slate-50 p-4 rounded-lg border space-y-2">
                    <p className="text-sm text-slate-500 uppercase font-bold">Detalles del reporte</p>
                    <p className="text-sm"><strong>Bombero:</strong> {selectedArresto.bomberoNombre}</p>
                    <p className="text-sm"><strong>Minutos reportados:</strong> {selectedArresto.minutos} min</p>
                    <p className="text-sm"><strong>¿Pago Doble?:</strong> {selectedArresto.pagoDoble ? 'Sí' : 'No'}</p>
                    <p className="text-sm"><strong>Observaciones:</strong> {selectedArresto.observaciones || 'N/A'}</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notas">Notas de Revisión (Opcional)</Label>
                    <textarea
                        id="notas"
                        className="w-full px-4 py-2 bg-white border rounded-md focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[80px]"
                        value={notasRevision}
                        onChange={(e) => setNotasRevision(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <Button 
                        variant="destructive" 
                        className="flex-1"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: selectedArresto.id!, estado: 'RECHAZADO', notas: notasRevision })}
                    >
                        Rechazar
                    </Button>
                    <Button 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: selectedArresto.id!, estado: 'PAGADO', notas: notasRevision })}
                    >
                        Validar Pago
                    </Button>
                </div>
            </div>
        )}
      </Dialog>

      {/* Modal: Detalles del Arresto */}
      <Dialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        title="Detalles del Registro"
        description="Información completa sobre esta infracción o pago."
      >
        {selectedArresto && (
            <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Tipo</p>
                        <p className="text-sm font-medium">{selectedArresto.tipo === 'INFRACCION' ? 'Infracción' : 'Pago'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Fecha del Suceso</p>
                        <p className="text-sm font-medium">{format(new Date(selectedArresto.fecha), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Bombero</p>
                        <p className="text-sm font-medium">{selectedArresto.bomberoNombre || 'No disponible'}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Minutos</p>
                        <p className={cn("text-sm font-bold", selectedArresto.tipo === 'INFRACCION' ? 'text-red-600' : 'text-emerald-600')}>
                            {selectedArresto.tipo === 'INFRACCION' ? '+' : '-'}{selectedArresto.minutos}{selectedArresto.pagoDoble ? ' (Doble)' : ''}
                        </p>
                    </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        {selectedArresto.tipo === 'INFRACCION' && (
                            <>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Falta</p>
                                    <p className="text-sm">{selectedArresto.falta || 'No especificada'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Turno</p>
                                    <p className="text-sm">{selectedArresto.turno || 'No especificado'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Sede</p>
                                    <p className="text-sm">{selectedArresto.sede || 'No especificada'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">¿Notificó?</p>
                                    <p className="text-sm">{selectedArresto.notifico ? 'Sí' : 'No'}</p>
                                </div>
                            </>
                        )}
                        {selectedArresto.tipo === 'PAGO' && (
                            <>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Sede del Pago</p>
                                    <p className="text-sm">{selectedArresto.sede || 'No especificada'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400">Turno del Pago</p>
                                    <p className="text-sm">{selectedArresto.turno || 'No especificado'}</p>
                                </div>
                            </>
                        )}
                    </div>
                    
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Motivo / Observaciones</p>
                        <p className="text-sm italic text-slate-600">
                            {selectedArresto.tipo === 'INFRACCION' ? selectedArresto.motivo : selectedArresto.observaciones || 'Sin observaciones'}
                        </p>
                    </div>
                </div>

                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex items-start gap-3">
                    <Info size={16} className="text-blue-500 mt-0.5" />
                    <div>
                        <p className="text-[10px] uppercase font-bold text-blue-400">Auditoría</p>
                        <p className="text-xs text-blue-700">
                            Registrado por <strong>{selectedArresto.registradoPorNombre || 'Sistema'}</strong> el {format(new Date(selectedArresto.fechaRegistro), "dd/MM/yyyy 'a las' HH:mm")}
                        </p>
                        {selectedArresto.revisadoPor && (
                             <p className="text-xs text-blue-700 mt-1">
                                Validado por un supervisor. {selectedArresto.notasRevision && `Notas: ${selectedArresto.notasRevision}`}
                             </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button onClick={() => setIsDetailsOpen(false)}>Cerrar</Button>
                </div>
            </div>
        )}
      </Dialog>

      {/* Modal: Selección de Bombero para Reporte Individual */}
      <Dialog
        open={isIndividualReportOpen}
        onOpenChange={setIsIndividualReportOpen}
        title="Generar Reporte Individual"
        description="Selecciona el bombero para generar su reporte mensual detallado."
      >
        <div className="space-y-4 pt-4">
            <Select 
                label="Bombero"
                value={selectedBomberoReport} 
                onChange={(e: any) => setSelectedBomberoReport(e.target.value)}
                options={[
                    { label: 'Seleccionar bombero...', value: '' },
                    ...(usuarios?.filter(u => u.rol === 'BOMBERO').map(u => ({ 
                        label: u.nombre, 
                        value: u.uid 
                    })) || [])
                ]}
            />
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsIndividualReportOpen(false)}>
                    Cancelar
                </Button>
                <Button variant="outline" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-100" onClick={handleDownloadIndividualExcel} disabled={!selectedBomberoReport}>
                    <FileSpreadsheet size={16} className="mr-2" /> Descargar Excel
                </Button>
                <Button onClick={handleDownloadIndividualReport} disabled={!selectedBomberoReport}>
                    <FileText size={16} className="mr-2" /> Descargar PDF
                </Button>
            </div>
        </div>
      </Dialog>

      {/* Modal: Opciones Reporte General */}
      <Dialog
        open={isGeneralReportOpen}
        onOpenChange={setIsGeneralReportOpen}
        title="Generar Reporte General"
        description="Selecciona el formato para el reporte consolidado de todos los bomberos este mes."
      >
        <div className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsGeneralReportOpen(false)}>
                    Cancelar
                </Button>
                <Button 
                    variant="outline" 
                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-100" 
                    onClick={() => { handleDownloadGeneralExcel(); setIsGeneralReportOpen(false); }}
                >
                    <FileSpreadsheet size={16} className="mr-2" /> Descargar Excel
                </Button>
                <Button onClick={() => { handleDownloadGeneralReport(); setIsGeneralReportOpen(false); }}>
                    <FileText size={16} className="mr-2" /> Descargar PDF
                </Button>
            </div>
        </div>
      </Dialog>
    </div>
  );
};

export default ArrestosPage;

