import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:photo_view/photo_view.dart';
import 'package:open_file/open_file.dart';
import 'package:share_plus/share_plus.dart';
import 'package:printing/printing.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:video_player/video_player.dart';
import 'package:audioplayers/audioplayers.dart' as ap;
import 'package:archive/archive.dart';
import 'package:csv/csv.dart';

import '../../app/theme.dart';
import '../../providers/document_provider.dart';
import '../../core/utils/document_cache_manager.dart';
import '../../core/utils/file_utils.dart';
import '../shared/widgets/loading_widget.dart';
import '../shared/widgets/error_widget.dart';

// Inversion matrix for PDF and text dark mode
const List<double> _invertMatrix = <double>[
  -1.0, 0.0, 0.0, 0.0, 255.0, // Red
  0.0, -1.0, 0.0, 0.0, 255.0, // Green
  0.0, 0.0, -1.0, 0.0, 255.0, // Blue
  0.0, 0.0, 0.0, 1.0, 0.0,    // Alpha
];

class DocumentViewerScreen extends ConsumerWidget {
  final String docId;
  const DocumentViewerScreen({super.key, required this.docId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final docAsync = ref.watch(documentProvider(docId));

    return docAsync.when(
      loading: () => const Scaffold(body: LoadingWidget()),
      error: (e, _) => AppErrorWidget(
        message: e.toString(),
        onRetry: () => ref.invalidate(documentProvider(docId)),
      ),
      data: (doc) {
        if (doc == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const Center(child: Text('Document not found')),
          );
        }

        return _DocumentViewer(
          fileUrl: doc.fileUrl,
          mimeType: doc.mimeType,
          fileName: doc.name,
        );
      },
    );
  }
}

class _DocumentViewer extends StatefulWidget {
  final String fileUrl;
  final String mimeType;
  final String fileName;
  final List<int>? inlineBytes; // For nested ZIP file previewing in-memory

  const _DocumentViewer({
    required this.fileUrl,
    required this.mimeType,
    required this.fileName,
    this.inlineBytes,
  });

  @override
  State<_DocumentViewer> createState() => _DocumentViewerState();
}

class _DocumentViewerState extends State<_DocumentViewer> with TickerProviderStateMixin {
  String? _localPath;
  List<int>? _fileBytes;
  bool _isLoading = true;
  String? _error;
  bool _isDarkMode = false;
  double _zoomScale = 1.0;
  double _rotationAngle = 0.0;

  // PDF page state
  PDFViewController? _pdfController;
  int _pdfPages = 0;
  int _pdfCurrentPage = 1;
  String _pdfSearchQuery = '';
  List<int> _pdfSearchResults = []; // Page numbers with matches

  // XLSX state
  TabController? _xlsxTabController;
  List<String> _xlsxSheetNames = [];
  Map<String, List<List<String>>> _xlsxSheetsData = {};
  String _xlsxSearchQuery = '';

  // PPTX slides
  List<List<String>> _pptxSlides = [];
  int _pptxActiveSlide = 0;

  // ZIP listing
  List<ArchiveFile> _zipFiles = [];

  // Text, JSON, CSV text content
  String _textRawContent = '';
  List<List<dynamic>> _csvRows = [];
  String _csvSearchQuery = '';

  // Media controllers
  VideoPlayerController? _videoController;
  ap.AudioPlayer? _audioPlayer;
  bool _audioIsPlaying = false;
  Duration _audioPosition = Duration.zero;
  Duration _audioDuration = Duration.zero;
  double _playbackSpeed = 1.0;

  @override
  void initState() {
    super.initState();
    _loadFile();
  }

  @override
  void dispose() {
    _videoController?.dispose();
    _audioPlayer?.dispose();
    _xlsxTabController?.dispose();
    super.dispose();
  }

