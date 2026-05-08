import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrestoSchema } from '@bomberos-usb/shared';
import type { Arresto, Usuario } from '@bomberos-usb/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Loader2, User, Clock, Calendar } from 'lucide-react';

interface ArrestoFormProps {
    tipo: 'INFRACCION' | 'PAGO';
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: Arresto;
}

const TURNOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'ESPECIAL', 'OTRO'];
const MOTIVOS = ['Desconocido', 'Diligencias Academicas', 'Diligencias Laborales', 'Diligencias Personales', 'Problemas de Transporte', 'Otro'];

const ArrestoForm = ({ tipo, onSuccess, onCancel, initialData }: ArrestoFormProps) => {
    const { userData } = useAuth();
    const queryClient = useQueryClient();
    const isInfraccion = tipo === 'INFRACCION';
    const isEditing = !!initialData?.id && initialData.tipo === tipo;

    const { data: bomberos } = useQuery({
        queryKey: ['usuarios'],
        queryFn: () => api.get<Usuario[]>('/usuarios')
    });

    // Lógica para determinar si el motivo/turno inicial es "Otro"
    const getInitialMotiveValue = () => {
        if (!initialData?.motivo) return '';
        return MOTIVOS.includes(initialData.motivo) ? initialData.motivo : 'Otro';
    };

    const getInitialTurnoValue = () => {
        if (!initialData?.turno) return '';
        return TURNOS.includes(initialData.turno) ? initialData.turno : 'OTRO';
    };

    const { register, handleSubmit, control, formState: { errors } } = useForm<Arresto>({
        resolver: zodResolver(ArrestoSchema),
        defaultValues: initialData ? {
            ...initialData,
            // Si el prop 'tipo' es PAGO pero initialData era una INFRACCION, 
            // estamos en el flujo de "Pagar arresto específico"
            tipo: tipo, 
            estado: tipo === 'PAGO' ? 'PENDIENTE_VALIDACION' : initialData.estado,
            parentArrestoId: tipo === 'PAGO' ? (initialData.id || initialData.parentArrestoId) : undefined,
            fecha: initialData.fecha ? new Date(initialData.fecha).toISOString().split('T')[0] : '',
            motivo: getInitialMotiveValue(),
            turno: getInitialTurnoValue(),
            // Limpiar campos que no pertenecen a un pago si estamos convirtiendo
            falta: tipo === 'PAGO' ? undefined : initialData.falta,
            notifico: tipo === 'PAGO' ? undefined : initialData.notifico,
            mesInasistencia: tipo === 'PAGO' ? undefined : initialData.mesInasistencia,
        } : {
            bomberoId: isInfraccion ? '' : (userData?.uid || ''),
            tipo: tipo,
            fecha: new Date().toISOString().split('T')[0],
            minutos: 0,
            estado: isInfraccion ? 'PENDIENTE_PAGO' : 'PENDIENTE_VALIDACION',
            notifico: false,
            pagoDoble: false,
            mesInasistencia: ''
        }
    });

    const selectedBomberoId = useWatch({ control, name: 'bomberoId' });
    const selectedMotivo = useWatch({ control, name: 'motivo' });
    const selectedTurno = useWatch({ control, name: 'turno' });
    const [bomberoCondicion, setBomberoCondicion] = useState<'REGULAR' | 'NO_REGULAR'>('REGULAR');
    const [otroMotivo, setOtroMotivo] = useState(
        initialData?.motivo && !MOTIVOS.includes(initialData.motivo) ? initialData.motivo : ''
    );
    const [otroTurno, setOtroTurno] = useState(
        initialData?.turno && !TURNOS.includes(initialData.turno) ? initialData.turno : ''
    );

    useEffect(() => {
        if (selectedBomberoId && bomberos) {
            const b = bomberos.find(u => u.uid === selectedBomberoId);
            if (b && b.condicion) {
                setBomberoCondicion(b.condicion as 'REGULAR' | 'NO_REGULAR');
            }
        }
    }, [selectedBomberoId, bomberos]);

    const mutation = useMutation({
        mutationFn: (data: Arresto) => {
            if (isEditing) {
                return api.patch(`/arrestos/${initialData.id}`, data);
            }
            const endpoint = tipo === 'INFRACCION' ? '/arrestos/infraccion' : '/arrestos/pago';
            return api.post(endpoint, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['arrestos'] });
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            onSuccess();
        },
        onError: (error: any) => {
            alert("Error al procesar el registro: " + (error.response?.data?.message || error.message));
            console.error("Error completo:", error);
        }
    });

    const onSubmit = (data: Arresto) => {
        const finalData = { ...data };
        if (!isEditing) delete finalData.id;
        
        if (data.motivo === 'Otro' && otroMotivo) {
            finalData.motivo = otroMotivo;
        }
        if (data.turno === 'OTRO' && otroTurno) {
            finalData.turno = otroTurno;
        }
        mutation.mutate(finalData);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2 overflow-y-auto max-h-[70vh] px-1">
            
            {isInfraccion && (
                <div className="space-y-2">
                    <Label htmlFor="bomberoId">Seleccionar Funcionario (Infractor)</Label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <select
                            id="bomberoId"
                            className="w-full pl-10 pr-4 py-2 bg-white border rounded-md focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none disabled:bg-slate-50"
                            {...register('bomberoId')}
                            disabled={isEditing}
                        >
                            <option value="">Seleccione un bombero...</option>
                            {bomberos?.filter(u => u.uid !== userData?.uid && u.rol !== 'ADMIN').map(u => (
                                <option key={u.uid} value={u.uid}>{u.nombre} ({u.condicion || 'REGULAR'})</option>
                            ))}
                            {isEditing && initialData?.bomberoNombre && (
                                <option value={initialData.bomberoId}>{initialData.bomberoNombre}</option>
                            )}
                        </select>
                    </div>
                    {errors.bomberoId && <p className="text-xs text-red-500">{errors.bomberoId.message as string}</p>}
                </div>
            )}

            {/* CAMPOS COMUNES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="fecha">Fecha de Inicio de Guardia</Label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input id="fecha" type="date" className="pl-10" {...register('fecha')} />
                    </div>
                    {errors.fecha && <p className="text-xs text-red-500">{errors.fecha.message as string}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="minutos">Minutos {isInfraccion ? 'de Arresto/Retardo' : 'Pagados'}</Label>
                    <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input id="minutos" type="number" className="pl-10" placeholder="Ej: 1440" {...register('minutos', { valueAsNumber: true })} />
                    </div>
                    {errors.minutos && <p className="text-xs text-red-500">{errors.minutos.message as string}</p>}
                    <p className="text-xs text-slate-500">Recuerde: 24 horas = 1440 minutos.</p>
                </div>
            </div>

            {/* SECCIÓN INFRACCION */}
            {isInfraccion && (
                <>
                    {bomberoCondicion === 'REGULAR' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="falta">Falta Cometida</Label>
                                    <select id="falta" className="w-full px-4 py-2 bg-white border rounded-md" {...register('falta')}>
                                        <option value="">Seleccione...</option>
                                        <option value="INASISTENCIA">Inasistencia a la Guardia</option>
                                        <option value="LLEGADA_TARDE">Llegada tarde a la guardia</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sede">Sede</Label>
                                    <select id="sede" className="w-full px-4 py-2 bg-white border rounded-md" {...register('sede')}>
                                        <option value="">Seleccione...</option>
                                        <option value="SARTENEJAS">Sartenejas</option>
                                        <option value="LITORAL">Litoral</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="turno">Turno de Guardia</Label>
                                    <select id="turno" className="w-full px-4 py-2 bg-white border rounded-md" {...register('turno')}>
                                        <option value="">Seleccione...</option>
                                        {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {selectedTurno === 'OTRO' && (
                                        <div className="pt-2">
                                            <Input 
                                                id="otroTurno" 
                                                placeholder="Especifique el turno..." 
                                                value={otroTurno}
                                                onChange={(e) => setOtroTurno(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="numeroParte">Número de Parte</Label>
                                    <Input id="numeroParte" placeholder="Ej: 138-20" {...register('numeroParte')} />
                                </div>
                            </div>
                        </>
                    )}

                    {bomberoCondicion === 'NO_REGULAR' && (
                        <div className="space-y-2">
                            <Label htmlFor="mesInasistencia">Mes Correspondiente a la Inasistencia</Label>
                            <Input id="mesInasistencia" placeholder="Ej: Octubre 2023" {...register('mesInasistencia')} />
                            <p className="text-xs text-slate-500">Valores de referencia: Egresado (480min/mes), Comandante (Guardia Fin de Semana), Ex-Comandante (960min/mes), Tesista (1 Turno), Reserva (2 Turnos).</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 flex items-center pt-8">
                            <input type="checkbox" id="notifico" className="w-4 h-4 mr-2" {...register('notifico')} />
                            <Label htmlFor="notifico">¿El funcionario notificó su inasistencia/retardo?</Label>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="motivo">Motivo</Label>
                            <select id="motivo" className="w-full px-4 py-2 bg-white border rounded-md" {...register('motivo')}>
                                <option value="">Seleccione...</option>
                                {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            {selectedMotivo === 'Otro' && (
                                <div className="pt-2">
                                    <Input 
                                        id="otroMotivo" 
                                        placeholder="Especifique el motivo..." 
                                        value={otroMotivo}
                                        onChange={(e) => setOtroMotivo(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* SECCIÓN PAGO */}
            {!isInfraccion && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="turno">Guardia en la cual pagó</Label>
                            <select id="turno" className="w-full px-4 py-2 bg-white border rounded-md" {...register('turno')}>
                                <option value="">Seleccione...</option>
                                {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {selectedTurno === 'OTRO' && (
                                <div className="pt-2">
                                    <Input 
                                        id="otroTurno" 
                                        placeholder="Especifique el turno..." 
                                        value={otroTurno}
                                        onChange={(e) => setOtroTurno(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="numeroParte">Número de Parte</Label>
                            <Input id="numeroParte" placeholder="Ej: 138-20" {...register('numeroParte')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sede">Sede</Label>
                            <select id="sede" className="w-full px-4 py-2 bg-white border rounded-md" {...register('sede')}>
                                <option value="">Seleccione...</option>
                                <option value="SARTENEJAS">Sartenejas</option>
                                <option value="LITORAL">Litoral</option>
                            </select>
                        </div>
                        <div className="space-y-2 flex items-center pt-8">
                            <input type="checkbox" id="pagoDoble" className="w-4 h-4 mr-2" {...register('pagoDoble')} />
                            <Label htmlFor="pagoDoble">¿La Gerencia de Operaciones cuenta como doble el pago?</Label>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="observaciones">Observaciones</Label>
                        <textarea id="observaciones" className="w-full px-4 py-2 bg-white border rounded-md" {...register('observaciones')} />
                    </div>
                </>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? 'Guardar Cambios' : (isInfraccion ? 'Registrar Infracción' : 'Reportar Pago')}
                </Button>
            </div>
        </form>
    );
};

export default ArrestoForm;
