const loadedScripts = new Map<string, Promise<void>>();
const loadedStyles = new Set<string>();

export const loadScript = (src: string): Promise<void> => {
  if (loadedScripts.has(src)) {
    return loadedScripts.get(src)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    // Check if script tag is already in DOM
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadedScripts.delete(src);
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });

  loadedScripts.set(src, promise);
  return promise;
};

export const loadStyle = (href: string): void => {
  if (loadedStyles.has(href)) return;

  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) {
    loadedStyles.add(href);
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  loadedStyles.add(href);
};

export const loadPdfJS = async () => {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  // Configure worker
  const pdfjsLib = (window as any).pdfjsLib;
  if (pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return pdfjsLib;
};

export const loadJSZip = async () => {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  return (window as any).JSZip;
};

export const loadDocxPreview = async () => {
  // docx-preview might require jszip to be loaded first
  await loadJSZip();
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/docx-preview/0.1.15/docx-preview.min.js');
  return (window as any).docx;
};

export const loadSheetJS = async () => {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  return (window as any).XLSX;
};
