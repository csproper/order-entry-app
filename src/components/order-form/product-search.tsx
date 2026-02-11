"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ProductSearchProps {
  onSelect: (product: Product) => void;
  disabled?: boolean;
}

export function ProductSearch({ onSelect, disabled }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const supabaseRef = useRef(createClient());
  const searchIdRef = useRef(0);

  const search = useCallback(async (q: string) => {
    // 各リクエストにIDを振り、古い結果を無視する
    const id = ++searchIdRef.current;

    if (q.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabaseRef.current
        .from("products")
        .select("*")
        .eq("is_active", true)
        .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
        .order("code")
        .limit(20);

      // 古いリクエストの結果は捨てる
      if (id !== searchIdRef.current) return;

      if (!error && data) {
        setResults(data);
        setIsOpen(true);
      }
    } catch {
      if (id === searchIdRef.current) {
        setResults([]);
      }
    } finally {
      if (id === searchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => search(query), 150);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        placeholder="商品コードまたは商品名で検索..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= 1 && results.length > 0 && setIsOpen(true)}
        disabled={disabled}
        className="w-full"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          検索中...
        </div>
      )}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((product) => (
            <button
              key={product.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between"
              onClick={() => handleSelect(product)}
            >
              <div>
                <span className="font-mono text-gray-500 mr-2">
                  {product.code}
                </span>
                <span>{product.name}</span>
              </div>
              <span className="text-gray-600 ml-2">
                ¥{product.regular_price.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
      {isOpen && query.length >= 1 && results.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg p-3 text-sm text-gray-500">
          該当する商品が見つかりません
        </div>
      )}
    </div>
  );
}
