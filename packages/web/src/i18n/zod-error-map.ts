import { z } from "zod";
import { getLocale } from "./core";

export const zodErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (getLocale() !== "am") return { message: ctx.defaultError };
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "ይህ መስክ ያስፈልጋል" };
      return { message: "የገባው ዋጋ ትክክል አይደለም" };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "ትክክለኛ የኢሜይል አድራሻ ያስገቡ" };
      if (issue.validation === "url") return { message: "ትክክለኛ ድረ-ገጽ አድራሻ ያስገቡ" };
      return { message: "የገባው ቅርጸት ትክክል አይደለም" };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: Number(issue.minimum) <= 1 ? "ይህ መስክ ያስፈልጋል" : `ቢያንስ ${issue.minimum} ፊደላት ያስገቡ` };
      }
      if (issue.type === "number") return { message: `ቢያንስ ${issue.minimum} መሆን አለበት` };
      return { message: "በጣም ትንሽ ነው" };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `ከ${issue.maximum} ፊደላት መብለጥ የለበትም` };
      if (issue.type === "number") return { message: `ከ${issue.maximum} መብለጥ የለበትም` };
      return { message: "በጣም ትልቅ ነው" };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "ከተሰጡት አማራጮች አንዱን ይምረጡ" };
    case z.ZodIssueCode.invalid_date:
      return { message: "ትክክለኛ ቀን ያስገቡ" };
    default:
      return { message: "የገባው ዋጋ ትክክል አይደለም" };
  }
};


const SCHEMA_MESSAGES: Record<string, string> = {
  "invalid amount": "ትክክለኛ የገንዘብ መጠን ያስገቡ",
  "commitment hash must be sha256 hex": "የጨረታ ቁልፉ ትክክለኛ SHA-256 ሄክስ እሴት መሆኑን ያረጋግጡ",
  "Invalid datetime": "ትክክለኛ ቀንና ሰዓት ያስገቡ",
  "Fayda numbers contain 12 digits": "የፋይዳ ቁጥር 12 አሃዞች መያዝ አለበት",
  "TIN must use 4-20 letters, numbers, / or -": "የTIN ቁጥር 4–20 ፊደሎች፣ ቁጥሮች፣ / ወይም - መያዝ አለበት",
  "Enter a valid kebele ID number": "ትክክለኛ የቀበሌ መታወቂያ ቁጥር ያስገቡ",
  "Enter a valid passport number": "ትክክለኛ የፓስፖርት ቁጥር ያስገቡ",
  "Rejection reason is required": "ውድቅ ለማድረግ ምክንያት ያስፈልጋል",
  "Either userId or email is required": "የተጠቃሚ መለያ ወይም ኢሜይል ያስፈልጋል",
  "Decision reason is required when rejecting": "ውሳኔን ውድቅ ሲያደርጉ ምክንያት ማስገባት ያስፈልጋል",
  "Business name is required for business accounts": "ለንግድ ድርጅት መለያ የድርጅቱ ስም ያስፈልጋል",
  "TIN number is required for business accounts": "ለንግድ ድርጅት መለያ የግብር ከፋይ መለያ ቁጥር ያስፈልጋል",
};

export function localizeSchemaMessage(message: string): string {
  if (getLocale() !== "am") return message;
  return SCHEMA_MESSAGES[message] ?? message;
}
