import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { savePdf } from "../storage/pdfStorage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useI18nStore } from "../i18n/i18nStore";

export const UploadPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useI18nStore((state) => ({
    t: state.t,
    locale: state.locale,
  }));

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError(t("upload.errorInvalid"));
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const documentId = await savePdf(file);
      navigate(`/editor/${documentId}`);
    } catch (err) {
      console.error(err);
      setError(t("upload.errorSave"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("upload.title")}</CardTitle>
          <CardDescription>{t("upload.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            disabled={isSaving}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isSaving}
          >
            {t("upload.selectFile")}
          </Button>
          {isSaving && (
            <p className="text-sm text-muted-foreground">
              {t("upload.saving")}
            </p>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
};
