"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { CustomerSection } from "./customer-section";
import { ProductSearch } from "./product-search";
import { DetailItem, type DetailValues } from "./detail-item";
import { OrderSummary } from "./order-summary";
import {
  calculateOrderTotal,
  type DetailForCalc,
} from "@/lib/calc/order-total";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/calc/payment-fee";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface AppSettings {
  defaultShippingFee: number;
  freeShippingThreshold: number;
  earlyPriceDeadline: string;
}

function createEmptyDetail(): DetailValues {
  return {
    product_code: "",
    product_name: "",
    unit_price: 0,
    quantity: 1,
    is_free_shipping: false,
    noshi_available: false,
    wrapping_available: false,
    delivery_name: "",
    delivery_name_kana: "",
    delivery_phone: "",
    delivery_postal_code: "",
    delivery_prefecture: "",
    delivery_address1: "",
    delivery_address2: "",
    delivery_company: "",
    delivery_department: "",
    delivery_date: "",
    delivery_time: "",
    delivery_method: "",
    delivery_memo: "",
    noshi_type: "なし",
    noshi_position: "内のし",
    noshi_inscription: "御歳暮",
    noshi_inscription_custom: "",
    noshi_name: "",
    wrapping_type: "なし",
    message_card: "",
    line_memo: "",
  };
}

interface OrderFormProps {
  operatorName: string;
  operatorEmail: string;
  settings: AppSettings;
}

