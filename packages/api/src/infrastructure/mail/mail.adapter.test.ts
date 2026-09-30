import { describe, expect, it, vi } from "vitest";
import type { Transporter } from "nodemailer";
import { SmtpMailAdapter } from "./mail.adapter.js";

describe("SmtpMailAdapter", () => {
  it("verifies its configured transport", async () => {
    const transporter = {
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({ messageId: "mail-id" }),
    } as unknown as Transporter;
    const adapter = new SmtpMailAdapter(transporter, "notifications@example.com");

    await adapter.verify();

    expect(transporter.verify).toHaveBeenCalledOnce();
  });

  it("sends text mail using the configured sender", async () => {
    const transporter = {
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({ messageId: "mail-id" }),
    } as unknown as Transporter;
    const adapter = new SmtpMailAdapter(transporter, "notifications@example.com");

    await adapter.send({ to: "user@example.com", subject: "Reset password", body: "Use this link" });

    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: "notifications@example.com",
      to: "user@example.com",
      subject: "Reset password",
      text: "Use this link",
    });
  });
});
