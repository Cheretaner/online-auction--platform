# Telegram voice notes

Voice notes are handled only in private Telegram chats. Audio is downloaded into memory with a 20 MiB cap and a 20-second download timeout; it is not written to document storage. The service submits it to a configured transcription provider, interprets the transcript, then discards the audio buffer after the update is processed.

## Language

Linked users can choose `/language en` or `/language am`. The preference is stored on the portal profile by migration 022 and applies to the bot's start/help, auction discovery and detail, status, audit verification, and bid confirmation/result messages. For an unlinked user, the bot follows Telegram's locale; voice replies follow the detected/request language. Amharic translations and provider transcription quality still require fluent-speaker review before being represented as production-validated.

The saved preference also localizes the supported auction watchlist status and bid-activity notifications. Other notification types keep their authored message until a reviewed translation is added; unknown notification types are not machine-translated.

## Providers

- Gemini processes audio and extracts a transcript and intent in one request.
- OpenRouter uses its audio transcription endpoint (default model `openai/whisper-1`), then a text completion to classify the transcript. Configure `OPENROUTER_TRANSCRIPTION_MODEL` if a different OpenRouter speech-to-text model is approved for the required languages.
- `AI_PROVIDER=auto` tries Gemini then OpenRouter. `gemini` and `openrouter` prefer the named provider and try the other configured provider after a failure. `stub` disables voice processing; the bot tells the user to use text commands instead of pretending it heard them.

## Bid safety

Voice interpretation is advisory. A model response never places a bid. The bot only offers a confirmation button after it has an explicit positive amount and a valid live public auction ID. The user must confirm, and the normal linked-account, KYC, deposit, auction-state, bid-limit, and idempotency rules still apply. Unclear or incomplete speech does not produce a bid action.

Do not promise transcription accuracy for Amharic or another language without acceptance review by fluent speakers. Audio and transcripts are sent to whichever configured AI provider handles the request; the operator must disclose this processing and obtain any required consent under the organization's privacy policy.
