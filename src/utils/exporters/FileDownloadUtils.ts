export const copyToClipboard = (text: string): Promise<void> => {
  return navigator.clipboard.writeText(text);
};

export const downloadFile = (
  content: string,
  filename: string,
  mimeType: string
) => {
  const dataStr =
    `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", filename);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};
