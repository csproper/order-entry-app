"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { fetchAddressFromPostalCode } from "@/lib/postal-code";

export interface DetailValues {
  _key: string; // ユニークキー（React key用、DBには保存しない）
  product_code: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  is_free_shipping: boolean;
  noshi_available: boolean;
  wrapping_available: boolean;
  delivery_name: string;
  delivery_name_kana: string;
  delivery_phone: string;
  delivery_postal_code: string;
  delivery_prefecture: string;
  delivery_address1: string;
  delivery_address2: string;
  delivery_company: string;
  delivery_department: string;
  delivery_date: string;
  delivery_time: string;
  delivery_method: string;
  delivery_memo: string;
  noshi_type: string;
  noshi_position: string;
  noshi_inscription: string;
  noshi_inscription_custom: string;
  noshi_name: string;
  wrapping_type: string;
  message_card: string;
  line_memo: string;
}

interface DetailItemProps {
  index: number;
  values: DetailValues;
  lineTotal: number;
  wrappingFee: number;
  shippingFee: number;
  errors: Record<string, string | undefined>;
  onChange: (index: number, field: string, value: string | number) => void;
  onRemove: (index: number) => void;
  onCopyDeliveryFromOrder: (index: number) => void;
}

const DELIVERY_TIMES = [
  "",
  "午前中",
  "14時〜16時",
  "16時〜18時",
  "18時〜20時",
  "19時〜21時",
];

const NOSHI_TYPES = ["なし", "シールのし", "通常のし"];
const NOSHI_POSITIONS = ["内のし", "外のし"];
const NOSHI_INSCRIPTIONS = ["御歳暮", "御年賀", "御供", "その他"];
const WRAPPING_TYPES = ["なし", "簡易包装", "フル包装"];

