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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError(language === 'de' ? 'Bitte geben Sie eine gültige E-Mail ein.' : 'Vui lòng nhập email hợp lệ.');
      return;
    }
    if (!password || password.length < 6) {
      setError(language === 'de' ? 'Passwort muss mindestens 6 Zeichen haben.' : 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(language === 'de' ? 'Falsches Passwort oder E-Mail.' : 'Sai email hoặc mật khẩu.');
    } else if (data.user) {
      onLogin(data.user.email || email, data.user.id);
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {language === 'de' ? 'Anmelden' : 'Đăng nhập'}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? (language === 'de' ? 'Bitte warten...' : 'Đang xử lý...')
              : (language === 'de' ? 'Anmelden' : 'Đăng nhập')
            }
          </button>

          <p className="text-center text-xs text-gray-400 mt-2">
            {language === 'de'
              ? 'Kein Konto? Bitte kontaktieren Sie den Administrator.'
              : 'Chưa có tài khoản? Vui lòng liên hệ quản trị viên.'}
          </p>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Kien-MAMMAM-Berlin
        </p>
      </div>
    </div>
  );
}
