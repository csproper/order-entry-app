"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OrderForm } from "@/components/order-form";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";

interface AppSettings {
  defaultShippingFee: number;
  freeShippingThreshold: number;
  earlyPriceDeadline: string;
}

export default function OrderEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [details, setDetails] = useState<any[]>([]);
  const [operatorName, setOperatorName] = useState("");
  const [operatorEmail, setOperatorEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({
    defaultShippingFee: 880,
    freeShippingThreshold: 5000,
    earlyPriceDeadline: "2025-11-28T23:59:59+09:00",
  });

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient();

        // ユーザー情報
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setOperatorName(
            user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split("@")[0] ||
              "ユーザー"
          );
          setOperatorEmail(user.email || "");
        }

        // アプリ設定
        const { data: settingsData } = await supabase
          .from("app_settings")
          .select("key, value");
        if (settingsData) {
          const map = new Map(settingsData.map((s) => [s.key, s.value]));
          setSettings({
            defaultShippingFee: parseInt(
              map.get("default_shipping_fee") || "880"
            ),
            freeShippingThreshold: parseInt(
              map.get("free_shipping_threshold") || "5000"
            ),
            earlyPriceDeadline:
              map.get("early_price_deadline") ||
              "2025-11-28T23:59:59+09:00",
          });
        }

        // 受注データ取得
        const res = await fetch(`/api/orders/${id}`);
        if (!res.ok) {
          throw new Error("受注データの取得に失敗しました");
        }
        const data = await res.json();

        // CSV出力済みの場合は編集不可
        if (data.order.status === "CSV出力済み") {
          setError("CSV出力済みの受注は編集できません");
          setLoading(false);
          return;
        }

        setOrder(data.order);
        setDetails(data.details || []);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "読み込みに失敗しました";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <p className="text-gray-600">{error}</p>
        <Button variant="outline" onClick={() => router.push(`/orders/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          受注詳細に戻る
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">受注が見つかりません</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          一覧に戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/orders/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          戻る
        </Button>
        <h1 className="text-xl font-bold">
          受注編集{" "}
          <span className="font-mono text-gray-500">
            {order.order_number}
          </span>
        </h1>
      </div>

      <OrderForm
        operatorName={operatorName}
        operatorEmail={operatorEmail}
        settings={settings}
        mode="edit"
        orderId={id}
        initialOrder={order}
        initialDetails={details}
      />
    </div>
  );
}
