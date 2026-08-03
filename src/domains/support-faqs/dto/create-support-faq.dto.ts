export type SupportFaqItemDto = {
  answer?: string;
  order?: number;
  question?: string;
};

export class CreateSupportFaqDto {
  isCurrent?: boolean;

  items?: SupportFaqItemDto[];

  title?: string;

  version?: string;
}