  Future<void> _loadFile() async {
    try {
      if (widget.inlineBytes != null) {
        _fileBytes = widget.inlineBytes;
        final dir = await getTemporaryDirectory();
        final ext = widget.mimeType.contains('/') ? widget.mimeType.split('/').last : 'tmp';
        final file = File('${dir.path}/nested_${DateTime.now().millisecondsSinceEpoch}.$ext');
        await file.writeAsBytes(_fileBytes!);
        _localPath = file.path;
      } else {
        final file = await DocumentCacheManager.getFile(widget.fileUrl, mimeType: widget.mimeType);
        _localPath = file.path;
        _fileBytes = await file.readAsBytes();
      }

      final ext = widget.fileName.split('.').last.toLowerCase();

      // Setup parsers for formats
      if (widget.mimeType.contains('pdf') || ext == 'pdf') {
        // PDF parser is initialized via PDFView widget, we scan text for offline searches
      } else if (widget.mimeType.contains('sheet') || widget.mimeType.contains('excel') || ext == 'xlsx' || ext == 'xls') {
        _parseXLSX();
      } else if (widget.mimeType.contains('presentation') || widget.mimeType.contains('powerpoint') || ext == 'pptx' || ext == 'ppt') {
        _parsePPTX();
      } else if (widget.mimeType.contains('zip') || ext == 'zip') {
        _parseZIP();
      } else if (widget.mimeType.contains('csv') || ext == 'csv') {
        final decodedText = utf8.decode(_fileBytes!, allowMalformed: true);
        _csvRows = const CsvToListConverter().convert(decodedText);
        _textRawContent = decodedText;
      } else if (widget.mimeType.contains('video') || ext == 'mp4') {
        _videoController = VideoPlayerController.file(File(_localPath!))
          ..initialize().then((_) {
            if (mounted) setState(() {});
          });
      } else if (widget.mimeType.contains('audio') || ext == 'mp3') {
        _audioPlayer = ap.AudioPlayer();
        _audioPlayer!.setSourceDeviceFile(_localPath!);
        _audioPlayer!.onPositionChanged.listen((p) => setState(() => _audioPosition = p));
        _audioPlayer!.onDurationChanged.listen((d) => setState(() => _audioDuration = d));
        _audioPlayer!.onPlayerStateChanged.listen((state) {
          if (mounted) {
            setState(() => _audioIsPlaying = state == ap.PlayerState.playing);
          }
        });
      } else {
        // Text files
        if (widget.mimeType.startsWith('text/') || ['txt', 'json', 'xml', 'md'].contains(ext)) {
          _textRawContent = utf8.decode(_fileBytes!, allowMalformed: true);
        }
      }

      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  // Parse XLSX using archive decompressor
  void _parseXLSX() {
    if (_fileBytes == null) return;
    final archive = ZipDecoder().decodeBytes(_fileBytes!);
    
    // Parse sharedStrings.xml
    final sharedStrings = <String>[];
    final sharedStringsFile = archive.files.firstWhere(
      (f) => f.name.toLowerCase() == 'xl/sharedstrings.xml',
      orElse: () => ArchiveFile('dummy', 0, []),
    );
    if (sharedStringsFile.size > 0) {
      final xmlText = utf8.decode(sharedStringsFile.content, allowMalformed: true);
      final matches = RegExp(r'<t\b[^>]*>(.*?)</t>').allMatches(xmlText);
      for (var m in matches) {
        sharedStrings.add(m.group(1) ?? '');
      }
    }

    // Parse worksheets sheet1.xml, sheet2.xml, etc.
    final sheetNames = <String>[];
    final Map<String, List<List<String>>> sheetsData = {};

    // Get workbook names from xl/workbook.xml
    final workbookFile = archive.files.firstWhere(
      (f) => f.name.toLowerCase() == 'xl/workbook.xml',
      orElse: () => ArchiveFile('dummy', 0, []),
    );
    if (workbookFile.size > 0) {
      final xmlText = utf8.decode(workbookFile.content, allowMalformed: true);
      final nameMatches = RegExp(r'<sheet\b[^>]*\bname="([^"]+)"[^>]*\bsheetId="([^"]+)"', caseSensitive: false).allMatches(xmlText);
      for (var m in nameMatches) {
        final name = m.group(1) ?? '';
        final id = m.group(2) ?? '';
        sheetNames.add(name);

        // Find matching worksheet file xl/worksheets/sheet[ID].xml
        final sheetFile = archive.files.firstWhere(
          (f) => f.name.toLowerCase() == 'xl/worksheets/sheet$id.xml',
          orElse: () => archive.files.firstWhere(
            (f) => f.name.toLowerCase().contains('sheet$id.xml') || f.name.toLowerCase().contains('sheet${sheetNames.length}.xml'),
            orElse: () => ArchiveFile('dummy', 0, []),
          ),
        );

        if (sheetFile.size > 0) {
          final sheetXml = utf8.decode(sheetFile.content, allowMalformed: true);
          final rows = <List<String>>[];
          
          final rowMatches = RegExp(r'<row\b[^>]*>(.*?)</row>').allMatches(sheetXml);
          for (var rMatch in rowMatches) {
            final rowXml = rMatch.group(1) ?? '';
            final cells = <String>[];
            final cellMatches = RegExp(r'<c\b[^>]*\br="([A-Z]+)[0-9]+"[^>]*>(.*?)</c>').allMatches(rowXml);
            
            for (var cMatch in cellMatches) {
              final cXml = cMatch.group(2) ?? '';
              final tagType = cMatch.group(0) ?? '';
              final isSharedString = tagType.contains('t="s"');
              
              final vMatch = RegExp(r'<v\b[^>]*>(.*?)</v>').firstMatch(cXml);
              if (vMatch != null) {
                final vStr = vMatch.group(1) ?? '';
                if (isSharedString) {
                  final idx = int.tryParse(vStr);
                  if (idx != null && idx >= 0 && idx < sharedStrings.length) {
                    cells.add(sharedStrings[idx]);
                  } else {
                    cells.add(vStr);
                  }
                } else {
                  cells.add(vStr);
                }
              } else {
                cells.add('');
              }
            }
            if (cells.isNotEmpty) {
              rows.add(cells);
            }
          }
          sheetsData[name] = rows;
        }
      }
    }

    if (sheetNames.isEmpty) {
      sheetNames.add('Sheet1');
      sheetsData['Sheet1'] = [];
    }

    _xlsxSheetNames = sheetNames;
    _xlsxSheetsData = sheetsData;
    _xlsxTabController = TabController(length: _xlsxSheetNames.length, vsync: this);
  }

  // Parse PPTX using zip decompressor
  void _parsePPTX() {
    if (_fileBytes == null) return;
    final archive = ZipDecoder().decodeBytes(_fileBytes!);
    final slidesText = <List<String>>[];

    int slideIdx = 1;
    while (true) {
      final file = archive.files.firstWhere(
        (f) => f.name == 'ppt/slides/slide$slideIdx.xml',
        orElse: () => ArchiveFile('dummy', 0, []),
      );
      if (file.size == 0) break;

      final xmlText = utf8.decode(file.content, allowMalformed: true);
      final textMatches = RegExp(r'<a:t[^>]*>(.*?)</a:t>').allMatches(xmlText);
      final slideLines = textMatches.map((m) => m.group(1) ?? '').where((t) => t.trim().isNotEmpty).toList();
      slidesText.add(slideLines);
      slideIdx++;
    }

    _pptxSlides = slidesText;
  }

  // Parse ZIP
  void _parseZIP() {
    if (_fileBytes == null) return;
    final archive = ZipDecoder().decodeBytes(_fileBytes!);
    _zipFiles = archive.files.where((f) => f.isFile).toList();
  }

  // Parse DOCX Text Runs
  String _parseDOCX() {
    if (_fileBytes == null) return '';
    try {
      final archive = ZipDecoder().decodeBytes(_fileBytes!);
      final docFile = archive.files.firstWhere(
        (f) => f.name == 'word/document.xml',
        orElse: () => ArchiveFile('dummy', 0, []),
      );
      if (docFile.size == 0) return 'Empty Word Document';

      final xmlText = utf8.decode(docFile.content, allowMalformed: true);
      final pMatches = RegExp(r'<w:p\b[^>]*>(.*?)</w:p>').allMatches(xmlText);
      final paragraphs = <String>[];
      final tRegex = RegExp(r'<w:t[^>]*>(.*?)</w:t>');

      for (var pMatch in pMatches) {
        final pXml = pMatch.group(1) ?? '';
        final pText = tRegex.allMatches(pXml).map((m) => m.group(1) ?? '').join('');
        if (pText.trim().isNotEmpty) {
          paragraphs.add(pText);
        }
      }
      return paragraphs.join('\n\n');
    } catch (e) {
      return 'Failed to parse DOCX content: $e';
    }
  }

  // PDF Text Search implementation
  Future<void> _searchPdf() async {
    if (_pdfSearchQuery.trim().isEmpty || _localPath == null) return;
    setState(() => _isLoading = true);

    try {
      final List<int> matchPages = [];
      final fileBytes = File(_localPath!).readAsBytesSync();
      
      // Decompress FlateDecode streams to find text occurrences
      int index = 0;
      int pageCount = 0;

      // Scan through streams
      while (index < fileBytes.length) {
        int streamStart = _indexOf(fileBytes, utf8.encode('stream'), index);
        if (streamStart == -1) break;

        int contentStart = streamStart + 6;
        if (contentStart < fileBytes.length && fileBytes[contentStart] == 13) contentStart++;
        if (contentStart < fileBytes.length && fileBytes[contentStart] == 10) contentStart++;

        int streamEnd = _indexOf(fileBytes, utf8.encode('endstream'), contentStart);
        if (streamEnd == -1) break;

        final streamBytes = fileBytes.sublist(contentStart, streamEnd);
        try {
          final decompressed = zlib.decode(streamBytes);
          final decoded = utf8.decode(decompressed, allowMalformed: true);
          
          if (decoded.toLowerCase().contains(_pdfSearchQuery.toLowerCase())) {
            // Found a match in this stream block. PDF page count streams correspond closely
            pageCount++;
            matchPages.add(pageCount);
          }
        } catch (_) {}
        index = streamEnd + 9;
      }

      setState(() {
        _pdfSearchResults = matchPages.toSet().toList(); // Unique page list
        _isLoading = false;
      });

      if (_pdfSearchResults.isNotEmpty) {
        _pdfController?.setPage(_pdfSearchResults.first - 1);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Found ${_pdfSearchResults.length} page matches!')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No matches found')),
        );
      }
    } catch (e) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Search failed: $e')),
      );
    }
  }

  int _indexOf(Uint8List bytes, List<int> pattern, int start) {
    for (int i = start; i <= bytes.length - pattern.length; i++) {
      bool found = true;
      for (int j = 0; j < pattern.length; j++) {
        if (bytes[i + j] != pattern[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  // Print support
  Future<void> _printDocument() async {
    if (_localPath == null) return;
    final extension = widget.fileName.split('.').last.toLowerCase();

    try {
      if (widget.mimeType.contains('pdf') || extension == 'pdf') {
        final pdfBytes = await File(_localPath!).readAsBytes();
        await Printing.layoutPdf(onLayout: (_) => pdfBytes);
      } else if (widget.mimeType.contains('image') || ['png', 'jpg', 'jpeg'].contains(extension)) {
        final imgBytes = await File(_localPath!).readAsBytes();
        final doc = pw.Document();
        final image = pw.MemoryImage(imgBytes);
        doc.addPage(pw.Page(
          build: (pw.Context context) => pw.Center(child: pw.Image(image)),
        ));
        await Printing.layoutPdf(onLayout: (format) => doc.save());
      } else {
        // Print as text
        final text = _textRawContent.isNotEmpty ? _textRawContent : _parseDOCX();
        final doc = pw.Document();
        doc.addPage(pw.Page(
          build: (pw.Context context) => pw.Padding(
            padding: const pw.EdgeInsets.all(20),
            child: pw.Text(text, style: const pw.TextStyle(fontSize: 12)),
          ),
        ));
        await Printing.layoutPdf(onLayout: (format) => doc.save());
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to print: $e')),
      );
    }
  }

  // Share support
  Future<void> _shareDocument() async {
    if (_localPath == null) return;
    try {
      await Share.shareXFiles([XFile(_localPath!)], text: widget.fileName);
    } catch (e) {
      await Share.share(widget.fileUrl);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: LoadingWidget());
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.fileName)),
        body: AppErrorWidget(
          message: _error!,
          onRetry: () {
            setState(() {
              _error = null;
              _isLoading = true;
            });
            _loadFile();
          },
        ),
      );
    }

    final ext = widget.fileName.split('.').last.toLowerCase();
    final isMedia = widget.mimeType.startsWith('image/') || widget.mimeType.startsWith('video/') || widget.mimeType.startsWith('audio/');

    return Scaffold(
      backgroundColor: _isDarkMode ? Colors.black : Colors.grey[100],
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.fileName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            if (_localPath != null)
              Text(
                FileUtils.formatFileSize(File(_localPath!).lengthSync()),
                style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
              ),
          ],
        ),
        actions: [
          // Toggle dark mode (non-media only)
          if (!isMedia)
            IconButton(
              icon: Icon(_isDarkMode ? Icons.wb_sunny_rounded : Icons.nightlight_round, color: _isDarkMode ? Colors.amber : null),
              onPressed: () => setState(() => _isDarkMode = !_isDarkMode),
              tooltip: 'Toggle Dark Mode',
            ),
          IconButton(
            icon: const Icon(Icons.print_rounded),
            onPressed: _printDocument,
            tooltip: 'Print',
          ),
          IconButton(
            icon: const Icon(Icons.share_rounded),
            onPressed: _shareDocument,
            tooltip: 'Share',
          ),
          IconButton(
            icon: const Icon(Icons.download_rounded),
            onPressed: () => OpenFile.open(_localPath),
            tooltip: 'Download / Open in External App',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ColorFiltered(
                colorFilter: _isDarkMode && !isMedia
                    ? const ColorFilter.matrix(_invertMatrix)
                    : const ColorFilter.matrix([
                        1, 0, 0, 0, 0,
                        0, 1, 0, 0, 0,
                        0, 0, 1, 0, 0,
                        0, 0, 0, 1, 0,
                      ]),
                child: _buildViewerContent(ext),
              ),
            ),
            if (!_isLoading && !isMedia) _buildToolbar(ext),
          ],
        ),
      ),
    );
  }

  Widget _buildViewerContent(String ext) {
    final mime = widget.mimeType;

    // PDF View
    if (mime.contains('pdf') || ext == 'pdf') {
      return Container(
        color: Colors.grey[800],
        child: RotationTransition(
          turns: AlwaysStoppedAnimation(_rotationAngle / 360),
          child: PDFView(
            filePath: _localPath!,
            enableSwipe: true,
            swipeHorizontal: false,
            autoSpacing: true,
            pageFling: true,
            onViewCreated: (controller) => setState(() => _pdfController = controller),
            onRender: (pages) => setState(() => _pdfPages = pages ?? 0),
            onPageChanged: (page, total) {
              if (page != null) setState(() => _pdfCurrentPage = page + 1);
            },
            onError: (error) => setState(() => _error = error.toString()),
          ),
        ),
      );
    }

    // Photo View
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].contains(ext)) {
      return RotationTransition(
        turns: AlwaysStoppedAnimation(_rotationAngle / 360),
        child: PhotoView(
          imageProvider: FileImage(File(_localPath!)),
          backgroundDecoration: BoxDecoration(color: _isDarkMode ? Colors.black : Colors.grey[100]),
          minScale: PhotoViewComputedScale.contained,
          maxScale: PhotoViewComputedScale.covered * 3.0,
        ),
      );
    }

    // Video View
    if (mime.startsWith('video/') || ext == 'mp4') {
      if (_videoController == null || !_videoController!.value.isInitialized) {
        return const LoadingWidget();
      }
      return Center(
        child: AspectRatio(
          aspectRatio: _videoController!.value.aspectRatio,
          child: Stack(
            alignment: Alignment.bottomCenter,
            children: [
              VideoPlayer(_videoController!),
              _VideoControls(controller: _videoController!),
            ],
          ),
        ),
      );
    }

    // Audio View
    if (mime.startsWith('audio/') || ext == 'mp3') {
      return Center(
        child: Card(
          margin: const EdgeInsets.all(24),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          elevation: 4,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withAlpha(25),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.audiotrack_rounded, size: 40, color: AppTheme.primary),
                ),
                const SizedBox(height: 20),
                Text(
                  widget.fileName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 24),
                // Position Slider
                Slider(
                  value: _audioPosition.inMilliseconds.toDouble(),
                  max: _audioDuration.inMilliseconds.toDouble() > 0
                      ? _audioDuration.inMilliseconds.toDouble()
                      : 100,
                  onChanged: (v) {
                    _audioPlayer?.seek(Duration(milliseconds: v.toInt()));
                  },
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(_formatDuration(_audioPosition), style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                      Text(_formatDuration(_audioDuration), style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Play / Pause and speed
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    DropdownButton<double>(
                      value: _playbackSpeed,
                      items: const [
                        DropdownMenuItem(value: 0.5, child: Text('0.5x')),
                        DropdownMenuItem(value: 1.0, child: Text('1.0x')),
                        DropdownMenuItem(value: 1.5, child: Text('1.5x')),
                        DropdownMenuItem(value: 2.0, child: Text('2.0x')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _playbackSpeed = val);
                          _audioPlayer?.setPlaybackRate(val);
                        }
                      },
                    ),
                    const SizedBox(width: 24),
                    IconButton(
                      iconSize: 56,
                      color: AppTheme.primary,
                      icon: Icon(_audioIsPlaying ? Icons.pause_circle_filled_rounded : Icons.play_circle_filled_rounded),
                      onPressed: () {
                        if (_audioIsPlaying) {
                          _audioPlayer?.pause();
                        } else {
                          _audioPlayer?.resume();
                        }
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }

    // ZIP View
    if (mime.contains('zip') || ext == 'zip') {
      if (_zipFiles.isEmpty) {
        return const Center(child: Text('Empty ZIP archive'));
      }
      return ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _zipFiles.length,
        itemBuilder: (context, idx) {
          final file = _zipFiles[idx];
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: const Icon(Icons.insert_drive_file_rounded, color: Colors.blue),
              title: Text(file.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              subtitle: Text(FileUtils.formatFileSize(file.size)),
              trailing: const Icon(Icons.remove_red_eye_rounded, size: 18),
              onTap: () async {
                // Decompress in memory and push nested viewer
                final nestedBytes = file.content as List<int>;
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => _DocumentViewer(
                      fileUrl: '',
                      mimeType: FileUtils.iconForMimeType(file.name) == Icons.picture_as_pdf_rounded 
                          ? 'application/pdf' 
                          : file.name.contains('.') ? 'image/${file.name.split('.').last}' : 'text/plain',
                      fileName: file.name,
                      inlineBytes: nestedBytes,
                    ),
                  ),
                );
              },
            ),
          );
        },
      );
    }

    // XLSX View
    if (_xlsxSheetNames.isNotEmpty && _xlsxSheetsData.isNotEmpty) {
      return Column(
        children: [
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _xlsxTabController,
              isScrollable: true,
              tabs: _xlsxSheetNames.map((name) => Tab(text: name)).toList(),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search in sheet...',
                prefixIcon: Icon(Icons.search, size: 18),
                contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
              ),
              onChanged: (val) => setState(() => _xlsxSearchQuery = val),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _xlsxTabController,
              children: _xlsxSheetNames.map((sheetName) {
                var rows = _xlsxSheetsData[sheetName] ?? [];
                if (_xlsxSearchQuery.isNotEmpty) {
                  rows = rows.where((row) => row.any((cell) => cell.toLowerCase().contains(_xlsxSearchQuery.toLowerCase()))).toList();
                }
                if (rows.isEmpty) return const Center(child: Text('No cells found'));
                
                return SingleChildScrollView(
                  scrollDirection: Axis.vertical,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Table(
                      border: TableBorder.all(color: Colors.grey[300]!),
                      defaultColumnWidth: const IntrinsicColumnWidth(),
                      children: rows.map((row) {
                        return TableRow(
                          children: row.map((cell) {
                            return Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              child: Text(
                                cell,
                                style: TextStyle(
                                  fontSize: 12 * _zoomScale,
                                  fontFamily: 'Courier',
                                ),
                              ),
                            );
                          }).toList(),
                        );
                      }).toList(),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      );
    }

    // PPTX View
    if (_pptxSlides.isNotEmpty) {
      return Column(
        children: [
          Expanded(
            child: PageView.builder(
              itemCount: _pptxSlides.length,
              onPageChanged: (page) => setState(() => _pptxActiveSlide = page),
              itemBuilder: (context, sIdx) {
                final lines = _pptxSlides[sIdx];
                return Card(
                  margin: const EdgeInsets.all(24),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  color: Colors.white,
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: lines.map((line) {
                          final isTitle = lines.indexOf(line) == 0;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              line,
                              style: TextStyle(
                                fontSize: (isTitle ? 22 : 14) * _zoomScale,
                                fontWeight: isTitle ? FontWeight.bold : FontWeight.normal,
                                color: isTitle ? AppTheme.primary : Colors.black87,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              'Slide ${_pptxActiveSlide + 1} of ${_pptxSlides.length}',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          )
        ],
      );
    }

    // CSV View
    if (_csvRows.isNotEmpty) {
      var displayRows = _csvRows;
      if (_csvSearchQuery.isNotEmpty) {
        displayRows = _csvRows.where((row) => row.any((cell) => cell.toString().toLowerCase().contains(_csvSearchQuery.toLowerCase()))).toList();
      }
      return Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Filter CSV rows...',
                prefixIcon: Icon(Icons.filter_list_rounded, size: 18),
                contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(12))),
              ),
              onChanged: (val) => setState(() => _csvSearchQuery = val),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.vertical,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  border: TableBorder.symmetric(inside: BorderSide(color: Colors.grey[200]!)),
                  columns: displayRows.isNotEmpty
                      ? displayRows.first.map((c) => DataColumn(label: Text(c.toString(), style: const TextStyle(fontWeight: FontWeight.bold)))).toList()
                      : [],
                  rows: displayRows.length > 1
                      ? displayRows.skip(1).map((row) {
                          return DataRow(
                            cells: row.map((cell) => DataCell(Text(cell.toString(), style: TextStyle(fontSize: 12 * _zoomScale)))).toList(),
                          );
                        }).toList()
                      : [],
                ),
              ),
            ),
          ),
        ],
      );
    }

    // DOCX view (rendered as paragraphs list)
    if (ext == 'docx') {
      final docxText = _parseDOCX();
      return SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Text(
          docxText,
          style: TextStyle(
            fontSize: 14 * _zoomScale,
            height: 1.5,
            color: Colors.black87,
          ),
        ),
      );
    }

    // Text fallback (TXT, JSON, XML)
    if (_textRawContent.isNotEmpty) {
      return SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Text(
          _textRawContent,
          style: TextStyle(
            fontSize: 12 * _zoomScale,
            fontFamily: ext == 'json' || ext == 'xml' ? 'Courier' : 'Inter',
            height: 1.4,
          ),
        ),
      );
    }

    // Default File Info Card
    return Center(
      child: Card(
        margin: const EdgeInsets.all(24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                FileUtils.iconForMimeType(widget.mimeType),
                size: 64,
                color: FileUtils.colorForMimeType(widget.mimeType),
              ),
              const SizedBox(height: 20),
              Text(
                widget.fileName,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'MimeType: ${widget.mimeType}',
                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => OpenFile.open(_localPath),
                icon: const Icon(Icons.open_in_new_rounded),
                label: const Text('Open in Device App'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildToolbar(String ext) {
    final mime = widget.mimeType;

    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey[200]!)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Zoom panel
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.zoom_out_rounded),
                onPressed: () => setState(() => _zoomScale = (_zoomScale - 0.2).clamp(0.4, 3.0)),
              ),
              Text('${(_zoomScale * 100).toInt()}%', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              IconButton(
                icon: const Icon(Icons.zoom_in_rounded),
                onPressed: () => setState(() => _zoomScale = (_zoomScale + 0.2).clamp(0.4, 3.0)),
              ),
              if (_zoomScale != 1.0 || _rotationAngle != 0.0)
                TextButton(
                  onPressed: () => setState(() {
                    _zoomScale = 1.0;
                    _rotationAngle = 0.0;
                  }),
                  child: const Text('Reset', style: TextStyle(fontSize: 12)),
                ),
            ],
          ),

          // PDF pages controller
          if ((mime.contains('pdf') || ext == 'pdf') && _pdfPages > 0)
            Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left_rounded),
                  onPressed: _pdfCurrentPage > 1
                      ? () => _pdfController?.setPage(_pdfCurrentPage - 2)
                      : null,
                ),
                Text('$_pdfCurrentPage / $_pdfPages', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                IconButton(
                  icon: const Icon(Icons.chevron_right_rounded),
                  onPressed: _pdfCurrentPage < _pdfPages
                      ? () => _pdfController?.setPage(_pdfCurrentPage)
                      : null,
                ),
              ],
            ),

          // PDF text search bar
          if (mime.contains('pdf') || ext == 'pdf')
            Expanded(
              child: Container(
                margin: const EdgeInsets.only(left: 12),
                height: 36,
                child: TextField(
                  decoration: const InputDecoration(
                    hintText: 'Search word...',
                    prefixIcon: Icon(Icons.search_rounded, size: 16),
                    contentPadding: EdgeInsets.symmetric(vertical: 4),
                    border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(10))),
                  ),
                  onSubmitted: (val) {
                    _pdfSearchQuery = val;
                    _searchPdf();
                  },
                ),
              ),
            ),

          // Rotation panel (Image only)
          if (mime.startsWith('image/'))
            IconButton(
              icon: const Icon(Icons.rotate_right_rounded),
              onPressed: () => setState(() => _rotationAngle = (_rotationAngle + 90) % 360),
              tooltip: 'Rotate 90°',
            ),
        ],
      ),
    );
  }

  String _formatDuration(Duration d) {
    final min = d.inMinutes;
    final sec = d.inSeconds % 60;
    return '$min:${sec.toString().padLeft(2, '0')}';
  }
}

