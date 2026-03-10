"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { fetchAddressFromPostalCode } from "@/lib/postal-code";
import { searchPostalCodeViaProxy } from "@/lib/postal-code-reverse";
import { Button } from "@/components/ui/button";
import { Search, Loader2, User, Phone } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

interface CustomerSectionProps {
  values: {
    customer_code: string;
    customer_name: string;
    customer_name_kana: string;
    postal_code: string;
    prefecture: string;
    customer_address1: string;
    customer_address2: string;
    customer_company: string;
    customer_department: string;
    customer_phone: string;
    customer_email: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string | undefined>;
}

export function CustomerSection({
  values,
  onChange,
  errors,
}: CustomerSectionProps) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [postalLoading, setPostalLoading] = useState(false);
  const [reverseSearching, setReverseSearching] = useState(false);
  const [phoneSearching, setPhoneSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());
  const searchIdRef = useRef(0);

  const searchCustomers = useCallback(async (q: string) => {
    const id = ++searchIdRef.current;

    if (q.length < 1) {
      setCustomerResults([]);
      setIsCustomerOpen(false);
      return;
    }

    try {
      const { data, error } = await supabaseRef.current
        .from("customers")
        .select("*")
        .eq("is_active", true)
        .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
        .order("code")
        .limit(20);

      if (id !== searchIdRef.current) return;

      if (!error && data) {
        setCustomerResults(data);
        setIsCustomerOpen(true);
      }
    } catch {
      if (id === searchIdRef.current) {
        setCustomerResults([]);
      }
    }
  }, []);

