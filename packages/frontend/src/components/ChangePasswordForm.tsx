import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordChangeSchema } from '@bomberos-usb/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ChangePasswordForm = ({ onSuccess, onCancel }: ChangePasswordFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(PasswordChangeSchema)
  });

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.post('/usuarios/cambiar-password', data);
      setIsSuccess(true);
      if (onSuccess) {
        // Esperamos un poco para que el usuario vea el mensaje de éxito antes de cerrar el modal
        setTimeout(onSuccess, 2000);
      }
    } catch (err: any) {
      console.error('Error al cambiar contraseña:', err);
      setError(err.response?.data?.message || 'Error al cambiar la contraseña. Verifica tu clave actual.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
          <CheckCircle2 size={32} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">¡Contraseña Cambiada!</h3>
          <p className="text-slate-500 mt-1">Tu contraseña ha sido actualizada correctamente.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Contraseña Actual</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            id="currentPassword"
            type={showCurrentPassword ? "text" : "password"}
            placeholder="••••••"
            className="pl-10 pr-10"
            error={errors.currentPassword?.message as string}
            {...register('currentPassword')}
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            title={showCurrentPassword ? "Ocultar contraseña" : "Ver contraseña"}
          >
            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.currentPassword && (
          <p className="text-xs text-destructive">{errors.currentPassword.message as string}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Nueva Contraseña</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            id="newPassword"
            type={showNewPassword ? "text" : "password"}
            placeholder="••••••"
            className="pl-10 pr-10"
            error={errors.newPassword?.message as string}
            {...register('newPassword')}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            title={showNewPassword ? "Ocultar contraseña" : "Ver contraseña"}
          >
            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.newPassword && (
          <p className="text-xs text-destructive">{errors.newPassword.message as string}</p>
        )}
        <p className="text-[10px] text-slate-500 italic mt-1">Mínimo 6 caracteres.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••"
            className="pl-10 pr-10"
            error={errors.confirmPassword?.message as string}
            {...register('confirmPassword')}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            title={showConfirmPassword ? "Ocultar contraseña" : "Ver contraseña"}
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message as string}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          Actualizar Contraseña
        </Button>
      </div>
    </form>
  );
};

export default ChangePasswordForm;
