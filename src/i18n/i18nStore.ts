import { create } from "zustand";
import { enUS } from "./locales/en-US";
import { zhCN } from "./locales/zh-CN";

export type Locale = "zh-CN" | "en-US";

type Dictionary = Record<string, unknown>;

const dictionaries: Record<Locale, Dictionary> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

const getValue = (dictionary: Dictionary, path: string) => {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Dictionary)) {
      return (acc as Dictionary)[key];
    }
    return undefined;
  }, dictionary);
};

type I18nState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: "zh-CN",
  setLocale: (locale) => set({ locale }),
  t: (key) => {
    const dictionary = dictionaries[get().locale];
    const value = getValue(dictionary, key);
    return typeof value === "string" ? value : key;
  },
}));
