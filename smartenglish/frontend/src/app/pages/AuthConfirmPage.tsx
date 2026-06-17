import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { clearAuth, getAccessToken, getFriendlyErrorMessage, supabaseSelect } from "../lib/api";

type Profile = {
  email?: string;
  avatar_url?: string;
  display_name?: string;
  onboarding_completed?: boolean;
};

export function AuthConfirmPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!getAccessToken()) {
      navigate("/auth", { replace: true });
      return;
    }

    supabaseSelect<Profile>("profiles", {
      select: "email,avatar_url,display_name,onboarding_completed",
      limit: 1,
    })
      .then(rows => {
        if (!mounted) return;
        setProfile(rows[0] || null);
      })
      .catch(err => {
        if (mounted) setError(getFriendlyErrorMessage(err, "Không thể tải thông tin tài khoản. Vui lòng thử lại."));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const continueToApp = () => {
    navigate(profile?.onboarding_completed ? "/dashboard" : "/onboarding", { replace: true });
  };

  const changeAccount = () => {
    clearAuth();
    navigate("/auth", { replace: true });
  };

  const name = profile?.display_name || profile?.email || "Learner";

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#F8F9FA" }}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: "#D8F3DC", color: "#2D6A4F" }}>
          <ShieldCheck size={22} />
        </div>

        <h1 className="text-foreground" style={{ fontSize: "1.375rem", fontWeight: 800 }}>
          Xác nhận tài khoản
        </h1>
        <p className="text-muted-foreground mt-2" style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>
          SmartEnglish sẽ dùng thông tin Google cơ bản này để xác định phiên đăng nhập của bạn.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-border p-3 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
            {error}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-border p-4 flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#F0FAF4", color: "#2D6A4F" }}>
              <UserRound size={22} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-foreground truncate" style={{ fontSize: "0.9375rem", fontWeight: 750 }}>
              {loading ? "Đang tải tài khoản..." : name}
            </p>
            <p className="text-muted-foreground truncate mt-1" style={{ fontSize: "0.8125rem" }}>
              {profile?.email || "Google account"}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl p-3 flex gap-2" style={{ background: "#F0FAF4", color: "#2D6A4F" }}>
          <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
          <p style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
            Chỉ tiếp tục nếu đây đúng là tài khoản bạn muốn dùng cho quá trình học.
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          <button
            onClick={continueToApp}
            disabled={loading || !profile}
            className="w-full rounded-xl py-3 text-white disabled:opacity-60"
            style={{ background: "#2D6A4F", fontSize: "0.9375rem", fontWeight: 700 }}
          >
            Tiếp tục với tài khoản này
          </button>
          <button
            onClick={changeAccount}
            className="w-full rounded-xl py-3 border border-border bg-white text-foreground flex items-center justify-center gap-2"
            style={{ fontSize: "0.9375rem", fontWeight: 650 }}
          >
            <LogOut size={16} />
            Đổi tài khoản
          </button>
        </div>
      </div>
    </div>
  );
}
