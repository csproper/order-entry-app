"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Loader2, Search, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CsvExportPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(formatDate(firstDay));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [statusFilter, setStatusFilter] = useState("未出力");
  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastExportedCount, setLastExportedCount] = useState<number | null>(
    null
  );

  const handlePreview = async () => {
    if (!startDate || !endDate) {
      toast.error("開始日と終了日を指定してください");
      return;
    }
    setPreviewLoading(true);
    setLastExportedCount(null);
    try {
      const res = await fetch("/api/csv/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          status_filter: statusFilter || "all",
          preview: true,
        }),
      });

      if (res.status === 404) {
        setPreviewCount(0);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "プレビューに失敗しました");
      }

      const text = await res.text();
      const lines = text.trim().split("\n").length - 1;
      setPreviewCount(lines);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "プレビューに失敗しました";
      toast.error(message);
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error("開始日と終了日を指定してください");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/csv/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          status_filter: statusFilter || "all",
          // preview: false → ステータスを「CSV出力済み」に更新する
        }),
      });

      if (res.status === 404) {
        toast.error("指定期間の対象データがありません");
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "CSV出力に失敗しました");
      }

      // 出力件数を取得
      const exportedCount = parseInt(
        res.headers.get("X-Exported-Count") || "0"
      );

      // ファイルダウンロード
      const blob = await res.blob();
      const contentDisposition =
        res.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : "orders.csv";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastExportedCount(exportedCount);
      setPreviewCount(null);
      toast.success(
        `CSVファイルをダウンロードしました（${exportedCount}件の受注をCSV出力済みに更新）`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "CSV出力に失敗しました";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: "未出力", label: "未出力のみ" },
    { value: "all", label: "すべて（再出力含む）" },
    { value: "CSV出力済み", label: "出力済みのみ" },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">CSV出力</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">出力条件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 日付範囲 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>開始日</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreviewCount(null);
                  setLastExportedCount(null);
                }}
              />
            </div>
            <div>
              <Label>終了日</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreviewCount(null);
                  setLastExportedCount(null);
                }}
              />
            </div>
          </div>

          {/* ステータスフィルター */}
          <div>
            <Label className="mb-2 block">ステータス</Label>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setStatusFilter(opt.value);
                    setPreviewCount(null);
                    setLastExportedCount(null);
                  }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    statusFilter === opt.value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-sm text-gray-500 space-y-1">
            <p>商品コード「9999」の明細は自動的に除外されます。</p>
            <p className="text-amber-600">
              CSV出力を実行すると、対象受注のステータスが「CSV出力済み」に自動更新されます。
            </p>
          </div>

          {/* プレビュー */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  確認中...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  件数を確認
                </>
              )}
            </Button>

            {previewCount !== null && (
              <span className="text-sm">
                {previewCount === 0 ? (
                  <span className="text-amber-600">
                    対象データがありません
                  </span>
                ) : (
                  <span>
                    出力対象:{" "}
                    <strong className="text-gray-900">{previewCount}</strong>{" "}
                    明細行
                  </span>
                )}
              </span>
            )}
          </div>

          {/* 前回出力結果 */}
          {lastExportedCount !== null && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>
                {lastExportedCount}件の受注を「CSV出力済み」に更新しました
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleExport}
          disabled={loading || previewCount === 0}
          className="min-w-40"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              出力中...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              CSV出力
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
