import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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
  
  // delivery_historyテーブルから最新の配送先情報を取得
  // データベース側の電話番号もハイフンあり・なし両方の可能性があるため
  // 複数パターンで検索
  const { data, error } = await supabase
    .from("delivery_history")
    .select("*")
    .or(`delivery_phone.ilike.%${normalizedPhone}%`)
    .order("last_used_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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