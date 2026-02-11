import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// CSV項目ヘッダー（全55列）
const CSV_HEADERS = [
  "受注番号",
  "受注日",
  "受注チャネル",
  "受注担当者メール",
  "受注担当者名",
  "注文者氏名",
  "注文者氏名カナ",
  "注文者電話番号",
  "注文者メール",
  "注文者郵便番号",
  "注文者都道府県",
  "注文者住所１",
  "注文者住所２",
  "注文者会社名",
  "注文者部署名",
  "支払方法",
  "受注メモ",
  "明細行番号",
  "商品コード",
  "商品名",
  "SKU",
  "単価（税込）",
  "数量",
  "明細金額（税込）",
  "お届け先氏名",
  "お届け先氏名カナ",
  "お届け先電話番号",
  "お届け先郵便番号",
  "お届け先都道府県",
  "お届け先住所１",
  "お届け先住所２",
  "お届け先会社名",
  "お届け先部署名",
  "お届け希望日",
  "お届け時間帯",
  "配送方法",
  "送料（税込）",
  "配送メモ",
  "熨斗あり",
  "熨斗位置",
  "熨斗種類（選択）",
  "熨斗種類（自由入力）",
  "熨斗表書き",
  "熨斗名入れ",
  "ギフト包装",
  "ラッピング種別",
  "ラッピング料（税込）",
  "メッセージカード",
  "明細メモ",
  "受注小計（税込）",
  "受注送料合計（税込）",
  "受注ラッピング料合計（税込）",
  "手数料合計（税込）",
  "値引き（税込）",
  "受注合計（税込）",
];

function formatDatetime(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return dateStr;
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function boolToText(flag: boolean | null): string {
  return flag ? "あり" : "なし";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // リクエストボディ
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です" },
      { status: 400 }
    );
  }

  const { start_date, end_date, status_filter, preview } = body;
  if (!start_date || !end_date) {
    return NextResponse.json(
      { error: "開始日と終了日を指定してください" },
      { status: 400 }
    );
  }

  // 日付範囲で受注を取得
  const endDateEnd = `${end_date}T23:59:59.999+09:00`;
  const startDateBegin = `${start_date}T00:00:00.000+09:00`;

  let query = supabase
    .from("orders")
    .select("*")
    .gte("order_datetime", startDateBegin)
    .lte("order_datetime", endDateEnd)
    .order("order_datetime", { ascending: true });

  // ステータスフィルター
  if (status_filter && status_filter !== "all") {
    query = query.eq("status", status_filter);
  }

  const { data: orders, error: ordersError } = await query;

  if (ordersError) {
    return NextResponse.json(
      { error: `受注データの取得に失敗しました: ${ordersError.message}` },
      { status: 500 }
    );
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json(
      { error: "指定期間の対象データがありません", count: 0 },
      { status: 404 }
    );
  }

  // 全受注の明細を一括取得
  const orderIds = orders.map((o) => o.id);
  const { data: allDetails, error: detailsError } = await supabase
    .from("order_details")
    .select("*")
    .in("order_id", orderIds)
    .neq("product_code", "9999")
    .order("line_number", { ascending: true });

  if (detailsError) {
    return NextResponse.json(
      { error: `明細データの取得に失敗しました: ${detailsError.message}` },
      { status: 500 }
    );
  }

  // 受注IDでグルーピング
  const detailsByOrder = new Map<string, typeof allDetails>();
  for (const detail of allDetails || []) {
    if (!detailsByOrder.has(detail.order_id)) {
      detailsByOrder.set(detail.order_id, []);
    }
    detailsByOrder.get(detail.order_id)!.push(detail);
  }

  // CSV行を生成
  const rows: string[] = [];
  rows.push(CSV_HEADERS.map(escapeCsvField).join(","));

  // 出力対象の受注IDを収集（明細がある受注のみ）
  const exportedOrderIds: string[] = [];

  for (const order of orders) {
    const details = detailsByOrder.get(order.id) || [];
    if (details.length === 0) continue;

    exportedOrderIds.push(order.id);

    for (const detail of details) {
      const row = [
        order.order_number,
        formatDatetime(order.order_datetime),
        "電話",
        order.operator_email,
        order.operator_name,
        order.customer_name,
        order.customer_name_kana,
        order.customer_phone,
        order.customer_email,
        order.postal_code,
        order.prefecture,
        order.customer_address1,
        order.customer_address2,
        order.customer_company,
        order.customer_department,
        order.payment_method,
        order.order_memo,
        detail.line_number,
        detail.product_code,
        detail.product_name,
        "",
        detail.unit_price,
        detail.quantity,
        detail.line_total,
        detail.delivery_name,
        detail.delivery_name_kana,
        detail.delivery_phone,
        detail.delivery_postal_code,
        detail.delivery_prefecture,
        detail.delivery_address1,
        detail.delivery_address2,
        detail.delivery_company,
        detail.delivery_department,
        formatDate(detail.delivery_date),
        detail.delivery_time,
        detail.delivery_method,
        detail.shipping_fee,
        detail.delivery_memo,
        boolToText(detail.noshi_flag),
        detail.noshi_position,
        detail.noshi_type,
        detail.noshi_inscription_custom,
        detail.noshi_inscription,
        detail.noshi_name,
        boolToText(detail.wrapping_flag),
        detail.wrapping_type,
        detail.wrapping_fee,
        detail.message_card,
        detail.line_memo,
        order.subtotal,
        order.total_shipping_fee,
        order.total_wrapping_fee,
        order.total_fee,
        order.discount > 0 ? -order.discount : 0,
        order.total_amount,
      ];

      rows.push(row.map(escapeCsvField).join(","));
    }
  }

  // プレビューモードの場合はステータス更新しない
  if (!preview && exportedOrderIds.length > 0) {
    // 出力した受注のステータスを「CSV出力済み」に更新
    const { error: updateError } = await adminClient
      .from("orders")
      .update({ status: "CSV出力済み" })
      .in("id", exportedOrderIds);

    if (updateError) {
      console.error("ステータス更新エラー:", updateError.message);
      // CSVは出力済みなので、エラーでも処理は続行
    }
  }

  // BOM付きUTF-8 + CRLF
  const BOM = "\uFEFF";
  const csvContent = BOM + rows.join("\r\n") + "\r\n";

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const filename = `orders_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Exported-Count": String(exportedOrderIds.length),
    },
  });
}
