import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "@/config/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Lock } from "lucide-react";

type CodeStatus = "idle" | "validating" | "valid" | "invalid";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oobCode");
    setOobCode(code);

    if (!code) {
      setCodeStatus("invalid");
      return;
    }

    setCodeStatus("validating");

    verifyPasswordResetCode(auth, code)
      .then(() => {
        setCodeStatus("valid");
      })
      .catch(() => {
        setCodeStatus("invalid");
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode || newPassword.length < 6) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setIsSuccess(true);
    } catch (err: any) {
      setError("Ocurrió un error al restablecer la contraseña. El enlace pudo haber expirado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">¡Contraseña restablecida!</h2>
                <p className="text-slate-500 mt-2">
                  Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
              </div>
              <Button className="mt-4" onClick={() => navigate("/login")}>
                Ir al inicio de sesión
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Bomberos USB</CardTitle>
          <CardDescription className="text-center">
            {codeStatus === "validating" && "Validando enlace..."}
            {codeStatus === "invalid" && "Enlace inválido o expirado"}
            {codeStatus === "valid" && "Ingresa tu nueva contraseña"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codeStatus === "validating" && (
            <div className="flex justify-center py-8">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          )}

          {codeStatus === "invalid" && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center">
                <AlertCircle size={32} />
              </div>
              <p className="text-slate-600">
                El enlace de restablecimiento es inválido o ha expirado. Solicita uno nuevo para continuar.
              </p>
              <Button variant="outline" onClick={() => navigate("/solicitar-reset-password")}>
                Solicitar nuevo enlace
              </Button>
            </div>
          )}

          {codeStatus === "valid" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••"
                    className="pl-10 pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 italic">Mínimo 6 caracteres.</p>
              </div>

              <Button type="submit" disabled={isSubmitting || newPassword.length < 6} className="w-full gap-2">
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                <KeyRound size={16} />
                Restablecer Contraseña
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
