import type { WhatsAppSender } from "./sender";

export const whatsappSender: WhatsAppSender = process.env.DEMO_MODE === "true"
  ? {
      async sendTemplate(input) {
        const waMessageId = `demo_${crypto.randomUUID()}`;
        console.log("[demo-whatsapp]", JSON.stringify({
          to: input.toE164,
          template: input.template,
          params: input.params,
          waMessageId,
        }));
        return { waMessageId };
      },
    }
  : {
      async sendTemplate() {
        throw new Error("WhatsApp sending is unavailable until Phase 2.");
      },
    };
