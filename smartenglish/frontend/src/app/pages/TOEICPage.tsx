import { Award } from "lucide-react";

export function TOEICPage() {
  return (
    <div className="p-6 pb-24 lg:pb-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-border p-8 text-center">
        <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#D8F3DC" }}>
          <Award size={22} style={{ color: "#2D6A4F" }} />
        </div>
        <h1 className="text-foreground mb-2" style={{ fontSize: "1.5rem", fontWeight: 700 }}>TOEIC</h1>
        <p className="text-muted-foreground" style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>
          TOEIC exam APIs are not implemented in modules M1-M12 yet, so this page does not show placeholder questions or fake scores.
        </p>
      </div>
    </div>
  );
}