export function DetailItem({
  index,
  values,
  lineTotal,
  wrappingFee,
  shippingFee,
  errors,
  onChange,
  onRemove,
  onCopyDeliveryFromOrder,
}: DetailItemProps) {
  const [postalLoading, setPostalLoading] = useState(false);

  const getError = (field: string) => errors[`detail_${index}_${field}`];
  const hasAnyError = Object.keys(errors).some(
    (k) => k.startsWith(`detail_${index}_`) && errors[k]
  );

  const handlePostalCodeChange = async (postalCode: string) => {
    onChange(index, "delivery_postal_code", postalCode);
    if (/^\d{7}$/.test(postalCode)) {
      setPostalLoading(true);
      const address = await fetchAddressFromPostalCode(postalCode);
      if (address) {
        onChange(index, "delivery_prefecture", address.prefecture);
        onChange(index, "delivery_address1", address.fullAddress);
      }
      setPostalLoading(false);
    }
  };

  // のし表書きが「御供」のときはシールのし不可
  const isOsonaeSelected = values.noshi_inscription === "御供";
  const effectiveNoshiType =
    isOsonaeSelected && values.noshi_type === "シールのし"
      ? "通常のし"
      : values.noshi_type;
  if (effectiveNoshiType !== values.noshi_type) {
    onChange(index, "noshi_type", effectiveNoshiType);
  }

  return (
    <div
      className={`border rounded-lg p-4 space-y-4 bg-white ${
        hasAnyError ? "border-red-400 ring-1 ring-red-200" : ""
      }`}
      data-error={hasAnyError ? "true" : undefined}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-500">
            明細 #{index + 1}
          </span>
          <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">
            {values.product_code}
          </span>
          <span className="text-sm font-medium">{values.product_name}</span>
          {hasAnyError && (
            <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded">
              入力エラーあり
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono font-semibold">
            ¥{lineTotal.toLocaleString()}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 数量・単価 */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">単価</Label>
          <Input
            type="number"
            value={values.unit_price}
            onChange={(e) =>
              onChange(index, "unit_price", parseInt(e.target.value) || 0)
            }
            className="font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">数量</Label>
          <Input
            type="number"
            min={1}
            value={values.quantity}
            onChange={(e) =>
              onChange(index, "quantity", parseInt(e.target.value) || 1)
            }
            className={getError("quantity") ? "border-red-500" : ""}
          />
          {getError("quantity") && (
            <p className="text-xs text-red-500 mt-1">{getError("quantity")}</p>
          )}
        </div>
        <div>
          <Label className="text-xs">小計</Label>
          <div className="h-9 flex items-center font-mono text-sm">
            ¥{lineTotal.toLocaleString()}
          </div>
        </div>
      </div>

      {/* お届け先 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">お届け先</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCopyDeliveryFromOrder(index)}
            className="text-xs h-7"
          >
            注文者情報をコピー
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">
              お届け先氏名 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={values.delivery_name}
              onChange={(e) =>
                onChange(index, "delivery_name", e.target.value)
              }
              placeholder="山田太郎"
              className={getError("delivery_name") ? "border-red-500" : ""}
            />
            {getError("delivery_name") && (
              <p className="text-xs text-red-500 mt-1">
                {getError("delivery_name")}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">お届け先氏名カナ</Label>
            <Input
              value={values.delivery_name_kana}
              onChange={(e) =>
                onChange(index, "delivery_name_kana", e.target.value)
              }
            />
          </div>
          <div>
            <Label className="text-xs">
              郵便番号 <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                value={values.delivery_postal_code}
                onChange={(e) =>
                  handlePostalCodeChange(e.target.value.replace(/\D/g, ""))
                }
                placeholder="1000001"
                maxLength={7}
                className={
                  getError("delivery_postal_code") ? "border-red-500" : ""
                }
              />
              {postalLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  検索中...
                </span>
              )}
            </div>
            {getError("delivery_postal_code") && (
              <p className="text-xs text-red-500 mt-1">
                {getError("delivery_postal_code")}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">
              都道府県 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={values.delivery_prefecture}
              onChange={(e) =>
                onChange(index, "delivery_prefecture", e.target.value)
              }
              className={
                getError("delivery_prefecture") ? "border-red-500" : ""
              }
            />
            {getError("delivery_prefecture") && (
              <p className="text-xs text-red-500 mt-1">
                {getError("delivery_prefecture")}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">
              住所１ <span className="text-red-500">*</span>
            </Label>
            <Input
              value={values.delivery_address1}
              onChange={(e) =>
                onChange(index, "delivery_address1", e.target.value)
              }
              className={
                getError("delivery_address1") ? "border-red-500" : ""
              }
            />
            {getError("delivery_address1") && (
              <p className="text-xs text-red-500 mt-1">
                {getError("delivery_address1")}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">住所２</Label>
            <Input
              value={values.delivery_address2}
              onChange={(e) =>
                onChange(index, "delivery_address2", e.target.value)
              }
            />
          </div>
          <div>
            <Label className="text-xs">会社名</Label>
            <Input
              value={values.delivery_company}
              onChange={(e) =>
                onChange(index, "delivery_company", e.target.value)
              }
            />
          </div>
          <div>
            <Label className="text-xs">電話番号</Label>
            <Input
              value={values.delivery_phone}
              onChange={(e) =>
                onChange(index, "delivery_phone", e.target.value)
              }
            />
          </div>
        </div>
      </div>

      {/* 配送設定 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">お届け日</Label>
          <Input
            type="date"
            value={values.delivery_date}
            onChange={(e) =>
              onChange(index, "delivery_date", e.target.value)
            }
          />
        </div>
        <div>
          <Label className="text-xs">配達時間帯</Label>
          <select
            value={values.delivery_time}
            onChange={(e) =>
              onChange(index, "delivery_time", e.target.value)
            }
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {DELIVERY_TIMES.map((t) => (
              <option key={t} value={t}>
                {t || "指定なし"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">
            送料{" "}
            {values.is_free_shipping && (
              <span className="text-green-600">（送料無料商品）</span>
            )}
          </Label>
          <div className="h-9 flex items-center font-mono text-sm">
            ¥{shippingFee.toLocaleString()}
          </div>
        </div>
      </div>

      {/* のし・ラッピング */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">のし・ラッピング</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">のし</Label>
            <select
              value={values.noshi_type}
              onChange={(e) =>
                onChange(index, "noshi_type", e.target.value)
              }
              disabled={!values.noshi_available}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50"
            >
              {NOSHI_TYPES.filter(
                (t) => !(isOsonaeSelected && t === "シールのし")
              ).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {!values.noshi_available && (
              <p className="text-xs text-gray-400 mt-1">のし対応不可</p>
            )}
          </div>
          {values.noshi_type !== "なし" && (
            <>
              <div>
                <Label className="text-xs">のし位置</Label>
                <select
                  value={values.noshi_position}
                  onChange={(e) =>
                    onChange(index, "noshi_position", e.target.value)
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {NOSHI_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">表書き</Label>
                <select
                  value={values.noshi_inscription}
                  onChange={(e) =>
                    onChange(index, "noshi_inscription", e.target.value)
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {NOSHI_INSCRIPTIONS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              {values.noshi_inscription === "その他" && (
                <div className="md:col-span-3">
                  <Label className="text-xs">表書き（自由入力）</Label>
                  <Input
                    value={values.noshi_inscription_custom}
                    onChange={(e) =>
                      onChange(
                        index,
                        "noshi_inscription_custom",
                        e.target.value
                      )
                    }
                  />
                </div>
              )}
              <div className="md:col-span-3">
                <Label className="text-xs">のし名入れ</Label>
                <Input
                  value={values.noshi_name}
                  onChange={(e) =>
                    onChange(index, "noshi_name", e.target.value)
                  }
                  placeholder="例: 山田"
                />
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">ラッピング</Label>
            <select
              value={values.wrapping_type}
              onChange={(e) =>
                onChange(index, "wrapping_type", e.target.value)
              }
              disabled={!values.wrapping_available}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:opacity-50"
            >
              {WRAPPING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {!values.wrapping_available && (
              <p className="text-xs text-gray-400 mt-1">ラッピング対応不可</p>
            )}
          </div>
          <div>
            <Label className="text-xs">ラッピング料</Label>
            <div className="h-9 flex items-center font-mono text-sm">
              ¥{wrappingFee.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* メモ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">配送メモ</Label>
          <Input
            value={values.delivery_memo}
            onChange={(e) =>
              onChange(index, "delivery_memo", e.target.value)
            }
          />
        </div>
        <div>
          <Label className="text-xs">明細メモ</Label>
          <Input
            value={values.line_memo}
            onChange={(e) => onChange(index, "line_memo", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
