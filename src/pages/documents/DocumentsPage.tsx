import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Search, Download, Eye, Trash2, Check, X, ChevronDown } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Avatar from '../../components/ui/Avatar';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { getDocuments, createDocument, deleteDocument, updateDocument, getProjects, getAllUsers, uploadFile } from '../../lib/firestore';
import { Document as TDocument, Project, AppUser } from '../../types';
import { formatDate, formatFileSize, getMimeIcon } from '../../lib/utils';
import toast from 'react-hot-toast';

const DocumentsPage: React.FC = () => {
  const { appUser } = useAuthStore();
  const { can } = usePermissions();
  const [documents, setDocuments] = useState<TDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProjectId, setUploadProjectId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewDoc, setPreviewDoc] = useState<TDocument | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [dRes, pRes, uRes] = await Promise.allSettled([
          getDocuments(),
          getProjects(),
          getAllUsers(),
        ]);
        if (dRes.status === 'fulfilled') setDocuments(dRes.value);
        if (pRes.status === 'fulfilled') setProjects(pRes.value);
        if (uRes.status === 'fulfilled') setUsers(uRes.value);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (!can('docs_view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title="Access Denied"
          description="You don't have permission to view documents."
        />
      </div>
    );
  }

  const filtered = documents.filter((d) => {
    if (projectFilter && d.projectId !== projectFilter) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getUploaderName = (uid: string) => users.find((u) => u.id === uid)?.name ?? 'Unknown';
  const getProjectName = (pid: string) => projects.find((p) => p.id === pid)?.name ?? '—';

  const handleUpload = async () => {
    if (!selectedFile || !appUser) return;
    if (!uploadProjectId) {
      toast.error('Please select a project for this document');
      return;
    }
    setUploading(true);
    try {
      const path = `documents/${Date.now()}_${selectedFile.name}`;
      const url = await uploadFile(selectedFile, path);
      const id = await createDocument({
        name: selectedFile.name,
        url,
        mimeType: selectedFile.type,
        size: selectedFile.size,
        projectId: uploadProjectId,
        uploadedBy: appUser.id,
        approvalStatus: 'pending',
      });
      const newDoc: TDocument = {
        id,
        name: selectedFile.name,
        url,
        mimeType: selectedFile.type,
        size: selectedFile.size,
        projectId: uploadProjectId,
        uploadedBy: appUser.id,
        approvalStatus: 'pending',
      };
      setDocuments((prev) => [newDoc, ...prev]);
      setUploadModal(false);
      setSelectedFile(null);
      toast.success('Document uploaded successfully');
    } catch {
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async (doc: TDocument) => {
    await updateDocument(doc.id, { approvalStatus: 'approved' });
    setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, approvalStatus: 'approved' } : d));
    toast.success('Document approved');
  };

  const handleReject = async (doc: TDocument) => {
    await updateDocument(doc.id, { approvalStatus: 'rejected' });
    setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, approvalStatus: 'rejected' } : d));
    toast.success('Document rejected');
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Delete this document?')) return;
    await deleteDocument(docId);
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    toast.success('Deleted');
  };

  const approvalBadge = (status: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
      approved: 'success', pending: 'warning', rejected: 'danger', none: 'default',
    };
    return map[status] ?? 'default';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Documents</h2>
        {can('docs_upload') && (
          <Button
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setUploadModal(true)}
          >
            Upload
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="relative">
          <select
            className="appearance-none px-3.5 pr-9 h-10 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title="No documents found"
          description="Upload your first document."
        />
      ) : (
        <Card padding={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-100 bg-gray-50/60">
                <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">File</th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Project</th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden sm:table-cell">Uploaded By</th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Size</th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                        {getMimeIcon(doc.mimeType)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-48">{doc.name}</p>
                        <p className="text-xs text-gray-400 lg:hidden">{formatFileSize(doc.size)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell text-gray-500 text-xs">{getProjectName(doc.projectId)}</td>
                  <td className="px-4 py-3.5 hidden sm:table-cell text-gray-500 text-xs">{getUploaderName(doc.uploadedBy)}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-gray-400 text-xs">{formatFileSize(doc.size)}</td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                      doc.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                      doc.approvalStatus === 'pending'  ? 'bg-amber-50 text-amber-700' :
                      doc.approvalStatus === 'rejected' ? 'bg-red-50 text-red-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {doc.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors" onClick={() => setPreviewDoc(doc)} title="Preview">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      {can('docs_approve') && doc.approvalStatus === 'pending' && (
                        <>
                          <button className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" onClick={() => handleApprove(doc)} title="Approve">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" onClick={() => handleReject(doc)} title="Reject">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" onClick={() => handleDelete(doc.id)} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Upload Modal */}
      <Modal
        open={uploadModal}
        onClose={() => { setUploadModal(false); setSelectedFile(null); }}
        title="Upload Document"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setUploadModal(false)}>Cancel</Button>
            <Button onClick={handleUpload} loading={uploading} disabled={!selectedFile}>
              Upload
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {selectedFile ? selectedFile.name : 'Click to choose file'}
            </p>
            {selectedFile && (
              <p className="text-xs text-gray-400 mt-1">{formatFileSize(selectedFile.size)}</p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          <Select
            label="Project (optional)"
            value={uploadProjectId}
            onChange={(e) => setUploadProjectId(e.target.value)}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Select project"
          />
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.name}
        size="2xl"
      >
        {previewDoc && (
          <div className="text-center">
            {previewDoc.mimeType.startsWith('image/') ? (
              <img src={previewDoc.url} alt={previewDoc.name} className="max-w-full max-h-96 object-contain mx-auto rounded-lg" />
            ) : previewDoc.mimeType === 'application/pdf' ? (
              <iframe src={previewDoc.url} className="w-full h-96 rounded-lg border" title={previewDoc.name} />
            ) : (
              <div className="py-12">
                <span className="text-6xl">{getMimeIcon(previewDoc.mimeType)}</span>
                <p className="mt-4 text-gray-600">{previewDoc.name}</p>
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <Download className="w-4 h-4" /> Download to view
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DocumentsPage;
