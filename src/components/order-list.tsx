"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FileDown, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  OrderFilterBar,
  applyFilters,
  INITIAL_FILTERS,
  type OrderFilters,
} from "@/components/order-filter-bar";

interface Order {
  id: string;
  order_number: string;
  order_datetime: string;
  customer_name: string;
  payment_method: string;
  total_amount: number;
  operator_name: string;
  status: string;
}

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>(INITIAL_FILTERS);

  const supabase = createClient();

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("orders")
      .select(
        "id, order_number, order_datetime, customer_name, payment_method, total_amount, operator_name, status"
      )
      .order("order_datetime", { ascending: false })
      .limit(500);

    if (err) {
      setError(
        "データの取得に失敗しました。テーブルが作成されているか確認してください。"
      );
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const operators = useMemo(() => {
    const names = new Set(orders.map((o) => o.operator_name).filter(Boolean));
    return Array.from(names).sort();
  }, [orders]);

  const filteredOrders = useMemo(
    () => applyFilters(orders, filters),
    [orders, filters]
  );

  const totalAmount = filteredOrders.reduce(
    (sum, o) => sum + o.total_amount,
    0
  );

  // ステータス別カウント
  const unexportedCount = orders.filter(
    (o) => o.status !== "CSV出力済み"
  ).length;

  return (
    <div className="space-y-4">
      {/* ヘッダー行 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">受注一覧</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            更新
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/csv-export">
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              CSV出力
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/orders/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新規受注
            </Link>
          </Button>
        </div>
      </div>

      {/* フィルターバー */}
      <OrderFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        operators={operators}
        totalCount={orders.length}
        filteredCount={filteredOrders.length}
      />

      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="表示件数" value={`${filteredOrders.length}件`} />
        <SummaryCard
          label="合計金額"
          value={`¥${totalAmount.toLocaleString()}`}
        />
        <SummaryCard
          label="本日の受注"
          value={`${orders.filter((o) => isToday(o.order_datetime)).length}件`}
        />
        <SummaryCard
          label="未出力"
          value={`${unexportedCount}件`}
          highlight={unexportedCount > 0}
        />
      </div>

      {/* 受注テーブル */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="text-sm text-red-600 p-6">{error}</p>
          ) : loading ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm">読み込み中...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {orders.length === 0 ? (
                <>
                  <p className="text-lg mb-2">まだ受注データがありません</p>
                  <p className="text-sm mb-4">
                    「新規受注」ボタンから最初の注文を登録しましょう
                  </p>
                  <Button asChild>
                    <Link href="/orders/new">
                      <Plus className="mr-2 h-4 w-4" />
                      新規受注を作成
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-base mb-2">
                    条件に一致する受注がありません
                  </p>
                  <p className="text-sm">
                    フィルター条件を変更してみてください
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      受注番号
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      受注日時
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      注文者
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      支払方法
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-right">
                      合計金額
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      担当者
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      状態
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatDateTime(order.order_datetime)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {order.customer_name}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentBadge method={order.payment_method} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        ¥{order.total_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {order.operator_name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- ヘルパーコンポーネント ---

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "bg-amber-50 border-amber-200" : "bg-white"
      }`}
    >
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${
          highlight ? "text-amber-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function PaymentBadge({ method }: { method: string }) {
  const colorMap: Record<string, string> = {
    代金引換: "bg-amber-100 text-amber-800",
    クレジットカード: "bg-blue-100 text-blue-800",
    銀行振込: "bg-green-100 text-green-800",
    後払い: "bg-purple-100 text-purple-800",
  };
  const color = colorMap[method] || "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}
    >
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "CSV出力済み") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
        出力済み
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
      未出力
    </span>
  );
}

function formatDateTime(datetime: string) {
  return new Date(datetime).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(datetime: string) {
  const d = new Date(datetime);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
