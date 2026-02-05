import { useI18nStore } from "../i18n/i18nStore";

export const PropertyPanel = () => {
  const { t } = useI18nStore((state) => ({
    t: state.t,
    locale: state.locale,
  }));
  return (
    <aside className="h-full border-l border-border bg-card p-4 text-sm text-muted-foreground">
      {t("editor.propertyPanel")}
    </aside>
  );
};
