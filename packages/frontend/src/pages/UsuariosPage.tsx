import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Usuario } from '@bomberos-usb/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import UsuarioForm from '@/components/UsuarioForm';
import {
  UserPlus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  Upload,
  Download
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { Mail, Phone, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generarPlantillaUsuariosExcel } from '@/lib/reports';
import ExcelJS from 'exceljs';
import { useRef } from 'react';

const UsuariosPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [usuarioAEditar, setUsuarioAEditar] = useState<Usuario | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin, isSupervisor, isCuentaAdministrativa, userData } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Paginación
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);

  const queryClient = useQueryClient();

  // 1. Obtener usuarios (con caché y paginación)
  const { data: usuarios, isLoading, isError, refetch } = useQuery({
    queryKey: ['usuarios', cursors[currentPage]],
    queryFn: () => api.get<Usuario[]>(`/usuarios?${cursors[currentPage] ? `ultimoId=${cursors[currentPage]}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });

  const handleNextPage = () => {
    if (usuarios && usuarios.length === 20) {
      const lastId = usuarios[usuarios.length - 1].uid;
      if (lastId && !cursors.includes(lastId)) {
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
    mutationFn: (uid: string) => api.delete(`/usuarios/${uid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      resetPagination();
    },
    onError: (error: any) => {
      alert(error.message || 'Error al eliminar el usuario');
    }
  });

  const handleEdit = (usuario: Usuario) => {
    setUsuarioAEditar(usuario);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setUsuarioAEditar(undefined);
    setIsDialogOpen(true);
  };

  const handleDownloadTemplate = async () => {
    try {
      await generarPlantillaUsuariosExcel();
    } catch (error: any) {
      alert(error.message || 'Error al generar la plantilla');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());

      const worksheet = workbook.getWorksheet('Usuarios') || workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('No se encontró una hoja válida en el Excel.');
      }

      const usuariosLote: any[] = [];
      let errorValidacion = '';

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar cabecera

        const nombre = row.getCell(1).text?.trim();
        const email = row.getCell(2).text?.trim();
        if (!nombre || !email) return; // Ignorar fila vacía o sin datos clave

        let telefono = row.getCell(3).text?.trim() || '';
        // Si el teléfono tiene 10 dígitos y no empieza por 0, probablemente Excel se lo comió
        if (telefono.length === 10 && !telefono.startsWith('0')) {
          telefono = '0' + telefono;
        }
        const rol = row.getCell(4).text?.trim() as string;
        const rango = row.getCell(5).text?.trim() as string;
        const condicion = row.getCell(6).text?.trim() as string;
        const estado = row.getCell(7).text?.trim() as string;

        // Validación de roles permitidos según usuario actual
        if (userData?.rol === 'SUPERVISOR' && (rol === 'ADMIN' || rol === 'SUPERVISOR')) {
          errorValidacion = `La fila ${rowNumber} intenta crear un usuario con rol ${rol}, lo cual no está permitido para tu rol actual.`;
        }
        if (userData?.rol === 'CUENTA_ADMINISTRATIVA' && (rol === 'ADMIN' || rol === 'SUPERVISOR' || rol === 'CUENTA_ADMINISTRATIVA')) {
          errorValidacion = `La fila ${rowNumber} intenta crear un usuario con rol ${rol}, lo cual no está permitido para tu rol actual.`;
        }

        usuariosLote.push({
          nombre,
          email,
          telefono: telefono === '' ? undefined : telefono,
          rol: rol || 'BOMBERO', // default si está vacío
          rango: rango === 'N/A' || !rango ? undefined : rango,
          condicion: condicion || 'REGULAR',
          activo: estado === 'Inactivo' ? false : true,
        });
      });

      if (errorValidacion) {
        throw new Error(errorValidacion);
      }

      if (usuariosLote.length === 0) {
        throw new Error('El archivo no contiene usuarios válidos para registrar.');
      }

      // Llamar API
      const resultado = await api.post<{ exitosos: number, fallidos: number, detalles: string[] }>('/usuarios/bulk', usuariosLote);

      let msj = `Se procesó el archivo.\n\nUsuarios creados con éxito: ${resultado.exitosos}\nFallos: ${resultado.fallidos}`;
      if (resultado.detalles && resultado.detalles.length > 0) {
        msj += `\n\nDetalles de los fallos:\n- ${resultado.detalles.join('\n- ')}`;
      }
      alert(msj);

      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      resetPagination();
    } catch (error: any) {
      alert(error.message || 'Ocurrió un error al procesar el archivo Excel.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = (usuario: Usuario) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar a ${usuario.nombre}? Esta acción no se puede deshacer y borrará su acceso al sistema.`)) {
      if (usuario.uid) {
        deleteMutation.mutate(usuario.uid);
      }
    }
  };

  const getRoleBadge = (rol: string) => {
    switch (rol) {
      case 'ADMIN': return <Badge variant="destructive">Administrador</Badge>;
      case 'SUPERVISOR': return <Badge variant="default">Inspector General</Badge>;
      case 'CUENTA_ADMINISTRATIVA': return <Badge variant="default">Cuenta Administrativa</Badge>;
      case 'BOMBERO': return <Badge variant="secondary">Bombero</Badge>;
      default: return <Badge variant="outline">{rol}</Badge>;
    }
  };

  // Filtrado simple por nombre o email (con verificación de nulidad)
  const filteredUsuarios = usuarios?.filter(u =>
    (u.nombre?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const title = (isAdmin || isSupervisor || isCuentaAdministrativa) ? "Gestión de Usuarios" : "Directorio de Personal";
  const subtitle = (isAdmin || isSupervisor || isCuentaAdministrativa)
    ? "Administra los permisos y roles del personal del cuerpo de bomberos."
    : "Consulta el contacto del personal del sistema.";

  const displayedUsers = isAdmin ? (filteredUsuarios || []) : (filteredUsuarios?.filter(u => u.rol !== 'ADMIN') || []);
  const adminUsers = filteredUsuarios?.filter(u => u.rol === 'ADMIN') || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm sm:text-base text-slate-500">{subtitle}</p>
        </div>
        {(isAdmin || isSupervisor || isCuentaAdministrativa) && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-sm" onClick={handleDownloadTemplate}>
              <Download size={18} />
              Descargar Plantilla
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload size={18} />
              {isUploading ? 'Procesando...' : 'Subir Excel'}
            </Button>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <Button className="w-full sm:w-auto flex items-center justify-center gap-2 shadow-sm" onClick={handleCreate}>
              <UserPlus size={18} />
              Registrar Usuario
            </Button>
          </div>
        )}
      </div>

      {/* Diálogo para nuevo usuario / edición */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setUsuarioAEditar(undefined);
        }}
        title={usuarioAEditar ? "Editar Usuario" : "Registrar Nuevo Usuario"}
        description={usuarioAEditar ? "Modifica los permisos o el estado del bombero." : "Ingresa los datos del bombero para darle acceso al sistema."}
      >
        <UsuarioForm
          usuario={usuarioAEditar}
          onSuccess={() => {
            setIsDialogOpen(false);
            setUsuarioAEditar(undefined);
            resetPagination();
          }}
          onCancel={() => {
            setIsDialogOpen(false);
            setUsuarioAEditar(undefined);
          }}
        />
      </Dialog>

      {/* Filtros y Buscador */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Buscar por nombre o correo..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              resetPagination();
            }}
          />
        </div>
        <Button variant="outline" onClick={() => refetch()} className="flex justify-center gap-2">
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          Actualizar
        </Button>
      </div>

      {/* Listado Principal */}
      <div className="space-y-4">
        {isSupervisor && (
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-primary" size={20} />
            Personal del Sistema
          </h2>
        )}

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px] lg:min-w-0">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Nombre Completo</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Contacto</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Estado</th>
                  {(isAdmin || isSupervisor || isCuentaAdministrativa) && <th className="px-6 py-4 text-sm font-semibold text-slate-700 uppercase tracking-wider text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={(isAdmin || isSupervisor || isCuentaAdministrativa) ? 5 : 4} className="px-6 py-8">
                        <div className="h-4 bg-slate-100 rounded w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan={(isAdmin || isSupervisor || isCuentaAdministrativa) ? 5 : 4} className="px-6 py-12 text-center text-destructive font-medium bg-destructive/5">
                      Error al cargar los usuarios.
                    </td>
                  </tr>
                ) : displayedUsers?.length === 0 ? (
                  <tr>
                    <td colSpan={(isAdmin || isSupervisor || isCuentaAdministrativa) ? 5 : 4} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No se encontraron resultados en esta categoría.
                    </td>
                  </tr>
                ) : (
                  displayedUsers?.map((usuario) => (
                    <tr key={usuario.uid || usuario.email} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{usuario.nombre}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail size={14} className="text-slate-400" />
                            {usuario.email}
                          </div>
                          {usuario.telefono && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone size={14} className="text-slate-400" />
                              {usuario.telefono}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {getRoleBadge(usuario.rol)}
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full w-fit border",
                            (!usuario.condicion || usuario.condicion === 'REGULAR')
                              ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                              : "bg-orange-50 text-orange-600 border-orange-100"
                          )}>
                            {(!usuario.condicion || usuario.condicion === 'REGULAR') ? 'Regular' : 'No Regular'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={usuario.activo ? 'success' : 'outline'}>
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      {(isAdmin || isSupervisor || isCuentaAdministrativa) && (
                        <td className="px-6 py-4 text-right">
                          {(isAdmin ||
                            (isSupervisor && (usuario.rol === 'BOMBERO' || usuario.rol === 'CUENTA_ADMINISTRATIVA' || usuario.uid === userData?.uid)) ||
                            (isCuentaAdministrativa && (usuario.rol === 'BOMBERO' || usuario.uid === userData?.uid))
                          ) && (
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-500 hover:text-primary"
                                  onClick={() => handleEdit(usuario)}
                                >
                                  <Pencil size={16} />
                                </Button>
                                {(isAdmin ||
                                  (isSupervisor && (usuario.rol === 'BOMBERO' || usuario.rol === 'CUENTA_ADMINISTRATIVA')) ||
                                  (isCuentaAdministrativa && usuario.rol === 'BOMBERO')
                                ) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-500 hover:text-destructive"
                                      onClick={() => handleDelete(usuario)}
                                      disabled={deleteMutation.isPending}
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  )}
                              </div>
                            )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginación */}
        {!isLoading && !isError && (usuarios?.length === 20 || currentPage > 0) && (
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
                disabled={!usuarios || usuarios.length < 20 || isLoading}
                className="h-8"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Sección especial para administradores si eres supervisor */}
      {isSupervisor && (
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-destructive" size={20} />
            Administradores del Sistema (Contacto)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminUsers?.map((admin) => (
              <div key={admin.uid} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-4">
                <div className="p-3 bg-destructive/10 rounded-full text-destructive">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{admin.nombre}</h3>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={14} />
                      {admin.email}
                    </div>
                    {admin.telefono && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <Phone size={14} />
                        {admin.telefono}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;