import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Zap, ShieldCheck, Lock } from "lucide-react";
import { signInWithGoogle, saveAuthFromHash, getAccessToken, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";
import { useEffect, useState } from "react";

export function AuthPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function routeAfterAuth() {
      if (!saveAuthFromHash() && !getAccessToken()) return;
      try {
        const rows = await supabaseSelect<any>("profiles", { select: "onboarding_completed", limit: 1 });
        if (!mounted) return;
        navigate(rows[0]?.onboarding_completed ? "/dashboard" : "/onboarding");
      } catch {
        if (mounted) navigate("/onboarding");
      }
    }
    routeAfterAuth();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleGoogle = () => {
    try {
      signInWithGoogle();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Không thể bắt đầu đăng nhập Google. Vui lòng thử lại."));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1B4332 0%, #2D6A4F 50%, #52B788 100%)" }}>
      {/* Animated blobs */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-[-100px] left-[-100px] w-96 h-96 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #B7E4C7, transparent)" }}
      />
      <motion.div
        animate={{ scale: [1.1, 1, 1.1], rotate: [0, -5, 0] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute bottom-[-100px] right-[-100px] w-80 h-80 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #D8F3DC, transparent)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md mx-4"
      >
        {/* Glassmorphism card */}
        <div className="rounded-2xl p-8 border backdrop-blur-xl" style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.25)", boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}>
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: "rgba(255,255,255,0.2)" }}>
              <Zap size={24} className="text-white" />
            </div>
            <h1 className="text-white" style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>SmartEnglish</h1>
            <p className="text-green-200 mt-1" style={{ fontSize: "0.875rem" }}>Your AI English Learning Partner</p>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-white" style={{ fontSize: "1.125rem", fontWeight: 600 }}>Welcome back</h2>
            <p className="text-green-200 mt-1" style={{ fontSize: "0.8125rem" }}>Sign in to continue your learning journey</p>
          </div>

          {/* Google Sign-In Button */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-medium transition-all"
            style={{ background: "white", color: "#1F2937", fontSize: "0.9375rem" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.2)" }} />
            <span className="text-green-200" style={{ fontSize: "0.75rem" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.2)" }} />
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full py-3 rounded-xl transition-all border font-medium"
            style={{ borderColor: "rgba(255,255,255,0.3)", color: "white", background: "rgba(255,255,255,0.08)", fontSize: "0.875rem" }}
          >
            Continue as Guest
          </button>

          {error && (
            <p className="text-center mt-4 text-red-100" style={{ fontSize: "0.75rem" }}>
              {error}
            </p>
          )}

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-5 mt-6">
            <div className="flex items-center gap-1.5 text-green-200">
              <ShieldCheck size={13} />
              <span style={{ fontSize: "0.75rem" }}>SSL Secured</span>
            </div>
            <div className="flex items-center gap-1.5 text-green-200">
              <Lock size={13} />
              <span style={{ fontSize: "0.75rem" }}>Privacy Protected</span>
            </div>
          </div>

          <p className="text-center text-green-300 mt-4" style={{ fontSize: "0.75rem" }}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  );
}
