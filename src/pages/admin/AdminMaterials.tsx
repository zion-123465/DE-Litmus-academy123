import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Upload, FileText, Image as ImageIcon, X, ExternalLink, Loader2, Search, Sparkles, RefreshCw } from 'lucide-react';
import { apiFetch, formatCategory, formatNGN, parseSetting, uploadFile } from '../../lib/api';
import { dataUrlToFile, generateCoverDataUrl } from '../../lib/coverArt';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import CopyLinkButton from '../../components/CopyLinkButton';
import { EmptyState } from '../../components/ui';

interface Material {
  id: number; title: string; description?: string | null; level: string; department: string;
  file_url: string; file_type: string; cover_url?: string | null; price: number; is_free: boolean; downloads: number;
  body_text?: string | null;
}

const EMPTY = { title: '', description: '', level: '100', department: '', file_url: '', file_type: 'pdf', cover_url: '', price: 0, is_free: true, body_text: '' };

type ContentMode = 'file' | 'text';

export default function AdminMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'file' | 'cover' | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [levels, setLevels] = useState<string[]>(['100', '200', '300', 'WAEC', 'JAMB']);
  const [departments, setDepartments] = useState<string[]>(['General']);
  const [newDeptInline, setNewDeptInline] = useState('');
  const [showNewDept, setShowNewDept] = useState(false);
  const [aiCover, setAiCover] = useState<string | null>(null);
  const [coverVariant, setCoverVariant] = useState(0);
  const [contentMode, setContentMode] = useState<ContentMode>('file');
  const [pasteText, setPasteText] = useState('');
  const [arranging, setArranging] = useState(false);
  const [arranged, setArranged] = useState<{ title: string; blocks: { type: string; text: string }[] } | null>(null);

  useEffect(() => {
    fetchAll();
    apiFetch<any[]>('/api/settings').then((rows) => {
      const lv = rows.find((r) => r.key === 'levels');
      const dp = rows.find((r) => r.key === 'departments');
      if (lv) { const p = parseSetting(lv); if (p?.items?.length) setLevels(p.items); }
      if (dp) { const p = parseSetting(dp); if (p?.items?.length) setDepartments(p.items); }
    }).catch(() => {});
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const d = await apiFetch<Material[]>('/api/materials?limit=300');
      setMaterials(d);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, department: departments[0] || 'General' });
    setError('');
    setNewDeptInline('');
    setShowNewDept(false);
    setAiCover(null);
    setCoverVariant(0);
    setContentMode('file');
    setPasteText('');
    setArranged(null);
    setModalOpen(true);
  };

  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({ title: m.title, description: m.description || '', level: m.level, department: m.department, file_url: m.file_url, file_type: m.file_type, cover_url: m.cover_url || '', price: m.price, is_free: m.is_free, body_text: (m as any).body_text || '' });
    setError('');
    setNewDeptInline('');
    setShowNewDept(false);
    setAiCover(null);
    setCoverVariant(0);
    const isText = m.file_type === 'text';
    setContentMode(isText ? 'text' : 'file');
    setPasteText('');
    try {
      setArranged(isText && (m as any).body_text ? JSON.parse((m as any).body_text) : null);
    } catch {
      setArranged(null);
    }
    setModalOpen(true);
  };

  const addDepartmentInline = async () => {
    const name = newDeptInline.trim();
    if (!name) return;
    if (departments.includes(name)) {
      setForm((f: any) => ({ ...f, department: name }));
      setNewDeptInline('');
      setShowNewDept(false);
      return;
    }
    setBusy(true);
    try {
      const next = [...departments, name];
      await apiFetch('/api/settings', { method: 'PUT', admin: true, body: JSON.stringify({ key: 'departments', value: { items: next } }) });
      setDepartments(next);
      setForm((f: any) => ({ ...f, department: name }));
      setNewDeptInline('');
      setShowNewDept(false);
    } catch (e: any) {
      setError(e.message || 'Could not add department.');
    } finally {
      setBusy(false);
    }
  };

  const previewAiCover = (variant?: number) => {
    setError('');
    if (!form.title.trim()) {
      setError('Enter the material title first so AI can design the cover.');
      return;
    }
    const v = variant ?? coverVariant;
    setCoverVariant(v);
    try {
      const dataUrl = generateCoverDataUrl({
        title: form.title.trim(),
        category: formatCategory(form.level),
        department: form.department || 'General',
        variant: v,
      });
      setAiCover(dataUrl);
    } catch {
      setError('Could not generate a cover preview.');
    }
  };

  const useAiCover = async () => {
    if (!aiCover) return;
    setUploading('cover');
    setError('');
    try {
      const file = dataUrlToFile(aiCover, `cover-${Date.now()}.png`);
      const up = await uploadFile(file, 'covers');
      setForm((f: any) => ({ ...f, cover_url: up.url }));
      setAiCover(null);
    } catch (e: any) {
      setError(e.message || 'Could not save AI cover.');
    } finally {
      setUploading(null);
    }
  };

  const arrangePasted = async () => {
    setError('');
    setArranged(null);
    if (!pasteText.trim() || pasteText.trim().length < 20) {
      setError('Paste the material text first (at least a few sentences).');
      return;
    }
    setArranging(true);
    try {
      const r = await apiFetch<{ title: string; blocks: { type: string; text: string }[] }>('/api/arrange-material', {
        method: 'POST',
        admin: true,
        body: JSON.stringify({ pasted_text: pasteText, title: form.title }),
      });
      setArranged({ title: r.title, blocks: r.blocks });
    } catch (e: any) {
      setError(e.message || 'AI arrangement failed.');
    } finally {
      setArranging(false);
    }
  };

  const handleFile = async (file: File, kind: 'file' | 'cover') => {
    setUploading(kind);
    setError('');
    try {
      const up = await uploadFile(file, kind === 'file' ? 'materials' : 'covers');
      if (kind === 'file') {
        const isImg = file.type.startsWith('image/');
        setForm((f: any) => ({ ...f, file_url: up.url, file_type: isImg ? 'image' : 'pdf' }));
      } else {
        setForm((f: any) => ({ ...f, cover_url: up.url }));
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed.');
    } finally {
      setUploading(null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Title is required.');
    const useText = contentMode === 'text';
    if (!useText && !form.file_url) return setError('Upload the material file (PDF or image) first, or switch to Text form.');
    if (useText && !arranged?.blocks?.length) return setError('Paste the text and tap "Arrange with AI" first.');
    setBusy(true);
    try {
      let coverUrl = form.cover_url || '';
      // AI auto-cover: if the admin didn't upload one, generate + upload one.
      if (!coverUrl) {
        const dataUrl = generateCoverDataUrl({
          title: form.title.trim(),
          category: formatCategory(form.level),
          department: form.department || 'General',
          variant: coverVariant,
        });
        const file = dataUrlToFile(dataUrl, `cover-${Date.now()}.png`);
        const up = await uploadFile(file, 'covers');
        coverUrl = up.url;
      }
      const payload = {
        ...form,
        file_type: useText ? 'text' : form.file_type,
        file_url: useText ? 'text://in-site' : form.file_url,
        body_text: useText ? JSON.stringify(arranged) : null,
        cover_url: coverUrl, price: Number(form.price) || 0, is_free: !(Number(form.price) > 0)
      };
      if (editing) {
        await apiFetch('/api/materials', { method: 'PUT', admin: true, body: JSON.stringify({ id: editing.id, ...payload }) });
      } else {
        await apiFetch('/api/materials', { method: 'POST', admin: true, body: JSON.stringify(payload) });
      }
      setModalOpen(false);
      fetchAll();
    } catch (e: any) {
      setError(e.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this material? Students will lose access.')) return;
    try {
      await apiFetch('/api/materials', { method: 'DELETE', admin: true, body: JSON.stringify({ id }) });
      fetchAll();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filtered = materials.filter((m) => {
    const q = search.trim().toLowerCase();
    return !q || `${m.title} ${m.department} ${m.level}`.toLowerCase().includes(q);
  });

  if (loading) return <Spinner label="Loading materials…" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-navy-900">Materials Manager</h1>
          <p className="text-sm text-gray-500">Upload PDFs & images, set prices, categories (university / WAEC / JAMB) and departments.</p>
        </div>
        <button onClick={openNew} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Material
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input-field pl-10" placeholder="Search materials…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No materials" message="Upload your first PDF or image material." action={<button onClick={openNew} className="gold-btn font-bold text-sm px-5 py-2.5 rounded-xl">Add Material</button>} />
      ) : (
        <div className="bg-white rounded-2xl border border-navy-100 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-navy-950 text-white text-left text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Downloads</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-t border-navy-50 hover:bg-navy-50/50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-navy-900">{m.title}</div>
                      <a href={m.file_url} target="_blank" rel="noreferrer" className="text-[11px] text-navy-600 hover:text-gold-600 flex items-center gap-1">
                        Open file <ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="mt-1.5">
                        <CopyLinkButton
                          id={m.id}
                          kind="material"
                          title={m.title}
                          subtitle={`${formatCategory(m.level)} · ${m.department}${m.description ? ' — ' + m.description : ''}`}
                          imageUrl={m.cover_url}
                          fileUrl={m.file_url}
                          fileType={m.file_type}
                          priceLabel={m.is_free || Number(m.price) <= 0 ? 'FREE' : formatNGN(m.price)}
                          compact
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="badge bg-navy-900 text-gold-300">{formatCategory(m.level)}</span></td>
                    <td className="px-4 py-3 text-gray-600">{m.department}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-gray-600 text-xs font-bold">
                        {m.file_type === 'image' ? <ImageIcon className="w-4 h-4" /> : m.file_type === 'text' ? <Sparkles className="w-4 h-4" /> : <FileText className="w-4 h-4" />} {m.file_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-extrabold text-navy-900">{m.is_free || Number(m.price) <= 0 ? <span className="badge bg-emerald-100 text-emerald-700">FREE</span> : formatNGN(m.price)}</td>
                    <td className="px-4 py-3 text-gray-600">{m.downloads || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(m)} className="p-2 rounded-lg bg-navy-50 hover:bg-navy-900 hover:text-gold-300 text-navy-800 transition" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(m.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-600 hover:text-white text-red-600 transition" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Material' : 'Add Material'} wide>
        <form onSubmit={save} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="label-text">Title *</label>
            <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. CHM 101 Complete Notes" />
          </div>
          <div>
            <label className="label-text">Description</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short summary of the material…" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label-text">Category (University Level / WAEC / JAMB)</label>
              <select className="input-field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                {levels.map((l) => <option key={l} value={l}>{formatCategory(l)}</option>)}
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="label-text">Department</label>
              <select className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {!showNewDept ? (
                <button type="button" onClick={() => setShowNewDept(true)} className="mt-1.5 text-[11px] font-bold text-gold-600 hover:text-gold-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> New department
                </button>
              ) : (
                <div className="mt-1.5 flex gap-1.5">
                  <input className="input-field !py-1.5 !text-xs" placeholder="e.g. Computer Science" value={newDeptInline} onChange={(e) => setNewDeptInline(e.target.value)} />
                  <button type="button" onClick={addDepartmentInline} disabled={busy || !newDeptInline.trim()} className="bg-navy-900 text-gold-300 font-bold text-xs px-3 rounded-lg disabled:opacity-50">Add</button>
                  <button type="button" onClick={() => { setShowNewDept(false); setNewDeptInline(''); }} className="text-gray-400 hover:text-red-500 px-1"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <div>
              <label className="label-text">Price (₦, 0 = free)</label>
              <input type="number" min="0" className="input-field" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label-text">Content Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContentMode('file')}
                className={`flex items-center justify-center gap-2 font-bold text-sm py-2.5 rounded-xl border-2 transition ${contentMode === 'file' ? 'border-gold-500 bg-gold-50 text-navy-900' : 'border-navy-100 text-gray-500 hover:border-gold-400'}`}
              >
                <Upload className="w-4 h-4" /> File (PDF/Image)
              </button>
              <button
                type="button"
                onClick={() => setContentMode('text')}
                className={`flex items-center justify-center gap-2 font-bold text-sm py-2.5 rounded-xl border-2 transition ${contentMode === 'text' ? 'border-gold-500 bg-gold-50 text-navy-900' : 'border-navy-100 text-gray-500 hover:border-gold-400'}`}
              >
                <FileText className="w-4 h-4" /> Text form (AI arranges)
              </button>
            </div>
          </div>
          {contentMode === 'file' ? (
          <div>
            <label className="label-text">Material File — PDF or Image * (max 9MB)</label>
            {form.file_url ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
                <FileText className="w-4 h-4 text-emerald-600" />
                <a href={form.file_url} target="_blank" rel="noreferrer" className="font-bold text-emerald-700 hover:underline truncate flex-1">File uploaded — preview</a>
                <span className="badge bg-emerald-600 text-white">{form.file_type.toUpperCase()}</span>
                <button type="button" onClick={() => setForm({ ...form, file_url: '' })} className="text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-navy-100 hover:border-gold-400 rounded-xl px-4 py-6 cursor-pointer text-sm text-gray-500">
                {uploading === 'file' ? <Loader2 className="w-5 h-5 animate-spin text-navy-700" /> : <Upload className="w-5 h-5 text-navy-700" />}
                {uploading === 'file' ? 'Uploading…' : 'Upload PDF or image'}
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'file')} />
              </label>
            )}
          </div>
          ) : (
          <div className="space-y-3">
            <div>
              <label className="label-text">Paste raw text — AI will arrange it into a clean study note *</label>
              <textarea
                className="input-field font-mono text-xs"
                rows={8}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Copy study notes from anywhere and paste here — headings, lists, paragraphs. AI will arrange it all neatly…"
              />
            </div>
            <button
              type="button"
              onClick={arrangePasted}
              disabled={arranging}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gold-500/60 hover:border-gold-500 bg-gold-50 font-bold text-sm py-3 rounded-xl text-navy-900 transition disabled:opacity-60"
            >
              {arranging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-gold-600" />}
              {arranging ? 'AI is arranging…' : 'Arrange with AI'}
            </button>
            {arranged && arranged.blocks?.length > 0 && (
              <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 max-h-72 overflow-y-auto scroll-thin">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI-arranged preview ({arranged.blocks.length} blocks)
                </div>
                <div className="space-y-2 bg-white rounded-lg p-4 border border-navy-100">
                  {arranged.blocks.map((b: any, i: number) => (
                    <div key={i}>
                      {b.type === 'h' && <div className="font-display font-extrabold text-navy-900 text-base pt-1">{b.text}</div>}
                      {b.type === 'h2' && <div className="font-bold text-gold-700 text-sm pt-1">{b.text}</div>}
                      {b.type === 'p' && <p className="text-sm text-gray-700 leading-relaxed">{b.text}</p>}
                      {b.type === 'li' && (
                        <div className="flex gap-2 text-sm text-gray-700">
                          <span className="text-gold-600 font-extrabold">•</span>
                          <span>{b.text}</span>
                        </div>
                      )}
                      {b.type === 'quote' && (
                        <div className="border-l-4 border-gold-400 bg-gold-50 px-3 py-2 text-sm italic text-gray-700 rounded-r-lg">{b.text}</div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-emerald-700 mt-2">Looks good? Press Publish — students will read this inside the website reader.</p>
              </div>
            )}
          </div>
          )}
          <div>
            <label className="label-text">Cover Image — upload your own, or let AI design one</label>
            {form.cover_url ? (
              <div className="flex items-center gap-3">
                <img src={form.cover_url} alt="cover" className="w-16 h-16 rounded-xl object-cover" />
                <button type="button" onClick={() => setForm({ ...form, cover_url: '' })} className="text-sm font-bold text-red-500">Remove</button>
              </div>
            ) : aiCover ? (
              <div className="border border-gold-400/50 bg-gold-50 rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <img src={aiCover} alt="AI cover preview" className="w-24 h-28 rounded-lg object-cover shadow" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-navy-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-gold-600" /> AI-designed cover preview
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Generated from your title, category & department.</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button type="button" onClick={useAiCover} disabled={uploading !== null} className="gold-btn font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                        {uploading === 'cover' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {uploading === 'cover' ? 'Saving…' : 'Use This Cover'}
                      </button>
                      <button type="button" onClick={() => previewAiCover(coverVariant + 1)} className="text-xs font-bold text-navy-800 border border-navy-100 hover:border-gold-400 px-4 py-2 rounded-lg flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> New Style
                      </button>
                      <button type="button" onClick={() => setAiCover(null)} className="text-xs font-bold text-gray-400 hover:text-red-500 px-2 py-2">Discard</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-navy-100 hover:border-gold-400 rounded-xl px-4 py-4 cursor-pointer text-sm text-gray-500">
                  {uploading === 'cover' ? <Loader2 className="w-5 h-5 animate-spin text-navy-700" /> : <Upload className="w-5 h-5 text-navy-700" />}
                  {uploading === 'cover' ? 'Uploading…' : 'Upload cover image'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'cover')} />
                </label>
                <button
                  type="button"
                  onClick={() => previewAiCover()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gold-500/60 hover:border-gold-500 bg-gold-50 font-bold text-sm py-3 rounded-xl text-navy-900 transition"
                >
                  <Sparkles className="w-4 h-4 text-gold-600" /> Or: Generate Cover with AI
                </button>
                <p className="text-[11px] text-gray-400">Tip: if you publish without a cover, AI will auto-design one from your title.</p>
              </div>
            )}
          </div>
          <button type="submit" disabled={busy || uploading !== null} className="w-full gold-btn font-bold py-3 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Publish Material'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
