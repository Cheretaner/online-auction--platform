import { Link, useNavigate } from "react-router-dom";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterRequest } from "@auction/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRegisterMutation } from "@/features/auth/queries";
import { applyApiFieldErrors } from "@/lib/forms/api-errors";
import { getErrorMessage } from "@/lib/api/errors";

type RegisterFormValues = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  accountType: "individual" | "business";
  businessName: string;
  nationalId: string;
  tinNumber: string;
  region: string;
};


function cleanRegisterValues(values: RegisterFormValues) {
  const blankToUndefined = (v: string) => {
    const trimmed = v?.trim();
    return trimmed ? trimmed : undefined;
  };
  const isBusiness = values.accountType === "business";
  return {
    email: values.email.trim(),
    password: values.password,
    fullName: values.fullName.trim(),
    accountType: values.accountType,
    phone: blankToUndefined(values.phone),
    region: blankToUndefined(values.region),
    businessName: isBusiness ? blankToUndefined(values.businessName) : undefined,
    tinNumber: isBusiness ? blankToUndefined(values.tinNumber) : undefined,
    nationalId: isBusiness ? undefined : blankToUndefined(values.nationalId),
  };
}

const registerResolver: Resolver<RegisterFormValues> = async (values, context, options) => {
  const result = await zodResolver(RegisterRequest)(
    cleanRegisterValues(values) as never,
    context as never,
    options as never,
  );
  if (result.errors && Object.keys(result.errors).length > 0) {
    return { values: {}, errors: result.errors } as never;
  }
  // Keep the raw form values so react-hook-form state is untouched; the
  // submit handler cleans them again before sending.
  return { values, errors: {} };
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegisterMutation();
  const form = useForm<RegisterFormValues>({
    resolver: registerResolver,
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      phone: "",
      accountType: "individual",
      businessName: "",
      nationalId: "",
      tinNumber: "",
      region: "",
    },
  });
  const accountType = useWatch({ control: form.control, name: "accountType" });

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            Registration creates a bidder by default unless the API bootstraps a
            platform admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  await register.mutateAsync(cleanRegisterValues(values));
                  navigate("/app", { replace: true });
                } catch (error) {
                  if (!applyApiFieldErrors(error, form.setError)) {
                    toast.error(getErrorMessage(error, "Registration failed"));
                  }
                }
              })}
            >
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input autoComplete="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {accountType === "business" ? (
                <>
                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tinNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TIN</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="nationalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>National ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="sm:col-span-2"
                disabled={register.isPending}
              >
                {register.isPending ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-sm text-muted-foreground">
            Already registered?{" "}
            <Link to="/login" className="text-primary underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}