import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inr, num, genDocNo } from "@/lib/format";
import { makeRetailerCustomerQueryFn } from "@/lib/retailer-customer";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  CheckCircle2,
  Package,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/retailer/order")({
  component: PlaceOrder,
});

type Product = {
  id: string;
  name: string;
  selling_price: number;
  mrp: number;
  unit: string;
  category: string | null;
  current_stock: number;
  status: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

function PlaceOrder() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Get retailer info via shared helper (user_id first, email fallback).
  const { data: retailer } = useQuery({
    queryKey: ["retailer-me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const fn = makeRetailerCustomerQueryFn(userRes.user.id, userRes.user.email ?? null);
      return fn();
    },
    retry: 1,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .order("name");
      return (data ?? []) as Product[];
    },
  });

  // Filter products
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase().trim();
      if (q && !p.name.toLowerCase().includes(q) && !(p.category ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      return true;
    });
  }, [products, search, categoryFilter]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(
      products.map((p) => p.category).filter((c): c is string => Boolean(c)),
    );
    return ["all", ...Array.from(cats)];
  }, [products]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.product.selling_price, 0);
  }, [cart]);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const placeOrder = async () => {
    if (!retailer) {
      toast.error("Retailer info not found");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    const orderNo = genDocNo("ORD");
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_no: orderNo,
        customer_id: retailer.id,
        order_date: new Date().toISOString(),
        total: cartTotal,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    // Add order items
    const items = cart.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      rate: item.product.selling_price,
      amount: item.quantity * item.product.selling_price,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(items);

    if (itemsError) {
      toast.error("Order created but items failed to save");
      return;
    }

    toast.success(`Order ${orderNo} placed successfully!`);
    setCart([]);
    navigate({ to: "/retailer/orders" });
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Place Order</h1>
        <p className="text-sm text-muted-foreground">Browse products and add to cart</p>
      </div>

      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              className="whitespace-nowrap text-xs"
            >
              {cat === "all" ? "All" : cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((product) => {
          const inCart = cart.find((item) => item.product.id === product.id);
          return (
            <Card key={product.id} className="p-3 space-y-2">
              <div className="aspect-square bg-muted/30 rounded-lg flex items-center justify-center">
                <Package className="size-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                {product.category && (
                  <p className="text-[10px] text-muted-foreground">{product.category}</p>
                )}
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-mono font-bold text-sm">{inr(product.selling_price)}</span>
                  {product.mrp > product.selling_price && (
                    <span className="text-[10px] text-muted-foreground line-through">
                      {inr(product.mrp)}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">per {product.unit}</p>
              </div>
              {inCart ? (
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => updateQuantity(product.id, inCart.quantity - 1)}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="font-mono font-semibold text-sm">{inCart.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => updateQuantity(product.id, inCart.quantity + 1)}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => addToCart(product)}
                >
                  <Plus className="size-4" /> Add
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="size-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-semibold">No products found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Cart Summary - Fixed Bottom */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-background border-t z-20">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-muted-foreground">Cart ({cartItemCount} items)</div>
                <div className="text-xl font-bold font-mono">{inr(cartTotal)}</div>
              </div>
              <Button size="lg" onClick={placeOrder} className="gap-2">
                <ShoppingCart className="size-5" /> Place Order
              </Button>
            </div>
            {/* Cart items preview */}
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{item.product.name}</span>
                  <span className="font-mono mx-2">× {item.quantity}</span>
                  <span className="font-mono font-semibold w-20 text-right">
                    {inr(item.quantity * item.product.selling_price)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 ml-1"
                    onClick={() => removeFromCart(item.product.id)}
                  >
                    <Trash2 className="size-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
