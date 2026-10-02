import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePublicAuctions } from "@/features/auctions/queries";
import { Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAiAssist } from "@/features/ai/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Which steps are still missing before this auction can be awarded?",
  "Draft a neutral description for a 1970s mechanical wristwatch lot.",
  "What should I verify before accepting a high-value bank transfer?",
];
const NO_AUCTION = "none";

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  provider?: string;
  fallback?: boolean;
}

/**
 * Free-text advisory chat. It only ever reads: the answers cannot bid, award or
 * change anything, and each answer shows which provider produced it so a
 * deterministic fallback is visible instead of pretending to be a model.
 */
export function Assistant({ auctionId, auctionTitle }: { auctionId?: string; auctionTitle?: string }) {
  const assist = useAiAssist();
  const auctions = usePublicAuctions({ limit: 50 });
  const [prompt, setPrompt] = useState("");
  const [selectedAuctionId, setSelectedAuctionId] = useState(auctionId ?? NO_AUCTION);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const selectedAuction = auctions.data?.items.find((auction) => auction.id === selectedAuctionId);
  const activeAuctionId = selectedAuctionId === NO_AUCTION ? undefined : selectedAuctionId;

  function ask(value?: string) {
    const question = (value ?? prompt).trim();
    if (!question || assist.isPending) return;
    setPrompt("");
    setTurns((previous) => [...previous, { role: "user", text: question }]);
    assist.mutate(activeAuctionId ? { prompt: question, auctionId: activeAuctionId } : { prompt: question }, {
      onSuccess: (result) =>
        setTurns((previous) => [
          ...previous,
          { role: "assistant", text: result.answer, provider: result.provider, fallback: result.fallback },
        ]),
      onError: (error) =>
        setTurns((previous) => [...previous, { role: "assistant", text: getErrorMessage(error) }]),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" aria-hidden /> Assistant
        </CardTitle>
        <CardDescription>
          Answers use CheretaNet workflows and verified auction details. The assistant cannot place bids or change records.
          {selectedAuction?.title || auctionTitle ? ` Context: ${selectedAuction?.title ?? auctionTitle}.` : " Choose an auction to ask about its live details."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xl space-y-1.5">
          <Label htmlFor="ai-auction-context">Auction context</Label>
          <Select value={selectedAuctionId} onValueChange={setSelectedAuctionId}>
            <SelectTrigger id="ai-auction-context">
              <SelectValue placeholder="General CheretaNet guidance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_AUCTION}>General CheretaNet guidance</SelectItem>
              {(auctions.data?.items ?? []).map((auction) => (
                <SelectItem key={auction.id} value={auction.id}>{auction.title} ({auction.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <Button key={suggestion} type="button" size="sm" variant="outline" onClick={() => ask(suggestion)}>
                {suggestion}
              </Button>
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {turns.map((turn, index) => (
              <li
                key={`${turn.role}-${index}`}
                className={cn("rounded-lg border p-3", turn.role === "user" && "bg-muted")}
              >
                <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {turn.role === "user" ? "You" : "Assistant"}
                  {turn.provider ? (
                    <Badge variant="outline" className="font-mono text-xs">
                      {turn.fallback || turn.provider === "stub" ? "rule-based fallback" : turn.provider}
                    </Badge>
                  ) : null}
                </p>
                {turn.role === "assistant" ? (
                  <div className="text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:my-2 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2 [&_ul]:list-disc">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
                )}
              </li>
            ))}
            {assist.isPending ? (
              <li className="text-sm text-muted-foreground" aria-live="polite">
                Thinking…
              </li>
            ) : null}
          </ul>
        )}
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            ask();
          }}
        >
          <Label htmlFor="ai-prompt">Ask the assistant</Label>
          <Textarea
            id="ai-prompt"
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask();
              }
            }}
            placeholder="e.g. What must happen before I can award this auction?"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Enter sends · Shift+Enter starts a new line</p>
            <Button type="submit" size="sm" disabled={assist.isPending || prompt.trim().length === 0}>
              <Send className="size-4" aria-hidden />
              Ask
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
