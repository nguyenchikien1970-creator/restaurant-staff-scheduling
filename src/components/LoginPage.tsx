import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ChefHat } from 'lucide-react';
import { useLanguage } from '../i18n';
import { supabase } from '../lib/supabaseClient';

interface LoginPageProps {
  onLogin: (email: string, userId: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email || !email.includes('@')) {
      setError(language === 'de' ? 'Bitte geben Sie eine gültige E-Mail ein.' : 'Vui lòng nhập email hợp lệ.');
      return;
    }
    if (!password || password.length < 6) {
      setError(language === 'de' ? 'Passwort muss mindestens 6 Zeichen haben.' : 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);

    if (isSignUp) {
      // ── Sign Up ──
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
      } else if (data.user) {
        setSuccessMessage(
          language === 'de'
            ? 'Konto erstellt! Bitte bestätigen Sie Ihre E-Mail und melden Sie sich dann an.'
            : 'Tạo tài khoản thành công! Vui lòng xác nhận email rồi đăng nhập.'
        );
        setIsSignUp(false);
      }
    } else {
      // ── Sign In ──
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(language === 'de' ? 'Falsches Passwort oder E-Mail.' : 'Sai email hoặc mật khẩu.');
      } else if (data.user) {
        onLogin(data.user.email || email, data.user.id);
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      setError(language === 'de' ? 'Bitte E-Mail eingeben, um ein neues Passwort zu erhalten.' : 'Vui lòng nhập email để nhận link đặt lại mật khẩu.');
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) {
      setError(resetError.message);
    } else {
      setSuccessMessage(
        language === 'de'
          ? 'Passwort-Reset-Link wurde an Ihre E-Mail gesendet.'
          : 'Link đặt lại mật khẩu đã gửi đến email của bạn.'
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
      {/* Language toggle */}
      <button
        onClick={() => setLanguage(language === 'vi' ? 'de' : 'vi')}
        className="fixed top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:bg-white transition-all shadow-sm z-50"
      >
        {language === 'vi' ? '🇻🇳 VN' : '🇩🇪 DE'}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg mb-4">
            <ChefHat size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {language === 'de' ? 'Personalmanagement' : 'Quản Lý Nhân Sự'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {language === 'de' ? 'Intelligente Dienstplanung' : 'Lập Lịch Nhân Sự Thông Minh'}
          </p>
          <p className="text-xs text-orange-600 font-medium mt-1">by MAMMAM Berlin</p>
        </div>

        {/* Login/SignUp Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {isSignUp
                ? (language === 'de' ? 'Konto erstellen' : 'Tạo tài khoản')
                : (language === 'de' ? 'Anmelden' : 'Đăng nhập')
              }
            </h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {language === 'de' ? 'E-Mail-Adresse' : 'Địa chỉ Email'}
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={language === 'de' ? 'name@beispiel.de' : 'ten@vidu.com'}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {language === 'de' ? 'Passwort' : 'Mật khẩu'}
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <Lock size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
              ✅ {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? (language === 'de' ? 'Bitte warten...' : 'Đang xử lý...')
              : isSignUp
                ? (language === 'de' ? 'Registrieren' : 'Đăng ký')
                : (language === 'de' ? 'Anmelden' : 'Đăng nhập')
            }
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMessage(''); }}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              {isSignUp
                ? (language === 'de' ? '← Zurück zum Login' : '← Quay lại đăng nhập')
                : (language === 'de' ? 'Neues Konto erstellen' : 'Tạo tài khoản mới')
              }
            </button>
            {!isSignUp && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-gray-500 hover:text-gray-700 text-xs"
              >
                {language === 'de' ? 'Passwort vergessen?' : 'Quên mật khẩu?'}
              </button>
            )}
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Kien-MAMMAM-Berlin
        </p>
      </div>
    </div>
  );
}
