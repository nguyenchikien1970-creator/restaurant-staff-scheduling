import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ChefHat } from 'lucide-react';
import { useLanguage } from '../i18n';

const CORRECT_PASSWORD = 'Kien-MAMMAM-Berlin';
const AUTH_KEY = 'mammam_auth';

// Google Apps Script Web App URL — replace with your deployed URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZzCl4lfkebECIed7jKsx9Yix_hxQpxsply6tQFXEPxEljSDoi68Re-3Sba9ft7u5M/exec';

interface LoginPageProps {
  onLogin: (email: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper: get location from browser GPS
  const getGPSLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      );
    });
  };

  // Helper: reverse geocode lat/lng → readable address
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`);
      const data = await res.json();
      const addr = data.address || {};
      const parts = [addr.city || addr.town || addr.village || addr.municipality || '', addr.state || '', addr.country || ''].filter(Boolean);
      return parts.join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  // Helper: fallback — get location from IP address
  const getIPLocation = async (): Promise<{ location: string; lat: number; lng: number }> => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      return {
        location: [data.city, data.region, data.country_name].filter(Boolean).join(', ') || 'Unknown',
        lat: data.latitude || 0,
        lng: data.longitude || 0,
      };
    } catch {
      return { location: 'Unknown', lat: 0, lng: 0 };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate email
    if (!email || !email.includes('@')) {
      setError(language === 'de' ? 'Bitte geben Sie eine gültige E-Mail ein.' : 'Vui lòng nhập email hợp lệ.');
      return;
    }

    // Validate password
    if (password !== CORRECT_PASSWORD) {
      setError(language === 'de' ? 'Falsches Passwort. Zugang verweigert.' : 'Sai mật khẩu. Từ chối truy cập.');
      return;
    }

    setLoading(true);

    // Get user location (GPS first, fallback to IP)
    let locationStr = 'Unknown';
    let lat = 0;
    let lng = 0;
    try {
      const gps = await getGPSLocation();
      lat = gps.lat;
      lng = gps.lng;
      locationStr = await reverseGeocode(lat, lng);
    } catch {
      // GPS failed or denied → use IP-based location
      try {
        const ipLoc = await getIPLocation();
        locationStr = ipLoc.location;
        lat = ipLoc.lat;
        lng = ipLoc.lng;
      } catch {
        locationStr = 'Could not determine';
      }
    }

    // Send login event to Google Sheet via Apps Script
    // Use GET with URL params — most reliable method (avoids CORS issues with POST)
    try {
      const params = new URLSearchParams({
        email: email,
        timestamp: new Date().toISOString(),
        location: locationStr,
        latitude: String(lat),
        longitude: String(lng),
      });
      // Use an Image beacon as fallback — guaranteed to work even with strict CORS
      const beacon = new Image();
      beacon.src = `${APPS_SCRIPT_URL}?${params.toString()}`;

      // Also try fetch as primary method
      await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
        method: 'GET',
        mode: 'no-cors',
      });
    } catch (err) {
      // Silently fail — login still works even if Sheet logging fails
      console.warn('Could not log to Google Sheet:', err);
    }

    // Save auth to localStorage
    localStorage.setItem(AUTH_KEY, JSON.stringify({ email, loggedInAt: new Date().toISOString() }));

    setLoading(false);
    onLogin(email);
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
        {/* Logo / Brand */}
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
              ? (language === 'de' ? 'Anmeldung...' : 'Đang đăng nhập...')
              : (language === 'de' ? 'Anmelden' : 'Đăng nhập')}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Kien-MAMMAM-Berlin
        </p>
      </div>
    </div>
  );
}

// Helper: check if user is already logged in
export function getStoredAuth(): { email: string; loggedInAt: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

// Helper: logout
export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}
