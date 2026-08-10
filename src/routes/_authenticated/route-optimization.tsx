import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr, num } from "@/lib/format";
import { optimizeStops, haversineKm } from "@/lib/route-optimize";
import { toast } from "sonner";
import {
  MapPin,
  Route as RouteIcon,
  Truck,
  Users,
  TrendingUp,
  Compass,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/route-optimization")({
  component: RouteOptimization,
});

type Retailer = {
  id: string;
  name: string;
  shop_name: string | null;
  address: string | null;
  mobile: string | null;
  latitude: number | null;
  longitude: number | null;
  outstanding: number;
  credit_limit: number;
  area: string | null;
  assigned_route_id: string | null;
};

type OptimizedRoute = {
  route_id: string;
  route_name: string;
  driver_name: string | null;
  stops: Array<{
    id: string;
    retailer_id: string;
    retailer_name: string;
    shop_name: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
    sequence: number;
    distance_km: number;
    estimated_time_min: number;
  }>;
  total_distance_km: number;
  total_time_min: number;
  total_stops: number;
  total_outstanding: number;
};

function RouteOptimization() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedRoutes, setOptimizedRoutes] = useState<OptimizedRoute[]>([]);

  // Fetch retailers with GPS coordinates
  const { data: retailers = [], isLoading } = useQuery({
    queryKey: ["retailers-with-gps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .eq("status", "active")
        .order("name");
      return (data ?? []) as unknown as Retailer[];
    },
  });

  // Fetch routes
  const { data: routes = [] } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("routes")
        .select("*")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  // Statistics
  const stats = useMemo(() => {
    const withGps = retailers.filter((r) => r.latitude && r.longitude);
    const totalOutstanding = retailers.reduce((sum, r) => sum + Number(r.outstanding), 0);
    const avgOutstanding = retailers.length > 0 ? totalOutstanding / retailers.length : 0;
    return {
      totalRetailers: retailers.length,
      withGps: withGps.length,
      withoutGps: retailers.length - withGps.length,
      totalOutstanding,
      avgOutstanding,
    };
  }, [retailers]);

  const optimizeRoutes = async () => {
    setOptimizing(true);
    try {
      // Group retailers by existing route assignment
      const byRoute = new Map<string, Retailer[]>();
      const unassigned: Retailer[] = [];

      retailers.forEach((r) => {
        if (r.assigned_route_id) {
          const list = byRoute.get(r.assigned_route_id) ?? [];
          list.push(r);
          byRoute.set(r.assigned_route_id, list);
        } else {
          unassigned.push(r);
        }
      });

      const optimized: OptimizedRoute[] = [];

      // Optimize each route
      for (const [routeId, routeRetailers] of byRoute) {
        const route = routes.find((r) => r.id === routeId);
        if (!route) continue;

        // Get retailers with GPS
        const withGps = routeRetailers.filter((r) => r.latitude && r.longitude);
        if (withGps.length === 0) continue;

        // Run optimization
        const result = optimizeStops(
          withGps.map((r) => ({
            id: r.id,
            lat: r.latitude!,
            lng: r.longitude!,
          })),
          route.start_latitude && route.start_longitude
            ? { lat: route.start_latitude, lng: route.start_longitude }
            : null
        );

        const byId = new Map(withGps.map((r) => [r.id, r]));
        const stops = result.ordered.map((o, seq) => {
          const retailer = byId.get(o.id)!;
          const prevId = seq > 0 ? result.ordered[seq - 1].id : null;
          const prev = prevId ? byId.get(prevId)! : null;
          const distance = prev
            ? haversineKm(
                { lat: prev.latitude!, lng: prev.longitude! },
                { lat: retailer.latitude!, lng: retailer.longitude! }
              )
            : 0;

          return {
            id: `stop-${retailer.id}`,
            retailer_id: retailer.id,
            retailer_name: retailer.name,
            shop_name: retailer.shop_name,
            address: retailer.address,
            latitude: retailer.latitude!,
            longitude: retailer.longitude!,
            sequence: seq + 1,
            distance_km: distance,
            estimated_time_min: Math.ceil(distance * 3), // ~20 km/h average
          };
        });

        const totalDistance = stops.reduce((sum, s) => sum + s.distance_km, 0);
        const totalTime = stops.reduce((sum, s) => sum + s.estimated_time_min, 0);
        const totalOutstanding = withGps.reduce((sum, r) => sum + Number(r.outstanding), 0);

        optimized.push({
          route_id: routeId,
          route_name: route.name,
          driver_name: route.driver_name,
          stops,
          total_distance_km: totalDistance,
          total_time_min: totalTime,
          total_stops: stops.length,
          total_outstanding: totalOutstanding,
        });
      }

      setOptimizedRoutes(optimized);
      toast.success(`Optimized ${optimized.length} routes`);
    } catch (error: any) {
      toast.error(error.message ?? "Optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  const assignUnassigned = async () => {
    // Auto-assign retailers without routes based on nearest route centroid
    toast.info("Auto-assigning retailers to routes...");
    // Implementation would group by area or nearest route
  };

  return (
    <PageContainer>
      <PageHeader
        title="Route Optimization"
        description="Optimize delivery routes based on GPS coordinates and load balancing"
        actions={
          <Button onClick={optimizeRoutes} disabled={optimizing || retailers.length === 0} className="gap-2">
            {optimizing ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> Optimizing...
              </>
            ) : (
              <>
                <Compass className="size-4" /> Optimize Routes
              </>
            )}
          </Button>
        }
      />

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Retailers
            </span>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono">{stats.totalRetailers}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              With GPS
            </span>
            <MapPin className="size-4 text-success" />
          </div>
          <div className="text-2xl font-bold font-mono text-success">{stats.withGps}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Without GPS
            </span>
            <AlertTriangle className="size-4 text-warning" />
          </div>
          <div className="text-2xl font-bold font-mono text-warning">{stats.withoutGps}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Outstanding
            </span>
            <TrendingUp className="size-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold font-mono text-destructive">{inr(stats.totalOutstanding)}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Routes
            </span>
            <RouteIcon className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono">{routes.length}</div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="optimized">
        <TabsList>
          <TabsTrigger value="optimized">
            <Compass className="size-4 mr-2" /> Optimized Routes ({optimizedRoutes.length})
          </TabsTrigger>
          <TabsTrigger value="map">
            <MapPin className="size-4 mr-2" /> Map View
          </TabsTrigger>
          <TabsTrigger value="retailers">
            <Users className="size-4 mr-2" /> All Retailers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="optimized" className="mt-4 space-y-4">
          {optimizedRoutes.length === 0 ? (
            <Card className="p-12 text-center">
              <RouteIcon className="size-10 mx-auto mb-3 text-muted-foreground" />
              <div className="text-sm font-semibold mb-1">No optimized routes yet</div>
              <div className="text-xs text-muted-foreground">
                Click "Optimize Routes" to generate optimized delivery sequences
              </div>
            </Card>
          ) : (
            optimizedRoutes.map((route) => (
              <Card key={route.route_id} className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{route.route_name}</h3>
                    {route.driver_name && (
                      <p className="text-sm text-muted-foreground">Driver: {route.driver_name}</p>
                    )}
                  </div>
                  <Badge variant="outline">{route.total_stops} stops</Badge>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Distance</div>
                    <div className="font-mono font-bold text-lg">{num(route.total_distance_km, 1)} km</div>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Est. Time</div>
                    <div className="font-mono font-bold text-lg">{Math.floor(route.total_time_min / 60)}h {route.total_time_min % 60}m</div>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Outstanding</div>
                    <div className="font-mono font-bold text-lg text-destructive">{inr(route.total_outstanding)}</div>
                  </div>
                </div>

                {/* Stops */}
                <div className="space-y-2">
                  {route.stops.map((stop, idx) => (
                    <div key={stop.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="flex flex-col items-center">
                        <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">
                          {stop.sequence}
                        </div>
                        {idx < route.stops.length - 1 && (
                          <div className="w-0.5 h-8 bg-muted mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{stop.shop_name ?? stop.retailer_name}</div>
                        {stop.address && (
                          <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Navigation className="size-3" /> {num(stop.distance_km, 2)} km
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="size-3" /> {stop.estimated_time_min} min
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <Card className="p-12 text-center">
            <MapPin className="size-10 mx-auto mb-3 text-muted-foreground" />
            <div className="text-sm font-semibold mb-1">Map View</div>
            <div className="text-xs text-muted-foreground">
              Interactive map with route visualization coming soon
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="retailers" className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading retailers...</div>
          ) : retailers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No retailers found</div>
          ) : (
            <div className="space-y-2">
              {retailers.map((retailer) => (
                <Card key={retailer.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{retailer.shop_name ?? retailer.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{retailer.address}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {retailer.latitude && retailer.longitude ? (
                          <Badge variant="outline" className="text-[10px] text-success border-success/30">
                            <MapPin className="size-3 mr-1" /> GPS Set
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                            <AlertTriangle className="size-3 mr-1" /> No GPS
                          </Badge>
                        )}
                        {retailer.assigned_route_id && (
                          <Badge variant="outline" className="text-[10px]">
                            {routes.find((r) => r.id === retailer.assigned_route_id)?.name ?? "Assigned"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold">
                        {Number(retailer.outstanding) > 0 ? inr(retailer.outstanding) : "Paid"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {Number(retailer.outstanding) > 0 ? "Outstanding" : "Clear"}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