export function OrderForm({
  operatorName,
  operatorEmail,
  settings,
}: OrderFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  // 注文者情報
  const [customer, setCustomer] = useState({
    customer_code: "",
    customer_name: "",
    customer_name_kana: "",
    postal_code: "",
    prefecture: "",
    customer_address1: "",
    customer_address2: "",
    customer_company: "",
    customer_department: "",
    customer_phone: "",
    customer_email: "",
  });

  // 支払方法・値引き・メモ
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("代金引換");
  const [discount, setDiscount] = useState(0);
  const [orderMemo, setOrderMemo] = useState("");

  // 明細
  const [details, setDetails] = useState<DetailValues[]>([]);

  // 早割判定
  const isEarlyPrice = useMemo(() => {
    const deadline = new Date(settings.earlyPriceDeadline);
    return new Date() <= deadline;
  }, [settings.earlyPriceDeadline]);

  // 注文者フィールド変更
  const handleCustomerChange = useCallback(
    (field: string, value: string) => {
      setCustomer((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  // 商品選択時
  const handleProductSelect = useCallback(
    (product: Product) => {
      const unitPrice =
        isEarlyPrice && product.early_price
          ? product.early_price
          : product.regular_price;

      const newDetail: DetailValues = {
        ...createEmptyDetail(),
        product_code: product.code,
        product_name: product.name,
        unit_price: unitPrice,
        is_free_shipping: product.is_free_shipping,
        noshi_available: product.noshi_available,
        wrapping_available: product.wrapping_available,
      };
      setDetails((prev) => [...prev, newDetail]);
    },
    [isEarlyPrice]
  );

  // 明細フィールド変更
  const handleDetailChange = useCallback(
    (index: number, field: string, value: string | number) => {
      setDetails((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
      const errorKey = `detail_${index}_${field}`;
      if (errors[errorKey]) {
        setErrors((prev) => ({ ...prev, [errorKey]: undefined }));
      }
    },
    [errors]
  );

  // 明細削除
  const handleDetailRemove = useCallback((index: number) => {
    setDetails((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 注文者情報→お届け先コピー
  const handleCopyDeliveryFromOrder = useCallback(
    (index: number) => {
      setDetails((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          delivery_name: customer.customer_name,
          delivery_name_kana: customer.customer_name_kana,
          delivery_phone: customer.customer_phone,
          delivery_postal_code: customer.postal_code,
          delivery_prefecture: customer.prefecture,
          delivery_address1: customer.customer_address1,
          delivery_address2: customer.customer_address2,
          delivery_company: customer.customer_company,
          delivery_department: customer.customer_department,
        };
        return updated;
      });
    },
    [customer]
  );

  // 金額計算（リアルタイム）
  const calcResult = useMemo(() => {
    if (details.length === 0) {
      return {
        lineTotals: [],
        shippingFees: [],
        wrappingFees: [],
        subtotal: 0,
        totalShippingFee: 0,
        totalWrappingFee: 0,
        totalFee: 0,
        totalAmount: 0,
        paymentFeeError: undefined,
      };
    }

    const detailsForCalc: DetailForCalc[] = details.map((d, i) => ({
      lineIndex: i,
      unitPrice: d.unit_price,
      quantity: d.quantity,
      deliveryPostalCode: d.delivery_postal_code,
      deliveryAddress1: d.delivery_address1,
      deliveryName: d.delivery_name,
      isFreeShipping: d.is_free_shipping,
      noshiType: d.noshi_type === "なし" ? null : d.noshi_type,
      wrappingType: d.wrapping_type === "なし" ? null : d.wrapping_type,
    }));

    return calculateOrderTotal(
      detailsForCalc,
      paymentMethod,
      discount,
      settings.defaultShippingFee,
      settings.freeShippingThreshold
    );
  }, [details, paymentMethod, discount, settings]);

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string | undefined> = {};
    const errorMessages: string[] = [];

    if (!customer.customer_name) {
      newErrors.customer_name = "注文者氏名を入力してください";
      errorMessages.push("注文者氏名が未入力です");
    }
    if (!customer.postal_code) {
      newErrors.postal_code = "郵便番号を入力してください";
      errorMessages.push("注文者の郵便番号が未入力です");
    } else if (!/^\d{7}$/.test(customer.postal_code)) {
      newErrors.postal_code = "7桁の数字で入力してください";
      errorMessages.push("注文者の郵便番号が不正です");
    }
    if (!customer.prefecture) {
      newErrors.prefecture = "都道府県を入力してください";
      errorMessages.push("注文者の都道府県が未入力です");
    }
    if (!customer.customer_address1) {
      newErrors.customer_address1 = "住所を入力してください";
      errorMessages.push("注文者の住所が未入力です");
    }

    if (
      paymentMethod === "クレジットカード" &&
      customer.customer_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.customer_email)
    ) {
      newErrors.customer_email = "メールアドレスの形式が正しくありません";
      errorMessages.push("メールアドレスの形式が不正です");
    }

    if (details.length === 0) {
      newErrors.details = "1つ以上の商品を追加してください";
      errorMessages.push("商品が追加されていません");
    }

    details.forEach((d, i) => {
      const lineNum = i + 1;
      if (!d.delivery_name) {
        newErrors[`detail_${i}_delivery_name`] = "お届け先氏名を入力してください";
        errorMessages.push(`明細#${lineNum}: お届け先氏名が未入力です`);
      }
      if (!d.delivery_postal_code) {
        newErrors[`detail_${i}_delivery_postal_code`] = "お届け先郵便番号を入力してください";
        errorMessages.push(`明細#${lineNum}: お届け先郵便番号が未入力です`);
      } else if (!/^\d{7}$/.test(d.delivery_postal_code)) {
        newErrors[`detail_${i}_delivery_postal_code`] = "7桁の数字で入力してください";
        errorMessages.push(`明細#${lineNum}: お届け先郵便番号が不正です`);
      }
      if (!d.delivery_prefecture) {
        newErrors[`detail_${i}_delivery_prefecture`] = "都道府県を入力してください";
        errorMessages.push(`明細#${lineNum}: お届け先都道府県が未入力です`);
      }
      if (!d.delivery_address1) {
        newErrors[`detail_${i}_delivery_address1`] = "お届け先住所を入力してください";
        errorMessages.push(`明細#${lineNum}: お届け先住所が未入力です`);
      }
      if (d.quantity < 1) {
        newErrors[`detail_${i}_quantity`] = "1以上の数量を入力してください";
        errorMessages.push(`明細#${lineNum}: 数量が不正です`);
      }
    });

    if (calcResult.paymentFeeError) {
      newErrors.payment = calcResult.paymentFeeError;
      errorMessages.push(calcResult.paymentFeeError);
    }

    setErrors(newErrors);

    if (errorMessages.length > 0) {
      const displayMessages = errorMessages.slice(0, 5);
      const remaining = errorMessages.length - displayMessages.length;
      toast.error(
        <div className="space-y-1">
          <p className="font-semibold">入力内容にエラーがあります</p>
          {displayMessages.map((msg, i) => (
            <p key={i} className="text-sm">・{msg}</p>
          ))}
          {remaining > 0 && (
            <p className="text-sm text-gray-400">他{remaining}件のエラー</p>
          )}
        </div>
      );

      setTimeout(() => {
        const firstError = document.querySelector(".border-red-500, [data-error='true']");
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }

    return errorMessages.length === 0;
  };

  // 保存
  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        operator_name: operatorName,
        operator_email: operatorEmail,
        ...customer,
        payment_method: paymentMethod,
        discount,
        order_memo: orderMemo || null,
        details: details.map((d, i) => ({
          line_number: i + 1,
          product_code: d.product_code,
          product_name: d.product_name,
          unit_price: d.unit_price,
          quantity: d.quantity,
          delivery_name: d.delivery_name,
          delivery_name_kana: d.delivery_name_kana || null,
          delivery_phone: d.delivery_phone || null,
          delivery_postal_code: d.delivery_postal_code,
          delivery_prefecture: d.delivery_prefecture,
          delivery_address1: d.delivery_address1,
          delivery_address2: d.delivery_address2 || null,
          delivery_company: d.delivery_company || null,
          delivery_department: d.delivery_department || null,
          delivery_date: d.delivery_date || null,
          delivery_time: d.delivery_time || null,
          delivery_method: d.delivery_method || null,
          delivery_memo: d.delivery_memo || null,
          noshi_type: d.noshi_type === "なし" ? null : d.noshi_type,
          noshi_position:
            d.noshi_type === "なし" ? null : d.noshi_position || null,
          noshi_inscription:
            d.noshi_type === "なし" ? null : d.noshi_inscription || null,
          noshi_inscription_custom:
            d.noshi_inscription === "その他"
              ? d.noshi_inscription_custom || null
              : null,
          noshi_name: d.noshi_type === "なし" ? null : d.noshi_name || null,
          wrapping_type: d.wrapping_type === "なし" ? null : d.wrapping_type,
          message_card: d.message_card || null,
          line_memo: d.line_memo || null,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.details) {
          const serverErrors: string[] = [];
          for (const [field, messages] of Object.entries(err.details)) {
            if (Array.isArray(messages)) {
              serverErrors.push(`${field}: ${messages.join(", ")}`);
            }
          }
          if (serverErrors.length > 0) {
            throw new Error(`サーバーバリデーションエラー\n${serverErrors.join("\n")}`);
          }
        }
        throw new Error(err.error || "保存に失敗しました");
      }

      const data = await res.json();
      toast.success(`受注 ${data.order_number} を登録しました`);
      router.push(`/orders/${data.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "保存に失敗しました";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-6">
      {/* 左: フォーム */}
      <div className="flex-1 space-y-6">
        {/* ① 注文者情報 */}
        <Card>
          <CardContent className="pt-6">
            <CustomerSection
              values={customer}
              onChange={handleCustomerChange}
              errors={errors}
            />
          </CardContent>
        </Card>

        {/* ② 商品明細 */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">商品明細</h2>
            {isEarlyPrice && (
              <div className="p-2 text-sm text-amber-700 bg-amber-50 rounded-md">
                🏷️ 早割期間中です。早割価格が自動適用されます。
              </div>
            )}
            <div>
              <Label>商品を追加</Label>
              <ProductSearch onSelect={handleProductSelect} />
            </div>
            {errors.details && (
              <p className="text-sm text-red-500">{errors.details}</p>
            )}
          </CardContent>
        </Card>

        {/* 明細一覧 */}
        <div className="space-y-4">
          {details.map((detail, index) => (
            <DetailItem
              key={index}
              index={index}
              values={detail}
              lineTotal={calcResult.lineTotals[index] ?? 0}
              wrappingFee={calcResult.wrappingFees[index] ?? 0}
              shippingFee={calcResult.shippingFees[index] ?? 0}
              errors={errors}
              onChange={handleDetailChange}
              onRemove={handleDetailRemove}
              onCopyDeliveryFromOrder={handleCopyDeliveryFromOrder}
            />
          ))}
        </div>

        {/* ③ 支払方法・値引き（商品確定後に入力） */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">
              支払・値引き
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>
                  支払方法 <span className="text-red-500">*</span>
                </Label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {errors.payment && (
                  <p className="text-xs text-red-500 mt-1">{errors.payment}</p>
                )}
              </div>
              <div>
                <Label>値引き（円）</Label>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) =>
                    setDiscount(parseInt(e.target.value) || 0)
                  }
                  className="font-mono"
                />
              </div>
              <div>
                <Label>受注メモ</Label>
                <Input
                  value={orderMemo}
                  onChange={(e) => setOrderMemo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 保存ボタン */}
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" onClick={() => router.push("/")}>
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || details.length === 0}
            className="min-w-32"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                受注を登録
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 右: サマリー */}
      <div className="w-72 hidden lg:block">
        <OrderSummary
          subtotal={calcResult.subtotal}
          totalShippingFee={calcResult.totalShippingFee}
          totalWrappingFee={calcResult.totalWrappingFee}
          totalFee={calcResult.totalFee}
          discount={discount}
          totalAmount={calcResult.totalAmount}
          paymentMethod={paymentMethod}
          paymentFeeError={calcResult.paymentFeeError}
          detailCount={details.length}
        />
      </div>
    </div>
  );
}