  useEffect(() => {
    if (customerQuery.length < 1) {
      setCustomerResults([]);
      setIsCustomerOpen(false);
      return;
    }
    const timer = setTimeout(() => searchCustomers(customerQuery), 150);
    return () => clearTimeout(timer);
  }, [customerQuery, searchCustomers]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsCustomerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCustomerSelect = (customer: Customer) => {
    onChange("customer_code", customer.code);
    onChange("customer_name", customer.name);
    onChange("postal_code", customer.postal_code);
    onChange("prefecture", customer.prefecture);
    onChange("customer_address1", customer.address1);
    onChange("customer_phone", customer.phone || "");
    onChange("customer_email", customer.email || "");
    setCustomerQuery(customer.code);
    setIsCustomerOpen(false);
  };

  const handlePostalCodeChange = async (postalCode: string) => {
    onChange("postal_code", postalCode);
    if (/^\d{7}$/.test(postalCode)) {
      setPostalLoading(true);
      const address = await fetchAddressFromPostalCode(postalCode);
      if (address) {
        onChange("prefecture", address.prefecture);
        onChange("customer_address1", address.fullAddress);
      }
      setPostalLoading(false);
    }
  };

  const handleReversePostalCodeSearch = async () => {
    if (!values.prefecture || !values.customer_address1) {
      toast.error("都道府県と住所１を入力してください");
      return;
    }

    setReverseSearching(true);
    try {
      const postalCode = await searchPostalCodeViaProxy(
        values.prefecture,
        values.customer_address1
      );
      
      if (postalCode) {
        onChange("postal_code", postalCode);
        toast.success("郵便番号を取得しました");
      } else {
        toast.error("該当する郵便番号が見つかりませんでした");
      }
    } catch (error) {
      toast.error("郵便番号の検索に失敗しました");
    } finally {
      setReverseSearching(false);
    }
  };

  const handlePhoneSearch = async () => {
    if (!values.customer_phone) {
      toast.error("電話番号を入力してください");
      return;
    }

    setPhoneSearching(true);
    try {
      const response = await fetch(`/api/customers/search-by-phone?phone=${encodeURIComponent(values.customer_phone)}`);
      const data = await response.json();
      
      if (data.delivery) {
        // 配送履歴から自動入力
        onChange("customer_code", data.delivery.customer_code || "");
        onChange("customer_name", data.delivery.delivery_name);
        onChange("postal_code", data.delivery.delivery_postal_code || "");
        onChange("prefecture", data.delivery.delivery_prefecture || "");
        onChange("customer_address1", data.delivery.delivery_address || "");
        // customer_code がある場合は顧客検索欄にも反映
        if (data.delivery.customer_code) {
          setCustomerQuery(data.delivery.customer_code);
        }
        toast.success("過去の配送履歴から情報を取得しました");
      } else {
        toast.info("該当する配送履歴が見つかりませんでした");
      }
    } catch (error) {
      toast.error("配送履歴の検索に失敗しました");
    } finally {
      setPhoneSearching(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
        <User className="h-5 w-5" />
        注文者情報
      </h2>

      {/* 顧客検索 */}
      <div ref={containerRef} className="relative max-w-sm">
        <Label>統合顧客番号</Label>
        <Input
          type="text"
          placeholder="顧客番号または氏名で検索..."
          value={customerQuery || values.customer_code}
          onChange={(e) => {
            setCustomerQuery(e.target.value);
            onChange("customer_code", e.target.value);
          }}
          onFocus={() =>
            customerQuery.length >= 1 &&
            customerResults.length > 0 &&
            setIsCustomerOpen(true)
          }
        />
        {isCustomerOpen && customerResults.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {customerResults.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                onClick={() => handleCustomerSelect(c)}
              >
                <span className="font-mono text-gray-500 mr-2">
                  {c.code}
                </span>
                <span>{c.name}</span>
                <span className="text-gray-400 ml-2 text-xs">
                  {c.prefecture}
                  {c.address1}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 氏名 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>
            注文者氏名 <span className="text-red-500">*</span>
          </Label>
          <Input
            value={values.customer_name}
            onChange={(e) => onChange("customer_name", e.target.value)}
            className={errors.customer_name ? "border-red-500" : ""}
          />
          {errors.customer_name && (
            <p className="text-xs text-red-500 mt-1">{errors.customer_name}</p>
          )}
        </div>
        <div>
          <Label>注文者氏名カナ</Label>
          <Input
            value={values.customer_name_kana}
            onChange={(e) => onChange("customer_name_kana", e.target.value)}
          />
        </div>
      </div>

      {/* 会社・部署 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>会社名</Label>
          <Input
            value={values.customer_company}
            onChange={(e) => onChange("customer_company", e.target.value)}
          />
        </div>
        <div>
          <Label>部署名</Label>
          <Input
            value={values.customer_department}
            onChange={(e) => onChange("customer_department", e.target.value)}
          />
        </div>
      </div>

      {/* 連絡先 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>電話番号</Label>
          <div className="flex gap-2">
            <Input
              value={values.customer_phone}
              onChange={(e) => onChange("customer_phone", e.target.value)}
              placeholder="090-1234-5678"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handlePhoneSearch}
              disabled={phoneSearching || !values.customer_phone}
              title="電話番号で配送履歴を検索"
            >
              {phoneSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <div>
          <Label>メールアドレス</Label>
          <Input
            type="email"
            value={values.customer_email}
            onChange={(e) => onChange("customer_email", e.target.value)}
            className={errors.customer_email ? "border-red-500" : ""}
          />
          {errors.customer_email && (
            <p className="text-xs text-red-500 mt-1">
              {errors.customer_email}
            </p>
          )}
        </div>
      </div>

      {/* 住所 */}
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReversePostalCodeSearch}
            disabled={reverseSearching || !values.prefecture || !values.customer_address1}
            className="text-xs"
          >
            {reverseSearching ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                検索中
              </>
            ) : (
              <>
                <Search className="mr-1 h-3 w-3" />
                住所から郵便番号を入力
              </>
            )}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label>
            郵便番号 <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              value={values.postal_code}
              onChange={(e) =>
                handlePostalCodeChange(e.target.value.replace(/\D/g, "").slice(0, 7))
              }
              onPaste={(e) => {
                e.preventDefault();
                const pastedText = e.clipboardData.getData('text');
                const cleanedText = pastedText.replace(/\D/g, '').slice(0, 7);
                handlePostalCodeChange(cleanedText);
              }}
              placeholder="1000001"
              maxLength={7}
              className={errors.postal_code ? "border-red-500" : ""}
            />
            {postalLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                検索中...
              </span>
            )}
          </div>
          {errors.postal_code && (
            <p className="text-xs text-red-500 mt-1">{errors.postal_code}</p>
          )}
        </div>
        <div>
          <Label>
            都道府県 <span className="text-red-500">*</span>
          </Label>
          <Input
            value={values.prefecture}
            onChange={(e) => onChange("prefecture", e.target.value)}
            className={errors.prefecture ? "border-red-500" : ""}
          />
        </div>
        <div className="md:col-span-2">
          <Label>
            住所１ <span className="text-red-500">*</span>
          </Label>
          <Input
            value={values.customer_address1}
            onChange={(e) => onChange("customer_address1", e.target.value)}
            className={errors.customer_address1 ? "border-red-500" : ""}
          />
          {errors.customer_address1 && (
            <p className="text-xs text-red-500 mt-1">
              {errors.customer_address1}
            </p>
          )}
        </div>
      </div>
      </div>
      <div>
        <Label>住所２（建物名・部屋番号）</Label>
        <Input
          value={values.customer_address2}
          onChange={(e) => onChange("customer_address2", e.target.value)}
        />
      </div>
    </div>
  );
}
