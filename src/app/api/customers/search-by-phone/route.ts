import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // レート制限チェック
  const rateLimit = await checkRateLimit(request, "customers:search-phone", 20, "minute");
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。" },
      { status: 429 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const phone = searchParams.get("phone") || "";

  if (phone.length < 1) {
    return NextResponse.json({ delivery: null });
  }

  // 電話番号で検索（ハイフンあり・なし両対応）
  const normalizedPhone = phone.replace(/[-\s]/g, "");
  
  // ハイフン付きパターンを生成（例: 09012345678 → 090-1234-5678）
  let hyphenatedPhone = "";
  if (normalizedPhone.match(/^\d{10,11}$/)) {
    if (normalizedPhone.length === 11) {
      // 携帯電話番号 (11桁)
      hyphenatedPhone = `${normalizedPhone.slice(0,3)}-${normalizedPhone.slice(3,7)}-${normalizedPhone.slice(7)}`;
    } else if (normalizedPhone.length === 10) {
      // 固定電話番号 (10桁)
      hyphenatedPhone = `${normalizedPhone.slice(0,3)}-${normalizedPhone.slice(3,6)}-${normalizedPhone.slice(6)}`;
    }
  }
  
  // delivery_historyテーブルから最新の配送先情報を取得
  // 複数のパターンで検索
  let orConditions = [`delivery_phone.eq.${phone}`, `delivery_phone.eq.${normalizedPhone}`];
  if (hyphenatedPhone) {
    orConditions.push(`delivery_phone.eq.${hyphenatedPhone}`);
  }
  
  const { data, error } = await supabase
    .from("delivery_history")
    .select("*")
    .or(orConditions.join(","))
    .order("last_used_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Database error:", error);
    return NextResponse.json({ error: "データの取得に失敗しました" }, { status: 500 });
  }

  // 配送履歴が見つからない場合
  if (!data || data.length === 0) {
    return NextResponse.json({ delivery: null });
  }

  // 複数件ヒットした場合、正確に一致するものを優先
  let bestMatch = data[0];
  for (const item of data) {
    const itemPhone = item.delivery_phone?.replace(/[-\s]/g, "") || "";
    if (itemPhone === normalizedPhone) {
      bestMatch = item;
      break;
    }
  }

  // 最適な配送履歴を返す
  return NextResponse.json({ delivery: bestMatch });
}