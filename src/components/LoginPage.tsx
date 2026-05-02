import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ChefHat } from 'lucide-react';
import { useLanguage } from '../i18n';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // App password from env
  const APP_PASSWORD = (import.meta.env.VITE_APP_PASSWORD || 'mammam2024').trim();

  // Google Apps Script URL for login logging
  const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

  // Helper: get GPS location
  const getGPSLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('No geolocation')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      );
    });
  };

  // Helper: reverse geocode
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`);
      const data = await res.json();
      const addr = data.address || {};
      return [addr.city || addr.town || addr.village || '', addr.state || '', addr.country || ''].filter(Boolean).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
  };

  // Helper: IP-based location fallback
  const getIPLocation = async (): Promise<{ location: string; lat: number; lng: number }> => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      return { location: [data.city, data.region, data.country_name].filter(Boolean).join(', ') || 'Unknown', lat: data.latitude || 0, lng: data.longitude || 0 };
    } catch { return { location: 'Unknown', lat: 0, lng: 0 }; }
  };

  // Log login event to Google Sheet (runs after successful auth)
  const logLoginToSheet = async (userEmail: string) => {
    let locationStr = 'Unknown';
    let lat = 0, lng = 0;
    try {
      const gps = await getGPSLocation();
      lat = gps.lat; lng = gps.lng;
      locationStr = await reverseGeocode(lat, lng);
    } catch {
      try {
        const ipLoc = await getIPLocation();
        locationStr = ipLoc.location; lat = ipLoc.lat; lng = ipLoc.lng;
      } catch { locationStr = 'Could not determine'; }
    }
    try {
      const params = new URLSearchParams({
        email: userEmail,
        timestamp: new Date().toISOString(),
        location: locationStr,
        latitude: String(lat),
        longitude: String(lng),
      });
      const beacon = new Image();
      beacon.src = `${APPS_SCRIPT_URL}?${params.toString()}`;
      await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, { method: 'GET', mode: 'no-cors' });
    } catch (err) { console.warn('Could not log to Google Sheet:', err); }
  };

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

    // Simple password check against env variable
    if (password === APP_PASSWORD) {
      // Save session to localStorage
      localStorage.setItem('auth_email', email);
      logLoginToSheet(email);
      onLogin(email);
    } else {
      setError(language === 'de' ? 'Falsches Passwort.' : 'Sai mật khẩu.');
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
