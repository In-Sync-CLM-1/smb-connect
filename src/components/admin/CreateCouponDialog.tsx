import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { OwnershipContext } from "@/hooks/useOwnershipScope";

const couponSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[A-Z0-9]+$/, "Code must contain only uppercase letters and numbers")
    .transform((val) => val.toUpperCase()),
  name: z.string().min(1, "Name is required").max(100),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.coerce
    .number()
    .positive("Discount must be positive")
    .refine((val) => val <= 100 || true, "Invalid discount"),
  landing_page_id: z.string().nullable(),
  valid_from: z.string().min(1, "Start date is required"),
  valid_until: z.string().min(1, "End date is required"),
  max_uses: z.coerce.number().int().positive().nullable(),
  max_uses_per_user: z.coerce.number().int().positive().default(1),
  is_active: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.discount_type === "percentage" && data.discount_value > 100) {
      return false;
    }
    return true;
  },
  {
    message: "Percentage discount cannot exceed 100%",
    path: ["discount_value"],
  }
).refine(
  (data) => new Date(data.valid_until) > new Date(data.valid_from),
  {
    message: "End date must be after start date",
    path: ["valid_until"],
  }
);

type CouponFormData = z.infer<typeof couponSchema>;

interface CreateCouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCoupon?: {
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
    is_active: boolean;
  } | null;
  scope: OwnershipContext;
}

export function CreateCouponDialog({
  open,
  onOpenChange,
  editingCoupon,
  scope,
}: CreateCouponDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingCoupon;
  const isAdmin = scope.scope === "admin";

  const form = useForm<CouponFormData>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: "",
      name: "",
      discount_type: "percentage",
      discount_value: 10,
      landing_page_id: null,
      valid_from: format(new Date(), "yyyy-MM-dd"),
      valid_until: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      max_uses: null,
      max_uses_per_user: 1,
      is_active: true,
    },
  });

  const { data: landingPages } = useQuery({
    queryKey: ["landing-pages-for-coupons", scope.scope, scope.associationId, scope.companyId],
    queryFn: async () => {
      let q = supabase
        .from("event_landing_pages")
        .select("id, title")
        .eq("is_active", true)
        .order("title");

      if (scope.scope === "association" && scope.associationId) {
        q = q.eq("association_id", scope.associationId);
      } else if (scope.scope === "company" && scope.companyId) {
        q = q.eq("company_id", scope.companyId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (editingCoupon) {
      form.reset({
        code: editingCoupon.code,
        name: editingCoupon.name,
        discount_type: editingCoupon.discount_type,
        discount_value: editingCoupon.discount_value,
        landing_page_id: editingCoupon.landing_page_id,
        valid_from: format(new Date(editingCoupon.valid_from), "yyyy-MM-dd"),
        valid_until: format(new Date(editingCoupon.valid_until), "yyyy-MM-dd"),
        max_uses: editingCoupon.max_uses,
        max_uses_per_user: editingCoupon.max_uses_per_user,
        is_active: editingCoupon.is_active,
      });
    } else {
      form.reset({
        code: "",
        name: "",
        discount_type: "percentage",
        discount_value: 10,
        landing_page_id: null,
        valid_from: format(new Date(), "yyyy-MM-dd"),
        valid_until: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        max_uses: null,
        max_uses_per_user: 1,
        is_active: true,
      });
    }
  }, [editingCoupon, form]);

  const createMutation = useMutation({
    mutationFn: async (data: CouponFormData) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");
      const user = { user: session.user };

      const resolvedLandingPageId = data.landing_page_id === "all" ? null : data.landing_page_id;

      // Non-admin owners must always tie a coupon to one of their own landing pages.
      if (!isAdmin && !resolvedLandingPageId) {
        throw new Error("Please select a landing page for this coupon");
      }

      const couponData = {
        code: data.code.toUpperCase(),
        name: data.name,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        landing_page_id: resolvedLandingPageId,
        valid_from: new Date(data.valid_from).toISOString(),
        valid_until: new Date(data.valid_until).toISOString(),
        max_uses: data.max_uses,
        max_uses_per_user: data.max_uses_per_user,
        is_active: data.is_active,
        created_by: user.user.id,
      };

      if (isEditing && editingCoupon) {
        const { created_by: _, ...updateData } = couponData;
        const { error } = await supabase
          .from("event_coupons")
          .update(updateData)
          .eq("id", editingCoupon.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_coupons").insert([couponData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Coupon updated successfully" : "Coupon created successfully");
      queryClient.invalidateQueries({ queryKey: ["event-coupons"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("A coupon with this code already exists");
      } else {
        toast.error("Failed to save coupon: " + error.message);
      }
    },
  });

  const onSubmit = (data: CouponFormData) => {
    createMutation.mutate(data);
  };

  const discountType = form.watch("discount_type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Coupon" : "Create New Coupon"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coupon Code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., EARLY20"
                      className="uppercase font-mono"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    Unique code users will enter (letters and numbers only)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name / Description</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Early Bird Discount" />
                  </FormControl>
                  <FormDescription>Internal name for identification</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Discount Value {discountType === "percentage" ? "(%)" : "(₹)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        max={discountType === "percentage" ? "100" : undefined}
                        step="0.01"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="landing_page_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applicable Landing Page</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "all" ? null : v)}
                    value={field.value || (isAdmin ? "all" : "")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select landing page" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isAdmin && <SelectItem value="all">All Landing Pages</SelectItem>}
                      {landingPages?.map((page) => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {isAdmin
                      ? 'Leave as "All" for global coupons'
                      : "Pick which landing page this coupon applies to"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid From</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Total Uses</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormDescription>Leave empty for unlimited</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_uses_per_user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uses Per Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1" />
                    </FormControl>
                    <FormDescription>Limit per email address</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Enable or disable this coupon
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? "Update Coupon" : "Create Coupon"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
