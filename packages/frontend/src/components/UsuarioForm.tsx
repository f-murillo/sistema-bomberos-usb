import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UsuarioSchema, type Usuario } from '@bomberos-usb/shared';
import { api } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select-simple';
import { Label } from './ui/label';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface UsuarioFormProps {
  usuario?: Usuario; // Si viene un usuario, estamos en modo edición
  onSuccess: () => void;
  onCancel: () => void;
}

const UsuarioForm = ({ usuario, onSuccess, onCancel }: UsuarioFormProps) => {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const isEditing = !!usuario?.uid;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
    clearErrors
  } = useForm<Usuario>({
    resolver: zodResolver(UsuarioSchema),
    defaultValues: {
      activo: true,
      rol: 'BOMBERO',
      condicion: 'REGULAR'
    }
  });

  const [prefix, setPrefix] = useState('0414');
  const [phoneDigits, setPhoneDigits] = useState('');

  useEffect(() => {
    if (usuario) {
      reset({
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        rango: usuario.rango,
        condicion: usuario.condicion || 'REGULAR',
        activo: usuario.activo !== undefined ? Boolean(usuario.activo) : true,
      });

      if (usuario.telefono) {
        setPrefix(usuario.telefono.substring(0, 4));
        setPhoneDigits(usuario.telefono.substring(4));
      } else {
        setPrefix('0414');
        setPhoneDigits('');
      }
    } else {
      reset({
        nombre: '',
        email: '',
        rol: 'BOMBERO',
        rango: undefined,
        condicion: 'REGULAR',
        activo: true,
      });
      setPrefix('0414');
      setPhoneDigits('');
    }
  }, [usuario, reset]);

  // Mutación para crear o editar el usuario
  const mutation = useMutation({
    mutationFn: (data: Usuario) => {
      if (isEditing && usuario?.uid) {
        // En edición, mandamos los campos permitidos incluyendo el correo
        const updateData = {
          nombre: data.nombre,
          email: data.email,
          rol: data.rol,
          rango: data.rango,
          condicion: data.condicion,
          activo: data.activo,
          telefono: phoneDigits ? `${prefix}${phoneDigits}` : ""
        };
        return api.patch(`/usuarios/${usuario.uid}`, updateData);
      }
      // En creación
      return api.post('/usuarios', {
        ...data,
        rango: data.rango,
        condicion: data.condicion,
        telefono: phoneDigits ? `${prefix}${phoneDigits}` : ""
      });
    },
    onSuccess: () => {
      // Invalidamos la cache de usuarios para que se recargue la lista
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      reset();
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.message || '';
      
      // Si el error es por email duplicado, lo mostramos directamente en el campo
      if (errorMessage.toLowerCase().includes('correo') || errorMessage.toLowerCase().includes('email')) {
        setError('email', { 
          type: 'manual', 
          message: errorMessage 
        });
      } else {
        alert(errorMessage || `Error al ${isEditing ? 'actualizar' : 'crear'} el usuario`);
      }
    }
  });

  const onSubmit = (data: Usuario) => {
    console.log("Enviando datos:", data);
    mutation.mutate(data);
  };

  const onInvalid = (errors: any) => {
    console.error("Errores de validación en el formulario:", errors);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre Completo</Label>
          <Input 
            id="nombre" 
            placeholder="Ej: Juan Pérez" 
            {...register('nombre')}
            error={errors.nombre?.message as string}
          />
          {errors.nombre && <p className="text-xs text-destructive font-medium">{errors.nombre.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className={errors.email ? "text-destructive" : ""}>Correo Institucional</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="usuario@usb.ve" 
            {...register('email', {
              onChange: () => {
                if (errors.email) clearErrors('email');
              }
            })}
            error={errors.email?.message as string}
          />
          {errors.email && <p className="text-xs text-destructive font-medium">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Teléfono de Contacto (Opcional)</Label>
          <div className="flex gap-2">
            <div className="w-1/3">
              <select
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="w-full flex h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {['0414', '0424', '0412', '0422', '0416', '0426'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Input
                type="text"
                placeholder="1234567"
                maxLength={7}
                value={phoneDigits}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPhoneDigits(val);
                }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">Selecciona el código e ingresa los 7 números restantes.</p>
          {phoneDigits && phoneDigits.length !== 7 && (
            <p className="text-xs text-destructive font-medium">Debe tener exactamente 7 dígitos</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select 
            label="Jerarquía / Rango"
            options={[
              { label: 'Aspirante / Alumno', value: 'ASP/ALUM' },
              { label: 'Bombero Raso', value: 'BOMBERO_RASO' },
              { label: 'Distinguido', value: 'DISTINGUIDO' },
              { label: 'Cabo Segundo', value: 'CABO_SEGUNDO' },
              { label: 'Cabo Primero', value: 'CABO_PRIMERO' },
              { label: 'Sargento Segundo', value: 'SARGENTO_SEGUNDO' },
              { label: 'Sargento Primero', value: 'SARGENTO_PRIMERO' },
              { label: 'Sargento Mayor', value: 'SARGENTO_MAYOR' },
              { label: 'Teniente', value: 'TENIENTE' },
              { label: 'Capitán', value: 'CAPITAN' }
            ]}
            {...register('rango')}
            error={errors.rango?.message as string}
          />

          <Select 
            label="Condición de Servicio"
            options={[
              { label: 'Regular', value: 'REGULAR' },
              { label: 'Tesista', value: 'TESISTA' },
              { label: 'Egresado', value: 'EGRESADO' },
              { label: 'Especial 12 horas', value: 'ESPECIAL_12H' },
              { label: 'Comandante', value: 'COMANDANTE' },
              { label: 'Ex-Comandante', value: 'EX_COMANDANTE' }
            ]}
            {...register('condicion')}
            error={errors.condicion?.message as string}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select 
            label="Rol del Sistema"
            options={
              isAdmin ? [
                { label: 'Bombero', value: 'BOMBERO' },
                { label: 'Inspector General', value: 'SUPERVISOR' },
                { label: 'Administrador', value: 'ADMIN' },
              ] : [
                { label: 'Bombero', value: 'BOMBERO' }
              ]
            }
            {...register('rol')}
            error={errors.rol?.message as string}
          />

          <Select 
            label="Estado Inicial"
            options={[
              { label: 'Activo', value: 'true' },
              { label: 'Inactivo', value: 'false' },
            ]}
            {...register('activo', { setValueAs: (v) => String(v) === 'true' })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending} className="min-w-[120px]">
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Guardando...' : 'Creando...'}
            </>
          ) : (
            isEditing ? 'Guardar Cambios' : 'Crear Usuario'
          )}
        </Button>
      </div>
    </form>
  );
};

export default UsuarioForm;