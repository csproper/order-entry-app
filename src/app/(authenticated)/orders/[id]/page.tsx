"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Loader2, Pencil } from "lucide-react";
import type { Database } from "@/lib/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderDetail = Database["public"]["Tables"]["order_details"]["Row"];

function StatusBadge({ status }: { status: string }) {
  if (status === "CSV出力済み") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        CSV出力済み
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
      未出力
    </span>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<(Order & { status?: string }) | null>(
    null
  );
  const [details, setDetails] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setOrder(data.order);
        setDetails(data.details);
      } catch {
        toast.error("受注データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("受注を削除しました");
      router.push("/");
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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

  const isExported = order.status === "CSV出力済み";

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧
          </Button>
          <h1 className="text-2xl font-bold font-mono">
            {order.order_number}
          </h1>
          <StatusBadge status={order.status || "未出力"} />
        </div>
        <div className="flex items-center gap-2">
          {!isExported && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/orders/${id}/edit`}>
                <Pencil className="h-4 w-4 mr-1" />
                編集
              </Link>
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                削除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>この受注を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  受注番号 {order.order_number}{" "}
                  を削除します。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? "削除中..." : "削除する"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* CSV出力済み注意 */}
      {isExported && (
        <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">
          この受注はCSV出力済みです。編集するには、ステータスを戻す必要があります。
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 注文情報 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 注文者情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">注文者情報</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">顧客番号</dt>
                <dd>{order.customer_code || "—"}</dd>
                <dt className="text-gray-500">氏名</dt>
                <dd>{order.customer_name}</dd>
                <dt className="text-gray-500">郵便番号</dt>
                <dd>{order.postal_code}</dd>
                <dt className="text-gray-500">住所</dt>
                <dd>
                  {order.prefecture}
                  {order.customer_address1}
                  {order.customer_address2 && ` ${order.customer_address2}`}
                </dd>
                {order.customer_company && (
                  <>
                    <dt className="text-gray-500">会社名</dt>
                    <dd>{order.customer_company}</dd>
                  </>
                )}
                <dt className="text-gray-500">電話番号</dt>
                <dd>{order.customer_phone || "—"}</dd>
                <dt className="text-gray-500">メール</dt>
                <dd>{order.customer_email || "—"}</dd>
              </dl>
            </CardContent>
          </Card>

          {/* 明細 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                商品明細（{details.length}件）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {details.map((detail) => (
                <div
                  key={detail.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-gray-500 mr-2">
                        {detail.product_code}
                      </span>
                      <span className="font-medium">
                        {detail.product_name}
                      </span>
                    </div>
                    <span className="font-mono font-semibold">
                      ¥{detail.line_total.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 grid grid-cols-3 gap-2">
                    <div>
                      単価: ¥{detail.unit_price.toLocaleString()} ×{" "}
                      {detail.quantity}
                    </div>
                    <div>送料: ¥{detail.shipping_fee.toLocaleString()}</div>
                    <div>
                      ラッピング: ¥{detail.wrapping_fee.toLocaleString()}
                    </div>
                  </div>
                  <Separator />
                  <div className="text-sm">
                    <p className="font-medium mb-1">お届け先</p>
                    <p>
                      {detail.delivery_name}　〒{detail.delivery_postal_code}
                    </p>
                    <p>
                      {detail.delivery_prefecture}
                      {detail.delivery_address1}
                      {detail.delivery_address2 &&
                        ` ${detail.delivery_address2}`}
                    </p>
                    {detail.delivery_date && (
                      <p className="text-gray-500">
                        配送日: {detail.delivery_date}
                        {detail.delivery_time && ` ${detail.delivery_time}`}
                      </p>
                    )}
                  </div>
                  {(detail.noshi_type || detail.wrapping_type) && (
                    <div className="text-sm text-gray-600">
                      {detail.noshi_type && (
                        <span className="mr-3">のし: {detail.noshi_type}</span>
                      )}
                      {detail.wrapping_type && (
                        <span>包装: {detail.wrapping_type}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* 右: 金額・メタ情報 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">金額</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">受注小計</span>
                <span className="font-mono">
                  ¥{order.subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">送料合計</span>
                <span className="font-mono">
                  ¥{order.total_shipping_fee.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ラッピング料</span>
                <span className="font-mono">
                  ¥{order.total_wrapping_fee.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">手数料</span>
                <span className="font-mono">
                  ¥{order.total_fee.toLocaleString()}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>値引き</span>
                  <span className="font-mono">
                    -¥{order.discount.toLocaleString()}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>合計</span>
                <span className="font-mono">
                  ¥{order.total_amount.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">注文情報</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">ステータス</dt>
                  <dd>
                    <StatusBadge status={order.status || "未出力"} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">受注日時</dt>
                  <dd>
                    {new Date(order.order_datetime).toLocaleString("ja-JP")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">支払方法</dt>
                  <dd>{order.payment_method}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">担当者</dt>
                  <dd>{order.operator_name}</dd>
                </div>
                {order.order_memo && (
                  <div>
                    <dt className="text-gray-500 mb-1">メモ</dt>
                    <dd className="bg-gray-50 p-2 rounded text-xs">
                      {order.order_memo}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
