import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DemoCheckoutPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  if (process.env.DEMO_MODE !== "true") notFound();

  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, organization: true },
  });
  if (!invoice) notFound();

  return (
    <main className="mx-auto max-w-lg p-8">
      <p className="text-sm font-semibold text-indigo-600">PAYPING DEMO CHECKOUT</p>
      <h1 className="mt-3 text-2xl font-bold">{invoice.organization.name}</h1>
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <p>Invoice {invoice.invoiceNumber}</p>
        <p className="mt-2 text-3xl font-bold">
          ₹{(invoice.amountPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </p>
        <p className="mt-2 text-slate-600">For {invoice.client.name}</p>
        {invoice.status === "PAID" ? (
          <p className="mt-6 rounded bg-green-50 p-3 text-green-800">This invoice is paid.</p>
        ) : (
          <form className="mt-6" action={`/api/demo/pay/${encodeURIComponent(invoice.id)}`} method="post">
            <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
              Pay now (demo)
            </button>
          </form>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Demo payment only. No charge will be made.
        </p>
      </div>
    </main>
  );
}
