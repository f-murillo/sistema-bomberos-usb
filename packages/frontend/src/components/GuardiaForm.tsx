import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GuardiaSchema, type Guardia, type Usuario } from '@bomberos-usb/shared';
import { api } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select } from './ui/select-simple';
import { Label } from './ui/label';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface GuardiaFormProps {
  guardia?: Guardia;
  onSuccess: () => void;
  onCancel: () => void;
}

const GuardiaForm = ({ guardia, onSuccess, onCancel }: GuardiaFormProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!guardia?.id;

  // 1. Obtener lista de bomberos/usuarios para el select
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get<Usuario[]>('/usuarios'),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<Guardia>({
    resolver: zodResolver(GuardiaSchema),
    defaultValues: {
      estado: 'PENDIENTE',
    }
  });

  const selectedBomberoId = watch('bomberoId');

  // Actualizar bomberoNombre cuando cambia bomberoId (denormalización para el backend/vista)
  useEffect(() => {
    if (selectedBomberoId && usuarios) {
      const bombero = usuarios.find(u => u.uid === selectedBomberoId);
      if (bombero) {
        setValue('bomberoNombre', bombero.nombre);
      }
    }
  }, [selectedBomberoId, usuarios, setValue]);

  useEffect(() => {
    if (guardia) {
      // Convertir fechas para el input datetime-local (formato YYYY-MM-DDTHH:mm)
      const dateToInput = (date: any) => {
        if (!date) return '';
        const d = new Date(date);
        return format(d, "yyyy-MM-dd'T'HH:mm");
      };

      reset({
        bomberoId: guardia.bomberoId,
        bomberoNombre: guardia.bomberoNombre,
        fechaInicio: dateToInput(guardia.fechaInicio),
        fechaFin: dateToInput(guardia.fechaFin),
        estado: guardia.estado,
        observaciones: guardia.observaciones || ''
      });
    }
  }, [guardia, reset]);

  const mutation = useMutation({
    mutationFn: (data: Guardia) => {
      // Asegurarse de que las fechas sean objetos Date antes de enviar (o strings ISO)
      const payload = {
        ...data,
        fechaInicio: new Date(data.fechaInicio as any).toISOString(),
        fechaFin: new Date(data.fechaFin as any).toISOString(),
      };

      if (isEditing && guardia?.id) {
        return api.patch(`/guardias/${guardia.id}`, payload);
      }
      return api.post('/guardias', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardias'] });
      reset();
      onSuccess();
    },
    onError: (error: any) => {
      alert(error.message || `Error al ${isEditing ? 'actualizar' : 'crear'} la guardia`);
    }
  });

  const onSubmit = (data: Guardia) => {
    mutation.mutate(data);
  };

  const bomberoOptions = usuarios
    ?.filter(u => u.rol !== 'ADMIN' && u.activo !== false)
    .map(u => ({
      label: u.nombre,
      value: u.uid || ''
    })) || [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-4">
        <div className="space-y-2">
            <Select 
                label="Asignar Bombero"
                options={[
                    { label: '-- Seleccionar bombero --', value: '' },
                    ...bomberoOptions
                ]}
                {...register('bomberoId')}
                error={errors.bomberoId?.message as string}
            />
            {errors.bomberoId && <p className="text-xs text-destructive font-medium">{errors.bomberoId.message as string}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="fechaInicio">Fecha y Hora de Inicio</Label>
                <Input 
                    id="fechaInicio" 
                    type="datetime-local" 
                    {...register('fechaInicio')}
                />
                {errors.fechaInicio && <p className="text-xs text-destructive font-medium">{errors.fechaInicio.message as string}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="fechaFin">Fecha y Hora de Fin</Label>
                <Input 
                    id="fechaFin" 
                    type="datetime-local" 
                    {...register('fechaFin')}
                />
                {errors.fechaFin && <p className="text-xs text-destructive font-medium">{errors.fechaFin.message as string}</p>}
            </div>
        </div>

        <div className="space-y-2">
            <Select 
                label="Estado de la Guardia"
                options={[
                    { label: 'Pendiente', value: 'PENDIENTE' },
                    { label: 'En curso', value: 'EN_CURSO' },
                    { label: 'Completada', value: 'COMPLETADA' },
                    { label: 'Inasistencia', value: 'INASISTENCIA' },
                    { label: 'Cancelada', value: 'CANCELADA' },
                ]}
                {...register('estado')}
            />
        </div>

        <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones (Opcional)</Label>
            <Input 
                id="observaciones" 
                placeholder="Ej: Cambio de turno por emergencia..." 
                {...register('observaciones')}
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
            isEditing ? 'Guardar Cambios' : 'Programar Guardia'
          )}
        </Button>
      </div>
    </form>
  );
};

export default GuardiaForm;
