import { z } from "zod";

// Сообщения об ошибках здесь — это ключи i18n (namespace "validation"),
// а не готовый текст. Компоненты, которые показывают errors.field.message,
// обязаны прогонять его через t() перед выводом (см. LanguageProvider/i18n).
export const registerSchema = z.object({
  firstName: z.string().min(1, "validation.firstNameRequired"),
  lastName: z.string().min(1, "validation.lastNameRequired"),
  email: z.string().email("validation.emailInvalid"),
  password: z.string().min(6, "validation.passwordMin"),
  businessName: z.string().min(1, "validation.businessNameRequired"),
  businessType: z.string().min(1, "validation.businessTypeRequired"),
  city: z.string().min(1, "validation.cityRequired"),
  employeesCount: z.coerce.number().int().min(0),
  clientsToday: z.coerce.number().int().min(0),
  clientsWeek: z.coerce.number().int().min(0),
  clientsMonth: z.coerce.number().int().min(0),
  clientsYear: z.coerce.number().int().min(0),
  mainProblem: z.string().optional().default(""),
  averageCheck: z.coerce.number().min(0),
  workHoursFrom: z.string().min(1, "validation.workHoursFromRequired"),
  workHoursTo: z.string().min(1, "validation.workHoursToRequired"),
  peakHours: z.string().optional().default(""),
});

export type RegisterSchema = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordRequired"),
});

export type LoginSchema = z.infer<typeof loginSchema>;

export const settingsSchema = z.object({
  firstName: z.string().min(1, "validation.firstNameRequired"),
  lastName: z.string().min(1, "validation.lastNameRequired"),
  businessName: z.string().min(1, "validation.businessNameRequired"),
});

export type SettingsSchema = z.infer<typeof settingsSchema>;


// label — исходный текст на русском (используется в серверных AI-промптах,
// см. lib/growthTools.ts, где язык ответа AI сознательно не меняется).
// labelKey — ключ i18n (namespace "business.types") для отображения в UI.
export const BUSINESS_TYPES: { value: string; label: string; labelKey: string }[] = [
  { value: "cafe", label: "Кафе / ресторан", labelKey: "business.types.cafe" },
  { value: "shop", label: "Магазин", labelKey: "business.types.shop" },
  { value: "salon", label: "Салон красоты", labelKey: "business.types.salon" },
  { value: "pharmacy", label: "Аптека", labelKey: "business.types.pharmacy" },
  { value: "carwash", label: "Автомойка", labelKey: "business.types.carwash" },
  { value: "other", label: "Другое", labelKey: "business.types.other" },
];
