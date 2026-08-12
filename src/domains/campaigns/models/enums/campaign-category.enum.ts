// Values match the app's CampaignCategory type exactly (both the filter
// chip labels in src/screens/main/campaigns/index.tsx and the strings
// rendered on campaign cards) — no separate translation layer needed
// between what the institution picks and what the donor sees/filters by.
export enum CampaignCategory {
  EDUCATION = 'Educação',
  FOOD = 'Alimentação',
  HEALTH = 'Saúde',
  HOUSING = 'Moradia',
  ENVIRONMENT = 'Meio Ambiente',
  OTHER = 'Outros',
}
