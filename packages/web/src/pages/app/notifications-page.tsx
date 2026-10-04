import { Link } from "react-router-dom";
import { CheckCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { QueryState } from "@/components/feedback/query-state";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/operations/queries";
import type { NotificationRecord } from "@/lib/api/types";
import { useLocale, useT } from "@/i18n/context";
import { intlLocale } from "@/i18n/core";

export default function NotificationsPage() {
  const query = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const t = useT("account");
  const { locale } = useLocale();
  const items = query.data?.items ?? [];

  return (
    <div>
      <PageHeader title={t("lists.notificationsTitle")} description={t("lists.notificationsDescription")} />
      <div className="mb-5 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          loading={markAll.isPending}
          disabled={!items.some((item) => !item.readAt)}
          onClick={() =>
            markAll.mutate(undefined, {
              onSuccess: () => toast.success(t("lists.markedAll")),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          <CheckCheck aria-hidden /> {t("lists.markAll")}
        </Button>
      </div>
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={items.length === 0}
        emptyTitle={t("lists.notificationsTitle")}
        emptyDescription={t("lists.notificationsEmpty")}
        onRetry={() => void query.refetch()}
      >
        <div className="space-y-3">
          {items.map((item) => {
            const text = localizeNotification(item, locale);
            return (
              <Card key={item.id} className={!item.readAt ? "border-primary/40 bg-primary/[0.025]" : undefined}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{text.title}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {item.readAt ? (locale === "am" ? "ተነብቧል" : "Read") : (locale === "am" ? "አልተነበበም" : "Unread")}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{text.message}</p>
                    <time className="block text-xs text-muted-foreground" dateTime={item.createdAt}>
                      {new Intl.DateTimeFormat(intlLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
                    </time>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.relatedEntityType === "auction" && item.relatedEntityId ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/auctions/${item.relatedEntityId}`}>
                          <ExternalLink aria-hidden /> {locale === "am" ? "ጨረታውን ይመልከቱ" : "View auction"}
                        </Link>
                      </Button>
                    ) : null}
                    {!item.readAt ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={markRead.isPending && markRead.variables === item.id}
                        onClick={() => markRead.mutate(item.id, {
                          onError: (error) => toast.error(error.message),
                        })}
                      >
                        {locale === "am" ? "እንደተነበበ ምልክት አድርግ" : "Mark as read"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}

function localizeNotification(item: NotificationRecord, locale: "en" | "am") {
  if (locale !== "am") return { title: item.title, message: item.message };
  const auction = item.message.match(/"([^\"]+)"/)?.[1] ?? "";
  const watchlist: Record<string, { title: string; message: string }> = {
    "watchlist.bid.placed": { title: "አዲስ የጨረታ እንቅስቃሴ", message: `በ“${auction}” ላይ አዲስ የጨረታ እንቅስቃሴ ተመዝግቧል። ብቁ እንቅስቃሴዎችን ለማየት ጨረታውን ይክፈቱ።` },
    "watchlist.auction.approved": { title: "ጨረታ ተዘጋጅቷል", message: `“${auction}” ተዘጋጅቶ ለመከታተል ይገኛል።` },
    "watchlist.auction.opened": { title: "ጨረታው ተከፍቷል", message: `በ“${auction}” ላይ ጨረታ መስጠት ተጀምሯል።` },
    "watchlist.auction.closed": { title: "የጨረታ ጊዜ ተዘግቷል", message: `በ“${auction}” ላይ የጨረታ ጊዜ ተዘግቷል። ውጤቱ በግምገማ ላይ ሊሆን ይችላል።` },
    "watchlist.auction.under_review": { title: "ጨረታው በግምገማ ላይ ነው", message: `የ“${auction}” ውጤት በግምገማ ላይ ነው።` },
    "watchlist.auction.awarded": { title: "ጨረታ ተሸልሟል", message: `የ“${auction}” ውጤት ተሸልሟል።` },
    "watchlist.auction.cancelled": { title: "ጨረታ ተሰርዟል", message: `“${auction}” ተሰርዟል።` },
  };
  const known = watchlist[item.type];
  if (known) return known;

  switch (item.type) {
    case "bid.placed": {
      const sealed = item.title === "Sealed bid received";
      const amount = item.message.match(/A bid of ([\d,.]+) was placed/)?.[1];
      return {
        title: sealed ? "የታሸገ ዋጋ ተመዝግቧል" : "አዲስ ዋጋ ቀርቧል",
        message: sealed
          ? `በ“${auction}” ላይ የታሸገ ዋጋ ተመዝግቧል።`
          : `በ“${auction}” ላይ ${amount ? `ETB ${amount} የሆነ ` : ""}ዋጋ ቀርቧል።`,
      };
    }
    case "auction.won":
      return { title: "ጊዜያዊ መሪ ተጫራች እርስዎ ነዎት", message: `በ“${auction}” ላይ ጨረታ ተዘግቷል። ውጤቱ እስኪገመገምና እስኪሸለም ድረስ ጊዜያዊ ነው።` };
    case "auction.closed":
      return { title: "ጨረታ ተዘግቷል", message: `“${auction}” ተዘግቷል፤ ለግምገማ ዝግጁ ነው።` };
    case "auction.cancelled":
      return { title: "ጨረታ ተሰርዟል", message: `“${auction}” የተጠባባቂ ዋጋውን አላሟላም ወይም ብቁ ዋጋ አልቀረበም።` };
    case "deposit.registered":
      return { title: "ማስከበሪያ ማረጋገጫ ይጠብቃል", message: `ለ“${auction}” ማስከበሪያ ተመዝግቧል።` };
    case "deposit.reviewed": {
      const accepted = /verified/i.test(item.title) || /verified/i.test(item.message);
      return { title: accepted ? "ማስከበሪያው ተረጋግጧል" : "ማስከበሪያው አልተቀበለም", message: accepted ? "ማስከበሪያዎ ተረጋግጧል። በዚህ ጨረታ ላይ መጫረት ይችላሉ።" : `ማስከበሪያዎ አልተቀበለም። ${item.message}` };
    }
    case "deposit.released":
      return { title: "ማስከበሪያ ተመላሽ ሆኗል", message: "ለዚህ ጨረታ ያስገቡት ማስከበሪያ ተመላሽ ሆኗል።" };
    case "settlement.paid":
      return { title: "የመጨረሻ ክፍያ ተቀብሏል", message: "ለተሸለመው ጨረታ የመጨረሻ ክፍያዎ ደርሷል።" };
    case "deposit.refund_reconciliation_required": {
      const status = item.message.match(/status '([^']+)'/)?.[1];
      return {
        title: "የማስከበሪያ ተመላሽ ግምገማ ይፈልጋል",
        message: `የክፍያ አቅራቢው ለማስከበሪያው ተመላሽ ሁኔታ ${status ?? "ያልታወቀ"} ብሎ አሳውቋል። በእጅ ያረጋግጡ።`,
      };
    }
    case "compliance.checked": {
      const status = item.title.replace(/^Compliance\s+/i, "").toLowerCase();
      const statusAm: Record<string, string> = { passed: "አልፏል", failed: "አልተሳካም", pending: "በመጠባበቅ ላይ" };
      return {
        title: `የተገዢነት ምርመራ ${statusAm[status] ?? status}`,
        message: `ለ“${auction}” የተገዢነት ምርመራ ${statusAm[status] ?? status}።`,
      };
    }
    case "verification.reviewed":
      return /verified/i.test(item.title)
        ? { title: "መለያዎ ተረጋግጧል", message: "መለያዎ ተረጋግጧል።" }
        : { title: "የመለያ ማረጋገጫ አልተፈቀደም", message: `የገምጋሚው ምክንያት፦ ${item.message}` };
    case "dispute.opened":
      return { title: "ቅሬታ ቀርቧል", message: `በ“${auction}” ላይ ቅሬታ ቀርቧል።` };
    case "dispute.assigned":
      return { title: "ቅሬታ ተመድቧል", message: "ለግምገማ ቅሬታ ተመድቦልዎታል።" };
    case "dispute.resolved":
      return { title: "የቅሬታ ውሳኔ ተመዝግቧል", message: `የገምጋሚው ምክንያት፦ ${item.message}` };
    case "organization.member_granted": {
      const roleKey = item.message.match(/the (.+?) role/)?.[1]?.toLowerCase();
      const roleLabels: Record<string, string> = {
        auction_officer: "የጨረታ ኃላፊ",
        org_admin: "የድርጅት አስተዳዳሪ",
        compliance_officer: "የተገዢነት ኃላፊ",
        super_admin: "ሱፐር አስተዳዳሪ",
        bidder: "ተጫራች",
      };
      return { title: "ወደ ድርጅት ተቀላቅለዋል", message: `የ${roleKey ? roleLabels[roleKey] ?? roleKey : "ድርጅት አባል"} ሚና ተሰጥቶዎታል። አዲሱን ፈቃድ ለማግኘት እንደገና ይግቡ።` };
    }
    case "report.published":
      return { title: "የጨረታ ሪፖርት ታትሟል", message: `ለ“${auction}” የተዘጋጀው ሪፖርት ታትሟል።` };
    case "anomaly.flagged": {
      const severity = item.title.replace(/^Anomaly /, "").toLowerCase();
      const severityAm: Record<string, string> = { low: "ዝቅተኛ", medium: "መካከለኛ", high: "ከፍተኛ", critical: "እጅግ ከፍተኛ" };
      return { title: `ያልተለመደ እንቅስቃሴ፦ ${severityAm[severity] ?? severity}`, message: `የማሽን ምልክት ማብራሪያ (ለሰው ግምገማ ያስፈልጋል)፦ ${item.message}` };
    }
    default:
      return { title: item.title, message: item.message };
  }
}
