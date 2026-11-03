export const storeInput =
  "w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-stone-100 dark:placeholder:text-stone-500";
export const storeButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-900 px-5 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50";
export const storeMoney = (amount: string | number, currency = "PEN") =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(
    Number(amount),
  );
