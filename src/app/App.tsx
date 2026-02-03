import { Route, Routes } from "react-router-dom";
import { UploadPage } from "./UploadPage";
import { EditorPage } from "./EditorPage";

export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/editor/:id" element={<EditorPage />} />
    </Routes>
  );
};
