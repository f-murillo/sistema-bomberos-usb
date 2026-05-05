import { useEffect, useState } from 'react';
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

interface GuardiaFormProps {
  guardia?: Guardia;
  onSuccess: () => void;
  onCancel: () => void;
}

const TURNOS_OPTIONS = [
    { label: 'Turno I', value: 'I' },
    { label: 'Turno II', value: 'II' },
    { label: 'Turno III', value: 'III' },
    { label: 'Turno IV', value: 'IV' },
    { label: 'Turno V', value: 'V' },
    { label: 'Turno VI', value: 'VI' },
    { label: 'Turno VII', value: 'VII' },
    { label: 'Turno VIII', value: 'VIII' },
    { label: 'Turno IX', value: 'IX' },
    { label: 'Turno X', value: 'X' },
    { label: 'Turno XI', value: 'XI' },
    { label: 'Turno XII', value: 'XII' },
    { label: 'Turno XIII', value: 'XIII' },
    { label: 'Especial', value: 'ESPECIAL' },
    { label: 'Otro', value: 'OTRO' },
];

const GuardiaForm = ({ guardia, onSuccess, onCancel }: GuardiaFormProps) => {
  const queryClient = useQueryClient();
  const isEditing = !!guardia?.id;

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
      minutos: 720, // 12 horas por defecto
      sede: 'SARTENEJAS',
      turno: 'I'
    }
  });

  const selectedBomberoId = watch('bomberoId');
  const selectedTurno = watch('turno');
  const [otroTurno, setOtroTurno] = useState('');

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
      const isCustomTurno = guardia.turno && !TURNOS_OPTIONS.some(opt => opt.value === guardia.turno);
      
      reset({
        ...guardia,
        fecha: guardia.fecha ? new Date(guardia.fecha).toISOString().split('T')[0] : '',
        turno: isCustomTurno ? 'OTRO' : guardia.turno,
        observaciones: guardia.observaciones || ''
      });

      if (isCustomTurno) {
        setOtroTurno(guardia.turno);
      }
    }
  }, [guardia, reset]);

  const mutation = useMutation({
    mutationFn: (data: Guardia) => {
      const payload = {
        ...data,
        minutos: Number(data.minutos),
        turno: data.turno === 'OTRO' ? otroTurno : data.turno
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
      label: `${u.nombre} (${u.condicion || 'REGULAR'})`,
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="fecha">Fecha de la Guardia</Label>
                <Input 
                    id="fecha" 
                    type="date" 
                    {...register('fecha')}
                />
                {errors.fecha && <p className="text-xs text-destructive font-medium">{errors.fecha.message as string}</p>}
            </div>

            <div className="space-y-2">
                <Select 
                    label="Turno"
                    options={[
                        { label: '-- Seleccionar Turno --', value: '' },
                        ...TURNOS_OPTIONS
                    ]}
                    {...register('turno')}
                    error={errors.turno?.message as string}
                />
                {selectedTurno === 'OTRO' && (
                    <div className="pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <Input 
                            placeholder="Especificar turno..." 
                            value={otroTurno}
                            onChange={(e) => setOtroTurno(e.target.value)}
                            className="h-9 text-sm"
                        />
                    </div>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="minutos">Duración (Minutos)</Label>
                <Input 
                    id="minutos" 
                    type="number" 
                    placeholder="Ej: 720 (12 horas)"
                    {...register('minutos', { valueAsNumber: true })}
                />
                {errors.minutos && <p className="text-xs text-destructive font-medium">{errors.minutos.message as string}</p>}
            </div>

            <div className="space-y-2">
                <Select 
                    label="Sede"
                    options={[
                        { label: 'Sartenejas', value: 'SARTENEJAS' },
                        { label: 'Litoral', value: 'LITORAL' }
                    ]}
                    {...register('sede')}
                    error={errors.sede?.message as string}
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="numeroParte">Número de Parte (Opcional)</Label>
                <Input 
                    id="numeroParte" 
                    placeholder="Ej: 145-10" 
                    {...register('numeroParte')}
                />
            </div>

            <div className="space-y-2">
                <Select 
                    label="Estado"
                    options={[
                        { label: 'Pendiente', value: 'PENDIENTE' },
                        { label: 'Completada', value: 'COMPLETADA' },
                        { label: 'Inasistencia', value: 'INASISTENCIA' },
                        { label: 'Cancelada', value: 'CANCELADA' },
                    ]}
                    {...register('estado')}
                />
            </div>
        </div>

        <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones (Opcional)</Label>
            <Input 
                id="observaciones" 
                placeholder="Ej: Instrucciones especiales para este turno..." 
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


