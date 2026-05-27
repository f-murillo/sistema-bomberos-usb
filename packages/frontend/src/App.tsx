import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './context/AuthContext'
import { format } from 'date-fns'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SolicitarResetPasswordPage from './pages/SolicitarResetPasswordPage'
import UsuariosPage from './pages/UsuariosPage'
import GuardiasPage from './pages/GuardiasPage'
import AuditoriaPage from './pages/AuditoriaPage'
import ArrestosPage from './pages/ArrestosPage'
import MainLayout from './components/layout/MainLayout'
import { useQuery } from '@tanstack/react-query'
import { api } from './lib/api'
import { useNavigate } from 'react-router-dom'
import { Button } from './components/ui/button'
import { ArrowRight, Calendar, AlertCircle, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

// Configuración de TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Un componente para el Inicio / Dashboard
const Dashboard = () => {
  const { userData, isAdmin, isSupervisor, isCuentaAdministrativa } = useAuth();
  const navigate = useNavigate();

  // Obtenemos las guardias para mostrar información dinámica
  const { data: guardiasData, isLoading } = useQuery({
    queryKey: ['guardias'],
    queryFn: () => api.get<any[]>('/guardias'),
    refetchInterval: 30000, // Refrescar cada 30 segundos automáticamente
    staleTime: 5 * 60 * 1000, // Los datos se consideran "frescos" por 5 min para evitar recargas al navegar
  });

  // Obtenemos el perfil actualizado para tener los minutos de arresto siempre al día
  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile', userData?.uid],
    queryFn: () => api.get<any>(`/usuarios/${userData?.uid}`),
    enabled: !!userData?.uid,
    refetchInterval: 30000,
  });

  const guardias = guardiasData || [];

  const balanceArresto = userProfile?.minutosArresto || userData?.minutosArresto || 0;
  const horasCompletas = Math.floor(balanceArresto / 60);
  const minutosRestantes = balanceArresto % 60;

  // Filtramos las guardias por estado usando los estados correctos del schema
  const guardiasPendientes = guardias.filter((g: any) => g.estado === 'PENDIENTE');

  // Filtros específicos para el bombero logueado
  const misPendientes = guardiasPendientes.filter((g: any) => g.bomberoId === userData?.uid);

  // Función para ordenar por fecha más cercana
  const ordenarPorFecha = (arr: any[]) => [...arr].sort((a, b) => {
    const dateA = a.fecha?.toDate ? a.fecha.toDate() : new Date(a.fecha);
    const dateB = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
    return dateA.getTime() - dateB.getTime();
  });

  const miProxima = ordenarPorFecha(misPendientes)[0];
  const proximaGlobal = ordenarPorFecha(guardiasPendientes)[0];

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">Bienvenido al Panel de Control</h1>
      <p className="text-slate-600">Gestión dinámica de guardias y estado del sistema.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        
        {/* VISTA PARA BOMBEROS: Su estado personal */}
        {!isAdmin && !isSupervisor && !isCuentaAdministrativa && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between min-h-[160px]">
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Calendar className="text-primary" size={20} />
                Mi Estado
              </h3>
              {isLoading ? <SkeletonLoader /> : (
                <>
                  {miProxima ? (
                    <div>
                      <p className="text-xl font-bold text-slate-900">Tienes una guardia próxima pendiente</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Programada para el {format(miProxima.fecha?.toDate ? miProxima.fecha.toDate() : new Date(miProxima.fecha), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-primary">No tienes guardias programadas</p>
                  )}
                </>
              )}
            </div>
            {!isLoading && (
              <Button variant="link" className="p-0 h-auto mt-4 text-primary font-bold flex items-center gap-1 w-fit hover:no-underline" onClick={() => navigate('/guardias')}>
                Ir a mis guardias <ArrowRight size={16} />
              </Button>
            )}
          </div>
        )}

        {!isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between min-h-[160px]">
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <ShieldAlert className={isSupervisor || isCuentaAdministrativa ? "text-primary" : "text-amber-500"} size={20} />
                {isSupervisor || isCuentaAdministrativa ? "Gestión de Arrestos" : "Horas de Arresto"}
              </h3>
              {isSupervisor || isCuentaAdministrativa ? (
                <>
                  <p className="text-2xl font-bold text-slate-900">Panel de Control</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Supervisión de infracciones y balances del personal.
                  </p>
                </>
              ) : (
                isProfileLoading && !userProfile ? <SkeletonLoader /> : (
                  <>
                    <p className="text-2xl font-bold text-slate-900">
                      {horasCompletas > 0 ? `${horasCompletas}h ` : ''}{minutosRestantes}m
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Equivalente a {balanceArresto} minutos totales.
                    </p>
                  </>
                )
              )}
            </div>
            <Button 
              variant="link" 
              className={cn(
                "p-0 h-auto mt-4 font-bold flex items-center gap-1 w-fit hover:no-underline",
                isSupervisor || isCuentaAdministrativa ? "text-primary" : "text-amber-600"
              )} 
              onClick={() => navigate('/arrestos')}
            >
              {isSupervisor || isCuentaAdministrativa ? "Ir a Gestión Global" : "Ver mi historial"} <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {/* VISTA PARA SUPERVISORES: Guardias Pendientes */}
        {isSupervisor && !isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between min-h-[160px]">
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Calendar className="text-primary" size={20} />
                Próximas Guardias
              </h3>
              {isLoading ? <SkeletonLoader /> : (
                <>
                  {proximaGlobal ? (
                    <div>
                      <p className="text-xl font-bold text-slate-900">{guardiasPendientes.length} pendientes</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Próxima: {proximaGlobal.bomberoNombre} el {format(proximaGlobal.fecha?.toDate ? proximaGlobal.fecha.toDate() : new Date(proximaGlobal.fecha), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xl font-bold text-slate-500">No hay guardias pendientes</p>
                  )}
                </>
              )}
            </div>
            {!isLoading && (
              <Button variant="link" className="p-0 h-auto mt-4 text-primary font-bold flex items-center gap-1 w-fit hover:no-underline" onClick={() => navigate('/guardias')}>
                Asignar más guardias <ArrowRight size={16} />
              </Button>
            )}
          </div>
        )}

        {/* Card: Estado del Sistema (Solo para ADMIN) */}
        {isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between min-h-[160px]">
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="text-green-600" size={20} />
                Estado del Sistema
              </h3>
              <p className="text-2xl font-bold text-green-600">Activo</p>
              <p className="text-sm text-slate-500 mt-1">Todos los servicios operando correctamente.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SkeletonLoader = () => (
  <div className="animate-pulse space-y-2">
    <div className="h-6 bg-slate-100 rounded w-3/4"></div>
    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
  </div>
);

function App() {
  const { user, loading, isAdmin } = useAuth()

  // Mientras Firebase verifica si hay una sesión activa, no mostramos nada
  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Ruta de Login: Si YA hay usuario, lo mandamos al Dashboard */}
          <Route 
            path="/login" 
            element={!user ? <LoginPage /> : <Navigate to="/" />} 
          />

          {/* Rutas públicas de recuperación de contraseña */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/solicitar-reset-password" element={<SolicitarResetPasswordPage />} />

          {/* Rutas Protegidas bajo MainLayout */}
          <Route 
            path="/" 
            element={
              user ? (
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          {/* Directorio / Gestión de Usuarios: ADMIN o SUPERVISOR */}
          <Route 
            path="/usuarios" 
            element={
              user ? (
                <MainLayout>
                  <UsuariosPage />
                </MainLayout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          {/* Horas / Arrestos: Todos los usuarios autenticados */}
          <Route 
            path="/arrestos" 
            element={
              user ? (
                <MainLayout>
                  <ArrestosPage />
                </MainLayout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          {/* Ejemplo de otra ruta protegida */}
          <Route 
            path="/guardias" 
            element={
              user ? (
                <MainLayout>
                  <GuardiasPage />
                </MainLayout>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />

          {/* Auditoría: Solo ADMIN */}
          <Route 
            path="/auditoria" 
            element={
              user && isAdmin ? (
                <MainLayout>
                  <AuditoriaPage />
                </MainLayout>
              ) : (
                <Navigate to="/" />
              )
            } 
          />

          {/* Cualquier otra ruta redirige al inicio */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App;