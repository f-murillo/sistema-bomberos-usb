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
  FileSpreadsheet,
  Search,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw
} from 'lucide-react';
import { generateArrestosReport, generateArrestosGeneralExcel, generateArrestosAnualExcel, generateArrestosAnualReport } from '@/lib/reports';
import type { BalanceAnualBombero, MesBalanceAnual } from '@/lib/reports';
import { format } from 'date-fns';
import { type Arresto, type Usuario, REGLAS_CONDICION, resolverReglasCondicion, type LimitesCondicion } from '@bomberos-usb/shared';
import ArrestoForm from '@/components/ArrestoForm';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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

  const [activeTab, setActiveTab] = useState<'recibidos' | 'asignados' | 'global' | 'balance' | 'anual' | 'limites'>(
    isCuentaAdministrativa ? 'global' : isSupervisor ? 'asignados' : 'recibidos'
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
  const [isAnualReportOpen, setIsAnualReportOpen] = useState(false);
  const [anualYear, setAnualYear] = useState(new Date().getFullYear());
  const [recibidosSubTab, setRecibidosSubTab] = useState<'infracciones' | 'pagos'>('infracciones');
  const [searchTerm, setSearchTerm] = useState('');

  // Resetear página al cambiar de pestaña o subpestaña
  useEffect(() => {
    setPage(1);
  }, [activeTab, recibidosSubTab]);

  // Obtener lista de usuarios para el reporte individual (limite alto: Balance y Balance Anual deben ver a TODOS)
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios-reporte'],
    queryFn: () => api.get<Usuario[]>('/usuarios?limite=1000'),
    enabled: !!userData?.uid
  });

  // Límites de minutos por condición (configurables; fallback a REGLAS_CONDICION)
  const { data: limitesData } = useQuery({
    queryKey: ['limites-condicion'],
    queryFn: () => api.get<{ limites: LimitesCondicion }>('/config/limites'),
    staleTime: 5 * 60 * 1000,
    enabled: !!userData?.uid
  });
  const limitesCondicion = limitesData?.limites;

  // ---- Estado de la pestaña "Límites" (editable solo por Inspector General / Cuenta Admin) ----
  const puedeEditarLimites = isSupervisor || isCuentaAdministrativa;
  const [limitesDraft, setLimitesDraft] = useState<Record<string, string> | null>(null);
  const [limitesMsg, setLimitesMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Valores vigentes por condición (configurados o por defecto). El borrador solo
  // existe mientras el usuario edita; si es null se derivan de estos valores.
  const limitesVigentes: Record<string, string> = {};
  (Object.keys(REGLAS_CONDICION) as (keyof typeof REGLAS_CONDICION)[]).forEach((c) => {
    limitesVigentes[c] = String(limitesCondicion?.[c]?.maxMinutosArresto ?? REGLAS_CONDICION[c].maxMinutosArresto);
  });
  const limitesVisibles = limitesDraft ?? limitesVigentes;

  const saveLimitesMutation = useMutation({
    mutationFn: (payload: Record<string, { maxMinutosArresto: number }>) =>
      api.put('/config/limites', { limites: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['limites-condicion'] });
      // Se limpia el borrador para que los inputs muestren los valores recién guardados
      setLimitesDraft(null);
      setLimitesMsg({ tipo: 'ok', texto: 'Límites guardados correctamente. Se aplicarán en Balance, Balance Anual y reportes.' });
    },
    onError: (error: Error) => {
      setLimitesMsg({ tipo: 'error', texto: error?.message || 'Error al guardar los límites.' });
    }
  });

  // 1. Obtener historial según el tab activo y página
  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['arrestos', activeTab, activeTab === 'recibidos' ? recibidosSubTab : null, page, searchTerm, userData?.uid],
    queryFn: () => {
      let url = `/arrestos?page=${page}&limit=${activeTab === 'balance' || activeTab === 'anual' ? 2000 : limit}`;
      if (activeTab === 'recibidos') {
        url += '&relacion=recibidos';
        if (recibidosSubTab === 'infracciones') {
          url += '&tipo=INFRACCION';
        } else {
          url += '&tipo=PAGO';
        }
      }
      if (activeTab === 'asignados') url += '&relacion=asignados';
      if (activeTab === 'global' || activeTab === 'balance' || activeTab === 'anual') {
        url += '&relacion=todo';
      }
      if (searchTerm && activeTab !== 'balance' && activeTab !== 'anual') {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      return api.get<{ items: Arresto[], totalItems: number, totalPages: number, currentPage: number }>(url);
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    enabled: !!userData?.uid && activeTab !== 'anual' && activeTab !== 'limites'
  });

  const historial = data?.items || [];
  const filteredHistorial = (activeTab !== 'balance' && activeTab !== 'anual' && searchTerm)
    ? historial.filter(a => {
        const term = searchTerm.toLowerCase();
        return (
          (a.bomberoNombre && a.bomberoNombre.toLowerCase().includes(term)) ||
          (a.motivo && a.motivo.toLowerCase().includes(term)) ||
          (a.falta && a.falta.toLowerCase().includes(term))
        );
      })
    : historial;
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
  const userReglas = resolverReglasCondicion(userCondicion, limitesCondicion);
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
        
        // Ordenar cronológicamente para no acumular saldo negativo
        userArrestos.sort((a, b) => new Date(a.fechaRegistro).getTime() - new Date(b.fechaRegistro).getTime());
        
        userArrestos.forEach(a => {
          const mins = Number(a.minutos || 0);
          if (a.tipo === 'INFRACCION') {
            calculatedBalance += mins;
          } else if (a.tipo === 'PAGO' && a.estado === 'PAGADO') {
            calculatedBalance = Math.max(0, calculatedBalance - (mins * (a.pagoDoble ? 2 : 1)));
          }
        });

        const uCondicion = u.condicion || 'REGULAR';
        const uReglas = resolverReglasCondicion(uCondicion, limitesCondicion);
        const uExcedido = calculatedBalance >= uReglas.maxMinutosArresto;

        return {
          num: index + 1,
          uid: u.uid,
          nombre: u.nombre,
          rango: u.rango || 'N/A',
          condicion: uCondicion,
          balance: calculatedBalance,
          limite: uReglas.maxMinutosArresto,
          excedido: uExcedido
        };
      });
  };

  const balancesData = calculateBalances();

  // Obtener historial completo para la pestaña anual (sin paginación)
  const { data: anualData, isLoading: anualLoading } = useQuery({
    queryKey: ['arrestos-anual', anualYear],
    queryFn: () => api.get<{ items: Arresto[], totalItems: number, totalPages: number, currentPage: number }>(`/arrestos?relacion=todo&limit=5000`),
    staleTime: 5 * 60 * 1000,
    enabled: !!userData?.uid && activeTab === 'anual'
  });

  const calculateAnnualBalances = (): BalanceAnualBombero[] => {
    if (!usuarios || !anualData?.items) return [];

    const allArrestos = anualData.items;

    return usuarios
      .filter(u => u.rol === 'BOMBERO')
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((u, index) => {
        const uCondicion = u.condicion || 'REGULAR';
        const uReglas = resolverReglasCondicion(uCondicion, limitesCondicion);
        const userArrestos = allArrestos.filter(a => a.bomberoId === u.uid);

        const meses: MesBalanceAnual[] = Array.from({ length: 12 }, (_, monthIdx) => {
          // Calcular balance acumulado hasta el último segundo del mes monthIdx del año seleccionado
          const limitDate = new Date(anualYear, monthIdx + 1, 0, 23, 59, 59);
          let balance = 0;
          
          const validArrestos = userArrestos.filter(a => new Date(a.fechaRegistro) <= limitDate);
          validArrestos.sort((a, b) => new Date(a.fechaRegistro).getTime() - new Date(b.fechaRegistro).getTime());
          
          validArrestos.forEach(a => {
            const mins = Number(a.minutos || 0);
            if (a.tipo === 'INFRACCION') balance += mins;
            else if (a.tipo === 'PAGO' && a.estado === 'PAGADO') balance = Math.max(0, balance - (mins * (a.pagoDoble ? 2 : 1)));
          });
          return {
            estado: balance >= uReglas.maxMinutosArresto ? 'EXCEDIDO' as const : 'NORMAL' as const,
            minutos: balance
          };
        });

        return {
          num: index + 1,
          uid: u.uid ?? '',
          nombre: u.nombre,
          rango: u.rango || 'N/A',
          condicion: uCondicion,
          meses
        };
      });
  };

  const anualBalances = activeTab === 'anual' ? calculateAnnualBalances() : [];

  const filteredBalancesData = balancesData.filter(b => b.nombre.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredAnualBalances = anualBalances.filter(b => b.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleDownloadGeneralReport = async () => {
    try {
      // Buscamos TODOS los arrestos del mes para el reporte (limit=1000)
      const res = await api.get<{ items: Arresto[] }>(`/arrestos?relacion=todo&limit=1000`);

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
      await generateArrestosGeneralExcel(usuarios, limitesCondicion);
      setIsGeneralReportOpen(false);
    } catch (error) {
      alert('Error al generar el reporte Excel');
    }
  };

  // Guardar límites editados (validación local antes de enviar)
  const handleGuardarLimites = () => {
    const payload: Record<string, { maxMinutosArresto: number }> = {};
    for (const [cond, valor] of Object.entries(limitesVisibles)) {
      const num = Number(valor);
      if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
        setLimitesMsg({ tipo: 'error', texto: `El límite de ${cond} debe ser un número entero mayor a 0.` });
        return;
      }
      payload[cond] = { maxMinutosArresto: num };
    }

    setLimitesMsg(null);
    saveLimitesMutation.mutate(payload);
  };

  // Restaurar los valores por defecto del código (sin guardar hasta pulsar "Guardar")
  const handleRestaurarLimites = () => {
    const draft: Record<string, string> = {};
    (Object.keys(REGLAS_CONDICION) as (keyof typeof REGLAS_CONDICION)[]).forEach((c) => {
      draft[c] = String(REGLAS_CONDICION[c].maxMinutosArresto);
    });
    setLimitesDraft(draft);
    setLimitesMsg({ tipo: 'ok', texto: 'Valores por defecto cargados en el formulario. Pulsa "Guardar Cambios" para aplicarlos.' });
  };



  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Pagado</Badge>;
      case 'RECHAZADO':
        return <Badge variant="destructive">Rechazado</Badge>;
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

  // Los hooks siempre se ejecutan en el mismo orden: el guard de ADMIN va después de todos ellos
  if (isAdmin) return null;

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
          <Button onClick={() => { setSelectedArresto(null); setFormType('INFRACCION'); setIsFormOpen(true); }} variant="default">
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
      <Tabs defaultValue={isCuentaAdministrativa ? "global" : isAdmin || isSupervisor ? "asignados" : "recibidos"} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full mb-4 grid-cols-2 md:w-auto md:inline-grid md:grid-cols-5">
          {(!isCuentaAdministrativa && !isAdmin && !isSupervisor) && (
            <TabsTrigger value="recibidos" className="flex items-center gap-2">
              <ArrowDownCircle size={14} />
              Mis Arrestos
            </TabsTrigger>
          )}
          <TabsTrigger value="asignados" className="flex items-center gap-2">
            <ArrowUpCircle size={14} />
            Asignados
          </TabsTrigger>
          <TabsTrigger value="global" className="flex items-center gap-2">
              <ListTodo size={14} />
              Gestión Global
          </TabsTrigger>
          <TabsTrigger value="balance" className="flex items-center gap-2">
            <FileSpreadsheet size={14} />
            Balance
          </TabsTrigger>
          <TabsTrigger value="anual" className="flex items-center gap-2">
            <FileText size={14} />
            Balance Anual
          </TabsTrigger>
          {puedeEditarLimites && (
            <TabsTrigger value="limites" className="flex items-center gap-2">
              <Settings size={14} />
              Límites
            </TabsTrigger>
          )}
        </TabsList>

        {/* Filtros y Buscador General */}
        {activeTab !== 'limites' && (
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Buscar por nombre, motivo o falta..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['arrestos'] })} className="flex justify-center gap-2">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            Actualizar
          </Button>
        </div>
        )}

        {(activeTab === 'balance' || activeTab === 'anual') && (
          <div className="flex flex-col md:flex-row gap-4 mb-4 items-end bg-white p-4 rounded-lg border shadow-sm">
            <div className="w-full md:w-48">
              <Label className="text-xs mb-1 block">Año</Label>
              <select
                value={activeTab === 'anual' ? anualYear : selectedYear}
                onChange={(e) => activeTab === 'anual' ? setAnualYear(Number(e.target.value)) : setSelectedYear(Number(e.target.value))}
                className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {activeTab === 'balance' && (
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
            )}
            <div className="flex-1 text-right text-xs text-slate-500 italic pb-2 flex items-center justify-end gap-4">
              {activeTab === 'balance' && (
                <span>Balance acumulado hasta finales de {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][selectedMonth]} {selectedYear}.</span>
              )}
              {activeTab === 'anual' && (
                <span>Estado mensual (NORMAL / EXCEDIDO) de cada bombero durante {anualYear}.</span>
              )}
              {activeTab === 'balance' && (isAdmin || isSupervisor || isCuentaAdministrativa) && (
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
              {activeTab === 'anual' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAnualReportOpen(true)}
                  className="bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary text-base"
                >
                  <FileSpreadsheet size={16} className="mr-2" />
                  Descargar Balance Anual
                </Button>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading && activeTab !== 'anual' ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw className="mx-auto mb-4 animate-spin opacity-20" size={48} />
                Cargando información...
              </div>
            ) : activeTab === 'anual' ? (
              anualLoading ? (
                <div className="p-12 text-center text-slate-500">
                  <RefreshCw className="mx-auto mb-4 animate-spin opacity-20" size={48} />
                  Calculando balance anual...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50/50">
                        <th className="px-3 py-3 text-center font-semibold text-slate-700 w-10">Nº</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-700">Personal</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-700">Jerarquía</th>
                        <th className="px-3 py-3 text-left font-semibold text-slate-700">Condición</th>
                        {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map(m => (
                          <th key={m} className="px-2 py-3 text-center font-semibold text-slate-700 text-xs">{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredAnualBalances.length === 0 ? (
                        <tr>
                          <td colSpan={16} className="px-4 py-12 text-center text-slate-500">
                            No se encontraron bomberos.
                          </td>
                        </tr>
                      ) : (
                        filteredAnualBalances.map((b) => (
                          <tr key={b.uid} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2 text-center font-medium text-slate-500 text-xs">{b.num}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900 text-xs whitespace-nowrap">{b.nombre}</td>
                            <td className="px-3 py-2 text-slate-600 text-xs">{b.rango}</td>
                            <td className="px-3 py-2 text-xs">
                              <Badge variant="outline" className="font-normal text-[10px]">{b.condicion}</Badge>
                            </td>
                            {b.meses.map((mes, idx) => (
                              <td key={idx} className="px-1 py-2 text-center">
                                {mes.estado === 'EXCEDIDO' ? (
                                  <span className="inline-block text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700 whitespace-nowrap" title={`${mes.minutos.toLocaleString('es-VE')} min pendientes`}>EXC {mes.minutos.toLocaleString('es-VE')}</span>
                                ) : (
                                  <span className="inline-block text-[9px] font-medium px-1 py-0.5 rounded bg-green-100 text-green-700 whitespace-nowrap" title={`${mes.minutos.toLocaleString('es-VE')} min pendientes`}>OK {mes.minutos.toLocaleString('es-VE')}</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeTab === 'limites' ? (
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-3 bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                  <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-700">
                    <p className="font-semibold uppercase tracking-wider mb-1">Límites de minutos por condición</p>
                    <p>
                      Define cuántos minutos de arresto acumulados puede tener un bombero antes de marcarse como <strong>EXCEDIDO</strong>.
                      Los valores por defecto son los del sistema; al guardar, se aplican de inmediato en la tarjeta personal,
                      en <em>Balance</em>, en <em>Balance Anual</em> y en los reportes Excel/PDF.
                    </p>
                  </div>
                </div>

                {!puedeEditarLimites ? (
                  <div className="p-6 text-center text-slate-500">
                    No tienes permisos para modificar los límites.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-slate-50/50">
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Condición</th>
                            <th className="px-4 py-3 text-center font-semibold text-slate-700">Límite actual</th>
                            <th className="px-4 py-3 text-center font-semibold text-slate-700">Valor por defecto</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Nuevo límite (minutos)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(Object.keys(REGLAS_CONDICION) as (keyof typeof REGLAS_CONDICION)[]).map((cond) => {
                            const actual = limitesCondicion?.[cond]?.maxMinutosArresto ?? REGLAS_CONDICION[cond].maxMinutosArresto;
                            const porDefecto = REGLAS_CONDICION[cond].maxMinutosArresto;
                            const editado = limitesVisibles[cond] !== String(actual);
                            return (
                              <tr key={cond} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className="font-normal">{cond}</Badge>
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-slate-700">
                                  {actual.toLocaleString('es-VE')} min
                                </td>
                                <td className="px-4 py-3 text-center text-slate-400">
                                  {porDefecto.toLocaleString('es-VE')} min
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 max-w-xs">
                                    <Input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={limitesVisibles[cond] ?? ''}
                                      onChange={(e) => {
                                        setLimitesMsg(null);
                                        setLimitesDraft({ ...limitesVisibles, [cond]: e.target.value });
                                      }}
                                      className={cn(editado && 'border-primary ring-1 ring-primary/30')}
                                    />
                                    {editado && <span className="text-[10px] font-medium text-primary whitespace-nowrap">sin guardar</span>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {limitesMsg && (
                      <div className={cn(
                        "flex items-center gap-2 text-sm rounded-lg border p-3",
                        limitesMsg.tipo === 'ok'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border-red-200 text-red-700'
                      )}>
                        {limitesMsg.tipo === 'ok'
                          ? <CheckCircle2 size={16} className="shrink-0" />
                          : <AlertTriangle size={16} className="shrink-0" />}
                        {limitesMsg.texto}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 border-t">
                      <Button variant="outline" onClick={handleRestaurarLimites} className="flex items-center gap-2">
                        <RotateCcw size={16} />
                        Restaurar valores por defecto
                      </Button>
                      <Button
                        onClick={handleGuardarLimites}
                        disabled={saveLimitesMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <Save size={16} />
                        {saveLimitesMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                      </Button>
                    </div>
                  </>
                )}
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
                    {filteredBalancesData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                          No se encontraron bomberos.
                        </td>
                      </tr>
                    ) : (
                      filteredBalancesData.map((b) => (
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
                      {filteredHistorial.length === 0 ? (
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
                        filteredHistorial.map((arresto) => (
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
        title={selectedArresto?.tipo === 'INFRACCION' ? "Editar Arresto Asignado" : "Editar Pago Reportado"}
        description="Puedes corregir los detalles, pero no puedes cambiar a qué bombero fue asignado."
      >
        {selectedArresto && (
          <ArrestoForm
            tipo={selectedArresto.tipo} initialData={selectedArresto}
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
      {/* Modal: Opciones Reporte Anual */}
      <Dialog
        open={isAnualReportOpen}
        onOpenChange={setIsAnualReportOpen}
        title="Descargar Balance Anual"
        description={`Selecciona el formato para el balance anual de arrestos del personal durante ${anualYear}.`}
      >
        <div className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAnualReportOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-100"
              onClick={async () => {
                await generateArrestosAnualExcel(anualBalances, anualYear);
                setIsAnualReportOpen(false);
              }}
            >
              <FileSpreadsheet size={16} className="mr-2" /> Descargar Excel
            </Button>
            <Button onClick={() => {
              generateArrestosAnualReport(anualBalances, anualYear);
              setIsAnualReportOpen(false);
            }}>
              <FileText size={16} className="mr-2" /> Descargar PDF
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default ArrestosPage;
