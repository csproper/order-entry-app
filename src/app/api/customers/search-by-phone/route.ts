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
  const { data, error } = await supabase
    .from("delivery_history")
    .select("*")
    .or(`delivery_phone.eq.${phone},delivery_phone.eq.${normalizedPhone}`)
    .order("last_used_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 配送履歴が見つからない場合
  if (!data || data.length === 0) {
    return NextResponse.json({ delivery: null });
  }

  // 最新の配送履歴を返す
  return NextResponse.json({ delivery: data[0] });
}