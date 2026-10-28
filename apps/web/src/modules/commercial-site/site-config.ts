export const commercialSite = {
  brandName: "Syndes",
  brandMark: "S",
  stage: "MVP em desenvolvimento",
  paymentPeriodDays: 30,
  pricing: {
    introMonths: 2,
    introMonthly: 69.9,
    regularMonthly: 129.99,
  },
  currencyFormatter: new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }),
} as const;
