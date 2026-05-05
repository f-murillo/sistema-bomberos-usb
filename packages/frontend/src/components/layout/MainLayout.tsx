import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  LogOut, 
  User as UserIcon,
  ShieldCheck,
  Menu,
  X,
  KeyRound,
  ShieldAlert,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NotificationBell from './NotificationBell';
import { Dialog } from '@/components/ui/dialog';
import ChangePasswordForm from '@/components/ChangePasswordForm';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { userData, isAdmin, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
      queryClient.clear();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const menuItems = [
    { label: 'Inicio', icon: <LayoutDashboard size={20} />, path: '/', show: true },
    { label: 'Mis Guardias', icon: <Calendar size={20} />, path: '/guardias', show: !isAdmin },
    { label: 'Horas / Arrestos', icon: <ShieldAlert size={20} />, path: '/arrestos', show: !isAdmin },
    { label: isAdmin ? 'Gestión Usuarios' : 'Directorio', icon: <Users size={20} />, path: '/usuarios', show: isAdmin || isSupervisor },
    { label: 'Auditoría', icon: <History size={20} />, path: '/auditoria', show: isAdmin },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-white border-b shadow-sm z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <ShieldCheck size={20} />
          </div>
          <span className="font-bold text-slate-800">Bomberos USB</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-md"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Sidebar (Desktop) & Drawer (Mobile) */}
      <aside className={cn(
        "fixed inset-0 z-50 lg:relative lg:z-50 transition-transform duration-300 transform lg:translate-x-0 w-64 bg-white border-r flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Mobile Backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm lg:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <div className="relative h-full bg-white flex flex-col z-50">
          <div className="p-6 border-b hidden lg:flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Bomberos USB</h1>
              <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">Sistema de Gestión</p>
            </div>
            <NotificationBell />
          </div>

          <nav className="flex-1 p-4 space-y-2 mt-4 lg:mt-0">
            {menuItems.filter(item => item.show).map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Info & Logout */}
          <div className="relative p-4 border-t bg-slate-50/50">
            {/* User Menu Popover */}
            {isUserMenuOpen && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border rounded-lg shadow-xl overflow-hidden z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200">
                <button 
                  onClick={() => {
                    setIsChangePasswordOpen(true);
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <KeyRound size={18} className="text-primary" />
                  <span className="font-medium">Cambiar Contraseña</span>
                </button>
              </div>
            )}

            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={cn(
                "w-full flex items-center gap-3 mb-4 px-2 py-2 rounded-lg transition-all text-left group",
                isUserMenuOpen ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-slate-200/50"
              )}
            >
              <div className={cn(
                "p-2 rounded-full shrink-0 transition-colors",
                isUserMenuOpen ? "bg-primary text-white" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
              )}>
                <UserIcon size={20} />
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-semibold truncate text-slate-900">{userData?.nombre || 'Usuario'}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold">{userData?.rol}</p>
              </div>
            </button>

            <Button 
              variant="ghost" 
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut size={20} className="mr-2 shrink-0" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 lg:p-8">
        {children}
      </main>

      {/* Change Password Dialog */}
      <Dialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
        title="Cambiar Contraseña"
        description="Por seguridad, ingresa tu contraseña actual antes de establecer una nueva."
      >
        <ChangePasswordForm 
          onSuccess={() => setIsChangePasswordOpen(false)}
          onCancel={() => setIsChangePasswordOpen(false)}
        />
      </Dialog>
    </div>
  );
};

export default MainLayout;