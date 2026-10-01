import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginRequest } from "@auction/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthCard, authLinkClass } from "@/features/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLoginMutation } from "@/features/auth/queries";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { getErrorMessage } from "@/lib/api/errors";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLoginMutation();
  const form = useForm({
    resolver: zodResolver(LoginRequest),
    defaultValues: { email: "", password: "" },
  });

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Sign in to Cheretanet"
      description="Bid on auctions, track your deposits, or manage your organization's auctions."
      footer={
        <>
          New to Cheretanet?{" "}
          <Link to="/register" className={authLinkClass}>
            Create a bidder account
          </Link>
        </>
      }
    >
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  await login.mutateAsync(values);
                  const to = (location.state as { from?: string } | null)?.from ?? "/app";
                  navigate(to, { replace: true });
                } catch (error) {
                  if (!applyApiFieldErrors(error, form.setError)) {
                    toast.error(getErrorMessage(error, "Sign in failed"));
                  }
                }
              })}
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link to="/forgot-password" className={`text-xs ${authLinkClass}`}>
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
                {login.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>
    </AuthCard>
  );
}
