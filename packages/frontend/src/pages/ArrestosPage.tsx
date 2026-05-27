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
  Plus, 
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit2, 
  Trash2, 
  ListTodo, 
  Info, 
  FileText, 
  Clock, 
  FileSpreadsheet
} from 'lucide-react';
import { generateArrestosReport, generateArrestosGeneralExcel } from '@/lib/reports';
import { format } from 'date-fns';
import { type Arresto, type Usuario, REGLAS_CONDICION } from '@bomberos-usb/shared';
import ArrestoForm from '@/components/ArrestoForm';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ArrestosPage = () => {
  const { userData, isSupervisor, isAdmin, isCuentaAdministrativa } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);
  
  if (isAdmin) return null;
  const [activeTab, setActiveTab] = useState<'recibidos' | 'asignados' | 'global' | 'balance'>(
    isCuentaAdministrativa ? 'balance' : isSupervisor ? 'asignados' : 'recibidos'
  );
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [page, setPage] = useState(1);
  const limit = 10;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState<'INFRACCION' | 'PAGO'>('PAGO');
  const [selectedArresto, setSelectedArresto] = useState<Arresto | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isGeneralReportOpen, setIsGeneralReportOpen] = useState(false);
  const [recibidosSubTab, setRecibidosSubTab] = useState<'infracciones' | 'pagos'>('infracciones');

  // Resetear página al cambiar de pestaña o subpestaña
  useEffect(() => {
    setPage(1);
  }, [activeTab, recibidosSubTab]);

  // Obtener lista de usuarios para el reporte individual
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-reporte'],
    queryFn: () => api.get<any[]>('/usuarios'),
    enabled: !!userData?.uid
  });

  // 1. Obtener historial según el tab activo y página
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['arrestos', activeTab, activeTab === 'recibidos' ? recibidosSubTab : null, page, userData?.uid],
    queryFn: () => {
        let url = `/arrestos?page=${page}&limit=${activeTab === 'balance' ? 2000 : limit}`;
        if (activeTab === 'recibidos') {
            url += '&relacion=recibidos';
            if (recibidosSubTab === 'infracciones') {
                url += '&tipo=INFRACCION';
            } else {
                url += '&tipo=PAGO';
            }
        }
        if (activeTab === 'asignados') url += '&relacion=asignados';
        if (activeTab === 'global' || activeTab === 'balance') {
            url += '&relacion=todo';
        }
        return api.get<{ items: Arresto[], totalItems: number, totalPages: number, currentPage: number }>(url);
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de caché fresca
    placeholderData: (prev) => prev,
    enabled: !!userData?.uid
  });

  const historial = data?.items || [];
  const totalPages = data?.totalPages || 1;

  // 2. Obtener datos actualizados del usuario (para el balance)
  const { data: userProfile } = useQuery({
    queryKey: ['profile', userData?.uid],
    queryFn: () => api.get<Usuario>(`/usuarios/${userData?.uid}`),
    enabled: !!userData?.uid
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
  const userCondicion = userProfile?.condicion || 'REGULAR';
  const userReglas = REGLAS_CONDICION[userCondicion as keyof typeof REGLAS_CONDICION] || REGLAS_CONDICION['REGULAR'];
  const isExcedido = balance >= userReglas.maxMinutosArresto;

  // Lógica para calcular balance histórico por usuario hasta el mes seleccionado
  const calculateBalances = () => {
    if (!usuarios || !historial) return [];

    // Fecha límite: último segundo del mes seleccionado
    const limitDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

    // Filtrar arrestos hasta esa fecha
    const relevantArrestos = historial.filter(a => {
        const fecha = new Date(a.fechaRegistro);
        return fecha <= limitDate;
    });

    return usuarios
      .filter(u => u.rol === 'BOMBERO')
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((u, index) => {
        const userArrestos = relevantArrestos.filter(a => a.bomberoId === u.uid);
        
        let calculatedBalance = 0;
        userArrestos.forEach(a => {
            const mins = Number(a.minutos || 0);
            if (a.tipo === 'INFRACCION') {
                calculatedBalance += mins;
            } else if (a.tipo === 'PAGO' && a.estado === 'PAGADO') {
                calculatedBalance -= (mins * (a.pagoDoble ? 2 : 1));
            }
        });

        const uCondicion = u.condicion || 'REGULAR';
        const uReglas = REGLAS_CONDICION[uCondicion as keyof typeof REGLAS_CONDICION] || REGLAS_CONDICION['REGULAR'];
        const uExcedido = calculatedBalance >= uReglas.maxMinutosArresto;

        return {
            num: index + 1,
            uid: u.uid,
            nombre: u.nombre,
            rango: u.rango || 'N/A',
            condicion: uCondicion,
            balance: Math.max(0, calculatedBalance),
            limite: uReglas.maxMinutosArresto,
            excedido: uExcedido
        };
      });
  };

  const balancesData = calculateBalances();

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
        if (!usuarios) {
            alert('Cargando datos de usuarios, por favor intenta de nuevo en un momento.');
            return;
        }
        await generateArrestosGeneralExcel(usuarios);
        setIsGeneralReportOpen(false);
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
          {!isCuentaAdministrativa && (
            <Button onClick={() => { setSelectedArresto(null); setFormType('INFRACCION'); setIsFormOpen(true); }} variant="default">
              <Plus size={20} className="mr-2" />
              Asignar Arresto
            </Button>
          )}
          
          {!isSupervisor && !isCuentaAdministrativa && (
            <Button onClick={() => { setSelectedArresto(null); setFormType('PAGO'); setIsFormOpen(true); }}>
              <ArrowDownCircle size={20} className="mr-2" />
              Reportar Pago
            </Button>
          )}
        </div>
      </div>

      {/* Balance Card */}
      {!isAdmin && !isSupervisor && !isCuentaAdministrativa && (
        <Card className={cn(
            "overflow-hidden relative border",
            isExcedido ? "bg-red-50 border-red-200" : "bg-primary/5 border-primary/10"
        )}>
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Clock size={120} className={isExcedido ? "text-red-500" : "text-primary"} />
          </div>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className={cn(
                  "p-4 rounded-xl shadow-sm border flex flex-col items-center justify-center min-w-[5rem] min-h-[5rem] shrink-0 bg-white",
                  isExcedido ? "border-red-200" : ""
              )}>
                <span className={cn("text-3xl font-bold", isExcedido ? "text-red-600" : "text-primary")}>
                    {horasCompletas}h {minutosRestantes}m
                </span>
                <span className={cn("text-xs", isExcedido ? "text-red-400" : "text-slate-400")}>({balance} min)</span>
              </div>
              <div>
                <h3 className={cn("text-lg font-bold", isExcedido ? "text-red-800" : "text-slate-800")}>
                    Tus Horas de Arresto Pendientes
                </h3>
                <p className={cn("max-w-md mt-1", isExcedido ? "text-red-600/80 font-medium" : "text-slate-600")}>
                  {isExcedido 
                    ? `¡ALERTA! Has superado el límite máximo de ${userReglas.maxMinutosArresto} minutos para tu condición (${userCondicion}).` 
                    : `Minutos que debes cubrir para estar al día. Tu límite máximo es de ${userReglas.maxMinutosArresto} minutos (${userCondicion}).`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs de Listado */}
      <Tabs defaultValue={isCuentaAdministrativa ? "balance" : isAdmin || isSupervisor ? "asignados" : "recibidos"} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className={cn(
          "grid w-full mb-4",
          isCuentaAdministrativa
            ? "grid-cols-1 md:w-auto md:inline-grid md:grid-cols-1"
            : isAdmin || isSupervisor 
            ? "grid-cols-3 md:w-auto md:inline-grid md:grid-cols-3" 
            : "grid-cols-2 md:w-auto md:inline-grid md:grid-cols-4"
        )}>
          {!isAdmin && !isSupervisor && !isCuentaAdministrativa && (
            <TabsTrigger value="recibidos" className="flex items-center gap-2">
              <ArrowDownCircle size={14} />
              Mis Arrestos
            </TabsTrigger>
          )}
          {!isCuentaAdministrativa && (
            <TabsTrigger value="asignados" className="flex items-center gap-2">
              <ArrowUpCircle size={14} />
              Asignados
            </TabsTrigger>
          )}
          {!isCuentaAdministrativa && (
            <TabsTrigger value="global" className="flex items-center gap-2">
              <ListTodo size={14} />
              Gestión Global
            </TabsTrigger>
          )}
          <TabsTrigger value="balance" className="flex items-center gap-2">
            <FileSpreadsheet size={14} />
            Balance
          </TabsTrigger>
        </TabsList>

        {activeTab === 'balance' && (
          <div className="flex flex-col md:flex-row gap-4 mb-4 items-end bg-white p-4 rounded-lg border shadow-sm">
            <div className="w-full md:w-48">
              <Label className="text-xs mb-1 block">Año</Label>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-48">
              <Label className="text-xs mb-1 block">Mes</Label>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 text-right text-xs text-slate-500 italic pb-2 flex items-center justify-end gap-4">
              <span>Balance acumulado hasta finales de {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][selectedMonth]} {selectedYear}.</span>
              {(isAdmin || isSupervisor || isCuentaAdministrativa) && (
                <Button 
                    size="sm"
                    variant="outline" 
                    onClick={() => setIsGeneralReportOpen(true)}
                    className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary text-base"
                >
                    <FileSpreadsheet size={16} className="mr-2" />
                    Descargar Balance
                </Button>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="mx-auto mb-4 animate-spin opacity-20" size={48} />
                Cargando información...
              </div>
            ) : activeTab === 'balance' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50/50">
                      <th className="px-4 py-3 text-center font-semibold text-slate-700 w-12">Nº</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Personal</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Jerarquía</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Condición</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">Minutos</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">Límite</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {balancesData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          No se encontraron bomberos.
                        </td>
                      </tr>
                    ) : (
                      balancesData.map((b) => (
                        <tr key={b.uid} className={cn(
                          "hover:bg-slate-50/50 transition-colors",
                          b.excedido ? "bg-red-50/30" : ""
                        )}>
                          <td className="px-4 py-3 text-center font-medium text-slate-500">{b.num}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{b.nombre}</td>
                          <td className="px-4 py-3 text-slate-600">{b.rango}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <Badge variant="outline" className="font-normal">{b.condicion}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "font-bold px-2 py-1 rounded",
                              b.excedido ? "text-red-700 bg-red-100" : "text-slate-700"
                            )}>
                              {b.balance} min
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">{b.limite}</td>
                          <td className="px-4 py-3 text-center">
                            {b.excedido ? (
                              <Badge className="bg-red-100 text-red-700 border-red-200">EXCEDIDO</Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 border-green-200">NORMAL</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                {activeTab === 'recibidos' && (
                  <div className="px-4 py-3 border-b bg-slate-50/50 flex items-center justify-between">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button 
                        onClick={() => setRecibidosSubTab('infracciones')}
                        className={cn(
                          "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                          recibidosSubTab === 'infracciones' 
                            ? "bg-white text-slate-900 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Infracciones
                      </button>
                      <button 
                        onClick={() => setRecibidosSubTab('pagos')}
                        className={cn(
                          "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                          recibidosSubTab === 'pagos' 
                            ? "bg-white text-slate-900 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Pagos Realizados
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      {recibidosSubTab === 'infracciones' ? 'Arrestos por cumplir' : 'Historial de pagos'}
                    </div>
                  </div>
                )}


                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/50">
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha</th>
                        {(activeTab === 'global' || activeTab === 'asignados') && <th className="px-4 py-3 text-left font-semibold text-slate-700">Bombero</th>}
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Tipo</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Minutos</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Motivo</th>
                        {(activeTab === 'global' || (activeTab === 'recibidos' && recibidosSubTab === 'pagos')) && (
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">Estado</th>
                        )}
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {historial.length === 0 ? (
                        <tr>
                          <td 
                            colSpan={
                              5 + 
                              (activeTab === 'global' || activeTab === 'asignados' ? 1 : 0) + 
                              (activeTab === 'global' || (activeTab === 'recibidos' && recibidosSubTab === 'pagos') ? 1 : 0)
                            } 
                            className="px-4 py-12 text-center text-slate-500"
                          >
                            {activeTab === 'recibidos' && recibidosSubTab === 'pagos'
                              ? 'Aún no has reportado ningún pago.'
                              : activeTab === 'recibidos' && recibidosSubTab === 'infracciones'
                              ? 'No tienes infracciones registradas. ¡Buen trabajo!'
                              : 'No hay registros en esta categoría.'}
                          </td>
                        </tr>
                      ) : (
                        historial.map((arresto) => (
                          <tr key={arresto.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">
                                {format(new Date(arresto.fechaRegistro), 'dd/MM/yyyy HH:mm')}
                              </div>
                              <div className="text-[10px] text-slate-400 italic">
                                Suceso: {format(new Date(arresto.fecha), 'dd/MM/yyyy')}
                              </div>
                            </td>
                            {(activeTab === 'global' || activeTab === 'asignados') && (
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {arresto.bomberoNombre || 'Bombero'}
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <div className={cn(
                                "flex items-center gap-1 text-xs font-medium",
                                arresto.tipo === 'INFRACCION' ? "text-red-600" : "text-green-600"
                              )}>
                                {arresto.tipo === 'INFRACCION' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                                {arresto.tipo === 'INFRACCION' ? 'Infracción' : 'Pago'}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn(
                                "font-bold",
                                arresto.tipo === 'INFRACCION' ? "text-red-700" : "text-green-700"
                              )}>
                                {arresto.tipo === 'INFRACCION' ? '+' : '-'}{arresto.pagoDoble ? arresto.minutos * 2 : arresto.minutos} min
                              </span>
                            </td>
                            <td className="px-4 py-3 truncate text-slate-600" title={arresto.falta || arresto.motivo}>
                              {arresto.falta || arresto.motivo || 'N/A'}
                            </td>
                            {(activeTab === 'global' || (activeTab === 'recibidos' && recibidosSubTab === 'pagos')) && (
                              <td className="px-4 py-3">
                                {arresto.tipo === 'INFRACCION' ? (
                                  <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">N/A</span>
                                ) : (
                                  getStatusBadge(arresto.estado)
                                )}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => { setSelectedArresto(arresto); setIsDetailsOpen(true); }}
                                >
                                  Detalles
                                </Button>

                                {(() => {
                                  const createdAt = new Date(arresto.fechaRegistro);
                                  const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
                                  const isOwner = arresto.registradoPor === userData?.uid;
                                  const canEdit = isSupervisor || isAdmin || (isOwner && hoursSinceCreation <= 48);
                                  
                                  return canEdit && (
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
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
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
                        disabled={page === 1 || isPlaceholderData}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= totalPages || isPlaceholderData}
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

      {/* Modal: Opciones Reporte General */}
      <Dialog
        open={isGeneralReportOpen}
        onOpenChange={setIsGeneralReportOpen}
        title="Descargar Balance General"
        description="Selecciona el formato para el balance de arrestos del personal durante este mes."
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

