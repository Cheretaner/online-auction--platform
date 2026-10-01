import { useState } from "react";
import { LoaderCircle, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAiAssist } from "@/features/ai/queries";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Which steps are still missing before this auction can be awarded?",
  "Draft a neutral description for a 1970s mechanical wristwatch lot.",
  "What should I verify before accepting a high-value bank transfer?",
];

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
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  function ask(value?: string) {
    const question = (value ?? prompt).trim();
    if (!question || assist.isPending) return;
    setPrompt("");
    setTurns((previous) => [...previous, { role: "user", text: question }]);
    assist.mutate(auctionId ? { prompt: question, auctionId } : { prompt: question }, {
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
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden /> Assistant
        </CardTitle>
        <CardDescription>
          Advice on listings, rules and bidding. It cannot place bids or change records.
          {auctionTitle ? ` Answering about “${auctionTitle}”.` : " No auction context — answers stay generic."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                size="sm"
                variant="outline"
                className="h-auto min-h-9 py-2 text-left whitespace-normal"
                onClick={() => ask(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : (
          <ul className="space-y-3" aria-live="polite">
            {turns.map((turn, index) => (
              <li
                key={`${turn.role}-${index}`}
                className={cn(
                  "max-w-[85%] rounded-lg border p-3",
                  turn.role === "user" ? "ml-auto border-primary/20 bg-primary/5" : "bg-card",
                )}
              >
                <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {turn.role === "user" ? "You" : "Assistant"}
                  {turn.provider ? (
                    <Badge variant="outline" className="font-mono">
                      {turn.fallback || turn.provider === "stub" ? "rule-based fallback" : turn.provider}
                    </Badge>
                  ) : null}
                </p>
                <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
              </li>
            ))}
            {assist.isPending ? (
              <li className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden /> Thinking…
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
            <Button type="submit" disabled={assist.isPending || prompt.trim().length === 0}>
              <Send aria-hidden />
              Ask
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