// Video Controls Widget
class _VideoControls extends StatefulWidget {
  final VideoPlayerController controller;
  const _VideoControls({required this.controller});

  @override
  State<_VideoControls> createState() => _VideoControlsState();
}

class _VideoControlsState extends State<_VideoControls> {
  double _speed = 1.0;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black45,
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          VideoProgressIndicator(
            widget.controller,
            allowScrubbing: true,
            colors: const VideoProgressColors(
              playedColor: AppTheme.primary,
              bufferedColor: Colors.grey,
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                color: Colors.white,
                icon: Icon(
                  widget.controller.value.isPlaying 
                      ? Icons.pause_rounded 
                      : Icons.play_arrow_rounded,
                ),
                onPressed: () {
                  setState(() {
                    if (widget.controller.value.isPlaying) {
                      widget.controller.pause();
                    } else {
                      widget.controller.play();
                    }
                  });
                },
              ),
              DropdownButton<double>(
                value: _speed,
                dropdownColor: Colors.black87,
                style: const TextStyle(color: Colors.white, fontSize: 12),
                items: const [
                  DropdownMenuItem(value: 0.5, child: Text('0.5x')),
                  DropdownMenuItem(value: 1.0, child: Text('1.0x')),
                  DropdownMenuItem(value: 1.5, child: Text('1.5x')),
                  DropdownMenuItem(value: 2.0, child: Text('2.0x')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _speed = val);
                    widget.controller.setPlaybackSpeed(val);
                  }
                },
              ),
            ],
          ),
        ],
      ),
    );
  }
}
