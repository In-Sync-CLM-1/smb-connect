import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnershipScope } from "@/hooks/useOwnershipScope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, TicketPercent, Copy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreateCouponDialog } from "@/components/admin/CreateCouponDialog";
import { BackButton } from "@/components/BackButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Coupon {
  id: string;
  code: string;
  name: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  landing_page_id: string | null;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  max_uses_per_user: number;
  current_uses: number;
  is_active: boolean;
  created_at: string;
  landing_page?: {
    title: string;
  } | null;
}

export default function CouponManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "inactive">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);

  const queryClient = useQueryClient();
  const scope = useOwnershipScope();

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["event-coupons", scope.scope, scope.associationId, scope.companyId],
    queryFn: async () => {
      const isAdmin = scope.scope === "admin";
      const select = isAdmin
        ? `*, landing_page:event_landing_pages(title)`
        : `*, landing_page:event_landing_pages!inner(title, association_id, company_id)`;

      let query = supabase
        .from("event_coupons")
        .select(select)
        .order("created_at", { ascending: false });

      if (scope.scope === "association" && scope.associationId) {
        query = query.eq("landing_page.association_id", scope.associationId);
      } else if (scope.scope === "company" && scope.companyId) {
        query = query.eq("landing_page.company_id", scope.companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Coupon[];
    },
    enabled: scope.scope === "admin" || !!scope.associationId || !!scope.companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_coupons")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coupon deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["event-coupons"] });
      setDeletingCoupon(null);
    },
    onError: (error) => {
      toast.error("Failed to delete coupon: " + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("event_coupons")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coupon status updated");
      queryClient.invalidateQueries({ queryKey: ["event-coupons"] });
    },
    onError: (error) => {
      toast.error("Failed to update coupon: " + error.message);
    },
  });

  const getCouponStatus = (coupon: Coupon) => {
    const now = new Date();
    const validFrom = new Date(coupon.valid_from);
    const validUntil = new Date(coupon.valid_until);

    if (!coupon.is_active) return "inactive";
    if (now < validFrom) return "scheduled";
    if (now > validUntil) return "expired";
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) return "exhausted";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 text-white">Active</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "inactive":
        return <Badge variant="outline">Inactive</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-500 text-white">Scheduled</Badge>;
      case "exhausted":
        return <Badge className="bg-orange-500 text-white">Exhausted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredCoupons = coupons?.filter((coupon) => {
    const matchesSearch =
      coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coupon.name.toLowerCase().includes(searchQuery.toLowerCase());

    const status = getCouponStatus(coupon);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && status === "active") ||
      (statusFilter === "expired" && status === "expired") ||
      (statusFilter === "inactive" && status === "inactive");

    return matchesSearch && matchesStatus;
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Coupon code copied!");
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}%`;
    }
    return `₹${coupon.discount_value}`;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <BackButton />
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <TicketPercent className="h-7 w-7" />
            Coupon Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage discount coupons for event registrations
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Coupon
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Coupons</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCoupons?.length === 0 ? (
            <div className="text-center py-12">
              <TicketPercent className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No coupons found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filter"
                  : "Create your first coupon to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Coupon
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Landing Page</TableHead>
                    <TableHead>Valid Period</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons?.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                            {coupon.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyCode(coupon.code)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{coupon.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {formatDiscount(coupon)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {coupon.landing_page?.title || (
                          <span className="text-muted-foreground">All Pages</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(coupon.valid_from), "MMM d, yyyy")}</div>
                          <div className="text-muted-foreground">
                            to {format(new Date(coupon.valid_until), "MMM d, yyyy")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {coupon.current_uses}
                          {coupon.max_uses ? ` / ${coupon.max_uses}` : " uses"}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(getCouponStatus(coupon))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingCoupon(coupon);
                              setIsCreateDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingCoupon(coupon)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateCouponDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setEditingCoupon(null);
        }}
        editingCoupon={editingCoupon}
        scope={scope}
      />

      <AlertDialog open={!!deletingCoupon} onOpenChange={() => setDeletingCoupon(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the coupon "{deletingCoupon?.code}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCoupon && deleteMutation.mutate(deletingCoupon.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
