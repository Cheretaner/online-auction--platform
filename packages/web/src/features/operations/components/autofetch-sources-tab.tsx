import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, RefreshCw, Globe, Radio } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAutofetchSources, useCreateAutofetchSource, useFetchAutofetchSource } from "@/features/operations/queries";
import { getErrorMessage } from "@/lib/api/errors";

/* ─────────────────────────── Preset Sources ─────────────────────────── */

interface PresetSource {
  name: string;
  adapterType: string;
  sourceUrl: string;
  adapterConfig: Record<string, unknown>;
  tag: string;
}

const PRESET_WEBSITES: PresetSource[] = [
  {
    name: "Auction.et",
    adapterType: "web-scraper",
    sourceUrl: "https://auction.et",
    adapterConfig: {},
    tag: "Website",
  },
  {
    name: "Walia Tender",
    adapterType: "web-scraper",
    sourceUrl: "https://waliatender.com",
    adapterConfig: {},
    tag: "Website",
  },
  {
    name: "Chereta.com",
    adapterType: "web-scraper",
    sourceUrl: "https://chereta.com",
    adapterConfig: {},
    tag: "Website",
  },
  {
    name: "Bina.et",
    adapterType: "web-scraper",
    sourceUrl: "https://bina.et",
    adapterConfig: {},
    tag: "Website",
  },
  {
    name: "HouseBid (AAHDC)",
    adapterType: "web-scraper",
    sourceUrl: "https://housebid.aahdc.gov.et",
    adapterConfig: {},
    tag: "Website",
  },
];

const PRESET_TELEGRAM: PresetSource[] = [
  {
    name: "Construction Tenders",
    adapterType: "web-scraper",
    sourceUrl: "https://t.me/s/constructiontenders",
    adapterConfig: {},
    tag: "Telegram",
  },
  {
    name: "Walia Tender (Telegram)",
    adapterType: "web-scraper",
    sourceUrl: "https://t.me/s/waliatender",
    adapterConfig: {},
    tag: "Telegram",
  },
  {
    name: "Tender Ethiopia",
    adapterType: "web-scraper",
    sourceUrl: "https://t.me/s/tender_ethiopia",
    adapterConfig: {},
    tag: "Telegram",
  },
  {
    name: "CHERETA",
    adapterType: "web-scraper",
    sourceUrl: "https://t.me/s/CHERETA",
    adapterConfig: {},
    tag: "Telegram",
  },
];

/* ─────────────────────────── Validation ─────────────────────────── */

const ADAPTER_TYPES = [
  { value: "json-feed", label: "JSON Feed" },
  { value: "csv-upload", label: "CSV Upload" },
  { value: "rss-feed", label: "RSS / Atom Feed" },
  { value: "web-scraper", label: "Web Scraper (AI)" },
  { value: "telegram-rss", label: "Telegram Channel (RSS + AI)" },
] as const;

const sourceSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  adapterType: z.string().min(1, "Adapter type is required"),
  sourceUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  adapterConfig: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, "Must be valid JSON"),
});

/* ─────────────────────────── Component ─────────────────────────── */

