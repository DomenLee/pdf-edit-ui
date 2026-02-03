import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { savePdf } from "../storage/pdfStorage";
import { useEditorStore } from "../state/editorStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";

export const UploadPage = () => {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const setCurrentId = useEditorStore((state) => state.setCurrentId);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError("只支持 PDF 文件，请重新选择。");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const documentId = await savePdf(file);
      setCurrentId(documentId);
      navigate(`/editor/${documentId}`);
    } catch (err) {
      console.error(err);
      setError("保存失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>上传 PDF</CardTitle>
          <CardDescription>
            选择文件后自动进入编辑页面。
          </CardDescription>
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
            选择 PDF 文件
          </Button>
          {isSaving && <p className="text-sm text-muted-foreground">正在保存...</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
};
