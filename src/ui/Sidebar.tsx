import { useI18nStore } from "../i18n/i18nStore";

export const Sidebar = () => {
  const { t } = useI18nStore((state) => ({
    t: state.t,
    locale: state.locale,
  }));
  return (
    <aside className="h-full border-r border-border bg-card p-4 text-sm text-muted-foreground">
      {t("editor.sidebar")}
    </aside>
  );
};
