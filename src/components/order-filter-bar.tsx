"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, SlidersHorizontal, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrderFilters {
  quickFilter: string;
  searchQuery: string;
  operatorName: string;
  paymentMethod: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const INITIAL_FILTERS: OrderFilters = {
  quickFilter: "all",
  searchQuery: "",
  operatorName: "",
  paymentMethod: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

interface OrderFilterBarProps {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  operators: string[];
  totalCount: number;
  filteredCount: number;
}

export function OrderFilterBar({
  filters,
  onFiltersChange,
  operators,
  totalCount,
  filteredCount,
}: OrderFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateFilter = useCallback(
    (key: keyof OrderFilters, value: string) => {
      const updated = { ...filters, [key]: value };
      if (key === "quickFilter" && value !== "custom") {
        updated.dateFrom = "";
        updated.dateTo = "";
      }
      if (key === "dateFrom" || key === "dateTo") {
        updated.quickFilter = "custom";
      }
      onFiltersChange(updated);
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange(INITIAL_FILTERS);
    setShowAdvanced(false);
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.quickFilter !== "all" ||
    filters.searchQuery !== "" ||
    filters.operatorName !== "" ||
    filters.paymentMethod !== "" ||
    filters.status !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const quickFilters = [
    { value: "all", label: "すべて" },
    { value: "today", label: "本日" },
    { value: "week", label: "直近7日" },
    { value: "month", label: "今月" },
  ];

  const paymentMethods = ["代金引換", "クレジットカード", "銀行振込", "後払い"];

  return (
    <div className="space-y-3">
      {/* 上段: クイックフィルター + 検索 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* クイックフィルター */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {quickFilters.map((qf) => (
            <button
              key={qf.value}
              onClick={() => updateFilter("quickFilter", qf.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                filters.quickFilter === qf.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* ステータスフィルター */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { value: "", label: "全ステータス" },
            { value: "未出力", label: "未出力" },
            { value: "CSV出力済み", label: "出力済み" },
          ].map((sf) => (
            <button
              key={sf.value}
              onClick={() => updateFilter("status", sf.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                filters.status === sf.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* 検索ボックス */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="注文者名・受注番号で検索..."
            value={filters.searchQuery}
            onChange={(e) => updateFilter("searchQuery", e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {filters.searchQuery && (
            <button
              onClick={() => updateFilter("searchQuery", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* 詳細フィルタートグル */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "gap-1.5 text-xs",
            showAdvanced && "bg-blue-50 border-blue-200 text-blue-700"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          詳細
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            クリア
          </Button>
        )}
      </div>

      {/* 下段: 詳細フィルター */}
      {showAdvanced && (
        <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg border">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">担当者</label>
            <Select
              value={filters.operatorName || "all"}
              onValueChange={(v) =>
                updateFilter("operatorName", v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              支払方法
            </label>
            <Select
              value={filters.paymentMethod || "all"}
              onValueChange={(v) =>
                updateFilter("paymentMethod", v === "all" ? "" : v)
              }
            >
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm} value={pm}>
                    {pm}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              期間指定
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter("dateFrom", e.target.value)}
                className="h-9 text-sm w-36"
              />
              <span className="text-gray-400 text-sm">〜</span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter("dateTo", e.target.value)}
                className="h-9 text-sm w-36"
              />
            </div>
          </div>
        </div>
      )}

      {/* 件数表示 */}
      {hasActiveFilters && (
        <p className="text-xs text-gray-500">
          {totalCount}件中{" "}
          <span className="font-medium text-gray-700">{filteredCount}件</span>{" "}
          を表示
        </p>
      )}
    </div>
  );
}

// フィルタリングロジック
export function applyFilters(
  orders: any[],
  filters: OrderFilters
): any[] {
  let result = [...orders];

  // クイックフィルター（日付）
  if (filters.quickFilter !== "all" && filters.quickFilter !== "custom") {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    if (filters.quickFilter === "today") {
      result = result.filter(
        (o) => new Date(o.order_datetime) >= todayStart
      );
    } else if (filters.quickFilter === "week") {
      const weekAgo = new Date(todayStart);
      weekAgo.setDate(weekAgo.getDate() - 7);
      result = result.filter((o) => new Date(o.order_datetime) >= weekAgo);
    } else if (filters.quickFilter === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      result = result.filter(
        (o) => new Date(o.order_datetime) >= monthStart
      );
    }
  }

  // 日付範囲
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    result = result.filter((o) => new Date(o.order_datetime) >= from);
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setDate(to.getDate() + 1);
    result = result.filter((o) => new Date(o.order_datetime) < to);
  }

  // テキスト検索
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    result = result.filter(
      (o) =>
        o.customer_name?.toLowerCase().includes(q) ||
        o.order_number?.toLowerCase().includes(q)
    );
  }

  // 担当者
  if (filters.operatorName) {
    result = result.filter((o) => o.operator_name === filters.operatorName);
  }

  // 支払方法
  if (filters.paymentMethod) {
    result = result.filter((o) => o.payment_method === filters.paymentMethod);
  }

  // ステータス
  if (filters.status) {
    result = result.filter((o) => o.status === filters.status);
  }

  return result;
}

export { INITIAL_FILTERS };
