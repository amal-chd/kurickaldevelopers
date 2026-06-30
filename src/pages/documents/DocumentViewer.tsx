import React, { useEffect, useState, useRef } from 'react';
import { 
  X, ZoomIn, ZoomOut, RotateCw, FileText, Download, Share2, Printer, 
  ChevronLeft, ChevronRight, Search, Play, Pause, Volume2, Moon, Sun, 
  Folder, File, Eye, ListFilter, AlertCircle
} from 'lucide-react';
import { loadPdfJS, loadJSZip, loadDocxPreview, loadSheetJS } from '../../lib/lazyLoad';
import { getCachedDocument, addRecentDocument } from '../../lib/documentCache';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Card from '../../components/ui/Card';
import toast from 'react-hot-toast';

interface DocumentViewerProps {
  doc: {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
  };
  onClose: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ doc, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);

  // PDF Viewer State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdfSearchQuery, setPdfSearchQuery] = useState('');
  const [pdfSearchResults, setPdfSearchResults] = useState<{ page: number; text: string }[]>([]);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRenderTaskRef = useRef<any>(null);

  // Office state (DOCX / XLSX / PPTX / ZIP)
  const [officeContent, setOfficeContent] = useState<any>(null);
  const [officeType, setOfficeType] = useState<'docx' | 'xlsx' | 'pptx' | 'zip' | 'text' | 'csv' | 'json' | 'xml' | null>(null);
  
  // XLSX Sheet State
  const [xlsxSheets, setXlsxSheets] = useState<string[]>([]);
  const [xlsxActiveSheet, setXlsxActiveSheet] = useState<string>('');
  const [xlsxSearchQuery, setXlsxSearchQuery] = useState('');

  // PPTX state
  const [pptxSlides, setPptxSlides] = useState<string[][]>([]); // slides, each slide has lines
  const [activeSlide, setActiveSlide] = useState(0);

  // ZIP state
  const [zipFiles, setZipFiles] = useState<{ path: string; isDir: boolean; size: number }[]>([]);
  const [zipInstance, setZipInstance] = useState<any>(null);
  const [zipSelectedFileContent, setZipSelectedFileContent] = useState<{ name: string; content: string; type: string } | null>(null);
  const [zipSelectedFileLoading, setZipSelectedFileLoading] = useState(false);

  // Text, JSON, CSV State
  const [textRawContent, setTextRawContent] = useState<string>('');
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [jsonParsed, setJsonParsed] = useState<any>(null);

  // Audio/Video speed
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);


  // Pan State for Images
  const [panState, setPanState] = useState({ x: 0, y: 0, isDragging: false, startX: 0, startY: 0 });

  // Add file to recents when opened
  useEffect(() => {
    addRecentDocument(doc);
  }, [doc]);

  // Load and cache file
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const loadData = async () => {
      try {
        const blob = await getCachedDocument(doc.url);
        if (!active) return;
        setFileBlob(blob);
        const bUrl = URL.createObjectURL(blob);
        setBlobUrl(bUrl);

        // Determine how to parse based on mimetype / extension
        const extension = doc.name.split('.').pop()?.toLowerCase();
        
        if (doc.mimeType === 'application/pdf' || extension === 'pdf') {
          // Initialize PDF.js
          const pdfjsLib = await loadPdfJS();
          const pdf = await pdfjsLib.getDocument(bUrl).promise;
          if (!active) return;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setPageNum(1);
        } else if (doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
          setOfficeType('docx');
        } else if (doc.mimeType.includes('excel') || doc.mimeType.includes('spreadsheet') || extension === 'xlsx' || extension === 'xls') {
          const XLSX = await loadSheetJS();
          const arrayBuffer = await blob.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          if (!active) return;
          setOfficeType('xlsx');
          setXlsxSheets(workbook.SheetNames);
          setXlsxActiveSheet(workbook.SheetNames[0]);
          setOfficeContent(workbook);
        } else if (doc.mimeType.includes('presentation') || doc.mimeType.includes('powerpoint') || extension === 'pptx' || extension === 'ppt') {
          // Custom PPTX Text Viewer
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(blob);
          const slidesText: string[][] = [];
          
          // Loop and try to find slides ppt/slides/slide[N].xml
          let slideIndex = 1;
          while (slideIndex > 0) {
            const file = zip.file(`ppt/slides/slide${slideIndex}.xml`);
            if (!file) break;
            const xmlText = await file.async('string');
            // Extract text from <a:t>...</a:t>
            const matches = [...xmlText.matchAll(/<a:t>(.*?)<\/a:t>/g)];
            const textLines = matches.map(m => m[1]).filter(t => t.trim().length > 0);
            slidesText.push(textLines);
            slideIndex++;
          }

          if (!active) return;
          setOfficeType('pptx');
          setPptxSlides(slidesText);
          setActiveSlide(0);
        } else if (doc.mimeType.includes('zip') || extension === 'zip') {
          const JSZip = await loadJSZip();
          const zip = await JSZip.loadAsync(blob);
          if (!active) return;
          setZipInstance(zip);
          const filesList: { path: string; isDir: boolean; size: number }[] = [];
          zip.forEach((relativePath: string, file: any) => {
            filesList.push({
              path: relativePath,
              isDir: file.dir,
              size: file._data?.uncompressedSize || 0
            });
          });
          setOfficeType('zip');
          setZipFiles(filesList);
        } else if (doc.mimeType.includes('csv') || extension === 'csv') {
          const text = await blob.text();
          if (!active) return;
          const rows = text.split('\n').map(row => {
            // Very simple CSV parser (split by comma, ignoring commas inside quotes for now)
            return row.split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim());
          });
          setOfficeType('csv');
          setCsvRows(rows.filter(r => r.length > 0 && r.some(c => c.length > 0)));
          setTextRawContent(text);
        } else if (doc.mimeType.includes('json') || extension === 'json') {
          const text = await blob.text();
          if (!active) return;
          try {
            setJsonParsed(JSON.parse(text));
          } catch (_) {}
          setOfficeType('json');
          setTextRawContent(text);
        } else if (doc.mimeType.includes('xml') || extension === 'xml') {
          const text = await blob.text();
          if (!active) return;
          setOfficeType('xml');
          setTextRawContent(text);
        } else if (doc.mimeType.startsWith('text/') || ['txt', 'md', 'html', 'css', 'js', 'ts'].includes(extension || '')) {
          const text = await blob.text();
          if (!active) return;
          setOfficeType('text');
          setTextRawContent(text);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Error loading file content');
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [doc.url]);

  // Handle PDF page rendering on canvas
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;

    const renderPage = async () => {
      try {
        if (pdfRenderTaskRef.current) {
          pdfRenderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        const canvas = pdfCanvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale: zoom * 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        pdfRenderTaskRef.current = renderTask;

        await renderTask.promise;
        pdfRenderTaskRef.current = null;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('PDF Render Error:', err);
        }
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, zoom]);

  // Handle DOCX rendering
  const docxContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (officeType !== 'docx' || !fileBlob || !docxContainerRef.current) return;

    const renderDocx = async () => {
      try {
        const docx = await loadDocxPreview();
        if (docxContainerRef.current) {
          docxContainerRef.current.innerHTML = '';
          await docx.renderAsync(fileBlob, docxContainerRef.current);
        }
      } catch (e) {
        console.error('DOCX render error:', e);
        toast.error('Failed to parse Word document formatting');
      }
    };

    renderDocx();
  }, [officeType, fileBlob]);

  // PDF Text search
  const handlePdfSearch = async () => {
    if (!pdfDoc || !pdfSearchQuery.trim()) return;
    setLoading(true);
    try {
      const results: { page: number; text: string }[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const textStr = textContent.items.map((item: any) => item.str).join(' ');
        if (textStr.toLowerCase().includes(pdfSearchQuery.toLowerCase())) {
          // Highlight/snippet
          const idx = textStr.toLowerCase().indexOf(pdfSearchQuery.toLowerCase());
          const snippet = '...' + textStr.substring(Math.max(0, idx - 30), Math.min(textStr.length, idx + pdfSearchQuery.length + 30)) + '...';
          results.push({ page: i, text: snippet });
        }
      }
      setPdfSearchResults(results);
      if (results.length === 0) {
        toast.error('No matches found in PDF');
      } else {
        toast.success(`Found ${results.length} matches`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to search inside PDF');
    } finally {
      setLoading(false);
    }
  };

  // ZIP File preview in-memory
  const previewZipFile = async (path: string) => {
    if (!zipInstance) return;
    setZipSelectedFileLoading(true);
    try {
      const file = zipInstance.file(path);
      const extension = path.split('.').pop()?.toLowerCase() || '';
      
      let type = 'text';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
        type = 'image';
      } else if (['mp3', 'wav', 'ogg'].includes(extension)) {
        type = 'audio';
      } else if (['mp4', 'webm', 'mov'].includes(extension)) {
        type = 'video';
      }

      let content = '';
      if (type === 'image') {
        const base64 = await file.async('base64');
        content = `data:image/${extension};base64,${base64}`;
      } else if (type === 'audio' || type === 'video') {
        const blob = await file.async('blob');
        content = URL.createObjectURL(blob);
      } else {
        content = await file.async('string');
      }

      setZipSelectedFileContent({ name: path, content, type });
    } catch (e) {
      console.error(e);
      toast.error('Could not preview this zip file entry');
    } finally {
      setZipSelectedFileLoading(false);
    }
  };

  // Web Share
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: doc.name,
        url: doc.url,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(doc.url);
      toast.success('Document download link copied to clipboard!');
    }
  };

  // Print support
  const handlePrint = () => {
    if (!blobUrl) return;
    
    // For PDF and Images, open hidden iframe and trigger print
    const printFrame = document.createElement('iframe');
    printFrame.style.display = 'none';
    printFrame.src = blobUrl;
    
    document.body.appendChild(printFrame);
    printFrame.onload = () => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      // Remove element after some time
      setTimeout(() => document.body.removeChild(printFrame), 1000);
    };
  };

  // Zoom helpers
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.25, 4.0));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => {
    setZoom(1.0);
    setPanState({ x: 0, y: 0, isDragging: false, startX: 0, startY: 0 });
    setRotation(0);
  };

  // Image Drag Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1.0) return;
    setPanState(prev => ({
      ...prev,
      isDragging: true,
      startX: e.clientX - prev.x,
      startY: e.clientY - prev.y
    }));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panState.isDragging) return;
    setPanState(prev => ({
      ...prev,
      x: e.clientX - prev.startX,
      y: e.clientY - prev.startY
    }));
  };

  const handleMouseUp = () => {
    setPanState(prev => ({ ...prev, isDragging: false }));
  };

  // JSON Collapsible Tree Node Component
  const JsonTree: React.FC<{ data: any; label?: string; depth?: number }> = ({ data, label, depth = 0 }) => {
    const [collapsed, setCollapsed] = useState(depth > 1);
    const isObject = data !== null && typeof data === 'object';
    const isArray = Array.isArray(data);

    if (!isObject) {
      let valStr = String(data);
      let valColor = 'text-blue-600 dark:text-blue-400';
      if (typeof data === 'string') {
        valStr = `"${data}"`;
        valColor = 'text-green-600 dark:text-green-400';
      } else if (typeof data === 'boolean') {
        valColor = 'text-amber-600 dark:text-amber-400';
      } else if (data === null) {
        valColor = 'text-gray-500';
      }

      return (
        <div className="pl-4 font-mono text-xs py-0.5">
          {label && <span className="text-purple-600 dark:text-purple-400 mr-1">{label}:</span>}
          <span className={valColor}>{valStr}</span>
        </div>
      );
    }

    const keys = isArray ? data : Object.keys(data);
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';

    return (
      <div className="pl-4 font-mono text-xs py-0.5" style={{ marginLeft: depth > 0 ? '8px' : '0' }}>
        <div className="flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 select-none" onClick={() => setCollapsed(!collapsed)}>
          <span className="text-gray-400 text-[10px] mr-1">{collapsed ? '▶' : '▼'}</span>
          {label && <span className="text-purple-600 dark:text-purple-400 mr-1">{label}:</span>}
          <span className="text-gray-500">{bracketOpen} <span className="text-xs text-gray-400">({keys.length} items)</span></span>
        </div>
        {!collapsed && (
          <div className="border-l border-gray-200 dark:border-gray-700 ml-2">
            {keys.map((k: any, i: number) => (
              <JsonTree 
                key={i} 
                data={isArray ? k : data[k]} 
                label={isArray ? undefined : String(k)} 
                depth={depth + 1} 
              />
            ))}
          </div>
        )}
        {!collapsed && <div className="pl-4 text-gray-500">{bracketClose}</div>}
        {collapsed && <span className="hidden"></span>}
      </div>
    );
  };

  // Formatted CSV renderer
  const renderCSVTable = () => {
    const filteredRows = csvRows.filter((row, idx) => {
      if (idx === 0) return true; // header
      if (!csvSearchQuery) return true;
      return row.some(cell => cell.toLowerCase().includes(csvSearchQuery.toLowerCase()));
    });

    if (filteredRows.length === 0) return <div className="text-center py-8 text-gray-500">No matches found</div>;

    const headers = filteredRows[0];
    const dataRows = filteredRows.slice(1);

    return (
      <div className="overflow-auto max-h-[70vh] border rounded-xl">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 uppercase border-b border-r dark:border-gray-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {dataRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-2 border-r dark:border-gray-700 dark:text-gray-300 font-mono whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Formatted XLSX renderer
  const renderXLSXTable = () => {
    if (!officeContent || !xlsxActiveSheet) return null;
    const XLSX = (window as any).XLSX;
    const sheet = officeContent.Sheets[xlsxActiveSheet];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    if (json.length === 0) return <div className="text-center py-8 text-gray-500">Empty worksheet</div>;

    const filteredJson = json.filter((row, idx) => {
      if (idx === 0) return true; // headers
      if (!xlsxSearchQuery) return true;
      return row.some(cell => String(cell).toLowerCase().includes(xlsxSearchQuery.toLowerCase()));
    });

    return (
      <div className="overflow-auto max-h-[60vh] border rounded-xl">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 text-left">
            <tr>
              {filteredJson[0]?.map((h, i) => (
                <th key={i} className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-300 border-b border-r dark:border-gray-700">
                  {String(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {filteredJson.slice(1).map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left">
                {filteredJson[0]?.map((_, cIdx) => {
                  const cell = row[cIdx];
                  return (
                    <td key={cIdx} className="px-4 py-2 border-r dark:border-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {cell !== undefined && cell !== null ? String(cell) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${isDarkMode ? 'dark bg-gray-950 text-white' : 'bg-gray-100 text-gray-900'} transition-colors duration-200`}>
      {/* Top Header Bar */}
      <header className="h-16 px-4 flex items-center justify-between border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-primary/10 text-primary flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold truncate max-w-xs md:max-w-md text-sm md:text-base">{doc.name}</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {((doc.size || 0) / (1024 * 1024)).toFixed(2)} MB • {doc.mimeType}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button 
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <button 
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors hidden sm:inline-flex"
            onClick={handlePrint}
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button 
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            onClick={handleShare}
            title="Share or Copy Link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <a 
            href={doc.url} 
            download={doc.name}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </a>

          <div className="h-6 w-[1px] bg-gray-200 dark:bg-gray-800 mx-1"></div>

          <button 
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 rounded-xl transition-colors"
            onClick={onClose}
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Search Sidebar (for PDF searches only) */}
        {doc.mimeType === 'application/pdf' && pdfSearchResults.length > 0 && (
          <div className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0 overflow-hidden">
            <div className="p-3 border-b dark:border-gray-800 flex justify-between items-center">
              <span className="font-semibold text-xs uppercase tracking-wider text-gray-400">Search Results</span>
              <button className="text-xs text-primary hover:underline" onClick={() => setPdfSearchResults([])}>Clear</button>
            </div>
            <div className="flex-1 overflow-auto divide-y dark:divide-gray-800">
              {pdfSearchResults.map((res, i) => (
                <button 
                  key={i} 
                  className={`w-full text-left p-3 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 flex flex-col gap-1 transition-colors ${pageNum === res.page ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                  onClick={() => setPageNum(res.page)}
                >
                  <span className="font-semibold text-primary">Page {res.page}</span>
                  <span className="text-gray-600 dark:text-gray-400 line-clamp-2">{res.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Left ZIP File Sidebar */}
        {officeType === 'zip' && zipFiles.length > 0 && (
          <div className="w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0 overflow-hidden">
            <div className="p-3 border-b dark:border-gray-800 flex items-center justify-between">
              <span className="font-semibold text-xs uppercase tracking-wider text-gray-400">ZIP File Entries</span>
              <Folder className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {zipFiles.map((f, i) => (
                <button
                  key={i}
                  disabled={f.isDir}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 transition-all ${
                    zipSelectedFileContent?.name === f.path 
                      ? 'bg-primary text-white' 
                      : f.isDir 
                        ? 'text-gray-400 cursor-default' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => previewZipFile(f.path)}
                >
                  {f.isDir ? <Folder className="w-3.5 h-3.5" /> : <File className="w-3.5 h-3.5" />}
                  <span className="truncate flex-1">{f.path}</span>
                  {!f.isDir && <span className="text-[10px] opacity-60">({(f.size / 1024).toFixed(1)} KB)</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Central Display Area */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto min-w-0">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-gray-400">Rendering document content...</p>
            </div>
          ) : error ? (
            <div className="max-w-md text-center p-6 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-2xl shadow-sm space-y-4">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h2 className="font-semibold text-lg">Failed to Preview</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
              <a 
                href={doc.url} 
                download={doc.name} 
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-hover shadow-sm"
              >
                <Download className="w-4 h-4" /> Download to View externally
              </a>
            </div>
          ) : (
            <div 
              className={`w-full h-full flex flex-col items-center justify-center transition-all ${
                isDarkMode ? 'dark-filter' : ''
              }`}
              style={{
                filter: isDarkMode && (doc.mimeType === 'application/pdf' || officeType === 'docx') ? 'invert(1) hue-rotate(180deg)' : 'none'
              }}
            >
              {/* PDF Previewer */}
              {doc.mimeType === 'application/pdf' && (
                <div className="flex-1 w-full flex items-center justify-center overflow-auto p-4 bg-gray-500/20 rounded-xl relative">
                  <canvas 
                    ref={pdfCanvasRef} 
                    className="shadow-lg bg-white rounded-lg max-w-full"
                    style={{ transform: `rotate(${rotation}deg)` }}
                  />
                </div>
              )}

              {/* DOCX Previewer */}
              {officeType === 'docx' && (
                <div 
                  ref={docxContainerRef} 
                  className="flex-1 w-full bg-white text-gray-800 overflow-auto p-8 rounded-xl shadow-inner max-w-4xl"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                />
              )}

              {/* XLSX Previewer */}
              {officeType === 'xlsx' && (
                <Card className="w-full max-w-5xl h-full flex flex-col bg-white dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between border-b dark:border-gray-800 pb-3 gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full md:max-w-xl">
                      {xlsxSheets.map((sheet) => (
                        <button
                          key={sheet}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            xlsxActiveSheet === sheet 
                              ? 'bg-primary text-white' 
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => setXlsxActiveSheet(sheet)}
                        >
                          {sheet}
                        </button>
                      ))}
                    </div>
                    <div className="relative w-full md:w-48">
                      <input 
                        type="text"
                        placeholder="Search sheet..."
                        value={xlsxSearchQuery}
                        onChange={(e) => setXlsxSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 h-8 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-lg focus:outline-none dark:text-white"
                      />
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex-1 p-2 overflow-auto">
                    {renderXLSXTable()}
                  </div>
                </Card>
              )}

              {/* PPTX Previewer */}
              {officeType === 'pptx' && pptxSlides.length > 0 && (
                <div className="w-full max-w-3xl flex flex-col items-center gap-4">
                  <div className="w-full aspect-[4/3] bg-white dark:bg-gray-900 rounded-2xl shadow-lg border dark:border-gray-800 p-8 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-4 right-4 text-xs font-bold text-gray-400">
                      Slide {activeSlide + 1} of {pptxSlides.length}
                    </div>
                    <div className="space-y-4 max-h-full overflow-auto">
                      {pptxSlides[activeSlide]?.map((line, idx) => (
                        <p key={idx} className={idx === 0 ? "text-2xl font-bold text-primary dark:text-white border-b dark:border-gray-850 pb-2" : "text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-2"}>
                          {line}
                        </p>
                      )) || <div className="text-center text-gray-400">No content on this slide</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      disabled={activeSlide === 0}
                      onClick={() => setActiveSlide(prev => prev - 1)}
                      className="p-2 bg-white dark:bg-gray-900 border dark:border-gray-800 disabled:opacity-40 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors shadow-sm"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-semibold">Slide {activeSlide + 1} / {pptxSlides.length}</span>
                    <button 
                      disabled={activeSlide === pptxSlides.length - 1}
                      onClick={() => setActiveSlide(prev => prev + 1)}
                      className="p-2 bg-white dark:bg-gray-900 border dark:border-gray-800 disabled:opacity-40 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors shadow-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ZIP Sub-preview workspace */}
              {officeType === 'zip' && (
                <div className="w-full h-full flex flex-col bg-white dark:bg-gray-950 p-4 rounded-xl">
                  {zipSelectedFileLoading ? (
                    <div className="m-auto flex flex-col items-center gap-3">
                      <Spinner />
                      <p className="text-xs text-gray-400">Unzipping file entry...</p>
                    </div>
                  ) : zipSelectedFileContent ? (
                    <div className="h-full flex flex-col gap-2 relative">
                      <div className="flex items-center justify-between border-b dark:border-gray-850 pb-2 flex-shrink-0">
                        <span className="font-semibold text-xs text-primary">{zipSelectedFileContent.name}</span>
                        <button 
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg"
                          onClick={() => setZipSelectedFileContent(null)}
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl">
                        {zipSelectedFileContent.type === 'image' ? (
                          <img src={zipSelectedFileContent.content} alt={zipSelectedFileContent.name} className="max-w-full max-h-96 object-contain mx-auto rounded-lg" />
                        ) : zipSelectedFileContent.type === 'audio' ? (
                          <audio src={zipSelectedFileContent.content} controls className="mx-auto mt-10" />
                        ) : zipSelectedFileContent.type === 'video' ? (
                          <video src={zipSelectedFileContent.content} controls className="max-w-full max-h-96 mx-auto rounded-lg" />
                        ) : (
                          <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{zipSelectedFileContent.content}</pre>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="m-auto text-center space-y-2">
                      <Folder className="w-12 h-12 text-gray-300 mx-auto" />
                      <p className="text-xs text-gray-400">Select a file from the ZIP archive sidebar to preview it</p>
                    </div>
                  )}
                </div>
              )}

              {/* TXT Previewer */}
              {officeType === 'text' && (
                <div className="flex-1 w-full max-w-4xl bg-white dark:bg-gray-900 border dark:border-gray-800 p-8 rounded-2xl shadow-sm overflow-auto">
                  <pre 
                    className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed"
                    style={{ fontSize: `${zoom * 0.75}rem` }}
                  >
                    {textRawContent}
                  </pre>
                </div>
              )}

              {/* CSV Previewer */}
              {officeType === 'csv' && (
                <Card className="w-full max-w-5xl h-full flex flex-col bg-white dark:bg-gray-900">
                  <div className="flex justify-between items-center border-b dark:border-gray-800 pb-3 mb-3">
                    <span className="font-semibold text-sm">CSV Table Viewer</span>
                    <div className="relative w-48">
                      <input 
                        type="text"
                        placeholder="Filter rows..."
                        value={csvSearchQuery}
                        onChange={(e) => setCsvSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 h-8 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-lg focus:outline-none dark:text-white"
                      />
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    {renderCSVTable()}
                  </div>
                </Card>
              )}

              {/* JSON Collapsible Explorer */}
              {officeType === 'json' && (
                <div className="flex-1 w-full max-w-4xl bg-white dark:bg-gray-900 border dark:border-gray-800 p-6 rounded-2xl shadow-sm overflow-auto text-left">
                  {jsonParsed ? (
                    <JsonTree data={jsonParsed} />
                  ) : (
                    <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre">{textRawContent}</pre>
                  )}
                </div>
              )}

              {/* XML Viewer */}
              {officeType === 'xml' && (
                <div className="flex-1 w-full max-w-4xl bg-white dark:bg-gray-900 border dark:border-gray-800 p-6 rounded-2xl shadow-sm overflow-auto text-left">
                  <pre className="text-xs font-mono text-gray-750 dark:text-gray-300 whitespace-pre-wrap">{textRawContent}</pre>
                </div>
              )}

              {/* Image Previewer with Pan & Zoom & Rotation */}
              {doc.mimeType.startsWith('image/') && blobUrl && (
                <div 
                  className="flex-1 w-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <img 
                    src={blobUrl} 
                    alt={doc.name} 
                    className="max-h-full max-w-full object-contain pointer-events-none rounded-lg shadow-md transition-transform duration-75"
                    style={{ 
                      transform: `translate(${panState.x}px, ${panState.y}px) scale(${zoom}) rotate(${rotation}deg)`
                    }}
                  />
                </div>
              )}

              {/* Video Player */}
              {doc.mimeType.startsWith('video/') && blobUrl && (
                <div className="w-full max-w-4xl aspect-video bg-black rounded-2xl shadow-xl overflow-hidden relative">
                  <video 
                    ref={videoRef}
                    src={blobUrl} 
                    controls 
                    className="w-full h-full"
                    style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                  />
                </div>
              )}

              {/* Audio Player */}
              {doc.mimeType.startsWith('audio/') && blobUrl && (
                <Card className="w-full max-w-md bg-white dark:bg-gray-900 border dark:border-gray-800 p-6 rounded-3xl shadow-xl flex flex-col items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-4xl animate-pulse">
                    📻
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate max-w-xs">{doc.name}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Audio Recording</p>
                  </div>
                  <audio 
                    ref={audioRef}
                    src={blobUrl} 
                    controls 
                    className="w-full"
                  />
                </Card>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating Toolbar Controls (only visible if preview is successful and not media type) */}
      {!loading && !error && (
        <div className="h-14 px-4 flex items-center justify-between border-t bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 flex-shrink-0 z-10">
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            {/* Show zoom controls only for zoomable formats */}
            {(doc.mimeType.startsWith('image/') || doc.mimeType === 'application/pdf' || officeType === 'docx' || officeType === 'text') && (
              <>
                <button 
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                  onClick={zoomOut}
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold min-w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button 
                  className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                  onClick={zoomIn}
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button 
                  className="p-1.5 text-xs text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg ml-1 font-semibold"
                  onClick={resetZoom}
                >
                  Reset
                </button>
              </>
            )}

            {/* Rotator only for image and video */}
            {(doc.mimeType.startsWith('image/') || doc.mimeType.startsWith('video/')) && (
              <button 
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl ml-2"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Controls (PDF only) */}
          {doc.mimeType === 'application/pdf' && pdfDoc && (
            <div className="flex items-center gap-2">
              <button 
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl disabled:opacity-40"
                onClick={() => setPageNum(prev => Math.max(prev - 1, 1))}
                disabled={pageNum <= 1}
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center text-xs font-semibold gap-1">
                <input 
                  type="number"
                  min={1}
                  max={numPages}
                  value={pageNum}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v >= 1 && v <= numPages) setPageNum(v);
                  }}
                  className="w-10 text-center h-7 border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-lg dark:text-white focus:outline-none"
                />
                <span className="text-gray-400">/</span>
                <span>{numPages}</span>
              </div>

              <button 
                className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl disabled:opacity-40"
                onClick={() => setPageNum(prev => Math.min(prev + 1, numPages))}
                disabled={pageNum >= numPages}
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Keyword Search in PDF */}
          {doc.mimeType === 'application/pdf' && pdfDoc && (
            <div className="flex items-center gap-1.5 relative w-48 sm:w-60">
              <input 
                type="text"
                placeholder="Find in PDF..."
                value={pdfSearchQuery}
                onChange={(e) => setPdfSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePdfSearch()}
                className="w-full pl-8 pr-7 h-8 text-xs border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-850 rounded-lg focus:outline-none dark:text-white"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              {pdfSearchQuery && (
                <button 
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline font-semibold"
                  onClick={handlePdfSearch}
                >
                  Go
                </button>
              )}
            </div>
          )}

          {/* Media Playback speed controls (Audio/Video only) */}
          {(doc.mimeType.startsWith('video/') || doc.mimeType.startsWith('audio/')) && (videoRef.current || audioRef.current) && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
              <span>Speed:</span>
              <select
                value={playbackSpeed}
                onChange={(e) => {
                  const spd = parseFloat(e.target.value);
                  setPlaybackSpeed(spd);
                  if (videoRef.current) videoRef.current.playbackRate = spd;
                  if (audioRef.current) audioRef.current.playbackRate = spd;
                }}
                className="border rounded px-1.5 py-0.5 h-7 bg-white dark:bg-gray-850 text-gray-700 dark:text-gray-300 border-gray-250 dark:border-gray-700"
              >
                <option value="0.5">0.5x</option>
                <option value="1.0">1.0x</option>
                <option value="1.5">1.5x</option>
                <option value="2.0">2.0x</option>
              </select>
            </div>
          )}

          {/* Bottom space filler for alignment if controls don't apply */}
          {!(doc.mimeType === 'application/pdf' || doc.mimeType.startsWith('image/') || doc.mimeType.startsWith('video/') || doc.mimeType.startsWith('audio/') || officeType === 'docx' || officeType === 'text') && (
            <span className="text-xs text-gray-400">Ready to view in-app</span>
          )}
        </div>
      )}
    </div>
  );
};