export function AutofetchSourcesTab() {
  const { data: sources, isLoading } = useAutofetchSources();
  const createSource = useCreateAutofetchSource();
  const fetchSource = useFetchAutofetchSource();

  const [open, setOpen] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [presetTab, setPresetTab] = useState<"custom" | "websites" | "telegram">("custom");

  const form = useForm<z.infer<typeof sourceSchema>>({
    resolver: zodResolver(sourceSchema),
    defaultValues: {
      name: "",
      adapterType: "json-feed",
      sourceUrl: "",
      adapterConfig: "{}",
    },
  });

  const onSubmit = (values: z.infer<typeof sourceSchema>) => {
    createSource.mutate(
      {
        name: values.name,
        adapterType: values.adapterType,
        sourceUrl: values.sourceUrl || undefined,
        adapterConfig: JSON.parse(values.adapterConfig),
      },
      {
        onSuccess: () => {
          toast.success("Source created successfully");
          setOpen(false);
          form.reset();
        },
        onError: (err) => {
          toast.error(getErrorMessage(err));
        },
      }
    );
  };

  const addPreset = (preset: PresetSource) => {
    createSource.mutate(
      {
        name: preset.name,
        adapterType: preset.adapterType,
        sourceUrl: preset.sourceUrl,
        adapterConfig: preset.adapterConfig,
      },
      {
        onSuccess: () => toast.success(`"${preset.name}" added`),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    );
  };

  const handleFetch = (id: string) => {
    setFetchingId(id);
    fetchSource.mutate(id, {
      onSuccess: () => {
        toast.success("Fetch triggered successfully");
        setFetchingId(null);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err));
        setFetchingId(null);
      },
    });
  };

  const items = sources ?? [];
  const existingUrls = new Set(items.map((source) => source.sourceUrl).filter((url): url is string => Boolean(url)));

  return (
    <div className="space-y-6">
      {/* ── Header + Add Source Button ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Configured Sources</h2>
          <p className="text-sm text-muted-foreground">
            Manage data sources that automatically feed items into your auction queue.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Add New Source</DialogTitle>
              <DialogDescription>
                Choose a preset Ethiopian auction source or configure a custom data source.
              </DialogDescription>
            </DialogHeader>

            {/* ── Preset / Custom Tabs ── */}
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["custom", "websites", "telegram"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPresetTab(tab)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    presetTab === tab
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "custom" ? "Custom" : tab === "websites" ? "🌐 Websites" : "📱 Telegram"}
                </button>
              ))}
            </div>

            {/* ── Preset Lists ── */}
            {presetTab === "websites" && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {PRESET_WEBSITES.map((preset) => {
                  const alreadyAdded = existingUrls.has(preset.sourceUrl);
                  return (
                    <div
                      key={preset.sourceUrl}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{preset.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                            {preset.sourceUrl}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyAdded ? "secondary" : "default"}
                        disabled={alreadyAdded || createSource.isPending}
                        onClick={() => addPreset(preset)}
                      >
                        {alreadyAdded ? "Added" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {presetTab === "telegram" && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {PRESET_TELEGRAM.map((preset) => {
                  const alreadyAdded = existingUrls.has(preset.sourceUrl);
                  return (
                    <div
                      key={preset.sourceUrl}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Radio className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{preset.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                            {preset.sourceUrl}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyAdded ? "secondary" : "default"}
                        disabled={alreadyAdded || createSource.isPending}
                        onClick={() => addPreset(preset)}
                      >
                        {alreadyAdded ? "Added" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Custom Form ── */}
            {presetTab === "custom" && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Government Seized Vehicles API" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="adapterType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adapter Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an adapter" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ADAPTER_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sourceUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://api.example.com/items" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="adapterConfig"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adapter Configuration (JSON)</FormLabel>
                        <FormControl>
                          <Textarea className="font-mono text-xs" rows={4} {...field} />
                        </FormControl>
                        <FormDescription>
                          Optional JSON configuration for the adapter (field mappings, API keys, etc.).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createSource.isPending}>
                      {createSource.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Source Cards Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading sources...</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No sources configured yet.</p>
        )}
        {items.map((source) => (
          <Card key={source.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base truncate" title={source.name}>
                  {source.name}
                </CardTitle>
                <Badge variant="outline" className="shrink-0 text-xs capitalize">
                  {source.adapterType === "web-scraper"
                    ? "Web Scraper"
                    : source.adapterType === "telegram-rss"
                      ? "Telegram"
                      : source.adapterType}
                </Badge>
              </div>
              <CardDescription className="truncate" title={source.sourceUrl || "No URL"}>
                {source.sourceUrl || "No URL provided"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleFetch(source.id)}
                disabled={fetchingId === source.id}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${fetchingId === source.id ? "animate-spin" : ""}`} />
                {fetchingId === source.id ? "Fetching..." : "Fetch Now"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
